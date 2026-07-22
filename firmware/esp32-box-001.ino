#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <MPU6050.h>
#include <TinyGPS++.h>
#include <math.h>

// ================= DEVICE =================
#define DEVICE_ID "BOX-001"

// ================= WIFI =================
const char* WIFI_SSID     = "net";
const char* WIFI_PASSWORD = "1234567890";

// ================= MQTT =================
// Use same broker as server (test.mosquitto.org for public testing)
const char* MQTT_SERVER = "test.mosquitto.org";
const int   MQTT_PORT   = 1883;

// Topics (must match Node.js server)
String TOPIC_GPS     = "box/" DEVICE_ID "/gps";
String TOPIC_TAMPER  = "box/" DEVICE_ID "/tamper";
String TOPIC_SHOCK   = "box/" DEVICE_ID "/shock";
String TOPIC_STATUS  = "box/" DEVICE_ID "/status";
String TOPIC_COMMAND = "box/" DEVICE_ID "/command";

// ================= TIMING =================
#define GPS_PUBLISH_MS      3000
#define GPS_SERIAL_PRINT_MS 2000
#define STATUS_PUBLISH_MS   10000
#define SHOCK_COOLDOWN_MS   8000
#define UNLOCK_WINDOW_MS    60000

// ================= MPU6050 (±2g range) =================
#define MPU_LSB_PER_G         16384.0
#define SHOCK_DELTA_THRESHOLD 1.8    // g change = hard impact
#define TOUCH_DELTA_THRESHOLD 0.75f  // g change = box touched / bumped
#define FREE_FALL_THRESHOLD   0.45f
#define FALL_IMPACT_THRESHOLD 2.2f
#define FREE_FALL_MIN_MS      80
#define FREE_FALL_MAX_MS      700
#define MOTION_ALERT_COOLDOWN_MS 6000
#define ACCEL_SAMPLE_MS       50

// ================= REED SWITCH (your wiring) =================
// D4 = GPIO4, INPUT_PULLUP
// HIGH = BOX CLOSED (secure)  |  LOW = BOX OPENED (tamper)
#define REED_PIN           4
#define BUZZER             25
#define LED_GREEN          18
#define LED_RED            19
#define LOCK_RELAY         27
#define REED_DEBOUNCE_COUNT 5

// ================= OBJECTS =================
WiFiClient espClient;
PubSubClient mqtt(espClient);
TinyGPSPlus gps;
HardwareSerial GPSserial(2);
MPU6050 mpu;

// ================= STATE =================
bool tamperActive     = false;  // unauthorized open detected
bool shockActive      = false;
bool lockOpen         = false;  // authorized unlock from server
bool authorizedOpen   = false;  // temporary permission after dashboard Unlock
bool alarmActive      = false;
bool lastReedOpen     = false;
bool lastShock        = false;
bool lastTouch        = false;
bool motionPulseActive = false;

unsigned long lastGpsPublish    = 0;
unsigned long lastGpsSerialPrint = 0;
unsigned long lastStatusPublish = 0;
unsigned long lastShockAlert    = 0;
unsigned long lastMotionAlertMs = 0;
unsigned long unlockGrantedAt   = 0;

float baselineMagnitude = 1.0;
float filteredMagnitude = 1.0;
int   reedDebounceCounter = 0;
bool  reedStableOpen = false;
bool  inFreeFall = false;
unsigned long freeFallStartMs = 0;
unsigned long lastAccelSampleMs = 0;

// ================= FORWARD DECLARATIONS =================
void callback(char* topic, byte* payload, unsigned int length);
void reconnectMQTT();
void readGPS();
void printGpsToSerial();
void readSensors();
void publishGPS();
void publishTamper(bool active);
void publishMotion(float magnitude, bool isFall, bool isTouch);
void onMotionAlert(bool isFall, bool isTouch, float magnitude);
void publishStatus();
void handleCommand(const String& message);
void openBox();
void lockBox();
void denyAccess();
void onUnauthorizedOpen();
void onBoxClosed();
void triggerAlarm(bool on);
void updateLockLEDs();
bool isBoxPhysicallyOpen();
bool isAuthorizedToOpen();
void expireUnlockIfNeeded();
void calibrateMPU();
bool readReedDebounced();
String extractJsonBool(const String& json, const String& key);
String extractJsonString(const String& json, const String& key);
float extractJsonFloat(const String& json, const String& key);

