import { NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const EXO_URLS = [
  "http://localhost:52415",        // Local exo
  "http://127.0.0.1:52415",   // Compute node
];

interface ModelInfo {
  id: string;
  name: string;
  provider: "ollama" | "exo" | "cloud_gemini" | "cloud_openai";
  status: "online" | "offline";
  size?: string;
  parameterSize?: string;
}

export async function GET() {
  const models: ModelInfo[] = [];

  // ── Ollama Models ──
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      for (const m of data.models || []) {
        models.push({
          id: `ollama:${m.name}`,
          name: m.name,
          provider: "ollama",
          status: "online",
          size: m.size ? formatBytes(m.size) : undefined,
          parameterSize: m.details?.parameter_size,
        });
      }
    }
  } catch {
    // Ollama not running
  }

  // ── Exo Cluster ──
  for (const url of EXO_URLS) {
    try {
      const res = await fetch(`${url}/v1/models`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        for (const m of data.data || []) {
          // Avoid duplicates
          const exoId = `exo:${m.id}`;
          if (!models.find((existing) => existing.id === exoId)) {
            models.push({
              id: exoId,
              name: m.id,
              provider: "exo",
              status: "online",
            });
          }
        }
      }
    } catch {
      // Exo node not reachable
    }
  }

  // ── Cloud Providers (always listed, status depends on env keys) ──
  models.push({
    id: "cloud_gemini",
    name: "Gemini Ultra",
    provider: "cloud_gemini",
    status: process.env.GEMINI_API_KEY ? "online" : "offline",
  });

  models.push({
    id: "cloud_openai",
    name: "OpenAI GPT-4o",
    provider: "cloud_openai",
    status: process.env.OPENAI_API_KEY ? "online" : "offline",
  });

  return NextResponse.json({ models });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
