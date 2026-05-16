# Smart Video Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve 0labs-vision into a multi-pass, context-aware video analysis pipeline with session persistence, ffmpeg analytical filters, and progressive drill-down.

**Architecture:** Three layers — session management (persistence + manifest), analysis engine (ffmpeg filter orchestration + parsing), and tool surface (video_analyze, video_detail, enhanced video_watch). Each layer is independently testable.

**Tech Stack:** TypeScript, Node.js, ffmpeg filters (scdet, blackdetect, silencedetect, freezedetect, siti, blurdetect, signalstats, ebur128), zod schemas, vitest.

---

### Task 1: Types — Add New Interfaces

**Files:**
- Modify: `mcp-server/src/types.ts`
- Test: `mcp-server/tests/types.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// mcp-server/tests/types.test.ts
import { describe, it, expect } from "vitest";
import type {
  AnalysisFilters, SceneChange, Interval, FrameStats,
  VideoAnalysis, SessionManifest, Segment,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run tests/types.test.ts`
Expected: FAIL — types not yet exported.

- [ ] **Step 3: Add the types to `types.ts`**

Append the following after the existing `VideoWatchResult` interface in `mcp-server/src/types.ts`:

```typescript
export interface AnalysisFilters {
  scene_changes: boolean;
  black_intervals: boolean;
  silence: boolean;
  freeze: boolean;
  motion: boolean;
  blur: boolean;
  exposure: boolean;
  loudness: boolean;
  transcription: boolean;
}

export interface SceneChange {
  time: string;
  score: number;
}

export interface Interval {
  start: string;
  end: string;
  duration: number;
}

export interface FrameStats {
  timestamp: string;
  si?: number;
  ti?: number;
  blur?: number;
  brightness?: number;
  saturation?: number;
}

export interface VideoAnalysis {
  scenes: SceneChange[];
  black_intervals: Interval[];
  silence_intervals: Interval[];
  freeze_intervals: Interval[];
  frame_stats: FrameStats[];
  loudness_summary?: { mean_lufs: number; range_lu: number };
  transcription?: TranscriptionSegment[];
  content_profile: string;
}

export interface SessionManifest {
  video_hash: string;
  video_path: string;
  created_at: string;
  resolutions: Record<string, {
    frames: Array<{ timestamp: string; file: string }>;
  }>;
  analysis?: VideoAnalysis;
}

export interface Segment {
  start: string;
  end: string;
  fps: number;
  resolution?: number;
}
```

Also update the `Config` interface to add new fields:

```typescript
export interface Config {
  backend: Backend;
  whisper_engine: WhisperEngine;
  whisper_model: WhisperModel;
  whisper_at: boolean;
  frame_mode: FrameMode;
  frame_resolution: number;
  default_fps: number | "auto";
  max_frames: number;
  frame_describer_model: DescriberModel;
  enable_index: boolean;
  session_max_age_days: number;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run tests/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/types.ts mcp-server/tests/types.test.ts
git commit -m "feat(types): add analysis, session, and segment types"
```

---

### Task 2: Config — Add New Defaults

**Files:**
- Modify: `mcp-server/src/config.ts`
- Modify: `mcp-server/tests/config.test.ts`

- [ ] **Step 1: Write the tests**

Add these tests to `mcp-server/tests/config.test.ts` inside the existing `describe("config")` block:

```typescript
  it("returns new defaults for enable_index and session_max_age_days", () => {
    const config = loadConfig(join(TEST_DIR, "config.json"));
    expect(config.enable_index).toBe(false);
    expect(config.session_max_age_days).toBe(7);
  });

  it("preserves enable_index when set", () => {
    const configPath = join(TEST_DIR, "config.json");
    writeFileSync(configPath, JSON.stringify({ enable_index: true }));
    const loaded = loadConfig(configPath);
    expect(loaded.enable_index).toBe(true);
    expect(loaded.session_max_age_days).toBe(7);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run tests/config.test.ts`
Expected: FAIL — `enable_index` not in defaultConfig.

- [ ] **Step 3: Update `config.ts`**

Add the two new fields to `defaultConfig` in `mcp-server/src/config.ts`:

```typescript
export const defaultConfig: Config = {
  backend: "unconfigured",
  whisper_engine: "cpp",
  whisper_model: "auto",
  whisper_at: false,
  frame_mode: "images",
  frame_resolution: 512,
  default_fps: "auto",
  max_frames: 100,
  frame_describer_model: "sonnet",
  enable_index: false,
  session_max_age_days: 7,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run tests/config.test.ts`
Expected: PASS (all tests including existing ones)

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/config.ts mcp-server/tests/config.test.ts
git commit -m "feat(config): add enable_index and session_max_age_days"
```

---

### Task 3: Session Manager — Create, Load, Hash, Cleanup

**Files:**
- Create: `mcp-server/src/session/manager.ts`
- Test: `mcp-server/tests/session/manager.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// mcp-server/tests/session/manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  computeVideoHash, getSessionDir, cleanExpiredSessions,
} from "../../src/session/manager.js";

const TEST_DIR = join(tmpdir(), "cvv-session-test-" + Date.now());
const SESSIONS_DIR = join(TEST_DIR, "sessions");

