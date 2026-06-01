import { NCIBiometricState, NCIFactory, NCIPrompt } from './nci_factory';

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function condenseHistory(history: ChatMessage[], maxTurns: number = 5): ChatMessage[] {
  const systemMessages = history.filter(m => m.role === "system");
  const nonSystemMessages = history.filter(m => m.role !== "system");
  
  if (nonSystemMessages.length <= maxTurns * 2) {
    return history;
  }
  
  const recentMessages = nonSystemMessages.slice(-(maxTurns * 2));
  
  const summaryMessage: ChatMessage = {
    role: "user",
    content: `[System Note: Previous conversation context has been truncated to optimize memory. Only the last ${maxTurns} turns are shown below.]`
  };
  
  return [...systemMessages, summaryMessage, ...recentMessages];
}

export async function executeChat(messages: ChatMessage[], mode: string = "local_ollama"): Promise<string> {
  let answer = "";
  
  if (mode.startsWith("exo:")) {
    const modelName = mode.split("exo:")[1];
    const exoUrls = [
      process.env.EXO_URL || "http://localhost:52415",
      ...(process.env.EXO_FALLBACK_URLS || "").split(",").map((h) => h.trim()).filter(Boolean),
    ];
    let success = false;
    for (const url of exoUrls) {
      try {
        const res = await fetch(`${url}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: modelName, messages, temperature: 0.7 }),
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
          const data = await res.json();
          answer = data.choices[0].message.content;
          success = true;
          break;
        }
      } catch { /* Try next exo node */ }
    }
    if (!success) throw new Error("Exo cluster is unreachable.");
  } else if (mode === "cloud_gemini") {
    if (!process.env.GEMINI_API_KEY) throw new Error("Gemini API key missing");
    
    // Convert messages for Gemini
    const systemInstruction = messages.find(m => m.role === "system")?.content;
    const contents = messages.filter(m => m.role !== "system").map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        contents,
      }),
    });
    const data = await res.json();
    answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini";
  } else if (mode === "cloud_openai") {
    if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI API key missing");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.7 }),
    });
    const data = await res.json();
    answer = data.choices?.[0]?.message?.content || "No response from OpenAI";
  } else {
    // Fallback to local Ollama
    const modelName = mode.startsWith("ollama:") ? mode.split("ollama:")[1] : "llama3.2:latest";
    const ollamaUrls = [
      process.env.OLLAMA_URL || "http://localhost:11434",
      ...(process.env.OLLAMA_FALLBACK_URLS || "").split(",").map((h) => h.trim()).filter(Boolean),
    ];
    let success = false;
    for (const url of ollamaUrls) {
      try {
        const res = await fetch(`${url}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: modelName, messages, stream: false }),
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
          const data = await res.json();
          answer = data.message?.content || "";
          success = true;
          break;
        }
      } catch { /* Try next ollama node */ }
    }
    if (!success) throw new Error("Local Ollama is unreachable.");
  }
  
  return answer;
}

export type NCILensType = "reversal" | "impossible_question" | "presupposition" | "label" | "witness" | "exit_seal";

export async function executeNCIReflection(
  lens: NCILensType,
  state: NCIBiometricState,
  mode: string = "local_ollama"
): Promise<string> {
  let prompt: NCIPrompt;

  switch (lens) {
    case "reversal":
      prompt = NCIFactory.buildReversal(state);
      break;
    case "impossible_question":
      prompt = NCIFactory.buildImpossibleQuestion(state.activeProject || "Sovereign Development");
      break;
    case "presupposition":
      prompt = NCIFactory.buildPresupposition(state);
      break;
    case "label":
      prompt = NCIFactory.buildLabelAndReframe(state.recentReflections || "");
      break;
    case "witness":
      prompt = NCIFactory.buildWitness(state);
      break;
    case "exit_seal":
      prompt = NCIFactory.buildExitSeal(state);
      break;
    default:
      throw new Error(`Unsupported NCI lens: ${lens}`);
  }

  const messages: ChatMessage[] = [
    { role: "system", content: prompt.systemPrompt },
    { role: "user", content: prompt.userPrompt }
  ];

  return executeChat(messages, mode);
}
