<p align="center">
  <img src="./assets/hero.avif" alt="0labs-vision" width="100%" />
</p>

# vision-link

Give MCP-compatible AI assistants the ability to **watch and understand videos**.

vision-link is an MCP server and optional Claude Code plugin that extracts frames via ffmpeg and processes audio via multiple backends (Gemini API, local Whisper, or OpenAI API). Your AI client receives frames as images and audio transcription with timestamps — the server is a **perception layer**, not an interpretation layer.

## Features

- **Multimodal perception** — Your AI client sees video frames directly and reads audio transcriptions with timestamps
- **YouTube URL support** — Pass a YouTube URL directly; the MCP server downloads it with `yt-dlp`, preserving source metadata and captions for context
- **Flexible backends** — Choose between cloud APIs or fully local processing
- **Adaptive extraction** — The server supports varying fps, time ranges, and resolution based on the request context
- **Auto-installation** — Whisper models download automatically on first use
- **Interactive setup wizard** — `/setup-video-vision` walks you through configuration

## Platform Support

**Verified MCP Clients:**
- ✅ **Claude Desktop** - Full support via MCP config
- ✅ **Claude Code** - Full support with plugin system + slash commands
- ✅ **Cursor IDE** - MCP support available
- ✅ **Generic MCP clients** - Standard MCP protocol

**Unverified:**
- ⚠️ **ChatGPT Desktop** - MCP support not confirmed as of May 2026
- ⚠️ **VS Code + GitHub Copilot** - MCP support not confirmed as of May 2026

**Not Supported:**
- ❌ **Google Gemini** - No MCP support
- ❌ **Grok** - No MCP support

See [docs/setup/](./docs/setup/) for platform-specific guides.

## Quick Start

### 1. Install the plugin

Inside Claude Code, run these commands **one at a time**:

```
/plugin marketplace add https://github.com/0labs-in/vision-link
```

Then:

```
/plugin install 0labs-vision
```

