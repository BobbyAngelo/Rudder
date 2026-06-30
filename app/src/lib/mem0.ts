import { log } from "./logger";
/* ═══════════════════════════════════════════════════════
   Mem0 — Persistent Learning Memory Layer
   The "librarian" that sits between inference and storage.

   Unlike RAG (which retrieves over existing structured life
   data), Mem0 watches conversations, extracts durable facts
   and preferences, and recalls them in later sessions.

   Sovereign config: local Ollama for both the LLM (fact
   extraction) and the embedder, with a local Qdrant vector
   store. No API keys, nothing leaves the machine.

   Everything here degrades gracefully: if the mem0ai package
   isn't installed or Qdrant/Ollama is unreachable, the helpers
   return safe empties and the app keeps working without memory.
   ═══════════════════════════════════════════════════════ */

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const MEM0_LLM_MODEL = process.env.MEM0_LLM_MODEL || "llama3.2:latest";
const MEM0_EMBED_MODEL = process.env.EMBED_MODEL || "nomic-embed-text";
const MEM0_EMBED_DIMS = Number(process.env.MEM0_EMBED_DIMS || 768); // nomic-embed-text = 768
const MEM0_COLLECTION = process.env.MEM0_COLLECTION || "rudder_memories";
const MEM0_ENABLED = (process.env.MEM0_ENABLED ?? "true").toLowerCase() !== "false";

// Single sovereign user for this local-first OS.
export const DEFAULT_USER_ID = process.env.MEM0_USER_ID || "sovereign";

export interface MemoryMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface MemoryHit {
  id?: string;
  memory: string;
  score?: number;
}

/* ── Lazy, cached Mem0 client ──
   mem0ai's OSS bundle statically requires optional providers, so
   we import it lazily inside try/catch and never let a failure
   bubble into a request. */

interface MemoryClient {
  add(messages: MemoryMessage[], opts: { userId: string }): Promise<unknown>;
  search(query: string, opts: { topK: number; filters: { user_id: string } }): Promise<unknown>;
  getAll(opts: { filters: { user_id: string } }): Promise<unknown>;
  delete(memoryId: string): Promise<unknown>;
}

interface RawMemoryHit {
  id?: string;
  memory?: string;
  text?: string;
  score?: number;
}

type MemoryConstructor = new (config: unknown) => MemoryClient;

let _memoryPromise: Promise<MemoryClient | null> | null = null;

async function getMemory(): Promise<MemoryClient | null> {
  if (!MEM0_ENABLED) return null;
  if (_memoryPromise) return _memoryPromise;

  _memoryPromise = (async () => {
    try {
      // Dynamic import keeps mem0ai fully optional at build/runtime.
      const mod = (await import("mem0ai/oss")) as unknown as {
        Memory?: MemoryConstructor;
        default?: MemoryConstructor & { Memory?: MemoryConstructor };
      };
      const Memory = mod.Memory || mod.default?.Memory || mod.default;
      if (!Memory) return null;

      const memory = new Memory({
        version: "v1.1",
        llm: {
          provider: "ollama",
          config: { model: MEM0_LLM_MODEL, url: OLLAMA_URL },
        },
        embedder: {
          provider: "ollama",
          config: { model: MEM0_EMBED_MODEL, url: OLLAMA_URL },
        },
        vectorStore: {
          provider: "qdrant",
          config: {
            collectionName: MEM0_COLLECTION,
            dimension: MEM0_EMBED_DIMS,
            url: QDRANT_URL,
          },
        },
      });

      return memory;
    } catch (err) {
      log.warn("[mem0] memory layer unavailable:", (err as Error)?.message || err);
      return null;
    }
  })();

  return _memoryPromise;
}

/** Is the Mem0 layer configured and importable? */
export async function memoryAvailable(): Promise<boolean> {
  return (await getMemory()) !== null;
}

/**
 * Extract and persist memories from a conversation turn.
 * Fire-and-forget friendly: never throws.
 */
export async function addMemory(
  messages: MemoryMessage[],
  userId: string = DEFAULT_USER_ID
): Promise<void> {
  try {
    const memory = await getMemory();
    if (!memory) return;
    await memory.add(messages, { userId });
  } catch (err) {
    log.warn("[mem0] addMemory failed:", (err as Error)?.message || err);
  }
}

/**
 * Recall the most relevant stored memories for a query.
 * Returns [] on any failure so callers can proceed without memory.
 */
export async function searchMemory(
  query: string,
  userId: string = DEFAULT_USER_ID,
  limit: number = 5
): Promise<MemoryHit[]> {
  try {
    const memory = await getMemory();
    if (!memory) return [];
    const res = await memory.search(query, { topK: limit, filters: { user_id: userId } });
    const results: RawMemoryHit[] = Array.isArray(res)
      ? (res as RawMemoryHit[])
      : (res as { results?: RawMemoryHit[] })?.results || [];
    return results.map((r) => ({
      id: r.id,
      memory: r.memory ?? r.text ?? "",
      score: r.score,
    }));
  } catch (err) {
    log.warn("[mem0] searchMemory failed:", (err as Error)?.message || err);
    return [];
  }
}

/** List all stored memories for the user. */
export async function getAllMemories(userId: string = DEFAULT_USER_ID): Promise<MemoryHit[]> {
  try {
    const memory = await getMemory();
    if (!memory) return [];
    const res = await memory.getAll({ filters: { user_id: userId } });
    const results: RawMemoryHit[] = Array.isArray(res)
      ? (res as RawMemoryHit[])
      : (res as { results?: RawMemoryHit[] })?.results || [];
    return results.map((r) => ({
      id: r.id,
      memory: r.memory ?? r.text ?? "",
      score: r.score,
    }));
  } catch (err) {
    log.warn("[mem0] getAllMemories failed:", (err as Error)?.message || err);
    return [];
  }
}

/** Delete a single memory by id. Returns true on success. */
export async function deleteMemory(memoryId: string): Promise<boolean> {
  try {
    const memory = await getMemory();
    if (!memory) return false;
    await memory.delete(memoryId);
    return true;
  } catch (err) {
    log.warn("[mem0] deleteMemory failed:", (err as Error)?.message || err);
    return false;
  }
}

/**
 * Render recalled memories as a compact context block for prompt
 * injection. Returns "" when there's nothing to add.
 */
export function formatMemoriesForPrompt(hits: MemoryHit[]): string {
  const lines = hits.map(h => h.memory).filter(Boolean);
  if (lines.length === 0) return "";
  return `What you remember about the user from past conversations:\n${lines.map(l => `- ${l}`).join("\n")}`;
}
