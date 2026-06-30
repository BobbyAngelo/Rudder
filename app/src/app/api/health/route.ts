import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-error";
import {
  dashboard,
  chart,
  recordTypes,
  listProviders,
  upsertProvider,
  deleteProvider,
  upsertDocument,
  deleteDocument,
  upsertMetrics,
  type HealthProviderInput,
  type HealthDocumentInput,
  type HealthMetricsInput,
} from "@/lib/db/health";

/* ═══════════════════════════════════════════════════════
   /api/health — Biometric data + Providers

   GET ?action=dashboard     → Summary stats for the health dashboard
   GET ?action=chart&type=X  → Time series data for a specific metric
   GET ?action=providers     → List of health providers
   GET ?action=types         → Record type breakdown
   POST ?action=provider|document|metrics
   DELETE ?action=provider|document&id=X
   ═══════════════════════════════════════════════════════ */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "dashboard";

    switch (action) {
      case "dashboard":
        return NextResponse.json(dashboard());
      case "chart":
        return NextResponse.json(
          chart(searchParams.get("type") || "StepCount", parseInt(searchParams.get("days") || "30")),
        );
      case "providers":
        return NextResponse.json({ providers: listProviders() });
      case "types":
        return NextResponse.json({ types: recordTypes() });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    log.error("[api/health] GET error:", error);
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "provider") {
      const body = (await request.json()) as HealthProviderInput;
      const id = upsertProvider(body);
      return NextResponse.json(body.id ? { success: true } : { id });
    }

    if (action === "document") {
      const body = (await request.json()) as HealthDocumentInput;
      const id = upsertDocument(body);
      return NextResponse.json(body.id ? { success: true } : { id });
    }

    if (action === "metrics") {
      const body = (await request.json()) as HealthMetricsInput;
      upsertMetrics(body);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    log.error("[api/health] POST error:", error);
    return serverError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const id = parseInt(searchParams.get("id") || "");

    if (!id) {
      return NextResponse.json({ error: "ID parameter is required" }, { status: 400 });
    }

    if (action === "provider") {
      deleteProvider(id);
      return NextResponse.json({ success: true });
    }

    if (action === "document") {
      deleteDocument(id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    log.error("[api/health] DELETE error:", error);
    return serverError(error);
  }
}
