# Rudder Firmware — Hardware Telemetry

Reference firmware for streaming biometric / environment vitals from a
Wi-Fi microcontroller into your local Rudder instance.

Everything here targets one endpoint:

```
POST http://<your-host>:3000/api/ingest/telemetry
Content-Type: application/json
X-Device-Token: <token>          # only if RUDDER_DEVICE_TOKEN is set on the server

{
  "device_id": "esp32-sensor-01",
  "classification": "Device Telemetry",
  "metrics": { "heart_rate": 64, "hrv": 55, "steps": 120 }
}
```

The server (`app/src/app/api/ingest/telemetry/route.ts`) stores every payload as
a raw telemetry node and additionally promotes recognized biometric keys into
the daily `health_metrics` table. Recognized keys:

| Metric in payload | Stored as |
| --- | --- |
| `heart_rate` or `resting_hr` | `resting_hr` |
| `hrv` | `hrv` |
| `steps` | `steps` |
| `sleep_hours` or `sleep` | `sleep_hours` |

Any other metric keys (e.g. `temperature`, `co2`) are kept on the raw node but
not promoted to the daily summary.

## Files

| File | Platform |
| --- | --- |
| `esp32-telemetry/esp32-telemetry.ino` | ESP32 via Arduino core (needs the ArduinoJson library) |
| `esp32-telemetry/main.py` | ESP32 / Raspberry Pi Pico W via MicroPython (`urequests`, `network`) |

## Setup

1. **Find your host IP.** The board must reach your computer over the LAN, so
   `localhost` will not work. On macOS: `ipconfig getifaddr en0`. Use e.g.
   `http://192.168.1.100:3000`.
2. **Set the device token (recommended).** In `app/.env.local`:
   ```
   RUDDER_DEVICE_TOKEN=$(openssl rand -hex 16)
   ```
   Put the same value in the firmware's `DEVICE_TOKEN`. If you leave the server
   token unset, leave `DEVICE_TOKEN` empty too (open dev mode).
3. **Edit the config block** at the top of the sketch (Wi-Fi SSID/password,
   `RUDDER_HOST`, `DEVICE_ID`).
4. **Flash:**
   - Arduino: open the `.ino`, install **ArduinoJson**, select your ESP32 board, upload.
   - MicroPython: copy `main.py` to the board (Thonny, or `mpremote cp main.py :main.py`).
5. **Watch the result** in Rudder → Hardware/Health pages, or the serial monitor.

## Test without hardware

A simulator posts synthetic readings using the exact same contract, so you can
verify the whole pipeline before flashing anything:

```bash
cd app
npm run dev                                   # start Rudder in one terminal

# in another terminal (token only needed if the server has one set):
RUDDER_DEVICE_TOKEN=<your-token> npm run simulate:telemetry            # one shot
RUDDER_DEVICE_TOKEN=<your-token> npm run simulate:telemetry -- --count 5
RUDDER_DEVICE_TOKEN=<your-token> npm run simulate:telemetry -- --watch --interval 10
```

Flags: `--host <url>`, `--device <id>`, `--interval <sec>`, `--count <n>`, `--watch`.

A `401 Unauthorized device` means the token sent doesn't match the server's
`RUDDER_DEVICE_TOKEN` (or one side has it set and the other doesn't).
