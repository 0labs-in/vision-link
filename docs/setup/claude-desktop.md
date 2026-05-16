# Claude Desktop Setup

Configure vision-link for Claude Desktop application.

## Prerequisites

- Claude Desktop app installed
- Node.js 20+ installed
- ffmpeg installed (`brew install ffmpeg` on macOS)

## Configuration

### 1. Locate Configuration File

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Linux**: `~/.config/Claude/claude_desktop_config.json`

### 2. Add MCP Server

Edit the configuration file and add the vision-link server:

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

If using Gemini API or OpenAI for audio transcription, add environment variables:

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

### 4. Restart Claude Desktop

Close and reopen Claude Desktop for changes to take effect.

## Verification

1. Open Claude Desktop
2. Start a new conversation
3. Ask: "What MCP tools are available?"
4. You should see 6 video tools: `video_watch`, `video_analyze`, `video_detail`, `video_info`, `video_configure`, `video_setup`

## First Use

Run the setup tool to configure your preferred backend:

```
Can you run video_setup with backend "local" and whisper_engine "cpp"?
```

Or configure manually by editing `~/.0labs-vision/config.json`

## Usage

Ask Claude to analyze videos:

- "Analyze this video: /path/to/video.mp4"
- "What happens in this YouTube video: https://youtube.com/watch?v=..."
- "Summarize the first 30 seconds of ~/Downloads/demo.mov"

## Troubleshooting

### Server not connecting

1. Check that Node.js is installed: `node --version`
2. Verify config file syntax is valid JSON
3. Check Claude Desktop logs (Help → View Logs)

### Video processing fails

1. Verify ffmpeg is installed: `ffmpeg -version`
2. Run `video_setup` to check dependencies
3. Check `~/.0labs-vision/` directory permissions

### Audio transcription not working

1. For Gemini API: verify `GEMINI_API_KEY` is set correctly
2. For local Whisper: install whisper.cpp (`brew install whisper-cpp`)
3. For OpenAI: verify `OPENAI_API_KEY` is set correctly

## See Also

- [Generic MCP Setup](./generic-mcp.md)
- [Main README](../../README.md)
- [Architecture Documentation](../ARCHITECTURE.md)
