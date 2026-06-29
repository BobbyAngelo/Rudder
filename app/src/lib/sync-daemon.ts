import * as fs from "fs";
import * as path from "path";
import { getDB } from "./db";
import * as crypto from "crypto";

/* ═══════════════════════════════════════════════════════
   Sync Daemon — Dynamic Folder Watcher and Parser
   ═══════════════════════════════════════════════════════ */

const ROOT_DIR = path.resolve(process.cwd(), "..");
const SYNC_DIR = path.join(ROOT_DIR, "data", "sync");
const TYPEWRITER_DIR = path.join(SYNC_DIR, "typewriter");
const HEALTH_DIR = path.join(SYNC_DIR, "health");
const DEVICES_DIR = path.join(SYNC_DIR, "devices");
const CORRESPONDENCE_DIR = path.join(SYNC_DIR, "correspondence");
const CHAT_DIR = path.join(SYNC_DIR, "chat");

// Ensure default sync directories exist
[TYPEWRITER_DIR, HEALTH_DIR, DEVICES_DIR, CORRESPONDENCE_DIR, CHAT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[sync-daemon] Created directory: ${dir}`);
  }
});

const db = getDB();

// Seed default data sources if table is empty
try {
  const count = db.prepare("SELECT count(*) as count FROM data_sources").get() as { count: number };
  if (count.count === 0 || count.count === 2 || count.count === 3 || count.count === 4 || count.count === 5) {
    db.prepare(`
      INSERT OR IGNORE INTO data_sources (name, path, type, status)
      VALUES ('Typewriter Logs', ?, 'folder', 'active')
    `).run(TYPEWRITER_DIR);
    
    db.prepare(`
      INSERT OR IGNORE INTO data_sources (name, path, type, status)
      VALUES ('Apple Health Exports', ?, 'healthkit_export', 'active')
    `).run(HEALTH_DIR);

    db.prepare(`
      INSERT OR IGNORE INTO data_sources (name, path, type, status)
      VALUES ('Hardware Device Captures', ?, 'device_capture', 'active')
    `).run(DEVICES_DIR);

    db.prepare(`
      INSERT OR IGNORE INTO data_sources (name, path, type, status)
      VALUES ('Correspondence Inbox', ?, 'correspondence', 'active')
    `).run(CORRESPONDENCE_DIR);

    db.prepare(`
      INSERT OR IGNORE INTO data_sources (name, path, type, status)
      VALUES ('AI Chat Exports', ?, 'chat_export', 'active')
    `).run(CHAT_DIR);
    
    console.log("[sync-daemon] Seeded default data sources in database.");
  }
} catch (err: any) {
  console.error(`[sync-daemon] Seeding data sources failed: ${err.message}`);
}

console.log("[sync-daemon] Sync daemon successfully initialized.");

/**
 * Parses a CSV line respecting quoted strings containing commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse ICS files and insert events into calendar_events
 */
function parseICS(filePath: string): number {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  
  let importCount = 0;
  let currentEvent: any = null;

  db.transaction(() => {
    const insertStmt = db.prepare(`
      INSERT INTO calendar_events (title, description, start_date, start_time, all_day, location, color, category)
      VALUES (?, ?, ?, ?, ?, ?, '#34d399', 'personal')
    `);

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "BEGIN:VEVENT") {
        currentEvent = {
          title: "Untitled Event",
          description: "",
          start_date: "",
          start_time: null,
          all_day: 1,
          location: ""
        };
      } else if (trimmed === "END:VEVENT" && currentEvent) {
        if (currentEvent.start_date) {
          insertStmt.run(
            currentEvent.title,
            currentEvent.description,
            currentEvent.start_date,
            currentEvent.start_time,
            currentEvent.all_day,
            currentEvent.location
          );
          importCount++;
        }
        currentEvent = null;
      } else if (currentEvent) {
        const colonIdx = trimmed.indexOf(":");
        if (colonIdx === -1) continue;
        const key = trimmed.slice(0, colonIdx).split(";")[0];
        const val = trimmed.slice(colonIdx + 1);

        if (key === "SUMMARY") {
          currentEvent.title = val;
        } else if (key === "DESCRIPTION") {
          currentEvent.description = val.replace(/\\n/g, "\n");
        } else if (key === "LOCATION") {
          currentEvent.location = val;
        } else if (key === "DTSTART") {
          // Format DTSTART: e.g. 20260629T120000 or 20260629
          if (val.includes("T")) {
            const parts = val.split("T");
            currentEvent.start_date = `${parts[0].slice(0, 4)}-${parts[0].slice(4, 6)}-${parts[0].slice(6, 8)}`;
            currentEvent.start_time = `${parts[1].slice(0, 2)}:${parts[1].slice(2, 4)}`;
            currentEvent.all_day = 0;
          } else {
            currentEvent.start_date = `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
            currentEvent.start_time = null;
            currentEvent.all_day = 1;
          }
        }
      }
    }
  })();

  return importCount;
}

