import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET() {
  try {
    const db = getDB();
    
    const nodes: any[] = [];
    const links: any[] = [];

    // Colors mapping
    const colors = {
      self: "#ffffff",
      person: "#f59e0b",
      event: "#34d399",
      task: "#60a5fa",
      habit: "#f97316",
      value: "#a855f7",
      project: "#ec4899"
    };

    // 1. Central Self Node
    nodes.push({ id: "SELF", label: "Me", type: "self", color: colors.self, val: 5 });

    // 2. Values
    const values = db.prepare("SELECT id, label FROM identity_values").all() as any[];
    for (const v of values) {
      const id = `value_${v.id}`;
      nodes.push({ id, label: v.label, type: "value", color: colors.value, val: 3 });
      links.push({ source: "SELF", target: id, type: "holds" });
    }

    // 3. People
    const people = db.prepare("SELECT id, name FROM people").all() as any[];
    for (const p of people) {
      const id = `person_${p.id}`;
      nodes.push({ id, label: p.name, type: "person", color: colors.person, val: 2 });
      links.push({ source: "SELF", target: id, type: "knows" });
    }

    // 4. Projects
    const projects = db.prepare("SELECT id, name FROM task_projects").all() as any[];
    for (const p of projects) {
      const id = `project_${p.id}`;
      nodes.push({ id, label: p.name, type: "project", color: colors.project, val: 3 });
      links.push({ source: "SELF", target: id, type: "drives" });
    }

    // 5. Habits
    // (We wrap in try-catch in case tables are missing if they haven't migrated)
    try {
      const habits = db.prepare("SELECT id, title, linked_value_id FROM habits").all() as any[];
      for (const h of habits) {
        const id = `habit_${h.id}`;
        nodes.push({ id, label: h.title, type: "habit", color: colors.habit, val: 2 });
        if (h.linked_value_id) {
          links.push({ source: id, target: `value_${h.linked_value_id}`, type: "aligns_to" });
        } else {
          links.push({ source: "SELF", target: id, type: "practices" });
        }
      }
    } catch {}

    // 6. Tasks
    try {
      const tasks = db.prepare("SELECT id, title, project_id FROM tasks").all() as any[];
      for (const t of tasks) {
        const id = `task_${t.id}`;
        nodes.push({ id, label: t.title, type: "task", color: colors.task, val: 1 });
        if (t.project_id) {
          links.push({ source: id, target: `project_${t.project_id}`, type: "part_of" });
        } else {
          links.push({ source: "SELF", target: id, type: "does" });
        }
      }
    } catch {}

    // 7. Events & Connections
    try {
      const events = db.prepare("SELECT id, title, linked_people, linked_task_id FROM calendar_events").all() as any[];
      for (const e of events) {
        const id = `event_${e.id}`;
        nodes.push({ id, label: e.title, type: "event", color: colors.event, val: 2 });
        links.push({ source: "SELF", target: id, type: "attends" });

        // Connect event to people
        if (e.linked_people) {
          const pIds = JSON.parse(e.linked_people);
          for (const pid of pIds) {
            links.push({ source: id, target: `person_${pid}`, type: "involves" });
          }
        }

        // Connect event to task
        if (e.linked_task_id) {
          links.push({ source: id, target: `task_${e.linked_task_id}`, type: "scheduled_for" });
        }
      }
    } catch {}

    return NextResponse.json({ nodes, links });
  } catch (err: any) {
    console.error("Graph API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
