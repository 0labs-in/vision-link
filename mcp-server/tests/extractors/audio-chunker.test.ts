import { describe, it, expect, vi } from "vitest";
import { planChunks, type SilenceDetector } from "../../src/extractors/audio-chunker.js";
import { defaultConfig } from "../../src/config.js";

describe("planChunks", () => {
  it("returns single chunk when duration <= chunk_size", async () => {
    const fakeDetector: SilenceDetector = vi.fn(async () => []);
    const { chunks, warnings } = await planChunks("/x.mp4", 500, defaultConfig, fakeDetector);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ start: 0, end: 500, index: 0, total: 1 });
    expect(warnings).toEqual([]);
  });

  it("uses clean silence cuts when silences fall near ideal boundaries", async () => {
    const fakeDetector: SilenceDetector = vi.fn(async () => [
      { start: "00:09:55", end: "00:10:05", duration: 10 },
      { start: "00:19:50", end: "00:20:00", duration: 10 },
      { start: "00:29:58", end: "00:30:02", duration: 4 },
    ]);
    const { chunks } = await planChunks("/x.mp4", 2400, defaultConfig, fakeDetector);
    expect(chunks).toHaveLength(4);
    expect(chunks.map(p => p.clean_cut)).toEqual([true, true, true, true]);
    expect(fakeDetector).toHaveBeenCalledTimes(1);
    expect(chunks.map(c => c.end)).toEqual([600, 1195, 1800, 2400]);
  });

  it("retries with looser threshold when default returns insufficient silences", async () => {
    let callCount = 0;
    const fakeDetector: SilenceDetector = vi.fn(async (_path, threshold) => {
      callCount++;
      if (threshold === "default") return [];
      return [{ start: "00:09:50", end: "00:10:10", duration: 20 }];
    });
    const { chunks, warnings } = await planChunks("/x.mp4", 1300, defaultConfig, fakeDetector);
    expect(callCount).toBe(2);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].clean_cut).toBe(true);
    expect(warnings.some(w => w.event === "loose_threshold")).toBe(true);
  });

  it("falls back to hard cut and emits hard_cut warning when no silence found", async () => {
    const fakeDetector: SilenceDetector = vi.fn(async () => []);
    const { chunks, warnings } = await planChunks("/x.mp4", 1300, defaultConfig, fakeDetector);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].clean_cut).toBe(false);
    expect(chunks[0].end).toBe(600); // exact ideal boundary
    expect(warnings.some(w => w.event === "hard_cut")).toBe(true);
  });

  it("respects audio_chunk_overlap_seconds in actual_start", async () => {
    const fakeDetector: SilenceDetector = vi.fn(async () => []);
    const config = { ...defaultConfig, audio_chunk_overlap_seconds: 5 };
    const { chunks } = await planChunks("/x.mp4", 1300, config, fakeDetector);
    expect(chunks[0].actual_start).toBe(0); // first chunk: max(0, 0-5) = 0
    expect(chunks[1].start).toBe(600);
    expect(chunks[1].actual_start).toBe(595); // 600 - 5
  });
});
