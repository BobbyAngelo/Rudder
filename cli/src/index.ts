#!/usr/bin/env node

/**
 * Rudder CLI — Sovereign Life Operating System
 * 
 * Usage:
 *   rudder dev              Start the development server
 *   rudder health           Run system health checks
 *   rudder db status        Show database inventory and stats
 *   rudder db backup        Backup all databases
 * 
 * Run from anywhere inside the Rudder project:
 *   npx tsx cli/src/index.ts [command]
 */

import { Command } from "commander";
import { VERSION } from "./constants.js";
import { printBanner } from "./utils/logger.js";

const program = new Command();

program
  .name("rudder")
  .description("Sovereign Life Operating System — CLI")
  .version(VERSION)
  .hook("preAction", () => {
    // Banner shown before every command
  });

// ── rudder dev ──
program
  .command("dev")
  .description("Start Rudder development server")
  .option("-p, --port <port>", "Port number", "3100")
  .action(async (options) => {
    const { devCommand } = await import("./commands/dev.js");
    await devCommand(options);
  });

// ── rudder health ──
program
  .command("health")
  .description("Run system health checks (DBs, Ollama, disk, Node)")
  .action(async () => {
    const { healthCommand } = await import("./commands/health.js");
    await healthCommand();
  });

// ── rudder sync ──
program
  .command("sync")
  .description("Scan registered data sources and ingest into the Reality Ledger")
  .option("-w, --watch", "Keep running and re-scan on interval")
  .option("-i, --interval <seconds>", "Seconds between re-scans (default: 300)", "300")
  .action(async (options) => {
    const { syncCommand } = await import("./commands/sync.js");
    await syncCommand({
      watch: options.watch,
      interval: parseInt(options.interval, 10),
    });
  });

// ── rudder db ──
const db = program
  .command("db")
  .description("Database management commands");

db.command("status")
  .description("Show database inventory, table counts, and migration history")
  .option("-v, --verbose", "Show tables for all databases, not just main")
  .action(async (options) => {
    const { dbStatusCommand } = await import("./commands/db/status.js");
    dbStatusCommand(options);
  });

db.command("backup")
  .description("Snapshot all databases to data/backups/")
  .action(async () => {
    const { dbBackupCommand } = await import("./commands/db/backup.js");
    dbBackupCommand();
  });

// ── rudder import ──
program
  .command("import <importer> [args...]")
  .allowUnknownOption()
  .description("Run a specific data importer (migrate, linkedin, health, writing, scan-tars, outlook)")
  .action(async (importer, args) => {
    const { importCommand } = await import("./commands/import.js");
    await importCommand(importer, args || []);
  });

// ── rudder (no command) ──
program.action(() => {
  printBanner();
  program.help();
});

program.parse();
