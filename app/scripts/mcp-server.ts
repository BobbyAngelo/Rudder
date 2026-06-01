/* ═══════════════════════════════════════════════════════
   Rudder MCP server — exposes your sovereign memory to any MCP
   client (Claude Desktop, Cursor, …) over stdio. Zero-dependency
   JSON-RPC 2.0; the protocol surface is small and transparent.

   Tools:
     • search_memory(query, limit?) → relevant items from your local memory

   Run (usually launched by the MCP client):  npm run mcp
   Diagnostics go to stderr; stdout is the protocol channel only.
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../src/lib/db";
import { recall } from "../src/lib/memory";
import { ollamaEmbed } from "../src/lib/ollama";

const PROTOCOL_VERSION = "2024-11-05";
const embed = (t: string) => ollamaEmbed(t);

const TOOLS = [
  {
    name: "search_memory",
    description:
      "Search the user's private, local Rudder memory (their notes, calendar, health, people, and connected sources) and return the most relevant items with citations. Use this whenever a question depends on the user's own life/context.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural-language question or topic to recall." },
        limit: { type: "number", description: "Max results (default 6)." },
      },
      required: ["query"],
    },
  },
];

function send(msg: unknown) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}
function log(...args: unknown[]) {
  process.stderr.write("[rudder-mcp] " + args.map(String).join(" ") + "\n");
}
function result(id: unknown, res: unknown) {
  send({ jsonrpc: "2.0", id, result: res });
}
function error(id: unknown, code: number, message: string) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function searchMemory(query: string, limit: number) {
  const db = getDB();
  const { sources, chunks } = await recall(db, query, embed, { topN: limit });
  if (!sources.length) {
    return { content: [{ type: "text", text: "No relevant items found in the user's memory." }] };
  }
  const text = chunks
    .map((c, i) => {
      const s = sources[i];
      const meta = [s?.source, s?.date].filter(Boolean).join(" · ");
      return `[${i + 1}] ${c.title}${meta ? ` (${meta})` : ""}\n${c.content}`;
    })
    .join("\n\n");
  return { content: [{ type: "text", text }] };
}

async function handle(msg: any) {
  const { id, method, params } = msg;

  switch (method) {
    case "initialize":
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "rudder-memory", version: "1.0.0" },
      });
    case "notifications/initialized":
    case "initialized":
      return; // notification — no response
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, { tools: TOOLS });
    case "tools/call": {
      const name = params?.name;
      const args = params?.arguments ?? {};
      if (name !== "search_memory") return error(id, -32601, `Unknown tool: ${name}`);
      try {
        const res = await searchMemory(String(args.query ?? ""), Number(args.limit) || 6);
        return result(id, res);
      } catch (e: any) {
        // Tool errors are reported in-band so the client can show them.
        return result(id, { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true });
      }
    }
    default:
      if (id !== undefined) return error(id, -32601, `Method not found: ${method}`);
  }
}

// ── stdio loop: newline-delimited JSON-RPC ──
let buffer = "";
let pending = 0;
let ended = false;
const maybeExit = () => { if (ended && pending === 0) process.exit(0); };

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl: number;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg: any;
    try { msg = JSON.parse(line); } catch { log("bad JSON:", line); continue; }
    pending++;
    Promise.resolve(handle(msg))
      .catch((e) => log("handler error:", e?.message || e))
      .finally(() => { pending--; maybeExit(); });
  }
});
// Keep stdin open for long-lived clients (Claude Desktop); for a piped smoke
// test, exit once the input ends AND all in-flight calls have finished.
process.stdin.on("end", () => { ended = true; maybeExit(); });
log("Rudder MCP server ready (stdio).");
