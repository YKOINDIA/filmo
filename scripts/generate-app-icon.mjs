#!/usr/bin/env node
/**
 * Filmo の App Icon (1024x1024 PNG, no alpha) を Sharp で生成し、
 * iOS の AppIcon-512@2x.png に書き出す。
 *
 * デザイン:
 *   - 角丸正方形の濃紺グラデーション背景 (#1a1b3a → #0a0b14)
 *   - 中央に紫グラデーションの大きな F 文字
 *   - 下部にミニマルな film strip 風のドット
 *
 * 使い方:
 *   node scripts/generate-app-icon.mjs
 *   node scripts/generate-app-icon.mjs --out=path/to/icon.png  # 別パスへ書き出し
 */

import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const args = process.argv.slice(2)
const outArg = args.find(a => a.startsWith('--out='))
const OUT_PATH = outArg
  ? resolve(ROOT, outArg.slice('--out='.length))
  : resolve(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')

const SIZE = 1024

// ── SVG composition ──
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1b3a"/>
      <stop offset="100%" stop-color="#0a0b14"/>
    </linearGradient>
    <linearGradient id="fg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#a29bfe"/>
      <stop offset="100%" stop-color="#6c5ce7"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="18" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- 背景 (App Store は alpha なしの正方形 PNG を要求) -->
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>

  <!-- film strip 風の上下のドット (装飾) -->
  ${[...Array(7)].map((_, i) => {
    const x = 110 + i * 130
    return `<rect x="${x}" y="100" width="60" height="40" rx="6" fill="rgba(255,255,255,0.06)"/>` +
           `<rect x="${x}" y="${SIZE - 140}" width="60" height="40" rx="6" fill="rgba(255,255,255,0.06)"/>`
  }).join('\n  ')}

  <!-- 大きな F (Helvetica/Arial 系の太字) -->
  <text x="${SIZE / 2}" y="${SIZE * 0.78}"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-weight="900"
        font-size="780"
        letter-spacing="-30"
        fill="url(#fg)"
        text-anchor="middle"
        filter="url(#glow)">F</text>
</svg>`

// Splash 画面用 (2732x2732) — 中央のロゴ以外は単色背景
const SPLASH_SIZE = 2732
const splashSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SPLASH_SIZE}" height="${SPLASH_SIZE}" viewBox="0 0 ${SPLASH_SIZE} ${SPLASH_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1b3a"/>
      <stop offset="100%" stop-color="#0a0b14"/>
    </linearGradient>
    <linearGradient id="fg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#a29bfe"/>
      <stop offset="100%" stop-color="#6c5ce7"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="40" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="${SPLASH_SIZE}" height="${SPLASH_SIZE}" fill="url(#bg)"/>

  <!-- 中央: F + 下に FILMO ワードマーク -->
  <text x="${SPLASH_SIZE / 2}" y="${SPLASH_SIZE * 0.52}"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-weight="900"
        font-size="600"
        letter-spacing="-20"
        fill="url(#fg)"
        text-anchor="middle"
        filter="url(#glow)">F</text>

  <text x="${SPLASH_SIZE / 2}" y="${SPLASH_SIZE * 0.62}"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-weight="800"
        font-size="180"
        letter-spacing="40"
        fill="#ffffff"
        text-anchor="middle">FILMO</text>
</svg>`

async function generateIcon() {
  console.log(`▶ Generating app icon (${SIZE}×${SIZE}) → ${OUT_PATH}`)
  const buf = await sharp(Buffer.from(svg))
    .resize(SIZE, SIZE)
    .removeAlpha()
    .flatten({ background: { r: 10, g: 11, b: 20 } })
    .png({ compressionLevel: 9 })
    .toBuffer()
  await writeFile(OUT_PATH, buf)
  console.log(`  ✅ ${(buf.length / 1024).toFixed(1)} KB`)
}

async function generateSplash() {
  const splashDir = resolve(ROOT, 'ios/App/App/Assets.xcassets/Splash.imageset')
  console.log(`▶ Generating splash (${SPLASH_SIZE}×${SPLASH_SIZE}) → ${splashDir}/splash-2732x2732{,-1,-2}.png`)

  const buf = await sharp(Buffer.from(splashSvg))
    .resize(SPLASH_SIZE, SPLASH_SIZE)
    .png({ compressionLevel: 9 })
    .toBuffer()

  // 3 バリアント (1x, 2x, 3x) には全て同じ画像を使う
  await Promise.all([
    writeFile(resolve(splashDir, 'splash-2732x2732.png'), buf),
    writeFile(resolve(splashDir, 'splash-2732x2732-1.png'), buf),
    writeFile(resolve(splashDir, 'splash-2732x2732-2.png'), buf),
  ])
  console.log(`  ✅ ${(buf.length / 1024).toFixed(1)} KB × 3`)
}

async function main() {
  await generateIcon()
  await generateSplash()
}

main().catch(err => {
  console.error('fatal:', err)
  process.exit(1)
})
