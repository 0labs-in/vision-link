# Smart Video Analysis — Design Spec

**Date:** 2026-04-25
**Scope:** Index/manifest system, ffmpeg analytical filters, drill-down tool, adaptive frame extraction

## Overview

Evolve 0labs-vision from a single-pass, stateless extractor into a multi-pass, context-aware video analysis pipeline. Claude gains the ability to:

1. Analyze video structure (scenes, silence, motion, brightness) via ffmpeg filters before extracting frames
2. Receive audio transcription alongside structural analysis to make informed extraction decisions
3. Extract frames with variable FPS/resolution per segment based on content analysis
4. Drill into specific moments progressively (extract first, view selectively, expand if needed)
5. Avoid re-extracting or re-viewing frames already in context via a persistent session/manifest system

## 1. Session System

### Identification

Video sessions are identified by SHA-256 of the first 64KB of the file + total file size. Fast to compute, collision-proof, and portable (same video moved between directories is recognized).

### Persistence

When `enable_index: true` in config, extracted data persists between tool calls:

```
~/.0labs-vision/sessions/
  {video-hash-12chars}/
    manifest.json
    analysis.json
    512/
      frame_00_00_02.jpg
      frame_00_00_04.jpg
    1024/
      frame_00_00_04.jpg
```

When `enable_index: false` (default), current behavior: everything in `/tmp/`, deleted after tool returns.

### Manifest Structure

Frames are organized by resolution. Timestamps are the deduplication key — changing FPS does not trigger re-extraction of existing timestamps. Only a new resolution creates new assets.

```json
{
  "video_hash": "a1b2c3d4e5f6",
  "video_path": "/path/to/video.mp4",
  "created_at": "2026-04-25T16:00:00Z",
  "resolutions": {
    "512": {
      "frames": [
        { "timestamp": "00:00:02", "file": "512/frame_00_00_02.jpg" },
        { "timestamp": "00:00:04", "file": "512/frame_00_00_04.jpg" }
      ]
    },
    "1024": {
      "frames": [
        { "timestamp": "00:00:04", "file": "1024/frame_00_00_04.jpg" }
      ]
    }
  },
  "analysis": null
}
```

### Lifecycle

- Created on first `video_watch`, `video_analyze`, or `video_detail` call for a video
- Reused on subsequent calls (drill-down, re-watch)
- Auto-cleaned after `session_max_age_days` (default 7)
- Manual cleanup via `video_configure` with `clear_sessions: true`

## 2. `video_analyze` — New Tool

Runs ffmpeg analytical filters in a single pass and returns structured metadata. Does not extract frames.

### Schema

```typescript
{
  path: z.string().describe("Absolute or relative path to the video file"),
  filters: z.object({
    scene_changes: z.boolean().default(false),   // scdet — where cuts happen
    black_intervals: z.boolean().default(false),  // blackdetect — transitions, fades
    silence: z.boolean().default(false),          // silencedetect — pauses, chapter breaks
    freeze: z.boolean().default(false),           // freezedetect — still images, slides, paused content
    motion: z.boolean().default(false),           // siti — spatial info (complexity) + temporal info (motion)
    blur: z.boolean().default(false),             // blurdetect — sharpness score per frame
    exposure: z.boolean().default(false),         // signalstats — brightness, contrast, saturation per frame
    loudness: z.boolean().default(false),         // ebur128 — momentary loudness, speech vs music
    transcription: z.boolean().default(false),    // audio transcription via configured backend
  }),
}
```

### Filter Selection Guidance (for the skill)

Claude selects filters based on the user's question:

| User intent | Filters |
|---|---|
| "What happens in this video?" | scene_changes, silence, transcription |
| "Find the scene transitions" | scene_changes, black_intervals |
| "Are there frozen/stuck parts?" | freeze, blur |
| "Is this a talking head or action?" | motion |
| "When does the music start?" | silence, loudness |
| "Analyze the lighting" | exposure |
| "Summarize this lecture" | transcription, scene_changes, silence |

### Implementation

Single ffmpeg command with chained filters via the `metadata=mode=print:file=` pipeline pattern:

