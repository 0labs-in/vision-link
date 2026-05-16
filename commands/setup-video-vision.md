---
description: "Interactive setup wizard for 0labs-vision — configure backend, whisper, frames, and verify dependencies"
---

# Setup Video Vision

Guide the user through configuring 0labs-vision with 3 setup modes.

## First: Ask Setup Mode

Ask the user to choose their setup mode:

> How would you like to set up vision-link?
>
> **1) Quick Setup** (recommended) — Auto-configure everything with best defaults. One click, ready to go.
>
> **2) Advanced Setup** — Full control. Configure every option step-by-step.
>
> **3) Custom Setup** — Pick which settings to customize, use defaults for the rest.

### Mode 1: Quick Setup

If user chooses Quick Setup:

1. Tell them: "Setting up with recommended defaults..."
2. Call `video_configure` with these settings:
   ```
   backend: "local"
   whisper_engine: "cpp"
   whisper_model: "auto"
   whisper_at: false
   frame_resolution: 512
   default_fps: "auto"
   frame_mode: "images"
   ```
3. Call `video_setup` to verify dependencies
4. Show: "✅ Quick setup complete! Ready to analyze videos."
5. Skip to Step 5 (Test)

### Mode 2: Advanced Setup

If user chooses Advanced Setup, proceed to Step 1 below (ask every question).

### Mode 3: Custom Setup

If user chooses Custom Setup:

Ask: "Which settings do you want to customize? (choose multiple)"

> **a) Backend** (audio processing method)
>
> **b) Whisper settings** (model, engine)
>
> **c) Frame settings** (resolution, fps, mode)
>
> **d) None, use all defaults**

Then only ask questions for the selected categories, use defaults for the rest.

---

## Step 1: Backend Selection (Advanced/Custom only)

Ask the user:

> Which backend do you want to use for audio analysis?
>
> **a) Gemini API** (recommended) — Best quality. Analyzes audio natively with Gemini Flash. Free tier: 1500 requests/day. Requires a GEMINI_API_KEY (free at ai.google.dev).
>
> **b) Local (Whisper)** — Free, fully offline. Uses whisper.cpp or openai-whisper for audio transcription. No cloud dependency.
>
> **c) OpenAI Whisper API** — Good quality. Requires OPENAI_API_KEY. Paid per usage.
>
> All backends use ffmpeg to extract video frames — Claude sees the frames directly.

After the user answers, call `video_configure` with the chosen `backend`.

## Step 2: Whisper Configuration (only if backend is "local")

If the user chose Local, ask these questions one at a time:

### Engine
> Which whisper engine?
>
> **a) whisper.cpp** (recommended) — Faster, less RAM, optimized for Mac/Linux
>
> **b) Python (openai-whisper)** — More flexible, easier to extend

Call `video_configure` with `whisper_engine`.

### Model
> Which whisper model? Your system has **[detect RAM with video_setup]** of RAM.
>
> **a) tiny** (75MB) — Very fast, basic quality
>
> **b) small** (500MB) — Good balance of speed and quality
>
> **c) large-v3-turbo** (1.5GB) — Best cost-benefit, recommended for 8GB+ RAM
>
> **d) large-v3** (2.9GB) — Maximum quality, recommended for 16GB+ RAM
>
> **e) auto** — Let the plugin choose based on your hardware

Call `video_configure` with `whisper_model`.

### Audio Tags
> Enable Whisper-AT for non-speech audio detection? (coughs, music, animal sounds, etc.)
>
> **a) Yes** — Detects non-speech events (requires Whisper-AT installed)
>
> **b) No** — Speech transcription only

Call `video_configure` with `whisper_at`.

## Step 3: Frame Configuration

Ask these one at a time:

### Resolution
> Frame extraction resolution (width in pixels, height auto-scales)?
>
> **a) 256px** — Low res, fast, fewer tokens
>
> **b) 512px** (default) — Good balance
>
> **c) 768px** — Higher detail
>
> **d) 1024px** — Maximum detail, more tokens

Call `video_configure` with `frame_resolution`.

### FPS
> Default frames per second extraction rate?
>
> **a) auto** (recommended) — Adapts based on video duration (shorter = more frames, longer = fewer)
>
> **b) Custom value** — Ask user for a number

Call `video_configure` with `default_fps`.

### Frame Mode
> How should Claude receive the frames?
>
> **a) Images** (default) — Claude sees the actual frames (better perception, more tokens)
>
> **b) Descriptions** — A sub-agent describes each frame as text (fewer tokens, loses visual nuance)

Call `video_configure` with `frame_mode`.

If descriptions mode:
> Which model for the frame describer agent?
>
> **a) Sonnet** (default) — Good balance
>
> **b) Opus** — Most detailed descriptions
>
> **c) Haiku** — Fastest, most concise

Call `video_configure` with `frame_describer_model`.

## Step 4: Dependency Check

Tell the user:
> Let me verify your setup...

Call `video_setup` with the configured backend and options. Show the results.
Mention that `yt-dlp` is optional but required for YouTube URL support.

If dependencies are missing, show the installation commands and ask:
> Want me to install these for you?

## Step 5: Test (Optional)

After setup is complete, ask:
> Setup complete! Want to test with a quick video? If so, provide a path to any video file.

If the user provides a video, call `video_watch` on it and show a brief summary of the results.

## Important

- **Quick Setup**: One call to `video_configure` with all defaults, then verify
- **Advanced Setup**: Ask ONE question at a time, call `video_configure` after EACH answer
- **Custom Setup**: Only ask about selected categories, use defaults for others
- Use the multiple choice format consistently
- If the user says "default" or "skip", use defaults for remaining questions
- Keep it concise — don't over-explain unless the user asks

## Default Values Reference

```json
{
  "backend": "local",
  "whisper_engine": "cpp",
  "whisper_model": "auto",
  "whisper_at": false,
  "frame_resolution": 512,
  "default_fps": "auto",
  "frame_mode": "images",
  "frame_describer_model": "sonnet"
}
```

