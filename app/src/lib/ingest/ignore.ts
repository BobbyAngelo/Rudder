/* ═══════════════════════════════════════════════════════
   Ingest hygiene — one shared ignore policy.
   Memory is only as good as what goes into it. Dependency trees, build output,
   and version-control dirs are noise: they poison recall, the act loop, and the
   wiki (a folder of node_modules READMEs makes "Platinum Sponsors" a top topic).

   Every file-walking connector uses these rules, and the purge (maintenance.ts)
   uses the same policy to evict anything that slipped in earlier.
   ═══════════════════════════════════════════════════════ */

/** Directory names to skip entirely, at any depth. */
export const IGNORE_DIRS = new Set([
  // dependencies & package managers
  "node_modules", "bower_components", "vendor", "Pods", ".pnpm-store",
  // version control
  ".git", ".hg", ".svn",
  // build / output
  "dist", "build", "out", ".next", ".nuxt", ".svelte-kit", ".output", "target",
  // caches
  ".cache", ".turbo", ".parcel-cache", "coverage", ".nyc_output", ".gradle",
  // python
  "__pycache__", ".venv", "venv", "env", ".pytest_cache", ".mypy_cache", ".tox",
  // infra / editor
  ".terraform", ".idea", ".vscode",
]);

/** Exact filenames to skip (lockfiles, OS cruft). Compared case-insensitively. */
export const IGNORE_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "npm-shrinkwrap.json",
  "composer.lock", "cargo.lock", "poetry.lock", "gemfile.lock", "go.sum",
  ".ds_store", "thumbs.db", "desktop.ini",
]);

/** During a directory walk: should this entry (file or dir) be skipped? */
export function ignoredName(name: string): boolean {
  if (name.startsWith(".")) return true;            // dotfiles & dotdirs (.obsidian, .env, …)
  if (IGNORE_DIRS.has(name)) return true;
  if (IGNORE_FILES.has(name.toLowerCase())) return true;
  return false;
}

/** For an already-stored path (a connector sourceId): is it junk? Catches items
    ingested before these rules existed. Handles both / and \ separators. */
export function ignoredByPath(p: string): boolean {
  if (!p) return false;
  const parts = p.split(/[\\/]+/).filter(Boolean);
  if (parts.some((seg) => IGNORE_DIRS.has(seg))) return true;
  const base = parts[parts.length - 1]?.toLowerCase() || "";
  if (IGNORE_FILES.has(base)) return true;
  return false;
}
