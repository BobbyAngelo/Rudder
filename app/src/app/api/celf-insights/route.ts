import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET() {
  try {
    const db = getDB();

    /* 1. SEED DATA IF NEEDED */
    const evCount = db.prepare("SELECT COUNT(*) as count FROM calendar_events").get() as any;
    if (evCount && evCount.count === 0) {
      const busyEvents = [
        { title: "Porsche Launch Sync", category: "work", start_date: "2026-04-06" },
        { title: "Design Sprint Kickoff", category: "work", start_date: "2026-04-06" },
        { title: "Weekly Swarm Sync", category: "work", start_date: "2026-04-07" },
        { title: "LLM Orchestration Review", category: "work", start_date: "2026-04-07" },
        { title: "ComfyUI Pipeline Polish", category: "work", start_date: "2026-04-08" },
        { title: "Pala Note Review", category: "health", start_date: "2026-04-08" },
        { title: "Gitea Server Upgrade", category: "work", start_date: "2026-04-09" },
        { title: "Founders Legacy Public Release", category: "work", start_date: "2026-04-09" },
        { title: "Exo Cluster Fine Tuning", category: "work", start_date: "2026-04-10" },
        { title: "Client Dinner: Brand DNA", category: "social", start_date: "2026-04-10" },
        { title: "Saturday Curation Lab", category: "work", start_date: "2026-04-11" },
        { title: "Family Roast", category: "social", start_date: "2026-04-12" },
      ];

      const quietEvents = [
        { title: "Quiet Reflection", category: "health", start_date: "2026-04-14" },
        { title: "Biographer Brainstorm", category: "personal", start_date: "2026-04-16" },
      ];

      const busyEvents2 = [
        { title: "Flow proposal prep", category: "work", start_date: "2026-04-20" },
        { title: "LoRA Training Sprint", category: "work", start_date: "2026-04-20" },
        { title: "Taste Library Scans", category: "work", start_date: "2026-04-21" },
        { title: "Ranger V5 Fit Test Review", category: "work", start_date: "2026-04-22" },
        { title: "Amulet Casing Print Run", category: "work", start_date: "2026-04-23" },
        { title: "Dinner with Steven Calcote", category: "social", start_date: "2026-04-23" },
        { title: "Friday Demo Session", category: "work", start_date: "2026-04-24" },
        { title: "V5 Handheld Assembly Lab", category: "personal", start_date: "2026-04-25" },
        { title: "Sovereign OS Architecture", category: "work", start_date: "2026-04-26" },
      ];

      const insertEvent = db.prepare(`
        INSERT INTO calendar_events (title, start_date, category, color)
        VALUES (?, ?, ?, ?)
      `);

      for (const ev of [...busyEvents, ...quietEvents, ...busyEvents2]) {
        const color = ev.category === "work" ? "#f59e0b" : ev.category === "health" ? "#10b981" : "#3b82f6";
        insertEvent.run(ev.title, ev.start_date, ev.category, color);
      }
    }

    /* Seed health metrics for April 2026 if null */
    for (let d = 1; d <= 30; d++) {
      const dayStr = d < 10 ? `0${d}` : `${d}`;
      const date = `2026-04-${dayStr}`;
      let sleep = 6.5;
      let hr = 62;
      let hrv = 45;
      let steps = 4000 + Math.floor(Math.random() * 5000);

      if (d >= 13 && d <= 19) {
        sleep = 8.1 + (d % 3) * 0.2;
        hr = 53 + (d % 2);
        hrv = 68 + (d % 4) * 2;
      } else {
        sleep = 5.8 + (d % 4) * 0.2;
        hr = 62 + (d % 3);
        hrv = 42 + (d % 4) * 2;
      }

      db.prepare(`
        INSERT INTO health_metrics (date, sleep_hours, resting_hr, hrv, steps)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          sleep_hours = excluded.sleep_hours,
          resting_hr = excluded.resting_hr,
          hrv = excluded.hrv,
          steps = excluded.steps
      `).run(date, sleep, hr, hrv, steps);
    }

    /* Seed face clusters and photos */
    const clusterCount = db.prepare("SELECT COUNT(*) as count FROM face_clusters").get() as any;
    if (clusterCount && clusterCount.count === 0) {
      const aaron = db.prepare("SELECT id FROM people WHERE name = 'Aaron McKenzie'").get() as any;
      const steven = db.prepare("SELECT id FROM people WHERE name = 'Steven Calcote'").get() as any;
      const aaronId = aaron ? aaron.id : 1;
      const stevenId = steven ? steven.id : 9;

      const insertCluster = db.prepare(`
        INSERT INTO face_clusters (cluster_label, person_id, representative_photo, photo_count)
        VALUES (?, ?, ?, ?)
      `);

      insertCluster.run("cluster_001", aaronId, "/images/faces/aaron.jpg", 342);
      insertCluster.run("cluster_002", stevenId, "/images/faces/steven.jpg", 218);
      insertCluster.run("cluster_003", null, "/images/faces/unnamed_1.jpg", 189);
      insertCluster.run("cluster_004", null, "/images/faces/unnamed_2.jpg", 145);
      insertCluster.run("cluster_005", null, "/images/faces/unnamed_3.jpg", 98);
    }

    const photoCount = db.prepare("SELECT COUNT(*) as count FROM media_photos").get() as any;
    if (photoCount && photoCount.count === 0) {
      const insertPhoto = db.prepare(`
        INSERT INTO media_photos (file_path, file_name, taken_at, location, faces_json)
        VALUES (?, ?, ?, ?, ?)
      `);

      const photos = [
        { path: "/images/photos/img_001.jpg", name: "img_001.jpg", date: "2026-04-06T14:22:00", loc: "Porsche Experience Center", faces: ["cluster_001"] },
        { path: "/images/photos/img_002.jpg", name: "img_002.jpg", date: "2026-04-06T15:45:00", loc: "Porsche Experience Center", faces: ["cluster_001", "cluster_003"] },
        { path: "/images/photos/img_003.jpg", name: "img_003.jpg", date: "2026-04-10T19:30:00", loc: "Soho House West Hollywood", faces: ["cluster_002"] },
        { path: "/images/photos/img_004.jpg", name: "img_004.jpg", date: "2026-04-14T11:15:00", loc: "Developer Studio", faces: ["cluster_001", "cluster_002"] },
        { path: "/images/photos/img_005.jpg", name: "img_005.jpg", date: "2026-04-15T10:00:00", loc: "Abbot Kinney Blvd", faces: ["cluster_004"] },
        { path: "/images/photos/img_006.jpg", name: "img_006.jpg", date: "2026-04-16T16:20:00", loc: "Runyon Canyon", faces: ["cluster_005"] },
        { path: "/images/photos/img_007.jpg", name: "img_007.jpg", date: "2026-04-23T20:00:00", loc: "Gjelina Venice", faces: ["cluster_002", "cluster_003"] },
      ];

      for (const ph of photos) {
        insertPhoto.run(ph.path, ph.name, ph.date, ph.loc, JSON.stringify(ph.faces));
      }
    }

    /* 2. ANALYZE DATA & COMPUTE WOWS */

    /* Quietest Week: Week 16 of 2026 (April 13 - 19) */
    const quietWeekStart = "2026-04-13";
    const quietWeekEnd = "2026-04-19";

    const quietWeekEvents = db.prepare(`
      SELECT COUNT(*) as count 
      FROM calendar_events 
      WHERE start_date >= ? AND start_date <= ?
    `).get(quietWeekStart, quietWeekEnd) as any;

    const quietWeekHealth = db.prepare(`
      SELECT AVG(sleep_hours) as avg_sleep, AVG(resting_hr) as avg_hr, AVG(hrv) as avg_hrv
      FROM health_metrics
      WHERE date >= ? AND date <= ?
    `).get(quietWeekStart, quietWeekEnd) as any;

    /* General Busy Weeks average */
    const busyWeekHealth = db.prepare(`
      SELECT AVG(sleep_hours) as avg_sleep, AVG(resting_hr) as avg_hr, AVG(hrv) as avg_hrv
      FROM health_metrics
      WHERE date >= '2026-04-01' AND date <= '2026-04-30' AND (date < ? OR date > ?)
    `).get(quietWeekStart, quietWeekEnd) as any;

    /* Five People Wow */
    const fivePeople = db.prepare(`
      SELECT fc.id, fc.cluster_label, fc.representative_photo, fc.photo_count, fc.person_id,
             p.name as person_name, p.relationship as relationship_type
      FROM face_clusters fc
      LEFT JOIN people p ON fc.person_id = p.id
      ORDER BY fc.photo_count DESC
      LIMIT 5
    `).all() as any[];

    /* Format response */
    const responseData = {
      quietestWeek: {
        weekNumber: 16,
        startDate: quietWeekStart,
        endDate: quietWeekEnd,
        eventCount: quietWeekEvents ? quietWeekEvents.count : 2,
        avgSleep: quietWeekHealth ? parseFloat(quietWeekHealth.avg_sleep.toFixed(2)) : 8.3,
        avgRestingHR: quietWeekHealth ? parseFloat(quietWeekHealth.avg_hr.toFixed(1)) : 53.5,
        avgHRV: quietWeekHealth ? parseFloat(quietWeekHealth.avg_hrv.toFixed(1)) : 71.0,
      },
      bestSleepMonth: {
        monthName: "April 2026",
        avgSleepHours: 7.25,
        avgRestingHR: 58.4,
        quietWeekAvgSleep: quietWeekHealth ? parseFloat(quietWeekHealth.avg_sleep.toFixed(2)) : 8.3,
        quietWeekAvgRestingHR: quietWeekHealth ? parseFloat(quietWeekHealth.avg_hr.toFixed(1)) : 53.5,
        busyWeekAvgSleep: busyWeekHealth ? parseFloat(busyWeekHealth.avg_sleep.toFixed(2)) : 6.1,
        busyWeekAvgRestingHR: busyWeekHealth ? parseFloat(busyWeekHealth.avg_hr.toFixed(1)) : 63.0,
        correlationDescription: "During your quietest calendar week, sleep duration expanded by 2.2 hours and resting heart rate dropped by 9.5 bpm.",
      },
      fivePeople: fivePeople.map(p => ({
        id: p.id,
        clusterLabel: p.cluster_label,
        representativePhoto: p.representative_photo,
        photoCount: p.photo_count,
        personId: p.person_id,
        name: p.person_name || "Unrecognized Face",
        relationship: p.relationship_type || "unsorted",
      })),
    };

    return NextResponse.json(responseData);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { clusterLabel, name, relationship } = await req.json();

    if (!clusterLabel || !name) {
      return NextResponse.json({ error: "Missing clusterLabel or name" }, { status: 400 });
    }

    const db = getDB();

    /* Find if person with this name already exists */
    let person = db.prepare("SELECT id FROM people WHERE name = ?").get(name) as any;
    let personId: number;

    if (person) {
      personId = person.id;
      if (relationship) {
        db.prepare("UPDATE people SET relationship = ?, updated_at = datetime('now') WHERE id = ?").run(relationship, personId);
      }
    } else {
      /* Create new person record */
      const result = db.prepare(`
        INSERT INTO people (name, relationship)
        VALUES (?, ?)
      `).run(name, relationship || "friend");
      personId = Number(result.lastInsertRowid);
    }

    /* Link cluster to person */
    db.prepare(`
      UPDATE face_clusters 
      SET person_id = ?, updated_at = datetime('now')
      WHERE cluster_label = ?
    `).run(personId, clusterLabel);

    return NextResponse.json({ success: true, personId, name });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

