import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { waitForFileActive } from "../../src/backends/gemini-api.js";
import { formatHMS } from "../../src/utils/timestamps.js";

interface FakeFile {
  name?: string;
  state?: string;
  uri?: string;
  mimeType?: string;
}

function fakeClient(states: string[]): {
  client: { files: { get: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> } };
  calls: { get: number };
} {
  let index = 0;
  const calls = { get: 0 };
  return {
    client: {
      files: {
        get: vi.fn(async ({ name }: { name: string }) => {
          calls.get++;
          const state = states[Math.min(index, states.length - 1)];
          index++;
          return { name, state, uri: `gs://fake/${name}`, mimeType: "video/mp4" };
        }),
        delete: vi.fn(async () => {}),
      },
    },
    calls,
  };
}

describe("waitForFileActive", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns immediately when file is already ACTIVE", async () => {
    const { client, calls } = fakeClient(["ACTIVE"]);
    const file: FakeFile = { name: "files/abc", state: "ACTIVE" };

    const result = await waitForFileActive(client, file);

    expect(result.state).toBe("ACTIVE");
    expect(calls.get).toBe(0);
  });

  it("polls while PROCESSING then returns when ACTIVE", async () => {
    const { client, calls } = fakeClient(["PROCESSING", "ACTIVE"]);
    const file: FakeFile = { name: "files/abc", state: "PROCESSING" };

    const promise = waitForFileActive(client, file, {
      pollIntervalMs: 100,
      timeoutMs: 10_000,
    });
    await vi.advanceTimersByTimeAsync(300);
    const result = await promise;

    expect(result.state).toBe("ACTIVE");
    expect(calls.get).toBe(2);
  });

  it("throws on FAILED state after upload", async () => {
    const { client } = fakeClient(["FAILED"]);
    const file: FakeFile = { name: "files/abc", state: "FAILED" };

    await expect(waitForFileActive(client, file)).rejects.toThrow(
      /processing failed/,
    );
  });

  it("throws on FAILED state detected during polling", async () => {
    const { client } = fakeClient(["PROCESSING", "FAILED"]);
    const file: FakeFile = { name: "files/abc", state: "PROCESSING" };

    const promise = waitForFileActive(client, file, {
      pollIntervalMs: 100,
      timeoutMs: 10_000,
    });
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(300);

    await expect(promise).rejects.toThrow(/processing failed/);
  });

  it("throws after timeout when stuck in PROCESSING", async () => {
    const { client } = fakeClient(["PROCESSING"]);
    const file: FakeFile = { name: "files/abc", state: "PROCESSING" };

    const promise = waitForFileActive(client, file, {
      pollIntervalMs: 50,
      timeoutMs: 200,
    });
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).rejects.toThrow(/stuck in state PROCESSING after 200ms/);
  });

  it("handles STATE_UNSPECIFIED by polling until ACTIVE", async () => {
    const { client, calls } = fakeClient(["STATE_UNSPECIFIED", "ACTIVE"]);
    const file: FakeFile = { name: "files/abc", state: "STATE_UNSPECIFIED" };

    const promise = waitForFileActive(client, file, {
      pollIntervalMs: 100,
      timeoutMs: 10_000,
    });
    await vi.advanceTimersByTimeAsync(300);
    const result = await promise;

    expect(result.state).toBe("ACTIVE");
    expect(calls.get).toBe(2);
  });

  it("throws when file.name is missing", async () => {
    const { client } = fakeClient(["PROCESSING"]);
    const file: FakeFile = { state: "PROCESSING" };

    await expect(waitForFileActive(client, file)).rejects.toThrow(
      /file\.name is missing/,
    );
  });

  it("uses default timeout and poll interval when options omitted", async () => {
    const { client } = fakeClient(["ACTIVE"]);
    const file: FakeFile = { name: "files/abc", state: "ACTIVE" };

    const result = await waitForFileActive(client, file);
    expect(result.state).toBe("ACTIVE");
  });
});

