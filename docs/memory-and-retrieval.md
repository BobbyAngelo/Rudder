# Memory & Retrieval

Rudder now has two distinct intelligence layers on top of local inference. They are independent — either can be disabled without affecting the other.

## 1. Semantic retrieval (Rudder's own RAG, upgraded)

Previously, `retrieveChunks()` scored chunks by keyword overlap only. Retrieval is now **hybrid**: query and chunks are embedded with the local Ollama embedder (`nomic-embed-text`), ranked by cosine similarity, with a small keyword/title bonus so exact-name matches still surface.

Embeddings are **persisted** in the main `rudder.db` (`chunk_embeddings` table) and keyed by a content hash, so a chunk is only re-embedded when its text changes. Steady-state queries embed nothing but the query itself.

- Module: `app/src/lib/embeddings.ts`
- Migration: `029_chunk_embeddings` in `app/src/lib/db.ts`
- Entry point: `retrieveChunksHybrid(chunks, query, topN)` in `app/src/lib/rag.ts`

If Ollama is offline or nothing is embedded yet, it falls back automatically to the original keyword `retrieveChunks()`. The old function is unchanged and still exported.

### Setup

```bash
ollama pull nomic-embed-text   # 768-dim embedder
```

## 2. Mem0 — long-term learning memory

Mem0 is the layer that *learns over time*. It watches conversations, extracts durable facts and preferences, and recalls them in later sessions. It complements (does not replace) RAG: RAG retrieves over your existing structured life-data; Mem0 remembers things said in conversation.

Configured fully sovereign: local Ollama for both fact-extraction LLM and embedder, with a local Qdrant vector store. No API keys, nothing leaves the machine.

- Module: `app/src/lib/mem0.ts`
- Management API: `app/src/app/api/memory/route.ts` (`GET` search/list, `POST` add, `DELETE`)
- Auto-capture: `/api/chat` and `/api/ask` recall relevant memories before answering and store each exchange afterward (non-blocking).

### Setup

```bash
# 1. Run a local Qdrant (persistent across restarts)
docker run -d -p 6333:6333 -v "$(pwd)/data/qdrant:/qdrant/storage" qdrant/qdrant

# 2. Ensure the models Mem0 uses are present
ollama pull llama3.2          # fact extraction
ollama pull nomic-embed-text  # embeddings
```

Set `MEM0_ENABLED=false` in `.env.local` to turn the whole layer off. Every helper degrades gracefully if Qdrant or Ollama is unreachable — requests still succeed, just without memory.

### Configuration

All keys live in `app/.env.example`. The important ones:

| Var | Default | Notes |
| --- | --- | --- |
| `MEM0_ENABLED` | `true` | Master switch |
| `QDRANT_URL` | `http://localhost:6333` | Local Qdrant |
| `OLLAMA_URL` | `http://localhost:11434` | Shared with inference |
| `MEM0_LLM_MODEL` | `llama3.2:latest` | Fact extraction |
| `EMBED_MODEL` | `nomic-embed-text` | Shared by both layers |
| `MEM0_EMBED_DIMS` | `768` | Must match the embedder |

> Note: `MEM0_EMBED_DIMS` must match your embedder's output (768 for `nomic-embed-text`). If you swap embedders, update this and recreate the Qdrant collection.
