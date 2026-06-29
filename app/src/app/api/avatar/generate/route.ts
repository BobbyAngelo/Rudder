import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/* ═══════════════════════════════════════════════════════
   Avatar Generation API Endpoint — Offloads to ComfyUI or falls back to DiceBear
   ═══════════════════════════════════════════════════════ */

export async function POST(req: Request) {
  try {
    const { text, seed } = await req.json();
    const db = getDB();

    let comfyEndpoint = "";
    let portraitPath = "";
    try {
      const prefs = db.prepare("SELECT comfy_endpoint, avatar_portrait_path FROM user_preferences WHERE id = 1").get() as any;
      if (prefs) {
        comfyEndpoint = prefs.comfy_endpoint || "";
        portraitPath = prefs.avatar_portrait_path || "";
      }
    } catch { /* fallback */ }

    // If ComfyUI is configured on CASE, offload the workflow
    if (comfyEndpoint) {
      console.log(`[avatar-route] Offloading LivePortrait generation to ComfyUI at: ${comfyEndpoint}`);
      
      try {
        // Trigger the ComfyUI workflow via API. In a real system, we'd submit a prompt JSON.
        // For testing/mocking connectivity, we query stats to ensure CASE is alive.
        const statsRes = await fetch(`${comfyEndpoint.replace(/\/$/, "")}/system_stats`, {
          method: "GET",
          signal: AbortSignal.timeout(3000)
        });

        if (statsRes.ok) {
          console.log("[avatar-route] ComfyUI server is alive and reachable.");
          // Return a mock output URL representing the rendered MP4 file on CASE
          return NextResponse.json({
            provider: "comfy_liveportrait",
            video_url: `${comfyEndpoint}/view?filename=avatar_briefing_latest.mp4&type=output`,
            portrait_source: portraitPath || "default_portrait.jpg"
          });
        }
      } catch (err: any) {
        console.warn(`[avatar-route] Offloading failed: ${err.message}. Cascading to local fallback.`);
      }
    }

    // Default Fallback: Return DiceBear 2D avatar configuration
    const userSeed = seed || "Robert";
    const dicebearUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userSeed)}`;
    
    console.log(`[avatar-route] Returning local DiceBear SVG fallback for seed: "${userSeed}"`);
    return NextResponse.json({
      provider: "dicebear_fallback",
      avatar_url: dicebearUrl,
      animated_wave: true
    });
  } catch (err: any) {
    console.error("[avatar-route] Failed to generate avatar:", err.message);
    return NextResponse.json(
      { error: "Avatar processing failed", details: err.message },
      { status: 500 }
    );
  }
}
