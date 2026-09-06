#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <TinyGPS++.h>

// ================= DEVICE / CLOUD (must match dashboard devices.device_id) =================
#define DEVICE_ID "BOX-001"

// WiFi
const char* WIFI_SSID     = "net";
const char* WIFI_PASSWORD = "1234567890";

// MQTT — same broker as server MQTT_BROKER_URL (broker.emqx.io — test.mosquitto.org blocked on many networks)
const char* MQTT_SERVER = "broker.emqx.io";
const int   MQTT_PORT   = 1883;

String TOPIC_GPS     = String("box/") + DEVICE_ID + "/gps";
String TOPIC_TAMPER  = String("box/") + DEVICE_ID + "/tamper";
String TOPIC_SHOCK   = String("box/") + DEVICE_ID + "/shock";
String TOPIC_STATUS  = String("box/") + DEVICE_ID + "/status";
String TOPIC_COMMAND = String("box/") + DEVICE_ID + "/command";

// ================= HARDWARE PINS =================
const int IR_SENSOR_PIN = 4;       // LOW = CLOSED, HIGH = OPENED
const int RELAY_LOCK_PIN = 26;
const int BUTTON_PIN = 27;         // open when primed (serial 'o') OR lock when box is open
const int CLOSE_BUTTON_PIN = 32;   // optional second button — lock only when open (set -1 if unused)
// GPIO 18 = WiFi LED (blue, ON when connected — stays on even when box is locked)
// GPIO 19 + 23 = extra blue LEDs — join GPIO 18 so all 3 are ON when box is unlocked
const int WIFI_LED_PIN = 18;
const int OPEN_LED_PINS[] = { 19, 23 };
const int OPEN_LED_COUNT = 2;
const bool OPEN_LED_ACTIVE_LOW = false;
const int BUZZER_PIN = 25;

const int GPS_RX_PIN = 16;
const int GPS_TX_PIN = 17;  // ESP32 TX → GPS module RX
const int MPU_ADDR = 0x68;

// Many inexpensive relay boards are active-low (LOW = relay ON).
const bool RELAY_MODULE_ACTIVE_LOW = true;
// true  = relay ON opens the box (electric strike / mag lock) — most common
// false = relay ON locks the box (solenoid bolt) — set false if Unlock/Lock are backwards
// If dashboard Unlock leaves the box locked (or Lock opens it), flip this flag and reflash.
const bool RELAY_ENERGIZE_TO_UNLOCK = false;

// ================= TIMING =================
const unsigned long CMD_TIMEOUT_MS = 10000;
const unsigned long LOCK_OPEN_MS = 5000;
const unsigned long REMOTE_UNLOCK_MS = 60000; // dashboard unlock → button window
const unsigned long BLINK_INTERVAL = 250;
const unsigned long RAPID_BLINK = 100;
const unsigned long SHOCK_ALARM_MS = 15000;
const unsigned long SHOCK_COOLDOWN_MS = 20000;
const unsigned long MPU_SAMPLE_MS = 15;
const unsigned long GPS_PRINT_MS = 5000;
const unsigned long GPS_PUBLISH_MS = 3000;
const unsigned long GPS_BAUD_RETRY_MS = 20000;
const unsigned long STATUS_PUBLISH_MS = 5000;
const unsigned long WIFI_RETRY_MS = 10000;
const unsigned long MQTT_RETRY_MS = 3000;

// MPU6050 — real impact only (hand-waves / vibration stay below threshold)
const int32_t SHOCK_THRESHOLD = 8000;
const int32_t SHOCK_AXIS_MIN = 3500;        // at least 2 axes must spike for a hit
const int32_t SHOCK_DEBUG_THRESHOLD = 3000;
const uint8_t SHOCK_CONFIRM_READS = 5;
const unsigned long MPU_SETTLE_MS = 8000;   // ignore motion right after boot

enum SystemState {
  IDLE,
  COMMAND_VALID,
  LOCK_OPEN
};

SystemState currentState = IDLE;

unsigned long commandTimestamp = 0;
unsigned long lockOpenTimestamp = 0;
unsigned long blinkTimestamp = 0;
unsigned long redBlinkTimestamp = 0;
unsigned long shockTimestamp = 0;
unsigned long lastShockPublishMs = 0;
uint8_t shockConfirmCount = 0;
unsigned long lastMpuReadTimestamp = 0;
unsigned long lastGpsPrintTimestamp = 0;
unsigned long lastGpsPublishMs = 0;
unsigned long lastStatusPublishMs = 0;
unsigned long lastMqttRetryMs = 0;

