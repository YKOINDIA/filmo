// ============================================================
// うらにゃん。: 犬種・猫種 SVG アイコン
// ============================================================
// chibi/kawaii 風: 大きな目・丸い顔・小さな鼻・ふんわり輪郭。
// 1 アイコン = 1 SVG (64x64 viewBox) で、breed の visual パラメータ
// (characters.ts) に基づいて耳・口・マスクなどを切り替える。
//
// 表示先:
//   - キャラ選好ピッカー (CharacterView)
//   - メニュー画面のヒーロー (ニャンじろう & ポチ)
//   - 結果画面の掛け合い (PillarBlock / CompatResult / GroupResult)

import type { BreedOption, DogVisual, CatVisual, DogEarStyle } from './characters'

// ─────────────────────────────────────────────────────────────
// Dog: 耳パスのテンプレ (style ごと)
// ─────────────────────────────────────────────────────────────
function dogEars(style: DogEarStyle, color: string) {
  switch (style) {
    case 'prick':
      return (
        <>
          <path d="M 16 24 L 8 4 L 24 14 Z"  fill={color} />
          <path d="M 48 24 L 56 4 L 40 14 Z" fill={color} />
        </>
      )
    case 'small_prick':
      return (
        <>
          <path d="M 18 20 L 12 6 L 24 14 Z"  fill={color} />
          <path d="M 46 20 L 52 6 L 40 14 Z"  fill={color} />
        </>
      )
    case 'floppy':
      return (
        <>
          <ellipse cx="14" cy="32" rx="8"  ry="14" fill={color} />
          <ellipse cx="50" cy="32" rx="8"  ry="14" fill={color} />
        </>
      )
    case 'big_floppy':
      return (
        <>
          <ellipse cx="12" cy="36" rx="9"  ry="17" fill={color} />
          <ellipse cx="52" cy="36" rx="9"  ry="17" fill={color} />
        </>
      )
    case 'long_floppy':
      return (
        <>
          <path d="M 18 22 Q 6 36 10 54 Q 18 56 22 40 Z"  fill={color} />
          <path d="M 46 22 Q 58 36 54 54 Q 46 56 42 40 Z" fill={color} />
        </>
      )
    case 'bat':
      return (
        <>
          <path d="M 16 22 L 4 6  L 26 18 Z"  fill={color} />
          <path d="M 48 22 L 60 6 L 38 18 Z"  fill={color} />
        </>
      )
    case 'curly':
      return (
        <>
          {/* ベースの垂れ + ふわふわ巻き毛の重ね */}
          <ellipse cx="12" cy="32" rx="9"  ry="14" fill={color} />
          <ellipse cx="52" cy="32" rx="9"  ry="14" fill={color} />
          <circle cx="8"  cy="24" r="4" fill={color} />
          <circle cx="56" cy="24" r="4" fill={color} />
          <circle cx="14" cy="44" r="4" fill={color} />
          <circle cx="50" cy="44" r="4" fill={color} />
        </>
      )
    case 'feathered':
      return (
        <>
          <path d="M 14 20 L 2 8  L 8  32 Z" fill={color} />
          <path d="M 50 20 L 62 8 L 56 32 Z" fill={color} />
          {/* 飾り毛 */}
          <circle cx="4"  cy="20" r="2" fill={color} />
          <circle cx="60" cy="20" r="2" fill={color} />
        </>
      )
  }
}

// ─────────────────────────────────────────────────────────────
// Dog: 顔のマスク/模様
// ─────────────────────────────────────────────────────────────
function dogMask(v: DogVisual) {
  if (!v.mask || v.mask === 'none') return null
  const mc = v.maskColor ?? (v.snoutColor ?? '#FFFFFF')
  switch (v.mask) {
    case 'snout_white':
      // 鼻まわりを覆う白っぽい三角〜楕円
      return <path d="M 22 38 Q 32 28 42 38 Q 38 50 32 52 Q 26 50 22 38 Z" fill={mc} />
    case 'forehead_blaze':
      return <path d="M 30 14 Q 31 28 30 38 L 34 38 Q 33 28 34 14 Z" fill={mc} />
    case 'eye_patch_left':
      return <ellipse cx="22" cy="32" rx="8" ry="7" fill={mc} />
    case 'eye_mask':
      return (
        <>
          <ellipse cx="22" cy="32" rx="7" ry="6" fill={mc} />
          <ellipse cx="42" cy="32" rx="7" ry="6" fill={mc} />
          <ellipse cx="32" cy="44" rx="9" ry="5" fill={mc} />
        </>
      )
    case 'tuxedo':
      // 顔の下半分を白に
      return (
        <>
          <path d="M 14 36 Q 32 56 50 36 Q 50 56 32 60 Q 14 56 14 36 Z" fill={mc} />
          <path d="M 28 18 Q 32 24 36 18 L 36 38 L 28 38 Z" fill={mc} />
        </>
      )
  }
}

