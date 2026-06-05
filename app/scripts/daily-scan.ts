/* ═══════════════════════════════════════════════════════
   Rudder daily scan — fill the Desk on a schedule.
   Runs the act-loop generators (surface + schedule) and adds any new proposals.
   Pure database work: no model, no network. Safe to run repeatedly (deduped).

   Run once:   npm run act:scan        (from app/)
   Force:      npm run act:scan -- --force

   ── Run it every morning ──────────────────────────────
   macOS (launchd) — save as ~/Library/LaunchAgents/com.rudder.dailyscan.plist:
     <?xml version="1.0" encoding="UTF-8"?>
     <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
     <plist version="1.0"><dict>
       <key>Label</key><string>com.rudder.dailyscan</string>
       <key>ProgramArguments</key>
       <array>
         <string>/bin/sh</string><string>-lc</string>
         <string>cd /ABSOLUTE/PATH/TO/rudder-public/app && npm run act:scan</string>
       </array>
       <key>StartCalendarInterval</key><dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
     </dict></plist>
   Then:  launchctl load ~/Library/LaunchAgents/com.rudder.dailyscan.plist

   Linux (cron) —  crontab -e, then add:
     0 6 * * *  cd /ABSOLUTE/PATH/TO/rudder-public/app && npm run act:scan >> /tmp/rudder-scan.log 2>&1

   (You don't have to set this up — the Desk also scans itself when you open it
   on a new day. The cron/launchd job just makes it happen while Rudder is closed.)
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../src/lib/db";
import { runDailyScan } from "../src/lib/act/daily";
import { store } from "../src/lib/act";

async function main() {
  const force = process.argv.includes("--force");
  const db = getDB();

  const result = await runDailyScan(db, { force });

  if (result.alreadyToday) {
    console.log(`\n  Rudder already scanned today (${result.ranAt.slice(0, 10)}). Use --force to re-run.\n`);
  } else {
    console.log(`\n  Rudder scanned your memory — ${result.added} new ${result.added === 1 ? "item" : "items"} on the desk (${result.proposed} proposed).\n`);
  }

  const inbox = store.inbox(db, ["proposed"]);
  if (inbox.length) {
    console.log(`  Desk (${inbox.length}):`);
    for (const p of inbox.slice(0, 10)) console.log(`   • [${p.kind}] ${p.title}`);
    console.log("");
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
