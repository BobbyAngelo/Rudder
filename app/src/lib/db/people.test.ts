import test from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";

/* People repository tests — isolated throwaway database. */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "rudder-people-test-"));
process.env.RUDDER_DATA_DIR = TMP;

import {
  listPeople,
  relationshipBreakdown,
  createPerson,
  updatePerson,
  deletePerson,
} from "./people";

test.after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

test("createPerson + listPeople: warmth-desc ordering and total count", () => {
  createPerson({ name: "Alice", company: "Acme", relationship: "client", warmth: 5 });
  createPerson({ name: "Bob", company: "Beta", relationship: "friend", warmth: 9 });
  createPerson({ name: "Carol", email: "carol@acme.com", company: "Acme", relationship: "client", warmth: 7 });

  const { people, total } = listPeople();
  assert.strictEqual(total, 3);
  assert.deepStrictEqual(
    people.map((p) => p.name),
    ["Bob", "Carol", "Alice"],
    "ordered by warmth desc",
  );
});

test("listPeople: search matches name/email/company; relationship filter", () => {
  const acme = listPeople({ search: "acme" });
  assert.strictEqual(acme.total, 2, "matches Acme company and carol@acme.com email");

  const clients = listPeople({ relationship: "client" });
  assert.ok(clients.people.every((p) => p.relationship === "client"));
});

test("listPeople: pagination — total is independent of limit/offset", () => {
  const page = listPeople({ limit: 1, offset: 1 });
  assert.strictEqual(page.people.length, 1, "limit applied");
  assert.strictEqual(page.total, 3, "total ignores pagination");
  assert.strictEqual(page.people[0].name, "Carol", "offset into warmth-desc order");
});

test("updatePerson and deletePerson report change counts", () => {
  const { people } = listPeople({ relationship: "friend" });
  const bob = people[0];
  assert.strictEqual(updatePerson(bob.id, { name: "Bob", warmth: 1 }), true);

  const breakdown = relationshipBreakdown();
  assert.ok(breakdown.some((r) => r.relationship === "client" && r.count === 2));

  assert.strictEqual(deletePerson(bob.id), true);
  assert.strictEqual(listPeople().total, 2);
});
