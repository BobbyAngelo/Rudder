import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-error";
import { executeChat, ChatMessage } from "@/lib/ai";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import {
  ensureMediaSchema,
  listMediaWithFaces,
  getDayVitals,
  getChronicleNarrative,
  getChronicleNarrativeFull,
  updateChronicleNarrative,
  insertChronicleNarrative,
  getDefaultExecutionMode,
} from "@/lib/db/media";

const MEDIA_DB_PATH = path.join(process.cwd(), "..", "data", "media", "media-index.sqlite");

// Helper to open media index database
function getMediaDB(): Database.Database {
  if (!fs.existsSync(MEDIA_DB_PATH)) {
    fs.mkdirSync(path.dirname(MEDIA_DB_PATH), { recursive: true });
  }
  const db = new Database(MEDIA_DB_PATH);
  db.pragma("journal_mode = WAL");
  ensureMediaSchema(db);
  return db;
}

// Distance formula in meters between two coordinate pairs
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Logical cluster definition
interface PhotoRecord {
  id: number;
  filename: string;
  extension: string;
  type: string;
  sizeBytes: number;
  sourceVolume: string;
  relativePath: string;
  dateCreated: string | null;
  lat: number | null;
  lng: number | null;
  hasGeo: number;
  camera: string | null;
  favorite: number | null;
  userTags: string | null;
  city: string | null;
  country: string | null;
  faces: string | null;
}

interface Journey {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  photoCount: number;
  cities: string[];
  countries: string[];
  people: string[];
  photos: PhotoRecord[];
}

// Helper to group photos chronologically into logical Journeys
function clusterPhotos(photos: PhotoRecord[]): Journey[] {
  const journeys: Journey[] = [];
  if (photos.length === 0) return journeys;

  let currentCluster: PhotoRecord[] = [];
  let prevTime: number | null = null;
  let clusterStartCity: string | null = null;
  let clusterStartTime: number | null = null;

  for (const p of photos) {
    if (!p.dateCreated) continue;
    const time = new Date(p.dateCreated).getTime();
    if (isNaN(time)) continue;
    
    const city = p.city || null;

    if (prevTime === null) {
      currentCluster.push(p);
      prevTime = time;
      clusterStartCity = city;
      clusterStartTime = time;
    } else {
      const diffHours = (time - prevTime) / (1000 * 60 * 60);
      const totalDays = (time - clusterStartTime!) / (1000 * 60 * 60 * 24);
      
      // Upgrade: Split cluster if:
      // 1. There is a gap of more than 72 hours (3 days)
      // 2. The cluster duration has exceeded 21 days (3 weeks)
      // 3. The physical city changes and both are non-null
      const cityChanged = city && clusterStartCity && city !== clusterStartCity;

      if (diffHours <= 72 && totalDays <= 21 && !cityChanged) {
        currentCluster.push(p);
        prevTime = time;
        if (city && !clusterStartCity) {
          clusterStartCity = city;
        }
      } else {
        // Evaluate the finished cluster
        const journey = evaluateCluster(currentCluster);
        if (journey) journeys.push(journey);
        
        currentCluster = [p];
        prevTime = time;
        clusterStartCity = city;
        clusterStartTime = time;
      }
    }
  }

  if (currentCluster.length > 0) {
    const journey = evaluateCluster(currentCluster);
    if (journey) journeys.push(journey);
  }

  // Sort journeys by start date descending
  return journeys.sort((a, b) => b.startDate.localeCompare(a.startDate));
}

