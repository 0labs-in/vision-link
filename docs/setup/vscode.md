# VS Code with GitHub Copilot Setup (Unverified)

> **⚠️ IMPORTANT**: As of May 2026, MCP support in GitHub Copilot for VS Code is **not confirmed**. This guide is provided for reference in case your build has MCP support, but compatibility is unverified.

Configure vision-link for Visual Studio Code with GitHub Copilot MCP integration.

## Prerequisites

- Visual Studio Code installed
- GitHub Copilot extension installed and activated
- Node.js 20+ installed
- ffmpeg installed

## Configuration

### 1. Open VS Code Settings

**Method 1**: Command Palette
- Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
- Type "Preferences: Open User Settings (JSON)"

**Method 2**: Direct File
- macOS: `~/Library/Application Support/Code/User/settings.json`
- Windows: `%APPDATA%\Code\User\settings.json`
- Linux: `~/.config/Code/User/settings.json`

### 2. Add MCP Server Configuration

If your installed Copilot build exposes MCP server settings, add an entry equivalent to the following in the location GitHub documents for your version:

```json
{
  "github.copilot.mcp.servers": {
    "vision-link": {
      "command": "npx",
      "args": ["-y", "vision-link@latest"]
    }
  }
}
```

### 3. Configure Environment Variables (Optional)

For API-based audio backends:

```json
{
  "github.copilot.mcp.servers": {
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
```

### 4. Reload VS Code

- Press `Cmd+Shift+P` / `Ctrl+Shift+P`
- Type "Developer: Reload Window"

## Verification

1. Open GitHub Copilot Chat (Cmd+I or Ctrl+I)
2. Ask: "What MCP tools are available?"
3. Verify the 6 video tools are listed

## Initial Setup

Configure the audio backend via Copilot Chat:

```
@workspace Run video_setup with backend "local" and whisper_engine "cpp"
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

## Usage in VS Code

### In Copilot Chat

```
@workspace Analyze this video in my project: ./demo/tutorial.mp4
```

### Inline Chat

Select code, then press `Cmd+I` / `Ctrl+I`:

```
Watch this video and refactor the code to match the UI:
./designs/new-ui.mp4
```

### With Workspace Context

```
@workspace Watch this video and update the README with what you see:
./docs/demo.mov
```

## Available Tools

All 6 MCP tools work with Copilot:

- `video_watch` - Extract frames and audio
- `video_analyze` - Structural analysis
- `video_detail` - Segment drill-down
- `video_info` - Metadata only
- `video_configure` - Settings
- `video_setup` - Dependencies

## Workflow Examples

### 1. UI Implementation from Video

```
@workspace Watch this Figma walkthrough video and implement the components:
./designs/walkthrough.mp4
```

### 2. Bug Reproduction Analysis

```
Analyze this screen recording to understand the bug:
./bugs/issue-123-recording.mov
```

### 3. Tutorial Code Generation

```
Watch this coding tutorial and generate the code:
https://www.youtube.com/watch?v=...
```

### 4. Documentation from Demo

```
@workspace Watch this demo video and update the docs:
./marketing/product-demo.mp4
```

## Troubleshooting

### MCP Server Not Connecting

1. Check Node.js version: `node --version` (need 20+)
2. Verify settings.json syntax is valid
3. Check VS Code Output panel: View → Output → GitHub Copilot

### GitHub Copilot MCP Not Available

- Ensure you have the latest GitHub Copilot extension
- MCP support may require Copilot Chat or specific subscription tier
- Check GitHub Copilot documentation for MCP availability

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

3. Run setup: Ask Copilot to "run video_setup"

### Performance Issues

Optimize in `~/.0labs-vision/config.json`:

```json
{
  "frame_resolution": 384,
  "default_fps": 0.5,
  "max_frames": 50
}
```

## Advanced Configuration

### Project-Specific Settings

Create `.vscode/settings.json` in your project:

```json
{
  "github.copilot.mcp.servers": {
    "vision-link": {
      "command": "npx",
      "args": ["-y", "vision-link@latest"],
      "env": {
        "GEMINI_API_KEY": "${env:GEMINI_API_KEY}"
      }
    }
  }
}
```

### Custom Whisper Model

For better quality on powerful machines:

```json
{
  "backend": "local",
  "whisper_model": "large-v3-turbo",
  "frame_resolution": 768
}
```

### Enable Frame Caching

For repeated video analysis:

```json
{
  "enable_index": true,
  "session_max_age_days": 7
}
```

## Tips for VS Code

- Use `@workspace` to include project context
- Combine with file references: `@file:path/to/code.js`
- Use inline chat for targeted code changes
- Use chat panel for exploratory analysis

## See Also

- [Cursor Setup](./cursor.md) - Similar IDE setup
- [Generic MCP Setup](./generic-mcp.md)
- [Architecture](../ARCHITECTURE.md)
- [GitHub Copilot MCP Documentation](https://docs.github.com/copilot/mcp)