import { transcribeChunk, transcribeChunkWithRetry } from "../../src/backends/gemini-api.js";
import type { Config } from "../../src/types.js";
import { defaultConfig } from "../../src/config.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return { ...defaultConfig, ...overrides };
}

describe("transcribeChunk", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalEnv;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("passes config.audio_model and audio_max_output_tokens to generateContent", async () => {
    const generateContent = vi.fn(async () => ({
      text: JSON.stringify({ transcription: [], audio_tags: [] }),
    }));
    const upload = vi.fn(async () => ({ name: "files/x", uri: "gs://x", mimeType: "audio/wav", state: "ACTIVE" }));
    const fakeAi = {
      files: {
        upload,
        get: vi.fn(async (a: { name: string }) => ({ name: a.name, state: "ACTIVE", uri: "gs://x", mimeType: "audio/wav" })),
        delete: vi.fn(async () => {}),
      },
      models: { generateContent },
    };

    vi.doMock("@google/genai", () => ({
      GoogleGenAI: vi.fn(function () { return fakeAi; }),
      createPartFromUri: vi.fn(() => ({})),
      createUserContent: vi.fn((parts: unknown[]) => parts),
      Type: { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING" },
    }));

    const { transcribeChunk: fresh } = await import("../../src/backends/gemini-api.js?mock1");
    await fresh("/tmp/x.wav", 0, makeConfig({ audio_model: "gemini-3-flash-preview", audio_max_output_tokens: 65536 }));

    expect(generateContent).toHaveBeenCalledTimes(1);
    const callArgs = generateContent.mock.calls[0][0];
    expect(callArgs.model).toBe("gemini-3-flash-preview");
    expect(callArgs.config.maxOutputTokens).toBe(65536);
  });

  it("adds offsetSec to all returned timestamps", async () => {
    const fakeResponse = {
      text: JSON.stringify({
        transcription: [
          { start: "00:00:05", end: "00:00:10", text: "hello" },
          { start: "00:01:00", end: "00:01:05", text: "world" },
        ],
        audio_tags: [{ start: "00:00:30", end: "00:00:32", tag: "music" }],
      }),
    };
    const fakeAi = {
      files: {
        upload: vi.fn(async () => ({ name: "files/x", uri: "gs://x", mimeType: "audio/wav", state: "ACTIVE" })),
        get: vi.fn(async (a: { name: string }) => ({ name: a.name, state: "ACTIVE", uri: "gs://x", mimeType: "audio/wav" })),
        delete: vi.fn(async () => {}),
      },
      models: { generateContent: vi.fn(async () => fakeResponse) },
    };

    vi.doMock("@google/genai", () => ({
      GoogleGenAI: vi.fn(function () { return fakeAi; }),
      createPartFromUri: vi.fn(() => ({})),
      createUserContent: vi.fn((parts: unknown[]) => parts),
      Type: { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING" },
    }));

    const { transcribeChunk: fresh } = await import("../../src/backends/gemini-api.js?mock2");
    const offsetSec = 600;
    const result = await fresh("/tmp/x.wav", offsetSec, makeConfig());

    expect(result.segments[0].start).toBe("00:10:05");
    expect(result.segments[0].end).toBe("00:10:10");
    expect(result.segments[1].start).toBe("00:11:00");
    expect(result.segments[1].end).toBe("00:11:05");
    expect(result.tags[0].start).toBe("00:10:30");
    expect(result.tags[0].end).toBe("00:10:32");
  });

  it("throws when GEMINI_API_KEY missing", async () => {
    delete process.env.GEMINI_API_KEY;
    vi.doMock("@google/genai", () => ({
      GoogleGenAI: vi.fn(),
      createPartFromUri: vi.fn(),
      createUserContent: vi.fn(),
      Type: {},
    }));
    const { transcribeChunk: fresh } = await import("../../src/backends/gemini-api.js?mock3");
    await expect(fresh("/tmp/x.wav", 0, makeConfig())).rejects.toThrow(/GEMINI_API_KEY/);
  });
});

describe("transcribeChunkWithRetry", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("returns ok=true on first-try success", async () => {
    const worker = vi.fn(async () => ({ segments: [], tags: [] }));
    const result = await transcribeChunkWithRetry("/x.wav", 0, makeConfig(), 1, worker);
    expect(result.ok).toBe(true);
    expect(result.attempt).toBe(0);
    expect(worker).toHaveBeenCalledTimes(1);
  });

  it("retries once and returns ok=true with attempt=1 + retry warning", async () => {
    const worker = vi.fn()
      .mockRejectedValueOnce(new Error("Gemini 500"))
      .mockResolvedValueOnce({ segments: [], tags: [] });
    const onWarning = vi.fn();
    const result = await transcribeChunkWithRetry("/x.wav", 0, makeConfig(), 1, worker, onWarning);
    expect(result.ok).toBe(true);
    expect(result.attempt).toBe(1);
    expect(worker).toHaveBeenCalledTimes(2);
    expect(onWarning).toHaveBeenCalledWith(expect.objectContaining({ event: "retry" }));
  });

  it("returns ok=false after retries exhausted", async () => {
    const worker = vi.fn().mockRejectedValue(new Error("persistent fail"));
    const onWarning = vi.fn();
    const result = await transcribeChunkWithRetry("/x.wav", 0, makeConfig(), 1, worker, onWarning);
    expect(result.ok).toBe(false);
    expect(result.attempt).toBe(2);
    expect(worker).toHaveBeenCalledTimes(2);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });
});

