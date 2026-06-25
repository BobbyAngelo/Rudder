/* ═══════════════════════════════════════════════════════════════
   Ingest · ChatGPT export connector.
   Reads OpenAI's conversations.json export locally. Each conversation
   becomes one RawDoc with flattened visible turns.
   ═══════════════════════════════════════════════════════════════ */

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

interface ParsedMessage {
  role: string;
  text: string;
  createTime?: number;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function epochToISODate(value: number): string | undefined {
  const ms = value > 1_000_000_000_000 ? value : value * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function normalizeDate(value: unknown): string | undefined {
  const n = asNumber(value);
  if (n !== undefined) return epochToISODate(n);
  const s = asString(value);
  if (!s) return undefined;
  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString().slice(0, 10);
}

function normalizeRole(role: string): string {
  switch (role) {
    case "user": return "User";
    case "assistant": return "Assistant";
    case "system": return "System";
    case "tool": return "Tool";
    default: return role ? role[0].toUpperCase() + role.slice(1) : "Unknown";
  }
}

function cleanText(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function textFromPart(part: unknown): string | undefined {
  if (typeof part === "string") return cleanText(part);
  if (!isRecord(part)) return undefined;
  const text = asString(part.text) ?? asString(part.content);
  return text ? cleanText(text) : undefined;
}

function textFromContent(content: unknown): string {
  if (!isRecord(content)) return "";
  const parts = Array.isArray(content.parts) ? content.parts : [];
  const textParts = parts.map(textFromPart).filter(Boolean) as string[];

  if (textParts.length) return textParts.join("\n\n").trim();

  const text = asString(content.text);
  if (text) return cleanText(text);

  return "";
}

function messageFromNode(node: unknown): unknown {
  return isRecord(node) ? node.message : undefined;
}

function parseMessage(message: unknown): ParsedMessage | null {
  if (!isRecord(message)) return null;
  const metadata = isRecord(message.metadata) ? message.metadata : {};
  if (metadata.is_visually_hidden_from_conversation === true) return null;

  const author = isRecord(message.author) ? message.author : {};
  const role = asString(author.role) ?? "unknown";
  const text = textFromContent(message.content);
  if (!text) return null;

  return {
    role,
    text,
    createTime: asNumber(message.create_time),
  };
}

function childrenOf(node: unknown): string[] {
  if (!isRecord(node) || !Array.isArray(node.children)) return [];
  return node.children.filter((child): child is string => typeof child === "string");
}

function parentOf(node: unknown): string | undefined {
  return isRecord(node) ? asString(node.parent) : undefined;
}

function messagesFromCurrentPath(mapping: JsonRecord, currentNode: unknown): ParsedMessage[] {
  const start = asString(currentNode);
  if (!start || !isRecord(mapping[start])) return [];

  const ids: string[] = [];
  const seen = new Set<string>();
  let id: string | undefined = start;

  while (id && !seen.has(id) && isRecord(mapping[id])) {
    ids.push(id);
    seen.add(id);
    id = parentOf(mapping[id]);
  }

  return ids.reverse()
    .map((nodeId) => parseMessage(messageFromNode(mapping[nodeId])))
    .filter(Boolean) as ParsedMessage[];
}

function messagesFromMapping(mapping: JsonRecord): ParsedMessage[] {
  const entries = Object.entries(mapping);
  const visited = new Set<string>();
  const messages: ParsedMessage[] = [];
  const roots = entries
    .filter(([, node]) => {
      const parent = parentOf(node);
      return !parent || !isRecord(mapping[parent]);
    })
    .map(([id]) => id);

  const visit = (id: string) => {
    if (visited.has(id) || !isRecord(mapping[id])) return;
    visited.add(id);
    const parsed = parseMessage(messageFromNode(mapping[id]));
    if (parsed) messages.push(parsed);
    for (const child of childrenOf(mapping[id])) visit(child);
  };

  for (const root of roots) visit(root);
  for (const [id] of entries) visit(id);
  return messages;
}

function messagesFromConversation(conversation: JsonRecord): ParsedMessage[] {
  const mapping = isRecord(conversation.mapping) ? conversation.mapping : undefined;
  if (mapping) {
    const currentPathMessages = messagesFromCurrentPath(mapping, conversation.current_node);
    return currentPathMessages.length ? currentPathMessages : messagesFromMapping(mapping);
  }

  if (!Array.isArray(conversation.messages)) return [];
  return conversation.messages
    .map(parseMessage)
    .filter(Boolean) as ParsedMessage[];
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function conversationToRawDoc(conversation: unknown, index: number): RawDoc | null {
  if (!isRecord(conversation)) return null;

  const messages = messagesFromConversation(conversation);
  if (!messages.length) return null;

  const title = asString(conversation.title)?.trim() || "(untitled ChatGPT conversation)";
  const messageDates = messages
    .map((message) => message.createTime)
    .filter((value): value is number => value !== undefined)
    .sort((a, b) => a - b);
  const date = normalizeDate(conversation.create_time) ?? normalizeDate(messageDates[0]);
  const fallbackId = `${date ?? "unknown"}:${slug(title) || "untitled"}:${index}`;
  const sourceId = asString(conversation.id)?.trim() || fallbackId;
  const body = messages
    .map((message) => `${normalizeRole(message.role)}: ${message.text}`)
    .join("\n\n")
    .trim();

  return {
    source: "chatgpt",
    sourceId,
    title,
    body,
    date,
  };
}

export function parseChatGPTExport(text: string): RawDoc[] {
  const parsed = JSON.parse(text) as unknown;
  const conversations = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.conversations)
      ? parsed.conversations
      : [];

  return conversations
    .map(conversationToRawDoc)
    .filter(Boolean) as RawDoc[];
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

export function readChatGPTExport(path: string): RawDoc[] {
  const file = exportFile(path);
  const docs = parseChatGPTExport(readFileSync(file, "utf-8"));
  return docs.map((doc) => ({
    ...doc,
    sourceId: doc.sourceId || `${basename(file)}:${doc.title}`,
    link: `file://${file}`,
  }));
}