// ================= SETUP =================
void setup() {
  Serial.begin(115200);

  pinMode(REED_PIN, INPUT_PULLUP);  // D4: HIGH=closed, LOW=open
  pinMode(BUZZER, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(LOCK_RELAY, OUTPUT);

  digitalWrite(BUZZER, LOW);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, LOW);
  digitalWrite(LOCK_RELAY, LOW);

  Wire.begin(21, 22);
  mpu.initialize();
  calibrateMPU();

  GPSserial.begin(9600, SERIAL_8N1, 16, 17);

  Serial.println("Connecting WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected: " + WiFi.localIP().toString());

  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(callback);
  mqtt.setBufferSize(512);

  reconnectMQTT();
  publishStatus();

  // Initialize reed switch state (read several times)
  for (int i = 0; i < REED_DEBOUNCE_COUNT + 2; i++) {
    readReedDebounced();
    delay(50);
  }
  Serial.print("Startup reed GPIO4 raw=");
  Serial.print(digitalRead(REED_PIN));
  Serial.println(reedStableOpen ? " → BOX OPENED (tamper)" : " → BOX CLOSED (secure)");
}

// ================= LOOP =================
void loop() {
  if (!mqtt.connected()) {
    reconnectMQTT();
  }
  mqtt.loop();

  readGPS();
  readSensors();
  expireUnlockIfNeeded();

  unsigned long now = millis();

  if (now - lastGpsPublish >= GPS_PUBLISH_MS) {
    publishGPS();
    lastGpsPublish = now;
  }

  if (now - lastGpsSerialPrint >= GPS_SERIAL_PRINT_MS) {
    printGpsToSerial();
    lastGpsSerialPrint = now;
  }

  if (now - lastStatusPublish >= STATUS_PUBLISH_MS) {
    publishStatus();
    lastStatusPublish = now;
  }

  // Tamper buzzer: reed open without authorization ONLY (never blocks motion alerts)
  if (reedStableOpen && !isAuthorizedToOpen()) {
    tamperActive = true;
    if (!motionPulseActive) triggerAlarm(true);
  } else if (!tamperActive && !motionPulseActive) {
    triggerAlarm(false);
    updateLockLEDs();
  }

  delay(100);
}

void calibrateMPU() {
  if (!mpu.testConnection()) {
    Serial.println("WARNING: MPU6050 not found — check I2C wiring (SDA=21, SCL=22)");
  } else {
    Serial.println("MPU6050 connected OK");
  }

  mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_2);  // ±2g for best sensitivity

  long axSum = 0, aySum = 0, azSum = 0;
  int16_t ax, ay, az;

  Serial.println("Calibrating MPU6050 (keep box still)...");
  for (int i = 0; i < 80; i++) {
    mpu.getAcceleration(&ax, &ay, &az);
    axSum += ax;
    aySum += ay;
    azSum += az;
    delay(25);
  }

  float axG = (axSum / 80.0) / MPU_LSB_PER_G;
  float ayG = (aySum / 80.0) / MPU_LSB_PER_G;
  float azG = (azSum / 80.0) / MPU_LSB_PER_G;
  baselineMagnitude = sqrt(axG * axG + ayG * ayG + azG * azG);
  filteredMagnitude = baselineMagnitude;
  Serial.print("Baseline g-force: ");
  Serial.print(baselineMagnitude, 3);
  Serial.println(" g (expect ~1.0g at rest)");
}

