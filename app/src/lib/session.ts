/* ═══════════════════════════════════════════════════════
   Session config — shared by the Node auth route and the
   Edge middleware. Keep this module free of runtime-specific
   imports (no node:crypto, no better-sqlite3) so it stays
   importable from the Edge Runtime.
   ═══════════════════════════════════════════════════════ */

export const INSECURE_DEFAULT_SECRET = "rudder-dev-secret-change-me";
export const SESSION_COOKIE = "rudder_session";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Auth is enabled only when a password hash is configured. */
export function authEnabled(): boolean {
  return !!process.env.RUDDER_PASSWORD_HASH;
}

/**
 * Resolve the HMAC session secret.
 *
 * Hard-fails when auth is enabled but the secret is missing or still set to
 * the public default shipped in the repo — otherwise anyone could forge a
 * valid session cookie. In dev mode (auth disabled) the default is allowed.
 */
export function getSessionSecret(): string {
  const secret = process.env.RUDDER_SESSION_SECRET;

  if (authEnabled()) {
    if (!secret || secret === INSECURE_DEFAULT_SECRET) {
      throw new Error(
        "RUDDER_SESSION_SECRET must be set to a strong, unique value when " +
          "RUDDER_PASSWORD_HASH is configured. Generate one with: openssl rand -hex 32",
      );
    }
    return secret;
  }

  return secret || INSECURE_DEFAULT_SECRET;
}

/**
 * Constant-time string comparison. Avoids leaking how many leading characters
 * matched via early-exit timing. Works in both the Node and Edge runtimes
 * (no Buffer / node:crypto dependency). Length is compared up front; for our
 * fixed-length hex signatures that does not leak anything useful.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
