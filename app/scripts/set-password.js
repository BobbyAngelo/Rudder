#!/usr/bin/env node

/**
 * Rudder Password Setup
 * 
 * Usage: node scripts/set-password.js
 * 
 * Generates a bcrypt hash for your chosen password.
 * Copy the output to .env.local as RUDDER_PASSWORD_HASH
 */

const bcrypt = require("bcryptjs");
const readline = require("readline");
const crypto = require("crypto");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("\n╔═══════════════════════════════════════╗");
console.log("║     Rudder — Password Setup           ║");
console.log("╚═══════════════════════════════════════╝\n");

rl.question("Enter your password: ", async (password) => {
  if (!password || password.length < 6) {
    console.log("❌ Password must be at least 6 characters");
    rl.close();
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  const secret = crypto.randomBytes(32).toString("hex");

  console.log("\n✅ Password hash generated!\n");
  console.log("Add these to your .env.local file:\n");
  console.log("─────────────────────────────────────────");
  console.log(`RUDDER_PASSWORD_HASH=${hash}`);
  console.log(`RUDDER_SESSION_SECRET=${secret}`);
  console.log("─────────────────────────────────────────");
  console.log("\nRestart the dev server after updating .env.local\n");

  rl.close();
});
