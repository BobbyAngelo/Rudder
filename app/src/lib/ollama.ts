/* ═══════════════════════════════════════════════════════
   Ollama Client — Sovereign LLM Interface
   Connects to local Ollama for chat + embeddings
   ═══════════════════════════════════════════════════════ */

const OLLAMA_HOSTS = [
  process.env.OLLAMA_URL || "http://localhost:11434",      // RUDDER (local)
  "http://127.0.0.1:11434",                            // CASE (compute node)
];

let _activeHost: string | null = null;

async function getOllamaHost(): Promise<string> {
  if (_activeHost) {
    // Quick check if still alive
    try {
      const res = await fetch(`${_activeHost}/api/tags`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return _activeHost;
    } catch { /* try others */ }
  }
  for (const host of OLLAMA_HOSTS) {
    try {
      const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) { _activeHost = host; return host; }
    } catch { /* next */ }
  }
  throw new Error("No Ollama host reachable (tried RUDDER + CASE)");
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Chat completion via Ollama
 */
export async function ollamaChat(
  messages: OllamaMessage[],
  model: string = "llama3.2:latest"
): Promise<string> {
  const host = await getOllamaHost();
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) {
    throw new Error(`Ollama chat failed (${host}): ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.message?.content || "";
}

/**
 * Generate embeddings via Ollama
 */
export async function ollamaEmbed(
  text: string,
  model: string = "nomic-embed-text"
): Promise<number[]> {
  const host = await getOllamaHost();
  const res = await fetch(`${host}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: text }),
  });

  if (!res.ok) {
    throw new Error(`Ollama embed failed (${host}): ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.embeddings?.[0] || [];
}

/**
 * Check if Ollama is reachable
 */
export async function ollamaStatus(): Promise<{ online: boolean; models: string[]; host: string }> {
  try {
    const host = await getOllamaHost();
    const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { online: false, models: [], host: "none" };
    const data = await res.json();
    return {
      online: true,
      models: ((data.models || []) as { name: string }[]).map((m) => m.name),
      host,
    };
  } catch {
    return { online: false, models: [], host: "none" };
  }
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}