/**
 * Process typewriter journals (.md)
 */
function processMarkdown(filePath: string, file: string, processedDir: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const title = file.replace(/\.md$/, "").replace(/[_-]/g, " ");
  
  db.transaction(() => {
    const journalStmt = db.prepare(`
      INSERT INTO journal_entries (title, content, mode, word_count, tags)
      VALUES (?, ?, 'journal', ?, '["sync"]')
    `);
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const result = journalStmt.run(title, content, wordCount);
    const entryId = result.lastInsertRowid;

    const eventId = `typewriter_${crypto.randomUUID()}`;
    const nowStr = new Date().toISOString();
    const ledgerStmt = db.prepare(`
      INSERT INTO reality_nodes (
        event_id, when_timestamp, what_classification, why_insight, 
        origin_provenance, artifact_id, raw_blob
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    ledgerStmt.run(
      eventId,
      nowStr,
      "Typewriter Log",
      `Imported journal entry: ${title}`,
      "typewriter_sync",
      String(entryId),
      JSON.stringify({ filename: file, word_count: wordCount })
    );
  })();

  console.log(`[sync-daemon] ✅ Processed markdown log: ${file}`);
  fs.renameSync(filePath, path.join(processedDir, file));
}

/**
 * Process health records (.csv)
 */
function processCSV(filePath: string, file: string, processedDir: string) {
  const rawContent = fs.readFileSync(filePath, "utf-8");
  const lines = rawContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  if (lines.length < 2) {
    console.warn(`[sync-daemon] CSV file ${file} is empty or has no header.`);
    fs.renameSync(filePath, path.join(processedDir, file));
    return;
  }

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  const typeIdx = headers.indexOf("type");
  const valueIdx = headers.indexOf("value");
  const unitIdx = headers.indexOf("unit");
  const sourceIdx = headers.indexOf("source");
  const startDateIdx = headers.indexOf("startdate");
  const endDateIdx = headers.indexOf("enddate");
  const dateIdx = headers.indexOf("date");

  if (typeIdx === -1 || valueIdx === -1 || startDateIdx === -1) {
    console.error(`[sync-daemon] ❌ CSV headers in ${file} must include at least 'type', 'value', and 'startDate'`);
    return;
  }

  let importCount = 0;
  db.transaction(() => {
    const insertStmt = db.prepare(`
      INSERT INTO health_records (type, value, unit, category_value, source, start_date, end_date, date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      if (cells.length < Math.max(typeIdx, valueIdx, startDateIdx) + 1) continue;

      const type = cells[typeIdx];
      const rawVal = cells[valueIdx];
      const unit = unitIdx !== -1 ? cells[unitIdx] : "";
      const source = sourceIdx !== -1 ? cells[sourceIdx] : "Apple Health";
      const startDate = cells[startDateIdx];
      const endDate = endDateIdx !== -1 ? cells[endDateIdx] : startDate;
      
      let dateVal = dateIdx !== -1 ? cells[dateIdx] : "";
      if (!dateVal) {
        dateVal = startDate.split(/[T ]/)[0];
      }

      let numericVal: number | null = parseFloat(rawVal);
      let categoryVal: string | null = null;
      if (isNaN(numericVal)) {
        numericVal = null;
        categoryVal = rawVal;
      }

      insertStmt.run(type, numericVal, unit, categoryVal, source, startDate, endDate, dateVal);
      importCount++;
    }
  })();

  console.log(`[sync-daemon] ✅ Processed health logs: ${file}. Imported ${importCount} records.`);
  fs.renameSync(filePath, path.join(processedDir, file));
}

/**
 * Process iCalendar events (.ics)
 */
function processICS(filePath: string, file: string, processedDir: string) {
  try {
    const count = parseICS(filePath);
    console.log(`[sync-daemon] ✅ Processed calendar export: ${file}. Imported ${count} events.`);
    fs.renameSync(filePath, path.join(processedDir, file));
  } catch (err: any) {
    console.error(`[sync-daemon] ❌ Error processing calendar export [${file}]: ${err.message}`);
  }
}

/**
 * Process audio WAV files (.wav) from approved hardware captures
 */
async function processWAV(filePath: string, file: string, processedDir: string) {
  try {
    const title = file.replace(/\.wav$/, "").replace(/[_-]/g, " ");
    
    // Perform transcription (using a mock Whisper model fallback if local API is missing)
    let transcriptText = "";
    try {
      const res = await fetch("http://localhost:5000/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath }),
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        transcriptText = data.text || "";
      }
    } catch {
      transcriptText = `Voice Capture: [Mock transcription for ${file} regarding external hardware device, sequence development, or notes captured in the field.]`;
    }

    if (!transcriptText) {
      transcriptText = `Voice Capture: [Empty transcription for ${file}].`;
    }

    db.transaction(() => {
      // Insert into journal_entries
      const journalStmt = db.prepare(`
        INSERT INTO journal_entries (title, content, mode, word_count, tags)
        VALUES (?, ?, 'journal', ?, '["voice", "sync"]')
      `);
      const wordCount = transcriptText.split(/\s+/).filter(Boolean).length;
      const result = journalStmt.run(title, transcriptText, wordCount);
      const entryId = result.lastInsertRowid;

      // Insert into reality_nodes
      const eventId = `device_voice_${crypto.randomUUID()}`;
      const nowStr = new Date().toISOString();
      const ledgerStmt = db.prepare(`
        INSERT INTO reality_nodes (
          event_id, when_timestamp, what_classification, why_insight, 
          origin_provenance, artifact_id, raw_blob
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      ledgerStmt.run(
        eventId,
        nowStr,
        "Voice Capture",
        `Imported transcribed audio: ${title}`,
        "device_sync",
        String(entryId),
        JSON.stringify({ filename: file, transcript: transcriptText })
      );
    })();

    console.log(`[sync-daemon] ✅ Processed voice log: ${file}`);
    fs.renameSync(filePath, path.join(processedDir, file));
  } catch (err: any) {
    console.error(`[sync-daemon] ❌ Error processing voice log [${file}]: ${err.message}`);
  }
}

/**
 * Process device JSON logs (.json) containing sensor telemetry
 */
function processDeviceJSON(filePath: string, file: string, processedDir: string) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    // If it contains health/biometric metrics, insert into health_records
    if (data.type && data.value !== undefined) {
      const nowStr = new Date().toISOString();
      const dateVal = nowStr.split("T")[0];
      
      let numericVal: number | null = parseFloat(data.value);
      let categoryVal: string | null = null;
      if (isNaN(numericVal)) {
        numericVal = null;
        categoryVal = String(data.value);
      }

      db.prepare(`
        INSERT INTO health_records (type, value, unit, category_value, source, start_date, end_date, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.type,
        numericVal,
        data.unit || "",
        categoryVal,
        data.source || "External Device",
        data.timestamp || nowStr,
        data.timestamp || nowStr,
        dateVal
      );
      
      console.log(`[sync-daemon] ✅ Ingested device metric: ${data.type} = ${data.value}`);
    } else {
      // General telemetry log - save to reality_nodes
      const eventId = `device_telemetry_${crypto.randomUUID()}`;
      const nowStr = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO reality_nodes (
          event_id, when_timestamp, what_classification, why_insight, 
          origin_provenance, raw_blob
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        eventId,
        nowStr,
        "Device Telemetry",
        `Ingested sensor log from: ${data.device_name || "Hardware Device"}`,
        "device_sync",
        raw
      );
      
      console.log(`[sync-daemon] ✅ Ingested device telemetry log: ${file}`);
    }
    
    fs.renameSync(filePath, path.join(processedDir, file));
  } catch (err: any) {
    console.error(`[sync-daemon] ❌ Error processing device JSON [${file}]: ${err.message}`);
  }
}

/**
 * Process incoming correspondence logs (.json or .md)
 */
function processCorrespondence(filePath: string, file: string, processedDir: string) {
  try {
    let sender = "";
    let recipient = "";
    let subject = "";
    let body = "";
    let platform = "email";
    let direction = "incoming";
    let createdAt = new Date().toISOString();

    if (file.endsWith(".json")) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      sender = data.sender || "";
      recipient = data.recipient || "robert@celf.os";
      subject = data.subject || "No Subject";
      body = data.body || "";
      platform = data.platform || "email";
      direction = data.direction || "incoming";
      if (data.created_at) createdAt = data.created_at;
    } else if (file.endsWith(".md")) {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split(/\r?\n/);
      let yamlMode = false;
      let bodyLines: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === "---") {
          yamlMode = !yamlMode;
          continue;
        }

        if (yamlMode) {
          const colonIdx = line.indexOf(":");
          if (colonIdx !== -1) {
            const key = line.slice(0, colonIdx).trim().toLowerCase();
            const val = line.slice(colonIdx + 1).trim();
            if (key === "sender") sender = val;
            else if (key === "recipient") recipient = val;
            else if (key === "subject") subject = val;
            else if (key === "platform") platform = val;
            else if (key === "direction") direction = val;
            else if (key === "created_at" || key === "date") createdAt = val;
          }
        } else {
          bodyLines.push(line);
        }
      }
      body = bodyLines.join("\n").trim();
    }

    if (!sender || !body) {
      console.warn(`[sync-daemon] Skipping correspondence log ${file} (missing sender or body)`);
      fs.renameSync(filePath, path.join(processedDir, file));
      return;
    }

    db.prepare(`
      INSERT INTO correspondence (sender, recipient, subject, body, platform, direction, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sender, recipient, subject, body, platform, direction, createdAt);

    console.log(`[sync-daemon] ✅ Ingested correspondence: from ${sender} on ${platform}`);
    fs.renameSync(filePath, path.join(processedDir, file));
  } catch (err: any) {
    console.error(`[sync-daemon] ❌ Error processing correspondence [${file}]: ${err.message}`);
  }
}

/**
 * Process chat history exports (.json) from ChatGPT or Claude
 */
function processChatExport(filePath: string, file: string, processedDir: string) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
      console.warn(`[sync-daemon] Skipping chat export ${file}: JSON is not a conversation array.`);
      fs.renameSync(filePath, path.join(processedDir, file));
      return;
    }

    let chatgptCount = 0;
    let claudeCount = 0;

    db.transaction(() => {
      const journalStmt = db.prepare(`
        INSERT INTO journal_entries (title, content, mode, word_count, tags)
        VALUES (?, ?, 'note', ?, ?)
      `);

      for (const conv of data) {
        if (!conv) continue;

        // 1. Detect ChatGPT format: has 'mapping'
        if (conv.mapping && typeof conv.mapping === "object") {
          const title = conv.title || "Untitled ChatGPT Chat";
          const mdLines: string[] = [`# ${title}\n`];
          
          // Reconstruct conversation turns from mapping nodes
          const nodes = Object.values(conv.mapping) as any[];
          // Sort nodes by creation time if available
          nodes.sort((a, b) => (a.message?.create_time || 0) - (b.message?.create_time || 0));

          for (const node of nodes) {
            const msg = node.message;
            if (msg && msg.content && msg.content.parts) {
              const role = msg.author?.role || "user";
              const text = msg.content.parts.join("\n").trim();
              if (text) {
                const displayName = role === "user" ? "User" : role === "assistant" ? "Assistant" : role;
                mdLines.push(`**${displayName}**: ${text}\n`);
              }
            }
          }

          if (mdLines.length > 1) {
            const content = mdLines.join("\n");
            const wordCount = content.split(/\s+/).filter(Boolean).length;
            journalStmt.run(title, content, wordCount, '["chat-export", "chatgpt"]');
            chatgptCount++;
          }
        } 
        // 2. Detect Claude format: has 'chat_messages' or 'messages'
        else if (Array.isArray(conv.chat_messages) || Array.isArray(conv.messages)) {
          const title = conv.name || conv.title || "Untitled Claude Chat";
          const mdLines: string[] = [`# ${title}\n`];
          const messages = conv.chat_messages || conv.messages;

          for (const msg of messages) {
            const sender = msg.sender || msg.author || "user";
            const text = msg.text || msg.content || "";
            if (text) {
              const displayName = sender === "user" ? "User" : sender === "assistant" ? "Assistant" : sender;
              mdLines.push(`**${displayName}**: ${text}\n`);
            }
          }

          if (mdLines.length > 1) {
            const content = mdLines.join("\n");
            const wordCount = content.split(/\s+/).filter(Boolean).length;
            journalStmt.run(title, content, wordCount, '["chat-export", "claude"]');
            claudeCount++;
          }
        }
      }
    })();

    if (chatgptCount > 0) {
      console.log(`[sync-daemon] ✅ Ingested ChatGPT export: ${file}. Imported ${chatgptCount} chats.`);
    }
    if (claudeCount > 0) {
      console.log(`[sync-daemon] ✅ Ingested Claude export: ${file}. Imported ${claudeCount} chats.`);
    }
    if (chatgptCount === 0 && claudeCount === 0) {
      console.warn(`[sync-daemon] No valid conversations parsed from chat export: ${file}`);
    }

    fs.renameSync(filePath, path.join(processedDir, file));
  } catch (err: any) {
    console.error(`[sync-daemon] ❌ Error processing chat export [${file}]: ${err.message}`);
  }
}

