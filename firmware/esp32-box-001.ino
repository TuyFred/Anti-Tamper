#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <MPU6050.h>
#include <TinyGPS++.h>
#include <math.h>

// ================= DEVICE =================
#define DEVICE_ID "BOX-001"

// ================= WIFI / MQTT (edit for your network) =================
const char* WIFI_SSID     = "net";
const char* WIFI_PASSWORD = "1234567890";
const char* MQTT_SERVER   = "test.mosquitto.org";
const int   MQTT_PORT     = 1883;

String TOPIC_GPS     = "box/" DEVICE_ID "/gps";
String TOPIC_TAMPER  = "box/" DEVICE_ID "/tamper";
String TOPIC_SHOCK   = "box/" DEVICE_ID "/shock";
String TOPIC_STATUS  = "box/" DEVICE_ID "/status";
String TOPIC_COMMAND = "box/" DEVICE_ID "/command";

// ================= HARDWARE PINS (your wiring) =================
const int IR_SENSOR_PIN      = 4;   // LOW = CLOSED, HIGH = OPENED
const int RELAY_LOCK_PIN     = 26;  // Relay lock control
const int BUTTON_PIN         = 27;  // Physical unlock button
const int LED_INDICATOR_PIN  = 23;  // Green — box open / authorized
const int BUZZER_PIN         = 25;
const int RED_LED_PIN        = 19;  // RED = WiFi connected (solid when linked)
const int WIFI_LED_PIN       = 18;  // Cloud LED — MQTT connected

const int GPS_RX_PIN = 16;
const int GPS_TX_PIN = 17;

// ================= TIMING =================
const unsigned long GPS_PUBLISH_MS       = 3000;
const unsigned long GPS_SERIAL_PRINT_MS  = 2000;
const unsigned long STATUS_PUBLISH_MS    = 10000;
const unsigned long UNLOCK_WINDOW_MS     = 60000;
const unsigned long RELAY_OPEN_MS        = 5000;   // Relay stays open after button press
const unsigned long CMD_TIMEOUT_MS       = 10000;  // Local 'o' prime timeout
const unsigned long ACCEL_SAMPLE_MS      = 40;
const unsigned long MOTION_COOLDOWN_MS   = 8000;

// ================= MPU6050 — standard g-based detection (±2g) =================
#define MPU_LSB_PER_G 16384.0f

// Require STRONGER movement before buzzer (less false alarms from light bumps)
const float TOUCH_DELTA_THRESHOLD  = 1.35f;  // light bump — MQTT only, no buzzer
const float SHOCK_DELTA_THRESHOLD  = 2.6f;   // hard hit — buzzer + alert
const float FREE_FALL_THRESHOLD    = 0.42f;
const float FALL_IMPACT_THRESHOLD  = 2.4f;
const unsigned long FREE_FALL_MIN_MS = 80;
const unsigned long FREE_FALL_MAX_MS = 700;

// Must see motion this many samples in a row before triggering (debounce)
const int MOTION_CONFIRM_SAMPLES = 5;

const int REED_DEBOUNCE_COUNT = 5;

// ================= OBJECTS =================
WiFiClient espClient;
PubSubClient mqtt(espClient);
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
MPU6050 mpu;

// ================= STATE =================
bool tamperActive      = false;
bool shockActive       = false;
bool lockOpen          = false;
bool authorizedOpen    = false;
bool alarmActive       = false;
bool relayPhysicallyOpen = false;
bool lastReedOpen      = false;
bool inFreeFall        = false;
bool motionPulseActive = false;
bool localPrimed       = false;  // Serial 'o' received — button window

unsigned long lastGpsPublish      = 0;
unsigned long lastGpsSerialPrint  = 0;
unsigned long lastStatusPublish   = 0;
unsigned long lastMotionAlertMs   = 0;
unsigned long unlockGrantedAt     = 0;
unsigned long relayOpenStartedAt  = 0;
unsigned long localPrimedAt       = 0;
unsigned long freeFallStartMs     = 0;
unsigned long lastAccelSampleMs   = 0;
unsigned long wifiLedBlinkMs      = 0;
bool wifiLedState                 = false;