// Evaluate if a photo cluster constitutes a significant travel Journey or local Moment
function evaluateCluster(cluster: PhotoRecord[]): Journey | null {
  if (cluster.length < 5) return null; // Ignore tiny clusters

  const sorted = [...cluster].sort((a, b) => {
    const da = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
    const db = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
    return da - db;
  });

  const start = sorted[0].dateCreated!.substring(0, 10);
  const end = sorted[sorted.length - 1].dateCreated!.substring(0, 10);
  
  const dateDiffMs = new Date(end).getTime() - new Date(start).getTime();
  const daysDiff = Math.max(1, Math.ceil(dateDiffMs / (1000 * 60 * 60 * 24)) + 1);

  // Extract cities, countries, and tags
  const citiesSet = new Set<string>();
  const countriesSet = new Set<string>();
  
  for (const p of sorted) {
    if (p.city) citiesSet.add(p.city);
    if (p.country) countriesSet.add(p.country);
  }

  const cities = Array.from(citiesSet);
  const countries = Array.from(countriesSet);

  // Grouping name
  let name = "Local Chronicle";
  if (cities.length > 0) {
    name = `${cities[0]} Retreat`;
  } else if (countries.length > 0) {
    name = `${countries[0]} Journey`;
  } else {
    name = `Memories of ${new Date(start).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
  }

  const journeyId = `journey_${start.replace(/-/g, "")}_${end.replace(/-/g, "")}`;

  return {
    id: journeyId,
    name,
    startDate: start,
    endDate: end,
    daysCount: daysDiff,
    photoCount: sorted.length,
    cities,
    countries,
    people: [], // Will be populated on details fetch
    photos: sorted
  };
}

export async function GET(req: NextRequest) {
  let mediaDb: Database.Database | null = null;
  try {
    const url = new URL(req.url);
    const journeyId = url.searchParams.get("journeyId");
    
    mediaDb = getMediaDB();

    // Fetch all photos with dateCreated
    const rawPhotos = listMediaWithFaces(mediaDb);

    const photos: PhotoRecord[] = rawPhotos.map((row) => ({
      ...(row as unknown as PhotoRecord),
      favorite: row.favorite || 0,
      hasGeo: row.hasGeo || 0
    }));

    const journeys = clusterPhotos(photos);

    // 1. General list of all journeys
    if (!journeyId) {
      // Hydrate each journey with its unique faces and filter out non-geographical noise
      const journeysSummary = journeys
        .filter(j => j.cities.length > 0 || j.countries.length > 0)
        .map(j => {
          const uniqueFaces = new Set<string>();
          j.photos.forEach((p) => {
            if (p.faces) {
              p.faces.split(",").forEach((name: string) => uniqueFaces.add(name.trim()));
            }
          });
          
          return {
            id: j.id,
            name: j.name,
            startDate: j.startDate,
            endDate: j.endDate,
            daysCount: j.daysCount,
            photoCount: j.photoCount,
            cities: j.cities,
            countries: j.countries,
            people: Array.from(uniqueFaces)
          };
        });

      return NextResponse.json({ success: true, journeys: journeysSummary });
    }

    // 2. Specific journey details requested
    const journey = journeys.find(j => j.id === journeyId);
    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    // Generate day-by-day itinerary
    const itinerary = [];
    const startDateObj = new Date(journey.startDate);
    
    // Calculate the active people on this trip
    const tripPeople = new Set<string>();
    journey.photos.forEach((p) => {
      if (p.faces) {
        p.faces.split(",").forEach((name: string) => tripPeople.add(name.trim()));
      }
    });

    // Compile dynamic GPS Checkpoint polyline route trail
    const polyline: Array<[number, number]> = [];
    let lastLat: number | null = null;
    let lastLng: number | null = null;

    journey.photos.forEach(p => {
      if (p.lat && p.lng && (p.lat !== 0 || p.lng !== 0)) {
        if (lastLat === null || lastLng === null) {
          polyline.push([p.lat, p.lng]);
          lastLat = p.lat;
          lastLng = p.lng;
        } else {
          // Only add point if it is more than 100 meters from the last registered coordinate
          const dist = getDistanceMeters(lastLat, lastLng, p.lat, p.lng);
          if (dist > 100) {
            polyline.push([p.lat, p.lng]);
            lastLat = p.lat;
            lastLng = p.lng;
          }
        }
      }
    });

    for (let dayIdx = 0; dayIdx < journey.daysCount; dayIdx++) {
      const currentDate = new Date(startDateObj);
      currentDate.setDate(startDateObj.getDate() + dayIdx);
      const dateStr = currentDate.toISOString().substring(0, 10);

      // Photos for this specific calendar date
      const dayPhotos = journey.photos.filter(p => p.dateCreated?.substring(0, 10) === dateStr);
      
      // Cities visited today
      const dayCitiesSet = new Set<string>();
      dayPhotos.forEach(p => { if (p.city) dayCitiesSet.add(p.city); });
      const dayCities = Array.from(dayCitiesSet);

      // Faces today
      const dayFacesSet = new Set<string>();
      dayPhotos.forEach((p) => {
        if (p.faces) p.faces.split(",").forEach((name: string) => dayFacesSet.add(name.trim()));
      });

      // Vitals today from rudder.db
      const vitals = getDayVitals(dateStr);

      // Retrospective essences and AI prose
      const narrative = getChronicleNarrative(journeyId, dayIdx + 1);

      itinerary.push({
        dayIndex: dayIdx + 1,
        date: dateStr,
        displayDate: currentDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
        cities: dayCities,
        photos: dayPhotos,
        people: Array.from(dayFacesSet),
        vitals: vitals || { sleep_hours: null, resting_hr: null, hrv: null },
        narrative: narrative || { essence: "", ai_narrative: "", manual_prose: "" }
      });
    }

    return NextResponse.json({
      success: true,
      journey: {
        id: journey.id,
        name: journey.name,
        startDate: journey.startDate,
        endDate: journey.endDate,
        photoCount: journey.photoCount,
        cities: journey.cities,
        countries: journey.countries,
        people: Array.from(tripPeople),
        polyline,
        itinerary
      }
    });

  } catch (error) {
    log.error("GET /api/media/chronicles Error:", error);
    return serverError(error);
  } finally {
    if (mediaDb) mediaDb.close();
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { journeyId, dayIndex, essence, manual_prose, triggerAI, dateStr, cities, people, vitals } = body;

    if (!journeyId || dayIndex === undefined) {
      return NextResponse.json({ error: "journeyId and dayIndex are required fields." }, { status: 400 });
    }

    // 1. STRICT 30-CHARACTER LIMIT VALIDATION ON ESSENCE
    if (essence && essence.length > 30) {
      return NextResponse.json({ error: "30-character limit exceeded! Forces you to capture the essence, not write essays." }, { status: 400 });
    }

    // 2. Fetch active preference AI mode
    const prefs = getDefaultExecutionMode();
    const aiMode = prefs?.default_execution_mode || "local_ollama";

    let generatedAiProse = "";

    // 3. AI Travelogue Narration trigger
    if (triggerAI) {
      const companionNames = people && people.length > 0 ? people.join(", ") : "close companions";
      const locationContext = cities && cities.length > 0 ? cities.join(", ") : "unknown coordinates";
      const vitalsLog = vitals && vitals.sleep_hours 
        ? `rested with ${vitals.sleep_hours} hours of sleep (HRV: ${vitals.hrv || "normal"})`
        : "enjoyed personal reflection time";

      const systemPrompt = "You are the Sovereign Chronicles Memoirist. You write exquisite, deeply reflective three-sentence autobiographical travelogue chapter logs.";
      
      const userPrompt = `Compose exactly three elegant, literary sentences for a personal travel book detailing this day:
- Date/Timeline: ${dateStr || "Today"}
- Companions: Travelled with ${companionNames}.
- Places Checkpoints: Captured memories in ${locationContext}.
- Vitals Balance: You ${vitalsLog}.
- Human Essence observation: "${essence || "An open sky with infinite horizons."}"

Write in a warm, descriptive serif-prose. Focus on the sensory experience of the location, the comfort of companions, and the restorative feel. Output exactly three sentences of paragraph text.`;

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ];

      try {
        generatedAiProse = await executeChat(messages, aiMode);
      } catch (err) {
        log.warn(
          "AI pre-writer failed with mode:",
          aiMode,
          err instanceof Error ? err.message : String(err),
        );
        // Fallback to Gemini
        generatedAiProse = await executeChat(messages, "cloud_gemini");
      }
      generatedAiProse = generatedAiProse.trim();
    }

    // 4. UPSERT the chronicle narrative record
    // Since SQLITE ALTER table is done, we run direct insert or replace
    const existing = getChronicleNarrativeFull(journeyId, dayIndex);

    if (existing) {
      const updatedEssence = essence !== undefined ? essence : existing.essence;
      const updatedManualProse = manual_prose !== undefined ? manual_prose : existing.manual_prose;
      const updatedAiProse = triggerAI ? generatedAiProse : existing.ai_narrative;

      updateChronicleNarrative(existing.id, updatedEssence, updatedAiProse, updatedManualProse);
    } else {
      insertChronicleNarrative(
        journeyId,
        dayIndex,
        essence || "",
        generatedAiProse,
        manual_prose || "",
      );
    }

    return NextResponse.json({
      success: true,
      message: "Chronicle entry saved successfully",
      ai_narrative: generatedAiProse
    });

  } catch (error) {
    log.error("POST /api/media/chronicles Error:", error);
    return serverError(error);
  }
}