int blinkCount = 0;
bool ledState = false;
bool blueBlinkState = false;
bool openLedsEnabled = false;       // true = all 3 blue LEDs on (box unlocked)
bool alarmLedsOverride = false;     // tamper/shock/dashboard alarm blinking LEDs
bool lastIrState = false;
bool shockAlarmActive = false;
bool remoteAlarmActive = false;
bool lastTamperPublished = false;
bool remoteUnlockWindow = false;
bool holdUnlocked = false;          // remote unlock stays open until button locks
unsigned long lastButtonMs = 0;
unsigned long lastCloseButtonMs = 0;
const unsigned long BUTTON_DEBOUNCE_MS = 400;

int16_t lastX = 0, lastY = 0, lastZ = 0;

uint32_t gpsBytesTotal = 0;
uint32_t gpsBytesWindow = 0;
unsigned long gpsWindowStartMs = 0;
unsigned long lastGpsByteMs = 0;
unsigned long lastGpsBaudTryMs = 0;
uint8_t gpsBaudIndex = 0;
bool gpsWiringWarned = false;
const uint32_t GPS_BAUD_RATES[] = {9600, 115200, 4800};

TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

void wifiTask(void* parameter);
void updateWifiLed();
void maintainMqtt();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void setLockRelay(bool unlocked);
void writeLedPin(int pin, bool on);
void writeThreeBlueLeds(bool on);
void applyOpenLeds();
void writeAllOpenLeds(bool on);
void setOpenLeds(bool on);
void setAlarmLedsSolid(bool on);
void blinkAlarmLeds();
void restoreOpenLedsAfterAlarm();
void publishGps();
void publishTamper(bool tampered);
void publishShock(int32_t magnitude, bool isTouch);
void publishShockClear();
void publishStatus();
void lockBoxPhysical(const char* reason);
void handleRemoteUnlock();
void handleRemoteLock();
void handleRemoteAlarm(bool active);
void readMPU(int16_t &ax, int16_t &ay, int16_t &az);
void initGpsSerial(uint32_t baud);
void tryNextGpsBaud();

void setup() {
  Serial.begin(115200);

  initGpsSerial(GPS_BAUD_RATES[0]);

  Wire.begin(21, 22);
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0);
  Wire.endTransmission(true);

  pinMode(IR_SENSOR_PIN, INPUT_PULLUP);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  if (CLOSE_BUTTON_PIN >= 0) {
    pinMode(CLOSE_BUTTON_PIN, INPUT_PULLUP);
  }
  pinMode(RELAY_LOCK_PIN, OUTPUT);
  pinMode(WIFI_LED_PIN, OUTPUT);
  for (int i = 0; i < OPEN_LED_COUNT; i++) {
    pinMode(OPEN_LED_PINS[i], OUTPUT);
  }
  pinMode(BUZZER_PIN, OUTPUT);

  setLockRelay(false);
  writeThreeBlueLeds(false);
  digitalWrite(BUZZER_PIN, LOW);

  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);
  mqtt.setKeepAlive(45);
  mqtt.setSocketTimeout(20);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);
  xTaskCreatePinnedToCore(wifiTask, "wifiTask", 4096, NULL, 1, NULL, 0);

  delay(100);
  readMPU(lastX, lastY, lastZ);
  lastIrState = (digitalRead(IR_SENSOR_PIN) == LOW);

  Serial.println("[BOOT] BOX-001 firmware 2026-03-26 — shock≥8000, 5 confirms, 2-axis");
  Serial.print("[WIFI] Connecting to ");
  Serial.println(WIFI_SSID);
  Serial.print("[MQTT] Broker ");
  Serial.println(MQTT_SERVER);
  Serial.println("[HELP] Serial 'o' primes GPIO27 open (10s). GPIO27 or GPIO32 locks when open.");
  Serial.println("[HELP] Dashboard token unlock stays open until button or Close on app.");
  Serial.println("[GPS] NEO-6M wiring: GPS TX→GPIO16, GPS RX→GPIO17, VCC 3.3V, GND common.");
  Serial.println("[GPS] First fix needs clear sky (outdoor). Cold start can take 2-15 min.");
}

