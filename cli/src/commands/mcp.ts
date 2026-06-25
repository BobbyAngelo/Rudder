import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export async function mcpCommand() {
  // Find project root directory relative to the CLI package directory
  // In dev, cwd is project root. In binary execution, resolve relative to file location.
  const rootDir = path.resolve(process.cwd());
  const scriptPath = path.join(rootDir, "scripts", "rudder-mcp.ts");
  
  if (!fs.existsSync(scriptPath)) {
    console.error(`Error: Rudder MCP script not found at: ${scriptPath}`);
    process.exit(1);
  }

  console.log(`[cli] Starting Rudder MCP server...`);
  console.log(`[cli] Listening on stdio (JSON-RPC 2.0)...`);
  console.log("");

  const child = spawn("npx", ["tsx", scriptPath], {
    stdio: "inherit",
    cwd: rootDir,
  });
  
  child.on("close", (code) => {
    process.exit(code || 0);
  });
}
