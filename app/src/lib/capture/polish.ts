/* ═══════════════════════════════════════════════════════
   Capture · voice → clean note (Eloquent-style polish).
   A raw transcript reads like speech — "um, so yeah, I, I think we, we should…".
   This turns it into a clean written note: filler and false starts removed,
   speech-to-text errors fixed against the names you actually know, meaning and
   facts untouched. Runs on YOUR machine (local model); never invents content.

   Every audio capture client (phone, laptop, the Rudder Recorder) gets this for
   free because they all post to /api/ingest. Best-effort: if no model is
   reachable, the raw transcript is kept — capture never fails on polish.
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";
import { executeChat, type ChatMessage } from "../ai";

export interface PolishResult {
  text: string;     // the cleaned note (or the raw transcript if polish was skipped)
  polished: boolean;
}

/** Names/terms the speaker actually uses — so the model fixes "Diego" not "Diago". */
export function captureVocab(db: Database.Database): string[] {
  const terms = new Set<string>();
  try {
    for (const r of db.prepare("SELECT name FROM identity_relationships").all() as { name: string }[]) {
      if (r.name?.trim()) terms.add(r.name.trim());
    }
  } catch { /* table may not exist */ }
  try {
    const p = db.prepare("SELECT display_name, full_name FROM identity_profile WHERE id = 1").get() as { display_name?: string; full_name?: string } | undefined;
    if (p?.full_name?.trim()) terms.add(p.full_name.trim());
    if (p?.display_name?.trim()) terms.add(p.display_name.trim());
  } catch { /* */ }
  return [...terms].slice(0, 60);
}

export function buildPolishPrompt(vocab: string[]): string {
  const vocabLine = vocab.length
    ? `\n\nKNOWN NAMES & TERMS (these are spelled correctly — use them to fix mis-transcriptions): ${vocab.join(", ")}.`
    : "";
  return `You clean up a rough voice transcription into a clear written note, in the speaker's own first-person voice.

Do:
- Remove filler words ("um", "uh", "like", "you know"), false starts, and stutters/repetition.
- Fix obvious speech-to-text errors and punctuation; add natural paragraph breaks.
- Keep the speaker's meaning, tone, and EVERY fact, name, number, and detail.

Never:
- Add information, opinions, or details that weren't said.
- Summarize away or drop content — this is a cleanup, not a summary.
- Add a preamble, title, or commentary. Output ONLY the cleaned note text.${vocabLine}`;
}

/** Polish a transcript into a clean note. Falls back to the raw text on any failure. */
export async function polishVoiceNote(raw: string, vocab: string[], mode: string): Promise<PolishResult> {
  const input = (raw || "").trim();
  if (input.length < 12) return { text: input, polished: false }; // too short to bother

  try {
    const messages: ChatMessage[] = [
      { role: "system", content: buildPolishPrompt(vocab) },
      { role: "user", content: input },
    ];
    let out = (await executeChat(messages, mode)).trim();
    // Defensive: strip a stray leading "Here's…/Cleaned note:" preamble if the model adds one.
    out = out.replace(/^(here'?s[^\n:]*:|cleaned note:|note:)\s*/i, "").trim();
    if (out.length < 2) return { text: input, polished: false };
    return { text: out, polished: true };
  } catch {
    return { text: input, polished: false }; // model unreachable → keep the raw transcript
  }
}
