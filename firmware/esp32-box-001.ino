#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <TinyGPS++.h>

// ================= DEVICE / CLOUD (must match dashboard devices.device_id) =================
#define DEVICE_ID "BOX-001"

// WiFi
const char* WIFI_SSID     = "net";
const char* WIFI_PASSWORD = "1234567890";

// MQTT — same broker as server MQTT_BROKER_URL (root .env)
const char* MQTT_SERVER = "test.mosquitto.org";
const int   MQTT_PORT   = 1883;

String TOPIC_GPS     = String("box/") + DEVICE_ID + "/gps";
String TOPIC_TAMPER  = String("box/") + DEVICE_ID + "/tamper";
String TOPIC_SHOCK   = String("box/") + DEVICE_ID + "/shock";
String TOPIC_STATUS  = String("box/") + DEVICE_ID + "/status";
String TOPIC_COMMAND = String("box/") + DEVICE_ID + "/command";

// ================= HARDWARE PINS =================
const int IR_SENSOR_PIN = 4;       // LOW = CLOSED, HIGH = OPENED
const int RELAY_LOCK_PIN = 26;
const int BUTTON_PIN = 27;
const int LED_INDICATOR_PIN = 23;  // green / open
const int BUZZER_PIN = 25;
const int RED_LED_PIN = 19;        // tamper / shock / alarm
const int WIFI_LED = 18;           // ON = WiFi connected

const int GPS_RX_PIN = 16;
const int GPS_TX_PIN = 17;
const int MPU_ADDR = 0x68;

// ================= TIMING =================
const unsigned long CMD_TIMEOUT_MS = 10000;
const unsigned long LOCK_OPEN_MS = 5000;
const unsigned long REMOTE_UNLOCK_MS = 60000; // dashboard unlock → button window
const unsigned long BLINK_INTERVAL = 250;
const unsigned long RAPID_BLINK = 100;
const unsigned long SHOCK_ALARM_MS = 5000;
const unsigned long MPU_SAMPLE_MS = 30;
const unsigned long GPS_PRINT_MS = 2000;
const unsigned long GPS_PUBLISH_MS = 3000;
const unsigned long STATUS_PUBLISH_MS = 10000;
const unsigned long WIFI_RETRY_MS = 10000;
const unsigned long MQTT_RETRY_MS = 5000;

// MPU6050 — hard hit only
const int32_t SHOCK_THRESHOLD = 60000;

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
unsigned long lastMpuReadTimestamp = 0;
unsigned long lastGpsPrintTimestamp = 0;
unsigned long lastGpsPublishMs = 0;
unsigned long lastStatusPublishMs = 0;
unsigned long lastMqttRetryMs = 0;

int blinkCount = 0;
bool ledState = false;
bool redLedState = false;
bool lastIrState = false;
bool shockAlarmActive = false;
bool remoteAlarmActive = false;
bool lastTamperPublished = false;
bool remoteUnlockWindow = false;

int16_t lastX = 0, lastY = 0, lastZ = 0;

TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

void wifiTask(void* parameter);
void updateWifiLed();
void maintainMqtt();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void publishGps();
void publishTamper(bool tampered);
void publishShock(int32_t magnitude);
void publishStatus();
void handleRemoteUnlock();
void handleRemoteLock();
void handleRemoteAlarm(bool active);
void readMPU(int16_t &ax, int16_t &ay, int16_t &az);

void setup() {
  Serial.begin(115200);

  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  Wire.begin(21, 22);
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0);
  Wire.endTransmission(true);

  pinMode(IR_SENSOR_PIN, INPUT_PULLUP);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(RELAY_LOCK_PIN, OUTPUT);
  pinMode(LED_INDICATOR_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(WIFI_LED, OUTPUT);

  digitalWrite(RELAY_LOCK_PIN, LOW);
  digitalWrite(LED_INDICATOR_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);
  digitalWrite(WIFI_LED, LOW);

  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);
  xTaskCreatePinnedToCore(wifiTask, "wifiTask", 4096, NULL, 1, NULL, 0);

  delay(100);
  readMPU(lastX, lastY, lastZ);
  lastIrState = (digitalRead(IR_SENSOR_PIN) == LOW);

  Serial.println("[BOOT] BOX-001 online — WiFi + MQTT → dashboard");
  Serial.print("[WIFI] Connecting to ");
  Serial.println(WIFI_SSID);
  Serial.print("[MQTT] Broker ");
  Serial.println(MQTT_SERVER);
  Serial.println("[HELP] Serial 'o' primes local button unlock (10s)");
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

