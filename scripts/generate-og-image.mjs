/**
 * デフォルト OG 画像 (public/og-image.png, 1200x630) を生成する。
 *
 * layout.tsx の openGraph.images / twitter.images が /og-image.png を参照しているが
 * ファイルが存在せず、X/LINE 等でシェアされたときにカード画像が出ていなかった。
 * (シェア導線はあるのにカードが文字だけ → クリック率を大きく損ねる)
 *
 * 使い方: node scripts/generate-og-image.mjs
 * デザインを変えたらこのスクリプトを編集して再生成する。
 */
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const out = join(root, 'public', 'og-image.png')

// フィルムストリップの穴 (上下)
const holes = (y) =>
  Array.from({ length: 24 }, (_, i) =>
    `<rect x="${30 + i * 48}" y="${y}" width="26" height="18" rx="4" fill="#1a1d26"/>`
  ).join('')

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0e16"/>
      <stop offset="55%" stop-color="#08090d"/>
      <stop offset="100%" stop-color="#0a1410"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00c030"/>
      <stop offset="100%" stop-color="#40d868"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.45" r="0.7">
      <stop offset="0%" stop-color="#00c030" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#00c030" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- フィルムストリップ (上下) -->
  ${holes(28)}
  ${holes(584)}
  <rect x="0" y="60" width="1200" height="2" fill="#222633"/>
  <rect x="0" y="568" width="1200" height="2" fill="#222633"/>

  <!-- ロゴ -->
  <text x="600" y="305" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="150" font-weight="800"
        letter-spacing="14" fill="#ffffff">FILMO</text>
  <rect x="450" y="345" width="300" height="8" rx="4" fill="url(#accent)"/>

  <!-- タグライン -->
  <text x="600" y="425" text-anchor="middle"
        font-family="'Yu Gothic', 'Hiragino Sans', 'Noto Sans JP', sans-serif"
        font-size="40" font-weight="600" fill="#dfe3ec">映画・ドラマ・アニメの記録とレビュー</text>
  <text x="600" y="490" text-anchor="middle"
        font-family="'Yu Gothic', 'Hiragino Sans', 'Noto Sans JP', sans-serif"
        font-size="28" fill="#8d93a5">鑑賞記録・星評価・配信情報・統計 — 完全無料</text>

  <!-- 星 -->
  <text x="600" y="155" text-anchor="middle" font-size="44" fill="#FFD24A"
        font-family="Arial, sans-serif">★ ★ ★ ★ ★</text>
</svg>
`

await sharp(Buffer.from(svg)).png().toFile(out)
console.log('generated:', out)
