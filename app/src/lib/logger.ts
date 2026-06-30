/* ═══════════════════════════════════════════════════════
   Minimal structured logger.

   Isomorphic (works in API routes, lib code, and the standalone tsx daemons).
   Level-gated via LOG_LEVEL (debug | info | warn | error); defaults to "info"
   in production and "debug" otherwise. Output is timestamped and level-tagged
   so logs are greppable instead of bare console.log noise.
   ═══════════════════════════════════════════════════════ */

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const configured = process.env.LOG_LEVEL as Level | undefined;
  if (configured && configured in ORDER) return ORDER[configured];
  return process.env.NODE_ENV === "production" ? ORDER.info : ORDER.debug;
}

function emit(level: Level, args: unknown[]): void {
  if (ORDER[level] < threshold()) return;
  const tag = `${new Date().toISOString()} [${level.toUpperCase()}]`;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  sink(tag, ...args);
}

export const log = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
