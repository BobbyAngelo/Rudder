# ═══════════════════════════════════════════════════════
# Rudder — ESP32 / Pico W Telemetry Sender (MicroPython reference)
#
# Streams biometric / environment vitals to your local Rudder instance:
#   POST http://<host>:3000/api/ingest/telemetry
#
# Matches the server contract in app/src/app/api/ingest/telemetry/route.ts:
#   { "device_id": "...", "metrics": { "heart_rate": <n>, ... } }
#
# Flash: copy this file to the board as main.py (e.g. with mpremote/Thonny).
# Requires a MicroPython build with the `urequests` and `network` modules.
# ═══════════════════════════════════════════════════════

import time
import network
import urequests
import urandom

# ── Configuration ───────────────────────────────────────
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

# Your computer's LAN IP running Rudder (NOT localhost). macOS: `ipconfig getifaddr en0`.
RUDDER_HOST = "http://192.168.1.100:3000"

DEVICE_ID = "esp32-sensor-01"

# Must match RUDDER_DEVICE_TOKEN in app/.env.local. Leave "" if unset on the server.
DEVICE_TOKEN = ""

SEND_INTERVAL_S = 30
# ────────────────────────────────────────────────────────


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print("[wifi] connecting to", WIFI_SSID)
        wlan.connect(WIFI_SSID, WIFI_PASSWORD)
        while not wlan.isconnected():
            time.sleep(0.5)
    print("[wifi] connected, ip =", wlan.ifconfig()[0])


def _rand(lo, hi):
    return lo + (urandom.getrandbits(16) % (hi - lo + 1))


# TODO: replace with real sensor reads (e.g. MAX30102 over I2C).
def read_vitals():
    return {
        "heart_rate": _rand(60, 85),
        "hrv": _rand(40, 80),
        "steps": _rand(0, 200),
    }


def send_telemetry(metrics):
    url = RUDDER_HOST.rstrip("/") + "/api/ingest/telemetry"
    headers = {"Content-Type": "application/json"}
    # Send the device token only when one is configured.
    if DEVICE_TOKEN:
        headers["X-Device-Token"] = DEVICE_TOKEN

    payload = {
        "device_id": DEVICE_ID,
        "classification": "Device Telemetry",
        "metrics": metrics,
    }

    try:
        res = urequests.post(url, json=payload, headers=headers)
        print("[telemetry] POST ->", res.status_code, res.text)
        res.close()
    except Exception as e:  # noqa: BLE001 - reference firmware keeps the loop alive
        print("[telemetry] POST failed:", e)


def main():
    connect_wifi()
    while True:
        send_telemetry(read_vitals())
        time.sleep(SEND_INTERVAL_S)


main()
