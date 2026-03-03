// scripts/video/mov-to-mp4.js
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

// --- repo paths (based on script location) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const INPUT_DIR = path.join(REPO_ROOT, "assets", "video-assets");
const OUTPUT_DIR = path.join(REPO_ROOT, "output", "video-output");

// --- config ---
const EXT_RE = /\.mov$/i;

// Try "no re-encode" first. If it fails, fall back to re-encode.
const TRY_COPY_FIRST = true;

// Utilities
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listMovFiles(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Input folder not found: ${dir}`);
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && EXT_RE.test(d.name))
    .map((d) => path.join(dir, d.name))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

// !VA Write ffmpeg action to terminal
// function run(cmd, args) {
//   const res = spawnSync(cmd, args, { stdio: "inherit" });
//   return res.status === 0;
// }

// !VA Quiet version
function run(cmd, args) {
  const res = spawnSync(cmd, args, {
    stdio: ["ignore", "ignore", "pipe"], // no stdout, capture stderr
    encoding: "utf8",
  });

  if (res.status !== 0) {
    console.error(res.stderr); // only show errors
  }

  return res.status === 0;
}




function toOutPath(inPath) {
  const base = path.basename(inPath, path.extname(inPath));
  return path.join(OUTPUT_DIR, `${base}.mp4`);
}

// --- ffmpeg recipes ---
// 1) Stream copy (fastest, no re-encode). Preserves streams + metadata when possible.
// Updated to avoid MOV data/timecode streams that MP4 cannot mux ("codec none" stream).
function ffmpegCopy(inFile, outFile) {
  const args = [
    "-hide_banner",
    "-y",
    "-i",
    inFile,

    // Only include real A/V streams (avoid timecode/data streams that break MP4)
    "-map",
    "0:v:0",
    "-map",
    "0:a?",

    // Drop data and subtitle streams explicitly
    "-dn",
    "-sn",

    // Keep metadata
    "-map_metadata",
    "0",

    // MP4 friendliness
    "-movflags",
    "+faststart",

    // no re-encode
    "-c",
    "copy",

    outFile,
  ];
  return run("ffmpeg", args);
}

// 2) Fallback encode: preserves resolution (no scale), keeps audio, keeps metadata.
// Keeps orientation as metadata (no transpose filter). If a specific player ignores
// rotation metadata, we can add an optional "bake rotation" mode later.
function ffmpegReencode(inFile, outFile) {
  const args = [
    "-hide_banner",
    "-y",
    "-i",
    inFile,

    // Map only A/V to avoid data/timecode tracks
    "-map",
    "0:v:0",
    "-map",
    "0:a?",

    // Drop data/subtitle streams
    "-dn",
    "-sn",

    // Keep metadata
    "-map_metadata",
    "0",

    // MP4 friendliness
    "-movflags",
    "+faststart",

    // Video: H.264 (widely compatible), quality-based encoding
    "-c:v",
    "libx264",
    "-crf",
    "18",
    "-preset",
    "medium",

    // Keep original dimensions by not scaling.
    // (No -vf scale...)

    // Audio: AAC (widely compatible)
    "-c:a",
    "aac",
    "-b:a",
    "192k",

    outFile,
  ];
  return run("ffmpeg", args);
}

async function main() {
  ensureDir(OUTPUT_DIR);

  // !VA For output to terminal after processing
  const processed = [];

  const inputs = listMovFiles(INPUT_DIR);
  if (inputs.length === 0) {
    console.log(`No .mov files found in: ${INPUT_DIR}`);
    return;
  }

  console.log(`Found ${inputs.length} .mov file(s) in: ${INPUT_DIR}`);
  console.log(`Output folder: ${OUTPUT_DIR}\n`);

  let ok = 0;
  let failed = 0;

  for (const inFile of inputs) {
    const outFile = toOutPath(inFile);

    // !VA Only if there's an issue for debugging
    // console.log(`➡️  ${path.basename(inFile)}  →  ${path.basename(outFile)}`);

    // 1) try copy
    let success = false;
    if (TRY_COPY_FIRST) {
      success = ffmpegCopy(inFile, outFile);
      if (!success) {
        console.log("   ⚠️ Copy failed; falling back to re-encode…");
      }
    }

    // 2) fallback
    if (!success) {
      success = ffmpegReencode(inFile, outFile);
    }


    if (success) {
      ok += 1;
      // console.log("   ✅ Done\n");
      processed.push({
      input: inFile,
      output: outFile,
    });
    } else {
      failed += 1;
      // console.log("   ❌ Failed\n");
    }
  }

  console.log("\n====================================");
  console.log("Conversion Summary");
  console.log("====================================");

  console.log(`Input folder : ${INPUT_DIR}`);
  console.log(`Output folder: ${OUTPUT_DIR}\n`);

  processed.forEach((p) => {
    console.log(`${path.basename(p.input)}  →  ${path.basename(p.output)}`);
  });

  console.log(`\n✅ ${ok} succeeded`);
  if (failed > 0) {
    console.log(`❌ ${failed} failed`);
  }
  console.log("====================================\n");



}

main().catch((e) => {
  console.error("❌ Error:", e?.message || e);
  process.exit(1);
});