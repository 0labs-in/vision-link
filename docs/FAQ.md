# Frequently Asked Questions (FAQ)

## General Questions

### What is vision-link?

vision-link is a universal MCP (Model Context Protocol) server that gives AI assistants the ability to watch and understand videos. It extracts video frames and processes audio, making video content accessible to AI.

### Does this work with Cursor?

**Yes.** Cursor has MCP support. See [Cursor Setup Guide](../docs/setup/cursor.md).

### Does this work with ChatGPT or VS Code?

**Not confirmed.** As of May 2026, there is no verified MCP support in ChatGPT Desktop or GitHub Copilot for VS Code. If your build has MCP support, the standard MCP configuration should work, but this is unverified.

### Does this work with Google Gemini or Grok?

**Not yet.** Gemini and Grok don't currently support the MCP protocol. vision-link only works with MCP-compatible AI platforms.

### Do I need Claude Code to use this?

**No!** While vision-link started as a Claude Code plugin, it now works with any MCP-compatible AI client. Claude Code is just one of many supported platforms.

### What's the difference between Claude Code and Claude Desktop?

- **Claude Desktop** - Standalone desktop app, uses MCP config file
- **Claude Code** - CLI tool and IDE extensions, supports plugins with skills and slash commands

Both work with vision-link, but Claude Code has additional convenience features like `/watch-video` command.

## Installation & Setup

### How do I install vision-link?

It depends on your platform:

1. **For Claude Code**: Use the plugin system
   ```
   /plugin marketplace add https://github.com/0labs-in/vision-link
   /plugin install 0labs-vision
   ```

2. **For other platforms**: Add to your MCP config file
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

See platform-specific guides in [docs/setup/](../docs/setup/).

### Where is the configuration file?

**User config**: `~/.0labs-vision/config.json` (same for all platforms)

**MCP config**: varies by platform and version. See the platform-specific setup guide for the client you are using, because some apps expose MCP through in-app settings while others use config files.

### What are the system requirements?

- **Node.js 20+** (required)
- **ffmpeg** (required for video processing)
- **yt-dlp** (optional, for YouTube URLs)
- **Whisper** (optional, for local audio transcription)

### How do I check if it's working?

1. Ask your AI: "What MCP tools are available?"
2. Look for 6 video tools: `video_watch`, `video_analyze`, `video_detail`, `video_info`, `video_configure`, `video_setup`
3. Try analyzing a video file

## Features & Capabilities

### What video formats are supported?

Any format that ffmpeg can read:
- MP4, MOV, AVI, MKV, WebM
- Most common codecs
- YouTube URLs (with yt-dlp)

### Can it analyze YouTube videos?

**Yes!** Just provide the YouTube URL:
- Automatically downloads with yt-dlp
- Prefers YouTube captions when available
- Falls back to audio transcription
- Supports videos, shorts, and live recordings

### What audio backends are available?

Three options:

1. **Gemini API** (recommended)
   - Best quality
   - Free tier: 1500 requests/day
   - Requires `GEMINI_API_KEY`

2. **Local Whisper** (offline)
   - Fully private
   - Free forever
   - Requires whisper.cpp or openai-whisper

3. **OpenAI Whisper API**
   - Good quality
   - Paid per usage
   - Requires `OPENAI_API_KEY`

### How accurate is the transcription?

Depends on the backend:
- **Gemini API**: Excellent, includes non-speech audio tags
- **Local Whisper**: Good to excellent (depends on model size)
- **OpenAI API**: Good quality

YouTube captions (when available) are used first and are generally very accurate.

### Can it handle long videos?

**Yes!** The system automatically:
- Adjusts FPS based on video length
- Chunks audio for videos > 20 minutes
- Uses session caching to avoid re-processing
- Supports progressive refinement with `video_detail`

### What's the maximum video length?

No hard limit, but practical considerations:
- Longer videos = more frames = more AI context used
- Use `video_analyze` first to identify key moments
- Use `view_sample` to limit frames returned
- Session caching helps with repeated analysis

## Claude Code Specific

### What are "skills" and "commands"?

These are **Claude Code specific features**:

- **Skills** (`skills/video-perception/`) - Auto-detect video mentions
- **Commands** (`/watch-video`, `/setup-video-vision`) - Convenience wrappers

Other platforms access the same MCP tools directly, just without these wrappers.

### Do I need to use slash commands?

**No!** Slash commands are convenient but optional. You can:
- Use slash commands: `/watch-video demo.mp4`
- Or just ask naturally: "Analyze this video: demo.mp4"

Both work the same way.

### What's the difference between the plugin and MCP server?

- **MCP Server** (`mcp-server/`) - Universal, works everywhere
- **Plugin** (`.claude-plugin/`) - Claude Code specific wrapper

The plugin is just a convenient way to install the MCP server in Claude Code.

## Troubleshooting

### "Server not connecting" error

