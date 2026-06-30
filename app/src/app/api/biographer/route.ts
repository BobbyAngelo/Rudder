import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-error";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { join } from "path";
import { getDB } from "@/lib/db";

const DATA_DIR = join(process.cwd(), "..", "data");

interface LifeStory {
  sections?: unknown[];
  totalWordCount?: number;
  totalAnswers?: number;
  lastUpdated?: string | null;
}

interface VoiceProfile {
  totalWordsAnalyzed?: number;
  total_words?: number;
}

interface BiographerSession {
  timestamp?: string;
  source?: string;
  nodeId?: string;
  answer?: string;
  answerLength?: number;
  questionAsked?: string;
  technique?: string;
  sessionId?: string;
  [key: string]: unknown;
}

interface QaPair {
  question?: string;
  answer?: string;
  timestamp?: string;
}

interface BiographerPostBody {
  title?: string;
  content?: string;
  qaPairs?: QaPair[];
}

function loadJSON<T>(subpath: string): T | null {
  const fullPath = join(DATA_DIR, subpath);
  if (!existsSync(fullPath)) return null;
  try { return JSON.parse(readFileSync(fullPath, "utf-8")) as T; } catch { return null; }
}

export async function GET() {
  try {
    const lifeStory = loadJSON<LifeStory>("writing/life_story.json") || {};
    const lifeEvents = loadJSON<unknown[]>("writing/life-events.json") || [];
    const voiceProfile = loadJSON<VoiceProfile>("writing/voice-profile.json") || {};

    // Parse biographer sessions (JSONL)
    const sessionsPath = join(DATA_DIR, "writing/biographer_sessions.jsonl");
    let sessions: BiographerSession[] = [];
    if (existsSync(sessionsPath)) {
      const lines = readFileSync(sessionsPath, "utf-8").split("\n").filter(l => l.trim());
      sessions = lines
        .map(l => { try { return JSON.parse(l) as BiographerSession; } catch { return null; } })
        .filter((s): s is BiographerSession => s !== null);
    }

    return NextResponse.json({
      chapters: lifeStory.sections || [],
      totalWords: lifeStory.totalWordCount || 0,
      totalAnswers: lifeStory.totalAnswers || 0,
      lastUpdated: lifeStory.lastUpdated || null,
      sessions,
      lifeEvents: Array.isArray(lifeEvents) ? lifeEvents : [],
      voiceStats: {
        totalWords: voiceProfile.totalWordsAnalyzed || voiceProfile.total_words || 0,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { title, content, qaPairs } = (await request.json()) as BiographerPostBody;

    if (!title || !content || !Array.isArray(qaPairs)) {
      return NextResponse.json({ error: "Missing required fields: title, content, or qaPairs" }, { status: 400 });
    }

    const db = getDB();

    // Find the Knowledge Base folder to prevent cluttering the root and mixing human notes with AI output
    const kbFolder = db.prepare(
      "SELECT id FROM journal_entries WHERE is_folder = 1 AND (meta_json LIKE '%\"context_type\":\"doing_knowledge_base\"%' OR title = 'Knowledge Base') LIMIT 1"
    ).get() as { id: number } | undefined;
    const parentId = kbFolder ? kbFolder.id : null;

    // 1. Insert into journal_entries table
    const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;
    db.prepare(
      `INSERT INTO journal_entries (title, content, mode, word_count, tags, meta_json, is_folder, parent_id)
       VALUES (?, ?, 'biographer', ?, '[]', '{}', 0, ?)`
    ).run(title, content, wordCount, parentId);

    // 2. Append to biographer_sessions.jsonl
    const sessionsPath = join(DATA_DIR, "writing/biographer_sessions.jsonl");
    const sessionId = `session-${Date.now()}`;
    const timestamp = new Date().toISOString();

    for (const qa of qaPairs) {
      const qText = qa.question || "";
      const aText = qa.answer || "";
      const aWords = aText.split(/\s+/).filter((w: string) => w.length > 0).length;

      const line = {
        timestamp: qa.timestamp || timestamp,
        source: "intranet",
        nodeId: "life-interview",
        answer: aText,
        answerLength: aWords,
        questionAsked: qText,
        technique: "conversational_interview",
        sessionId: sessionId
      };

      appendFileSync(sessionsPath, JSON.stringify(line) + "\n", "utf-8");
    }

    // 3. Update totalAnswers and totalWordCount in life_story.json
    const lifeStoryPath = join(DATA_DIR, "writing/life_story.json");
    if (existsSync(lifeStoryPath)) {
      try {
        const story = JSON.parse(readFileSync(lifeStoryPath, "utf-8")) as LifeStory;
        story.totalAnswers = (story.totalAnswers || 0) + qaPairs.length;
        story.totalWordCount = (story.totalWordCount || 0) + wordCount;
        story.lastUpdated = new Date().toISOString();
        writeFileSync(lifeStoryPath, JSON.stringify(story, null, 2), "utf-8");
      } catch (err) {
        log.error("Failed to update life_story.json stats:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("[api/biographer] POST error:", error);
    return serverError(error);
  }
}
