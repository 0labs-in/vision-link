# OpenCode Setup

Configure vision-link for OpenCode (sst/opencode) — the open-source AI coding agent.

## Prerequisites

- OpenCode installed
- Node.js 20+ installed
- ffmpeg installed

## Configuration

### 1. Locate Configuration File

OpenCode uses a JSON configuration file. Check these locations:

**Windows**:
- `%USERPROFILE%\.config\opencode\config.json`
- `C:\Users\[username]\AppData\Roaming\opencode\config.json`

**macOS/Linux**:
- `~/.config/opencode/config.json`

**Project-local** (optional):
- Create `opencode.json` in your project root

If the config file doesn't exist, create it.

### 2. Add MCP Server

Edit the configuration file and add the vision-link MCP server:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "vision-link": {
      "type": "local",
      "command": ["npx", "-y", "vision-link@latest"],
      "enabled": true
    }
  }
}
```

**Alternative: With API Keys**

If using Gemini API or OpenAI for audio transcription:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "vision-link": {
      "type": "local",
      "command": ["npx", "-y", "vision-link@latest"],
      "enabled": true,
      "env": {
        "GEMINI_API_KEY": "your-gemini-api-key-here",
        "OPENAI_API_KEY": "your-openai-api-key-here"
      }
    }
  }
}
```

**Note**: OpenCode's MCP config schema may vary by version. If the above doesn't work, check the official OpenCode documentation for the current schema at `https://opencode.ai/docs/mcp-servers`.

### 3. Restart OpenCode

Close and reopen OpenCode for the changes to take effect.

## Verification

1. Start OpenCode
2. Ask: "What MCP tools are available?"
3. You should see 6 video tools:
   - `video_watch`
   - `video_analyze`
   - `video_detail`
   - `video_info`
   - `video_configure`
   - `video_setup`

## First Use

### Configure the Backend

Before analyzing videos, configure vision-link:

```
Run video_setup with backend "local" and whisper_engine "cpp"
```

Or ask OpenCode to call `video_configure` with your preferred settings:

```json
{
  "backend": "local",
  "whisper_engine": "cpp",
  "whisper_model": "auto",
  "frame_resolution": 512,
  "default_fps": "auto"
}
```

### Available Backends

- **Gemini API** — Best quality, free tier (1500 req/day), requires `GEMINI_API_KEY`
- **Local (Whisper)** — Free, fully offline, requires whisper.cpp or openai-whisper
- **OpenAI Whisper API** — Good quality, paid per usage, requires `OPENAI_API_KEY`

## Usage

Ask OpenCode to analyze videos:

```
Analyze this video: /path/to/video.mp4
```

```
What happens in this YouTube video: https://youtube.com/watch?v=...
```

```
Summarize the first 30 seconds of ~/Downloads/demo.mov
```

OpenCode will use the MCP tools to extract frames and process audio, then analyze the content.

## Troubleshooting

### "Server not connecting" error

1. Check Node.js version: `node --version` (need 20+)
2. Verify config file syntax is valid JSON
3. Check OpenCode logs for error messages
4. Try running the server manually: `npx vision-link@latest`

### "Video processing failed" error

1. Install ffmpeg:
   - **Windows**: `winget install ffmpeg`
   - **macOS**: `brew install ffmpeg`
   - **Linux**: `sudo apt install ffmpeg`
2. Verify: `ffmpeg -version`
3. Run `video_setup` to check dependencies

### Audio transcription not working

**For Gemini API**:
- Get free key: https://ai.google.dev/gemini-api/docs/api-key
- Add to config `env.GEMINI_API_KEY`

**For Local Whisper**:
- Install: `brew install whisper-cpp` (macOS) or equivalent
- Models auto-download on first use

**For OpenAI**:
- Get key from OpenAI dashboard
- Add to config `env.OPENAI_API_KEY`

## Advanced Configuration

### Custom Installation

If you want to use a local clone instead of npm:

```json
{
  "mcp": {
    "vision-link": {
      "type": "local",
      "command": ["node", "/path/to/vision-link/mcp-server/dist/index.js"],
      "enabled": true
    }
  }
}
```

### Session Caching

Enable persistent frame caching by editing `~/.0labs-vision/config.json`:

```json
{
  "enable_index": true,
  "session_max_age_days": 7
}
```

Frames are cached in `~/.0labs-vision/sessions/`

## Differences from Claude Code

OpenCode uses the **MCP tools directly** — it doesn't have Claude Code's slash commands or skills:

| Claude Code | OpenCode |
|-------------|----------|
| `/vision-link:watch-video path.mp4` | Ask: "Analyze this video: path.mp4" |
| `/vision-link:setup-video-vision` | Ask: "Run video_setup" or call `video_configure` |
| Automatic setup prompt | Manual configuration required |

The underlying MCP server and tools work identically — only the interface differs.

## See Also

- [Generic MCP Setup](./generic-mcp.md)
- [Main README](../../README.md)
- [Architecture Documentation](../ARCHITECTURE.md)
- [OpenCode Documentation](https://opencode.ai/docs)
