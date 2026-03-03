// scripts/image/build-og-grid.js
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Repo root = two levels up from scripts/image/
const ROOT = path.resolve(__dirname, "..", "..");

// Input images:
const INPUT_DIR = path.join(ROOT, "assets", "og-grid-assets");

// Output file:
const OUTPUT_PATH = path.join(ROOT, "output", "og-grid-output", "og-grid.png");

const EXT_RE = /\.(png|jpe?g|webp)$/i;

const CANVAS_W = 1200;
const CANVAS_H = 630;

const COLS = 4;
const ROWS = 3;

const GAP = 10;
const OUTER_MARGIN = 10;

const TILE_W = 287;
const TILE_H = 196;

const BG = { r: 37, g: 37, b: 37, alpha: 1 };

const FIT = "contain"; // or "cover"

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function listInputImages(dir) {
  if (!fs.existsSync(dir)) throw new Error(`Input folder not found: ${dir}`);
  return fs
    .readdirSync(dir)
    .filter((f) => EXT_RE.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}

function posForIndex(i) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const left = OUTER_MARGIN + col * (TILE_W + GAP);
  const top = OUTER_MARGIN + row * (TILE_H + GAP);
  return { left, top };
}

async function makeTileBuffer(imgPath) {
  return sharp(imgPath)
    .resize(TILE_W, TILE_H, {
      fit: FIT,
      background: BG,
      position: "centre"
    })
    .toBuffer();
}

(async () => {
  try {
    const inputs = listInputImages(INPUT_DIR);

    const needed = COLS * ROWS;
    if (inputs.length < needed) {
      throw new Error(`Need at least ${needed} images in ${INPUT_DIR}. Found ${inputs.length}.`);
    }

    const use = inputs.slice(0, needed);

    const canvas = sharp({
      create: {
        width: CANVAS_W,
        height: CANVAS_H,
        channels: 4,
        background: BG
      }
    });

    const composites = [];
    for (let i = 0; i < use.length; i++) {
      const tileBuf = await makeTileBuffer(use[i]);
      const { left, top } = posForIndex(i);
      composites.push({ input: tileBuf, left, top });
    }

    ensureDir(OUTPUT_PATH);

    await canvas.composite(composites).png({ compressionLevel: 9 }).toFile(OUTPUT_PATH);

    console.log("✅ OG mosaic generated:", OUTPUT_PATH);
    console.log("   Input:", INPUT_DIR);
  } catch (err) {
    console.error("❌ Failed:", err?.message || err);
    process.exit(1);
  }
})();