float readAccelMagnitudeG() {
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);

  float axG = ax / MPU_LSB_PER_G;
  float ayG = ay / MPU_LSB_PER_G;
  float azG = az / MPU_LSB_PER_G;
  return sqrt(axG * axG + ayG * ayG + azG * azG);
}

bool readReedDebounced() {
  // Your wiring: HIGH = closed, LOW = opened
  bool reading = (digitalRead(REED_PIN) == LOW);

  if (reading == reedStableOpen) {
    reedDebounceCounter = 0;
  } else {
    reedDebounceCounter++;
    if (reedDebounceCounter >= REED_DEBOUNCE_COUNT) {
      reedStableOpen = reading;
      reedDebounceCounter = 0;
      Serial.println(reedStableOpen
        ? "BOX OPENED - TAMPER DETECTED!"
        : "BOX CLOSED (Secure)");
    }
  }
  return reedStableOpen;
}

// ================= ACCESS CONTROL =================
bool isBoxPhysicallyOpen() {
  return reedStableOpen;
}

bool isAuthorizedToOpen() {
  if (!authorizedOpen) return false;

  // Authorization expires after UNLOCK_WINDOW_MS
  if (millis() - unlockGrantedAt > UNLOCK_WINDOW_MS) {
    authorizedOpen = false;
    lockOpen = false;
    Serial.println("Unlock authorization EXPIRED");
    return false;
  }
  return true;
}

void expireUnlockIfNeeded() {
  // If unlock window passed and box still closed, revoke permission
  if (authorizedOpen && !isBoxPhysicallyOpen()) {
    if (millis() - unlockGrantedAt > UNLOCK_WINDOW_MS) {
      authorizedOpen = false;
      lockOpen = false;
      digitalWrite(LOCK_RELAY, LOW);
      updateLockLEDs();
      Serial.println("Unlock window expired — permission revoked");
    }
  }
}

// ================= GPS =================
void readGPS() {
  while (GPSserial.available()) {
    gps.encode(GPSserial.read());
  }
}

void printGpsToSerial() {
  Serial.println("========== GPS STATUS ==========");

  if (gps.satellites.isValid()) {
    Serial.print("Satellites: ");
    Serial.println(gps.satellites.value());
  } else {
    Serial.println("Satellites: waiting for fix...");
  }

  if (gps.location.isValid()) {
    Serial.print("Latitude : ");
    Serial.println(gps.location.lat(), 6);
    Serial.print("Longitude: ");
    Serial.println(gps.location.lng(), 6);
  } else {
    Serial.println("Latitude : ---");
    Serial.println("Longitude: ---");
  }

  if (gps.speed.isValid()) {
    Serial.print("Speed    : ");
    Serial.print(gps.speed.kmph(), 2);
    Serial.println(" km/h");
  } else {
    Serial.println("Speed    : --- km/h");
  }

  if (gps.date.isValid() && gps.time.isValid()) {
    char timeBuf[32];
    snprintf(timeBuf, sizeof(timeBuf), "%04d-%02d-%02d %02d:%02d:%02d UTC",
      gps.date.year(), gps.date.month(), gps.date.day(),
      gps.time.hour(), gps.time.minute(), gps.time.second());
    Serial.print("Time     : ");
    Serial.println(timeBuf);
  } else {
    Serial.println("Time     : ---");
  }

  Serial.print("Reed     : ");
  Serial.println(reedStableOpen ? "BOX OPENED (tamper)" : "BOX CLOSED (secure)");
  Serial.print("Accel    : ");
  Serial.print(filteredMagnitude, 3);
  Serial.println(" g");
  Serial.print("Authorized: ");
  Serial.println(isAuthorizedToOpen() ? "YES (unlock window)" : "NO");
  Serial.print("Alarm    : ");
  Serial.println((tamperActive || alarmActive) ? "ON" : "OFF");
  Serial.println("================================");
}

