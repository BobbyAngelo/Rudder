import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import readline from "readline";
import crypto from "crypto";

/* ═══════════════════════════════════════════════════════
   Rudder MCP Server — rudder-mcp.ts
   
   Zero-dependency stdio JSON-RPC 2.0 Model Context Protocol 
   Server. Connects directly to RUDDER's SQLite database to 
   expose private life-memory, task management, calendar events, 
   and identity profile to external models.
   
   Usage (Register in Claude Desktop config):
     node --import tsx /Users/sovereign/Developer/Rudder/scripts/rudder-mcp.ts
   ═══════════════════════════════════════════════════════ */

const ROOT = path.resolve(__dirname, "..");
const RUDDER_DB_PATH = path.join(ROOT, "data", "rudder.db");

// Open database connection
let db: Database.Database;
try {
  db = new Database(RUDDER_DB_PATH);
  db.pragma("journal_mode = WAL");
} catch (err: any) {
  process.stderr.write(`[rudder-mcp] Error opening database: ${err.message}\n`);
  process.exit(1);
}

/**
 * Clean search query helper matching CLI behavior
 */
function cleanSearchQuery(q: string): string {
  const clean = q.replace(/["'\\\/*:|~+<>]/g, " ").trim();
  const terms = clean.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return "";
  return terms.map(term => `"${term}"*`).join(" AND ");
}

/**
 * Standard input listener (stdio protocol)
 */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    const request = JSON.parse(line);
    const response = await handleRequest(request);
    if (response) {
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  } catch (err: any) {
    const errResponse = {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: `Parse error: ${err.message}`
      }
    };
    process.stdout.write(JSON.stringify(errResponse) + "\n");
  }
});

/**
 * Main JSON-RPC request router
 */
