#!/usr/bin/env node

/**
 * Rudder CLI — Sovereign Life Operating System
 * 
 * Usage:
 *   rudder dev              Start the development server
 *   rudder health           Run system health checks
 *   rudder db status        Show database inventory and stats
 *   rudder db backup        Backup all databases
 *   rudder add [input]      NLP parse and add a task/event
 *   rudder task [input]     Force-add a task
 *   rudder event [input]    Force-add a calendar event
 *   rudder search [query]   Search FTS5 database across all domains
 *   rudder backup           Run a full WAL-safe ZIP backup
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
  .option("-p, --port <port>", "Port of the Rudder server", "3000")
  .action(async (options) => {
    const { syncCommand } = await import("./commands/sync.js");
    await syncCommand({
      watch: options.watch,
      interval: parseInt(options.interval, 10),
      port: options.port,
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
  .description("Run a specific data importer (migrate, linkedin, health, writing, scan-tars, outlook, chatgpt, claude, calendar, contacts, browser, bookmarks, todoist)")
  .action(async (importer, args) => {
    const { importCommand } = await import("./commands/import.js");
    await importCommand(importer, args || []);
  });

// ── rudder add ──
program
  .command("add <input>")
  .description("NLP parse and add a task or calendar event")
  .option("-p, --port <port>", "Port of the Rudder server", "3000")
  .action(async (input, options) => {
    const { addCommand } = await import("./commands/add.js");
    await addCommand(input, { port: options.port });
  });

// ── rudder task ──
program
  .command("task <input>")
  .description("Parse and force-add an incomplete task")
  .option("-p, --port <port>", "Port of the Rudder server", "3000")
  .action(async (input, options) => {
    const { addCommand } = await import("./commands/add.js");
    await addCommand(input, { port: options.port, forceType: "task" });
  });

// ── rudder event ──
program
  .command("event <input>")
  .description("Parse and force-add a calendar event")
  .option("-p, --port <port>", "Port of the Rudder server", "3000")
  .action(async (input, options) => {
    const { addCommand } = await import("./commands/add.js");
    await addCommand(input, { port: options.port, forceType: "event" });
  });

// ── rudder search ──
program
  .command("search <query>")
  .description("Search global FTS5 virtual index across all domains")
  .option("-p, --port <port>", "Port of the Rudder server", "3000")
  .action(async (query, options) => {
    const { searchCommand } = await import("./commands/search.js");
    await searchCommand(query, { port: options.port });
  });

// ── rudder backup ──
program
  .command("backup")
  .description("Execute a full WAL-safe ZIP backup")
  .option("-p, --port <port>", "Port of the Rudder server", "3000")
  .action(async (options) => {
    const { backupCommand } = await import("./commands/backup.js");
    await backupCommand({ port: options.port });
  });

// ── rudder mcp ──
program
  .command("mcp")
  .description("Start the Rudder MCP server on stdio for external AI models")
  .action(async () => {
    const { mcpCommand } = await import("./commands/mcp.js");
    await mcpCommand();
  });

// ── rudder (no command) ──
program.action(() => {
  printBanner();
  program.help();
});

program.parse();
