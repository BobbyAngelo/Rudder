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

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }
die()  { printf "  \033[31m✗\033[0m %s\n" "$1" >&2; exit 1; }

bold "Rudder setup"

# ── Node 20+ ──
command -v node >/dev/null 2>&1 || die "Node.js not found. Install Node 20+ from https://nodejs.org"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "Node 20+ required (found $(node -v)). Upgrade from https://nodejs.org"
ok "Node $(node -v)"

# ── Ollama (local AI) ──
if command -v ollama >/dev/null 2>&1; then
  ok "Ollama installed"
  if curl -sf "${OLLAMA_URL:-http://localhost:11434}/api/tags" >/dev/null 2>&1; then
    ok "Ollama is running"
  else
    warn "Ollama is installed but not running. Start it (run 'ollama serve' or open the app), then re-run."
  fi
  bold "Pulling local models (skips if already present)"
  ollama pull "$EMBED_MODEL"
  ollama pull "$CHAT_MODEL"
  ok "Models ready: $EMBED_MODEL, $CHAT_MODEL"
else
  warn "Ollama not found. Rudder is best fully local — install it from https://ollama.com"
  warn "Then run:  ollama pull $EMBED_MODEL && ollama pull $CHAT_MODEL"
  warn "(Or set GEMINI_API_KEY in app/.env.local to use a cloud fallback instead.)"
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
