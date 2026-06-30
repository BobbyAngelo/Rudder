import test from "node:test";
import assert from "node:assert";
import { parseFile } from "./parse";

/* ═══════════════════════════════════════════════════════
   Document parser dispatch tests (#14).
   parseFile is dependency-free for text formats, so these run anywhere.
   The PDF case also exercises the graceful "missing optional parser" path.
   ═══════════════════════════════════════════════════════ */

test("parses plain text by mimetype", async () => {
  const r = await parseFile(Buffer.from("hello world"), "note.txt", "text/plain");
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.text, "hello world");
});

test("parses markdown by extension regardless of mimetype", async () => {
  const r = await parseFile(Buffer.from("# Title\nbody"), "doc.md", "application/octet-stream");
  assert.strictEqual(r.success, true);
  assert.match(r.text ?? "", /# Title/);
});

test("parses csv content", async () => {
  const r = await parseFile(Buffer.from("a,b\n1,2"), "data.csv", "text/csv");
  assert.strictEqual(r.success, true);
  assert.ok((r.text ?? "").includes("a,b"));
});

test("strips html tags, scripts, and styles", async () => {
  const html =
    "<html><head><style>.x{color:red}</style></head>" +
    "<body><script>steal()</script><p>Hello <b>World</b></p></body></html>";
  const r = await parseFile(Buffer.from(html), "page.html", "text/html");
  assert.strictEqual(r.success, true);
  assert.ok(!(r.text ?? "").includes("<"), "no markup tags remain");
  assert.ok(!(r.text ?? "").toLowerCase().includes("steal()"), "script body removed");
  assert.ok(!(r.text ?? "").includes("color:red"), "style body removed");
  assert.ok((r.text ?? "").includes("Hello") && (r.text ?? "").includes("World"));
});

test("returns a graceful error for unsupported formats", async () => {
  const r = await parseFile(Buffer.from([0, 1, 2]), "mystery.xyz", "application/x-unknown");
  assert.strictEqual(r.success, false);
  assert.match(r.error ?? "", /Unsupported file format/);
});

test("a fake PDF degrades gracefully and reports an install hint when the parser is absent", async () => {
  const r = await parseFile(Buffer.from("not a real pdf"), "doc.pdf", "application/pdf");
  // Either pdf-parse is installed (parse fails on the junk buffer) or it isn't
  // (missing-dependency path) — in both cases we must fail cleanly, never throw.
  assert.strictEqual(r.success, false);
  assert.ok(r.error, "a human-readable error is always present");
  if (r.missingDependency) {
    assert.strictEqual(r.missingDependency, "pdf-parse");
    assert.ok(r.installCommand?.includes("pdf-parse"), "provides an install command");
  }
});
