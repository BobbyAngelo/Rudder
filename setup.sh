#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# Rudder — one-command setup.
# Clone → run ./setup.sh → a working, seeded, fully-local demo.
#   - checks Node 20+ and Ollama
#   - pulls the embedding + chat models
#   - installs deps, creates .env.local, seeds a sample life
# Safe to re-run.
# ═══════════════════════════════════════════════════════
set -euo pipefail

EMBED_MODEL="nomic-embed-text"
CHAT_MODEL="llama3.2"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$ROOT/app"
CHECK_ONLY=0
CHECK_FAILED=0

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }
die()  { printf "  \033[31m✗\033[0m %s\n" "$1" >&2; exit 1; }
check_fail() { printf "  \033[31m✗\033[0m %s\n" "$1" >&2; CHECK_FAILED=1; }

usage() {
  cat <<'EOF'
Usage: ./setup.sh [--check]

  --check   Verify Node 20+, Ollama reachability, and required models without changing anything.
  --help    Show this help text.
EOF
}

require_model() {
  local tags_json="$1"
  local model_name="$2"

  if printf '%s' "$tags_json" | grep -Eq "\"name\"[[:space:]]*:[[:space:]]*\"${model_name}(:[^\"]+)?\""; then
    ok "Model available: $model_name"
  else
    check_fail "Missing model: $model_name"
  fi
}

case "${1:-}" in
  "")
    ;;
  --help|-h)
    usage
    exit 0
    ;;
  --check)
    CHECK_ONLY=1
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac

bold "Rudder setup"

# ── Node 20+ ──
if ! command -v node >/dev/null 2>&1; then
  if [ "$CHECK_ONLY" -eq 1 ]; then
    check_fail "Node.js not found. Install Node 20+ from https://nodejs.org"
    printf "\n" >&2
    die "Check completed with failures."
  fi
  die "Node.js not found. Install Node 20+ from https://nodejs.org"
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  if [ "$CHECK_ONLY" -eq 1 ]; then
    check_fail "Node 20+ required (found $(node -v)). Upgrade from https://nodejs.org"
    printf "\n" >&2
    die "Check completed with failures."
  fi
  die "Node 20+ required (found $(node -v)). Upgrade from https://nodejs.org"
fi

if [ "$CHECK_ONLY" -eq 1 ]; then
  ok "Node $(node -v) found"
else
  ok "Node $(node -v)"
fi

# ── Ollama (local AI) ──
OLLAMA_TAGS=""
if command -v ollama >/dev/null 2>&1; then
  ok "Ollama installed"
  if OLLAMA_TAGS="$(curl -sf "${OLLAMA_URL:-http://localhost:11434}/api/tags")"; then
    ok "Ollama is running"
    if [ "$CHECK_ONLY" -eq 1 ]; then
      require_model "$OLLAMA_TAGS" "$EMBED_MODEL"
      require_model "$OLLAMA_TAGS" "$CHAT_MODEL"
    fi
  else
    if [ "$CHECK_ONLY" -eq 1 ]; then
      check_fail "Ollama is not reachable at ${OLLAMA_URL:-http://localhost:11434}"
    fi
    warn "Ollama is installed but not running. Start it (run 'ollama serve' or open the app), then re-run."
  fi
  if [ "$CHECK_ONLY" -eq 0 ]; then
    bold "Pulling local models (skips if already present)"
    ollama pull "$EMBED_MODEL"
    ollama pull "$CHAT_MODEL"
    ok "Models ready: $EMBED_MODEL, $CHAT_MODEL"
  fi
else
  if [ "$CHECK_ONLY" -eq 1 ]; then
    check_fail "Ollama not found. Install it from https://ollama.com"
  fi
  warn "Ollama not found. Rudder is best fully local — install it from https://ollama.com"
  warn "Then run:  ollama pull $EMBED_MODEL && ollama pull $CHAT_MODEL"
  warn "(Or set GEMINI_API_KEY in app/.env.local to use a cloud fallback instead.)"
fi

if [ "$CHECK_ONLY" -eq 1 ]; then
  if [ "$CHECK_FAILED" -eq 1 ]; then
    printf "\n" >&2
    die "Check completed with failures."
  fi

  echo
  bold "Check completed successfully."
  exit 0
fi

# ── Install deps ──
bold "Installing dependencies"
cd "$APP"
npm install
ok "Dependencies installed"

# ── Config ──
if [ ! -f "$APP/.env.local" ]; then
  cp "$APP/.env.example" "$APP/.env.local"
  ok "Created app/.env.local from template"
else
  ok "app/.env.local already exists — left as-is"
fi

# ── Seed a sample life (needs Ollama + the embed model) ──
if curl -sf "${OLLAMA_URL:-http://localhost:11434}/api/tags" >/dev/null 2>&1; then
  bold "Seeding sample data"
  npm run demo:seed
  ok "Demo data seeded"
else
  warn "Skipped demo seed (Ollama not reachable). Once it's running:  cd app && npm run demo:seed"
fi

echo
bold "Done. Start Rudder:"
echo "  cd app && npm run dev"
echo "  → open http://localhost:3000, ask a question, then connect your data in Settings → Connectors"