void publishGPS() {
  if (!gps.location.isValid()) return;

  String payload = "{";
  payload += "\"latitude\":" + String(gps.location.lat(), 6) + ",";
  payload += "\"longitude\":" + String(gps.location.lng(), 6);
  if (gps.speed.isValid()) {
    payload += ",\"speed\":" + String(gps.speed.kmph(), 2);
  }
  if (gps.satellites.isValid()) {
    payload += ",\"satellites\":" + String(gps.satellites.value());
  }
  payload += "}";

  mqtt.publish(TOPIC_GPS.c_str(), payload.c_str());
  Serial.println("GPS -> " + payload);
}

// ================= SENSORS =================
void readSensors() {
  readReedDebounced();

  unsigned long now = millis();
  float magnitude = readAccelMagnitudeG();

  filteredMagnitude = (filteredMagnitude * 0.7f) + (magnitude * 0.3f);

  if (!tamperActive && !motionPulseActive
      && (now - lastAccelSampleMs >= ACCEL_SAMPLE_MS)) {
    baselineMagnitude = (baselineMagnitude * 0.98f) + (filteredMagnitude * 0.02f);
    lastAccelSampleMs = now;
  }

  float delta = abs(filteredMagnitude - baselineMagnitude);

  // --- Motion detection: ALWAYS ON (authorized open does NOT disable this) ---
  bool touchHit = (delta >= TOUCH_DELTA_THRESHOLD && delta < SHOCK_DELTA_THRESHOLD);
  bool shockHit = (delta >= SHOCK_DELTA_THRESHOLD);
  bool fallHit = false;

  if (filteredMagnitude < FREE_FALL_THRESHOLD) {
    if (!inFreeFall) {
      inFreeFall = true;
      freeFallStartMs = now;
      Serial.println("Free-fall phase detected...");
    }
  } else if (inFreeFall) {
    unsigned long fallDuration = now - freeFallStartMs;
    if (fallDuration >= FREE_FALL_MIN_MS
        && fallDuration <= FREE_FALL_MAX_MS
        && filteredMagnitude >= FALL_IMPACT_THRESHOLD) {
      fallHit = true;
      Serial.print("BOX FALL! duration=");
      Serial.print(fallDuration);
      Serial.print("ms impact=");
      Serial.println(filteredMagnitude, 2);
    }
    inFreeFall = false;
  }

  bool motionTriggered = false;
  bool reportFall = false;
  bool reportTouch = false;
  float reportMag = delta;

  if (fallHit) {
    motionTriggered = true;
    reportFall = true;
    reportMag = filteredMagnitude;
  } else if (shockHit && !lastShock) {
    motionTriggered = true;
    reportMag = delta;
  } else if (touchHit && !lastTouch) {
    motionTriggered = true;
    reportTouch = true;
    reportMag = delta;
  }

  if (motionTriggered && (now - lastMotionAlertMs >= MOTION_ALERT_COOLDOWN_MS)) {
    onMotionAlert(reportFall, reportTouch, reportMag);
    lastMotionAlertMs = now;
  }

  lastShock = shockHit || fallHit;
  lastTouch = touchHit;

  // --- Reed switch: tamper only — authorized user opening box = NO alarm ---
  bool reedOpen = reedStableOpen;

  if (reedOpen && !isAuthorizedToOpen()) {
    if (!tamperActive) {
      onUnauthorizedOpen();
    }
    tamperActive = true;
    if (!motionPulseActive) triggerAlarm(true);
  } else if (reedOpen && isAuthorizedToOpen()) {
    tamperActive = false;
    lockOpen = true;
    digitalWrite(LED_GREEN, HIGH);
    if (!motionPulseActive) {
      digitalWrite(BUZZER, LOW);
      digitalWrite(LED_RED, LOW);
    }
  } else if (!reedOpen) {
    if (lastReedOpen) {
      onBoxClosed();
    }
    tamperActive = false;
    if (!motionPulseActive) {
      triggerAlarm(false);
      updateLockLEDs();
    }
  }

  lastReedOpen = reedOpen;
}

