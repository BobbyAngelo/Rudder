/* ═══════════════════════════════════════════════════════
   Device-token gate for unattended ingest endpoints.

   Wearables / ESP32 nodes can't hold a browser session cookie, so the
   hardware ingest routes (telemetry, presence) authenticate with a static
   token instead of the user session.

   Opt-in: when RUDDER_DEVICE_TOKEN is unset, these routes stay open (the
   current dev-friendly default). When it is set, callers must present the
   token via either header:
     Authorization: Bearer <token>
     X-Device-Token: <token>
   ═══════════════════════════════════════════════════════ */

import { safeEqual } from "./session";

export function deviceTokenValid(req: Request): boolean {
  const expected = process.env.RUDDER_DEVICE_TOKEN;
  if (!expected) return true; // not configured → open (backward compatible)

  const presented =
    req.headers.get("x-device-token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  return presented.length > 0 && safeEqual(presented, expected);
}
