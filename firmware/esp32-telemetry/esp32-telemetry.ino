/* ═══════════════════════════════════════════════════════
   Rudder — ESP32 Telemetry Sender (Arduino reference firmware)

   Streams biometric / environment vitals to your local Rudder instance:
     POST http://<host>:3000/api/ingest/telemetry

   Matches the server contract in app/src/app/api/ingest/telemetry/route.ts:
     { "device_id": "...", "metrics": { "heart_rate": <n>, ... } }

   The server extracts heart_rate (or resting_hr), hrv, steps, and
   sleep_hours (or sleep) into daily health_metrics; any other metric keys
   are still stored on the raw telemetry node.

   Board:   any ESP32 dev board (Arduino core for ESP32 installed)
   Library: ArduinoJson (Sketch > Include Library > Manage Libraries)
   ═══════════════════════════════════════════════════════ */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ── Configuration ───────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Your computer's LAN IP running Rudder (NOT localhost — the ESP32 needs to
// reach your machine over Wi-Fi). Find it with `ipconfig getifaddr en0` (macOS).
const char* RUDDER_HOST   = "http://192.168.1.100:3000";

const char* DEVICE_ID     = "esp32-sensor-01";

// Must match RUDDER_DEVICE_TOKEN in app/.env.local. Leave "" if the server
// has no device token configured (open dev mode).
const char* DEVICE_TOKEN  = "";

const unsigned long SEND_INTERVAL_MS = 30000;  // 30s between sends
// ────────────────────────────────────────────────────────

unsigned long lastSend = 0;

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("[wifi] connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[wifi] connected, ip=%s\n", WiFi.localIP().toString().c_str());
}

// TODO: replace these with real sensor reads (e.g. MAX30102 for HR/HRV).
int readHeartRate() { return 60 + random(0, 25); }
int readHrv()       { return 40 + random(0, 40); }
int readSteps()     { return random(0, 200); }

void sendTelemetry(int hr, int hrv, int steps) {
  connectWiFi();

  // Build the JSON body: { device_id, metrics: { ... } }
  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["classification"] = "Device Telemetry";
  JsonObject metrics = doc.createNestedObject("metrics");
  metrics["heart_rate"] = hr;
  metrics["hrv"] = hrv;
  metrics["steps"] = steps;

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(String(RUDDER_HOST) + "/api/ingest/telemetry");
  http.addHeader("Content-Type", "application/json");
  // Send the device token only when one is configured.
  if (strlen(DEVICE_TOKEN) > 0) {
    http.addHeader("X-Device-Token", DEVICE_TOKEN);
  }

  int code = http.POST(body);
  if (code > 0) {
    Serial.printf("[telemetry] POST -> %d : %s\n", code, http.getString().c_str());
  } else {
    Serial.printf("[telemetry] POST failed: %s\n", http.errorToString(code).c_str());
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(200);
  randomSeed(esp_random());
  connectWiFi();
}

void loop() {
  unsigned long now = millis();
  if (now - lastSend >= SEND_INTERVAL_MS || lastSend == 0) {
    lastSend = now;
    sendTelemetry(readHeartRate(), readHrv(), readSteps());
  }
}
