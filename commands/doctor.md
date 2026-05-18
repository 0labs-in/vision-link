---
description: "Diagnose and auto-fix vision-link setup issues — checks dependencies, config, PATH, and offers automated repairs"
---

# Doctor

Comprehensive diagnostic and repair tool for vision-link setup issues.

## What Doctor Does

1. **Checks all dependencies:**
   - ffmpeg (required)
   - ffprobe (required)
   - whisper-cli or main (for local backend)
   - yt-dlp (optional, for YouTube)

2. **Verifies configuration:**
   - Config file exists at `~/.0labs-vision/config.json`
   - Backend is configured (not "unconfigured")
   - Settings are valid

3. **Tests PATH detection:**
   - Checks if whisper-cli is accessible
   - Verifies MCP server can find executables

4. **Auto-fixes common issues:**
   - Creates missing config directory
   - Fixes PATH issues for whisper
   - Offers to install missing dependencies
   - Repairs corrupted config files

5. **Provides clear output:**
   - ✅ Green checks for working components
   - ⚠️ Yellow warnings for optional issues
   - ❌ Red errors for critical problems
   - 🔧 Auto-fix suggestions with commands

## Workflow

1. Call `video_setup` to get initial diagnostic data
2. Parse the results and identify issues
3. For each issue found:
   - Explain what's wrong
   - Offer to fix it automatically
   - If user agrees, run the fix
   - Verify the fix worked
4. Re-run `video_setup` to confirm everything is working
5. Show final status summary

## Common Issues Doctor Fixes

### Issue: whisper-cli not found in PATH
**Symptom:** Local backend fails with "whisper-cli not found"
**Fix:** Add whisper installation directory to PATH, or guide user to restart Claude Code

### Issue: Config file missing or corrupted
**Symptom:** Tools fail with config errors
**Fix:** Create default config file with "unconfigured" backend, prompt user to run setup

### Issue: ffmpeg not installed
**Symptom:** All video operations fail
**Fix:** Provide platform-specific installation commands

### Issue: Backend configured but dependencies missing
**Symptom:** Setup says "local" backend but whisper not installed
**Fix:** Either install whisper or switch to Gemini/OpenAI backend

### Issue: Permissions on config directory
**Symptom:** Can't write to `~/.0labs-vision/`
**Fix:** Create directory with correct permissions

### Issue: Old/incompatible whisper version
**Symptom:** whisper-cli exists but fails with unknown arguments
**Fix:** Guide user to update whisper.cpp

## Output Format

```
🔍 Running vision-link diagnostics...

✅ ffmpeg: Found (version 6.0)
✅ ffprobe: Found (version 6.0)
❌ whisper-cli: Not found in PATH
⚠️ yt-dlp: Not installed (optional, needed for YouTube URLs)
✅ Config file: Found at ~/.0labs-vision/config.json
✅ Backend: Configured (local)

🔧 Issues found:

1. whisper-cli not accessible
   Problem: Local backend is configured but whisper-cli can't be found
   Location: C:\Users\username\.0labs-vision\whisper.cpp\Release\whisper-cli.exe exists
   Fix: Add to PATH or restart Claude Code to pick up environment changes
   
   Want me to:
   a) Add to Windows PATH permanently
   b) Guide you to restart Claude Code
   c) Switch to Gemini API backend instead

2. yt-dlp missing (optional)
   Problem: YouTube URL support won't work
   Fix: Install with: pip install yt-dlp
   
   Want me to install it? (y/n)

---

After fixes:

✅ All critical dependencies working
✅ Configuration valid
✅ Ready to analyze videos

Run /vision-link:watch-video to test!
```

## Important

- Doctor should be helpful, not overwhelming
- Always explain WHY something is broken, not just WHAT
- Offer automated fixes when safe
- For risky operations (modifying PATH, installing software), ask first
- If multiple issues exist, fix them in order of importance:
  1. Critical (ffmpeg, config file)
  2. Backend-specific (whisper for local, API keys for cloud)
  3. Optional (yt-dlp)
- After fixing, always verify with another `video_setup` call
- Keep output concise — use collapsible sections for verbose details