import { analyzeWithGeminiApi } from "../../src/backends/gemini-api.js";

describe("analyzeWithGeminiApi orchestrator", () => {
  const baseConfig = { ...defaultConfig, audio_chunk_trigger_seconds: 1200, audio_chunk_size_seconds: 600 };

  function metaStub(seconds: number) {
    return vi.fn(async () => ({
      duration: "x", duration_seconds: seconds,
      resolution: "x", width: 0, height: 0, codec: "h264",
      original_fps: 30, file_size: "x", has_audio: true,
    }));
  }

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("uses single-call path when duration <= chunk_trigger", async () => {
    const worker = vi.fn(async () => ({
      segments: [{ start: "00:00:00", end: "00:00:05", text: "short" }],
      tags: [],
    }));
    const extract = vi.fn(async () => "/tmp/audio.wav");
    const result = await analyzeWithGeminiApi("/x.mp4", baseConfig, undefined, {
      getMetadata: metaStub(600),
      extract,
      worker,
    });
    expect(worker).toHaveBeenCalledTimes(1);
    expect(result.transcription).toHaveLength(1);
    expect(result.warnings).toBeUndefined();
  });

  it("uses chunked path when duration > chunk_trigger", async () => {
    // Mock mirrors real worker behavior: returns absolute timestamps (offset already applied).
    const worker = vi.fn(async (_wav, offset) => ({
      segments: [{ start: formatHMS(offset), end: formatHMS(offset + 5), text: `at ${offset}` }],
      tags: [],
    }));
    const extract = vi.fn(async (_v: string, _d: string, opts?: { filename?: string }) =>
      `/tmp/${opts?.filename ?? "audio.wav"}`,
    );
    const silenceDetector = vi.fn(async () => []);
    const result = await analyzeWithGeminiApi("/x.mp4", baseConfig, undefined, {
      getMetadata: metaStub(2400),
      extract,
      worker,
      silenceDetector,
    });
    expect(worker).toHaveBeenCalledTimes(4);
    expect(result.transcription).toHaveLength(4);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.filter(w => w.event === "hard_cut")).toHaveLength(3);
  });

  it("emits sentinel segment when chunk fails after retry", async () => {
    // Chunk 2 (offset=1200) fails on every call. Other chunks succeed first try.
    // Failure is keyed by offset (not by callCount) so it's deterministic under
    // Promise.all parallelism.
    const FAIL_OFFSET = 1200;
    const worker = vi.fn(async (_wav: string, offset: number) => {
      if (offset === FAIL_OFFSET) throw new Error("Gemini 500");
      // Mirror real worker behavior: return offset-applied timestamps so clamping doesn't drop them.
      return {
        segments: [{ start: formatHMS(offset), end: formatHMS(offset + 5), text: "ok" }],
        tags: [],
      };
    });
    const extract = vi.fn(async (_v: string, _d: string, opts?: { filename?: string }) =>
      `/tmp/${opts?.filename ?? "audio.wav"}`,
    );
    const silenceDetector = vi.fn(async () => []);
    const result = await analyzeWithGeminiApi("/x.mp4", baseConfig, undefined, {
      getMetadata: metaStub(2400),
      extract,
      worker,
      silenceDetector,
    });
    const failedSegments = result.transcription.filter(t => t.text.includes("transcription failed"));
    expect(failedSegments).toHaveLength(1);
    expect(result.transcription.filter(t => t.text === "ok")).toHaveLength(3);  // 3 successful chunks contribute
    expect(result.warnings!.filter(w => w.event === "failed")).toHaveLength(1);
    expect(result.warnings!.filter(w => w.event === "retry")).toHaveLength(1);
  });

  it("clamps overflowing segment timestamps to chunk bounds", async () => {
    // Worker returns a segment with start within chunk, but end past chunk's actual end.
    // Simulates Gemini hallucinating a long end timestamp.
    // For a 2400s video with chunk_size=600, chunk 1's bounds are [600, 1200].
    // We make chunk 1 return a segment that "ends" at 3000s absolute (way past 1200).
    const worker = vi.fn(async (_wav: string, offset: number) => {
      if (offset === 600) {
        // overflowing segment: starts at 9:00 absolute (within chunk), ends at 50:00 (past chunk end)
        return {
          segments: [
            { start: "00:09:00", end: "00:50:00", text: "overflow segment" },
            { start: "00:21:00", end: "00:21:30", text: "outside chunk after clamp" }, // start past chunk end (chunk 1 ends at 00:20:00)
          ],
          tags: [],
        };
      }
      return { segments: [{ start: "00:00:00", end: "00:00:05", text: "ok" }], tags: [] };
    });
    const extract = vi.fn(async (_v: string, _d: string, opts?: { filename?: string }) =>
      `/tmp/${opts?.filename ?? "audio.wav"}`,
    );
    const silenceDetector = vi.fn(async () => []);
    const result = await analyzeWithGeminiApi("/x.mp4", baseConfig, undefined, {
      getMetadata: metaStub(2400),
      extract,
      worker,
      silenceDetector,
    });
    // Find the clamped overflow segment in chunk 1's output
    const overflow = result.transcription.find(s => s.text === "overflow segment");
    expect(overflow).toBeDefined();
    expect(overflow!.end).toBe("00:20:00"); // clamped to chunk 1's end (1200s)
    expect(overflow!.start).toBe("00:10:00"); // clamped up from 09:00 to chunk 1's start (600s)
    // The "outside chunk after clamp" segment should be dropped (start 21:00 > chunk 1 end 20:00)
    const dropped = result.transcription.find(s => s.text === "outside chunk after clamp");
    expect(dropped).toBeUndefined();
  });

  it("uses single-call path when slice is provided, even for long videos", async () => {
    const worker = vi.fn(async () => ({
      segments: [{ start: "00:00:00", end: "00:00:05", text: "slice" }],
      tags: [],
    }));
    const extract = vi.fn(async () => "/tmp/audio.wav");
    const getMetadata = metaStub(2400); // long enough to trigger chunking absent slice
    const result = await analyzeWithGeminiApi(
      "/x.mp4",
      baseConfig,
      { startTime: "00:01:00", endTime: "00:02:00" },
      { getMetadata, extract, worker },
    );
    expect(worker).toHaveBeenCalledTimes(1);
    expect(getMetadata).not.toHaveBeenCalled(); // slice path skips metadata fetch entirely
    expect(result.transcription).toHaveLength(1);
    expect(result.warnings).toBeUndefined();
  });
});