float baselineMagnitude = 1.0f;
float filteredMagnitude = 1.0f;
int   reedDebounceCounter = 0;
bool  reedStableOpen = false;
int   motionConfirmCounter = 0;
float pendingMotionDelta = 0;
bool  pendingMotionIsTouch = false;
bool  pendingMotionIsShock = false;
bool  pendingMotionIsFall = false;

// ================= FORWARD DECL =================
void callback(char* topic, byte* payload, unsigned int length);
void reconnectMQTT();
void readGPS();
void printGpsToSerial();
void readSensors();
void handleLocalButton();
void handleSerialPrime();
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
void updateStatusLEDs();
void updateNetworkLEDs();
bool isBoxPhysicallyOpen();
bool isAuthorizedToOpen();
void expireUnlockIfNeeded();
void calibrateMPU();
bool readIrDebounced();
float readAccelMagnitudeG();
String extractJsonBool(const String& json, const String& key);
String extractJsonString(const String& json, const String& key);

// ================= SETUP =================
void setup() {
  Serial.begin(115200);

  pinMode(IR_SENSOR_PIN, INPUT_PULLUP);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(RELAY_LOCK_PIN, OUTPUT);
  pinMode(LED_INDICATOR_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(WIFI_LED_PIN, OUTPUT);

  digitalWrite(RELAY_LOCK_PIN, LOW);
  digitalWrite(LED_INDICATOR_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);
  digitalWrite(WIFI_LED_PIN, LOW);

  Wire.begin(21, 22);
  mpu.initialize();
  calibrateMPU();

  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  Serial.println("[BOOT] Smart Box firmware — Rwanda delivery platform");
  Serial.println("[PIN] IR=4 LOW=closed | Relay=26 | Button=27 | Open LED=23");
  Serial.println("[PIN] RED=19 WiFi | WIFI_LED=18 MQTT | Buzzer=25");

  Serial.print("[WIFI] Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 30000) {
    updateNetworkLEDs();
    delay(250);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WIFI] Connected — IP ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("[WIFI] Failed — will retry in loop");
  }
  updateNetworkLEDs();

  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(callback);
  mqtt.setBufferSize(512);
  reconnectMQTT();
  updateNetworkLEDs();
  publishStatus();

  for (int i = 0; i < REED_DEBOUNCE_COUNT + 2; i++) {
    readIrDebounced();
    delay(40);
  }
  Serial.println(reedStableOpen
    ? "[SENSOR] Startup: box OPENED"
    : "[SENSOR] Startup: box CLOSED (secure)");
  Serial.println("[HELP] Serial 'o' primes local button unlock (10s window)");
}

// ================= LOOP =================
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
  }
  updateNetworkLEDs();

  if (!mqtt.connected()) {
    reconnectMQTT();
  }
  mqtt.loop();
  updateNetworkLEDs();

  readGPS();
  handleSerialPrime();
  handleLocalButton();
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

  // Tamper buzzer — unauthorized open only
  if (reedStableOpen && !isAuthorizedToOpen() && !relayPhysicallyOpen) {
    tamperActive = true;
    if (!motionPulseActive) triggerAlarm(true);
  } else if (!tamperActive && !motionPulseActive) {
    triggerAlarm(false);
    updateStatusLEDs();
  }

  delay(20);
}

// ================= NETWORK LEDs =================
// RED (19): solid ON when WiFi connected | slow blink while connecting
// WIFI_LED (18): solid ON when MQTT connected | off if WiFi only
void updateNetworkLEDs() {
  bool wifiOk = (WiFi.status() == WL_CONNECTED);
  bool mqttOk = mqtt.connected();

  if (alarmActive || tamperActive || motionPulseActive) {
    // During alarm, red flashes — WiFi status shown on WIFI_LED instead
    if (wifiOk) {
      digitalWrite(WIFI_LED_PIN, mqttOk ? HIGH : LOW);
    }
    return;
  }

  if (wifiOk) {
    digitalWrite(RED_LED_PIN, HIGH);  // RED = WiFi connected
  } else {
    unsigned long now = millis();
    if (now - wifiLedBlinkMs >= 400) {
      wifiLedBlinkMs = now;
      wifiLedState = !wifiLedState;
    }
    digitalWrite(RED_LED_PIN, wifiLedState ? HIGH : LOW);
  }

  digitalWrite(WIFI_LED_PIN, mqttOk ? HIGH : LOW);
}