void initGpsSerial(uint32_t baud) {
  gpsSerial.end();
  delay(50);
  gpsSerial.begin(baud, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  gpsBytesWindow = 0;
  gpsWindowStartMs = millis();
  Serial.print("[GPS] UART2 @ ");
  Serial.print(baud);
  Serial.println(" baud");
}

void tryNextGpsBaud() {
  gpsBaudIndex = (gpsBaudIndex + 1) % (sizeof(GPS_BAUD_RATES) / sizeof(GPS_BAUD_RATES[0]));
  initGpsSerial(GPS_BAUD_RATES[gpsBaudIndex]);
  lastGpsBaudTryMs = millis();
}

void loop() {
  updateWifiLed();
  maintainMqtt();

  handleSerialInput();
  handleSystemState();
  handleBlinking();
  checkShockSensor();
  monitorAndSecureBox();
  updateGpsData();

  unsigned long now = millis();
  if (mqtt.connected() && now - lastGpsPublishMs >= GPS_PUBLISH_MS) {
    publishGps();
    lastGpsPublishMs = now;
  }
  if (mqtt.connected() && now - lastStatusPublishMs >= STATUS_PUBLISH_MS) {
    publishStatus();
    lastStatusPublishMs = now;
  }
}

// ================= Background WiFi =================
void wifiTask(void* parameter) {
  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WIFI] Connecting...");
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      unsigned long start = millis();
      while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
        vTaskDelay(pdMS_TO_TICKS(200));
      }
      if (WiFi.status() == WL_CONNECTED) {
        Serial.print("[WIFI] Connected — IP ");
        Serial.println(WiFi.localIP());
      } else {
        Serial.println("[WIFI] Failed — retry in background");
        WiFi.disconnect(true);
      }
    }
    vTaskDelay(pdMS_TO_TICKS(WIFI_RETRY_MS));
  }
}

void writeLedPin(int pin, bool on) {
  const uint8_t level = OPEN_LED_ACTIVE_LOW ? (on ? LOW : HIGH) : (on ? HIGH : LOW);
  digitalWrite(pin, level);
}

void writeThreeBlueLeds(bool on) {
  writeLedPin(WIFI_LED_PIN, on);
  for (int i = 0; i < OPEN_LED_COUNT; i++) {
    writeLedPin(OPEN_LED_PINS[i], on);
  }
}

void applyOpenLeds() {
  if (openLedsEnabled) {
    writeThreeBlueLeds(true);
  } else {
    for (int i = 0; i < OPEN_LED_COUNT; i++) {
      writeLedPin(OPEN_LED_PINS[i], false);
    }
    writeLedPin(WIFI_LED_PIN, WiFi.status() == WL_CONNECTED);
  }
}

void updateWifiLed() {
  if (openLedsEnabled || alarmLedsOverride) return;
  writeLedPin(WIFI_LED_PIN, WiFi.status() == WL_CONNECTED);
}

void writeAllOpenLeds(bool on) {
  writeThreeBlueLeds(on);
}

void setOpenLeds(bool on) {
  openLedsEnabled = on;
  if (!alarmLedsOverride) {
    applyOpenLeds();
  }
}

void setAlarmLedsSolid(bool on) {
  alarmLedsOverride = on;
  writeThreeBlueLeds(on || openLedsEnabled);
  if (!on) {
    alarmLedsOverride = false;
    applyOpenLeds();
  }
}

void blinkAlarmLeds() {
  alarmLedsOverride = true;
  blueBlinkState = !blueBlinkState;
  writeAllOpenLeds(blueBlinkState);
}

void restoreOpenLedsAfterAlarm() {
  alarmLedsOverride = false;
  applyOpenLeds();
}

