import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import {
  listTasks,
  listProjects,
  taskCounts,
  createTask,
  updateTask,
  deleteTask,
  type TaskCreateInput,
  type TaskUpdateInput,
} from "@/lib/db/tasks";

/* ═══════════════════════════════════════════════════════
   Tasks API

   GET    /api/tasks              — List tasks (with filters)
   POST   /api/tasks              — Create task
   PUT    /api/tasks?id=X         — Update task
   DELETE /api/tasks?id=X         — Delete task
   ═══════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("project_id");
    const priority = url.searchParams.get("priority");

    const tasks = listTasks({
      status: url.searchParams.get("status"),
      projectId: projectId ? parseInt(projectId) : null,
      minPriority: priority ? parseInt(priority) : null,
    });

    return NextResponse.json({
      tasks,
      projects: listProjects(),
      counts: taskCounts(),
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<TaskCreateInput>;

    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const task = createTask(body as TaskCreateInput);
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = parseInt(url.searchParams.get("id") || "");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = (await req.json()) as TaskUpdateInput;
    const result = updateTask(id, body);

    if (!result.ok) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }
    return NextResponse.json(result.task ?? null);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = parseInt(url.searchParams.get("id") || "");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