// ================= MPU6050 CALIBRATION =================
void calibrateMPU() {
  if (!mpu.testConnection()) {
    Serial.println("[WARN] MPU6050 not found — check SDA=21 SCL=22");
    return;
  }
  Serial.println("[MPU] MPU6050 OK — calibrating (keep box still 2s)...");
  mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_2);

  long axSum = 0, aySum = 0, azSum = 0;
  int16_t ax, ay, az;
  const int samples = 80;

  for (int i = 0; i < samples; i++) {
    mpu.getAcceleration(&ax, &ay, &az);
    axSum += ax;
    aySum += ay;
    azSum += az;
    delay(25);
  }

  float axG = (axSum / (float)samples) / MPU_LSB_PER_G;
  float ayG = (aySum / (float)samples) / MPU_LSB_PER_G;
  float azG = (azSum / (float)samples) / MPU_LSB_PER_G;
  baselineMagnitude = sqrtf(axG * axG + ayG * ayG + azG * azG);
  filteredMagnitude = baselineMagnitude;

  Serial.print("[MPU] Baseline ");
  Serial.print(baselineMagnitude, 3);
  Serial.println(" g (expect ~1.0g at rest)");
  Serial.print("[MPU] Touch alert >= ");
  Serial.print(TOUCH_DELTA_THRESHOLD, 2);
  Serial.print(" g | Buzzer shock >= ");
  Serial.print(SHOCK_DELTA_THRESHOLD, 2);
  Serial.println(" g");
}

float readAccelMagnitudeG() {
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);
  float axG = ax / MPU_LSB_PER_G;
  float ayG = ay / MPU_LSB_PER_G;
  float azG = az / MPU_LSB_PER_G;
  return sqrtf(axG * axG + ayG * ayG + azG * azG);
}

// ================= IR SENSOR (debounced) =================
bool readIrDebounced() {
  bool reading = (digitalRead(IR_SENSOR_PIN) == HIGH);  // HIGH = OPENED

  if (reading == reedStableOpen) {
    reedDebounceCounter = 0;
  } else {
    reedDebounceCounter++;
    if (reedDebounceCounter >= REED_DEBOUNCE_COUNT) {
      reedStableOpen = reading;
      reedDebounceCounter = 0;
      if (reedStableOpen) {
        Serial.println(isAuthorizedToOpen() || relayPhysicallyOpen
          ? "[SENSOR] Box OPENED (authorized)"
          : "[ALERT] Box OPENED — UNAUTHORIZED!");
      } else {
        Serial.println("[SENSOR] Box CLOSED");
      }
    }
  }
  return reedStableOpen;
}

// ================= LOCAL SERIAL PRIME ('o') =================
void handleSerialPrime() {
  if (!Serial.available()) return;
  char c = Serial.read();
  if (c != 'o' && c != 'O') return;

  if (localPrimed || relayPhysicallyOpen) {
    Serial.println("[WARN] Already primed or relay open");
    return;
  }
  localPrimed = true;
  localPrimedAt = millis();
  Serial.println("[CMD] Primed — press button within 10s to open relay 5s");
}

