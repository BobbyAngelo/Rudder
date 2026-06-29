import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET() {
  try {
    const db = getDB();
    
    // Get Data Sources
    const sources = db.prepare("SELECT * FROM data_sources ORDER BY created_at DESC").all();
    
    // Get MCP Servers
    const mcpServers = db.prepare("SELECT * FROM mcp_servers ORDER BY created_at DESC").all().map((s: any) => ({
      ...s,
      args: JSON.parse(s.args || "[]"),
      env: JSON.parse(s.env || "{}")
    }));
    
    // Get Execution Preferences
    const prefs = db.prepare(`
      SELECT 
        default_execution_mode, fallback_execution_mode, 
        imap_host, imap_port, imap_user, imap_pass, 
        smtp_host, smtp_port, smtp_user, smtp_pass, 
        inbox_sync_enabled 
      FROM user_preferences 
      WHERE id = 1
    `).get();

    // Get unique telemetry devices
    const devices = db.prepare(`
      SELECT DISTINCT origin_provenance as device_id, MAX(when_timestamp) as last_seen 
      FROM reality_nodes 
      WHERE what_classification = 'Device Telemetry'
      GROUP BY origin_provenance
      ORDER BY last_seen DESC
    `).all();

    return NextResponse.json({
      data_sources: sources,
      mcp_servers: mcpServers,
      execution: prefs,
      devices
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDB();
    
    if (body.type === 'data_source') {
      const stmt = db.prepare(`
        INSERT INTO data_sources (name, path, type)
        VALUES (@name, @path, @source_type)
      `);
      const info = stmt.run({
        name: body.name,
        path: body.path,
        source_type: body.source_type || 'folder'
      });
      return NextResponse.json({ success: true, id: info.lastInsertRowid });
    }
    
    if (body.type === 'mcp_server') {
      const stmt = db.prepare(`
        INSERT INTO mcp_servers (name, command, args, env)
        VALUES (@name, @command, @args, @env)
      `);
      const info = stmt.run({
        name: body.name,
        command: body.command,
        args: JSON.stringify(body.args || []),
        env: JSON.stringify(body.env || {})
      });
      return NextResponse.json({ success: true, id: info.lastInsertRowid });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDB();

    // Update execution and email preferences
    if (
      body.default_execution_mode !== undefined ||
      body.fallback_execution_mode !== undefined ||
      body.imap_host !== undefined ||
      body.imap_port !== undefined ||
      body.imap_user !== undefined ||
      body.imap_pass !== undefined ||
      body.smtp_host !== undefined ||
      body.smtp_port !== undefined ||
      body.smtp_user !== undefined ||
      body.smtp_pass !== undefined ||
      body.inbox_sync_enabled !== undefined
    ) {
      const updates: string[] = [];
      const params: any = {};

      const fields = [
        "default_execution_mode", "fallback_execution_mode",
        "imap_host", "imap_port", "imap_user", "imap_pass",
        "smtp_host", "smtp_port", "smtp_user", "smtp_pass",
        "inbox_sync_enabled"
      ];

      for (const field of fields) {
        if (body[field] !== undefined) {
          updates.push(`${field} = @${field}`);
          params[field] = body[field];
        }
      }

      db.prepare(`UPDATE user_preferences SET ${updates.join(", ")} WHERE id = 1`).run(params);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const table = searchParams.get("table"); // "data_sources" or "mcp_servers"
    const db = getDB();

    if (!id || !table || !["data_sources", "mcp_servers"].includes(table)) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
