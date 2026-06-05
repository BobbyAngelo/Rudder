/* ═══════════════════════════════════════════════════════
   The act loop — the drafter (Phase 2: the first verb with real output).
   A surfaced item ("you've gone quiet with Diego", "follow up with the caterer")
   becomes an actual message, written in YOUR voice and grounded in YOUR memory.

   It never sends. The draft lands on the Desk as editable text; "Use this"
   just marks it done (you copy it where you want). The confirm-before-act gate
   is unchanged — drafting produces words, nothing more.
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";
import { recall } from "../memory";
import { executeChat, type ChatMessage } from "../ai";
import { loadVoiceProfile, voiceInstruction } from "../biographer/voice";
import type { ProposalSource } from "./types";

export type DraftIntent = "reconnect" | "followup" | "reflect";

/** Pick a sensible default draft intent for the kind of thing that was surfaced. */
export function intentForKind(kind: string, title = ""): DraftIntent {
  if (kind === "surface" && /quiet|been a while/i.test(title)) return "reconnect";
  if (/on this day/i.test(title)) return "reflect";
  return "followup";
}

const INTENT_BRIEF: Record<DraftIntent, string> = {
  reconnect:
    "Write a short, warm message to reconnect with someone you've lost touch with. " +
    "Reference something real you shared (from CONTEXT). Keep it low-pressure — a genuine hello and an opening to pick things back up. No guilt, no over-explaining.",
  followup:
    "Write a brief, concrete follow-up message that closes this open loop. " +
    "Name the specific next step and any detail that matters (a date, a number, a question). Polite and to the point.",
  reflect:
    "Write a few sentences of private journal reflection on this memory — what it brought up, what it means now. First person, unforced, just for you.",
};

export interface DraftRequest {
  intent: DraftIntent;
  /** The surfaced item we're drafting from. */
  title: string;
  context: string;       // the surfaced body
  sources: ProposalSource[];
}

export interface DraftResult {
  text: string;
  intent: DraftIntent;
  sources: ProposalSource[];
}

function buildSystemPrompt(name: string, manual: string, intent: DraftIntent): string {
  const voice = voiceInstruction(loadVoiceProfile());
  const manualLine = manual.trim() ? `\nHow ${name} comes across (their own words): ${manual.trim()}` : "";
  const isJournal = intent === "reflect";
  return `You are drafting ${isJournal ? "a private journal entry" : "a message"} on behalf of ${name}, in their own voice — as if they wrote it themselves.

${INTENT_BRIEF[intent]}

Voice & craft:
- ${voice}${manualLine}
- Sound like a real person texting or emailing, not an AI. Warm, specific, human.
- Use real names and details from CONTEXT. Never invent facts, events, or specifics that aren't there.
- No placeholders like [name] or [date] — if you don't know something, write around it naturally.
- ${isJournal ? "No greeting or signature." : "No subject line. A natural sign-off is fine, but keep it light."}
- Output ONLY the ${isJournal ? "entry" : "message"} text. No preamble, no quotation marks, no notes.`;
}

/** Generate a voiced, grounded draft. Best-effort recall enriches the context. */
export async function generateDraft(
  db: Database.Database,
  req: DraftRequest,
  embed: (t: string) => Promise<number[]>,
  mode: string,
  name: string,
  manual: string,
): Promise<DraftResult> {
  // Pull a little more real context around the surfaced item.
  let recalled: ProposalSource[] = [];
  let contextStr = req.context;
  try {
    const r = await recall(db, `${req.title}. ${req.context}`, embed, { topN: 6 });
    recalled = r.sources.map((s) => ({ id: s.id, source: s.source, title: s.title, date: s.date, snippet: s.snippet }));
    if (r.chunks.length) {
      contextStr = r.chunks
        .map((c) => `(${c.source}${c.date ? ` · ${c.date}` : ""}) ${c.title}: ${c.content}`)
        .join("\n\n");
    }
  } catch { /* offline / no embeddings — fall back to the surfaced body */ }

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(name, manual, req.intent) },
    { role: "user", content: `SITUATION: ${req.title}\n\nCONTEXT (your real memory — use it, don't contradict it):\n${contextStr}\n\nWrite the ${req.intent === "reflect" ? "journal entry" : "message"} now.` },
  ];

  const text = (await executeChat(messages, mode)).trim();

  // Merge the original sources with what recall surfaced (dedupe by id).
  const byId = new Map<string, ProposalSource>();
  for (const s of [...req.sources, ...recalled]) byId.set(s.id, s);
  return { text, intent: req.intent, sources: [...byId.values()].slice(0, 6) };
}
