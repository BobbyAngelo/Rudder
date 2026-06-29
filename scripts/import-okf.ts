import fs from "fs";
import path from "path";

/* ═══════════════════════════════════════════════════════
   import-okf.ts — Import an external OKF bundle into Rudder

   Accepts either a directory (an unpacked OKF bundle) or a .zip,
   copies/extracts the markdown into data/okf-imports/<bundle>, so
   the concepts flow into Rudder's RAG + semantic-retrieval layer.

   Usage:
     node --import tsx scripts/import-okf.ts <path-to-bundle-dir-or-zip> [--name <bundle>]
   ═══════════════════════════════════════════════════════ */

const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");
const DATA_DIR = path.join(ROOT, "data");

function copyMarkdownDir(srcDir: string, destDir: string): number {
  let count = 0;
  for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, e.name);
    const dest = path.join(destDir, e.name);
    if (e.isDirectory()) {
      count += copyMarkdownDir(src, dest);
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      count++;
    }
  }
  return count;
}

async function main() {
  const args = process.argv.slice(2);
  const input = args.find(a => !a.startsWith("--"));
  const name = args.includes("--name") ? args[args.indexOf("--name") + 1] : undefined;

  if (!input || !fs.existsSync(input)) {
    process.stderr.write("[okf-import] Provide a path to an OKF bundle directory or .zip\n");
    process.exit(1);
  }

  const bundleRaw = name || path.basename(input).replace(/\.(zip|tar|gz)$/i, "");
  const bundle = bundleRaw.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "").slice(0, 60) || "imported";
  const dest = path.join(DATA_DIR, "okf-imports", bundle);

  let fileCount = 0;
  const stat = fs.statSync(input);

  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    fileCount = copyMarkdownDir(input, dest);
  } else {
    // Zip: reuse adm-zip + the shared safe-extraction logic.
    process.chdir(APP_DIR);
    const AdmZip = (await import("adm-zip")).default;
    const { writeImportedBundle } = await import(path.join(APP_DIR, "src/lib/okf-import.ts"));
    const zip = new AdmZip(input);
    const entries = zip.getEntries().map((e: any) => ({
      entryName: e.entryName,
      isDirectory: e.isDirectory,
      getData: () => e.getData(),
    }));
    const result = writeImportedBundle(DATA_DIR, bundle, entries);
    fileCount = result.fileCount;
  }

  if (fileCount === 0) {
    process.stderr.write("[okf-import] No markdown files found in the bundle.\n");
    process.exit(1);
  }

  process.stdout.write(
    `[okf-import] Imported ${fileCount} markdown files into ${dest}\n` +
    `[okf-import] Concepts will be embedded and searchable on the next query.\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[okf-import] Import failed: ${err?.message || err}\n`);
  process.exit(1);
});
