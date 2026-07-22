/*
 * Anti-Tamper Smart Delivery Box - ESP32 Reference Sketch
 * 
 * Libraries required:
 *   - PubSubClient (MQTT)
 *   - TinyGPS++ (GPS)
 *   - MPU6050 (accelerometer)
 * 
 * Hardware:
 *   - ESP32
 *   - NEO-6M GPS module
 *   - Reed switch (tamper detection)
 *   - MPU6050 (shock/vibration)
 *   - Buzzer + LED (alarm)
 *   - Solenoid lock (relay)
 */

#define DEVICE_ID "BOX-001"
#define MQTT_SERVER "your-mqtt-broker-ip"
#define MQTT_PORT 1883

// MQTT Topics
#define TOPIC_GPS     "box/" DEVICE_ID "/gps"
#define TOPIC_TAMPER  "box/" DEVICE_ID "/tamper"
#define TOPIC_SHOCK   "box/" DEVICE_ID "/shock"
#define TOPIC_STATUS  "box/" DEVICE_ID "/status"
#define TOPIC_COMMAND "box/" DEVICE_ID "/command"

// Pin definitions
#define REED_SWITCH_PIN  4
#define BUZZER_PIN       25
#define LED_PIN          26
#define LOCK_RELAY_PIN   27

// Shock threshold (g-force)
#define SHOCK_THRESHOLD  2.5

void setup() {
  Serial.begin(115200);
  
  pinMode(REED_SWITCH_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(LOCK_RELAY_PIN, OUTPUT);
  
  // Initialize GPS, MPU6050, WiFi, MQTT...
  // mqttClient.setCallback(onMqttMessage);
  // mqttClient.subscribe(TOPIC_COMMAND);
}

void loop() {
  // 1. GPS - always update location
  publishGps();
  
  // 2. Reed switch - tamper detection
  if (digitalRead(REED_SWITCH_PIN) == LOW) {
    triggerAlarm("tamper");
    publishTamper(true);
  }
  
  // 3. MPU6050 - shock detection
  float magnitude = readMpuMagnitude();
  if (magnitude > SHOCK_THRESHOLD) {
    triggerAlarm("shock");
    publishShock(magnitude);
  }
  
  // 4. Handle MQTT commands (unlock/lock/alarm)
  // mqttClient.loop();
}

void triggerAlarm(const char* reason) {
  digitalWrite(BUZZER_PIN, HIGH);
  digitalWrite(LED_PIN, HIGH);
  // Buzzer + LED stay on until acknowledged or timeout
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  // Parse JSON command:
  // {"command": "unlock"} → open solenoid lock
  // {"command": "lock"}   → close lock
  // {"command": "alarm", "active": false} → stop buzzer/LED
}

void publishGps() {
  // {"latitude": lat, "longitude": lng}
}

void publishTamper(bool tampered) {
  // {"tampered": true}
}

void publishShock(float magnitude) {
  // {"shock": true, "magnitude": magnitude}
}