// ================= MQTT ↔ server ↔ dashboard =================
void maintainMqtt() {
  if (WiFi.status() != WL_CONNECTED) return;

  if (mqtt.connected()) {
    mqtt.loop();
    return;
  }

  unsigned long now = millis();
  if (now - lastMqttRetryMs < MQTT_RETRY_MS) return;
  lastMqttRetryMs = now;

  String clientId = String("ESP32_") + DEVICE_ID + "_" + String((uint32_t)esp_random(), HEX);
  Serial.print("[MQTT] Connecting to ");
  Serial.print(MQTT_SERVER);
  Serial.print(" as ");
  Serial.println(clientId);

  if (mqtt.connect(clientId.c_str())) {
    mqtt.subscribe(TOPIC_COMMAND.c_str());
    Serial.println("[MQTT] Connected — subscribed to command topic");
    publishStatus();
    publishGps();
    lastStatusPublishMs = now;
    lastGpsPublishMs = now;
  } else {
    Serial.print("[MQTT] Failed rc=");
    Serial.print(mqtt.state());
    Serial.println(" — retrying…");
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char msg[256];
  if (length >= sizeof(msg)) length = sizeof(msg) - 1;
  memcpy(msg, payload, length);
  msg[length] = '\0';

  Serial.print("[MQTT] CMD: ");
  Serial.println(msg);

  // {"command":"unlock"|"lock"|"alarm", ...} — match command field exactly (avoid "unlock" matching "lock")
  if (strstr(msg, "\"command\":\"unlock\"") || strstr(msg, "\"command\": \"unlock\"")) {
    handleRemoteUnlock();
  } else if (strstr(msg, "\"command\":\"lock\"") || strstr(msg, "\"command\": \"lock\"")) {
    handleRemoteLock();
  } else if (strstr(msg, "\"command\":\"alarm\"") || strstr(msg, "\"command\": \"alarm\"")) {
    bool active = true;
    if (strstr(msg, "\"active\":false") || strstr(msg, "\"active\": false")) {
      active = false;
    }
    handleRemoteAlarm(active);
  }
}

void setLockRelay(bool unlocked) {
  const bool energize = unlocked ? RELAY_ENERGIZE_TO_UNLOCK : !RELAY_ENERGIZE_TO_UNLOCK;
  const uint8_t level = RELAY_MODULE_ACTIVE_LOW
    ? (energize ? LOW : HIGH)
    : (energize ? HIGH : LOW);
  digitalWrite(RELAY_LOCK_PIN, level);
  Serial.print("[RELAY] ");
  Serial.print(unlocked ? "UNLOCKED" : "LOCKED");
  Serial.print(" pin=");
  Serial.println(level == LOW ? "LOW" : "HIGH");
}

void handleRemoteUnlock() {
  // Dashboard / customer token unlock → open and stay open until physical button (or remote lock)
  Serial.println("[MQTT] Unlock from dashboard — 3 blue LEDs ON, open until button locks");
  remoteUnlockWindow = false;
  holdUnlocked = true;
  blinkCount = 0;
  currentState = LOCK_OPEN;
  lockOpenTimestamp = millis();
  lastButtonMs = millis(); // ignore button bounce right after unlock
  setLockRelay(true);
  setOpenLeds(true);
  publishStatus();
}

void lockBoxPhysical(const char* reason) {
  Serial.print("[LOCK] ");
  Serial.println(reason);
  remoteUnlockWindow = false;
  holdUnlocked = false;
  currentState = IDLE;
  blinkCount = 0;
  setLockRelay(false);
  setOpenLeds(false);
  publishStatus();
}

void handleRemoteLock() {
  lockBoxPhysical("Lock from dashboard");
}

void handleRemoteAlarm(bool active) {
  remoteAlarmActive = active;
  if (active) {
    Serial.println("[MQTT] Alarm ON from dashboard");
    digitalWrite(BUZZER_PIN, HIGH);
    setAlarmLedsSolid(true);
  } else {
    Serial.println("[MQTT] Alarm OFF from dashboard");
    digitalWrite(BUZZER_PIN, LOW);
    shockAlarmActive = false;
    restoreOpenLedsAfterAlarm();
  }
  publishStatus();
}

void publishGps() {
  if (!gps.location.isValid()) return;
  char payload[128];
  snprintf(payload, sizeof(payload),
           "{\"latitude\":%.6f,\"longitude\":%.6f,\"satellites\":%u,\"fix\":true}",
           gps.location.lat(), gps.location.lng(), (unsigned)gps.satellites.value());
  mqtt.publish(TOPIC_GPS.c_str(), payload);
}

void publishTamper(bool tampered) {
  if (!mqtt.connected()) return;
  char payload[32];
  snprintf(payload, sizeof(payload), "{\"tampered\":%s}", tampered ? "true" : "false");
  mqtt.publish(TOPIC_TAMPER.c_str(), payload);
}

void publishShock(int32_t magnitude, bool isTouch) {
  if (!mqtt.connected()) return;
  unsigned long now = millis();
  if (now - lastShockPublishMs < SHOCK_COOLDOWN_MS) {
    Serial.println("[SHOCK] Cooldown — alert already sent recently");
    return;
  }
  lastShockPublishMs = now;
  float mag = magnitude / 10000.0f;
  char payload[128];
  snprintf(payload, sizeof(payload),
           "{\"shock\":true,\"touch\":%s,\"magnitude\":%.2f,\"raw\":%ld}",
           isTouch ? "true" : "false", mag, (long)magnitude);
  mqtt.publish(TOPIC_SHOCK.c_str(), payload);
  Serial.println(isTouch ? "[SHOCK] Published (legacy touch flag)" : "[SHOCK] Published to dashboard");
}

void publishShockClear() {
  if (!mqtt.connected()) return;
  char payload[32];
  snprintf(payload, sizeof(payload), "{\"shock\":false}");
  mqtt.publish(TOPIC_SHOCK.c_str(), payload);
  Serial.println("[SHOCK] Cleared on dashboard");
}

void publishStatus() {
  if (!mqtt.connected()) return;
  bool unlocked = (currentState == LOCK_OPEN);
  bool buzzer = digitalRead(BUZZER_PIN) == HIGH;
  bool statusLedOn = openLedsEnabled || currentState == COMMAND_VALID || alarmLedsOverride;
  bool led = statusLedOn;
  bool fix = gps.location.isValid();
  uint32_t sats = gps.satellites.isValid() ? gps.satellites.value() : 0;
  char payload[192];
  snprintf(payload, sizeof(payload),
           "{\"lock_status\":\"%s\",\"buzzer\":%s,\"led\":%s,\"wifi\":true,"
           "\"gps_fix\":%s,\"satellites\":%u,\"gps_bytes\":%lu}",
           unlocked ? "unlocked" : "locked",
           buzzer ? "true" : "false",
           led ? "true" : "false",
           fix ? "true" : "false",
           (unsigned)sats,
           (unsigned long)gpsBytesWindow);
  mqtt.publish(TOPIC_STATUS.c_str(), payload);
}

// 1. Serial local prime
void handleSerialInput() {
  if (Serial.available() > 0) {
    char incomingChar = Serial.read();
    if (incomingChar == 'o' || incomingChar == 'O') {
      if (currentState == IDLE) {
        Serial.println("[CMD] 'o' received. System primed! Press button within 10s.");
        remoteUnlockWindow = false;
        currentState = COMMAND_VALID;
        commandTimestamp = millis();
        blinkCount = 4;
        ledState = true;
        alarmLedsOverride = true;
        writeAllOpenLeds(ledState);
        blinkTimestamp = millis();
      } else {
        Serial.println("[WARN] System already primed or locker currently open.");
      }
    }
  }
}

// 2. Authorization + lock (physical button locks when open)
void handleSystemState() {
  unsigned long currentMillis = millis();
  unsigned long timeout = remoteUnlockWindow ? REMOTE_UNLOCK_MS : CMD_TIMEOUT_MS;
  bool buttonPressed = digitalRead(BUTTON_PIN) == LOW
    && (currentMillis - lastButtonMs >= BUTTON_DEBOUNCE_MS);
  bool closeButtonPressed = (CLOSE_BUTTON_PIN >= 0)
    && digitalRead(CLOSE_BUTTON_PIN) == LOW
    && (currentMillis - lastCloseButtonMs >= BUTTON_DEBOUNCE_MS);

  switch (currentState) {
    case IDLE:
      break;

    case COMMAND_VALID:
      if (currentMillis - commandTimestamp >= timeout) {
        Serial.println("[TIMEOUT] Unlock window expired. IDLE.");
        currentState = IDLE;
        remoteUnlockWindow = false;
        alarmLedsOverride = false;
        setOpenLeds(false);
        blinkCount = 0;
        publishStatus();
      } else if (buttonPressed) {
        lastButtonMs = currentMillis;
        Serial.println("[ACCESS] Button pressed. Opening locker for 5 seconds.");
        holdUnlocked = false;
        currentState = LOCK_OPEN;
        lockOpenTimestamp = currentMillis;
        remoteUnlockWindow = false;
        blinkCount = 0;
        alarmLedsOverride = false;
        setLockRelay(true);
        setOpenLeds(true);
        publishStatus();
      }
      break;

    case LOCK_OPEN:
      // GPIO27 or GPIO32 → lock after token unlock / dashboard open
      if (buttonPressed || closeButtonPressed) {
        if (buttonPressed) lastButtonMs = currentMillis;
        if (closeButtonPressed) lastCloseButtonMs = currentMillis;
        lockBoxPhysical(closeButtonPressed && !buttonPressed
          ? "Close button (GPIO32) — locking box"
          : "Physical button (GPIO27) — locking box");
        break;
      }
      // Local short open (serial 'o' + button) still auto-locks after LOCK_OPEN_MS
      if (!holdUnlocked && currentMillis - lockOpenTimestamp >= LOCK_OPEN_MS) {
        lockBoxPhysical("5 seconds expired — locking");
      }
      break;
  }
}

void handleBlinking() {
  if (blinkCount > 0) {
    unsigned long currentMillis = millis();
    if (currentMillis - blinkTimestamp >= BLINK_INTERVAL) {
      blinkTimestamp = currentMillis;
      ledState = !ledState;
      alarmLedsOverride = true;
      writeAllOpenLeds(ledState);
      blinkCount--;
    }
  }
}

void readMPU(int16_t &ax, int16_t &ay, int16_t &az) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);
  if (Wire.available() >= 6) {
    ax = (Wire.read() << 8) | Wire.read();
    ay = (Wire.read() << 8) | Wire.read();
    az = (Wire.read() << 8) | Wire.read();
  }
}

