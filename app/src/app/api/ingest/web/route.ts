import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-error";
import Database from "better-sqlite3";
import { join } from "path";
import { readFileSync } from "fs";

// Generate a quick UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function POST(req: Request) {
  try {
    const payload = await req.json() as {
      property_id?: string;
      webhook_secret?: string;
      event_type?: string;
      data?: unknown;
    };

    const { property_id, webhook_secret, event_type, data } = payload;

    if (!property_id || !webhook_secret || !event_type || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Verify Property and Secret
    const propsPath = join(process.cwd(), "..", "data", "business", "properties.json");
    interface PropertyConfig {
      id: string;
      webhook_secret: string;
      ingest_types?: string[];
    }
    const propsData = JSON.parse(readFileSync(propsPath, "utf8")) as { properties: PropertyConfig[] };

    const property = propsData.properties.find((p) => p.id === property_id);
    
    if (!property) {
      return NextResponse.json({ error: "Unknown property" }, { status: 404 });
    }

    if (property.webhook_secret !== webhook_secret) {
      return NextResponse.json({ error: "Unauthorized: Invalid webhook secret" }, { status: 401 });
    }

    // Optional: Check if the event type is allowed for this property
    if (property.ingest_types && !property.ingest_types.includes(event_type)) {
      log.warn(`[Ingest] Unmapped event type '${event_type}' for property '${property_id}'`);
    }

    // 2. Inject into the 10D Reality Ledger
    const dbPath = join(process.cwd(), "..", "data", "rudder.db");
    const db = new Database(dbPath);

    const stmt = db.prepare(`
      INSERT INTO reality_nodes (
        id, 
        when_timestamp, 
        what_classification, 
        origin_provenance, 
        raw_blob
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      generateUUID(),
      new Date().toISOString(),
      event_type, // e.g. "contact_form", "waitlist_signup"
      property_id,
      JSON.stringify(data)
    );

    db.close();

    log.info(`[Ingest Success] ${event_type} from ${property_id}`);

    return NextResponse.json({ 
      success: true, 
      message: "Data successfully ingested into Rudder OS" 
    }, { status: 201 });

  } catch (error) {
    log.error("[Ingest Error]:", error);
    return serverError(error);
  }
}
