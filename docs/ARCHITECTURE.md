# Architecture Documentation

## Overview

vision-link is a **universal MCP (Model Context Protocol) server** that provides video analysis capabilities to any MCP-compatible AI assistant. It extracts video frames via ffmpeg and processes audio through multiple backends.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ AI Clients (MCP Compatible)                                 │
│ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐          │
│ │  Claude  │ │ ChatGPT  │ │ Cursor │ │ VS Code │          │
│ │ Desktop  │ │ Desktop  │ │  IDE   │ │ Copilot │          │
│ └────┬─────┘ └────┬─────┘ └───┬────┘ └────┬────┘          │
└──────┼────────────┼────────────┼───────────┼───────────────┘
       │            │            │           │
       └────────────┴────────────┴───────────┘
                    │
              MCP Protocol (stdio)
                    │
       ┌────────────▼────────────┐
       │  vision-link MCP Server │
       │  (Node.js/TypeScript)   │
       └────────────┬────────────┘
                    │
       ┌────────────┴────────────┐
       │                         │
   ┌───▼────┐              ┌────▼─────┐
   │ Frame  │              │  Audio   │
   │Extract │              │ Process  │
   │(ffmpeg)│              │(Backends)│
   └───┬────┘              └────┬─────┘
       │                        │
       ▼                        ▼
   Base64 Images         Transcription
   + Timestamps          + Audio Tags
```

## Components

### 1. MCP Server Core

**Location**: `mcp-server/src/index.ts`

The server uses the official `@modelcontextprotocol/sdk` package and communicates via stdio transport (standard input/output). This makes it compatible with any MCP client.

**Key Features**:
- Standard MCP 1.0 protocol
- Stdio transport (universal compatibility)
- 6 registered tools
- Session management
- Auto-cleanup of expired data

### 2. MCP Tools

Six tools exposed to AI clients:

#### video_watch
**Purpose**: Main tool for video analysis  
**Input**: Video path or YouTube URL  
**Output**: Frames (base64 images) + audio transcription  
**Features**:
- Variable FPS extraction
- Segment-based extraction
- YouTube caption support
- Session caching

#### video_analyze
**Purpose**: Structural analysis before extraction  
**Input**: Video path, filter selection  
**Output**: Scene changes, silence, motion data  
**Use**: Plan smart frame extraction

#### video_detail
**Purpose**: Drill into specific segments  
**Input**: Video path, time range, FPS  
**Output**: High-detail frames from segment  
**Use**: Progressive refinement

#### video_info
**Purpose**: Get metadata without processing  
**Input**: Video path or YouTube URL  
**Output**: Duration, resolution, codec, etc.

#### video_configure
**Purpose**: Change backend and settings  
**Input**: Configuration parameters  
**Output**: Updated config confirmation

#### video_setup
**Purpose**: Check dependencies  
**Input**: Backend type  
**Output**: Installation status and instructions

### 3. Frame Extraction

**Location**: `mcp-server/src/extractors/frames.ts`

Uses ffmpeg to extract frames:
- Configurable FPS (frames per second)
- Adaptive resolution
- Multiple formats (JPEG, PNG, WebP)
- Segment-based extraction
- Timestamp preservation

**Process**:
1. Parse video with ffprobe
2. Calculate optimal FPS if "auto"
3. Extract frames with ffmpeg
4. Encode as base64
5. Return with timestamps

### 4. Audio Processing

**Location**: `mcp-server/src/extractors/audio.ts`

Three backend options:

#### Gemini API Backend
**Location**: `mcp-server/src/backends/gemini-api.ts`
- Native audio understanding
- Structured JSON output
- Transcription + audio tags
- Chunking for long videos
- Free tier: 1500 req/day

#### Local Whisper Backend
**Location**: `mcp-server/src/backends/local.ts`
- Fully offline
- whisper.cpp or Python openai-whisper
- Auto-downloads models
- Multiple model sizes
- SHA-256 checksum verification

#### OpenAI Whisper API Backend
**Location**: `mcp-server/src/backends/openai.ts`
- Cloud-based transcription
- Good quality
- Paid per usage

### 5. Session Management

**Location**: `mcp-server/src/session/manager.ts`

Optional persistent caching:
- Video hash-based identification
- Frame deduplication by resolution
- Manifest tracking
- Auto-cleanup of expired sessions
- Configurable retention period

**Directory Structure**:
```
~/.0labs-vision/
├── config.json
├── sessions/
│   └── {video-hash}/
│       ├── manifest.json
│       └── frames/
│           ├── jpeg/
│           │   ├── 512/
│           │   └── 1024/
│           └── png/
├── models/ (Whisper models)
└── downloads/ (YouTube videos)
```

### 6. YouTube Support

**Location**: `mcp-server/src/utils/video-source.ts`

Handles YouTube URLs:
- Downloads with yt-dlp
- Extracts metadata
- Prefers YouTube captions
- Falls back to audio backend
- Caches downloaded videos

**Caption Priority**:
1. Manual YouTube subtitles
2. YouTube auto-captions
3. Configured audio backend

## Platform Integration

### Universal (MCP Standard)

The MCP server is **platform-agnostic**. All platforms interact with the same 6 tools via the MCP protocol.

**Configuration Format** (universal):
```json
{
  "mcpServers": {
    "vision-link": {
      "command": "npx",
      "args": ["-y", "vision-link@latest"]
    }
  }
}
```

### Claude Code Specific Features

**Location**: `.claude-plugin/`, `skills/`, `commands/`

These are **optional enhancements** for Claude Code users:

#### Plugin System
- `.claude-plugin/plugin.json` - Plugin metadata
- `.claude-plugin/marketplace.json` - Marketplace listing

#### Skills
- `skills/video-perception/` - Auto-detects video mentions
- Activates when user mentions video files
- Not part of MCP standard

#### Slash Commands
- `/watch-video` - Convenient wrapper
- `/setup-video-vision` - Interactive wizard
- Claude Code specific

**Important**: Other platforms access the same MCP tools directly, just without the convenience wrappers.

## Data Flow

### Video Analysis Flow

```
1. User Request
   ↓
