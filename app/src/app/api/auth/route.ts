/* ═══════════════════════════════════════════════════════
   Auth API — Sovereign credential-based authentication
   Single-user, bcrypt password, HMAC-signed session cookie
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import { createHmac } from "crypto";
import {
  getSessionSecret,
  safeEqual,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
} from "@/lib/session";

const PASSWORD_HASH = process.env.RUDDER_PASSWORD_HASH || "";

function createSessionToken(): string {
  const expires = Date.now() + SESSION_DURATION_MS;
  const payload = `rudder:${expires}`;
  const sig = createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  return `${payload}:${sig}`;
}

export function verifySessionToken(token: string): boolean {
  try {
    const parts = token.split(":");
    if (parts.length !== 3) return false;
    const [prefix, expiresStr, sig] = parts;
    const payload = `${prefix}:${expiresStr}`;
    const expected = createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
    if (!safeEqual(sig, expected)) return false;
    if (Date.now() > parseInt(expiresStr)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    // If no password hash is configured, auth is disabled (dev mode)
    if (!PASSWORD_HASH) {
      const token = createSessionToken();
      const response = NextResponse.json({ success: true, mode: "dev" });
      response.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: false, // localhost
        sameSite: "strict",
        maxAge: SESSION_DURATION_MS / 1000,
        path: "/",
      });
      return response;
    }

    // bcrypt compare
    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(password, PASSWORD_HASH);

    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = createSessionToken();
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: SESSION_DURATION_MS / 1000,
      path: "/",
    });
    return response;
  } catch (error) {
    return serverError(error);
  }
}