void updateWifiLed() {
  digitalWrite(WIFI_LED, WiFi.status() == WL_CONNECTED ? HIGH : LOW);
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
  Serial.print("[MQTT] Connecting as ");
  Serial.println(clientId);

  if (mqtt.connect(clientId.c_str())) {
    mqtt.subscribe(TOPIC_COMMAND.c_str());
    Serial.println("[MQTT] Connected — subscribed to command topic");
    publishStatus();
  } else {
    Serial.print("[MQTT] Failed rc=");
    Serial.println(mqtt.state());
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char msg[256];
  if (length >= sizeof(msg)) length = sizeof(msg) - 1;
  memcpy(msg, payload, length);
  msg[length] = '\0';

  Serial.print("[MQTT] CMD: ");
  Serial.println(msg);

  // {"command":"unlock"|"lock"|"alarm", ...}
  if (strstr(msg, "\"unlock\"")) {
    handleRemoteUnlock();
  } else if (strstr(msg, "\"lock\"")) {
    handleRemoteLock();
  } else if (strstr(msg, "\"alarm\"")) {
    bool active = true;
    if (strstr(msg, "\"active\":false") || strstr(msg, "\"active\": false")) {
      active = false;
    }
    handleRemoteAlarm(active);
  }
}

void handleRemoteUnlock() {
  Serial.println("[MQTT] Unlock from dashboard — press button within 60s");
  remoteUnlockWindow = true;
  currentState = COMMAND_VALID;
  commandTimestamp = millis();
  // Use longer window for remote unlock
  blinkCount = 8;
  ledState = true;
  digitalWrite(LED_INDICATOR_PIN, HIGH);
  blinkTimestamp = millis();
  publishStatus();
}

void handleRemoteLock() {
  Serial.println("[MQTT] Lock from dashboard");
  remoteUnlockWindow = false;
  currentState = IDLE;
  blinkCount = 0;
  digitalWrite(RELAY_LOCK_PIN, LOW);
  digitalWrite(LED_INDICATOR_PIN, LOW);
  publishStatus();
}

void handleRemoteAlarm(bool active) {
  remoteAlarmActive = active;
  if (active) {
    Serial.println("[MQTT] Alarm ON from dashboard");
    digitalWrite(BUZZER_PIN, HIGH);
    digitalWrite(RED_LED_PIN, HIGH);
  } else {
    Serial.println("[MQTT] Alarm OFF from dashboard");
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(RED_LED_PIN, LOW);
    shockAlarmActive = false;
  }
  publishStatus();
}

void publishGps() {
  if (!gps.location.isValid()) return;
  char payload[96];
  snprintf(payload, sizeof(payload),
           "{\"latitude\":%.6f,\"longitude\":%.6f}",
           gps.location.lat(), gps.location.lng());
  mqtt.publish(TOPIC_GPS.c_str(), payload);
}

void publishTamper(bool tampered) {
  if (!mqtt.connected()) return;
  char payload[32];
  snprintf(payload, sizeof(payload), "{\"tampered\":%s}", tampered ? "true" : "false");
  mqtt.publish(TOPIC_TAMPER.c_str(), payload);
}

void publishShock(int32_t magnitude) {
  if (!mqtt.connected()) return;
  // magnitude scaled for dashboard (> 0.7 triggers alert path too)
  float mag = magnitude / 10000.0f;
  char payload[64];
  snprintf(payload, sizeof(payload), "{\"shock\":true,\"magnitude\":%.2f}", mag);
  mqtt.publish(TOPIC_SHOCK.c_str(), payload);
}

void publishStatus() {
  if (!mqtt.connected()) return;
  bool unlocked = (currentState == LOCK_OPEN);
  bool buzzer = digitalRead(BUZZER_PIN) == HIGH;
  bool led = digitalRead(RED_LED_PIN) == HIGH || digitalRead(LED_INDICATOR_PIN) == HIGH;
  char payload[128];
  snprintf(payload, sizeof(payload),
           "{\"lock_status\":\"%s\",\"buzzer\":%s,\"led\":%s,\"wifi\":true}",
           unlocked ? "unlocked" : "locked",
           buzzer ? "true" : "false",
           led ? "true" : "false");
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
        digitalWrite(LED_INDICATOR_PIN, ledState);
        blinkTimestamp = millis();
      } else {
        Serial.println("[WARN] System already primed or locker currently open.");
      }
    }
  }
}

