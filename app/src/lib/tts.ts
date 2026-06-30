import { exec } from "child_process";
import { log } from "./logger";
import * as fs from "fs";
import * as path from "path";
import { getDB } from "./db";

/* ═══════════════════════════════════════════════════════
   Sovereign Text-to-Speech (TTS) Engine Interface
   ═══════════════════════════════════════════════════════ */

export interface TTSOptions {
  text: string;
  provider?: string;
  endpoint?: string;
  refAudio?: string;
  refText?: string;
}

/**
 * Native macOS speech player (triggers built-in OS speaker output)
 */
export function playNativeSpeech(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (process.platform !== "darwin") {
      log.info(`[tts-native] (Platform non-macOS) Speaking: "${text}"`);
      return resolve(true);
    }
    
    // Sanitize text for shell execution
    const safeText = text.replace(/["'$`\\]/g, "");
    exec(`say "${safeText}"`, (err) => {
      if (err) {
        log.warn(`[tts-native] Failed executing say command: ${err.message}`);
        return resolve(false);
      }
      resolve(true);
    });
  });
}

/**
 * Remote F5-TTS provider utilizing compute node CASE over SSH
 */
async function runRemoteF5(text: string, refAudio: string, refText: string): Promise<Buffer> {
  const remoteTempWav = `/tmp/f5_out_${Date.now()}.wav`;
  const localTempWav = path.resolve(process.cwd(), `temp_f5_${Date.now()}.wav`);
  
  // Default files if not configured
  const actualRefAudio = refAudio || "/Users/case/Developer/AI/reference_voice.wav";
  const actualRefText = refText || "Default reference voice recording text.";

  // Sanitize script texts
  const escapedText = text.replace(/"/g, '\\"');
  const escapedRefText = actualRefText.replace(/"/g, '\\"');

  const sshCommand = `ssh case "/Users/case/Developer/AI/comfyui-env/bin/f5-tts_infer-cli --model F5TTS_v1_Base --ref_audio \\"${actualRefAudio}\\" --ref_text \\"${escapedRefText}\\" --gen_text \\"${escapedText}\\" --output_dir \\"/tmp\\" --output_file \\"${path.basename(remoteTempWav)}\\" --device mps"`;
  const scpCommand = `scp case:${remoteTempWav} ${localTempWav}`;
  const cleanRemoteCommand = `ssh case "rm -f ${remoteTempWav}"`;

  return new Promise((resolve, reject) => {
    log.info("[tts-f5] Triggering remote F5-TTS voice synthesis on CASE...");
    exec(sshCommand, (sshErr) => {
      if (sshErr) {
        return reject(new Error(`SSH Voice Synthesis failed: ${sshErr.message}`));
      }

      log.info("[tts-f5] Copying synthesized voice file from CASE to TARS...");
      exec(scpCommand, (scpErr) => {
        if (scpErr) {
          // Cleanup remote file before failing
          exec(cleanRemoteCommand);
          return reject(new Error(`Failed to copy synthesized audio: ${scpErr.message}`));
        }

        try {
          const buffer = fs.readFileSync(localTempWav);
          // Cleanup local and remote temporary files asynchronously
          fs.unlinkSync(localTempWav);
          exec(cleanRemoteCommand);
          
          log.info("[tts-f5] Successfully retrieved voice synthesis.");
          resolve(buffer);
        } catch (readErr) {
          reject(new Error(`Failed to read audio buffer: ${(readErr as Error).message}`));
        }
      });
    });
  });
}

/**
 * Local/Remote OpenAI compatible API provider (e.g. Kokoro, Piper, local servers)
 */
async function runLocalOpenAI(text: string, endpoint: string): Promise<Buffer> {
  const ttsUrl = `${endpoint.replace(/\/$/, "")}/v1/audio/speech`;
  log.info(`[tts-openai] Contacting OpenAI-compatible TTS server at: ${ttsUrl}`);

  const res = await fetch(ttsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      model: "tts-1",
      voice: "alloy",
    }),
  });

  if (!res.ok) {
    throw new Error(`TTS server returned status: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Main entry point: Generates speech buffer based on DB user preferences
 */
export async function generateSpeech(options: TTSOptions): Promise<Buffer> {
  const db = getDB();
  
  // 1. Fetch user preferences configuration
  let provider = options.provider;
  let endpoint = options.endpoint;
  let refAudio = options.refAudio;
  let refText = options.refText;

  try {
    const prefs = db.prepare("SELECT tts_provider, tts_endpoint, tts_ref_audio, tts_ref_text FROM user_preferences WHERE id = 1").get() as {
      tts_provider: string | null;
      tts_endpoint: string | null;
      tts_ref_audio: string | null;
      tts_ref_text: string | null;
    } | undefined;
    if (prefs) {
      provider = provider || prefs.tts_provider || undefined;
      endpoint = endpoint || prefs.tts_endpoint || undefined;
      refAudio = refAudio || prefs.tts_ref_audio || undefined;
      refText = refText || prefs.tts_ref_text || undefined;
    }
  } catch { /* fallback */ }

  const activeProvider = provider || "native";
  log.info(`[tts] Generating speech utilizing active provider: "${activeProvider}"`);

  if (activeProvider === "remote_f5") {
    try {
      return await runRemoteF5(options.text, refAudio || "", refText || "");
    } catch (err) {
      log.warn(`[tts] Remote F5-TTS synthesis failed: ${(err as Error).message}. Falling back to native.`);
    }
  } else if (activeProvider === "local_openai" && endpoint) {
    try {
      return await runLocalOpenAI(options.text, endpoint);
    } catch (err) {
      log.warn(`[tts] Local OpenAI compatible synthesis failed: ${(err as Error).message}. Falling back to native.`);
    }
  }

  // Fallback: Generate mock speech WAV buffer (representing native offline buffer)
  log.info("[tts] Returning mock WAV buffer for local playing/synthesis.");
  
  // Simple mock WAV header for a 1-second silent audio buffer
  const mockWavHeader = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x24, 0x08, 0x00, 0x00, // file size - 8
    0x57, 0x41, 0x56, 0x45, // "WAVE"
    0x66, 0x6d, 0x74, 0x20, // "fmt "
    0x10, 0x00, 0x00, 0x00, // length of fmt chunk
    0x01, 0x00, 0x01, 0x00, // format (1=PCM), channels (1)
    0x44, 0xac, 0x00, 0x00, // sample rate (44100)
    0x88, 0x58, 0x01, 0x00, // byte rate (88200)
    0x02, 0x00, 0x10, 0x00, // block align (2), bits per sample (16)
    0x64, 0x61, 0x74, 0x61, // "data"
    0x00, 0x08, 0x00, 0x00  // data chunk size
  ]);
  
  const mockSilentData = Buffer.alloc(2048);
  return Buffer.concat([mockWavHeader, mockSilentData]);
}