// ================= LOCAL BUTTON (after MQTT unlock OR serial 'o') =================
void handleLocalButton() {
  unsigned long now = millis();

  if (localPrimed && now - localPrimedAt >= CMD_TIMEOUT_MS) {
    localPrimed = false;
    Serial.println("[TIMEOUT] Local prime expired");
  }

  if (relayPhysicallyOpen) {
    if (now - relayOpenStartedAt >= RELAY_OPEN_MS) {
      relayPhysicallyOpen = false;
      digitalWrite(RELAY_LOCK_PIN, LOW);
      digitalWrite(LED_INDICATOR_PIN, LOW);
      Serial.println("[LOCK] Relay closed after 5s");
      updateStatusLEDs();
    }
    return;
  }

  if (digitalRead(BUTTON_PIN) != LOW) return;  // active LOW

  bool allowed = isAuthorizedToOpen() || localPrimed;
  if (!allowed) {
    Serial.println("[DENY] Button pressed without authorization");
    denyAccess();
    delay(300);  // simple debounce
    return;
  }

  relayPhysicallyOpen = true;
  relayOpenStartedAt = now;
  localPrimed = false;
  lockOpen = true;
  digitalWrite(RELAY_LOCK_PIN, HIGH);
  digitalWrite(LED_INDICATOR_PIN, HIGH);
  Serial.println("[ACCESS] Button — relay OPEN for 5 seconds");
  updateStatusLEDs();
  publishStatus();
  delay(300);
}

// ================= MOTION / SHOCK (standard + strict buzzer) =================
void readSensors() {
  readIrDebounced();

  unsigned long now = millis();
  if (now - lastAccelSampleMs < ACCEL_SAMPLE_MS) return;
  lastAccelSampleMs = now;

  float magnitude = readAccelMagnitudeG();
  filteredMagnitude = filteredMagnitude * 0.72f + magnitude * 0.28f;

  if (!tamperActive && !motionPulseActive && !relayPhysicallyOpen) {
    baselineMagnitude = baselineMagnitude * 0.985f + filteredMagnitude * 0.015f;
  }

  float delta = fabsf(filteredMagnitude - baselineMagnitude);

  bool touchHit  = (delta >= TOUCH_DELTA_THRESHOLD && delta < SHOCK_DELTA_THRESHOLD);
  bool shockHit  = (delta >= SHOCK_DELTA_THRESHOLD);
  bool fallHit   = false;

  if (filteredMagnitude < FREE_FALL_THRESHOLD) {
    if (!inFreeFall) {
      inFreeFall = true;
      freeFallStartMs = now;
    }
  } else if (inFreeFall) {
    unsigned long dur = now - freeFallStartMs;
    if (dur >= FREE_FALL_MIN_MS && dur <= FREE_FALL_MAX_MS
        && filteredMagnitude >= FALL_IMPACT_THRESHOLD) {
      fallHit = true;
      Serial.print("[TAMPER] Fall detected impact=");
      Serial.println(filteredMagnitude, 2);
    }
    inFreeFall = false;
  }

  bool instantHit = fallHit || shockHit || touchHit;

  if (instantHit) {
    motionConfirmCounter++;
    if (fallHit) {
      pendingMotionIsFall = true;
      pendingMotionDelta = filteredMagnitude;
    } else if (shockHit) {
      pendingMotionIsShock = true;
      pendingMotionDelta = delta;
    } else if (touchHit) {
      pendingMotionIsTouch = true;
      pendingMotionDelta = delta;
    }
  } else {
    motionConfirmCounter = 0;
    pendingMotionIsFall = pendingMotionIsShock = pendingMotionIsTouch = false;
  }

  if (motionConfirmCounter >= MOTION_CONFIRM_SAMPLES
      && (now - lastMotionAlertMs >= MOTION_COOLDOWN_MS)) {

    bool isFall = pendingMotionIsFall;
    bool isTouch = pendingMotionIsTouch && !pendingMotionIsShock && !isFall;
    float reportMag = pendingMotionDelta;

    // Buzzer ONLY on hard shock or fall — not light touch
    if (isFall || pendingMotionIsShock) {
      onMotionAlert(isFall, false, reportMag);
    } else if (isTouch) {
      Serial.print("[MOTION] Light bump (no buzzer) delta=");
      Serial.println(reportMag, 2);
      publishMotion(reportMag, false, true);
    }

    motionConfirmCounter = 0;
    pendingMotionIsFall = pendingMotionIsShock = pendingMotionIsTouch = false;
    lastMotionAlertMs = now;
  }

  // IR tamper
  bool boxOpen = reedStableOpen;

  if (boxOpen && !isAuthorizedToOpen() && !relayPhysicallyOpen) {
    if (!tamperActive) onUnauthorizedOpen();
    tamperActive = true;
  } else if (boxOpen && (isAuthorizedToOpen() || relayPhysicallyOpen)) {
    tamperActive = false;
    digitalWrite(LED_INDICATOR_PIN, HIGH);
    if (!motionPulseActive) {
      digitalWrite(BUZZER_PIN, LOW);
    }
  } else if (!boxOpen) {
    if (lastReedOpen) onBoxClosed();
    tamperActive = false;
    if (!motionPulseActive) {
      triggerAlarm(false);
      updateStatusLEDs();
    }
  }
  lastReedOpen = boxOpen;
}

