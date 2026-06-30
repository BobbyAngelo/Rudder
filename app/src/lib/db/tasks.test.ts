import test from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";

/* ═══════════════════════════════════════════════════════
   Tasks repository tests.
   Runs against an isolated throwaway database (RUDDER_DATA_DIR set before the
   first getDB() call). node --test runs each test file in its own process, so
   this DB override is local to this suite.
   ═══════════════════════════════════════════════════════ */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "rudder-tasks-test-"));
process.env.RUDDER_DATA_DIR = TMP;

import { getDB } from "../db";
import {
  createTask,
  listTasks,
  updateTask,
  deleteTask,
  taskCounts,
  getTask,
} from "./tasks";

test.after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

test("createTask: trims title, applies defaults, serializes labels", () => {
  const t = createTask({ title: "  Write report  ", priority: 3, labels: [1, 2] });
  assert.strictEqual(t.title, "Write report");
  assert.strictEqual(t.status, "todo");
  assert.strictEqual(t.priority, 3);
  assert.strictEqual(t.project_id, 1);
  assert.strictEqual(t.labels, "[1,2]");
});

test("listTasks: hides archived by default and sorts in_progress first", () => {
  createTask({ title: "ActiveProg", status: "in_progress" });
  createTask({ title: "ArchivedItem", status: "archived" });
  const titles = listTasks().map((t) => t.title);
  assert.ok(!titles.includes("ArchivedItem"), "archived is hidden by default");
  assert.strictEqual(titles[0], "ActiveProg", "in_progress sorts before todo");
});

test("listTasks: status / project / priority filters", () => {
  getDB().prepare("INSERT INTO task_projects (id, name) VALUES (77, 'Test Project')").run();
  const hp = createTask({ title: "HighPriority", priority: 4, project_id: 77 });
  assert.ok(
    listTasks({ status: "active" }).every((t) => t.status === "todo" || t.status === "in_progress"),
    "active filter excludes done/archived",
  );
  assert.ok(listTasks({ projectId: 77 }).some((t) => t.id === hp.id), "project filter matches");
  assert.ok(listTasks({ minPriority: 4 }).every((t) => t.priority >= 4), "minPriority filter");
});

test("updateTask: completed_at toggles with status, labels update, no_fields guard", () => {
  const t = createTask({ title: "Toggle" });

  let r = updateTask(t.id, { status: "done" });
  assert.ok(r.ok && r.task && r.task.completed_at, "status=done sets completed_at");

  r = updateTask(t.id, { status: "todo" });
  assert.ok(r.ok && r.task && r.task.completed_at === null, "reopen clears completed_at");

  r = updateTask(t.id, { labels: [9] });
  assert.ok(r.ok && r.task && r.task.labels === "[9]", "labels re-serialized");

  assert.deepStrictEqual(updateTask(t.id, {}), { ok: false, reason: "no_fields" });
});

test("updateTask: non-allowlisted keys are ignored (no arbitrary column writes)", () => {
  const t = createTask({ title: "Safe" });
  // @ts-expect-error — a key outside TaskUpdateInput must not be accepted/applied.
  const r = updateTask(t.id, { "evil = 1; --": "x" });
  assert.deepStrictEqual(r, { ok: false, reason: "no_fields" });
});

test("taskCounts reflects inserts and deleteTask removes the row", () => {
  const before = taskCounts();
  const t = createTask({ title: "Counted", status: "todo" });
  assert.strictEqual(taskCounts().total, before.total + 1);
  assert.strictEqual(deleteTask(t.id), true);
  assert.strictEqual(getTask(t.id), undefined);
});
