/* ═══════════════════════════════════════════════════════
   Telemetry simulator

   Posts synthetic biometric/environment vitals to Rudder's local telemetry
   gate, so the full ingest path (reality_nodes + health_metrics) can be tested
   without physical hardware.

   Usage (from app/ or repo root):
     node --import tsx ../scripts/simulate-telemetry.ts            # one shot
     node --import tsx ../scripts/simulate-telemetry.ts --count 5  # 5 sends
     node --import tsx ../scripts/simulate-telemetry.ts --watch --interval 10
     RUDDER_DEVICE_TOKEN=secret node --import tsx ../scripts/simulate-telemetry.ts

   Flags:
     --host <url>      Base URL (default http://localhost:3000, or RUDDER_HOST)
     --device <id>     device_id to report (default "sim-esp32-01")
     --interval <sec>  Seconds between sends in watch mode (default 10)
     --count <n>       Send n payloads then exit (ignored with --watch)
     --watch           Stream continuously until Ctrl-C
   ═══════════════════════════════════════════════════════ */

interface Args {
  host: string;
  device: string;
  interval: number;
  count: number;
  watch: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    host: process.env.RUDDER_HOST || "http://localhost:3000",
    device: "sim-esp32-01",
    interval: 10,
    count: 1,
    watch: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--watch") args.watch = true;
    else if (a === "--host") args.host = argv[++i] ?? args.host;
    else if (a === "--device") args.device = argv[++i] ?? args.device;
    else if (a === "--interval") args.interval = Number(argv[++i]) || args.interval;
    else if (a === "--count") args.count = Number(argv[++i]) || args.count;
  }
  return args;
}

function jitter(base: number, spread: number): number {
  return Math.round(base + (Math.random() * 2 - 1) * spread);
}

/** A plausible reading; steps accumulate across a watch session. */
function reading(stepBase: number): Record<string, number> {
  return {
    heart_rate: jitter(64, 8),
    hrv: jitter(55, 12),
    steps: stepBase + jitter(120, 60),
    sleep_hours: Math.round((6.5 + Math.random() * 1.5) * 10) / 10,
  };
}

async function send(args: Args, metrics: Record<string, number>): Promise<void> {
  const url = `${args.host.replace(/\/$/, "")}/api/ingest/telemetry`;
  const token = process.env.RUDDER_DEVICE_TOKEN;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["X-Device-Token"] = token;

  const body = {
    device_id: args.device,
    classification: "Simulated Telemetry",
    timestamp: new Date().toISOString(),
    metrics,
  };

  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const text = await res.text();
    const tag = res.ok ? "✓" : "✗";
    console.log(`${tag} ${res.status} ${url}  hr=${metrics.heart_rate} hrv=${metrics.hrv} steps=${metrics.steps}`);
    if (!res.ok) {
      console.log(`   response: ${text}`);
      if (res.status === 401) {
        console.log("   hint: RUDDER_DEVICE_TOKEN must match the server's value (or be unset on both).");
      }
    }
  } catch (err) {
    console.error(`✗ request failed: ${err instanceof Error ? err.message : String(err)}`);
    console.error(`   is the dev server running at ${args.host}?  (cd app && npm run dev)`);
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[telemetry-sim] target=${args.host} device=${args.device} ` +
      `mode=${args.watch ? `watch (${args.interval}s)` : `${args.count} send(s)`} ` +
      `token=${process.env.RUDDER_DEVICE_TOKEN ? "set" : "none"}`,
  );

  let steps = 0;
  if (args.watch) {
    // Continuous stream until interrupted.
    for (;;) {
      steps += jitter(150, 80);
      await send(args, reading(steps));
      await new Promise((r) => setTimeout(r, args.interval * 1000));
    }
  } else {
    for (let i = 0; i < args.count; i++) {
      steps += jitter(150, 80);
      await send(args, reading(steps));
      if (i < args.count - 1) await new Promise((r) => setTimeout(r, 300));
    }
  }
}

void main();
