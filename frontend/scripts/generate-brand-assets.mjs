// Regenerates the branded favicon and loader from the source medallion art.
// Run from the frontend package root:  node scripts/generate-brand-assets.mjs
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "public/assets/Splendor.png");
const ICO_OUT = path.join(ROOT, "src/app/favicon.ico");
const WEBP_OUT = path.join(ROOT, "public/assets/brand/loader.webp");

// Trim the transparent margin around the circular medallion so the artwork
// fills the frame, then work from that tightly-cropped square.
const trimmed = await sharp(SRC).trim().toBuffer();
const meta = await sharp(trimmed).metadata();
console.log(`trimmed to ${meta.width}x${meta.height}`);

const square = (size) =>
  sharp(trimmed)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

// --- Favicon: multi-resolution .ico (16/32/48/64) ---
const pngBuffers = await Promise.all([16, 32, 48, 64].map(square));
const ico = await pngToIco(pngBuffers);
await writeFile(ICO_OUT, ico);
console.log(`wrote ${ICO_OUT} (${ico.length} bytes)`);

// --- Loader: transparent .webp at 512px ---
await mkdir(path.dirname(WEBP_OUT), { recursive: true });
await sharp(trimmed)
  .resize(512, 512, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .webp({ quality: 90, alphaQuality: 100, effort: 6 })
  .toFile(WEBP_OUT);
console.log(`wrote ${WEBP_OUT}`);
