import { describe, it, expect } from "vitest";
import type {
  AnalysisFilters,
  AudioResult,
  ChunkPlan,
  ChunkWarning,
  FrameStats,
  Interval,
  SceneChange,
  Segment,
  SessionManifest,
  VideoAnalysis,
} from "../src/types.js";

describe("new types", () => {
  it("AnalysisFilters has all filter flags", () => {
    const filters: AnalysisFilters = {
      scene_changes: true, black_intervals: false, silence: true,
      freeze: false, motion: false, blur: false, exposure: false,
      loudness: false, transcription: true,
    };
    expect(Object.keys(filters)).toHaveLength(9);
  });

  it("SessionManifest organizes frames by resolution", () => {
    const manifest: SessionManifest = {
      video_hash: "abc123",
      video_path: "/test.mp4",
      created_at: "2026-04-25T00:00:00Z",
      resolutions: {
        "512": { frames: [{ timestamp: "00:00:02", file: "512/frame_00_00_02.jpg" }] },
      },
    };
    expect(manifest.resolutions["512"].frames).toHaveLength(1);
  });

  it("VideoAnalysis holds all analysis results", () => {
    const analysis: VideoAnalysis = {
      scenes: [{ time: "00:01:23", score: 64.3 }],
      black_intervals: [],
      silence_intervals: [{ start: "00:05:00", end: "00:05:03", duration: 3.0 }],
      freeze_intervals: [],
      frame_stats: [],
      content_profile: "low complexity, low motion",
    };
    expect(analysis.scenes[0].score).toBe(64.3);
  });

  it("Segment defines time range with fps and optional resolution", () => {
    const seg: Segment = { start: "00:00:00", end: "00:01:00", fps: 2, resolution: 1024 };
    expect(seg.resolution).toBe(1024);
  });
});

describe("chunking types", () => {
  it("ChunkPlan has expected shape", () => {
    const plan: ChunkPlan = {
      start: 0,
      actual_start: 0,
      end: 600,
      index: 0,
      total: 4,
      clean_cut: true,
    };
    expect(plan.start).toBe(0);
    expect(plan.clean_cut).toBe(true);
  });

  it("ChunkWarning has expected event types", () => {
    const w: ChunkWarning = {
      chunk_index: 0,
      chunk_total: 4,
      time_range: "00:00-10:00",
      event: "retry",
      detail: "Gemini 500",
    };
    expect(w.event).toBe("retry");
  });

  it("AudioResult.warnings is optional", () => {
    const r: AudioResult = {
      backend: "gemini-api",
      transcription: [],
      audio_tags: [],
      full_analysis: null,
    };
    expect(r.warnings).toBeUndefined();
  });

  it("VideoAnalysis accepts audio_warnings field", () => {
    const analysis: VideoAnalysis = {
      scenes: [],
      black_intervals: [],
      silence_intervals: [],
      freeze_intervals: [],
      frame_stats: [],
      content_profile: "unknown",
      audio_warnings: [
        { chunk_index: 0, chunk_total: 2, time_range: "00:00:00-00:10:00", event: "hard_cut" },
      ],
    };
    expect(analysis.audio_warnings).toHaveLength(1);
    expect(analysis.audio_warnings![0].event).toBe("hard_cut");
  });
});
