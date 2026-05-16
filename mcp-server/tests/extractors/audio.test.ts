import { describe, it, expect, afterEach } from "vitest";
import { extractAudio, buildExtractArgs } from "../../src/extractors/audio.js";
import { join } from "path";
import { rmSync, existsSync } from "fs";
import { tmpdir } from "os";

const FIXTURE = join(import.meta.dirname, "../fixtures/test-3s.mp4");
const OUT_DIR = join(tmpdir(), "cvv-audio-test-" + Date.now());

describe("audio extraction", () => {
  afterEach(() => {
    if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  });

  it("extracts audio as WAV file", async () => {
    const wavPath = await extractAudio(FIXTURE, OUT_DIR);
    expect(existsSync(wavPath)).toBe(true);
    expect(wavPath.endsWith(".wav")).toBe(true);
  });

  it("supports start_time and end_time", async () => {
    const wavPath = await extractAudio(FIXTURE, OUT_DIR, {
      startTime: "00:00:00",
      endTime: "00:00:02",
    });
    expect(existsSync(wavPath)).toBe(true);
  });

  it("respects custom filename param", async () => {
    const wavPath = await extractAudio(FIXTURE, OUT_DIR, {
      filename: "chunk-3.wav",
    });
    expect(wavPath.endsWith("chunk-3.wav")).toBe(true);
    expect(existsSync(wavPath)).toBe(true);
  });

  it("defaults to audio.wav when filename omitted", async () => {
    const wavPath = await extractAudio(FIXTURE, OUT_DIR);
    expect(wavPath.endsWith("audio.wav")).toBe(true);
    expect(existsSync(wavPath)).toBe(true);
  });

  it("produces output of correct duration with nonzero startTime", async () => {
    // Fixture is 3 seconds. Extract from 00:00:01 to 00:00:02 (1 second window).
    // Verifies that -to is interpreted as an absolute file timestamp, not as duration.
    // If -to were interpreted as duration, we'd get 2 seconds instead of 1.
    const wavPath = await extractAudio(FIXTURE, OUT_DIR, {
      startTime: "00:00:01",
      endTime: "00:00:02",
      filename: "duration-test.wav",
    });
    expect(existsSync(wavPath)).toBe(true);

    // Use ffprobe to read actual output duration.
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      wavPath,
    ]);
    const durationSec = parseFloat(stdout.trim());
    // Allow ±0.2s tolerance for codec/container framing
    expect(durationSec).toBeGreaterThan(0.8);
    expect(durationSec).toBeLessThan(1.2);
  });
});

describe("buildExtractArgs", () => {
  it("places -ss AFTER -i for output accurate-seek", () => {
    const args = buildExtractArgs("/in.mp4", "/out.wav", { startTime: "00:10:00" });
    const ssIndex = args.indexOf("-ss");
    const iIndex = args.indexOf("-i");
    expect(ssIndex).toBeGreaterThan(iIndex);
  });

  it("omits -ss when startTime not provided", () => {
    const args = buildExtractArgs("/in.mp4", "/out.wav", {});
    expect(args.includes("-ss")).toBe(false);
  });

  it("places -to AFTER -i", () => {
    const args = buildExtractArgs("/in.mp4", "/out.wav", { endTime: "00:20:00" });
    const toIndex = args.indexOf("-to");
    const iIndex = args.indexOf("-i");
    expect(toIndex).toBeGreaterThan(iIndex);
  });

  it("includes both -ss and -to when both provided, both after -i", () => {
    const args = buildExtractArgs("/in.mp4", "/out.wav", {
      startTime: "00:10:00",
      endTime: "00:20:00",
    });
    const ssIndex = args.indexOf("-ss");
    const toIndex = args.indexOf("-to");
    const iIndex = args.indexOf("-i");
    expect(ssIndex).toBeGreaterThan(iIndex);
    expect(toIndex).toBeGreaterThan(iIndex);
  });
});