2. AI Client → MCP Server (video_watch)
   ↓
3. MCP Server:
   ├─→ Extract frames (ffmpeg) ──→ Base64 encode
   └─→ Extract audio (ffmpeg) ──→ Backend transcribe
   ↓
4. Combine results
   ↓
5. Return to AI Client
   ↓
6. AI analyzes and responds to user
```

### Session Caching Flow

```
1. video_watch called
   ↓
2. Compute video hash
   ↓
3. Check session manifest
   ├─→ Frames exist? → Reuse
   └─→ Frames missing? → Extract & cache
   ↓
4. Return frames
```

## Configuration

### User Configuration

**Location**: `~/.0labs-vision/config.json`

```json
{
  "backend": "local",
  "whisper_engine": "cpp",
  "whisper_model": "auto",
  "frame_mode": "images",
  "frame_format": "jpeg",
  "frame_resolution": 512,
  "default_fps": "auto",
  "max_frames": 100,
  "enable_index": false,
  "session_max_age_days": 7,
  "downloads_max_age_days": 7
}
```

### Platform Configuration

Each platform has its own MCP config file location:

- **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **ChatGPT**: `~/.config/ChatGPT/mcp_config.json`
- **Cursor**: `~/.cursor/mcp.json`
- **VS Code**: `settings.json` → `github.copilot.mcp.servers`

## Security Considerations

### Input Validation

- Video paths validated before processing
- HMS timestamp format enforced
- File type checking
- Path resolution security

### Model Integrity

- SHA-256 checksums for Whisper models
- Streaming verification (no OOM)
- Download from trusted sources only

### API Keys

- Environment variables only
- Never logged or transmitted
- User-controlled backends

### Temporary Files

- Cleaned up after processing
- Isolated temp directories
- No sensitive data persistence

## Performance Optimization

### Adaptive FPS

Automatically adjusts based on video duration:
- < 60s: 2 fps
- < 5min: 1 fps
- < 15min: 0.5 fps
- < 1hr: 0.2 fps
- > 1hr: 0.1 fps

### Frame Sampling

`view_sample` parameter returns N evenly spaced frames instead of all, reducing context usage.

### Audio Chunking

For videos > 20 minutes:
- Splits audio into chunks
- Processes in parallel
- Merges results
- Reports warnings

### Session Caching

When `enable_index: true`:
- Deduplicates frames by timestamp
- Reuses cached frames
- Saves processing time
- Reduces API costs

## Extensibility

### Adding New Backends

1. Create `mcp-server/src/backends/new-backend.ts`
2. Implement `AudioResult` interface
3. Register in `video-watch.ts`
4. Add to config types
5. Update setup wizard

### Adding New Tools

1. Create `mcp-server/src/tools/new-tool.ts`
2. Define zod schema
3. Implement handler
4. Register in `index.ts`
5. Document in README

### Adding New Platforms

No code changes needed! Just:
1. Create setup guide in `docs/setup/`
2. Add example config in `examples/`
3. Update README

## Testing

### Unit Tests

**Location**: `mcp-server/tests/`

- 91 tests covering all components
- Run with `npm test`
- Vitest framework

### Integration Testing

Use MCP Inspector:
```bash
npx @modelcontextprotocol/inspector npx vision-link@latest
```

### Platform Testing

Test on each platform:
1. Add to MCP config
2. Restart client
3. Verify tools available
4. Test video analysis

## Deployment

### npm Package

**Package**: `vision-link`  
**Registry**: https://www.npmjs.com/package/vision-link

Installed via:
```bash
npx vision-link@latest
```

### Local Development

```bash
git clone https://github.com/0labs-in/vision-link.git
cd vision-link/mcp-server
npm install
npm run build
```

Use local build:
```json
{
  "mcpServers": {
    "vision-link": {
      "command": "node",
      "args": ["/path/to/vision-link/mcp-server/dist/index.js"]
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Server not connecting**
   - Check Node.js version (need 20+)
   - Verify config JSON syntax
   - Check client logs

2. **Video processing fails**
   - Install ffmpeg
   - Check video file exists
   - Run `video_setup`

3. **Audio transcription issues**
   - Verify backend configuration
   - Check API keys
   - For local: install Whisper

## Future Enhancements

Potential additions:
- Real-time video streaming
- Live camera feed support
- Video editing capabilities
- More audio backends
- GPU acceleration
- Distributed processing

## References

- [MCP Specification](https://modelcontextprotocol.io)
- [GitHub Repository](https://github.com/0labs-in/vision-link)
- [npm Package](https://www.npmjs.com/package/vision-link)
- [Setup Guides](../docs/setup/)
