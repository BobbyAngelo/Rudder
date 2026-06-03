#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# preflight.sh — confirm Rudder actually builds and runs after recent changes.
# Run on the Mac. The build gate is what the sandbox can't do; do this before
# publishing.
#
#   ./preflight.sh            # gate: npm ci + tsc + next build   (PASS = safe to publish)
#   ./preflight.sh --smoke    # gate + start the app and curl key routes
#   SKIP_INSTALL=1 ./preflight.sh   # reuse existing node_modules
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")/app" || { echo "✗ can't find app/"; exit 1; }

pass(){ printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
fail(){ printf '\033[1;31m✗ %s\033[0m\n' "$*"; }
say(){ printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

FAILED=0
run(){ # label cmd...
  local label="$1"; shift
  say "$label"
  if "$@"; then pass "$label"; else fail "$label"; FAILED=1; fi
}

# ── 0. Node ──
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
[ "$NODE_MAJOR" -ge 20 ] && pass "Node $(node -v)" || { fail "Node 20+ required (have $(node -v 2>/dev/null))"; exit 1; }

# ── 1. Install ──
if [ "${SKIP_INSTALL:-0}" = "1" ]; then
  say "Skipping install (SKIP_INSTALL=1)"
elif [ -f package-lock.json ]; then
  run "Install (npm ci)" npm ci
else
  run "Install (npm install)" npm install
fi

# ── 2. Type-check ──
run "Type-check (tsc --noEmit)" npx tsc --noEmit

# ── 3. Clean stale route cache so the build is honest ──
rm -rf .next

# ── 4. Production build (the real gate) ──
run "Build (next build)" npm run build

# ── 5. Sanity: deleted bespoke routes are gone, keepers present ──
say "Route sanity"
GONE=0
for d in career writing pala media hardware api/celf-biographer api/celf-insights api/nci api/drives; do
  if [ -e "src/app/$d" ]; then fail "still present: src/app/$d"; GONE=1; FAILED=1; fi
done
[ "$GONE" = "0" ] && pass "bespoke routes removed"
KEEP_OK=1
for p in src/app/identity/page.tsx src/app/biographer/story/page.tsx src/app/capture/page.tsx \
         src/app/api/identity/route.ts src/app/api/biographer/story/route.ts src/lib/identity.ts; do
  [ -e "$p" ] || { fail "missing keeper: $p"; KEEP_OK=0; FAILED=1; }
done
[ "$KEEP_OK" = "1" ] && pass "core surfaces present"
grep -rqi "celf" src && { fail "'celf' still in src"; FAILED=1; } || pass "no 'celf' in src"

# ── 6. Optional runtime smoke (starts the app, hits key routes) ──
if [ "${1:-}" = "--smoke" ]; then
  say "Runtime smoke (starting next dev on :3010)"
  PORT=3010 npm run dev >/tmp/rudder-preflight.log 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  # wait for ready (up to ~30s)
  for _ in $(seq 1 30); do curl -fsS "http://localhost:3010" >/dev/null 2>&1 && break; sleep 1; done
  ok=1
  for route in "/" "/identity" "/biographer/story" "/capture" "/api/identity" "/api/preferences"; do
    code="$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3010${route}")"
    if [ "$code" = "200" ]; then pass "GET ${route} → 200"; else fail "GET ${route} → ${code}"; ok=0; FAILED=1; fi
  done
  # /api/identity GET applies migration 025 — confirm the new columns serialize
  curl -fsS "http://localhost:3010/api/identity" | grep -q '"profile"' && pass "/api/identity returns profile (migration applied)" || { fail "/api/identity shape"; FAILED=1; }
  kill $SERVER 2>/dev/null; trap - EXIT
  [ "$ok" = "0" ] && echo "  (see /tmp/rudder-preflight.log)"
fi

echo
if [ "$FAILED" = "0" ]; then
  printf '\033[1;32m═══ PREFLIGHT PASSED — safe to publish (./publish-rudder.sh) ═══\033[0m\n'
else
  printf '\033[1;31m═══ PREFLIGHT FAILED — fix the ✗ items above before publishing ═══\033[0m\n'
  exit 1
fi
