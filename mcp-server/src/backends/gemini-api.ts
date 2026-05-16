import type { AudioResult, AudioTag, ChunkWarning, Config, TranscriptionSegment } from "../types.js";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { extractAudio } from "../extractors/audio.js";
import { parseHMS, formatHMS } from "../utils/timestamps.js";
import { planChunks, type SilenceDetector } from "../extractors/audio-chunker.js";
import { getVideoMetadata } from "../extractors/frames.js";

interface GenAiFile {
  name?: string;
  state?: string;
  uri?: string;
  mimeType?: string;
}

interface GenAiFilesApi {
  get(args: { name: string }): Promise<GenAiFile>;
  delete(args: { name: string }): Promise<void>;
}

interface GenAiClient {
  files: GenAiFilesApi;
}

interface WaitForFileActiveOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;

export async function waitForFileActive(
  ai: GenAiClient,
  file: GenAiFile,
  options: WaitForFileActiveOptions = {},
): Promise<GenAiFile> {
  if (!file.name) {
    throw new Error("Cannot poll Gemini file state: file.name is missing");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  let current = file;
  while (current.state !== "ACTIVE") {
    if (current.state === "FAILED") {
      throw new Error(
        `Gemini file ${current.name} processing failed`,
      );
    }

    if (Date.now() > deadline) {
      throw new Error(
        `Gemini file ${current.name} stuck in state ${current.state ?? "unknown"} after ${timeoutMs}ms`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    current = await ai.files.get({ name: current.name! });
  }

  return current;
}

interface ParsedGeminiAudio {
  transcription: TranscriptionSegment[];
  audio_tags: AudioTag[];
}

export function parseGeminiAudioResponse(raw: string): ParsedGeminiAudio {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Gemini returned non-JSON response despite structured output config: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Gemini JSON response is not an object");
  }

  const obj = parsed as Record<string, unknown>;
  const transcription = Array.isArray(obj.transcription)
    ? (obj.transcription as TranscriptionSegment[])
    : [];
  const audio_tags = Array.isArray(obj.audio_tags)
    ? (obj.audio_tags as AudioTag[])
    : [];

  return { transcription, audio_tags };
}

function offsetTimestamp(hms: string, offsetSec: number): string {
  return formatHMS(parseHMS(hms) + offsetSec);
}

export async function transcribeChunk(
  wavPath: string,
  offsetSec: number,
  config: Config,
): Promise<{ segments: TranscriptionSegment[]; tags: AudioTag[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set. Run video_setup to configure.");
  }

  const { GoogleGenAI, createPartFromUri, createUserContent, Type } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const uploaded = await ai.files.upload({
    file: wavPath,
    config: { mimeType: getMimeType(wavPath) },
  });

  await waitForFileActive(ai as unknown as GenAiClient, uploaded);

  try {
    const response = await ai.models.generateContent({
      model: config.audio_model,
      contents: createUserContent([
        createPartFromUri(uploaded.uri!, uploaded.mimeType!),
        `Analyze this audio track and return structured JSON.

Produce two arrays:
1. "transcription": one entry per contiguous speech segment, with start and end timestamps as "HH:MM:SS" strings and the spoken text verbatim.
2. "audio_tags": one entry per non-speech audio event (music, sound effects, ambient sounds) with start and end timestamps as "HH:MM:SS" strings and a short lowercase label.

Use "00:00:00" if you cannot determine a timestamp. Return empty arrays if no speech or no non-speech events are present.`,
      ]),
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: config.audio_max_output_tokens,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  start: { type: Type.STRING, description: "HH:MM:SS start timestamp" },
                  end: { type: Type.STRING, description: "HH:MM:SS end timestamp" },
                  text: { type: Type.STRING, description: "Verbatim spoken text for this segment" },
                },
                propertyOrdering: ["start", "end", "text"],
                required: ["start", "end", "text"],
              },
            },
            audio_tags: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  start: { type: Type.STRING, description: "HH:MM:SS start timestamp" },
                  end: { type: Type.STRING, description: "HH:MM:SS end timestamp" },
                  tag: { type: Type.STRING, description: "Short lowercase label for the audio event" },
                },
                propertyOrdering: ["start", "end", "tag"],
                required: ["start", "end", "tag"],
              },
            },
          },
          propertyOrdering: ["transcription", "audio_tags"],
          required: ["transcription", "audio_tags"],
        },
      },
    });

    const parsed = parseGeminiAudioResponse(response.text ?? "");
    const segments = parsed.transcription.map(s => ({
      start: offsetTimestamp(s.start, offsetSec),
      end: offsetTimestamp(s.end, offsetSec),
      text: s.text,
    }));
    const tags = parsed.audio_tags.map(t => ({
      start: offsetTimestamp(t.start, offsetSec),
      end: offsetTimestamp(t.end, offsetSec),
      tag: t.tag,
    }));

    return { segments, tags };
  } finally {
    await ai.files.delete({ name: uploaded.name! }).catch(() => {});
  }
}

export interface ChunkResult {
  ok: boolean;
  attempt: number;
  segments?: TranscriptionSegment[];
  tags?: AudioTag[];
  error?: string;
}

export type TranscribeWorker = (
  wavPath: string,
  offsetSec: number,
  config: Config,
) => Promise<{ segments: TranscriptionSegment[]; tags: AudioTag[] }>;

