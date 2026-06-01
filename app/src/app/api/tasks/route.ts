import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/* ═══════════════════════════════════════════════════════
   Tasks API
   
   GET    /api/tasks              — List tasks (with filters)
   POST   /api/tasks              — Create task
   PUT    /api/tasks?id=X         — Update task
   DELETE /api/tasks?id=X         — Delete task
   ═══════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  try {
    const db = getDB();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const projectId = url.searchParams.get("project_id");
    const priority = url.searchParams.get("priority");

    let query = "SELECT * FROM tasks WHERE 1=1";
    const params: any[] = [];

    if (status && status !== "all") {
      if (status === "active") {
        query += " AND status IN ('todo', 'in_progress')";
      } else {
        query += " AND status = ?";
        params.push(status);
      }
    } else if (!status) {
      // Default: hide archived
      query += " AND status != 'archived'";
    }

    if (projectId) {
      query += " AND project_id = ?";
      params.push(parseInt(projectId));
    }

    if (priority) {
      query += " AND priority >= ?";
      params.push(parseInt(priority));
    }

    query += " ORDER BY CASE status WHEN 'in_progress' THEN 0 WHEN 'todo' THEN 1 WHEN 'done' THEN 2 ELSE 3 END, priority DESC, sort_order ASC, created_at DESC";

    const tasks = db.prepare(query).all(...params);

    // Also fetch projects for sidebar
    const projects = db.prepare("SELECT * FROM task_projects ORDER BY sort_order, id").all();

    // Counts
    const counts = db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        COUNT(*) as total
      FROM tasks WHERE status != 'archived'
    `).get();

    return NextResponse.json({ tasks, projects, counts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDB();

    const { title, description, status, priority, project_id, due_date, due_time, labels, parent_id } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO tasks (title, description, status, priority, project_id, due_date, due_time, labels, parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      description || "",
      status || "todo",
      priority || 0,
      project_id || 1,
      due_date || null,
      due_time || null,
      JSON.stringify(labels || []),
      parent_id || null,
    );

    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json(task, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = await req.json();
    const db = getDB();

    const allowedFields = [
      "title", "description", "status", "priority", "project_id",
      "due_date", "due_time", "sort_order", "labels", "parent_id",
      "is_recurring", "recurrence_rule",
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        const value = typeof body[field] === "object" ? JSON.stringify(body[field]) : body[field];
        values.push(value);
      }
    }

    // Handle completion timestamp
    if (body.status === "done") {
      updates.push("completed_at = datetime('now')");
    } else if (body.status && body.status !== "done") {
      updates.push("completed_at = NULL");
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(parseInt(id));

    db.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`).run(...values);

    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(parseInt(id));
    return NextResponse.json(task);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const db = getDB();
    db.prepare("DELETE FROM tasks WHERE id = ?").run(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