The MCP server will auto-install via `npx` from [npm](https://www.npmjs.com/package/vision-link) on first use — no build step required.

Alternative: local development

```bash
git clone https://github.com/0labs-in/vision-link.git
claude --plugin-dir /path/to/vision-link
```

### 2. Configure

Inside Claude Code, run the interactive wizard:

```
/setup-video-vision
```

It will walk you through backend selection, whisper configuration (if local), frame options, and dependency verification.

## Usage

### Slash command

```
/watch-video path/to/video.mp4
/watch-video tutorial.mp4 "what language is used in this tutorial?"
/watch-video https://www.youtube.com/watch?v=... "summarize this video"
```

### Conversational

Just mention a video file or YouTube URL — Claude will detect it:

> "analyze this video for me: ~/Downloads/demo.mp4"
>
> "take a look at the first second of ~/videos/bug-report.mov"
>
> "summarize this YouTube Short: https://www.youtube.com/shorts/..."

The MCP workflow can adapt parameters automatically:
- "the first second" → extracts at original fps from `00:00:00` to `00:00:01`
- "summarize this 1h lecture" → low fps, full duration
- "what text is on screen at 1:30?" → high resolution, narrow time window

## Backends

| Backend | Audio processing | Cost | Setup |
|---------|------------------|------|-------|
| **Gemini API** | Native (speech + non-speech events) | Free tier: 1500 req/day | `GEMINI_API_KEY` env var |
| **Local (Whisper)** | `whisper.cpp` or Python `openai-whisper` | Free, fully offline | `brew install whisper-cpp` + auto model download |
| **OpenAI API** | OpenAI Whisper API | Paid per usage | `OPENAI_API_KEY` env var |

**All backends** extract video frames via ffmpeg so the connected AI client receives direct visual context.

## Architecture

```
┌───────────────────────────────────────────────────────┐
│ Claude Code (your session)                            │
│                                                       │
│  /watch-video  ──→  Skill: video-perception          │
│                        │                              │
│                        ▼                              │
│                  MCP tool: video_watch                │
│                        │                              │
└────────────────────────┼──────────────────────────────┘
                         │
                         ▼
      ┌────────────────────────────────────┐
      │ MCP Server (Node.js)               │
      │                                    │
      │  ┌──────────┐    ┌──────────────┐  │
      │  │ ffmpeg   │    │ Audio backend│  │
      │  │ frames   │ ║  │ (parallel)   │  │
      │  └──────────┘    └──────────────┘  │
      │       │                 │          │
      └───────┼─────────────────┼──────────┘
              ▼                 ▼
        base64 images     transcription
        + timestamps      + audio events
              │                 │
              └────────┬────────┘
                       ▼
              AI client receives both
```

## Requirements

- **Node.js 20+** (for the MCP server)
- **ffmpeg** (auto-detected, install instructions provided by setup wizard)
- **yt-dlp** (optional, required only for YouTube URLs; `brew install yt-dlp` on macOS)
- **Backend-specific**:
  - Gemini API: free API key from [ai.google.dev](https://ai.google.dev/gemini-api/docs/api-key)
  - Local: `brew install whisper-cpp` (macOS) or equivalent
  - OpenAI: API key from OpenAI

## MCP Tools

The plugin exposes 6 MCP tools:

- `video_watch` — Extract frames + process audio (main tool)
- `video_analyze` — Analyze video structure with ffmpeg filters before extraction
- `video_detail` — Drill into specific cached or newly extracted moments
- `video_info` — Get video metadata without processing
- `video_configure` — Change settings
- `video_setup` — Check and guide dependency installation

## Slash Commands

- `/watch-video <path> [question]` — Analyze a video
- `/setup-video-vision` — Interactive configuration wizard

## Configuration

Settings are stored in `~/.0labs-vision/config.json`:

```json
{
  "backend": "local",
  "whisper_engine": "cpp",
  "whisper_model": "auto",
  "whisper_at": false,
  "frame_mode": "images",
  "frame_format": "jpeg",
  "frame_resolution": 512,
  "default_fps": "auto",
  "max_frames": 100,
  "frame_describer_model": "sonnet",
  "enable_index": false,
  "session_max_age_days": 7,
  "downloads_max_age_days": 7
}
```

`frame_format` can be `jpeg`, `png`, or `webp`. `jpeg` remains the default for backwards compatibility; `png` is useful for screen recordings where text and sharp UI edges should stay lossless.

**Whisper models** auto-download to `~/.0labs-vision/models/` on first use. Available: `tiny`, `base`, `small`, `medium`, `large-v3-turbo`, `large-v3`, `auto` (picks best for your RAM).

## YouTube Transcripts

For YouTube URLs, the server uses this transcript order:

1. Manual YouTube subtitles when an English track is available.
2. YouTube automatic captions when manual subtitles are not available.
3. The configured audio backend when captions are missing, empty, or cover too little of a longer video.

Audio results label provenance with `transcription_source`, for example `youtube_subtitles` or `youtube_auto_captions`, so Claude can treat manual subtitles as stronger evidence than auto-captions.

## Validation Status

**Standalone npm package** (`vision-link@1.4.0`):
- ✅ `npm install` - All dependencies resolve
- ✅ `npm run build` - Clean TypeScript compilation
- ✅ `npm test` - 146/146 tests passed (real ffmpeg/whisper tests, no mocks)
- ✅ `npm pack --dry-run` - 47 files, 130.6 kB, includes LICENSE and README
- ✅ CLI entrypoint - Proper shebang for `npx vision-link`

**Platform compatibility**:
- ✅ Claude Desktop - Documented and verified MCP config
- ✅ Claude Code - Plugin system tested
- ✅ Cursor - MCP support documented
- ⚠️ ChatGPT/VS Code - Setup guides provided but MCP support unverified

Client-specific MCP setup details can vary by app version, so platform guides point you to the official app documentation or in-app MCP settings where needed.

## License

MIT — see [LICENSE](./LICENSE).

## Author

**0labs**

- GitHub: [0labs-in](https://github.com/0labs-in)

## Star History

<a href="https://www.star-history.com/?repos=0labs-in%2Fvision-link&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=0labs-in/vision-link&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=0labs-in/vision-link&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=0labs-in/vision-link&type=date&legend=top-left" />
 </picture>
</a>
