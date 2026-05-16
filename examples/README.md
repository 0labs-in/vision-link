# Example Configurations

This directory contains example MCP configuration snippets for different AI platforms.

## Quick Start

Choose the example closest to your platform and adapt it using the setup guide for your installed client version:

### Claude Desktop

**File**: `claude-desktop-config.json`  
**Location**: 
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**Setup**: [docs/setup/claude-desktop.md](../docs/setup/claude-desktop.md)

### Cursor IDE

**File**: `cursor-config.json`  
**Location**: Use the MCP settings or documented config location for your installed Cursor build.

**Setup**: [docs/setup/cursor.md](../docs/setup/cursor.md)

## Configuration Options

### Basic Configuration

Minimal setup - uses local Whisper for audio:

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

### With API Keys

For Gemini API or OpenAI Whisper API:

```json
{
  "mcpServers": {
    "vision-link": {
      "command": "npx",
      "args": ["-y", "vision-link@latest"],
      "env": {
        "GEMINI_API_KEY": "your-key-here",
        "OPENAI_API_KEY": "your-key-here"
      }
    }
  }
}
```

### Local Development

Using a local clone instead of npm:

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

## User Configuration

After adding the MCP server, configure your preferences in `~/.0labs-vision/config.json`:

```json
{
  "backend": "local",
  "whisper_engine": "cpp",
  "whisper_model": "auto",
  "frame_resolution": 512,
  "default_fps": "auto",
  "max_frames": 100,
  "enable_index": false
}
```

### Backend Options

- `"gemini-api"` - Best quality, requires GEMINI_API_KEY
- `"local"` - Free, offline, requires whisper.cpp or openai-whisper
- `"openai"` - Good quality, requires OPENAI_API_KEY

### Whisper Models (for local backend)

- `"tiny"` - Fastest, basic quality (75MB)
- `"base"` - Fast, good quality (142MB)
- `"small"` - Balanced (466MB)
- `"medium"` - High quality (1.5GB)
- `"large-v3-turbo"` - Best cost-benefit (1.6GB)
- `"large-v3"` - Maximum quality (2.9GB)
- `"auto"` - Automatically selects based on available RAM

## Testing

Test the MCP server directly with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector npx vision-link@latest
```

## See Also

- [Setup Guides](../docs/setup/)
- [Architecture Documentation](../docs/ARCHITECTURE.md)
- [Main README](../README.md)