void onMotionAlert(bool isFall, bool isTouch, float magnitude) {
  // Motion alerts fire even when box is assigned + authorized to open
  motionPulseActive = true;
  shockActive = true;
  publishMotion(magnitude, isFall, isTouch);
  publishStatus();

  triggerAlarm(true);
  if (isFall) {
    Serial.println("!!! FALL ALERT (authorized or not) !!!");
  } else if (isTouch) {
    Serial.println("!!! TOUCH/BUMP ALERT (authorized or not) !!! delta=" + String(magnitude, 2) + "g");
  } else {
    Serial.println("!!! SHOCK ALERT (authorized or not) !!! delta=" + String(magnitude, 2) + "g");
  }

  delay(500);
  motionPulseActive = false;
  shockActive = false;

  if (!tamperActive) {
    triggerAlarm(false);
    updateLockLEDs();
  }
  publishStatus();
}

void onUnauthorizedOpen() {
  publishTamper(true);
  publishStatus();
  triggerAlarm(true);
  digitalWrite(LOCK_RELAY, LOW);
  lockOpen = false;
  authorizedOpen = false;
  unlockGrantedAt = 0;
  Serial.println("!!! REED OPEN without permission — ALARM ON !!!");
}

void onBoxClosed() {
  publishTamper(false);
  authorizedOpen = false;
  lockOpen = false;
  unlockGrantedAt = 0;
  digitalWrite(LOCK_RELAY, LOW);
  if (!motionPulseActive) {
    triggerAlarm(false);
    updateLockLEDs();
  }
  publishStatus();
  Serial.println("Box closed — locked, alarm off");
}

void publishTamper(bool active) {
  String payload = "{\"tampered\":";
  payload += active ? "true" : "false";
  payload += "}";
  mqtt.publish(TOPIC_TAMPER.c_str(), payload.c_str());
}

void publishMotion(float magnitude, bool isFall, bool isTouch) {
  String payload = "{";
  payload += "\"shock\":true,";
  payload += "\"fall\":" + String(isFall ? "true" : "false") + ",";
  payload += "\"touch\":" + String(isTouch ? "true" : "false") + ",";
  payload += "\"magnitude\":" + String(magnitude, 2);
  payload += "}";
  mqtt.publish(TOPIC_SHOCK.c_str(), payload.c_str());
  Serial.println("Motion MQTT -> " + payload);
}

void publishStatus() {
  String payload = "{";
  payload += "\"lock_status\":\"" + String(lockOpen ? "unlocked" : "locked") + "\",";
  payload += "\"buzzer\":" + String(alarmActive ? "true" : "false") + ",";
  payload += "\"led\":" + String(alarmActive ? "true" : "false") + ",";
  payload += "\"tamper\":" + String(tamperActive ? "true" : "false") + ",";
  payload += "\"shock\":" + String(shockActive ? "true" : "false");
  payload += "}";
  mqtt.publish(TOPIC_STATUS.c_str(), payload.c_str());
}

// ================= MQTT COMMAND CALLBACK =================
void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.println("CMD [" + String(topic) + "]: " + message);

  if (String(topic) == TOPIC_COMMAND) {
    handleCommand(message);
  }
}

void handleCommand(const String& message) {
  String command = extractJsonString(message, "command");

  if (command == "unlock") {
    // Only valid if server verified user has can_control permission
    bool serverAuthorized = extractJsonBool(message, "authorized") != "false";
    if (serverAuthorized) {
      openBox();
    } else {
      denyAccess();
    }
    publishStatus();
    return;
  }

  if (command == "lock") {
    lockBox();
    publishStatus();
    return;
  }

  if (command == "alarm") {
    String reason = extractJsonString(message, "reason");
    bool active = extractJsonBool(message, "active") == "true";

    if (reason == "unauthorized") {
      denyAccess();
      return;
    }

    if (active) {
      triggerAlarm(true);
    } else {
      // Only silence if box is closed OR user was authorized
      if (!isBoxPhysicallyOpen() || isAuthorizedToOpen()) {
        tamperActive = false;
        triggerAlarm(false);
        updateLockLEDs();
      } else {
        // Box still open without auth — keep alarm ON
        tamperActive = true;
        triggerAlarm(true);
        Serial.println("Cannot silence — unauthorized open active");
      }
    }
    publishStatus();
    return;
  }
}

