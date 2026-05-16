import { execFile } from "child_process";
import { promisify } from "util";
import type { ChunkPlan, ChunkWarning, Config, Interval } from "../types.js";
import { parseSilenceOutput } from "./analyzers.js";
import { parseHMS, formatHMS } from "../utils/timestamps.js";

const execFileAsync = promisify(execFile);

export type SilenceThreshold = "default" | "loose";
export type SilenceDetector = (videoPath: string, threshold: SilenceThreshold) => Promise<Interval[]>;

const TOLERANCE_SECONDS = 30;

const SILENCE_PARAMS: Record<SilenceThreshold, string> = {
  default: "silencedetect=n=-40dB:d=0.5",
  loose: "silencedetect=n=-30dB:d=0.2",
};

export async function detectSilencesReal(
  videoPath: string,
  threshold: SilenceThreshold,
): Promise<Interval[]> {
  const args = ["-i", videoPath, "-af", SILENCE_PARAMS[threshold], "-f", "null", "-"];
  let stderr = "";
  try {
    const r = await execFileAsync("ffmpeg", args, { maxBuffer: 100 * 1024 * 1024 });
    stderr = r.stderr;
  } catch (err: any) {
    stderr = err.stderr || "";
  }
  return parseSilenceOutput(stderr);
}

interface BoundaryMatch {
  boundary: number;
  silenceMidpoint: number | null;
  clean_cut: boolean;
  threshold: SilenceThreshold | null;
}

function findNearestSilence(boundary: number, silences: Interval[]): number | null {
  let nearestMidpoint: number | null = null;
  let nearestDistance = Infinity;
  for (const s of silences) {
    const mid = (parseHMS(s.start) + parseHMS(s.end)) / 2;
    const distance = Math.abs(mid - boundary);
    if (distance <= TOLERANCE_SECONDS && distance < nearestDistance) {
      nearestDistance = distance;
      nearestMidpoint = mid;
    }
  }
  return nearestMidpoint;
}

export async function planChunks(
  videoPath: string,
  durationSec: number,
  config: Config,
  detector: SilenceDetector = detectSilencesReal,
): Promise<{ chunks: ChunkPlan[]; warnings: ChunkWarning[] }> {
  const chunkSize = config.audio_chunk_size_seconds;
  const overlap = config.audio_chunk_overlap_seconds;

  // Single-chunk path
  if (durationSec <= chunkSize) {
    return {
      chunks: [{ start: 0, actual_start: 0, end: durationSec, index: 0, total: 1, clean_cut: true }],
      warnings: [],
    };
  }

  // Compute ideal boundaries (multiples of chunkSize). Only add a boundary if
  // the trailing chunk would still be at least `chunkSize` long; otherwise the
  // remaining tail merges into the previous chunk.
  const idealBoundaries: number[] = [];
  for (let t = chunkSize; t + chunkSize <= durationSec; t += chunkSize) {
    idealBoundaries.push(t);
  }

  if (idealBoundaries.length === 0) {
    return {
      chunks: [{ start: 0, actual_start: 0, end: durationSec, index: 0, total: 1, clean_cut: true }],
      warnings: [],
    };
  }

  // Pass 1: default threshold
  const defaultSilences = await detector(videoPath, "default");
  const matches: BoundaryMatch[] = idealBoundaries.map(b => {
    const mid = findNearestSilence(b, defaultSilences);
    return {
      boundary: b,
      silenceMidpoint: mid,
      clean_cut: mid !== null,
      threshold: mid !== null ? "default" : null,
    };
  });

  // Pass 2: loose threshold for unmatched
  const unmatched = matches.filter(m => !m.clean_cut);
  if (unmatched.length > 0) {
    const looseSilences = await detector(videoPath, "loose");
    for (const m of unmatched) {
      const mid = findNearestSilence(m.boundary, looseSilences);
      if (mid !== null) {
        m.silenceMidpoint = mid;
        m.clean_cut = true;
        m.threshold = "loose";
      }
    }
  }

  // Build chunks + warnings
  const warnings: ChunkWarning[] = [];
  const total = matches.length + 1;
  const chunks: ChunkPlan[] = [];
  let prevEnd = 0;
  matches.forEach((m, i) => {
    const end = m.silenceMidpoint ?? m.boundary;
    const start = prevEnd;
    chunks.push({
      start,
      actual_start: Math.max(0, start - overlap),
      end,
      index: i,
      total,
      clean_cut: m.clean_cut,
    });
    if (m.threshold === "loose") {
      warnings.push({
        chunk_index: i,
        chunk_total: total,
        time_range: `${formatRange(start, end)}`,
        event: "loose_threshold",
        detail: "matched silence using loose threshold",
      });
    }
    if (!m.clean_cut) {
      warnings.push({
        chunk_index: i,
        chunk_total: total,
        time_range: `${formatRange(start, end)}`,
        event: "hard_cut",
        detail: `no silence within ±${TOLERANCE_SECONDS}s of target boundary`,
      });
    }
    prevEnd = end;
  });
  // Final chunk to end of video
  chunks.push({
    start: prevEnd,
    actual_start: Math.max(0, prevEnd - overlap),
    end: durationSec,
    index: matches.length,
    total,
    clean_cut: true, // trailing chunk has no boundary to cut at
  });

  return { chunks, warnings };
}

function formatRange(startSec: number, endSec: number): string {
  return `${formatHMS(startSec)}-${formatHMS(endSec)}`;
}
