import { NextRequest, NextResponse } from "next/server";
import { compileHarnessContext } from "@/lib/harness";

/**
 * GET /api/harness/compile
 * Parameters: ?slug=linkedin-ghostwriter
 * Returns compiled markdown and token estimate.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ success: false, error: "Slug is required" }, { status: 400 });
    }

    const compiled = compileHarnessContext(slug);

    return NextResponse.json({
      success: true,
      compiled,
    });
  } catch (err: any) {
    console.error("[api/harness/compile] GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
