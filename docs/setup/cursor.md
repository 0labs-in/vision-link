# Cursor IDE Setup

Configure vision-link for Cursor IDE with MCP support.

## Prerequisites

- Cursor IDE installed
- Node.js 20+ installed
- ffmpeg installed

## Configuration

### 1. Open Cursor MCP Settings

Cursor MCP configuration can vary by version, so open Cursor settings or MCP settings for your installed build and use the location or UI shown there.

### 2. Add MCP Server

Add a server entry equivalent to:

```json
{
  "mcp": {
    "servers": {
      "vision-link": {
        "command": "npx",
        "args": ["-y", "vision-link@latest"]
      }
    }
  }
}
```

### 3. Configure Environment Variables (Optional)

For API-based audio backends:

```json
{
  "mcp": {
    "servers": {
      "vision-link": {
        "command": "npx",
        "args": ["-y", "vision-link@latest"],
        "env": {
          "GEMINI_API_KEY": "your-gemini-api-key",
          "OPENAI_API_KEY": "your-openai-api-key"
        }
      }
    }
  }
}
```

### 4. Restart Cursor

Close and reopen Cursor IDE for changes to take effect.

## Verification

1. Open Cursor IDE
2. Open the AI chat panel (Cmd+L or Ctrl+L)
3. Ask: "What MCP tools are available?"
4. Verify you see the 6 video tools

## Initial Setup

Configure the audio backend:

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

## Usage in Cursor

### In Chat Panel

```
Analyze this video in my project: ./demo/tutorial.mp4
```

### With Code Context

```
Watch this video and generate code based on what you see:
~/Downloads/ui-demo.mp4
```

### YouTube Analysis

```
Summarize this YouTube tutorial:
https://www.youtube.com/watch?v=...
```

## Available Tools

All 6 MCP tools are available:

- `video_watch` - Extract and analyze video frames + audio
- `video_analyze` - Structural analysis (scenes, silence, motion)
- `video_detail` - Drill into specific segments
- `video_info` - Get metadata only
- `video_configure` - Change settings
- `video_setup` - Dependency check

## Workflow Tips

### 1. Analyze Before Extracting

For videos longer than 30 seconds:

```
First run video_analyze on this video to find scene changes,
then extract frames from the interesting parts: ./long-video.mp4
```

### 2. Iterative Refinement

```
1. Get video info first
2. Analyze structure
3. Extract key frames
4. Drill into specific moments with video_detail
```

### 3. Code Generation from Videos

```
Watch this UI demo video and generate the React components:
./designs/app-demo.mov
```

## Troubleshooting

### MCP Server Not Connecting

1. Check Node.js: `node --version` (need 20+)
2. Validate JSON syntax in config file
3. Check Cursor logs: Help → Show Logs

### Video Processing Errors

1. Install ffmpeg:
   ```bash
   # macOS
   brew install ffmpeg
   
   # Linux
   sudo apt install ffmpeg
   
   # Windows
   winget install ffmpeg
   ```

2. Verify: `ffmpeg -version`

### Performance Issues

- Reduce `frame_resolution` to 256 or 384
- Use `view_sample` parameter to limit frames
- Use local Whisper for offline processing
- Use Gemini API for faster cloud processing

## Advanced Configuration

### Custom Whisper Model

Edit `~/.0labs-vision/config.json`:

```json
{
  "backend": "local",
  "whisper_model": "large-v3-turbo",
  "frame_resolution": 768
}
```

### Session Caching

Enable frame caching for repeated analysis:

```json
{
  "enable_index": true,
  "session_max_age_days": 7
}
```

## See Also

- [VS Code Setup](./vscode.md) - Similar IDE setup
- [Generic MCP Setup](./generic-mcp.md)
- [Architecture](../ARCHITECTURE.md)
