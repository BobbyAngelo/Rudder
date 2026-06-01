import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { parseCommand } from "@/lib/nlp";
import { spawn } from "child_process";
import path from "path";

export async function POST(req: Request) {
  try {
    const { input } = await req.json();
    if (!input || !input.trim()) {
      return NextResponse.json({ error: "Input is required" }, { status: 400 });
    }

    const command = input.trim();
    const db = getDB();
    const now = new Date().toISOString();

    // 1. /write command
    if (command.startsWith("/write")) {
      const title = command.replace(/^\/write\s*/i, "").trim() || "Untitled Draft";
      
      const result = db.prepare(`
        INSERT INTO journal_entries (title, content, mode, word_count, wpm, tags, created_at, updated_at)
        VALUES (?, '', 'journal', 0, 0, '[]', datetime('now'), datetime('now'))
      `).run(title);

      return NextResponse.json({
        success: true,
        type: "write",
        redirect: `/writing?id=${result.lastInsertRowid}`,
        message: `✍️ Draft "${title}" created. Opening editor...`
      });
    }

    // 2. /node command
    if (command.startsWith("/node")) {
      const mode = command.replace(/^\/node\s*/i, "").trim();
      const validModes = ["local_ollama", "cloud_openai", "cloud_gemini"];
      
      let matchedMode = "";
      if (mode.includes("ollama")) matchedMode = "local_ollama";
      else if (mode.includes("openai") || mode.includes("gpt")) matchedMode = "cloud_openai";
      else if (mode.includes("gemini")) matchedMode = "cloud_gemini";

      if (!matchedMode) {
        return NextResponse.json({
          success: false,
          message: "⚠️ Invalid node. Use: local_ollama, cloud_openai, or cloud_gemini."
        });
      }

      db.prepare(`
        UPDATE user_preferences 
        SET default_execution_mode = ?, updated_at = datetime('now')
        WHERE id = 1
      `).run(matchedMode);

      return NextResponse.json({
        success: true,
        type: "node",
        message: `🛡️ Sovereign node updated to: ${matchedMode}`
      });
    }

    // 3. /todo or /event command
    if (command.startsWith("/todo") || command.startsWith("/event") || !command.startsWith("/")) {
      // If it has no prefix, parse as task/event using NLP parser
      const cleanInput = command.replace(/^\/(todo|event)\s*/i, "");
      const parsed = parseCommand(cleanInput);

      if (parsed.type === "task") {
        db.prepare(`
          INSERT INTO tasks (title, status, priority, created_at, updated_at, labels)
          VALUES (?, 'todo', 2, ?, ?, ?)
        `).run(parsed.title, now, now, JSON.stringify([parsed.category]));

        return NextResponse.json({
          success: true,
          type: "todo",
          message: `✅ Created task "${parsed.title}" [Category: ${parsed.category}]`
        });
      } else {
        db.prepare(`
          INSERT INTO calendar_events (title, start_date, start_time, category, color)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          parsed.title,
          parsed.date,
          parsed.time || "12:00",
          parsed.category,
          parsed.category === "work" ? "#60a5fa" : parsed.category === "health" ? "#f87171" : parsed.category === "social" ? "#f472b6" : "#34d399"
        );

        return NextResponse.json({
          success: true,
          type: "event",
          message: `📅 Event scheduled: "${parsed.title}" for ${parsed.date} at ${parsed.time || "12:00"} [Category: ${parsed.category}]`
        });
      }
    }

    // 4. /scan command
    if (command.startsWith("/scan")) {
      const target = command.replace(/^\/scan\s*/i, "").trim().toLowerCase();
      
      if (target === "media" || !target) {
        const importScriptPath = path.join(process.cwd(), "..", "scripts", "import.ts");
        const child = spawn("npx", ["tsx", importScriptPath, "media"], {
          cwd: path.join(process.cwd(), ".."),
          detached: true,
          stdio: "ignore",
        });
        child.unref();

        return NextResponse.json({
          success: true,
          type: "scan",
          message: "🚀 Background media scan started for all active media folders!"
        });
      } else {
        return NextResponse.json({
          success: false,
          message: `⚠️ Unsupported scan target "${target}". Use: /scan media`
        });
      }
    }

    return NextResponse.json({
      success: false,
      message: `⚠️ Unknown command style. Prefix with /todo, /event, /write, /node, or /scan.`
    });

  } catch (err: any) {
    console.error("POST /api/command Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