// ─────────────────────────────────────────────────────────────
// Dog Icon
// ─────────────────────────────────────────────────────────────
export function DogIcon({ breed, size = 48, title }: {
  breed: BreedOption
  size?: number
  title?: string
}) {
  const v = breed.dog
  if (!v) return <FallbackEmoji emoji={breed.emoji} size={size} title={title ?? breed.label} />
  const earColor = v.earColor ?? v.faceColor
  const noseColor = v.noseColor ?? '#1A1612'
  const eyeColor = v.eyeColor === 'blue' ? '#5EC8E2' : v.eyeColor === 'amber' ? '#F0AC4A' : '#1A1612'
  // ふわふわ輪郭: 顔の外側に薄い円を散らす
  const fluffy = v.fluffy

  return (
    <svg viewBox="0 0 64 64" width={size} height={size}
      role="img" aria-label={title ?? breed.label}>
      {title && <title>{title}</title>}
      {/* fluffy 輪郭 (奥) */}
      {fluffy && (
        <>
          <circle cx="14" cy="40" r="8"  fill={v.faceColor} opacity="0.7" />
          <circle cx="50" cy="40" r="8"  fill={v.faceColor} opacity="0.7" />
          <circle cx="20" cy="20" r="6"  fill={v.faceColor} opacity="0.7" />
          <circle cx="44" cy="20" r="6"  fill={v.faceColor} opacity="0.7" />
        </>
      )}
      {/* 耳 (顔の奥に) */}
      {dogEars(v.earStyle, earColor)}
      {/* 顔 ベース */}
      <ellipse cx="32" cy="36" rx="22" ry="20" fill={v.faceColor} />
      {/* マスク/模様 */}
      {dogMask(v)}
      {/* 鼻先の薄色 (snoutColor only when no mask conflict) */}
      {v.snoutColor && (v.mask === 'none' || v.mask === undefined) && (
        <ellipse cx="32" cy="44" rx="11" ry="8" fill={v.snoutColor} />
      )}
      {/* 目 */}
      <ellipse cx="23" cy="33" rx="3.2" ry="4" fill={eyeColor} />
      <ellipse cx="41" cy="33" rx="3.2" ry="4" fill={eyeColor} />
      {/* 目ハイライト */}
      <circle cx="24" cy="32" r="1.2" fill="#FFFFFF" />
      <circle cx="42" cy="32" r="1.2" fill="#FFFFFF" />
      {/* 鼻 */}
      <ellipse cx="32" cy="42" rx="3" ry="2.4" fill={noseColor} />
      <ellipse cx="31" cy="41.3" rx="0.7" ry="0.7" fill="#FFFFFF" opacity="0.7" />
      {/* 口 (微笑み) */}
      <path d="M 32 44.5 Q 32 48 28 48 M 32 44.5 Q 32 48 36 48"
        stroke="#1A1612" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* 舌 */}
      {v.tongue && (
        <path d="M 30 47 Q 32 52 34 47 Z" fill="#F4A0B5" />
      )}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// Cat: 模様 overlay
// ─────────────────────────────────────────────────────────────
function catPattern(v: CatVisual) {
  if (!v.pattern || v.pattern === 'solid') return null
  const pc = v.patternColor ?? '#5C3818'
  switch (v.pattern) {
    case 'tabby':
      // 額の M 字 + ほっぺ縞
      return (
        <>
          <path d="M 26 16 L 28 26 M 32 14 L 32 26 M 38 16 L 36 26"
            stroke={pc} strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <path d="M 12 32 L 18 33 M 12 38 L 18 38 M 46 32 L 52 33 M 46 38 L 52 38"
            stroke={pc} strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </>
      )
    case 'tortie': {
      const c2 = v.patternColor2 ?? '#2C2620'
      return (
        <>
          <path d="M 14 32 Q 12 18 26 16 Q 26 28 22 36 Z" fill={pc} />
          <path d="M 38 14 Q 52 18 50 32 Q 44 30 38 26 Z" fill={c2} />
          <ellipse cx="20" cy="44" rx="5" ry="3" fill={c2} opacity="0.85" />
        </>
      )
    }
    case 'pointed':
      // 耳・鼻先・目周りに暗い色のポイント
      return (
        <>
          <ellipse cx="32" cy="46" rx="11" ry="7" fill={pc} opacity="0.85" />
          <ellipse cx="23" cy="32" rx="6"  ry="5" fill={pc} opacity="0.55" />
          <ellipse cx="41" cy="32" rx="6"  ry="5" fill={pc} opacity="0.55" />
        </>
      )
    case 'tuxedo': {
      const pcw = v.patternColor ?? '#FAF4EA'
      return (
        <>
          {/* 顔の下半分が白 */}
          <path d="M 14 36 Q 32 58 50 36 Q 50 58 32 62 Q 14 58 14 36 Z" fill={pcw} />
          <path d="M 28 18 Q 32 22 36 18 L 36 38 L 28 38 Z" fill={pcw} />
        </>
      )
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Cat Icon
// ─────────────────────────────────────────────────────────────
export function CatIcon({ breed, size = 48, title }: {
  breed: BreedOption
  size?: number
  title?: string
}) {
  const v = breed.cat
  if (!v) return <FallbackEmoji emoji={breed.emoji} size={size} title={title ?? breed.label} />
  const noseColor = v.noseColor ?? '#F4A0B5'
  const eyeColor = v.eyeColor ?? '#7FD171'
  const earInner = v.earInner ?? '#F4A0B5'
  return (
    <svg viewBox="0 0 64 64" width={size} height={size}
      role="img" aria-label={title ?? breed.label}>
      {title && <title>{title}</title>}
      {/* fluffy 輪郭 */}
      {v.fluffy && (
        <>
          <circle cx="12" cy="40" r="9" fill={v.faceColor} opacity="0.7" />
          <circle cx="52" cy="40" r="9" fill={v.faceColor} opacity="0.7" />
        </>
      )}
      {/* 耳 (三角・外) */}
      <path d="M 14 20 L 8 4  L 24 14 Z" fill={v.faceColor} />
      <path d="M 50 20 L 56 4 L 40 14 Z" fill={v.faceColor} />
      {/* 耳 (内側) */}
      <path d="M 16 18 L 12 8  L 22 14 Z" fill={earInner} />
      <path d="M 48 18 L 52 8  L 42 14 Z" fill={earInner} />
      {/* 顔 ベース */}
      <ellipse cx="32" cy="36" rx="22" ry="19" fill={v.faceColor} />
      {/* 模様 */}
      {catPattern(v)}
      {/* 目 (猫は縦長瞳) */}
      <ellipse cx="23" cy="33" rx="3.5" ry="4.5" fill={eyeColor} />
      <ellipse cx="41" cy="33" rx="3.5" ry="4.5" fill={eyeColor} />
      <ellipse cx="23" cy="33" rx="1.0" ry="3.8" fill="#1A1612" />
      <ellipse cx="41" cy="33" rx="1.0" ry="3.8" fill="#1A1612" />
      <circle cx="24" cy="31" r="0.9" fill="#FFFFFF" />
      <circle cx="42" cy="31" r="0.9" fill="#FFFFFF" />
      {/* 鼻 (三角) */}
      <path d="M 30 41 L 34 41 L 32 44 Z" fill={noseColor} />
      {/* 口 (W 字) */}
      <path d="M 32 44 Q 32 48 28 47 M 32 44 Q 32 48 36 47"
        stroke="#1A1612" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* ヒゲ (左右3本ずつ) */}
      <g stroke="#1A1612" strokeWidth="0.8" opacity="0.5" strokeLinecap="round">
        <path d="M 14 40 L 22 40" /><path d="M 14 43 L 22 42" /><path d="M 14 46 L 22 44" />
        <path d="M 50 40 L 42 40" /><path d="M 50 43 L 42 42" /><path d="M 50 46 L 42 44" />
      </g>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// Fallback emoji (visual 未設定の旧データ用)
// ─────────────────────────────────────────────────────────────
function FallbackEmoji({ emoji, size, title }: { emoji: string; size: number; title: string }) {
  return (
    <span title={title} role="img" aria-label={title} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, fontSize: size * 0.7,
    }}>{emoji}</span>
  )
}

// ─────────────────────────────────────────────────────────────
// 便利関数: id 指定で直接描画
// ─────────────────────────────────────────────────────────────
import { getCatBreed, getDogBreed } from './characters'

export function DogIconById({ id, size, title }: { id: string | null | undefined; size?: number; title?: string }) {
  return <DogIcon breed={getDogBreed(id)} size={size} title={title} />
}
export function CatIconById({ id, size, title }: { id: string | null | undefined; size?: number; title?: string }) {
  return <CatIcon breed={getCatBreed(id)} size={size} title={title} />
}
