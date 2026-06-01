/* ═══════════════════════════════════════════════════════
   Transcription adapter (fallback for devices that POST raw audio).
   Recommended path is bridge-side STT (your faster-whisper) posting
   text to /api/ingest; this is here for devices with no bridge.

   Configure WHISPER_URL to a local server that accepts an audio file
   and returns { text }. Works with whisper.cpp server (/inference) and
   OpenAI-compatible /v1/audio/transcriptions.
   ═══════════════════════════════════════════════════════ */

const WHISPER_URL = process.env.WHISPER_URL || "http://localhost:8080/inference";

export async function transcribeAudio(bytes: Buffer, filename = "audio.wav"): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)]), filename);
  form.append("response_format", "json");
  const res = await fetch(WHISPER_URL, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`Transcription failed (${WHISPER_URL}): ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return (data.text || data.transcription || "").trim();
}
