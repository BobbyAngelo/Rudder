import { NextResponse } from "next/server";
import { buildContextChunks, retrieveChunksHybrid } from "@/lib/rag";
import { ollamaChat, ollamaStatus } from "@/lib/ollama";
import { condenseHistory } from "@/lib/ai";
import { searchMemory, addMemory, formatMemoriesForPrompt } from "@/lib/mem0";

export async function POST(req: Request) {
  try {
    const { query, messages = [] } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "No query provided" }, { status: 400 });
    }

    // 1. Verify Ollama is online
    const status = await ollamaStatus();

    // 2. Intercept and bypass ping queries
    if (query === "ping") {
      return NextResponse.json({
        online: status.online,
        host: status.host,
        text: status.online ? "Ollama cluster online." : "Ollama cluster offline."
      }, { status: status.online ? 200 : 503 });
    }

    if (!status.online) {
      return NextResponse.json({ 
        error: "Ollama cluster offline", 
        detail: "Cannot reach RUDDER or CASE compute nodes." 
      }, { status: 503 });
    }

    // 2. Build RAG Context (hybrid semantic + keyword retrieval)
    const chunks = buildContextChunks();
    const [relevant, memHits] = await Promise.all([
      retrieveChunksHybrid(chunks, query, 10),
      searchMemory(query),
    ]);

    let contextStr = "";
    if (relevant.length > 0) {
      contextStr = relevant.map(c => `[Source: ${c.source}] ${c.title}\n${c.content}`).join("\n\n");
    } else {
      contextStr = "No specifically matching sovereign data found for this query.";
    }

    // 2b. Recalled long-term memories (Mem0)
    const memoryStr = formatMemoriesForPrompt(memHits);

    // 3. Build Prompt
    const systemPrompt = `You are Rudder, the Sovereign AI assistant for Sovereign User.
Your job is to answer questions using ONLY the provided context from his life, career, hardware projects, and health ledger.
If the context does not contain the answer, say "I don't have that in your sovereign ledger."
Do not hallucinate external information. Keep your answers concise, direct, and actionable.
${memoryStr ? `\n${memoryStr}\n` : ""}
Here is the retrieved context:
---------------------
${contextStr}
---------------------
`;

    // 4. Format Messages
    const chatMessages: any[] = [
      { role: "system", content: systemPrompt }
    ];

    // Add previous history
    for (const msg of messages) {
      chatMessages.push(msg);
    }
    
    // Add current query
    chatMessages.push({ role: "user", content: query });

    const optimizedMessages = condenseHistory(chatMessages, 5);

    // 5. Inference
    const responseText = await ollamaChat(optimizedMessages, "llama3.2:latest");

    // 6. Capture durable memories from this exchange (fire-and-forget,
    //    never blocks or fails the response).
    void addMemory([
      { role: "user", content: query },
      { role: "assistant", content: responseText },
    ]);

    return NextResponse.json({
      text: responseText,
      contextUsed: relevant.length,
      model: "llama3.2:latest",
      host: status.host
    });

  } catch (err: any) {
    console.error("Chat API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
