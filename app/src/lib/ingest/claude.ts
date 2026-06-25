/* =======================================================================
   Ingest | Claude export connector.
   Reads Anthropic Claude's conversations.json export locally. Each conversation
   becomes one RawDoc with flattened visible turns.
   ======================================================================= */

import { existsSync, readFileSync, statSync } from "fs";
import { basename, extname, join } from "path";

export interface RawDoc {
  source: string;
  sourceId?: string;
  title: string;
  body: string;
  date?: string;
  link?: string;
}

type JsonRecord = Record<string, unknown>;

interface ClaudeMessage {
  uuid?: string;
  sender?: string;
  text?: string;
  created_at?: string;
}

interface ClaudeConversation {
  uuid?: string;
  name?: string;
  created_at?: string;
  chat_messages?: ClaudeMessage[];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRole(role: string): string {
  switch (role.toLowerCase()) {
    case "human":
    case "user":
      return "User";
    case "assistant":
    case "claude":
      return "Assistant";
    case "system":
      return "System";
    default:
      return role ? role[0].toUpperCase() + role.slice(1) : "Unknown";
  }
}

export function parseClaudeExport(text: string): RawDoc[] {
  const parsed = JSON.parse(text) as unknown;
  const conversations = Array.isArray(parsed) ? parsed : [];
  const results: RawDoc[] = [];

  conversations.forEach((conv: unknown, index: number) => {
    if (!isRecord(conv)) return;

    const messages = Array.isArray(conv.chat_messages) ? conv.chat_messages : [];
    if (!messages.length) return;

    const title = (conv.name as string)?.trim() || "(untitled Claude conversation)";
    const sourceId = (conv.uuid as string)?.trim() || `claude-${index}`;
    
    // Sort messages by created_at if available
    const sortedMessages = [...messages].sort((a: any, b: any) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return aTime - bTime;
    });

    const body = sortedMessages
      .map((msg: any) => {
        const sender = normalizeRole(msg.sender || "human");
        const textVal = (msg.text as string) || "";
        return `${sender}: ${textVal}`;
      })
      .join("\n\n")
      .trim();

    let date: string | undefined;
    if (conv.created_at) {
      date = new Date(conv.created_at as string).toISOString().slice(0, 10);
    } else if (sortedMessages[0]?.created_at) {
      date = new Date(sortedMessages[0].created_at).toISOString().slice(0, 10);
    }

    results.push({
      source: "claude",
      sourceId,
      title,
      body,
      date,
    });
  });

  return results;
}

function exportFile(path: string): string {
  const st = statSync(path);
  if (st.isDirectory()) {
    const file = join(path, "conversations.json");
    if (!existsSync(file) || !statSync(file).isFile()) {
      throw new Error(`Folder does not contain conversations.json: ${path}`);
    }
    return file;
  }

  if (!st.isFile() || extname(path).toLowerCase() !== ".json") {
    throw new Error(`Expected conversations.json or a compatible .json file: ${path}`);
  }
  return path;
}

export function readClaudeExport(path: string): RawDoc[] {
  const file = exportFile(path);
  const docs = parseClaudeExport(readFileSync(file, "utf-8"));
  return docs.map((doc) => ({
    ...doc,
    sourceId: doc.sourceId || `${basename(file)}:${doc.title}`,
    link: `file://${file}`,
  }));
}
