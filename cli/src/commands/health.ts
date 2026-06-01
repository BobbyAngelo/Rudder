import chalk from "chalk";
import fs from "fs";
import { RUDDER_DB_PATH, OLLAMA_DEFAULT_URL, DATA_DIR, APP_DIR, DEFAULT_PORT } from "../constants.js";
import { log } from "../utils/logger.js";

interface HealthCheck {
  name: string;
  status: "ok" | "warn" | "error";
  detail: string;
}

/**
 * `rudder health` — Run system health checks.
 * 
 * Checks: databases, Ollama, disk space, Node version, port availability.
 */
export async function healthCommand() {
  log.section("System Health Check");
  log.br();

  const checks: HealthCheck[] = [];

  // 1. Data directory
  if (fs.existsSync(DATA_DIR)) {
    checks.push({ name: "Data directory", status: "ok", detail: DATA_DIR });
  } else {
    checks.push({ name: "Data directory", status: "error", detail: "Not found — run 'rudder setup'" });
  }

  // 2. Main database
  if (fs.existsSync(RUDDER_DB_PATH)) {
    const stat = fs.statSync(RUDDER_DB_PATH);
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
    checks.push({ name: "rudder.db", status: "ok", detail: `${sizeMB} MB` });
  } else {
    checks.push({ name: "rudder.db", status: "error", detail: "Not found" });
  }

  // 3. Ollama
  const ollamaUrl = process.env.OLLAMA_URL || OLLAMA_DEFAULT_URL;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json() as { models?: any[] };
      const modelCount = data.models?.length || 0;
      checks.push({ name: "Ollama", status: "ok", detail: `${modelCount} model(s) at ${ollamaUrl}` });
    } else {
      checks.push({ name: "Ollama", status: "warn", detail: `Responded ${res.status} at ${ollamaUrl}` });
    }
  } catch {
    checks.push({ name: "Ollama", status: "warn", detail: `Not reachable at ${ollamaUrl}` });
  }

  // 4. Node version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1));
  if (major >= 20) {
    checks.push({ name: "Node.js", status: "ok", detail: nodeVersion });
  } else {
    checks.push({ name: "Node.js", status: "warn", detail: `${nodeVersion} (recommend v20+)` });
  }

  // 5. App directory
  const nextConfig = [
    "next.config.ts", "next.config.js", "next.config.mjs"
  ].some(f => fs.existsSync(`${APP_DIR}/${f}`));

  if (nextConfig) {
    checks.push({ name: "Next.js app", status: "ok", detail: APP_DIR });
  } else {
    checks.push({ name: "Next.js app", status: "error", detail: "Not found at expected path" });
  }

  // 6. Port availability
  try {
    const net = await import("net");
    const inUse = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(true));
      server.once("listening", () => {
        server.close();
        resolve(false);
      });
      server.listen(DEFAULT_PORT);
    });

    if (inUse) {
      checks.push({ name: `Port ${DEFAULT_PORT}`, status: "ok", detail: "In use (Rudder running)" });
    } else {
      checks.push({ name: `Port ${DEFAULT_PORT}`, status: "ok", detail: "Available" });
    }
  } catch {
    checks.push({ name: `Port ${DEFAULT_PORT}`, status: "warn", detail: "Unable to check" });
  }

  // 7. Disk space (macOS)
  try {
    const { execSync } = await import("child_process");
    const output = execSync("df -h /", { encoding: "utf-8" });
    const lines = output.trim().split("\n");
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      const available = parts[3];
      const capacity = parts[4];
      const pctUsed = parseInt(capacity);
      const status = pctUsed > 90 ? "error" : pctUsed > 80 ? "warn" : "ok";
      checks.push({ name: "Disk space", status, detail: `${available} free (${capacity} used)` });
    }
  } catch {
    // Skip disk check on failure
  }

  // Print results
  const icons = {
    ok: chalk.green("✔"),
    warn: chalk.yellow("⚠"),
    error: chalk.red("✖"),
  };

  for (const check of checks) {
    console.log(`   ${icons[check.status]} ${check.name.padEnd(20)} ${chalk.dim(check.detail)}`);
  }

  log.br();

  const errors = checks.filter((c) => c.status === "error");
  const warns = checks.filter((c) => c.status === "warn");

  if (errors.length > 0) {
    log.error(`${errors.length} critical issue(s) found`);
  } else if (warns.length > 0) {
    log.warn(`${warns.length} warning(s) — system operational`);
  } else {
    log.success("All systems nominal");
  }
}
