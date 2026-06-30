import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";
import {
  listHarnessConfigs,
  createHarnessConfig,
  type HarnessSourceInput,
} from "@/lib/db/harness";

interface CreateHarnessBody {
  name?: string;
  slug?: string;
  description?: string;
  system_instructions?: string;
  target_ai?: string;
  sources?: HarnessSourceInput[];
}

/**
 * GET /api/harness
 * Returns all harness configurations.
 */
export async function GET() {
  try {
    const enriched = listHarnessConfigs();
    return NextResponse.json({ success: true, harnesses: enriched });
  } catch (err) {
    log.error("[api/harness] GET error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/harness
 * Create a new harness configuration.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateHarnessBody;

    const {
      name,
      description = "",
      system_instructions = "",
      target_ai = "claude",
      sources = [],
    } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }

    // Auto-generate slug
    const slug =
      body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const newId = createHarnessConfig(
      { name, slug, description, system_instructions, target_ai },
      Array.isArray(sources) ? sources : [],
    );

    return NextResponse.json({ success: true, id: newId, slug });
  } catch (err) {
    log.error("[api/harness] POST error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
