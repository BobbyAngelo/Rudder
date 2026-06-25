import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const db = getDB();

    /* 1. CHECK IF SEEDING IS NEEDED */
    const timelineCount = db.prepare("SELECT COUNT(*) as count FROM career_timeline").get() as any;
    
    if (timelineCount && timelineCount.count === 0) {
      /* Read legacy career-data.json to seed the tables */
      const filePath = path.join(process.cwd(), "..", "data", "writing", "career-data.json");
      if (fs.existsSync(filePath)) {
        const rawData = fs.readFileSync(filePath, "utf-8");
        const jsonData = JSON.parse(rawData);

        /* A. Seed career_timeline */
        const insertTimeline = db.prepare(`
          INSERT INTO career_timeline (company, title, division, start_date, end_date, highlights_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const item of jsonData.career_timeline || []) {
          insertTimeline.run(
            item.company,
            item.title,
            item.division || null,
            item.start,
            item.end,
            JSON.stringify(item.highlights || [])
          );
        }

        /* B. Seed career_skills */
        const insertSkill = db.prepare(`
          INSERT OR IGNORE INTO career_skills (category, skill_name)
          VALUES (?, ?)
        `);
        const skillsObj = jsonData.skills || {};
        for (const cat of ["creative", "production", "technical", "tools"]) {
          for (const s of skillsObj[cat] || []) {
            insertSkill.run(cat, s);
          }
        }

        /* C. Seed career_awards */
        const insertAward = db.prepare(`
          INSERT INTO career_awards (award_type, title, project, org, year, result)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const emmys = jsonData.awards?.emmys || [];
        for (const em of emmys) {
          insertAward.run("emmy", em.category || "Outstanding Creative Achievement", em.show, "Television Academy", em.year, em.result);
        }
        const otherAwards = jsonData.awards?.other || [];
        for (const ot of otherAwards) {
          insertAward.run("other", ot.title, ot.project, ot.org, ot.year || null, "WON");
        }

        /* D. Seed career_original_ip */
        const insertIP = db.prepare(`
          INSERT OR IGNORE INTO career_original_ip (title, format, pitched_to, status)
          VALUES (?, ?, ?, ?)
        `);
        for (const ip of jsonData.original_ip || []) {
          insertIP.run(ip.title, ip.format, ip.pitched_to || null, ip.status);
        }

        /* E. Seed career_job_applications */
        const insertApp = db.prepare(`
          INSERT INTO career_job_applications (company, role, year, docs_json)
          VALUES (?, ?, ?, ?)
        `);
        for (const app of jsonData.job_applications || []) {
          insertApp.run(app.company, app.role, app.year, JSON.stringify(app.docs || []));
        }
      }
    }

    /* 2. FETCH FROM SQLITE DATABASE */
    const timeline = db.prepare("SELECT * FROM career_timeline ORDER BY start_date DESC").all() as any[];
    const skills = db.prepare("SELECT * FROM career_skills").all() as any[];
    const awards = db.prepare("SELECT * FROM career_awards").all() as any[];
    const originalIp = db.prepare("SELECT * FROM career_original_ip").all() as any[];
    const jobApplications = db.prepare("SELECT * FROM career_job_applications").all() as any[];

    /* Format back to expected JSON structure */
    const structuredTimeline = timeline.map(t => ({
      company: t.company,
      title: t.title,
      division: t.division || undefined,
      start: t.start_date,
      end: t.end_date,
      highlights: JSON.parse(t.highlights_json || "[]")
    }));

    const structuredSkills = {
      creative: skills.filter(s => s.category === "creative").map(s => s.skill_name),
      production: skills.filter(s => s.category === "production").map(s => s.skill_name),
      technical: skills.filter(s => s.category === "technical").map(s => s.skill_name),
      tools: skills.filter(s => s.category === "tools").map(s => s.skill_name),
    };

    const emmysList = awards
      .filter(a => a.award_type === "emmy")
      .map(a => ({
        year: a.year,
        show: a.project,
        category: a.title,
        result: a.result
      }));

    const otherList = awards
      .filter(a => a.award_type === "other")
      .map(a => ({
        title: a.title,
        project: a.project,
        org: a.org,
        year: a.year || undefined
      }));

    const structuredApplications = jobApplications.map(app => ({
      company: app.company,
      role: app.role,
      year: app.year,
      docs: JSON.parse(app.docs_json || "[]")
    }));

    const structuredIp = originalIp.map(ip => ({
      title: ip.title,
      format: ip.format,
      pitched_to: ip.pitched_to || undefined,
      status: ip.status
    }));

    /* Load person fallback static details */
    const person = {
      name: "Sovereign User",
      location: "Los Angeles, CA",
      linkedin: "linkedin.com/in/sovereignmedia",
      imdb: "https://www.imdb.com/name/nm3176722/",
      instagram: "https://www.instagram.com/sovereign/",
      reel: "https://youtu.be/6kfRh2Eb3vA",
      websites: ["sovereign.com", "speedform.shop", "lildogproductions.com"]
    };

    const clientsAndBrands = [
      "NBC", "Disney", "BuzzFeed", "Meta", "Honda", "Acura", "Shell Racing",
      "Hennessey Performance Engineering", "Jaguar", "Mazda", "National Geographic",
      "Red Bull", "Pennzoil", "Shelby", "Vintage Electric", "MINI Cooper", "Hagerty",
      "Petersen Museum", "Metastage", "Represent Media", "Nitto", "Paramount+",
      "Discovery", "Auxito", "SuperMouth", "VF Engineering", "Volkswagen", "UTI/Penske",
      "Carolina Customs", "Heel and Toe Productions", "RedTie", "Concours Club",
      "Harrison", "Winslow Trucks", "Mercedes", "Lamborghini", "DJI", "Dhar Mann Studios"
    ];

    const responsePayload = {
      person,
      education: [
        {
          degree: "Bachelor of Fine Arts in Film & Animation",
          school: "Academy of Arts",
          location: "San Francisco, CA"
        },
        {
          degree: "Associate of Arts in Communications / Journalism",
          school: "Moorpark College",
          location: "Moorpark, CA"
        }
      ],
      awards: {
        television_academy_url: "https://www.televisionacademy.com/bios/robert-angelo",
        summary: "7 Emmy Nominations, 2 Emmy Wins (2008-2013)",
        emmys: emmysList.length > 0 ? emmysList : [
          { year: 2012, show: "Jay Leno's Garage", category: "Outstanding Special Class - Short-Format Nonfiction Programs", result: "WON" },
          { year: 2011, show: "Late Night With Jimmy Fallon", category: "Outstanding Creative Achievement In Interactive Media", result: "WON" }
        ],
        other: otherList
      },
      career_timeline: structuredTimeline,
      skills: structuredSkills,
      job_applications: structuredApplications,
      original_ip: structuredIp,
      clients_and_brands: clientsAndBrands
    };

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error("[api/career] GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to load career data from SQLite" }, { status: 500 });
  }
}
