import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = join(__dirname, "../src/lib/ingest/fixtures/chatgpt-conversations.json");
const { parseChatGPTExport } = await import("../src/lib/ingest/chatgpt.ts");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const docs = parseChatGPTExport(readFileSync(fixture, "utf-8"));
const doc = docs[0];

assert(docs.length >= 1, "expected at least one RawDoc");
assert(doc.title === "Trip planning", "expected conversation title");
assert(doc.body.includes("User: Can you help me plan a day in Buenos Aires?"), "expected user turn");
assert(doc.body.includes("Assistant: Absolutely."), "expected assistant turn");
assert(doc.date === "2024-05-01", `expected normalized date, got ${doc.date}`);

console.log(`chatgpt parse check passed (${docs.length} doc(s))`);
