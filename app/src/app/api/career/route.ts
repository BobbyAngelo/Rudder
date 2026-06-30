import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import {
  countTimeline,
  listTimeline,
  listSkills,
  listAwards,
  listOriginalIp,
  listJobApplications,
  seedTimeline,
  seedSkill,
  seedAward,
  seedOriginalIp,
  seedJobApplication,
} from "@/lib/db/career";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    /* 1. CHECK IF SEEDING IS NEEDED */
    if (countTimeline() === 0) {
      /* Read legacy career-data.json to seed the tables */
      const filePath = path.join(process.cwd(), "..", "data", "writing", "career-data.json");
      if (fs.existsSync(filePath)) {
        const rawData = fs.readFileSync(filePath, "utf-8");
        const jsonData = JSON.parse(rawData);

        /* A. Seed career_timeline */
        for (const item of jsonData.career_timeline || []) {
          seedTimeline({
            company: item.company,
            title: item.title,
            division: item.division || null,
            start: item.start,
            end: item.end,
            highlights: item.highlights || [],
          });
        }

        /* B. Seed career_skills */
        const skillsObj = jsonData.skills || {};
        for (const cat of ["creative", "production", "technical", "tools"]) {
          for (const s of skillsObj[cat] || []) {
            seedSkill({ category: cat, skill_name: s });
          }
        }

        /* C. Seed career_awards */
        const emmys = jsonData.awards?.emmys || [];
        for (const em of emmys) {
          seedAward({
            award_type: "emmy",
            title: em.category || "Outstanding Creative Achievement",
            project: em.show,
            org: "Television Academy",
            year: em.year,
            result: em.result,
          });
        }
        const otherAwards = jsonData.awards?.other || [];
        for (const ot of otherAwards) {
          seedAward({
            award_type: "other",
            title: ot.title,
            project: ot.project,
            org: ot.org,
            year: ot.year || null,
            result: "WON",
          });
        }

        /* D. Seed career_original_ip */
        for (const ip of jsonData.original_ip || []) {
          seedOriginalIp({
            title: ip.title,
            format: ip.format,
            pitched_to: ip.pitched_to || null,
            status: ip.status,
          });
        }

        /* E. Seed career_job_applications */
        for (const app of jsonData.job_applications || []) {
          seedJobApplication({
            company: app.company,
            role: app.role,
            year: app.year,
            docs: app.docs || [],
          });
        }
      }
    }

    /* 2. FETCH FROM SQLITE DATABASE */
    const timeline = listTimeline();
    const skills = listSkills();
    const awards = listAwards();
    const originalIp = listOriginalIp();
    const jobApplications = listJobApplications();

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
  } catch (error) {
    log.error("[api/career] GET error:", error);
    return NextResponse.json({ error: "Failed to load career data from SQLite" }, { status: 500 });
  }
}
