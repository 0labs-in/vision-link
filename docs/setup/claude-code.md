# Claude Code Setup

Configure vision-link for Claude Code CLI and IDE extensions.

## Prerequisites

- Claude Code installed (CLI, VS Code extension, or JetBrains plugin)
- Node.js 20+ installed
- ffmpeg installed

## Installation Methods

### Method 1: Plugin Marketplace (Recommended)

Inside Claude Code, run these commands **one at a time**:

```
/plugin marketplace add https://github.com/0labs-in/vision-link
```

Then:

```
/plugin install 0labs-vision
```

The MCP server will auto-install via `npx` from npm on first use.

### Method 2: Local Development

```bash
git clone https://github.com/0labs-in/vision-link.git
cd vision-link
claude --plugin-dir .
```

## Configuration

### Interactive Setup Wizard

Run the setup wizard to configure your backend:

```
/setup-video-vision
```

This will guide you through:
1. Backend selection (Gemini API, Local Whisper, or OpenAI)
2. Whisper configuration (if using local backend)
3. Frame extraction settings
4. Dependency verification

### Manual Configuration

Edit `~/.0labs-vision/config.json`:

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

## Claude Code Specific Features

### Slash Commands

- `/watch-video <path>` - Analyze a video file or YouTube URL
- `/setup-video-vision` - Run the interactive configuration wizard

### Skills

The `video-perception` skill automatically activates when you mention videos:

- "analyze this video: ~/demo.mp4"
- "what happens in this YouTube video: https://..."
- "summarize the first minute of video.mov"

### MCP Tools

Direct tool access (advanced):
- `video_watch` - Extract frames and audio
- `video_analyze` - Analyze video structure with ffmpeg filters
- `video_detail` - Drill into specific segments
- `video_info` - Get video metadata
- `video_configure` - Change settings
- `video_setup` - Check dependencies

## Usage Examples

### Basic Video Analysis

```
/watch-video ~/Downloads/tutorial.mp4
```

### With Question

```
/watch-video demo.mp4 "what programming language is used?"
```

### YouTube Videos

```
/watch-video https://www.youtube.com/watch?v=dQw4w9WgXcQ "summarize this video"
```

### Conversational

Just mention the video naturally:

```
Can you analyze this video for me: ~/presentation.mov
```

## Verification

1. Run `/help` to see available commands
2. Check that `/watch-video` and `/setup-video-vision` are listed
3. Try analyzing a short video file

## Troubleshooting

### Plugin not loading

```bash
# Check plugin status
/plugin list

# Reinstall if needed
/plugin uninstall 0labs-vision
/plugin install 0labs-vision
```

### MCP server not starting

```bash
# Check MCP server status
/mcp list

# Restart MCP servers
/mcp restart
```

### Dependencies missing

```
/setup-video-vision
```

Follow the wizard to install missing dependencies.

## Advanced: Custom Plugin Directory

For development or custom installations:

```bash
# Clone the repo
git clone https://github.com/0labs-in/vision-link.git

# Build the MCP server
cd vision-link/mcp-server
npm install
npm run build

# Use with Claude Code
claude --plugin-dir /path/to/0labs-vision
```

## See Also

- [Claude Desktop Setup](./claude-desktop.md) - For the desktop app
- [Generic MCP Setup](./generic-mcp.md) - For other MCP clients
- [Main README](../../README.md)