void onMotionAlert(bool isFall, bool isTouch, float magnitude) {
  motionPulseActive = true;
  shockActive = true;
  publishMotion(magnitude, isFall, isTouch);
  publishStatus();
  triggerAlarm(true);

  if (isFall) Serial.println("[ALARM] FALL — buzzer ON");
  else Serial.print("[ALARM] SHOCK — buzzer ON delta=");
  Serial.println(magnitude, 2);

  delay(600);
  motionPulseActive = false;
  shockActive = false;

  if (!tamperActive) {
    triggerAlarm(false);
    updateStatusLEDs();
  }
  updateNetworkLEDs();
  publishStatus();
}

// ================= ACCESS =================
bool isBoxPhysicallyOpen() {
  return reedStableOpen;
}

bool isAuthorizedToOpen() {
  if (!authorizedOpen) return false;
  if (millis() - unlockGrantedAt > UNLOCK_WINDOW_MS) {
    authorizedOpen = false;
    lockOpen = false;
    Serial.println("[AUTH] Unlock window expired");
    return false;
  }
  return true;
}

void expireUnlockIfNeeded() {
  if (authorizedOpen && !isBoxPhysicallyOpen() && !relayPhysicallyOpen) {
    if (millis() - unlockGrantedAt > UNLOCK_WINDOW_MS) {
      authorizedOpen = false;
      lockOpen = false;
      digitalWrite(RELAY_LOCK_PIN, LOW);
      updateStatusLEDs();
    }
  }
}

// ================= GPS =================
void readGPS() {
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }
}

void printGpsToSerial() {
  Serial.println("========== GPS STATUS ==========");
  if (gps.satellites.isValid()) {
    Serial.print("Satellites: ");
    Serial.println(gps.satellites.value());
  } else {
    Serial.println("Satellites: searching...");
  }
  if (gps.location.isValid()) {
    Serial.print("Lat: ");
    Serial.print(gps.location.lat(), 6);
    Serial.print(" | Lon: ");
    Serial.println(gps.location.lng(), 6);
  } else {
    Serial.println("Fix: waiting (move antenna outdoors if needed)");
  }
  Serial.print("WiFi: ");
  Serial.println(WiFi.status() == WL_CONNECTED ? "connected" : "offline");
  Serial.print("MQTT: ");
  Serial.println(mqtt.connected() ? "connected" : "offline");
  Serial.print("Accel: ");
  Serial.print(filteredMagnitude, 3);
  Serial.println(" g");
  Serial.println("================================");
}

void publishGPS() {
  if (!gps.location.isValid()) return;
  String payload = "{";
  payload += "\"latitude\":" + String(gps.location.lat(), 6) + ",";
  payload += "\"longitude\":" + String(gps.location.lng(), 6);
  if (gps.satellites.isValid()) {
    payload += ",\"satellites\":" + String(gps.satellites.value());
  }
  payload += "}";
  mqtt.publish(TOPIC_GPS.c_str(), payload.c_str());
}

// ================= MQTT PUBLISH =================
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
}