// ================= BOX CONTROL =================
void openBox() {
  lockOpen = true;
  authorizedOpen = true;
  unlockGrantedAt = millis();  // start 60s unlock window
  alarmActive = false;
  tamperActive = false;
  digitalWrite(LOCK_RELAY, HIGH);
  digitalWrite(BUZZER, LOW);
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_RED, LOW);
  Serial.println("AUTHORIZED unlock — 60s window to open (no alarm)");
}

void lockBox() {
  lockOpen = false;
  authorizedOpen = false;
  unlockGrantedAt = 0;
  digitalWrite(LOCK_RELAY, LOW);
  if (!tamperActive && !shockActive) {
    triggerAlarm(false);
    updateLockLEDs();
  }
  Serial.println("Box LOCKED");
}

void denyAccess() {
  lockOpen = false;
  authorizedOpen = false;
  unlockGrantedAt = 0;
  tamperActive = true;
  digitalWrite(LOCK_RELAY, LOW);
  digitalWrite(LED_GREEN, LOW);

  // Sustained buzzer for unauthorized access attempt
  triggerAlarm(true);
  publishTamper(true);

  Serial.println("Access DENIED — buzzer ON");
  publishStatus();
}

void triggerAlarm(bool on) {
  alarmActive = on;
  if (on) {
    digitalWrite(BUZZER, HIGH);
    digitalWrite(LED_RED, HIGH);
    digitalWrite(LED_GREEN, LOW);
  } else {
    digitalWrite(BUZZER, LOW);
    digitalWrite(LED_RED, LOW);
  }
}

void updateLockLEDs() {
  digitalWrite(BUZZER, (tamperActive || shockActive || alarmActive) ? HIGH : LOW);
  if (tamperActive || shockActive || alarmActive) {
    digitalWrite(LED_RED, HIGH);
    digitalWrite(LED_GREEN, LOW);
    return;
  }
  if (lockOpen || authorizedOpen) {
    digitalWrite(LED_GREEN, HIGH);
    digitalWrite(LED_RED, LOW);
  } else {
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_RED, LOW);
  }
}

// ================= MQTT CONNECT =================
void reconnectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("MQTT connecting...");
    String clientId = "ESP32_" + String(DEVICE_ID);

    if (mqtt.connect(clientId.c_str())) {
      Serial.println(" connected");
      mqtt.subscribe(TOPIC_COMMAND.c_str());
      Serial.println("Subscribed: " + TOPIC_COMMAND);
      publishStatus();
    } else {
      Serial.print(" failed (rc=");
      Serial.print(mqtt.state());
      Serial.println(") retry in 2s");
      delay(2000);
    }
  }
}

// ================= SIMPLE JSON HELPERS =================
String extractJsonString(const String& json, const String& key) {
  String search = "\"" + key + "\":\"";
  int start = json.indexOf(search);
  if (start < 0) return "";
  start += search.length();
  int end = json.indexOf("\"", start);
  if (end < 0) return "";
  return json.substring(start, end);
}

String extractJsonBool(const String& json, const String& key) {
  String search = "\"" + key + "\":";
  int start = json.indexOf(search);
  if (start < 0) return "";
  start += search.length();
  if (json.substring(start, start + 4) == "true") return "true";
  if (json.substring(start, start + 5) == "false") return "false";
  return "";
}

float extractJsonFloat(const String& json, const String& key) {
  String search = "\"" + key + "\":";
  int start = json.indexOf(search);
  if (start < 0) return 0;
  start += search.length();
  int end = json.indexOf(",", start);
  if (end < 0) end = json.indexOf("}", start);
  return json.substring(start, end).toFloat();
}



