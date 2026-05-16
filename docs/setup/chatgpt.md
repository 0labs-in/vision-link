# ChatGPT Desktop Setup (Unverified)

> **⚠️ IMPORTANT**: As of May 2026, MCP support in ChatGPT Desktop is **not confirmed**. This guide is provided for reference in case your build has MCP support, but compatibility is unverified.

Configure vision-link for ChatGPT Desktop when MCP is available in your installed version.

## Prerequisites

- ChatGPT Desktop app installed with MCP support available in your version
- Node.js 20+ installed
- ffmpeg installed

## Configuration

### 1. Open ChatGPT MCP Settings

ChatGPT Desktop MCP configuration has changed across releases, so use the in-app MCP settings or the official ChatGPT MCP documentation for your version rather than relying on a hardcoded file path.

### 2. Add MCP Server

Add a server entry equivalent to:

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

### 3. Configure Audio Backend (Optional)

Add environment variables for API-based audio transcription:

```json
{
  "mcpServers": {
    "vision-link": {
      "command": "npx",
      "args": ["-y", "vision-link@latest"],
      "env": {
        "GEMINI_API_KEY": "your-gemini-api-key-here",
        "OPENAI_API_KEY": "your-openai-api-key-here"
      }
    }
  }
}
```

### 4. Restart ChatGPT Desktop

Close and reopen ChatGPT Desktop for changes to take effect.

## Verification

1. Open ChatGPT Desktop
2. Start a new conversation
3. Ask: "What MCP tools do you have access to?"
4. Look for: `video_watch`, `video_analyze`, `video_detail`, `video_info`, `video_configure`, `video_setup`

## Initial Configuration

Configure your preferred audio backend:

```
Can you run the video_setup tool with backend set to "local" and whisper_engine set to "cpp"?
```

Or manually edit `~/.0labs-vision/config.json`:

```json
{
  "backend": "local",
  "whisper_engine": "cpp",
  "whisper_model": "auto",
  "frame_resolution": 512,
  "default_fps": "auto"
}
```

## Usage Examples

### Basic Video Analysis

```
Analyze this video file: /Users/username/Downloads/demo.mp4
```

### YouTube Videos

```
Can you watch this YouTube video and summarize it?
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

### Specific Questions

```
Watch this video and tell me what programming language is being used:
~/projects/tutorial.mp4
```

### Advanced: Segment Analysis

```
Use video_analyze to check for scene changes in this video first, 
then extract frames from the interesting parts: /path/to/video.mp4
```

## Available Tools

- **video_watch** - Extract frames and audio from a video
- **video_analyze** - Analyze video structure (scenes, silence, motion)
- **video_detail** - Drill into specific time segments
- **video_info** - Get video metadata without processing
- **video_configure** - Change backend and extraction settings
- **video_setup** - Check and install dependencies

## Troubleshooting

### MCP Server Not Loading

1. Verify Node.js installation: `node --version` (should be 20+)
2. Check config file is valid JSON
3. Look for errors in ChatGPT Desktop logs

### Video Processing Fails

1. Install ffmpeg: 
   - macOS: `brew install ffmpeg`
   - Windows: `winget install ffmpeg`
   - Linux: `sudo apt install ffmpeg`
2. Verify with: `ffmpeg -version`

### Audio Transcription Issues

**For Gemini API**:
- Get free API key: https://ai.google.dev/gemini-api/docs/api-key
- Add to config `env.GEMINI_API_KEY`

**For Local Whisper**:
- macOS: `brew install whisper-cpp`
- Models auto-download to `~/.0labs-vision/models/` on first use

**For OpenAI API**:
- Get API key from OpenAI dashboard
- Add to config `env.OPENAI_API_KEY`

## Performance Tips

- Use `frame_resolution: 512` for faster processing
- Use `default_fps: "auto"` to adapt to video length
- For long videos, use `video_analyze` first to identify key moments
- Local Whisper backend is free but slower than API backends

## See Also

- [Generic MCP Setup](./generic-mcp.md)
- [Main README](../../README.md)
- [FAQ](../FAQ.md)
