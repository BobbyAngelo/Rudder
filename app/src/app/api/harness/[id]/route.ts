import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";
import {
  getHarnessConfigById,
  listHarnessSources,
  updateHarnessConfig,
  deleteHarnessConfig,
  type HarnessSourceInput,
} from "@/lib/db/harness";

interface UpdateHarnessBody {
  name?: string;
  slug?: string;
  description?: string;
  system_instructions?: string;
  target_ai?: string;
  sources?: HarnessSourceInput[];
}

/**
 * GET /api/harness/[id]
 * Fetch a single harness configuration and its sources.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;

    // Fetch config
    const config = getHarnessConfigById(id);
    if (!config) {
      return NextResponse.json({ success: false, error: "Harness config not found" }, { status: 404 });
    }

    // Fetch sources
    const sources = listHarnessSources(id);

    return NextResponse.json({ success: true, harness: config, sources });
  } catch (err) {
    log.error("[api/harness/[id]] GET error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/harness/[id]
 * Update a harness configuration and its sources.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const body = (await req.json()) as UpdateHarnessBody;

    const {
      name,
      slug,
      description = "",
      system_instructions = "",
      target_ai = "claude",
      sources = [],
    } = body;

    if (!name || !slug) {
      return NextResponse.json({ success: false, error: "Name and slug are required" }, { status: 400 });
    }

    updateHarnessConfig(
      id,
      { name, slug, description, system_instructions, target_ai },
      Array.isArray(sources) ? sources : [],
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("[api/harness/[id]] PUT error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/harness/[id]
 * Delete a harness configuration.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;

    // Delete configuration. SQLite foreign key cascade cleans up sources.
    deleteHarnessConfig(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("[api/harness/[id]] DELETE error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
