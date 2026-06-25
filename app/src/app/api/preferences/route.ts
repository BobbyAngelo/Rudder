import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/**
 * GET /api/preferences
 * Returns the singleton user_preferences row.
 */
export async function GET() {
  try {
    const db = getDB();
    const prefs = db.prepare("SELECT * FROM user_preferences WHERE id = 1").get() as any;

    if (!prefs) {
      return NextResponse.json({ error: "No preferences found" }, { status: 404 });
    }

    // Parse JSON fields
    let dashboard_layout = prefs.dashboard_layout;
    try {
      dashboard_layout = JSON.parse(dashboard_layout || "[]");
    } catch {
      // Fallback if it is a legacy string
    }

    return NextResponse.json({
      ...prefs,
      enabled_modules: JSON.parse(prefs.enabled_modules || "[]"),
      dashboard_layout
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/preferences
 * Update user preferences. Accepts partial updates.
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDB();

    // Build dynamic SET clause from provided fields
    const allowedFields = [
      "theme", "accent_color", "font_family", "font_scale",
      "border_radius", "sidebar_collapsed", "enabled_modules",
      "dashboard_layout", "onboarding_completed",
      "default_execution_mode", "fallback_execution_mode",
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        // Stringify arrays/objects for SQLite
        const value = typeof body[field] === "object"
          ? JSON.stringify(body[field])
          : body[field];
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(1); // WHERE id = 1

    db.prepare(
      `UPDATE user_preferences SET ${updates.join(", ")} WHERE id = ?`
    ).run(...values);

    // Return updated preferences
    const prefs = db.prepare("SELECT * FROM user_preferences WHERE id = 1").get() as any;
    
    let dashboard_layout = prefs.dashboard_layout;
    try {
      dashboard_layout = JSON.parse(dashboard_layout || "[]");
    } catch {
      // Fallback
    }

    return NextResponse.json({
      ...prefs,
      enabled_modules: JSON.parse(prefs.enabled_modules || "[]"),
      dashboard_layout
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
