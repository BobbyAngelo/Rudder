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
    const prefs = db.prepare("SELECT default_execution_mode, fallback_execution_mode FROM user_preferences WHERE id = 1").get();

    return NextResponse.json({
      data_sources: sources,
      mcp_servers: mcpServers,
      execution: prefs
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

    // Update execution routing preferences
    if (body.default_execution_mode || body.fallback_execution_mode) {
      const updates: string[] = [];
      const params: any = {};

      if (body.default_execution_mode) {
        updates.push("default_execution_mode = @default_execution_mode");
        params.default_execution_mode = body.default_execution_mode;
      }
      if (body.fallback_execution_mode) {
        updates.push("fallback_execution_mode = @fallback_execution_mode");
        params.fallback_execution_mode = body.fallback_execution_mode;
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