async function handleRequest(req: any): Promise<any> {
  const { method, params, id } = req;
  
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {}
        },
        serverInfo: {
          name: "rudder-mcp-server",
          version: "1.0.0"
        }
      }
    };
  }

  // ── Resources Listing ──
  if (method === "resources/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        resources: [
          {
            uri: "rudder://identity",
            name: "Sovereign User Profile & Identity",
            description: "The user's declared core profile information, values, priorities, and life milestones.",
            mimeType: "text/plain"
          },
          {
            uri: "rudder://recent-journals",
            name: "Recent Journal Entries",
            description: "The last 5 journal writing entries saved in Rudder's journal database.",
            mimeType: "text/plain"
          }
        ]
      }
    };
  }

  // ── Resource Reading ──
  if (method === "resources/read") {
    const { uri } = params;
    try {
      let content = "";
      if (uri === "rudder://identity") {
        const profile = db.prepare("SELECT * FROM identity_profile WHERE id = 1").get() as any;
        const values = db.prepare("SELECT * FROM identity_values ORDER BY priority ASC").all() as any[];
        const milestones = db.prepare("SELECT * FROM identity_milestones ORDER BY date DESC").all() as any[];

        content += `👑 SOVEREIGN IDENTITY PROFILE\n`;
        if (profile) {
          content += `Name: ${profile.full_name || profile.display_name || "Sovereign User"}\n`;
          content += `Bio: ${profile.bio || "No bio set."}\n`;
          content += `Email: ${profile.email || "N/A"}\n`;
          content += `Location: ${profile.location || "N/A"} (${profile.timezone || "N/A"})\n\n`;
        }

        content += `🎯 CORE VALUES:\n`;
        if (values.length === 0) {
          content += `No core values registered yet.\n`;
        } else {
          values.forEach(v => {
            content += `- ${v.label}: ${v.description || ""}\n`;
          });
        }
        content += `\n`;

        content += `🏁 MILESTONES:\n`;
        if (milestones.length === 0) {
          content += `No life milestones recorded.\n`;
        } else {
          milestones.forEach(m => {
            content += `- [${m.date || "Unknown Date"}] [${m.category}] ${m.title}: ${m.description || ""}\n`;
          });
        }
      } 
      
      else if (uri === "rudder://recent-journals") {
        const entries = db.prepare("SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT 5").all() as any[];
        if (entries.length === 0) {
          content = "No journal entries found in database.";
        } else {
          content = entries.map(e => {
            return `📅 ${e.title} (${e.created_at})\n${e.content}\n\n════════════════════════════════════════\n`;
          }).join("\n");
        }
      } 
      
      else {
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32602,
            message: `Unknown resource URI: ${uri}`
          }
        };
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: "text/plain",
              text: content
            }
          ]
        }
      };
    } catch (err: any) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: `Failed to read resource: ${err.message}`
        }
      };
    }
  }

  // ── Tools Listing ──
  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "rudder_search_memory",
            description: "Search Rudder's global FTS5 search index across all domains (tasks, events, people, and journal writing logs). Use this to find specific context on topics, conversations, or entities.",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query terms (e.g., 'meeting with Bob', 'project planning notes')"
                }
              },
              required: ["query"]
            }
          },
          {
            name: "rudder_get_recent_nodes",
            description: "Retrieve recent observations, browser history visits, and ingested file entries from the 10D Reality Ledger event log.",
            inputSchema: {
              type: "object",
              properties: {
                limit: {
                  type: "integer",
                  description: "Maximum number of recent log nodes to return (default: 10, max: 50)"
                }
              }
            }
          },
          {
            name: "rudder_add_observation",
            description: "Ingest a new raw text/note observation node directly into Rudder's 10D Reality Ledger.",
            inputSchema: {
              type: "object",
              properties: {
                content: {
                  type: "string",
                  description: "The body of the observation note or record"
                },
                context: {
                  type: "string",
                  description: "Where or how this observation occurred (e.g. 'manual note', 'meeting note')"
                }
              },
              required: ["content"]
            }
          },
          {
            name: "rudder_add_task",
            description: "Add a new task directly into Rudder's scheduler database.",
            inputSchema: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Title of the task"
                },
                priority: {
                  type: "integer",
                  description: "Priority of the task (0=none, 1=low, 2=medium, 3=high, 4=urgent)"
                },
                due_date: {
                  type: "string",
                  description: "ISO due date (format YYYY-MM-DD)"
                }
              },
              required: ["title"]
            }
          },
          {
            name: "rudder_add_event",
            description: "Add a new calendar event directly into Rudder's calendar database.",
            inputSchema: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Title of the calendar event"
                },
                start_date: {
                  type: "string",
                  description: "ISO start date (format YYYY-MM-DD)"
                },
                start_time: {
                  type: "string",
                  description: "HH:MM format start time (optional, null indicates all-day event)"
                },
                location: {
                  type: "string",
                  description: "Event location details"
                }
              },
              required: ["title", "start_date"]
            }
          }
        ]
      }
    };
  }

  // ── Tools Calling ──
  if (method === "tools/call") {
    const { name, arguments: toolArgs } = params;
    
    try {
      let resultText = "";
      
      if (name === "rudder_search_memory") {
        const { query } = toolArgs;
        const cleanQ = cleanSearchQuery(query);

        if (!cleanQ) {
          resultText = "No valid search query terms found.";
        } else {
          const rows = db.prepare(`
            SELECT origin_id, origin_table, title, content, tags, rank
            FROM search_index 
            WHERE search_index MATCH ? 
            ORDER BY rank 
            LIMIT 20
          `).all(cleanQ) as any[];

          if (rows.length === 0) {
            resultText = `No records matching "${query}" found in memory.`;
          } else {
            resultText = `Found ${rows.length} records matching "${query}":\n\n` + rows.map(r => {
              let type = r.origin_table;
              let snippet = (r.content || "").replace(/[#*`_\[\]]/g, "").trim().slice(0, 150);
              return `📌 [${type.toUpperCase()}] ${r.title}\n  - Tags: ${r.tags || "None"}\n  - Snippet: "${snippet}..."\n`;
            }).join("\n");
          }
        }
      } 
      
      else if (name === "rudder_get_recent_nodes") {
        const limit = Math.min(toolArgs.limit || 10, 50);
        const rows = db.prepare(`
          SELECT event_id, when_timestamp, where_context, what_classification, why_insight, origin_provenance 
          FROM reality_nodes 
          ORDER BY when_timestamp DESC 
          LIMIT ?
        `).all(limit) as any[];

        if (rows.length === 0) {
          resultText = "Reality Ledger is currently empty.";
        } else {
          resultText = `Latest ${rows.length} observation nodes from Reality Ledger:\n\n` + rows.map(r => {
            return `🕒 [${r.when_timestamp}] [${r.what_classification}] (via ${r.origin_provenance})\n  - Context: ${r.where_context || "N/A"}\n  - Insight: "${r.why_insight || ""}"\n`;
          }).join("\n");
        }
      } 
      
      else if (name === "rudder_add_observation") {
        const { content, context } = toolArgs;
        const hash = crypto.createHash("sha256").update(content + Date.now()).digest("hex").slice(0, 16);
        const eventId = `mcp-obs-${hash}`;
        const now = new Date().toISOString().replace("T", " ").slice(0, 19);

        db.prepare(`
          INSERT INTO reality_nodes (
            event_id, when_timestamp, where_context, who_entities, what_classification, 
            why_insight, how_actions, state_vitals, gravity_score, origin_provenance, raw_blob
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          eventId,
          now,
          context || "MCP Server",
          "[]",
          "observation",
          content.slice(0, 200),
          JSON.stringify(["parse", "mcp"]),
          "{}",
          1,
          "mcp_client",
          content
        );

        resultText = `Successfully ingested observation node "${eventId}" into the Reality Ledger.`;
      } 
      
      else if (name === "rudder_add_task") {
        const { title, priority, due_date } = toolArgs;
        const now = new Date().toISOString().replace("T", " ").slice(0, 19);

        const res = db.prepare(`
          INSERT INTO tasks (
            title, description, status, priority, project_id, parent_id, due_date, created_at, updated_at
          ) VALUES (?, '', 'todo', ?, 1, NULL, ?, ?, ?)
        `).run(
          title,
          priority || 0,
          due_date || null,
          now,
          now
        );

        resultText = `Successfully added task "${title}" (ID: ${res.lastInsertRowid}, Priority: ${priority || 0}) to the scheduler.`;
      } 
      
      else if (name === "rudder_add_event") {
        const { title, start_date, start_time, location } = toolArgs;
        const now = new Date().toISOString().replace("T", " ").slice(0, 19);

        const res = db.prepare(`
          INSERT INTO calendar_events (
            title, description, start_date, start_time, all_day, location, color, category, created_at, updated_at
          ) VALUES (?, '', ?, ?, ?, ?, '#34d399', 'personal', ?, ?)
        `).run(
          title,
          start_date,
          start_time || null,
          start_time ? 0 : 1, // all-day if start_time is missing
          location || "",
          now,
          now
        );

        resultText = `Successfully added calendar event "${title}" (ID: ${res.lastInsertRowid}, Date: ${start_date}) to the calendar.`;
      } 
      
      else {
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Method not found: ${name}`
          }
        };
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: resultText
            }
          ]
        }
      };
      
    } catch (err: any) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: `Tool execution failed: ${err.message}`
        }
      };
    }
  }

  // Unknown method fallback
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`
    }
  };
}