```bash
ffmpeg -i input.mp4 \
  -vf "scdet=threshold=8,signalstats,siti,blurdetect,metadata=mode=print:file=video_meta.txt" \
  -af "ebur128=metadata=1,silencedetect=noise=-30dB:d=0.5,ametadata=mode=print:file=audio_meta.txt" \
  -f null -
```

The server dynamically builds this command based on which filters Claude selected. Only selected filters are included.

### Response Format

```json
{
  "scenes": [
    { "time": "00:01:23", "score": 64.3 },
    { "time": "00:03:45", "score": 43.1 }
  ],
  "black_intervals": [
    { "start": "00:01:22", "end": "00:01:24", "duration": 1.5 }
  ],
  "silence_intervals": [
    { "start": "00:05:00", "end": "00:05:03", "duration": 3.0 }
  ],
  "freeze_intervals": [],
  "frame_stats": [
    { "timestamp": "00:00:00", "si": 65.2, "ti": 12.3, "blur": 0.23, "brightness": 128, "saturation": 45 }
  ],
  "loudness_summary": { "mean_lufs": -23.5, "range_lu": 12.3 },
  "transcription": [
    { "start": "00:00:01", "end": "00:00:05", "text": "Welcome to today's lecture" }
  ],
  "content_profile": "high visual complexity, low motion (detailed static shots)"
}
```

When `enable_index: true`, saved to `{session}/analysis.json` for reuse.

## 3. `video_detail` — New Tool (Drill-Down)

Allows Claude to extract and view frames from specific segments. Separates extraction from viewing — Claude can extract many frames but view only a few at a time.

### Schema

```typescript
{
  path: z.string().describe("Absolute or relative path to the video file"),
  // What to EXTRACT to disk
  segments: z.array(z.object({
    start: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, "Must be HH:MM:SS format"),
    end: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, "Must be HH:MM:SS format"),
    fps: z.number().positive(),
    resolution: z.number().min(128).max(2048).optional(),
  })).optional(),
  // What to VIEW (return as images)
  view: z.array(z.string()).optional(),     // specific timestamps: ["00:23:14", "00:23:18"]
  view_sample: z.number().optional(),       // OR: N evenly spaced frames from what's extracted
  skip_cached: z.boolean().default(true),   // skip re-extraction of cached frames
}
```

### Separation of Extraction and Viewing

- `segments` controls what gets extracted to disk (ffmpeg runs)
- `view` / `view_sample` controls what gets returned as images (disk reads)
- Claude can call with only `segments` + `view_sample: 3` to extract and preview
- Then call with only `view: [specific timestamps]` to inspect cached frames without re-extracting

### Efficiency Directive (for the skill)

> When drilling into a specific moment, start with the smallest reasonable segment (3-5 seconds around the point of interest). Use `view_sample: 3` to get an overview (first, middle, last frame). Only expand the time range, increase FPS, or view more frames if the initial extraction doesn't provide enough context.
>
> Never view all extracted frames at once. Treat frame viewing like a binary search — narrow down to what matters.

### Example Workflow

```
Call 1: video_detail({
  segments: [{ start: "00:23:10", end: "00:23:18", fps: 3 }],
  view_sample: 3
})
→ Extracts 24 frames to disk
→ Returns manifest (text) + 3 frames (start, middle, end)

Call 2: video_detail({
  view: ["00:23:15", "00:23:16"]
})
→ Extracts nothing (cached)
→ Returns 2 specific frames from disk

Call 3: video_detail({
  view: ["00:23:15"],
  segments: [{ start: "00:23:14", end: "00:23:16", fps: 3, resolution: 1024 }]
})
→ Re-extracts at 1024px (new resolution)
→ Returns 1 high-res frame
```

### Without Session (`enable_index: false`)

Tool still works — extracts, returns, and deletes. No caching, no deduplication. Functional but less efficient.

## 4. `video_watch` — Modifications

Backward-compatible changes. All existing parameters continue to work identically.

### New Parameters

```typescript
{
  // ... all existing params unchanged ...
  segments: z.array(z.object({
    start: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
    fps: z.number().positive(),
    resolution: z.number().min(128).max(2048).optional(),
  })).optional(),
  view_sample: z.number().optional(),
}
```

