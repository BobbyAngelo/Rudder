/* ═══════════════════════════════════════════════════════
   Middleware — Session gate for all Rudder routes
   Skips auth in dev mode (no RUDDER_PASSWORD_HASH set)
   Uses Web Crypto API (Edge Runtime compatible)
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/_next", "/favicon.ico"];
const SESSION_SECRET = process.env.RUDDER_SESSION_SECRET || "rudder-dev-secret-change-me";

async function verifySession(token: string): Promise<boolean> {
  try {
    const parts = token.split(":");
    if (parts.length !== 3) return false;
    const [prefix, expiresStr, sig] = parts;
    const payload = `${prefix}:${expiresStr}`;

    // Web Crypto HMAC (Edge Runtime compatible)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expected = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, "0")).join("");

    if (sig !== expected) return false;
    if (Date.now() > parseInt(expiresStr)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // If no password hash configured, auth is disabled (dev mode)
  if (!process.env.RUDDER_PASSWORD_HASH) {
    return NextResponse.next();
  }

  // Check session cookie
  const session = request.cookies.get("rudder_session")?.value;
  if (!session || !(await verifySession(session))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