export type WarningEmitter = (w: { event: "retry"; attempt: number; error: string }) => void;

export async function transcribeChunkWithRetry(
  wavPath: string,
  offsetSec: number,
  config: Config,
  retries: number,
  worker: TranscribeWorker = transcribeChunk,
  onWarning?: WarningEmitter,
): Promise<ChunkResult> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await worker(wavPath, offsetSec, config);
      return { ok: true, attempt, segments: r.segments, tags: r.tags };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < retries) {
        if (onWarning) onWarning({ event: "retry", attempt, error: msg });
        continue;
      }
      return { ok: false, attempt: attempt + 1, error: msg };
    }
  }
  return { ok: false, attempt: retries + 1, error: "unreachable" };
}

export interface AudioSlice {
  startTime?: string;
  endTime?: string;
}

export interface AnalyzeDeps {
  getMetadata?: typeof getVideoMetadata;
  extract?: typeof extractAudio;
  worker?: TranscribeWorker;
  silenceDetector?: SilenceDetector;
}

export async function analyzeWithGeminiApi(
  videoPath: string,
  config: Config,
  slice?: AudioSlice,
  deps: AnalyzeDeps = {},
): Promise<AudioResult> {
  const getMetadata = deps.getMetadata ?? getVideoMetadata;
  const extract = deps.extract ?? extractAudio;
  const worker = deps.worker ?? transcribeChunk;
  const silenceDetector = deps.silenceDetector;

  const tmpDir = mkdtempSync(join(tmpdir(), "cvv-gemini-"));

  try {
    // Slice mode (start/end set) always uses single-call path
    if (slice?.startTime || slice?.endTime) {
      const wavPath = await extract(videoPath, tmpDir, {
        startTime: slice.startTime,
        endTime: slice.endTime,
      });
      const { segments, tags } = await worker(wavPath, 0, config);
      return {
        backend: "gemini-api",
        transcription: segments,
        audio_tags: tags,
        full_analysis: null,
      };
    }

    const metadata = await getMetadata(videoPath);

    if (metadata.duration_seconds <= config.audio_chunk_trigger_seconds) {
      const wavPath = await extract(videoPath, tmpDir);
      const { segments, tags } = await worker(wavPath, 0, config);
      return {
        backend: "gemini-api",
        transcription: segments,
        audio_tags: tags,
        full_analysis: null,
      };
    }

    // Chunked path
    const { chunks, warnings: planWarnings } = await planChunks(
      videoPath,
      metadata.duration_seconds,
      config,
      silenceDetector,
    );

    const wavPaths = await Promise.all(
      chunks.map(c =>
        extract(videoPath, tmpDir, {
          startTime: secondsToHMS(c.actual_start),
          endTime: secondsToHMS(c.end),
          filename: `chunk-${c.index}.wav`,
        }),
      ),
    );

    const allWarnings: ChunkWarning[] = [...planWarnings];

    const results = await Promise.all(
      chunks.map((c, i) =>
        transcribeChunkWithRetry(
          wavPaths[i],
          c.start,
          config,
          1,
          worker,
          (w) => {
            allWarnings.push({
              chunk_index: c.index,
              chunk_total: c.total,
              time_range: hmsRange(c.start, c.end),
              event: w.event,
              detail: w.error,
            });
          },
        ),
      ),
    );

    const transcription: TranscriptionSegment[] = [];
    const audio_tags: AudioTag[] = [];
    chunks.forEach((c, i) => {
      const r = results[i];
      if (r.ok) {
        for (const seg of r.segments ?? []) {
          const clamped = clampSegment(seg, c.start, c.end);
          if (clamped) transcription.push(clamped);
        }
        for (const tag of r.tags ?? []) {
          const clamped = clampSegment(tag, c.start, c.end);
          if (clamped) audio_tags.push(clamped);
        }
      } else {
        transcription.push({
          start: secondsToHMS(c.start),
          end: secondsToHMS(c.end),
          text: "[transcription failed for this segment after retry]",
        });
        allWarnings.push({
          chunk_index: c.index,
          chunk_total: c.total,
          time_range: hmsRange(c.start, c.end),
          event: "failed",
          detail: r.error,
        });
      }
    });

    return {
      backend: "gemini-api",
      transcription,
      audio_tags,
      full_analysis: null,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function secondsToHMS(sec: number): string {
  return formatHMS(sec);
}

function clampSegment<T extends { start: string; end: string }>(
  seg: T,
  minSec: number,
  maxSec: number,
): T | null {
  const clampedStart = Math.max(parseHMS(seg.start), minSec);
  const clampedEnd = Math.min(parseHMS(seg.end), maxSec);
  if (clampedEnd <= clampedStart) return null;
  return { ...seg, start: formatHMS(clampedStart), end: formatHMS(clampedEnd) };
}

function hmsRange(startSec: number, endSec: number): string {
  return `${secondsToHMS(startSec)}-${secondsToHMS(endSec)}`;
}

function getMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    wav: "audio/wav",
    mp3: "audio/mp3",
    aac: "audio/aac",
    flac: "audio/flac",
    ogg: "audio/ogg",
    aiff: "audio/aiff",
  };
  return mimeTypes[ext || ""] || "audio/wav";
}
