#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# phone-https.sh — put a private HTTPS front door on Rudder via Tailscale Serve
# so the phone capture client (/m.html) can record audio (browsers require a
# secure context for the mic). Private to your tailnet — NOT public (that's Funnel).
#
#   ./phone-https.sh          # serve port 3000, print the phone URL
#   PORT=3001 ./phone-https.sh
#   ./phone-https.sh off      # tear the front door down
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
PORT="${PORT:-3000}"

say(){ printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok(){ printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn(){ printf '\033[1;33m! %s\033[0m\n' "$*"; }
die(){ printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ── Resolve the tailscale CLI (standalone pkg vs Mac App Store app bundle) ──
TS=""
if command -v tailscale >/dev/null 2>&1; then TS="tailscale"
elif [ -x "/Applications/Tailscale.app/Contents/MacOS/Tailscale" ]; then TS="/Applications/Tailscale.app/Contents/MacOS/Tailscale"
else die "Tailscale CLI not found. Install from https://tailscale.com/download and sign in."; fi

# ── Off switch ──
if [ "${1:-}" = "off" ]; then
  say "Tearing down the HTTPS front door"
  "$TS" serve --https=443 off 2>/dev/null || "$TS" serve reset 2>/dev/null || true
  ok "Off. Phone HTTPS access removed (Rudder still runs locally)."
  exit 0
fi

# ── Tailscale up? ──
say "Checking Tailscale"
"$TS" status >/dev/null 2>&1 || die "Tailscale isn't connected. Open the Tailscale app and sign in, then re-run."
ok "Tailscale is up"

# ── Is Rudder actually listening on the port? (warn, don't block) ──
if ! curl -s -o /dev/null "http://localhost:${PORT}" 2>/dev/null; then
  warn "Nothing answered on http://localhost:${PORT}. Start Rudder first:  npm --prefix app run dev"
fi

# ── Serve it over HTTPS, in the background ──
say "Serving Rudder over HTTPS on your tailnet"
"$TS" serve --bg "${PORT}" \
  || die "tailscale serve failed. If it mentions certificates, enable MagicDNS + HTTPS Certificates in the admin console (https://login.tailscale.com/admin/dns), then re-run."

# ── Figure out the public-to-your-tailnet URL ──
HOST="$("$TS" status --json 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))' 2>/dev/null || true)"

ok "HTTPS front door is up"
echo
if [ -n "$HOST" ]; then
  echo "  📱 On your phone (signed into the same tailnet), open:"
  printf '\n      \033[1;32mhttps://%s/m.html\033[0m\n\n' "$HOST"
  echo "  Then Add to Home Screen. Mic access will work — pick a kind, record, send."
else
  echo "  Find your URL with:  $TS serve status   →  open https://<that-host>/m.html on your phone"
fi
echo
echo "  Turn it off later with:  ./phone-https.sh off"
echo "  (Private to your devices — this is Serve, not Funnel. Nothing is exposed publicly.)"