1. Check Node.js version: `node --version` (need 20+)
2. Verify config file is valid JSON
3. Restart your AI client
4. Check client logs for errors

### "ffmpeg not found" error

Install ffmpeg:
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg`
- **Windows**: `winget install ffmpeg`

Verify: `ffmpeg -version`

### "Video processing failed" error

1. Check video file exists and is readable
2. Verify ffmpeg is installed
3. Try a different video file
4. Run `video_setup` to check dependencies

### Audio transcription not working

**For Gemini API**:
- Get free key: https://ai.google.dev/gemini-api/docs/api-key
- Set in config: `env.GEMINI_API_KEY`

**For Local Whisper**:
- Install: `brew install whisper-cpp` (macOS)
- Models auto-download on first use

**For OpenAI**:
- Get key from OpenAI dashboard
- Set in config: `env.OPENAI_API_KEY`

### "Package not found" error

The package name changed:
- **Old**: `0labs-vision`
- **New**: `vision-link`

Update your config to use `vision-link@latest`.

## Performance & Optimization

### How can I make it faster?

1. **Lower resolution**: Set `frame_resolution: 384` or `256`
2. **Reduce FPS**: Use `default_fps: 0.5` or lower
3. **Use Gemini API**: Faster than local Whisper
4. **Enable caching**: Set `enable_index: true`
5. **Use view_sample**: Limit frames returned

### How much does it cost?

**Free options**:
- Local Whisper backend (fully offline)
- Gemini API free tier (1500 req/day)

**Paid options**:
- OpenAI Whisper API (~$0.006/minute)
- Gemini API beyond free tier

**Note**: Frame extraction is always free (uses local ffmpeg).

### How much context does it use?

Depends on settings:
- Each frame: ~750-1500 tokens (varies by resolution)
- Transcription: ~1 token per 4 characters
- Metadata: ~100-200 tokens

Example: 10 frames at 512px + 5min transcription ≈ 10,000-15,000 tokens

### Can I cache results?

**Yes!** Enable session caching:
```json
{
  "enable_index": true,
  "session_max_age_days": 7
}
```

Frames are cached in `~/.0labs-vision/sessions/` and reused across requests.

## Privacy & Security

### Is my data sent anywhere?

Depends on your backend:

- **Local Whisper**: Nothing leaves your machine
- **Gemini API**: Audio sent to Google
- **OpenAI API**: Audio sent to OpenAI

Video frames are always processed locally with ffmpeg.

### Where are files stored?

```
~/.0labs-vision/
├── config.json (your settings)
├── sessions/ (cached frames, if enabled)
├── models/ (Whisper models, if using local)
└── downloads/ (YouTube videos, temporary)
```

### Can I use this offline?

**Yes!** With the Local Whisper backend:
1. Install whisper.cpp or openai-whisper
2. Set `backend: "local"` in config
3. Models download once, then work offline

## Advanced Usage

### How do I analyze specific segments?

Use `video_detail`:
```
Analyze frames 00:01:30 to 00:01:35 from video.mp4 at 5 fps
```

### How do I get just metadata?

Use `video_info`:
```
Get info about video.mp4 without processing it
```

### How do I change settings?

Use `video_configure`:
```
Change backend to gemini-api and resolution to 768
```

Or edit `~/.0labs-vision/config.json` directly.

### What's the recommended workflow?

For long videos:
1. `video_info` - Get duration and metadata
2. `video_analyze` - Find scene changes and key moments
3. `video_watch` - Extract frames from interesting segments
4. `video_detail` - Drill into specific moments if needed

## Contributing & Support

### How do I report bugs?

Open an issue: https://github.com/0labs-in/vision-link/issues

### Can I contribute?

Yes! See [CONTRIBUTING.md](../CONTRIBUTING.md)

### Where can I get help?

1. Check this FAQ
2. Read [setup guides](../docs/setup/)
3. Check [architecture docs](../docs/ARCHITECTURE.md)
4. Open a GitHub issue

### Is there a Discord/Slack?

Not yet. Use GitHub issues for now.

## Migration & Updates

### I was using `0labs-vision`, how do I migrate?

Update your config file:
- Change package name: `0labs-vision` → `vision-link`
- Update repository URLs if needed
- Configuration directory stays the same: `~/.0labs-vision/`

### How do I update to the latest version?

The `@latest` tag auto-updates:
```bash
npx vision-link@latest
```

Or specify a version:
```bash
npx vision-link@1.4.0
```

### What's new in v1.4.0?

- Universal MCP support (works with any MCP client)
- Platform-specific setup guides
- Package renamed to `vision-link`
- Repository moved to `0labs-in/vision-link`

See [CHANGELOG.md](../CHANGELOG.md) for full details.

## Still have questions?

- Check the [main README](../README.md)
- Read the [setup guides](../docs/setup/)
- Review the [architecture docs](../docs/ARCHITECTURE.md)
- Open an issue: https://github.com/0labs-in/vision-link/issues
