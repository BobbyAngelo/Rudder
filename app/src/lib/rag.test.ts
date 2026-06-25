import test from "node:test";
import assert from "node:assert";
import { retrieveChunks, Chunk } from "./rag";

const mockChunks: Chunk[] = [
  {
    source: "people",
    title: "Sarah Chen",
    content: "Product manager at Flow Agency. Discussed LuxAuto project.",
  },
  {
    source: "tasks",
    title: "Assemble SLAB Pocket shell",
    content: "Solder the MCUs and assemble the prototype shell.",
  },
  {
    source: "calendar",
    title: "Project Review Meeting",
    content: "Sync with team on current timelines and milestones.",
  },
  {
    source: "wiki",
    title: "Sovereign Design Guidelines",
    content: "Ensure privacy and local first architecture principles.",
  },
  {
    source: "career",
    title: "NBC Executive Producer",
    content: "Co-created and showran Jay Leno's Garage show.",
  }
];

test("retrieveChunks: basic keyword matching", () => {
  const query = "Flow Agency";
  const results = retrieveChunks(mockChunks, query);
  
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].title, "Sarah Chen");
});

test("retrieveChunks: lexical title match boost", () => {
  // Query "Sovereign" matches title of chunk 4, and we also have a chunk with "Sovereign" in content.
  const customChunks: Chunk[] = [
    {
      source: "wiki",
      title: "Design Principles",
      content: "We focus on building sovereign systems."
    },
    {
      source: "wiki",
      title: "Sovereign Core",
      content: "This is the primary module definition."
    }
  ];
  
  const results = retrieveChunks(customChunks, "Sovereign");
  
  assert.strictEqual(results.length, 2);
  // Title match ("Sovereign Core") should rank first due to title boost (+2 vs +1)
  assert.strictEqual(results[0].title, "Sovereign Core");
  assert.strictEqual(results[1].title, "Design Principles");
});

test("retrieveChunks: schedule intent boost", () => {
  // Query "Meeting calendar" should boost calendar & tasks chunks, and "Project Review Meeting" will win due to keyword match
  const results = retrieveChunks(mockChunks, "Meeting calendar");
  
  assert.ok(results.length >= 1);
  // The first result should be "Project Review Meeting" because it has calendar source boost + keyword match
  assert.strictEqual(results[0].title, "Project Review Meeting");
});

test("retrieveChunks: limit results to topN", () => {
  const query = "Project"; // matches "Sarah Chen" (LuxAuto project) and "Project Review Meeting"
  const results = retrieveChunks(mockChunks, query, 1);
  
  assert.strictEqual(results.length, 1);
});

test("retrieveChunks: handle zero matches", () => {
  const query = "NonexistentKeyword";
  const results = retrieveChunks(mockChunks, query);
  
  assert.strictEqual(results.length, 0);
});
