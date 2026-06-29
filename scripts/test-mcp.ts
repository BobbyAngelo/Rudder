import { spawn } from "child_process";
import * as path from "path";
import * as assert from "assert";

/* ═══════════════════════════════════════════════════════
   MCP Server Integration Test Harness
   Spawns rudder-mcp.ts and communicates over stdio pipelines.
   ═══════════════════════════════════════════════════════ */

const MCP_PATH = path.resolve(__dirname, "rudder-mcp.ts");

console.log("[test-mcp] Spawning MCP server process...");
const mcpProcess = spawn("node", ["--import", "tsx", MCP_PATH], {
  cwd: path.resolve(__dirname, "../app"),
  env: { 
    ...process.env, 
    NODE_ENV: "test",
    NODE_PATH: path.resolve(__dirname, "../app/node_modules")
  }
});

let buffer = "";
const pendingRequests = new Map<number | string, (res: any) => void>();
let nextId = 1;

mcpProcess.stdout.on("data", (data) => {
  buffer += data.toString();
  
  // Split JSON-RPC messages separated by newlines
  const lines = buffer.split("\n");
  buffer = lines.pop() || ""; // Keep the last incomplete chunk in the buffer

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const response = JSON.parse(line);
      console.log(`[test-mcp] ← Received response for ID [${response.id}]`);
      
      const resolve = pendingRequests.get(response.id);
      if (resolve) {
        pendingRequests.delete(response.id);
        resolve(response);
      }
    } catch (err: any) {
      console.error(`[test-mcp] Error parsing JSON-RPC line: ${line}. Error: ${err.message}`);
    }
  }
});

mcpProcess.stderr.on("data", (data) => {
  console.log(`[test-mcp stderr] ${data.toString().trim()}`);
});

mcpProcess.on("close", (code) => {
  console.log(`[test-mcp] MCP process exited with code ${code}`);
});

function sendRequest(method: string, params: any = {}): Promise<any> {
  const id = nextId++;
  const request = {
    jsonrpc: "2.0",
    id,
    method,
    params
  };
  
  return new Promise((resolve) => {
    pendingRequests.set(id, resolve);
    console.log(`[test-mcp] → Sending request: ${method} (ID: ${id})`);
    mcpProcess.stdin.write(JSON.stringify(request) + "\n");
  });
}

async function runTests() {
  try {
    // 1. Send Initialize handshake
    console.log("\n--- Test 1: Initialize Protocol Handshake ---");
    const initRes = await sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" }
    });
    
    assert.ok(initRes.result, "Initialize response should have result object");
    assert.strictEqual(initRes.result.protocolVersion, "2024-11-05", "Should match capability version");
    console.log("✅ Initialize Handshake Passed.");

    // 2. Query available tools
    console.log("\n--- Test 2: List Registered Tools ---");
    const toolsRes = await sendRequest("tools/list");
    assert.ok(toolsRes.result?.tools, "Should return registered tools list");
    
    const toolNames = toolsRes.result.tools.map((t: any) => t.name);
    console.log("Registered Tools:", toolNames);
    
    assert.ok(toolNames.includes("rudder_get_biometric_state"), "Should register 'rudder_get_biometric_state' tool");
    assert.ok(toolNames.includes("rudder_get_recent_insights"), "Should register 'rudder_get_recent_insights' tool");
    assert.ok(toolNames.includes("rudder_search_memory"), "Should register 'rudder_search_memory' tool");
    console.log("✅ Tools Registry List Passed.");

    // 3. Call rudder_get_biometric_state
    console.log("\n--- Test 3: Call rudder_get_biometric_state ---");
    const bioCall = await sendRequest("tools/call", {
      name: "rudder_get_biometric_state",
      arguments: { limit: 5 }
    });
    
    assert.ok(bioCall.result?.content, "Tool call should return content");
    assert.strictEqual(bioCall.result.content[0].type, "text", "Content should be text format");
    console.log("Vitals Response:\n", bioCall.result.content[0].text);
    assert.ok(bioCall.result.content[0].text.includes("biometric records"), "Response text should contain biometric statistics");
    console.log("✅ Biometrics Tool Call Passed.");

    // 4. Call rudder_get_recent_insights
    console.log("\n--- Test 4: Call rudder_get_recent_insights ---");
    const insightsCall = await sendRequest("tools/call", {
      name: "rudder_get_recent_insights",
      arguments: { limit: 3 }
    });
    
    assert.ok(insightsCall.result?.content, "Tool call should return content");
    assert.strictEqual(insightsCall.result.content[0].type, "text", "Content should be text format");
    console.log("Insights Response:\n", insightsCall.result.content[0].text);
    assert.ok(insightsCall.result.content[0].text.includes("correlation insights"), "Response text should contain correlation insights");
    console.log("✅ Insights Tool Call Passed.");

    console.log("\n🚀 All MCP integration tests completed successfully!");
    mcpProcess.kill("SIGTERM");
    process.exit(0);
  } catch (err: any) {
    console.error("\n💥 MCP Integration Test failed:", err.message);
    mcpProcess.kill("SIGKILL");
    process.exit(1);
  }
}

// Start tests after 1 second delay to ensure child process is alive
setTimeout(runTests, 1000);