void publishStatus() {
  String payload = "{";
  payload += "\"lock_status\":\"" + String(lockOpen || relayPhysicallyOpen ? "unlocked" : "locked") + "\",";
  payload += "\"buzzer\":" + String(alarmActive ? "true" : "false") + ",";
  payload += "\"led\":" + String(digitalRead(LED_INDICATOR_PIN) ? "true" : "false") + ",";
  payload += "\"tamper\":" + String(tamperActive ? "true" : "false") + ",";
  payload += "\"shock\":" + String(shockActive ? "true" : "false") + ",";
  payload += "\"wifi\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false");
  payload += "}";
  mqtt.publish(TOPIC_STATUS.c_str(), payload.c_str());
}

void onUnauthorizedOpen() {
  publishTamper(true);
  publishStatus();
  triggerAlarm(true);
  digitalWrite(RELAY_LOCK_PIN, LOW);
  relayPhysicallyOpen = false;
  lockOpen = false;
  authorizedOpen = false;
  Serial.println("[TAMPER] Unauthorized open — buzzer ON");
}

void onBoxClosed() {
  publishTamper(false);
  authorizedOpen = false;
  lockOpen = false;
  relayPhysicallyOpen = false;
  digitalWrite(RELAY_LOCK_PIN, LOW);
  digitalWrite(LED_INDICATOR_PIN, LOW);
  if (!motionPulseActive) {
    triggerAlarm(false);
    updateStatusLEDs();
  }
  publishStatus();
}

// ================= MQTT COMMAND =================
void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  Serial.println("CMD: " + message);
  if (String(topic) == TOPIC_COMMAND) handleCommand(message);
}

void handleCommand(const String& message) {
  String command = extractJsonString(message, "command");

  if (command == "unlock") {
    if (extractJsonBool(message, "authorized") != "false") {
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
    bool active = extractJsonBool(message, "active") == "true";
    if (active) triggerAlarm(true);
    else if (!isBoxPhysicallyOpen() || isAuthorizedToOpen()) {
      tamperActive = false;
      triggerAlarm(false);
      updateStatusLEDs();
    }
    publishStatus();
  }
}

void openBox() {
  authorizedOpen = true;
  unlockGrantedAt = millis();
  lockOpen = true;
  tamperActive = false;
  alarmActive = false;
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_INDICATOR_PIN, HIGH);
  Serial.println("[AUTH] Server unlock — press button within 60s (no alarm)");
  updateStatusLEDs();
  updateNetworkLEDs();
}

void lockBox() {
  lockOpen = false;
  authorizedOpen = false;
  relayPhysicallyOpen = false;
  unlockGrantedAt = 0;
  digitalWrite(RELAY_LOCK_PIN, LOW);
  digitalWrite(LED_INDICATOR_PIN, LOW);
  if (!tamperActive) {
    triggerAlarm(false);
    updateStatusLEDs();
  }
  Serial.println("[LOCK] Server lock command");
}

void denyAccess() {
  authorizedOpen = false;
  lockOpen = false;
  tamperActive = true;
  digitalWrite(RELAY_LOCK_PIN, LOW);
  triggerAlarm(true);
  publishTamper(true);
  Serial.println("[DENY] Unauthorized unlock attempt");
}

void triggerAlarm(bool on) {
  alarmActive = on;
  digitalWrite(BUZZER_PIN, on ? HIGH : LOW);
  if (on) {
    digitalWrite(LED_INDICATOR_PIN, LOW);
  }
  updateNetworkLEDs();
}

void updateStatusLEDs() {
  if (alarmActive || tamperActive) return;
  bool showOpen = lockOpen || relayPhysicallyOpen || isAuthorizedToOpen();
  digitalWrite(LED_INDICATOR_PIN, showOpen ? HIGH : LOW);
  digitalWrite(BUZZER_PIN, LOW);
}

void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;

  while (!mqtt.connected()) {
    Serial.print("[MQTT] Connecting...");
    String clientId = "ESP32_" + String(DEVICE_ID);
    if (mqtt.connect(clientId.c_str())) {
      Serial.println(" OK");
      mqtt.subscribe(TOPIC_COMMAND.c_str());
      publishStatus();
      updateNetworkLEDs();
    } else {
      Serial.print(" fail rc=");
      Serial.println(mqtt.state());
      delay(2000);
    }
  }
}

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
