import { fork, spawn } from "child_process";
import path from "path";
import fs from "fs";

const IMPORTER_MAP: Record<string, string> = {
  migrate: "migrate.ts",
  linkedin: "import-linkedin.ts",
  health: "migrate-health.ts",
  writing: "migrate-writing.ts",
  "scan-tars": "scan-tars20.ts",
  outlook: "scan-outlook-enrichment.py",
};

export async function importCommand(importer: string, args: string[] = []) {
  const scriptName = IMPORTER_MAP[importer];

  if (!scriptName) {
    console.error(`Error: Unknown importer '${importer}'`);
    console.log("");
    console.log("Available importers:");
    Object.keys(IMPORTER_MAP).forEach((key) => {
      console.log(`  - ${key}`);
    });
    process.exit(1);
  }

  // CLI runs from package directory, find root scripts path
  // cli/src/commands/import.ts -> scripts/importers/
  const rootDir = path.resolve(process.cwd());
  const scriptPath = path.join(rootDir, "scripts", "importers", scriptName);

  if (!fs.existsSync(scriptPath)) {
    console.error(`Error: Importer script not found at ${scriptPath}`);
    process.exit(1);
  }

  console.log(`[cli] Launching importer: ${importer} (${scriptName})...`);
  console.log("");

  const cliNodeModules = path.join(rootDir, "cli", "node_modules");
  const appNodeModules = path.join(rootDir, "app", "node_modules");
  const nodePath = `${cliNodeModules}:${appNodeModules}:${process.env.NODE_PATH || ""}`;

  if (scriptName.endsWith(".py")) {
    const child = spawn("python3", [scriptPath, ...args], { stdio: "inherit", cwd: rootDir });
    child.on("close", (code) => {
      process.exit(code || 0);
    });
  } else {
    // Execute using spawn with npx tsx
    const child = spawn("npx", ["tsx", scriptPath, ...args], {
      stdio: "inherit",
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_PATH: nodePath,
      }
    });
    child.on("close", (code) => {
      process.exit(code || 0);
    });
  }
}
