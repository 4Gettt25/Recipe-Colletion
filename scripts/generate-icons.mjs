/**
 * generate-icons.mjs
 * Generates all app icon and splash-screen PNGs from SVG sources in assets/.
 *
 * Usage:
 *   npm run generate-icons
 *
 * Requires: @resvg/resvg-js (pure WASM, no native build needed)
 *   npm install --save-dev @resvg/resvg-js
 */

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function renderWidth(svgStr, width) {
  const resvg = new Resvg(svgStr, { fitTo: { mode: 'width', value: width } });
  return resvg.render().asPng();
}

function renderSize(svgStr, width, height) {
  // Render SVG and crop/pad to exact size by embedding in a fixed-size SVG.
  const resvg = new Resvg(svgStr, {
    fitTo: { mode: 'width', value: width },
  });
  const data = resvg.render();
  // @resvg/resvg-js renders the full SVG at the proportional height.
  // For splash screens the aspect ratio is fixed in the source SVG so this is fine.
  return data.asPng();
}

// ─── Android launcher icons ──────────────────────────────────────────────────

const iconSvg = readFileSync(join(root, 'assets/icon.svg'), 'utf8');
const androidRes = join(root, 'android/app/src/main/res');

const androidIconSizes = [
  { folder: 'mipmap-mdpi',    size: 48  },
  { folder: 'mipmap-hdpi',    size: 72  },
  { folder: 'mipmap-xhdpi',   size: 96  },
  { folder: 'mipmap-xxhdpi',  size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

console.log('\n📱 Android launcher icons');
for (const { folder, size } of androidIconSizes) {
  const png = renderWidth(iconSvg, size);
  const dir = join(androidRes, folder);
  ensureDir(dir);
  writeFileSync(join(dir, 'ic_launcher.png'), png);
  writeFileSync(join(dir, 'ic_launcher_round.png'), png);
  writeFileSync(join(dir, 'ic_launcher_foreground.png'), png);
  console.log(`  ✓ ${folder}  ${size}×${size}px`);
}

// ─── Android splash screens ───────────────────────────────────────────────────

const splashPortrait  = readFileSync(join(root, 'assets/splash.svg'), 'utf8');
const splashLandscape = readFileSync(join(root, 'assets/splash-land.svg'), 'utf8');

// Portrait widths (source SVG is 720×1280 = 9:16)
const portraitSplashes = [
  { folder: 'drawable',            width: 480  },
  { folder: 'drawable-port-hdpi',  width: 480  },
  { folder: 'drawable-port-xhdpi', width: 720  },
  { folder: 'drawable-port-xxhdpi', width: 960 },
  { folder: 'drawable-port-xxxhdpi', width: 1280 },
];

// Landscape widths (source SVG is 1280×720 = 16:9)
const landscapeSplashes = [
  { folder: 'drawable-land-hdpi',    width: 800  },
  { folder: 'drawable-land-xhdpi',   width: 1280 },
  { folder: 'drawable-land-xxhdpi',  width: 1600 },
  { folder: 'drawable-land-xxxhdpi', width: 1920 },
];

console.log('\n🖼  Android splash screens');
for (const { folder, width } of portraitSplashes) {
  const png = renderWidth(splashPortrait, width);
  const dir = join(androidRes, folder);
  ensureDir(dir);
  writeFileSync(join(dir, 'splash.png'), png);
  console.log(`  ✓ ${folder}  ${width}px`);
}
for (const { folder, width } of landscapeSplashes) {
  const png = renderWidth(splashLandscape, width);
  const dir = join(androidRes, folder);
  ensureDir(dir);
  writeFileSync(join(dir, 'splash.png'), png);
  console.log(`  ✓ ${folder}  ${width}px`);
}

// ─── Electron icon ────────────────────────────────────────────────────────────

console.log('\n🖥  Electron icon');
const electronPng = renderWidth(iconSvg, 512);
const electronDir = join(root, 'electron/resources');
ensureDir(electronDir);
writeFileSync(join(electronDir, 'icon.png'), electronPng);
console.log('  ✓ electron/resources/icon.png  512×512px');

console.log('\n✅ Done! Rebuild Android + Electron to apply changes.\n');
