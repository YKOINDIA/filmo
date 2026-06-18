import { ImageResponse } from 'next/og'
import { DIAGNOSIS_TYPES, getTypeById } from '../../../lib/diagnosis/types'

export const alt = '映画好き診断の結果'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export function generateStaticParams() {
  return DIAGNOSIS_TYPES.map(t => ({ type: t.id }))
}

/**
 * Google Fonts から指定テキスト分の日本語フォント (truetype) を取得する。
 * satori は woff2 非対応のため、ブラウザ UA を送らず ttf を受け取る。
 */
async function loadJaFont(text: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encodeURIComponent(text)}`
    const css = await (await fetch(url)).text()
    const resource = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)
    if (!resource) return null
    const res = await fetch(resource[1])
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

export default async function Image({ params }: { params: Promise<{ type: string }> }) {
  const { type: typeId } = await params
  const type = getTypeById(typeId) ?? DIAGNOSIS_TYPES[0]

  const label = 'あなたの映画タイプは'
  const brand = 'Filmo ｜ 映画好き診断'
  const glyphs = `${label}${brand}「」${type.name}${type.tagline}`

  const [bold, regular] = await Promise.all([
    loadJaFont(glyphs, 700),
    loadJaFont(glyphs, 400),
  ])

  const fonts = [
    ...(bold ? [{ name: 'NotoJP', data: bold, weight: 700 as const, style: 'normal' as const }] : []),
    ...(regular ? [{ name: 'NotoJP', data: regular, weight: 400 as const, style: 'normal' as const }] : []),
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(150deg, ${type.color}, #0a0b14)`,
          fontFamily: 'NotoJP',
          padding: 64,
          position: 'relative',
        }}
      >
        {/* アクセントの枠 */}
        <div
          style={{
            position: 'absolute',
            top: 28, left: 28, right: 28, bottom: 28,
            border: `2px solid ${type.accent}66`,
            borderRadius: 28,
            display: 'flex',
          }}
        />
        <div style={{ fontSize: 120, lineHeight: 1, marginBottom: 16, display: 'flex' }}>{type.emoji}</div>
        <div style={{ fontSize: 30, color: type.accent, fontWeight: 700, marginBottom: 18, display: 'flex' }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: '#ffffff',
            textAlign: 'center',
            lineHeight: 1.25,
            display: 'flex',
            maxWidth: 1000,
          }}
        >
          「{type.name}」
        </div>
        <div style={{ fontSize: 34, color: '#d4d4dd', marginTop: 22, textAlign: 'center', display: 'flex' }}>
          {type.tagline}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 52,
            fontSize: 26,
            color: type.accent,
            fontWeight: 700,
            display: 'flex',
          }}
        >
          {brand}
        </div>
      </div>
    ),
    {
      ...size,
      emoji: 'noto',
      ...(fonts.length ? { fonts } : {}),
    },
  )
}