### Behavior Changes

- If `segments` is provided, overrides global `fps`/`start_time`/`end_time` — enables variable FPS extraction
- If `view_sample` is provided, returns only N evenly spaced frames instead of all
- When `enable_index: true`, persists session and returns manifest as text at the start of the response
- When `enable_index: false`, identical to current behavior

## 5. Skill `video-perception` — Rewrite

The skill teaches Claude the optimal workflow:

```markdown
## Workflow

1. Always start with `video_info` to get duration, resolution, and audio presence.

2. For videos longer than 30 seconds, call `video_analyze` before extracting frames.
   Select only the filters relevant to the user's question. Include
   `transcription: true` when understanding spoken content helps you decide
   what to look at visually.

3. Use the analysis results and transcription to plan your frame extraction strategy:
   - Low FPS (0.1-0.5) for static or predictable segments
   - Higher FPS (1-3) only around scene changes, motion peaks, or moments
     referenced in speech
   - Never exceed the minimum FPS needed for the task
   - Prefer fewer segments at lower FPS — you can always drill deeper

4. Call `video_watch` with segments and `view_sample` to get an initial overview.
   Do not view all frames at once.

5. Use `video_detail` to drill into specific moments:
   - Start with 3-5 second windows around points of interest
   - Use `view_sample: 3` first, then request specific timestamps
   - Expand the window only if the initial view is insufficient
   - Treat frame viewing like a binary search — narrow down to what matters

6. When the user asks follow-up questions about the same video, consult
   the manifest already in your context. Do not re-extract frames you
   already have at the same resolution. Do not re-request frames you
   already have in context.
```

## 6. Config Changes

### New Fields

```typescript
interface Config {
  // ... existing fields ...
  enable_index: boolean;          // default: false
  session_max_age_days: number;   // default: 7
}
```

### Session Cleanup

On server startup, check `~/.0labs-vision/sessions/` and delete sessions older than `session_max_age_days`. Also available via `video_configure`:

```typescript
{ clear_sessions: z.boolean().optional() }
```

## 7. New Source Files

```
src/
  tools/
    video-analyze.ts     ← NEW — tool registration + schema
    video-detail.ts      ← NEW — drill-down tool
    video-watch.ts       ← MODIFIED — segments, view_sample, session support
    video-configure.ts   ← MODIFIED — clear_sessions
  extractors/
    frames.ts            ← MODIFIED — segment-based extraction, cache-aware
    analyzers.ts         ← NEW — ffmpeg filter commands + output parsing
  session/
    manager.ts           ← NEW — create, load, update, cleanup sessions
    manifest.ts          ← NEW — manifest read/write/merge/dedup logic
  types.ts               ← MODIFIED — new types (AnalysisFilters, VideoAnalysis, SessionManifest, etc.)
  config.ts              ← MODIFIED — enable_index, session_max_age_days
  index.ts               ← MODIFIED — register video_analyze + video_detail
```

## 8. Types

```typescript
interface AnalysisFilters {
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

interface SceneChange {
  time: string;
  score: number;
}

interface Interval {
  start: string;
  end: string;
  duration: number;
}

interface FrameStats {
  timestamp: string;
  si?: number;
  ti?: number;
  blur?: number;
  brightness?: number;
  saturation?: number;
}

interface VideoAnalysis {
  scenes: SceneChange[];
  black_intervals: Interval[];
  silence_intervals: Interval[];
  freeze_intervals: Interval[];
  frame_stats: FrameStats[];
  loudness_summary?: { mean_lufs: number; range_lu: number };
  transcription?: TranscriptionSegment[];
  content_profile: string;
}

interface SessionManifest {
  video_hash: string;
  video_path: string;
  created_at: string;
  resolutions: Record<string, {
    frames: Array<{ timestamp: string; file: string }>;
  }>;
  analysis?: VideoAnalysis;
}

interface Segment {
  start: string;
  end: string;
  fps: number;
  resolution?: number;
}
```

## 9. Non-Goals

- No OCR/text detection (ffmpeg cannot do this)
- No face detection or object recognition
- No ML-based content classification
- No remote/cloud session sync
- No real-time streaming analysis
- No changes to the frame-describer agent