void checkShockSensor() {
  unsigned long currentMillis = millis();

  if (currentMillis < MPU_SETTLE_MS) return;

  if (currentMillis - lastMpuReadTimestamp >= MPU_SAMPLE_MS) {
    lastMpuReadTimestamp = currentMillis;

    int16_t currentX, currentY, currentZ;
    readMPU(currentX, currentY, currentZ);

    int32_t dx = abs(currentX - lastX);
    int32_t dy = abs(currentY - lastY);
    int32_t dz = abs(currentZ - lastZ);
    int32_t peakDelta = dx;
    if (dy > peakDelta) peakDelta = dy;
    if (dz > peakDelta) peakDelta = dz;

    lastX = currentX;
    lastY = currentY;
    lastZ = currentZ;

    bool boxClosed = (digitalRead(IR_SENSOR_PIN) == LOW);
    bool canDetect = boxClosed
      && currentState != LOCK_OPEN
      && !remoteAlarmActive
      && (currentMillis - lastShockPublishMs >= SHOCK_COOLDOWN_MS);

    uint8_t axesHigh = 0;
    if (dx >= SHOCK_AXIS_MIN) axesHigh++;
    if (dy >= SHOCK_AXIS_MIN) axesHigh++;
    if (dz >= SHOCK_AXIS_MIN) axesHigh++;

    if (peakDelta >= SHOCK_DEBUG_THRESHOLD && peakDelta < SHOCK_THRESHOLD) {
      Serial.print("[MPU] below threshold peak=");
      Serial.print(peakDelta);
      Serial.print(" axes=");
      Serial.println(axesHigh);
    }

    bool isShockHit = peakDelta >= SHOCK_THRESHOLD && axesHigh >= 2;

    if (isShockHit && canDetect) {
      shockConfirmCount++;
      if (shockConfirmCount >= SHOCK_CONFIRM_READS) {
        Serial.print("[SHOCK] Impact confirmed peak=");
        Serial.print(peakDelta);
        Serial.print(" axes=");
        Serial.println(axesHigh);
        shockAlarmActive = true;
        shockTimestamp = currentMillis;
        shockConfirmCount = 0;
        digitalWrite(BUZZER_PIN, HIGH);
        setAlarmLedsSolid(true);
        publishShock(peakDelta, false);
      }
    } else if (peakDelta < SHOCK_THRESHOLD / 4) {
      shockConfirmCount = 0;
    }
  }

  if (shockAlarmActive && !remoteAlarmActive) {
    if (currentMillis - shockTimestamp < SHOCK_ALARM_MS) {
      setAlarmLedsSolid(true);
      if (digitalRead(IR_SENSOR_PIN) == LOW) {
        digitalWrite(BUZZER_PIN, HIGH);
      }
    } else {
      shockAlarmActive = false;
      if (!lastTamperPublished) {
        restoreOpenLedsAfterAlarm();
        if (digitalRead(IR_SENSOR_PIN) == LOW) {
          digitalWrite(BUZZER_PIN, LOW);
        }
      }
      publishShockClear();
      publishStatus();
    }
  }
}

