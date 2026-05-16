import { buildAnalysisCommand, parseScdetOutput, parseScdetFromMetaFile, parseBlackdetectOutput, parseSilenceOutput, deriveContentProfile, parseSitiOutput, parseEbur128Output } from "../src/extractors/analyzers.js";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

async function main() {
  const videoPath = "/Users/jordanvasconcelos/Downloads/Test.mov";
  const workDir = join(tmpdir(), "cvv-test-analyze-" + Date.now());
  mkdirSync(workDir, { recursive: true });

  const filters = {
    scene_changes: true,
    black_intervals: true,
    silence: true,
    freeze: false,
    motion: true,
    blur: false,
    exposure: false,
    loudness: true,
    transcription: false,
  };

  const cmd = buildAnalysisCommand(videoPath, filters, workDir);
  if (!cmd) { console.log("No command built"); return; }

  console.log("=== FFMPEG COMMAND ===");
  console.log("ffmpeg", cmd.args.join(" "));
  console.log("");

  let stderr = "";
  try {
    const result = await execFileAsync("ffmpeg", cmd.args, { timeout: 120_000, maxBuffer: 100 * 1024 * 1024 });
    stderr = result.stderr;
  } catch (err: any) {
    stderr = err.stderr || "";
    console.log("(ffmpeg exited non-zero — parsing stderr anyway)");
  }

  console.log("=== SCENE CHANGES (from metadata file) ===");
  const { readFileSync, existsSync } = await import("fs");
  if (cmd.videoMetaFile && existsSync(cmd.videoMetaFile)) {
    const metaContent = readFileSync(cmd.videoMetaFile, "utf-8");
    const scenes = parseScdetFromMetaFile(metaContent);
    console.log(JSON.stringify(scenes, null, 2));
    console.log("Total:", scenes.length);
  } else {
    console.log("(no metadata file — falling back to stderr)");
    const scenes = parseScdetOutput(stderr);
    console.log(JSON.stringify(scenes, null, 2));
    console.log("Total:", scenes.length);
  }

  console.log("\n=== BLACK INTERVALS ===");
  console.log(JSON.stringify(parseBlackdetectOutput(stderr), null, 2));

  console.log("\n=== SILENCE ===");
  console.log(JSON.stringify(parseSilenceOutput(stderr), null, 2));

  console.log("\n=== SITI (MOTION) ===");
  const siti = parseSitiOutput(stderr);
  console.log(JSON.stringify(siti));
  console.log("Content profile:", deriveContentProfile(siti.siAvg, siti.tiAvg));

  console.log("\n=== LOUDNESS (EBU R128) ===");
  console.log(JSON.stringify(parseEbur128Output(stderr)));

  rmSync(workDir, { recursive: true, force: true });
}

main().catch(console.error);
