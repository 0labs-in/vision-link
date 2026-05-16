# vision-link

Universal MCP server for video analysis - works with Claude, ChatGPT, Cursor, VS Code, and any MCP-compatible AI.

## Features

- Extract frames from videos with ffmpeg
- Process audio with Gemini API, local Whisper, or OpenAI
- YouTube URL support with automatic caption extraction
- Adaptive frame extraction based on video analysis
- Session caching for repeated analysis

## Installation

```bash
npx vision-link@latest
```

Or add to your MCP client configuration:

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

## MCP Tools

- `video_watch` - Extract frames and audio
- `video_analyze` - Analyze video structure
- `video_detail` - Drill into segments
- `video_info` - Get metadata
- `video_configure` - Change settings
- `video_setup` - Check dependencies

## Documentation

Full documentation: https://github.com/0labs-in/vision-link

## License

MIT
