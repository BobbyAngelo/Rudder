# Rudder MCP Server — Setup

Expose your sovereign Rudder memory to any MCP client (Claude Desktop, Cursor, …). The AI you already use gains a private, local memory of your life — nothing leaves your machine.

## What it does

Runs a small stdio server that gives the client one tool:

- **`search_memory(query, limit?)`** → the most relevant items from your local Rudder memory (notes, calendar, health, people, connected sources), with citations.

It reads the same local store the app uses (`data/rudder.db` + `sqlite-vec`) and embeds queries via your local Ollama. Requires Ollama running and some memory indexed (`npm run ingest:md -- <folder>` or the demo seed).

## 1. Smoke test (no client needed)

From `app/`, pipe a few JSON-RPC messages straight in:

```bash
cd /path/to/rudder/app
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_memory","arguments":{"query":"what is Rudder?"}}}' \
  | ./node_modules/.bin/tsx scripts/mcp-server.ts
```

Expect three JSON lines on stdout: the `initialize` result, the tools list (with `search_memory`), and a `tools/call` result containing recalled text. (Run it through `tsx` directly, not `npm run mcp`, so npm's banner doesn't pollute stdout.)

## 2. Connect Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rudder": {
      "command": "/path/to/rudder/app/node_modules/.bin/tsx",
      "args": ["/path/to/rudder/app/scripts/mcp-server.ts"],
      "env": {
        "RUDDER_DATA_DIR": "/path/to/rudder/data",
        "OLLAMA_URL": "http://localhost:11434"
      }
    }
  }
}
```

Restart Claude Desktop. You should see a `rudder` tool available. Ask it something only your memory would know (e.g. "using my Rudder memory, what's going on with Sarah?") and it will call `search_memory` and answer from your local data.

Notes:
- **`RUDDER_DATA_DIR`** is required here — it pins the DB path regardless of where the client launches the process (otherwise it resolves relative to the launch cwd).
- Use absolute paths for `command` and `args`.
- All diagnostics go to **stderr**; **stdout** is the protocol channel only.

## 3. Cursor / other MCP clients

Any MCP-over-stdio client works — point it at the same command/args/env. The protocol surface is the standard `initialize` → `tools/list` → `tools/call`.

## Security

The server only **reads** your local memory and only over stdio to a client you configure. Nothing is exposed to the network and nothing leaves your machine. (A future `ingest_note` write tool would be additive and opt-in.)
