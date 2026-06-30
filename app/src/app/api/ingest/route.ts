import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { ingestPayload } from "@/lib/ingest";
import { invalidateContextChunks } from "@/lib/rag";

export async function POST(req: Request) {
  try {
    // 1. Basic Token Authorization Check
    const clientToken = req.headers.get("x-rudder-token") || req.headers.get("X-Rudder-Token");
    const configuredToken = process.env.RUDDER_INGEST_TOKEN;

    if (configuredToken && clientToken !== configuredToken) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Invalid x-rudder-token header." },
        { status: 401 }
      );
    }

    // 2. Parse request payload
    const body = await req.json();
    
    // Validate if it is a single payload or array of payloads
    if (Array.isArray(body)) {
      const results = [];
      let successCount = 0;
      let duplicateCount = 0;
      
      for (const item of body) {
        const res = ingestPayload(item);
        if (res.success) {
          successCount++;
          if (res.duplicate) duplicateCount++;
        }
        results.push({
          input: item.payload?.title || item.classification,
          success: res.success,
          duplicate: res.duplicate,
          message: res.message
        });
      }
      
      if (successCount > 0) invalidateContextChunks();
      return NextResponse.json({
        success: true,
        summary: `Processed ${body.length} items. Success: ${successCount} (Duplicates/Merged: ${duplicateCount}).`,
        results
      });
    } else {
      const res = ingestPayload(body);
      if (!res.success) {
        return NextResponse.json(res, { status: 400 });
      }
      invalidateContextChunks();
      return NextResponse.json(res);
    }

  } catch (error) {
    log.error("POST /api/ingest Error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, duplicate: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