describe("session manager", () => {
  beforeEach(() => {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("computeVideoHash", () => {
    it("returns a 12-char hex string", () => {
      const testFile = join(TEST_DIR, "test.mp4");
      writeFileSync(testFile, Buffer.alloc(128 * 1024, "x"));
      const hash = computeVideoHash(testFile);
      expect(hash).toMatch(/^[a-f0-9]{12}$/);
    });

    it("returns same hash for same content", () => {
      const file1 = join(TEST_DIR, "a.mp4");
      const file2 = join(TEST_DIR, "b.mp4");
      const content = Buffer.alloc(128 * 1024, "hello");
      writeFileSync(file1, content);
      writeFileSync(file2, content);
      expect(computeVideoHash(file1)).toBe(computeVideoHash(file2));
    });

    it("returns different hash for different content", () => {
      const file1 = join(TEST_DIR, "a.mp4");
      const file2 = join(TEST_DIR, "b.mp4");
      writeFileSync(file1, Buffer.alloc(128 * 1024, "aaa"));
      writeFileSync(file2, Buffer.alloc(128 * 1024, "bbb"));
      expect(computeVideoHash(file1)).not.toBe(computeVideoHash(file2));
    });
  });

  describe("getSessionDir", () => {
    it("returns path under sessions dir using video hash", () => {
      const testFile = join(TEST_DIR, "test.mp4");
      writeFileSync(testFile, Buffer.alloc(128 * 1024, "x"));
      const dir = getSessionDir(SESSIONS_DIR, testFile);
      expect(dir).toContain(SESSIONS_DIR);
      expect(dir).toMatch(/[a-f0-9]{12}$/);
    });
  });

  describe("cleanExpiredSessions", () => {
    it("removes sessions older than maxAgeDays", () => {
      const oldSession = join(SESSIONS_DIR, "old123456ab");
      mkdirSync(oldSession, { recursive: true });
      const manifest = {
        video_hash: "old123456ab",
        video_path: "/old.mp4",
        created_at: new Date(Date.now() - 10 * 86400_000).toISOString(),
        resolutions: {},
      };
      writeFileSync(join(oldSession, "manifest.json"), JSON.stringify(manifest));
      cleanExpiredSessions(SESSIONS_DIR, 7);
      expect(existsSync(oldSession)).toBe(false);
    });

    it("keeps sessions newer than maxAgeDays", () => {
      const newSession = join(SESSIONS_DIR, "new123456ab");
      mkdirSync(newSession, { recursive: true });
      const manifest = {
        video_hash: "new123456ab",
        video_path: "/new.mp4",
        created_at: new Date().toISOString(),
        resolutions: {},
      };
      writeFileSync(join(newSession, "manifest.json"), JSON.stringify(manifest));
      cleanExpiredSessions(SESSIONS_DIR, 7);
      expect(existsSync(newSession)).toBe(true);
    });

    it("does nothing if sessions dir does not exist", () => {
      expect(() => cleanExpiredSessions("/nonexistent/path", 7)).not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run tests/session/manager.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `session/manager.ts`**

```typescript
// mcp-server/src/session/manager.ts
import { createHash } from "crypto";
import { readFileSync, existsSync, readdirSync, rmSync, statSync, openSync, readSync, closeSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { SessionManifest } from "../types.js";

export function computeVideoHash(videoPath: string): string {
  const fd = openSync(videoPath, "r");
  const chunkSize = 64 * 1024;
  const buffer = Buffer.alloc(chunkSize);
  const bytesRead = readSync(fd, buffer, 0, chunkSize, 0);
  closeSync(fd);

  const fileSize = statSync(videoPath).size;
  const hash = createHash("sha256");
  hash.update(buffer.subarray(0, bytesRead));
  hash.update(String(fileSize));
  return hash.digest("hex").slice(0, 12);
}

export function getSessionDir(sessionsRoot: string, videoPath: string): string {
  const hash = computeVideoHash(videoPath);
  return join(sessionsRoot, hash);
}

export function loadManifest(sessionDir: string): SessionManifest | null {
  const manifestPath = join(sessionDir, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  return JSON.parse(readFileSync(manifestPath, "utf-8"));
}

export function saveManifest(sessionDir: string, manifest: SessionManifest): void {
  if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true });
  writeFileSync(join(sessionDir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

export function cleanExpiredSessions(sessionsRoot: string, maxAgeDays: number): void {
  if (!existsSync(sessionsRoot)) return;

  const cutoff = Date.now() - maxAgeDays * 86400_000;
  const entries = readdirSync(sessionsRoot);

  for (const entry of entries) {
    const sessionDir = join(sessionsRoot, entry);
    const manifestPath = join(sessionDir, "manifest.json");
    if (!existsSync(manifestPath)) continue;

    try {
      const manifest: SessionManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      const createdAt = new Date(manifest.created_at).getTime();
      if (createdAt < cutoff) {
        rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch {
      rmSync(sessionDir, { recursive: true, force: true });
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run tests/session/manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/session/manager.ts mcp-server/tests/session/manager.test.ts
git commit -m "feat(session): add session manager with hash, manifest, and cleanup"
```

---

### Task 4: Session Manifest — Merge and Deduplication Logic

**Files:**
- Create: `mcp-server/src/session/manifest.ts`
- Test: `mcp-server/tests/session/manifest.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// mcp-server/tests/session/manifest.test.ts
import { describe, it, expect } from "vitest";
import {
  createManifest, mergeFrames, getUncachedTimestamps, sampleFrameIndices,
} from "../../src/session/manifest.js";

describe("manifest", () => {
  describe("createManifest", () => {
    it("creates a manifest with empty resolutions", () => {
      const m = createManifest("abc123", "/test.mp4");
      expect(m.video_hash).toBe("abc123");
      expect(m.resolutions).toEqual({});
      expect(m.created_at).toBeDefined();
    });
  });

  describe("mergeFrames", () => {
    it("adds frames to a new resolution bucket", () => {
      const m = createManifest("abc", "/test.mp4");
      const frames = [
        { timestamp: "00:00:02", file: "512/frame_00_00_02.jpg" },
        { timestamp: "00:00:04", file: "512/frame_00_00_04.jpg" },
      ];
      const updated = mergeFrames(m, "512", frames);
      expect(updated.resolutions["512"].frames).toHaveLength(2);
    });

    it("deduplicates by timestamp within same resolution", () => {
      const m = createManifest("abc", "/test.mp4");
      m.resolutions["512"] = {
        frames: [{ timestamp: "00:00:02", file: "512/frame_00_00_02.jpg" }],
      };
      const newFrames = [
        { timestamp: "00:00:02", file: "512/frame_00_00_02.jpg" },
        { timestamp: "00:00:06", file: "512/frame_00_00_06.jpg" },
      ];
      const updated = mergeFrames(m, "512", newFrames);
      expect(updated.resolutions["512"].frames).toHaveLength(2);
      expect(updated.resolutions["512"].frames.map((f) => f.timestamp)).toEqual(["00:00:02", "00:00:06"]);
    });

    it("keeps different resolutions separate", () => {
      const m = createManifest("abc", "/test.mp4");
      const merged1 = mergeFrames(m, "512", [{ timestamp: "00:00:02", file: "512/frame_00_00_02.jpg" }]);
      const merged2 = mergeFrames(merged1, "1024", [{ timestamp: "00:00:02", file: "1024/frame_00_00_02.jpg" }]);
      expect(Object.keys(merged2.resolutions)).toEqual(["512", "1024"]);
    });
  });

  describe("getUncachedTimestamps", () => {
    it("returns all timestamps when nothing is cached", () => {
      const m = createManifest("abc", "/test.mp4");
      const wanted = ["00:00:02", "00:00:04", "00:00:06"];
      expect(getUncachedTimestamps(m, "512", wanted)).toEqual(wanted);
    });

    it("excludes already-cached timestamps", () => {
      const m = createManifest("abc", "/test.mp4");
      m.resolutions["512"] = {
        frames: [{ timestamp: "00:00:02", file: "512/frame_00_00_02.jpg" }],
      };
      const wanted = ["00:00:02", "00:00:04", "00:00:06"];
      expect(getUncachedTimestamps(m, "512", wanted)).toEqual(["00:00:04", "00:00:06"]);
    });

    it("returns all when resolution bucket does not exist", () => {
      const m = createManifest("abc", "/test.mp4");
      m.resolutions["512"] = {
        frames: [{ timestamp: "00:00:02", file: "512/frame_00_00_02.jpg" }],
      };
      expect(getUncachedTimestamps(m, "1024", ["00:00:02"])).toEqual(["00:00:02"]);
    });
  });

  describe("sampleFrameIndices", () => {
    it("returns all indices when count >= total", () => {
      expect(sampleFrameIndices(5, 10)).toEqual([0, 1, 2, 3, 4]);
    });

    it("returns evenly spaced indices", () => {
      const indices = sampleFrameIndices(10, 3);
      expect(indices).toEqual([0, 5, 9]);
    });

    it("returns single index for count=1", () => {
      expect(sampleFrameIndices(10, 1)).toEqual([0]);
    });

    it("returns empty for totalFrames=0", () => {
      expect(sampleFrameIndices(0, 3)).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run tests/session/manifest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `session/manifest.ts`**

```typescript
// mcp-server/src/session/manifest.ts
import type { SessionManifest } from "../types.js";

type ManifestFrame = { timestamp: string; file: string };

export function createManifest(videoHash: string, videoPath: string): SessionManifest {
  return {
    video_hash: videoHash,
    video_path: videoPath,
    created_at: new Date().toISOString(),
    resolutions: {},
  };
}

export function mergeFrames(
  manifest: SessionManifest,
  resolution: string,
  newFrames: ManifestFrame[],
): SessionManifest {
  const existing = manifest.resolutions[resolution]?.frames ?? [];
  const seen = new Set(existing.map((f) => f.timestamp));
  const deduped = [...existing];

  for (const frame of newFrames) {
    if (!seen.has(frame.timestamp)) {
      deduped.push(frame);
      seen.add(frame.timestamp);
    }
  }

  deduped.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return {
    ...manifest,
    resolutions: {
      ...manifest.resolutions,
      [resolution]: { frames: deduped },
    },
  };
}

export function getUncachedTimestamps(
  manifest: SessionManifest,
  resolution: string,
  wanted: string[],
): string[] {
  const cached = new Set(
    (manifest.resolutions[resolution]?.frames ?? []).map((f) => f.timestamp),
  );
  return wanted.filter((ts) => !cached.has(ts));
}

export function sampleFrameIndices(totalFrames: number, count: number): number[] {
  if (totalFrames === 0) return [];
  if (count >= totalFrames) return Array.from({ length: totalFrames }, (_, i) => i);
  if (count === 1) return [0];

  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    indices.push(Math.round((i * (totalFrames - 1)) / (count - 1)));
  }
  return indices;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run tests/session/manifest.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/session/manifest.ts mcp-server/tests/session/manifest.test.ts
git commit -m "feat(session): add manifest merge, dedup, and sampling logic"
```

---

### Task 5: Analyzers — FFmpeg Filter Orchestration and Output Parsing

**Files:**
- Create: `mcp-server/src/extractors/analyzers.ts`
- Test: `mcp-server/tests/extractors/analyzers.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// mcp-server/tests/extractors/analyzers.test.ts
import { describe, it, expect } from "vitest";
import {
  buildAnalysisCommand, parseScdetOutput, parseBlackdetectOutput,
  parseSilenceOutput, parseFreezeOutput,
  deriveContentProfile,
} from "../../src/extractors/analyzers.js";
import type { AnalysisFilters } from "../../src/types.js";

describe("analyzers", () => {
  describe("buildAnalysisCommand", () => {
    it("builds command with only scene_changes", () => {
      const filters: AnalysisFilters = {
        scene_changes: true, black_intervals: false, silence: false,
        freeze: false, motion: false, blur: false, exposure: false,
        loudness: false, transcription: false,
      };
      const cmd = buildAnalysisCommand("/test.mp4", filters, "/tmp/work");
      expect(cmd).not.toBeNull();
      expect(cmd!.args).toContain("-i");
      expect(cmd!.args).toContain("/test.mp4");
      const vfIndex = cmd!.args.indexOf("-vf");
      expect(vfIndex).toBeGreaterThan(-1);
      expect(cmd!.args[vfIndex + 1]).toContain("scdet");
    });

    it("builds command with audio filters", () => {
      const filters: AnalysisFilters = {
        scene_changes: false, black_intervals: false, silence: true,
        freeze: false, motion: false, blur: false, exposure: false,
        loudness: true, transcription: false,
      };
      const cmd = buildAnalysisCommand("/test.mp4", filters, "/tmp/work");
      const afIndex = cmd!.args.indexOf("-af");
      expect(afIndex).toBeGreaterThan(-1);
      expect(cmd!.args[afIndex + 1]).toContain("silencedetect");
      expect(cmd!.args[afIndex + 1]).toContain("ebur128");
    });

    it("returns null for no filters selected", () => {
      const filters: AnalysisFilters = {
        scene_changes: false, black_intervals: false, silence: false,
        freeze: false, motion: false, blur: false, exposure: false,
        loudness: false, transcription: false,
      };
      const cmd = buildAnalysisCommand("/test.mp4", filters, "/tmp/work");
      expect(cmd).toBeNull();
    });

    it("combines video and audio filters in single command", () => {
      const filters: AnalysisFilters = {
        scene_changes: true, black_intervals: false, silence: true,
        freeze: false, motion: false, blur: false, exposure: false,
        loudness: false, transcription: false,
      };
      const cmd = buildAnalysisCommand("/test.mp4", filters, "/tmp/work");
      expect(cmd!.args).toContain("-vf");
      expect(cmd!.args).toContain("-af");
    });
  });

  describe("parseScdetOutput", () => {
    it("parses scene change lines from stderr", () => {
      const stderr = `
[Parsed_scdet_0 @ 0x1234] lavfi.scd.score=64.35 lavfi.scd.time=12.512
[Parsed_scdet_0 @ 0x1234] lavfi.scd.score=43.21 lavfi.scd.time=25.025
`;
      const scenes = parseScdetOutput(stderr);
      expect(scenes).toHaveLength(2);
      expect(scenes[0]).toEqual({ time: "00:00:12", score: 64.35 });
      expect(scenes[1]).toEqual({ time: "00:00:25", score: 43.21 });
    });

    it("returns empty array for no matches", () => {
      expect(parseScdetOutput("no scenes here")).toEqual([]);
    });
  });

  describe("parseBlackdetectOutput", () => {
    it("parses black interval lines", () => {
      const stderr = "[blackdetect @ 0x1] black_start:23.5 black_end:25.0 black_duration:1.5\n";
      const intervals = parseBlackdetectOutput(stderr);
      expect(intervals).toHaveLength(1);
      expect(intervals[0]).toEqual({ start: "00:00:23", end: "00:00:25", duration: 1.5 });
    });
  });

  describe("parseSilenceOutput", () => {
    it("parses silence start/end pairs", () => {
      const stderr = `
[silencedetect @ 0x1] silence_start: 5.234
[silencedetect @ 0x1] silence_end: 8.567 | silence_duration: 3.333
`;
      const intervals = parseSilenceOutput(stderr);
      expect(intervals).toHaveLength(1);
      expect(intervals[0]).toEqual({ start: "00:00:05", end: "00:00:08", duration: 3.333 });
    });
  });

  describe("parseFreezeOutput", () => {
    it("parses freeze start/end/duration", () => {
      const stderr = `
[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 10.000
[freezedetect @ 0x1] lavfi.freezedetect.freeze_duration: 5.500
[freezedetect @ 0x1] lavfi.freezedetect.freeze_end: 15.500
`;
      const intervals = parseFreezeOutput(stderr);
      expect(intervals).toHaveLength(1);
      expect(intervals[0]).toEqual({ start: "00:00:10", end: "00:00:15", duration: 5.5 });
    });
  });

  describe("deriveContentProfile", () => {
    it("derives profile from SI/TI averages", () => {
      const profile = deriveContentProfile(65, 12);
      expect(profile).toContain("high");
    });

    it("handles undefined values", () => {
      const profile = deriveContentProfile(undefined, undefined);
      expect(profile).toBe("unknown (no motion analysis data)");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run tests/extractors/analyzers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `extractors/analyzers.ts`**

```typescript
// mcp-server/src/extractors/analyzers.ts
import { join } from "path";
import { formatHMS } from "../utils/timestamps.js";
import type { AnalysisFilters, SceneChange, Interval } from "../types.js";

export interface AnalysisCommand {
  args: string[];
  videoMetaFile: string | null;
  audioMetaFile: string | null;
}

export function buildAnalysisCommand(
  videoPath: string,
  filters: AnalysisFilters,
  workDir: string,
): AnalysisCommand | null {
  const videoFilters: string[] = [];
  const audioFilters: string[] = [];
  let videoMetaFile: string | null = null;
  let audioMetaFile: string | null = null;

  if (filters.scene_changes) videoFilters.push("scdet=threshold=8");
  if (filters.black_intervals) videoFilters.push("blackdetect=d=0.5:pix_th=0.10:pic_th=0.90");
  if (filters.freeze) videoFilters.push("freezedetect=noise=0.003:duration=1");
  if (filters.motion) videoFilters.push("siti=print_summary=1");
  if (filters.blur) videoFilters.push("blurdetect");
  if (filters.exposure) videoFilters.push("signalstats");

  if (filters.silence) audioFilters.push("silencedetect=noise=-30dB:duration=0.5");
  if (filters.loudness) audioFilters.push("ebur128=metadata=1:peak=true");

  if (videoFilters.length === 0 && audioFilters.length === 0) return null;

  const args: string[] = ["-i", videoPath];

  if (videoFilters.length > 0) {
    videoMetaFile = join(workDir, "video_meta.txt");
    videoFilters.push(`metadata=mode=print:file=${videoMetaFile}`);
    args.push("-vf", videoFilters.join(","));
  }

  if (audioFilters.length > 0) {
    audioMetaFile = join(workDir, "audio_meta.txt");
    audioFilters.push(`ametadata=mode=print:file=${audioMetaFile}`);
    args.push("-af", audioFilters.join(","));
  }

  args.push("-f", "null", "-");

  return { args, videoMetaFile, audioMetaFile };
}

export function parseScdetOutput(stderr: string): SceneChange[] {
  const results: SceneChange[] = [];
  const regex = /lavfi\.scd\.score=([\d.]+)\s+lavfi\.scd\.time=([\d.]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(stderr)) !== null) {
    results.push({
      time: formatHMS(parseFloat(match[2])),
      score: parseFloat(match[1]),
    });
  }
  return results;
}

export function parseBlackdetectOutput(stderr: string): Interval[] {
  const results: Interval[] = [];
  const regex = /black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(stderr)) !== null) {
    results.push({
      start: formatHMS(parseFloat(match[1])),
      end: formatHMS(parseFloat(match[2])),
      duration: parseFloat(match[3]),
    });
  }
  return results;
}

export function parseSilenceOutput(stderr: string): Interval[] {
  const results: Interval[] = [];
  const startRegex = /silence_start:\s*([\d.]+)/g;
  const endRegex = /silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g;

  const starts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = startRegex.exec(stderr)) !== null) {
    starts.push(parseFloat(match[1]));
  }

  let i = 0;
  while ((match = endRegex.exec(stderr)) !== null) {
    const startSec = starts[i] ?? 0;
    results.push({
      start: formatHMS(startSec),
      end: formatHMS(parseFloat(match[1])),
      duration: parseFloat(match[2]),
    });
    i++;
  }
  return results;
}

export function parseFreezeOutput(stderr: string): Interval[] {
  const results: Interval[] = [];
  const startRegex = /freeze_start:\s*([\d.]+)/g;
  const endRegex = /freeze_end:\s*([\d.]+)/g;
  const durationRegex = /freeze_duration:\s*([\d.]+)/g;

  const starts: number[] = [];
  const ends: number[] = [];
  const durations: number[] = [];

  let match: RegExpExecArray | null;
  while ((match = startRegex.exec(stderr)) !== null) starts.push(parseFloat(match[1]));
  while ((match = endRegex.exec(stderr)) !== null) ends.push(parseFloat(match[1]));
  while ((match = durationRegex.exec(stderr)) !== null) durations.push(parseFloat(match[1]));

  for (let i = 0; i < starts.length; i++) {
    results.push({
      start: formatHMS(starts[i]),
      end: formatHMS(ends[i] ?? starts[i] + (durations[i] ?? 0)),
      duration: durations[i] ?? 0,
    });
  }
  return results;
}

export function parseSitiOutput(stderr: string): { siAvg?: number; tiAvg?: number } {
  const siMatch = stderr.match(/Spatial Information:\s*Average:\s*([\d.]+)/);
  const tiMatch = stderr.match(/Temporal Information:\s*Average:\s*([\d.]+)/);
  return {
    siAvg: siMatch ? parseFloat(siMatch[1]) : undefined,
    tiAvg: tiMatch ? parseFloat(tiMatch[1]) : undefined,
  };
}

export function parseBlurOutput(metaFileContent: string): Array<{ timestamp: number; blur: number }> {
  const results: Array<{ timestamp: number; blur: number }> = [];
  let currentPtsTime: number | null = null;

  for (const line of metaFileContent.split("\n")) {
    const ptsMatch = line.match(/pts_time:([\d.]+)/);
    if (ptsMatch) currentPtsTime = parseFloat(ptsMatch[1]);

    const blurMatch = line.match(/lavfi\.blur=([\d.]+)/);
    if (blurMatch && currentPtsTime !== null) {
      results.push({ timestamp: currentPtsTime, blur: parseFloat(blurMatch[1]) });
    }
  }
  return results;
}

export function parseSignalstatsOutput(metaFileContent: string): Array<{ timestamp: number; brightness: number; saturation: number }> {
  const results: Array<{ timestamp: number; brightness: number; saturation: number }> = [];
  let currentPtsTime: number | null = null;
  let currentYavg: number | null = null;
  let currentSat: number | null = null;

  for (const line of metaFileContent.split("\n")) {
    const ptsMatch = line.match(/pts_time:([\d.]+)/);
    if (ptsMatch) {
      if (currentPtsTime !== null && currentYavg !== null) {
        results.push({ timestamp: currentPtsTime, brightness: currentYavg, saturation: currentSat ?? 0 });
      }
      currentPtsTime = parseFloat(ptsMatch[1]);
      currentYavg = null;
      currentSat = null;
    }

    const yavgMatch = line.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
    if (yavgMatch) currentYavg = parseFloat(yavgMatch[1]);

    const satMatch = line.match(/lavfi\.signalstats\.SATAVG=([\d.]+)/);
    if (satMatch) currentSat = parseFloat(satMatch[1]);
  }

  if (currentPtsTime !== null && currentYavg !== null) {
    results.push({ timestamp: currentPtsTime, brightness: currentYavg, saturation: currentSat ?? 0 });
  }

  return results;
}

export function parseEbur128Output(stderr: string): { mean_lufs: number; range_lu: number } | undefined {
  const iMatch = stderr.match(/I:\s+([-\d.]+)\s+LUFS/);
  const lraMatch = stderr.match(/LRA:\s+([\d.]+)\s+LU/);
  if (!iMatch || !lraMatch) return undefined;
  return {
    mean_lufs: parseFloat(iMatch[1]),
    range_lu: parseFloat(lraMatch[1]),
  };
}

export function deriveContentProfile(siAvg: number | undefined, tiAvg: number | undefined): string {
  if (siAvg === undefined || tiAvg === undefined) return "unknown (no motion analysis data)";

  const siLabel = siAvg > 50 ? "high" : siAvg > 25 ? "moderate" : "low";
  const tiLabel = tiAvg > 30 ? "high" : tiAvg > 10 ? "moderate" : "low";

  const descriptions: Record<string, string> = {
    "high-high": "high visual complexity, high motion (action, sports, fast-cutting)",
    "high-moderate": "high visual complexity, moderate motion (documentary, detailed scenes)",
    "high-low": "high visual complexity, low motion (detailed static shots, landscapes)",
    "moderate-high": "moderate complexity, high motion (animation, fast graphics)",
    "moderate-moderate": "moderate complexity, moderate motion (dialogue scenes, tutorials)",
    "moderate-low": "moderate complexity, low motion (presentations, talking head)",
    "low-high": "low complexity, high motion (simple fast-moving graphics)",
    "low-moderate": "low complexity, moderate motion (screencast with scrolling)",
    "low-low": "low complexity, low motion (static slides, title cards)",
  };

  return descriptions[`${siLabel}-${tiLabel}`] ?? `SI=${siAvg.toFixed(1)}, TI=${tiAvg.toFixed(1)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run tests/extractors/analyzers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/extractors/analyzers.ts mcp-server/tests/extractors/analyzers.test.ts
git commit -m "feat(analyzers): add ffmpeg filter orchestration and output parsing"
```

---

### Task 6: Segment-Based Frame Extraction

**Files:**
- Modify: `mcp-server/src/extractors/frames.ts`
- Test: `mcp-server/tests/extractors/frames-segments.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// mcp-server/tests/extractors/frames-segments.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { extractFramesBySegments, generateTimestampsForSegment } from "../../src/extractors/frames.js";
import { join } from "path";
import { rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import type { Segment } from "../../src/types.js";

const FIXTURE = join(import.meta.dirname, "../fixtures/test-3s.mp4");
const OUT_DIR = join(tmpdir(), "cvv-segments-test-" + Date.now());

describe("segment-based frame extraction", () => {
  afterEach(() => {
    if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  });

  describe("generateTimestampsForSegment", () => {
    it("generates timestamps at the given fps within the range", () => {
      const timestamps = generateTimestampsForSegment(
        { start: "00:00:00", end: "00:00:04", fps: 1 },
      );
      expect(timestamps).toEqual(["00:00:00", "00:00:01", "00:00:02", "00:00:03"]);
    });

    it("handles fractional fps", () => {
      const timestamps = generateTimestampsForSegment(
        { start: "00:00:00", end: "00:00:10", fps: 0.5 },
      );
      expect(timestamps).toEqual(["00:00:00", "00:00:02", "00:00:04", "00:00:06", "00:00:08"]);
    });
  });

  describe("extractFramesBySegments", () => {
    it("extracts frames for a single segment", async () => {
      const segments: Segment[] = [
        { start: "00:00:00", end: "00:00:03", fps: 1, resolution: 256 },
      ];
      const result = await extractFramesBySegments(FIXTURE, segments, OUT_DIR);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0].timestamp).toBeDefined();
      expect(result[0].image).toBeDefined();
      expect(result[0].resolution).toBe(256);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run tests/extractors/frames-segments.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Add segment extraction to `frames.ts`**

At the top of `mcp-server/src/extractors/frames.ts`, update the type import:

```typescript
import type { VideoMetadata, Frame, Segment } from "../types.js";
```

Add at the end of the file:

```typescript
export interface SegmentFrame extends Frame {
  resolution: number;
}

export function generateTimestampsForSegment(segment: Segment): string[] {
  const startSec = parseHMS(segment.start);
  const endSec = parseHMS(segment.end);
  const interval = 1 / segment.fps;
  const timestamps: string[] = [];

  for (let t = startSec; t < endSec; t += interval) {
    timestamps.push(formatHMS(Math.round(t)));
  }

  return timestamps;
}

export async function extractFramesBySegments(
  videoPath: string,
  segments: Segment[],
  baseOutputDir: string,
): Promise<SegmentFrame[]> {
  const allFrames: SegmentFrame[] = [];

  for (const segment of segments) {
    const resolution = segment.resolution ?? 512;
    const resDir = join(baseOutputDir, String(resolution));

    if (!existsSync(resDir)) mkdirSync(resDir, { recursive: true });

    const frames = await extractFrames(videoPath, {
      fps: segment.fps,
      resolution,
      outputDir: resDir,
      startTime: segment.start,
      endTime: segment.end,
      maxFrames: 1000,
    });

    for (const frame of frames) {
      allFrames.push({ ...frame, resolution });
    }
  }

  return allFrames;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npx vitest run tests/extractors/frames-segments.test.ts`
Expected: PASS

- [ ] **Step 5: Run existing frame tests for regression check**

Run: `cd mcp-server && npx vitest run tests/extractors/frames.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add mcp-server/src/extractors/frames.ts mcp-server/tests/extractors/frames-segments.test.ts
git commit -m "feat(frames): add segment-based extraction with per-segment resolution"
```

---

### Task 7: `video_analyze` Tool — Registration and Integration

**Files:**
- Create: `mcp-server/src/tools/video-analyze.ts`
- Modify: `mcp-server/src/index.ts`

This task creates the tool file and registers it. The implementation uses `execFile` (not `exec`) via `execFileAsync` for running ffmpeg — consistent with the codebase's security-hardened approach. See the design spec section 2 for full details.

- [ ] **Step 1: Create `video-analyze.ts`**

Create `mcp-server/src/tools/video-analyze.ts` using the schema and handler from design spec section 2. Key implementation points:

- Import `execFile` from `child_process` and promisify it (same pattern as `frames.ts` and `local.ts`)
- Use `buildAnalysisCommand` to dynamically build the ffmpeg command
- Parse stderr and metadata files using the analyzer functions
- For `transcription: true`, reuse existing audio backends (gemini, openai, local)
- When `enable_index: true`, save analysis to session
- Clean up temp workDir after processing

- [ ] **Step 2: Register in `index.ts`**

Add import and registration:

```typescript
import { registerVideoAnalyze } from "./tools/video-analyze.js";
// ...
registerVideoAnalyze(server);
```

- [ ] **Step 3: Build and verify**

Run: `cd mcp-server && npm run build`
Expected: No errors.

- [ ] **Step 4: Run all tests**

Run: `cd mcp-server && npm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/video-analyze.ts mcp-server/src/index.ts
git commit -m "feat(tools): add video_analyze tool with ffmpeg filter orchestration"
```

---

### Task 8: `video_detail` Tool — Drill-Down with Session Caching

**Files:**
- Create: `mcp-server/src/tools/video-detail.ts`
- Modify: `mcp-server/src/index.ts`

This task creates the drill-down tool. See design spec section 3 for full schema and behavior. Key implementation points:

- Phase 1 (extraction): Use `extractFramesBySegments`, skip cached frames when `skip_cached` and session is available
- Phase 2 (viewing): Use `view` for specific timestamps or `view_sample` for evenly spaced sampling via `sampleFrameIndices`
- Return manifest summary as text + selected frames as images
- Without session: extract to tmp, return, cleanup

- [ ] **Step 1: Create `video-detail.ts`**

Implement the tool using the schema from the design spec. Use `extractFramesBySegments` for extraction, `sampleFrameIndices` for sampling, and session manager for caching.

- [ ] **Step 2: Register in `index.ts`**

```typescript
import { registerVideoDetail } from "./tools/video-detail.js";
// ...
registerVideoDetail(server);
```

- [ ] **Step 3: Build and verify**

Run: `cd mcp-server && npm run build`
Expected: No errors.

- [ ] **Step 4: Run all tests**

Run: `cd mcp-server && npm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/video-detail.ts mcp-server/src/index.ts
git commit -m "feat(tools): add video_detail tool with drill-down and session caching"
```

---

### Task 9: Enhance `video_watch` — Segments, view_sample, Session Support

**Files:**
- Modify: `mcp-server/src/tools/video-watch.ts`

Add `segments`, `view_sample`, and session support to the existing `video_watch` tool. See design spec section 4 for details. This is backward-compatible — all existing parameters work identically.

- [ ] **Step 1: Add new imports**

Add to the imports in `video-watch.ts`:

```typescript
import { extractFramesBySegments } from "../extractors/frames.js";
import { getSessionDir, loadManifest, saveManifest, computeVideoHash } from "../session/manager.js";
import { createManifest, mergeFrames, sampleFrameIndices } from "../session/manifest.js";
import type { Segment } from "../types.js";
```

- [ ] **Step 2: Add SESSIONS_DIR constant and new schema params**

```typescript
const SESSIONS_DIR = join(homedir(), ".0labs-vision", "sessions");
```

Add to schema after `skip_audio`:

```typescript
      segments: z.array(z.object({
        start: z.string().regex(HMS_REGEX, "Must be HH:MM:SS format"),
        end: z.string().regex(HMS_REGEX, "Must be HH:MM:SS format"),
        fps: z.number().positive(),
        resolution: z.number().min(128).max(2048).optional(),
      })).optional().describe("Variable FPS/resolution segments — overrides global fps/start_time/end_time"),
      view_sample: z.number().min(1).optional().describe("Return only N evenly spaced frames"),
```

- [ ] **Step 3: Add session init, segment extraction, view_sample, and manifest to handler**

After `safePath` assignment, add session initialization. In the extraction block, add segment support (if `params.segments` provided, use `extractFramesBySegments`). After audio processing, add `view_sample` filtering. Before cleanup, save manifest. Add manifest to response content. Skip cleanup when `useSession` is true.

- [ ] **Step 4: Build and verify**

Run: `cd mcp-server && npm run build`
Expected: No errors.

- [ ] **Step 5: Run all tests**

Run: `cd mcp-server && npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add mcp-server/src/tools/video-watch.ts
git commit -m "feat(video_watch): add segments, view_sample, and session persistence"
```

---

### Task 10: Enhance `video_configure` — New Config Fields and Session Clearing

**Files:**
- Modify: `mcp-server/src/tools/video-configure.ts`

- [ ] **Step 1: Add new schema params and session clearing**

Add `existsSync` and `rmSync` to imports. Add to schema:

```typescript
      enable_index: z.boolean().optional(),
      session_max_age_days: z.number().min(1).optional(),
      clear_sessions: z.boolean().optional(),
```

Add session clearing logic at the start of the handler. Exclude `clear_sessions` from config update loop.

- [ ] **Step 2: Build and verify**

Run: `cd mcp-server && npm run build`
Expected: No errors.

- [ ] **Step 3: Run all tests**

Run: `cd mcp-server && npm test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add mcp-server/src/tools/video-configure.ts
git commit -m "feat(configure): add enable_index, session_max_age_days, clear_sessions"
```

---

### Task 11: Session Cleanup on Server Startup

**Files:**
- Modify: `mcp-server/src/index.ts`

- [ ] **Step 1: Add cleanup to index.ts**

Add imports for `join`, `homedir`, `loadConfig`, and `cleanExpiredSessions`. Before `const transport`, add:

```typescript
const CONFIG_PATH = join(homedir(), ".0labs-vision", "config.json");
const config = loadConfig(CONFIG_PATH);
if (config.enable_index) {
  const sessionsDir = join(homedir(), ".0labs-vision", "sessions");
  cleanExpiredSessions(sessionsDir, config.session_max_age_days);
}
```

- [ ] **Step 2: Build and verify**

Run: `cd mcp-server && npm run build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add mcp-server/src/index.ts
git commit -m "feat(startup): add expired session cleanup on server boot"
```

---

### Task 12: Rewrite `video-perception` Skill

**Files:**
- Modify: `skills/video-perception/SKILL.md`

- [ ] **Step 1: Rewrite the skill**

Replace the full content of `skills/video-perception/SKILL.md` with the updated workflow from design spec section 5. Key changes:

- Add `video_analyze` and `video_detail` to Available Tools
- New workflow: info → analyze → plan segments → watch with view_sample → detail for drill-down
- Filter selection guide table
- Efficiency directive (binary search, start narrow, expand if needed)
- Parameter guide for new params (segments, view_sample, skip_audio)
- Manifest-aware follow-up guidance

- [ ] **Step 2: Commit**

```bash
git add skills/video-perception/SKILL.md
git commit -m "feat(skill): rewrite video-perception with analyze-first workflow"
```

---

### Task 13: Final Integration — Build, Test, Verify

- [ ] **Step 1: Full build**

Run: `cd mcp-server && npm run build`
Expected: No errors.

- [ ] **Step 2: Full test suite**

Run: `cd mcp-server && npm test`
Expected: All tests pass.

- [ ] **Step 3: Verify file structure**

Run: `find mcp-server/src -name "*.ts" | sort`

Expected to include all new files:
- `mcp-server/src/extractors/analyzers.ts`
- `mcp-server/src/session/manager.ts`
- `mcp-server/src/session/manifest.ts`
- `mcp-server/src/tools/video-analyze.ts`
- `mcp-server/src/tools/video-detail.ts`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify integration — smart video analysis v2 complete"
```