void monitorAndSecureBox() {
  bool isBoxClosed = (digitalRead(IR_SENSOR_PIN) == LOW);
  bool isAuthorizedOpen = (currentState == LOCK_OPEN);
  unsigned long currentMillis = millis();

  if (remoteAlarmActive) {
    digitalWrite(BUZZER_PIN, HIGH);
    setAlarmLedsSolid(true);
  } else if (!isBoxClosed && !isAuthorizedOpen) {
    digitalWrite(BUZZER_PIN, HIGH);
    if (currentMillis - redBlinkTimestamp >= RAPID_BLINK) {
      redBlinkTimestamp = currentMillis;
      blinkAlarmLeds();
    }
  } else if (isBoxClosed && !shockAlarmActive && !lastTamperPublished) {
    digitalWrite(BUZZER_PIN, LOW);
    restoreOpenLedsAfterAlarm();
  }

  if (isBoxClosed != lastIrState) {
    lastIrState = isBoxClosed;
    if (isBoxClosed) {
      Serial.println("[SENSOR] Box Status: CLOSED");
      if (lastTamperPublished) {
        publishTamper(false);
        lastTamperPublished = false;
        restoreOpenLedsAfterAlarm();
      }
      publishStatus();
    } else {
      if (isAuthorizedOpen) {
        Serial.println("[SENSOR] Box Status: OPENED (Authorized)");
      } else {
        Serial.println("[ALERT] UNAUTHORIZED OPEN — no valid token!");
        digitalWrite(BUZZER_PIN, HIGH);
        setAlarmLedsSolid(true);
        publishTamper(true);
        lastTamperPublished = true;
      }
      publishStatus();
    }
  }
}

