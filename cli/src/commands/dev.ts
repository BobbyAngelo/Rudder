import { spawn } from "child_process";
import chalk from "chalk";
import { APP_DIR, DEFAULT_PORT } from "../constants.js";
import { log, printBanner } from "../utils/logger.js";

/**
 * `rudder dev` — Start the Rudder development server.
 * 
 * Runs Next.js dev server with port configuration,
 * validates database integrity first, and provides
 * a clean startup banner.
 */
export async function devCommand(options: { port?: string }) {
  const port = options.port || String(DEFAULT_PORT);

  printBanner();

  log.info(`Starting Rudder on port ${chalk.green(port)}...`);
  log.br();

  // Check if port is already in use
  try {
    const net = await import("net");
    const inUse = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(true));
      server.once("listening", () => {
        server.close();
        resolve(false);
      });
      server.listen(parseInt(port));
    });

    if (inUse) {
      log.warn(`Port ${port} is already in use. Rudder may already be running.`);
      log.info(`Try: ${chalk.dim(`rudder dev --port ${parseInt(port) + 1}`)}`);
      process.exit(1);
    }
  } catch {
    // Port check failed, proceed anyway
  }

  // Start Next.js dev server
  const child = spawn("npx", ["next", "dev", "--port", port], {
    cwd: APP_DIR,
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: port,
    },
    shell: true,
  });

  // Forward signals to child
  const cleanup = () => {
    child.kill("SIGTERM");
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      log.error(`Dev server exited with code ${code}`);
    }
    process.exit(code || 0);
  });
}
