import test from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";

/* ═══════════════════════════════════════════════════════
   Correspondence send-route guard tests (#13).
   Covers the pre-send validation that protects the act step: missing fields,
   unconfigured SMTP, and unknown target message. The actual SMTP delivery is
   not exercised (no live mail server).
   ═══════════════════════════════════════════════════════ */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "rudder-send-test-"));
process.env.RUDDER_DATA_DIR = TMP;

import { NextRequest } from "next/server";
import { POST } from "./route";
import { getDB } from "../../../../lib/db";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/correspondence/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test.after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

test("rejects a request missing correspondenceId or replyBody (400)", async () => {
  assert.strictEqual((await POST(makeReq({ correspondenceId: 1 }))).status, 400);
  assert.strictEqual((await POST(makeReq({ replyBody: "hi" }))).status, 400);
});

test("refuses to send when SMTP is not configured (400)", async () => {
  const res = await POST(makeReq({ correspondenceId: 1, replyBody: "Thanks!" }));
  assert.strictEqual(res.status, 400);
  const json = (await res.json()) as { error: string };
  assert.match(json.error, /SMTP/, "error mentions SMTP configuration");
});

test("returns 404 for an unknown target message once SMTP is configured", async () => {
  getDB()
    .prepare("UPDATE user_preferences SET smtp_host = ?, smtp_user = ?, smtp_pass = ? WHERE id = 1")
    .run("smtp.example.com", "me@example.com", "secret");

  const res = await POST(makeReq({ correspondenceId: 999999, replyBody: "Reply body" }));
  assert.strictEqual(res.status, 404, "no message with that id → 404, before any send");
});
