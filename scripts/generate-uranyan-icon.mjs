#!/usr/bin/env node
/**
 * うらにゃん の App Icon (1024×1024 PNG, no alpha) と Splash 画像 を
 * SVG → Sharp で生成し、ios-uranyan/ の Assets.xcassets に書き出す。
 *
 * デザイン:
 *   - ピンクグラデ背景 (#FF7AAE → #FFC8DD) — capacitor.uranyan.config.ts の
 *     SplashScreen.backgroundColor と整合
 *   - 中央に白い猫顔 (耳・目を閉じた笑顔・ほっぺ・ピンクの鼻)
 *   - 四隅に控えめなキラキラ
 *
 * 使い方:
 *   node scripts/generate-uranyan-icon.mjs
 *   node scripts/generate-uranyan-icon.mjs --out=path/to/icon.png  # 別パスへ書き出し
 *
 * 後で本職デザイナーが画像を作ったら、AppIcon-512@2x.png を直接差し替えれば
 * このスクリプトは不要 (記録としては残しておく)。
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
  : resolve(ROOT, 'ios-uranyan/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')

const SIZE = 1024

// 4 点星 (キラキラ) を path で
function sparkle(cx, cy, size, opacity = 0.6) {
  const s = size
  return `<path d="M ${cx} ${cy - s} L ${cx + s * 0.25} ${cy - s * 0.25} L ${cx + s} ${cy} L ${cx + s * 0.25} ${cy + s * 0.25} L ${cx} ${cy + s} L ${cx - s * 0.25} ${cy + s * 0.25} L ${cx - s} ${cy} L ${cx - s * 0.25} ${cy - s * 0.25} Z" fill="rgba(255,255,255,${opacity})"/>`
}

// 猫顔の SVG コンポーネント (cx, cy = 顔の中心、r = 顔の半径)
function catFace(cx, cy, r) {
  const ear = (px, py, tipx, tipy, basex, basey, inner = false) => {
    const fill = inner ? '#FF9FC2' : '#FFFFFF'
    return `<polygon points="${px},${py} ${tipx},${tipy} ${basex},${basey}" fill="${fill}" stroke="${fill}" stroke-width="${inner ? 0 : 6}" stroke-linejoin="round"/>`
  }

  // 耳の座標 (顔の上端から少し内側に)
  const earOuterL = ear(cx - r * 0.75, cy - r * 0.65, cx - r * 0.45, cy - r * 1.05, cx - r * 0.30, cy - r * 0.50)
  const earOuterR = ear(cx + r * 0.30, cy - r * 0.50, cx + r * 0.45, cy - r * 1.05, cx + r * 0.75, cy - r * 0.65)
  const earInnerL = ear(cx - r * 0.66, cy - r * 0.62, cx - r * 0.48, cy - r * 0.90, cx - r * 0.35, cy - r * 0.55, true)
  const earInnerR = ear(cx + r * 0.35, cy - r * 0.55, cx + r * 0.48, cy - r * 0.90, cx + r * 0.66, cy - r * 0.62, true)

  const eyeY = cy - r * 0.05
  const eyeOffsetX = r * 0.42
  const eyeWidth = r * 0.20
  const noseTip = cy + r * 0.20

  return `
    ${earOuterL}
    ${earOuterR}
    ${earInnerL}
    ${earInnerR}

    <!-- 顔の輪郭 -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF"/>

    <!-- ほっぺ (グラデでふんわり) -->
    <ellipse cx="${cx - r * 0.55}" cy="${cy + r * 0.25}" rx="${r * 0.18}" ry="${r * 0.12}" fill="#FF9FC2" opacity="0.55"/>
    <ellipse cx="${cx + r * 0.55}" cy="${cy + r * 0.25}" rx="${r * 0.18}" ry="${r * 0.12}" fill="#FF9FC2" opacity="0.55"/>

    <!-- 目 (閉じた笑顔, ⌣ shape) -->
    <path d="M ${cx - eyeOffsetX - eyeWidth} ${eyeY} Q ${cx - eyeOffsetX} ${eyeY + r * 0.12} ${cx - eyeOffsetX + eyeWidth} ${eyeY}" stroke="#2A2A3A" stroke-width="${r * 0.06}" fill="none" stroke-linecap="round"/>
    <path d="M ${cx + eyeOffsetX - eyeWidth} ${eyeY} Q ${cx + eyeOffsetX} ${eyeY + r * 0.12} ${cx + eyeOffsetX + eyeWidth} ${eyeY}" stroke="#2A2A3A" stroke-width="${r * 0.06}" fill="none" stroke-linecap="round"/>

    <!-- 鼻 (三角、ピンク) -->
    <path d="M ${cx - r * 0.06} ${noseTip - r * 0.04} L ${cx + r * 0.06} ${noseTip - r * 0.04} L ${cx} ${noseTip + r * 0.06} Z" fill="#FF7AAE"/>

    <!-- 口 (w shape) -->
    <path d="M ${cx} ${noseTip + r * 0.06} Q ${cx - r * 0.10} ${noseTip + r * 0.20} ${cx - r * 0.20} ${noseTip + r * 0.10}" stroke="#2A2A3A" stroke-width="${r * 0.03}" fill="none" stroke-linecap="round"/>
    <path d="M ${cx} ${noseTip + r * 0.06} Q ${cx + r * 0.10} ${noseTip + r * 0.20} ${cx + r * 0.20} ${noseTip + r * 0.10}" stroke="#2A2A3A" stroke-width="${r * 0.03}" fill="none" stroke-linecap="round"/>

    <!-- ひげ (左右各2本ずつ) -->
    <line x1="${cx - r * 0.45}" y1="${noseTip - r * 0.02}" x2="${cx - r * 0.85}" y2="${noseTip - r * 0.08}" stroke="#2A2A3A" stroke-width="${r * 0.018}" stroke-linecap="round" opacity="0.7"/>
    <line x1="${cx - r * 0.45}" y1="${noseTip + r * 0.05}" x2="${cx - r * 0.85}" y2="${noseTip + r * 0.12}" stroke="#2A2A3A" stroke-width="${r * 0.018}" stroke-linecap="round" opacity="0.7"/>
    <line x1="${cx + r * 0.45}" y1="${noseTip - r * 0.02}" x2="${cx + r * 0.85}" y2="${noseTip - r * 0.08}" stroke="#2A2A3A" stroke-width="${r * 0.018}" stroke-linecap="round" opacity="0.7"/>
    <line x1="${cx + r * 0.45}" y1="${noseTip + r * 0.05}" x2="${cx + r * 0.85}" y2="${noseTip + r * 0.12}" stroke="#2A2A3A" stroke-width="${r * 0.018}" stroke-linecap="round" opacity="0.7"/>
  `
}

// ── App Icon SVG ──
const iconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7AAE"/>
      <stop offset="100%" stop-color="#FFB6D1"/>
    </linearGradient>
  </defs>

  <!-- 背景 (alpha なし、App Store 要件) -->
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>

  <!-- 背景キラキラ -->
  ${sparkle(180, 200, 35, 0.6)}
  ${sparkle(850, 240, 28, 0.5)}
  ${sparkle(150, 830, 32, 0.5)}
  ${sparkle(870, 800, 38, 0.6)}
  ${sparkle(120, 500, 18, 0.4)}
  ${sparkle(900, 540, 22, 0.4)}

  <!-- 猫顔 -->
  ${catFace(SIZE / 2, SIZE / 2 + 30, 290)}
</svg>`

// ── Splash SVG (2732x2732, 中央のアイコン縮小版 + 文字なし) ──
const SPLASH_SIZE = 2732
const splashSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SPLASH_SIZE}" height="${SPLASH_SIZE}" viewBox="0 0 ${SPLASH_SIZE} ${SPLASH_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7AAE"/>
      <stop offset="100%" stop-color="#FFB6D1"/>
    </linearGradient>
  </defs>

  <rect width="${SPLASH_SIZE}" height="${SPLASH_SIZE}" fill="url(#bg)"/>

  <!-- 中央に猫顔 (splash は控えめサイズ、画面中央に置く) -->
  ${catFace(SPLASH_SIZE / 2, SPLASH_SIZE / 2, 500)}
</svg>`

async function generateIcon() {
  console.log(`▶ Generating うらにゃん app icon (${SIZE}×${SIZE}) → ${OUT_PATH}`)
  const buf = await sharp(Buffer.from(iconSvg))
    .resize(SIZE, SIZE)
    .removeAlpha()
    .flatten({ background: { r: 255, g: 122, b: 174 } })
    .png({ compressionLevel: 9 })
    .toBuffer()
  await writeFile(OUT_PATH, buf)
  console.log(`  ✅ ${(buf.length / 1024).toFixed(1)} KB`)
}

async function generateSplash() {
  const splashDir = resolve(ROOT, 'ios-uranyan/App/App/Assets.xcassets/Splash.imageset')
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
