import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/* ═══════════════════════════════════════════════════════
   /api/health — Biometric data + Providers
   
   GET ?action=dashboard     → Summary stats for the health dashboard
   GET ?action=chart&type=X  → Time series data for a specific metric
   GET ?action=providers     → List of health providers
   POST ?action=provider     → Add/update a provider
   ═══════════════════════════════════════════════════════ */

export async function GET(request: Request) {
  try {
    const db = getDB();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "dashboard";

    if (action === "dashboard") {
      return getDashboard(db);
    }

    if (action === "chart") {
      const type = searchParams.get("type") || "StepCount";
      const days = parseInt(searchParams.get("days") || "30");
      return getChart(db, type, days);
    }

    if (action === "providers") {
      const providers = db.prepare("SELECT * FROM health_providers ORDER BY specialty, name").all();
      return NextResponse.json({ providers });
    }

    if (action === "types") {
      const types = db.prepare(`
        SELECT type, COUNT(*) as count, MIN(date) as first_date, MAX(date) as last_date
        FROM health_records GROUP BY type ORDER BY count DESC
      `).all();
      return NextResponse.json({ types });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("[api/health] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function getDashboard(db: any) {
  // Total records
  const totalRecords = (db.prepare("SELECT COUNT(*) as cnt FROM health_records").get() as any).cnt;

  // Date range
  const dateRange = db.prepare(
    "SELECT MIN(date) as first, MAX(date) as last FROM health_records"
  ).get() as any;

  // Latest day stats
  const latestDate = (db.prepare(
    "SELECT date FROM health_records ORDER BY date DESC LIMIT 1"
  ).get() as any)?.date;

  let latestStats: any = {};
  if (latestDate) {
    // Steps today
    const steps = db.prepare(
      "SELECT SUM(value) as total FROM health_records WHERE type = 'StepCount' AND date = ?"
    ).get(latestDate) as any;
    latestStats.steps = Math.round(steps?.total || 0);

    // Distance today (in miles)
    const dist = db.prepare(
      "SELECT SUM(value) as total FROM health_records WHERE type = 'Distance' AND date = ?"
    ).get(latestDate) as any;
    latestStats.distance = ((dist?.total || 0) * 0.000621371).toFixed(1); // meters to miles

    // Active energy
    const energy = db.prepare(
      "SELECT SUM(value) as total FROM health_records WHERE type = 'ActiveEnergy' AND date = ?"
    ).get(latestDate) as any;
    latestStats.activeEnergy = Math.round(energy?.total || 0);

    // Flights climbed
    const flights = db.prepare(
      "SELECT SUM(value) as total FROM health_records WHERE type = 'FlightsClimbed' AND date = ?"
    ).get(latestDate) as any;
    latestStats.flights = Math.round(flights?.total || 0);

    // Last HR
    const hr = db.prepare(
      "SELECT value FROM health_records WHERE type = 'HeartRate' ORDER BY start_date DESC LIMIT 1"
    ).get() as any;
    latestStats.heartRate = hr?.value ? Math.round(hr.value) : null;

    latestStats.date = latestDate;
  }

  // 7-day step history (relative to latest available data in the database)
  const weekSteps = db.prepare(`
    SELECT date, SUM(value) as steps FROM health_records 
    WHERE type = 'StepCount' 
    GROUP BY date ORDER BY date DESC LIMIT 7
  `).all() as any[];

  // 30-day step trend (sorted chronologically by date ascending)
  const monthSteps = db.prepare(`
    SELECT date, steps FROM (
      SELECT date, SUM(value) as steps FROM health_records 
      WHERE type = 'StepCount'
      GROUP BY date ORDER BY date DESC LIMIT 30
    ) ORDER BY date ASC
  `).all() as any[];

  // Recent sleep sessions 
  const recentSleep = db.prepare(`
    SELECT date, 
           SUM((julianday(end_date) - julianday(start_date)) * 24) as hours
    FROM health_records 
    WHERE type = 'SleepAnalysis' 
    GROUP BY date
    ORDER BY date DESC LIMIT 14
  `).all() as any[];

  // Record type breakdown
  const typeBreakdown = db.prepare(`
    SELECT type, COUNT(*) as count FROM health_records GROUP BY type ORDER BY count DESC
  `).all();

  // Providers
  const providers = db.prepare("SELECT * FROM health_providers ORDER BY specialty, name").all();

  // Health documents
  let documents: any[] = [];
  try {
    documents = db.prepare("SELECT * FROM health_documents ORDER BY document_date DESC, provider").all();
  } catch { /* table may not exist yet */ }

  // Dynamic sources list with record count and min/max sync dates
  const sources = db.prepare(`
    SELECT source, COUNT(*) as count, MIN(date) as first_sync, MAX(date) as last_sync
    FROM health_records
    GROUP BY source
    ORDER BY count DESC
  `).all() as any[];

  // Configured integrations from data_sources table
  let dataSources: any[] = [];
  try {
    dataSources = db.prepare("SELECT * FROM data_sources").all();
  } catch { /* table may not exist yet */ }

  // Latest manual metrics entry (vitals)
  let latestMetrics: any = null;
  try {
    latestMetrics = db.prepare("SELECT * FROM health_metrics ORDER BY date DESC LIMIT 1").get();
  } catch { /* table may not exist yet */ }

  return NextResponse.json({
    totalRecords,
    dateRange,
    latestStats,
    weekSteps,
    monthSteps,
    recentSleep,
    typeBreakdown,
    providers,
    documents,
    sources,
    dataSources,
    latestMetrics,
  });
}

function getChart(db: any, type: string, days: number) {
  const maxDateRow = db.prepare(
    "SELECT MAX(date) as max_date FROM health_records WHERE type = ?"
  ).get(type) as any;
  const maxDate = maxDateRow?.max_date;

  let data: any[] = [];
  if (maxDate) {
    data = db.prepare(`
      SELECT date, 
             SUM(value) as sum_value, 
             AVG(value) as avg_value, 
             MIN(value) as min_value, 
             MAX(value) as max_value,
             COUNT(*) as readings
      FROM health_records 
      WHERE type = ? AND date >= date(?, '-' || ? || ' days')
      GROUP BY date 
      ORDER BY date
    `).all(type, maxDate, days) as any[];
  }

  return NextResponse.json({ type, days, data });
}

export async function POST(request: Request) {
  try {
    const db = getDB();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "provider") {
      const body = await request.json();

      if (body.id) {
        // Update
        db.prepare(`
          UPDATE health_providers SET 
            name = @name, specialty = @specialty, phone = @phone, 
            address = @address, website = @website, portal_url = @portal_url,
            notes = @notes, next_appointment = @next_appointment, 
            last_visit = @last_visit, updated_at = datetime('now')
          WHERE id = @id
        `).run(body);
        return NextResponse.json({ success: true });
      } else {
        // Insert
        const result = db.prepare(`
          INSERT INTO health_providers (name, specialty, phone, address, website, portal_url, notes, next_appointment, last_visit)
          VALUES (@name, @specialty, @phone, @address, @website, @portal_url, @notes, @next_appointment, @last_visit)
        `).run({
          name: body.name,
          specialty: body.specialty || "",
          phone: body.phone || null,
          address: body.address || null,
          website: body.website || null,
          portal_url: body.portal_url || null,
          notes: body.notes || "",
          next_appointment: body.next_appointment || null,
          last_visit: body.last_visit || null,
        });
        return NextResponse.json({ id: result.lastInsertRowid });
      }
    }

    if (action === "document") {
      const body = await request.json();

      if (body.id) {
        // Update
        db.prepare(`
          UPDATE health_documents SET 
            title = @title, provider = @provider, category = @category,
            file_path = @file_path, document_date = @document_date,
            notes = @notes, provider_id = @provider_id, updated_at = datetime('now')
          WHERE id = @id
        `).run({
          id: body.id,
          title: body.title,
          provider: body.provider || "",
          category: body.category || "patient_record",
          file_path: body.file_path || "",
          document_date: body.document_date || null,
          notes: body.notes || "",
          provider_id: body.provider_id ? parseInt(body.provider_id, 10) : null,
        });
        return NextResponse.json({ success: true });
      } else {
        // Insert
        const result = db.prepare(`
          INSERT INTO health_documents (title, provider, category, file_path, document_date, notes, provider_id)
          VALUES (@title, @provider, @category, @file_path, @document_date, @notes, @provider_id)
        `).run({
          title: body.title,
          provider: body.provider || "",
          category: body.category || "patient_record",
          file_path: body.file_path || "",
          document_date: body.document_date || null,
          notes: body.notes || "",
          provider_id: body.provider_id ? parseInt(body.provider_id, 10) : null,
        });
        return NextResponse.json({ id: result.lastInsertRowid });
      }
    }

    if (action === "metrics") {
      const body = await request.json();
      const date = body.date || new Date().toISOString().split("T")[0];

      // Check if a row already exists for this date
      const existing = db.prepare("SELECT id FROM health_metrics WHERE date = ?").get(date) as any;

      const runParams = {
        date,
        sleep_hours: body.sleep_hours !== undefined && body.sleep_hours !== "" ? parseFloat(body.sleep_hours) : null,
        resting_hr: body.resting_hr !== undefined && body.resting_hr !== "" ? parseInt(body.resting_hr, 10) : null,
        hrv: body.hrv !== undefined && body.hrv !== "" ? parseInt(body.hrv, 10) : null,
        steps: body.steps !== undefined && body.steps !== "" ? parseInt(body.steps, 10) : null,
        weight: body.weight !== undefined && body.weight !== "" ? parseFloat(body.weight) : null,
        mood: body.mood !== undefined && body.mood !== "" ? parseInt(body.mood, 10) : null,
        energy: body.energy !== undefined && body.energy !== "" ? parseInt(body.energy, 10) : null,
        notes: body.notes || "",
        blood_pressure_systolic: body.blood_pressure_systolic !== undefined && body.blood_pressure_systolic !== "" ? parseInt(body.blood_pressure_systolic, 10) : null,
        blood_pressure_diastolic: body.blood_pressure_diastolic !== undefined && body.blood_pressure_diastolic !== "" ? parseInt(body.blood_pressure_diastolic, 10) : null,
        blood_glucose: body.blood_glucose !== undefined && body.blood_glucose !== "" ? parseFloat(body.blood_glucose) : null,
        temperature: body.temperature !== undefined && body.temperature !== "" ? parseFloat(body.temperature) : null,
      };

      if (existing) {
        db.prepare(`
          UPDATE health_metrics SET
            sleep_hours = @sleep_hours, resting_hr = @resting_hr, hrv = @hrv,
            steps = @steps, weight = @weight, mood = @mood, energy = @energy, notes = @notes,
            blood_pressure_systolic = @blood_pressure_systolic,
            blood_pressure_diastolic = @blood_pressure_diastolic,
            blood_glucose = @blood_glucose,
            temperature = @temperature,
            created_at = datetime('now')
          WHERE date = @date
        `).run(runParams);
      } else {
        db.prepare(`
          INSERT INTO health_metrics (
            date, sleep_hours, resting_hr, hrv, steps, weight, mood, energy, notes,
            blood_pressure_systolic, blood_pressure_diastolic, blood_glucose, temperature
          ) VALUES (
            @date, @sleep_hours, @resting_hr, @hrv, @steps, @weight, @mood, @energy, @notes,
            @blood_pressure_systolic, @blood_pressure_diastolic, @blood_glucose, @temperature
          )
        `).run(runParams);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("[api/health] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDB();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID parameter is required" }, { status: 400 });
    }

    if (action === "provider") {
      db.prepare("DELETE FROM health_providers WHERE id = ?").run(id);
      return NextResponse.json({ success: true });
    }

    if (action === "document") {
      db.prepare("DELETE FROM health_documents WHERE id = ?").run(id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("[api/health] DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