// 2. Authorization + lock
void handleSystemState() {
  unsigned long currentMillis = millis();
  unsigned long timeout = remoteUnlockWindow ? REMOTE_UNLOCK_MS : CMD_TIMEOUT_MS;

  switch (currentState) {
    case IDLE:
      break;

    case COMMAND_VALID:
      if (currentMillis - commandTimestamp >= timeout) {
        Serial.println("[TIMEOUT] Unlock window expired. IDLE.");
        currentState = IDLE;
        remoteUnlockWindow = false;
        digitalWrite(LED_INDICATOR_PIN, LOW);
        blinkCount = 0;
        publishStatus();
      } else if (digitalRead(BUTTON_PIN) == LOW) {
        Serial.println("[ACCESS] Button pressed. Opening locker for 5 seconds.");
        currentState = LOCK_OPEN;
        lockOpenTimestamp = currentMillis;
        remoteUnlockWindow = false;
        blinkCount = 0;
        digitalWrite(RELAY_LOCK_PIN, HIGH);
        digitalWrite(LED_INDICATOR_PIN, HIGH);
        publishStatus();
      }
      break;

    case LOCK_OPEN:
      if (currentMillis - lockOpenTimestamp >= LOCK_OPEN_MS) {
        Serial.println("[LOCK] 5 seconds expired. Locking.");
        digitalWrite(RELAY_LOCK_PIN, LOW);
        digitalWrite(LED_INDICATOR_PIN, LOW);
        currentState = IDLE;
        publishStatus();
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
      digitalWrite(LED_INDICATOR_PIN, ledState);
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

  if (currentMillis - lastMpuReadTimestamp >= MPU_SAMPLE_MS) {
    lastMpuReadTimestamp = currentMillis;

    int16_t currentX, currentY, currentZ;
    readMPU(currentX, currentY, currentZ);

    int32_t dx = abs(currentX - lastX);
    int32_t dy = abs(currentY - lastY);
    int32_t dz = abs(currentZ - lastZ);
    int32_t combinedForce = dx + dy + dz;

    lastX = currentX;
    lastY = currentY;
    lastZ = currentZ;

    if (combinedForce > SHOCK_THRESHOLD && currentState != LOCK_OPEN && !shockAlarmActive) {
      Serial.print("[SHOCK] Detected! Value: ");
      Serial.println(combinedForce);
      shockAlarmActive = true;
      shockTimestamp = currentMillis;
      publishShock(combinedForce);
    }
  }

  if (shockAlarmActive && !remoteAlarmActive) {
    if (currentMillis - shockTimestamp < SHOCK_ALARM_MS) {
      digitalWrite(RED_LED_PIN, HIGH);
      if (digitalRead(IR_SENSOR_PIN) == LOW) {
        digitalWrite(BUZZER_PIN, HIGH);
      }
    } else {
      shockAlarmActive = false;
      digitalWrite(RED_LED_PIN, LOW);
      if (digitalRead(IR_SENSOR_PIN) == LOW) {
        digitalWrite(BUZZER_PIN, LOW);
      }
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
    digitalWrite(RED_LED_PIN, HIGH);
  } else if (!isBoxClosed && !isAuthorizedOpen) {
    digitalWrite(BUZZER_PIN, HIGH);
    if (currentMillis - redBlinkTimestamp >= RAPID_BLINK) {
      redBlinkTimestamp = currentMillis;
      redLedState = !redLedState;
      digitalWrite(RED_LED_PIN, redLedState);
    }
  } else if (isBoxClosed && !shockAlarmActive) {
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(RED_LED_PIN, LOW);
  }

  if (isBoxClosed != lastIrState) {
    lastIrState = isBoxClosed;
    if (isBoxClosed) {
      Serial.println("[SENSOR] Box Status: CLOSED");
      if (lastTamperPublished) {
        publishTamper(false);
        lastTamperPublished = false;
      }
      publishStatus();
    } else {
      if (isAuthorizedOpen) {
        Serial.println("[SENSOR] Box Status: OPENED (Authorized)");
      } else {
        Serial.println("[ALERT] UNAUTHORIZED OPEN!");
        publishTamper(true);
        lastTamperPublished = true;
      }
      publishStatus();
    }
  }
}

void updateGpsData() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  unsigned long currentMillis = millis();
  if (currentMillis - lastGpsPrintTimestamp >= GPS_PRINT_MS) {
    lastGpsPrintTimestamp = currentMillis;
    Serial.print("[GPS] Satellites: ");
    Serial.print(gps.satellites.value());
    if (gps.location.isValid()) {
      Serial.print(" | Lat: ");
      Serial.print(gps.location.lat(), 6);
      Serial.print(" | Lon: ");
      Serial.println(gps.location.lng(), 6);
    } else {
      Serial.println(" | Searching for satellite fix...");
    }
  }
}