/**
 * Scan a single registered data source directory
 */
function scanSource(source: { id: number; name: string; path: string; type: string }) {
  const dirPath = source.path;
  if (!fs.existsSync(dirPath)) {
    console.warn(`[sync-daemon] ⚠️ Directory for source "${source.name}" does not exist: ${dirPath}`);
    return;
  }

  const processedDir = path.join(dirPath, "processed");
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  const files = fs.readdirSync(dirPath).filter(f => {
    const full = path.join(dirPath, f);
    return fs.statSync(full).isFile();
  });

  let processedCount = 0;
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    
    if (file.endsWith(".md") && source.type === "folder") {
      processMarkdown(filePath, file, processedDir);
      processedCount++;
    } else if (file.endsWith(".csv") && source.type === "healthkit_export") {
      processCSV(filePath, file, processedDir);
      processedCount++;
    } else if (file.endsWith(".ics")) {
      processICS(filePath, file, processedDir);
      processedCount++;
    } else if (file.endsWith(".wav") && source.type === "device_capture") {
      processWAV(filePath, file, processedDir);
      processedCount++;
    } else if (file.endsWith(".json") && source.type === "device_capture") {
      processDeviceJSON(filePath, file, processedDir);
      processedCount++;
    } else if ((file.endsWith(".json") || file.endsWith(".md")) && source.type === "correspondence") {
      processCorrespondence(filePath, file, processedDir);
      processedCount++;
    } else if (file.endsWith(".json") && source.type === "chat_export") {
      processChatExport(filePath, file, processedDir);
      processedCount++;
    }
  }

  // Update last_scanned timestamp in DB
  const nowStr = new Date().toISOString();
  db.prepare("UPDATE data_sources SET last_scanned = ? WHERE id = ?").run(nowStr, source.id);
}

/**
 * Main polling tick function
 */
function tick() {
  try {
    // Query active folders/data sources from database
    const activeSources = db.prepare("SELECT id, name, path, type FROM data_sources WHERE status = 'active'").all() as any[];
    
    for (const source of activeSources) {
      scanSource(source);
    }
  } catch (err: any) {
    console.error(`[sync-daemon] Sync daemon error in loop: ${err.message}`);
  }
}

// Running continuous tick every 5 seconds
const intervalId = setInterval(tick, 5000);
tick();

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[sync-daemon] Shutting down sync daemon...");
  clearInterval(intervalId);
  process.exit(0);
});
