# Generic MCP Client Setup

Configure vision-link for any MCP-compatible AI client.

## Overview

vision-link is a standard MCP (Model Context Protocol) server that works with any MCP-compatible client. This guide covers the universal setup process.

## Prerequisites

- Node.js 20 or higher
- ffmpeg installed
- An MCP-compatible AI client

## MCP Server Details

**Package**: `vision-link` (npm)  
**Command**: `npx -y vision-link@latest`  
**Protocol**: MCP 1.0 (stdio transport)  
**Tools**: 6 video analysis tools

## Standard Configuration Format

Most MCP clients use a JSON configuration file with this structure:

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

### With Environment Variables

```json
{
  "mcpServers": {
    "vision-link": {
      "command": "npx",
      "args": ["-y", "vision-link@latest"],
      "env": {
        "GEMINI_API_KEY": "your-api-key",
        "OPENAI_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Configuration File Locations

Configuration location and exact schema vary by client and version.

| Client | Where to look |
|--------|---------------|
| Claude Desktop | Official Claude Desktop MCP docs or app config docs |
| ChatGPT Desktop | Official ChatGPT MCP docs or in-app MCP settings |
| Cursor IDE | Cursor MCP settings or version-specific docs |
| VS Code | GitHub Copilot MCP documentation for your build |
| Custom Client | Client-specific MCP documentation |

## Initial Setup

### 1. Add Server to Client Config

Add the vision-link server configuration to your client's MCP config file.

### 2. Restart Client

Restart your AI client application to load the MCP server.

### 3. Verify Connection

Ask your AI: "What MCP tools are available?"

You should see 6 tools:
- `video_watch`
- `video_analyze`
- `video_detail`
- `video_info`
- `video_configure`
- `video_setup`

### 4. Configure Backend

Run the setup tool:

```
Run video_setup with backend "local" and whisper_engine "cpp"
```

Or manually create `~/.0labs-vision/config.json`:

```json
{
  "backend": "local",
  "whisper_engine": "cpp",
  "whisper_model": "auto",
  "frame_resolution": 512,
  "default_fps": "auto",
  "max_frames": 100
}
```

## Available Tools

### video_watch
Extract frames and process audio from a video file or YouTube URL.

**Parameters**:
- `path` (required) - Video file path or YouTube URL
- `fps` - Frames per second (default: "auto")
- `resolution` - Frame width in pixels (default: 512)
- `start_time` - Start time (HH:MM:SS)
- `end_time` - End time (HH:MM:SS)
- `skip_audio` - Skip audio processing (default: false)

### video_analyze
Analyze video structure with ffmpeg filters before extraction.

**Parameters**:
- `path` (required) - Video file path or YouTube URL
- `scene_changes` - Detect scene transitions
- `silence` - Detect silence intervals
- `motion` - Analyze motion levels
- `transcription` - Include audio transcription

### video_detail
Drill into specific video segments with high detail.

**Parameters**:
- `path` (required) - Video file path
- `start_time` (required) - Segment start (HH:MM:SS)
- `end_time` (required) - Segment end (HH:MM:SS)
- `fps` - Frames per second
- `resolution` - Frame width

### video_info
Get video metadata without processing.

**Parameters**:
- `path` (required) - Video file path or YouTube URL

### video_configure
Change backend and extraction settings.

**Parameters**:
- `backend` - "gemini-api", "local", or "openai"
- `whisper_model` - Whisper model size
- `frame_resolution` - Default frame width
- `default_fps` - Default extraction rate

### video_setup
Check dependencies and installation status.

**Parameters**:
- `backend` (required) - Backend to check
- `whisper_engine` - "cpp" or "python"

## Audio Backend Options

### Gemini API (Recommended)
- **Pros**: Best quality, fast, free tier (1500 req/day)
- **Cons**: Requires API key, internet connection
- **Setup**: Set `GEMINI_API_KEY` environment variable

### Local Whisper
- **Pros**: Free, fully offline, private
- **Cons**: Slower, requires local installation
- **Setup**: Install whisper.cpp or openai-whisper

### OpenAI Whisper API
- **Pros**: Good quality, fast
- **Cons**: Paid per usage
- **Setup**: Set `OPENAI_API_KEY` environment variable

## Testing with MCP Inspector

Test the server directly without a client:

```bash
npx @modelcontextprotocol/inspector npx vision-link@latest
```

This opens a web interface to test all tools.

## Troubleshooting

### Server Not Starting

1. Check Node.js version: `node --version` (need 20+)
2. Test server directly: `npx vision-link@latest`
3. Check client logs for error messages

### Video Processing Fails

1. Install ffmpeg: `ffmpeg -version`
2. Check video file exists and is readable
3. Run `video_setup` to verify dependencies

### Audio Transcription Issues

1. Verify backend configuration in `~/.0labs-vision/config.json`
2. Check API keys are set correctly
3. For local backend, verify Whisper installation

## Advanced Configuration

### Custom Installation

```bash
# Clone repository
git clone https://github.com/0labs-in/vision-link.git
cd vision-link/mcp-server

# Install and build
npm install
npm run build

# Use local build
{
  "mcpServers": {
    "vision-link": {
      "command": "node",
      "args": ["/path/to/vision-link/mcp-server/dist/index.js"]
    }
  }
}
```

### Session Caching

Enable persistent frame caching:

```json
{
  "enable_index": true,
  "session_max_age_days": 7
}
```

Frames are cached in `~/.0labs-vision/sessions/`

## See Also

- [Claude Desktop Setup](./claude-desktop.md)
- [Claude Code Setup](./claude-code.md)
- [ChatGPT Setup](./chatgpt.md)
- [Cursor Setup](./cursor.md)
- [VS Code Setup](./vscode.md)
- [Architecture Documentation](../ARCHITECTURE.md)
- [MCP Specification](https://modelcontextprotocol.io)
