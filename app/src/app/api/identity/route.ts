import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { indexIdentity } from "@/lib/identity";
import { ollamaEmbed } from "@/lib/ollama";

/* ═══════════════════════════════════════════════════════
   /api/identity — Profile CRUD
   
   GET  → Returns the profile + values + milestones + links
   PUT  → Updates the profile fields
   ═══════════════════════════════════════════════════════ */

export async function GET() {
  try {
    const db = getDB();

    const profile = db.prepare("SELECT * FROM identity_profile WHERE id = 1").get();
    const values = db.prepare("SELECT * FROM identity_values ORDER BY priority ASC").all();
    const milestones = db
      .prepare("SELECT * FROM identity_milestones ORDER BY date DESC")
      .all();
    const links = db.prepare("SELECT * FROM identity_links ORDER BY id ASC").all();

    return NextResponse.json({
      profile,
      values,
      milestones,
      links,
    });
  } catch (error: any) {
    console.error("[api/identity] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDB();
    const body = await request.json();

    // Update profile fields
    if (body.profile) {
      const fields = body.profile;
      const sets: string[] = [];
      const params: Record<string, any> = {};

      const allowed = [
        "display_name",
        "full_name",
        "bio",
        "email",
        "phone",
        "location",
        "timezone",
        "date_of_birth",
        "avatar_url",
        "website",
      ];

      for (const key of allowed) {
        if (key in fields) {
          sets.push(`${key} = @${key}`);
          params[key] = fields[key];
        }
      }

      if (sets.length > 0) {
        sets.push("updated_at = datetime('now')");
        db.prepare(`UPDATE identity_profile SET ${sets.join(", ")} WHERE id = 1`).run(
          params
        );
      }
    }

    // Upsert values
    if (body.values) {
      const upsert = db.prepare(`
        INSERT INTO identity_values (label, description, priority)
        VALUES (@label, @description, @priority)
      `);

      // If full replacement, clear first
      if (body.replaceValues) {
        db.prepare("DELETE FROM identity_values").run();
      }

      for (const v of body.values) {
        upsert.run({
          label: v.label,
          description: v.description || "",
          priority: v.priority || 0,
        });
      }
    }

    // Add milestones
    if (body.milestones) {
      const insert = db.prepare(`
        INSERT INTO identity_milestones (title, description, date, category)
        VALUES (@title, @description, @date, @category)
      `);

      if (body.replaceMilestones) {
        db.prepare("DELETE FROM identity_milestones").run();
      }

      for (const m of body.milestones) {
        insert.run({
          title: m.title,
          description: m.description || "",
          date: m.date || null,
          category: m.category || "life",
        });
      }
    }

    // Add links
    if (body.links) {
      const insert = db.prepare(`
        INSERT INTO identity_links (platform, url, label)
        VALUES (@platform, @url, @label)
      `);

      if (body.replaceLinks) {
        db.prepare("DELETE FROM identity_links").run();
      }

      for (const l of body.links) {
        insert.run({
          platform: l.platform,
          url: l.url,
          label: l.label || "",
        });
      }
    }

    // Tie identity into the brain: re-index it as a memory source so Ask and the
    // Life Historian know who you are. Best-effort — needs the embed model running.
    let memoryIndexed: number | null = null;
    try {
      const { indexed } = await indexIdentity(db, (t) => ollamaEmbed(t));
      memoryIndexed = indexed;
    } catch (e) {
      console.warn("[api/identity] memory re-index skipped:", (e as Error).message);
    }

    return NextResponse.json({ success: true, memoryIndexed });
  } catch (error: any) {
    console.error("[api/identity] PUT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
