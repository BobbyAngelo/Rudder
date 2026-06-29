import { addMemory, searchMemory, getAllMemories, memoryAvailable } from "./mem0";

/* ═══════════════════════════════════════════════════════
   Mem0 Test Script
   ═══════════════════════════════════════════════════════ */

async function main() {
  console.log("[test-mem0] Checking if Mem0 is available...");
  const available = await memoryAvailable();
  
  if (!available) {
    console.warn("⚠️ Mem0 memory layer is not available or disabled.");
    console.log("Check if 'mem0ai' package is installed and Qdrant/Ollama are running.");
    process.exit(0);
  }
  
  console.log("✅ Mem0 is available. Testing memory ingestion...");
  
  const testUserId = `test_user_${Date.now()}`;
  const conversation = [
    { role: "user" as const, content: "My name is Robert. I am a technical lead building Rudder OS." },
    { role: "assistant" as const, content: "Nice to meet you, Robert. I am here to help you build Rudder OS." },
    { role: "user" as const, content: "I prefer coding in TypeScript and using SQLite for database storage." }
  ];
  
  console.log(`[test-mem0] Ingesting conversation logs for user: ${testUserId}...`);
  await addMemory(conversation, testUserId);
  
  console.log("[test-mem0] Waiting 2 seconds for local LLM extraction...");
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  console.log("[test-mem0] Searching memories matching 'preferred database'...");
  const databaseMemories = await searchMemory("preferred database", testUserId);
  console.log("Search Results:", databaseMemories);
  
  console.log("[test-mem0] Retrieving all memories for the user...");
  const allMemories = await getAllMemories(testUserId);
  console.log("All Memories:", allMemories);
  
  if (allMemories.length > 0) {
    console.log("🚀 Mem0 integration successfully ingested and retrieved facts!");
  } else {
    console.warn("⚠️ No memories extracted. Ensure Ollama is running and has the llama3.2 model pulled.");
  }
}

main().catch((err) => {
  console.error("❌ Mem0 Test failed:", err);
  process.exit(1);
});
