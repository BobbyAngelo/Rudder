import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import {
  getPreferences,
  updatePreferences,
  type PreferencesUpdateInput,
  type UserPreferencesRow,
} from "@/lib/db/settings";

/** Shape returned to clients: JSON columns parsed out of the raw row. */
type PreferencesResponse = Omit<UserPreferencesRow, "enabled_modules" | "dashboard_layout"> & {
  enabled_modules: unknown;
  dashboard_layout: unknown;
};

/** Parse the JSON-encoded columns on a raw preferences row for the response. */
function serializePreferences(prefs: UserPreferencesRow): PreferencesResponse {
  let dashboard_layout: unknown = prefs.dashboard_layout;
  try {
    dashboard_layout = JSON.parse(prefs.dashboard_layout || "[]");
  } catch {
    // Fallback if it is a legacy string
  }

  return {
    ...prefs,
    enabled_modules: JSON.parse(prefs.enabled_modules || "[]"),
    dashboard_layout,
  };
}

/**
 * GET /api/preferences
 * Returns the singleton user_preferences row.
 */
export async function GET() {
  try {
    const prefs = getPreferences();

    if (!prefs) {
      return NextResponse.json({ error: "No preferences found" }, { status: 404 });
    }

    return NextResponse.json(serializePreferences(prefs));
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PUT /api/preferences
 * Update user preferences. Accepts partial updates.
 */
export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as PreferencesUpdateInput;

    const updated = updatePreferences(body);
    if (!updated) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    // Return updated preferences
    const prefs = getPreferences();
    if (!prefs) {
      return NextResponse.json({ error: "No preferences found" }, { status: 404 });
    }

    return NextResponse.json(serializePreferences(prefs));
  } catch (err) {
    return serverError(err);
  }
}
