import test from "node:test";
import assert from "node:assert";
import { getDB } from "./db";

/* ═══════════════════════════════════════════════════════
   Database Schema & Migration Hardening Tests
   ═══════════════════════════════════════════════════════ */

test("db: check table existence and schemas", () => {
  const db = getDB();
  
  const tables = [
    "identity_profile",
    "identity_values",
    "journal_entries",
    "tasks",
    "calendar_events",
    "health_metrics",
    "health_records",
    "reality_nodes",
    "user_preferences",
    "search_index"
  ];
  
  for (const table of tables) {
    const info = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
    assert.ok(info, `Table [${table}] should exist in database`);
  }
});

test("db: check identity_profile singleton constraint", () => {
  const db = getDB();
  
  // Trying to insert a second row with id = 2 should fail due to id = 1 check constraint
  assert.throws(() => {
    db.prepare(`
      INSERT INTO identity_profile (id, display_name) 
      VALUES (2, 'Malicious Twin')
    `).run();
  }, /CHECK constraint failed/, "Should prevent inserting id != 1");
  
  // Profile row 1 should already exist
  const row = db.prepare("SELECT id, display_name FROM identity_profile WHERE id = 1").get() as { id: number; display_name: string } | undefined;
  assert.ok(row, "Profile row 1 should exist");
});

test("db: check reality_nodes primary key constraint", () => {
  const db = getDB();
  const testId = "test_unique_event_id";
  
  // Clean up any stale test entries
  db.prepare("DELETE FROM reality_nodes WHERE event_id = ?").run(testId);
  
  // Insert initial
  db.prepare(`
    INSERT INTO reality_nodes (event_id, when_timestamp, what_classification, origin_provenance)
    VALUES (?, datetime('now'), 'TestEvent', 'test_suite')
  `).run(testId);
  
  // Attempt to insert duplicate event_id should fail
  assert.throws(() => {
    db.prepare(`
      INSERT INTO reality_nodes (event_id, when_timestamp, what_classification, origin_provenance)
      VALUES (?, datetime('now'), 'DuplicateTestEvent', 'test_suite')
    `).run(testId);
  }, /UNIQUE constraint failed: reality_nodes.event_id/, "Should enforce unique event_id constraint");
  
  // Clean up
  db.prepare("DELETE FROM reality_nodes WHERE event_id = ?").run(testId);
});

test("db: verify user preferences default settings", () => {
  const db = getDB();
  const prefs = db.prepare("SELECT * FROM user_preferences WHERE id = 1").get() as Record<string, unknown> & {
    theme: string;
    enabled_modules: string;
    default_execution_mode: string;
    fallback_execution_mode: string;
    tts_provider: string;
  };
  
  assert.ok(prefs, "Preferences row 1 should exist");
  assert.strictEqual(prefs.theme, "dark", "Default theme should be 'dark'");
  assert.ok(prefs.enabled_modules.includes("identity"), "Default enabled modules should contain identity");
  assert.strictEqual(prefs.default_execution_mode, "local_ollama", "Default execution mode should be local_ollama");
  assert.strictEqual(prefs.fallback_execution_mode, "cloud_gemini", "Fallback execution mode should be cloud_gemini");
  
  // Verify new voice & avatar columns
  assert.strictEqual(prefs.tts_provider, "native", "Default tts_provider should be 'native'");
  assert.ok("tts_endpoint" in prefs, "Preferences should have tts_endpoint column");
  assert.ok("tts_ref_audio" in prefs, "Preferences should have tts_ref_audio column");
  assert.ok("comfy_endpoint" in prefs, "Preferences should have comfy_endpoint column");
  assert.ok("avatar_portrait_path" in prefs, "Preferences should have avatar_portrait_path column");
});
