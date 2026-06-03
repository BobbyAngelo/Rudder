/* ═══════════════════════════════════════════════════════
   Biographer · voice + subject helpers.
   The Life Historian writes in the subject's OWN voice (learned from
   voice-profile.json) and understands what a "subject" refers to
   (a year, an era, a person, a place, or a free query).
   Pure + defensively typed so it never throws on a missing/odd profile.
   ═══════════════════════════════════════════════════════ */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "..", "data");

export type PointOfView = "memoir" | "biography" | "for-kids";
export type StoryLength = "vignette" | "chapter";

export interface VoiceProfile {
  tone?: string;
  voiceTone?: string;
  style?: string;
  avgSentenceLength?: number;
  averageSentenceLength?: number;
  commonWords?: string[];
  signatureWords?: string[];
  frequentWords?: string[];
  sample?: string;
  sampleText?: string;
  excerpt?: string;
  totalWordsAnalyzed?: number;
  total_words?: number;
  [k: string]: unknown;
}

/** Load the user's voice profile from data/writing/voice-profile.json (or null). */
export function loadVoiceProfile(): VoiceProfile | null {
  try {
    const p = join(DATA_DIR, "writing", "voice-profile.json");
    if (!existsSync(p)) return null;
    const parsed = JSON.parse(readFileSync(p, "utf-8"));
    return parsed && typeof parsed === "object" ? (parsed as VoiceProfile) : null;
  } catch {
    return null;
  }
}

/** Build a short voice-guidance string for the writer from the user's profile. */
export function voiceInstruction(profile: VoiceProfile | null): string {
  if (!profile) {
    return "Write in a warm, natural, reflective first-person voice — plain and human, never flowery or purple.";
  }
  const bits: string[] = [];
  const tone = profile.tone || profile.voiceTone || profile.style;
  if (typeof tone === "string" && tone.trim()) bits.push(`tone: ${tone.trim()}`);

  const asl = profile.avgSentenceLength ?? profile.averageSentenceLength;
  if (typeof asl === "number" && asl > 0) bits.push(`average sentence length around ${Math.round(asl)} words`);

  const words = profile.commonWords || profile.signatureWords || profile.frequentWords;
  if (Array.isArray(words) && words.length) {
    bits.push(`words they reach for: ${words.filter((w) => typeof w === "string").slice(0, 8).join(", ")}`);
  }

  let s = "Write in the subject's own writing voice";
  if (bits.length) s += ` (${bits.join("; ")})`;
  s += ". Match their rhythm and word choice — it should read like they wrote it.";

  const sample = profile.sample || profile.sampleText || profile.excerpt;
  if (typeof sample === "string" && sample.trim()) {
    s += `\nFor reference, a passage in their own words:\n"""${sample.trim().slice(0, 600)}"""`;
  }
  return s;
}

/** Point-of-view instruction for the writer. */
export function povInstruction(pov: PointOfView): string {
  switch (pov) {
    case "biography":
      return "Third person, observing the subject with warmth and intimacy.";
    case "for-kids":
      return "First person, warm and simple, as if telling the story to your children.";
    case "memoir":
    default:
      return "First person ('I') — the subject writing their own memoir.";
  }
}

export function wordTarget(length: StoryLength): number {
  return length === "chapter" ? 500 : 180;
}

export interface ParsedSubject {
  /** The raw subject, trimmed. */
  subject: string;
  /** A 4-digit year if one appears in the subject. */
  year?: number;
  /** A season if named (spring/summer/fall/autumn/winter). */
  season?: string;
  /** A short human label for the era, e.g. "Summer 2019" or "2019". */
  eraLabel?: string;
  /** An enriched query string to widen recall (subject + era cues). */
  recallQuery: string;
}

const SEASONS = ["spring", "summer", "fall", "autumn", "winter"];

/** Pull a year / season out of a free-text subject to bias recall + title. */
export function parseSubject(raw: string): ParsedSubject {
  const subject = (raw || "").trim();
  const lower = subject.toLowerCase();

  const yearMatch = subject.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? Number(yearMatch[0]) : undefined;

  const season = SEASONS.find((s) => lower.includes(s));
  const seasonLabel = season === "autumn" ? "Fall" : season ? season[0].toUpperCase() + season.slice(1) : undefined;

  let eraLabel: string | undefined;
  if (seasonLabel && year) eraLabel = `${seasonLabel} ${year}`;
  else if (year) eraLabel = String(year);
  else if (seasonLabel) eraLabel = seasonLabel;

  // Widen recall with the era cue so date-tagged memories surface.
  const recallQuery = eraLabel && !lower.includes(eraLabel.toLowerCase())
    ? `${subject} (${eraLabel})`
    : subject;

  return { subject, year, season, eraLabel, recallQuery };
}

/** A default title from the subject (the model may override). */
export function defaultTitle(parsed: ParsedSubject): string {
  const s = parsed.subject.replace(/\s+/g, " ").trim();
  if (!s) return parsed.eraLabel || "A Story";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