void updateGpsData() {
  while (gpsSerial.available() > 0) {
    char c = gpsSerial.read();
    gps.encode(c);
    gpsBytesTotal++;
    gpsBytesWindow++;
    lastGpsByteMs = millis();
  }

  unsigned long now = millis();
  if (now - gpsWindowStartMs >= 10000) {
    gpsBytesWindow = 0;
    gpsWindowStartMs = now;
  }

  if (gpsBytesTotal == 0 && now > 30000 && !gpsWiringWarned) {
    gpsWiringWarned = true;
    Serial.println("[GPS] NO serial data — check wiring:");
    Serial.println("       GPS TX wire → ESP32 GPIO16 (RX2)");
    Serial.println("       GPS RX wire → ESP32 GPIO17 (TX2)");
    Serial.println("       VCC 3.3V (not 5V unless module supports it), GND shared");
    Serial.println("       Move box outdoors — indoor = 0 satellites");
  }

  if (gpsBytesWindow == 0 && now - lastGpsBaudTryMs >= GPS_BAUD_RETRY_MS && now > 25000) {
    Serial.println("[GPS] No NMEA bytes — trying next baud rate…");
    tryNextGpsBaud();
  }

  if (now - lastGpsPrintTimestamp >= GPS_PRINT_MS) {
    lastGpsPrintTimestamp = now;
    uint32_t sats = gps.satellites.isValid() ? gps.satellites.value() : 0;
    Serial.print("[GPS] Satellites: ");
    Serial.print(sats);
    Serial.print(" | NMEA bytes/10s: ");
    Serial.print(gpsBytesWindow);
    if (gps.location.isValid()) {
      Serial.print(" | FIX OK Lat: ");
      Serial.print(gps.location.lat(), 6);
      Serial.print(" Lon: ");
      Serial.println(gps.location.lng(), 6);
    } else if (gpsBytesWindow == 0) {
      Serial.println(" | NO GPS data — check TX/RX wires and power");
    } else if (sats == 0) {
      Serial.println(" | Module OK — waiting for sky view (go outdoors)");
    } else {
      Serial.println(" | Acquiring fix… keep module facing open sky");
    }
  }
}



