'use client'

import { useState, useEffect, useRef } from 'react'
import { addPoints, POINT_CONFIG } from '../lib/points'

const W = 1080
const H = 1080
const TMDB_IMG = 'https://image.tmdb.org/t/p'

// ── Canvas helpers ─────────────────────────────────────────────────────────

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function fillTextWrapped(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  maxWidth: number, lineHeight: number, maxLines = 99,
): number {
  const chars = Array.from(text)
  let line = '', curY = y, lineNum = 1
  for (const ch of chars) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      if (lineNum >= maxLines) {
        ctx.fillText(line.slice(0, -1) + '…', x, curY)
        return curY
      }
      ctx.fillText(line, x, curY)
      line = ch; curY += lineHeight; lineNum++
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, curY)
  return curY
}

function drawStars(ctx: CanvasRenderingContext2D, score: number, cx: number, cy: number, size: number) {
  for (let i = 1; i <= 5; i++) {
    const x = cx + (i - 3) * (size + 8)
    const full = score >= i
    const half = !full && score >= i - 0.5
    ctx.font = `${size}px system-ui, -apple-system, sans-serif`
    ctx.fillStyle = (full || half) ? '#f0c040' : '#333'
    ctx.fillText('★', x, cy)
    if (half) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(x - size / 2, cy - size, size / 2, size * 2)
      ctx.clip()
      ctx.fillStyle = '#f0c040'
      ctx.fillText('★', x, cy)
      ctx.restore()
    }
  }
}

// ── Load image helper ──────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// ── Mark! Review Card ──────────────────────────────────────────────────────

async function drawMarkCard(
  ctx: CanvasRenderingContext2D,
  data: { title: string; posterPath: string | null; score: number; reviewBody: string; comment: string },
) {
  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#07090f'); bg.addColorStop(0.5, '#0d1020'); bg.addColorStop(1, '#07090f')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  // Subtle grid
  ctx.strokeStyle = '#ffffff04'; ctx.lineWidth = 1
  for (let i = 0; i < W; i += 80) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke() }
  for (let i = 0; i < H; i += 80) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke() }

  // Accent border
  const bd = ctx.createLinearGradient(0, 0, W, H)
  bd.addColorStop(0, '#e91e63'); bd.addColorStop(0.5, '#f0c040'); bd.addColorStop(1, '#e91e63')
  ctx.strokeStyle = bd; ctx.lineWidth = 6; ctx.strokeRect(24, 24, W - 48, H - 48)
  ctx.fillStyle = bd; ctx.fillRect(24, 24, W - 48, 8)

  // Logo
  ctx.font = 'bold 60px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = '#e91e63'; ctx.textAlign = 'center'
  ctx.fillText('🎬  Filmo', W / 2, 108)

  // "Watched" badge
  rr(ctx, W / 2 - 160, 130, 320, 64, 32)
  const badge = ctx.createLinearGradient(W / 2 - 160, 0, W / 2 + 160, 0)
  badge.addColorStop(0, '#4a0e2e'); badge.addColorStop(0.5, '#e91e63'); badge.addColorStop(1, '#4a0e2e')
  ctx.fillStyle = badge; ctx.fill()
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif'; ctx.fillStyle = 'white'
  ctx.fillText('✓  Watched', W / 2, 174)

  // Poster
  let posterY = 220
  if (data.posterPath) {
    try {
      const img = await loadImage(`${TMDB_IMG}/w342${data.posterPath}`)
      const pw = 240, ph = 360
      const px = W / 2 - pw / 2
      // Dark rounded rect behind poster
      rr(ctx, px - 4, posterY - 4, pw + 8, ph + 8, 16)
      ctx.fillStyle = '#1a1a2e'; ctx.fill()
      ctx.save()
      rr(ctx, px, posterY, pw, ph, 12); ctx.clip()
      ctx.drawImage(img, px, posterY, pw, ph)
      ctx.restore()
    } catch { /* poster load failed, skip */ }
  }
  posterY += 376

  // Title
  ctx.font = 'bold 44px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = 'white'; ctx.textAlign = 'center'
  const titleText = data.title.length > 20 ? data.title.slice(0, 20) + '…' : data.title
  ctx.fillText(titleText, W / 2, posterY + 10)

  // Stars
  if (data.score > 0) {
    ctx.textAlign = 'center'
    drawStars(ctx, data.score, W / 2, posterY + 64, 40)
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#f0c040'; ctx.textAlign = 'center'
    ctx.fillText(data.score.toFixed(1), W / 2 + 160, posterY + 64)
  }

  // Review body (truncated)
  if (data.reviewBody.trim()) {
    ctx.strokeStyle = '#e91e6330'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(80, posterY + 92); ctx.lineTo(W - 80, posterY + 92); ctx.stroke()

    ctx.font = '30px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#ccc'; ctx.textAlign = 'left'
    fillTextWrapped(ctx, data.reviewBody, 80, posterY + 132, W - 160, 40, 3)
  }

  // Comment
  const commentY = posterY + 260
  if (data.comment.trim()) {
    rr(ctx, 54, commentY, W - 108, 64, 12); ctx.fillStyle = '#0e1428'; ctx.fill()
    ctx.strokeStyle = '#e91e6340'; ctx.lineWidth = 1; ctx.stroke()
    ctx.font = '28px system-ui, -apple-system, sans-serif'; ctx.fillStyle = '#e91e63'; ctx.textAlign = 'left'
    ctx.fillText('💬', 72, commentY + 42)
    ctx.fillStyle = '#ddd'
    fillTextWrapped(ctx, data.comment.trim(), 112, commentY + 42, W - 180, 34, 1)
    ctx.textAlign = 'center'
  }

  // Footer
  ctx.strokeStyle = '#e91e6328'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(60, H - 108); ctx.lineTo(W - 60, H - 108); ctx.stroke()
  ctx.font = '28px system-ui, -apple-system, sans-serif'; ctx.fillStyle = '#4fc3f7'; ctx.textAlign = 'center'
  ctx.fillText('#映画レビュー  #Filmo  #Mark', W / 2, H - 64)
  ctx.font = '20px system-ui, -apple-system, sans-serif'; ctx.fillStyle = '#444'
  ctx.fillText('filmo.me', W / 2, H - 30)
}

// ── Clip! Expectation Card ─────────────────────────────────────────────────

async function drawClipCard(
  ctx: CanvasRenderingContext2D,
  data: { title: string; posterPath: string | null; score: number; memo: string; comment: string },
) {
  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#050312'); bg.addColorStop(0.5, '#0a0820'); bg.addColorStop(1, '#050312')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  // Star particles
  ctx.fillStyle = '#ffffff07'
  for (let i = 0; i < 120; i++) {
    const px = (i * 173 + 40) % W, py = (i * 97 + 80) % H, r = (i % 3) + 1
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()
  }

  // Border
  const bd = ctx.createLinearGradient(0, 0, W, H)
  bd.addColorStop(0, '#3498db'); bd.addColorStop(0.5, '#2ecc8a'); bd.addColorStop(1, '#3498db')
  ctx.strokeStyle = bd; ctx.lineWidth = 6; ctx.strokeRect(24, 24, W - 48, H - 48)
  ctx.fillStyle = bd; ctx.fillRect(24, 24, W - 48, 8)

  // Logo
  ctx.font = 'bold 60px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = '#3498db'; ctx.textAlign = 'center'
  ctx.fillText('🎬  Filmo', W / 2, 108)

  // "Watchlist" badge
  rr(ctx, W / 2 - 160, 130, 320, 64, 32)
  const badge = ctx.createLinearGradient(W / 2 - 160, 0, W / 2 + 160, 0)
  badge.addColorStop(0, '#0e2a3d'); badge.addColorStop(0.5, '#3498db'); badge.addColorStop(1, '#0e2a3d')
  ctx.fillStyle = badge; ctx.fill()
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif'; ctx.fillStyle = 'white'
  ctx.fillText('📌  Watchlist', W / 2, 174)

  // Poster
  let posterY = 220
  if (data.posterPath) {
    try {
      const img = await loadImage(`${TMDB_IMG}/w342${data.posterPath}`)
      const pw = 240, ph = 360
      const px = W / 2 - pw / 2
      rr(ctx, px - 4, posterY - 4, pw + 8, ph + 8, 16)
      ctx.fillStyle = '#1a1a2e'; ctx.fill()
      ctx.save()
      rr(ctx, px, posterY, pw, ph, 12); ctx.clip()
      ctx.drawImage(img, px, posterY, pw, ph)
      ctx.restore()
    } catch { /* skip */ }
  }
  posterY += 376

  // Title
  ctx.font = 'bold 44px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = 'white'; ctx.textAlign = 'center'
  const titleText = data.title.length > 20 ? data.title.slice(0, 20) + '…' : data.title
  ctx.fillText(titleText, W / 2, posterY + 10)

  // Expectation stars
  if (data.score > 0) {
    ctx.textAlign = 'center'
    drawStars(ctx, data.score, W / 2, posterY + 64, 40)
    ctx.font = '30px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#888'; ctx.textAlign = 'center'
    ctx.fillText('期待度', W / 2 + 160, posterY + 64)
  }

  // Memo
  if (data.memo.trim()) {
    ctx.strokeStyle = '#3498db30'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(80, posterY + 92); ctx.lineTo(W - 80, posterY + 92); ctx.stroke()

    ctx.font = '28px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#2ecc8a'; ctx.textAlign = 'left'
    ctx.fillText('🎯 Watchlistの理由', 80, posterY + 130)

    ctx.font = '30px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#ccc'
    fillTextWrapped(ctx, data.memo, 80, posterY + 172, W - 160, 40, 3)
  }

  // Comment
  const commentY = posterY + 290
  if (data.comment.trim()) {
    rr(ctx, 54, commentY, W - 108, 64, 12); ctx.fillStyle = '#0e1428'; ctx.fill()
    ctx.strokeStyle = '#3498db40'; ctx.lineWidth = 1; ctx.stroke()
    ctx.font = '28px system-ui, -apple-system, sans-serif'; ctx.fillStyle = '#3498db'; ctx.textAlign = 'left'
    ctx.fillText('💬', 72, commentY + 42)
    ctx.fillStyle = '#ddd'
    fillTextWrapped(ctx, data.comment.trim(), 112, commentY + 42, W - 180, 34, 1)
    ctx.textAlign = 'center'
  }

  // Footer
  ctx.strokeStyle = '#3498db28'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(60, H - 108); ctx.lineTo(W - 60, H - 108); ctx.stroke()
  ctx.font = '28px system-ui, -apple-system, sans-serif'; ctx.fillStyle = '#4fc3f7'; ctx.textAlign = 'center'
  ctx.fillText('#Watchlist  #Filmo', W / 2, H - 64)
  ctx.font = '20px system-ui, -apple-system, sans-serif'; ctx.fillStyle = '#444'
  ctx.fillText('filmo.me', W / 2, H - 30)
}

// ── Level Up Card ──────────────────────────────────────────────────────────

function drawLevelUpCard(
  ctx: CanvasRenderingContext2D,
  data: { level: number; title: string; color: string; totalPoints: number },
  comment: string,
) {
  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#05030f'); bg.addColorStop(0.4, '#0d0820'); bg.addColorStop(1, '#05030f')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  // Radial glow
  const glow = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 520)
  glow.addColorStop(0, 'rgba(233,30,99,0.12)')
  glow.addColorStop(0.5, 'rgba(155,89,182,0.06)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)

  // Star particles
  ctx.fillStyle = '#ffffff09'
  for (let i = 0; i < 160; i++) {
    const px = (i * 211 + 37) % W, py = (i * 113 + 61) % H, r = (i % 3) + 1
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()
  }

  // Border
  const bd = ctx.createLinearGradient(0, 0, W, H)
  bd.addColorStop(0, '#9b59b6'); bd.addColorStop(0.3, '#e91e63'); bd.addColorStop(0.7, '#e91e63'); bd.addColorStop(1, '#9b59b6')
  ctx.strokeStyle = bd; ctx.lineWidth = 8; ctx.strokeRect(24, 24, W - 48, H - 48)
  ctx.fillStyle = bd; ctx.fillRect(24, 24, W - 48, 8)

  // Logo
  ctx.font = 'bold 68px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = '#e91e63'; ctx.textAlign = 'center'
  ctx.fillText('🎬  Filmo', W / 2, 118)

  ctx.strokeStyle = '#e91e6330'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(80, 144); ctx.lineTo(W - 80, 144); ctx.stroke()

  // LEVEL UP! banner
  rr(ctx, W / 2 - 340, 164, 680, 96, 48)
  const bannerGrad = ctx.createLinearGradient(W / 2 - 340, 0, W / 2 + 340, 0)
  bannerGrad.addColorStop(0, '#3d1a6e'); bannerGrad.addColorStop(0.5, '#7d3cc8'); bannerGrad.addColorStop(1, '#3d1a6e')
  ctx.fillStyle = bannerGrad; ctx.fill()
  ctx.strokeStyle = '#e91e6366'; ctx.lineWidth = 1; ctx.stroke()
  ctx.font = 'bold 56px system-ui, -apple-system, sans-serif'; ctx.fillStyle = 'white'
  ctx.fillText('🎉  LEVEL UP!', W / 2, 228)

  // Level number
  ctx.font = 'bold 220px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = '#e91e63'
  ctx.shadowColor = '#e91e63'; ctx.shadowBlur = 60
  ctx.fillText(`${data.level}`, W / 2, 560)
  ctx.shadowBlur = 0

  ctx.font = '38px system-ui, -apple-system, sans-serif'; ctx.fillStyle = '#888'
  ctx.fillText('LEVEL', W / 2, 600)

  // Title badge
  const titleColor = data.color || '#e91e63'
  rr(ctx, W / 2 - 360, 632, 720, 88, 44)
  const titleBg = ctx.createLinearGradient(W / 2 - 360, 0, W / 2 + 360, 0)
  titleBg.addColorStop(0, '#1a1a0a'); titleBg.addColorStop(0.5, '#2a2010'); titleBg.addColorStop(1, '#1a1a0a')
  ctx.fillStyle = titleBg; ctx.fill()
  ctx.strokeStyle = titleColor + '88'; ctx.lineWidth = 2; ctx.stroke()
  ctx.font = 'bold 52px system-ui, -apple-system, sans-serif'; ctx.fillStyle = titleColor
  ctx.fillText(`🎬  ${data.title}`, W / 2, 694)

  // Total points
  ctx.font = '34px system-ui, -apple-system, sans-serif'; ctx.fillStyle = '#666'
  ctx.fillText(`累計 ${(data.totalPoints || 0).toLocaleString()} pt`, W / 2, 768)

  // Comment
  if (comment && comment.trim().length > 0) {
    rr(ctx, 60, 800, W - 120, 72, 12); ctx.fillStyle = '#0e1020'; ctx.fill()
    ctx.strokeStyle = '#e91e6340'; ctx.lineWidth = 1; ctx.stroke()
    ctx.font = '32px system-ui, -apple-system, sans-serif'; ctx.fillStyle = '#e91e63'; ctx.textAlign = 'left'
    ctx.fillText('💬', 78, 848)
    ctx.fillStyle = '#ddd'
    fillTextWrapped(ctx, comment.trim(), 126, 848, W - 200, 36)
    ctx.textAlign = 'center'
  }

  // Footer
  ctx.strokeStyle = '#e91e6328'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(60, H - 128); ctx.lineTo(W - 60, H - 128); ctx.stroke()
  ctx.font = '30px system-ui, -apple-system, sans-serif'; ctx.fillStyle = '#4fc3f7'
  ctx.fillText('#映画好き  #Filmo  #レベルアップ', W / 2, H - 78)
  ctx.font = '22px system-ui, -apple-system, sans-serif'; ctx.fillStyle = '#444'
  ctx.fillText('filmo.me', W / 2, H - 38)
}

// ── Share text builders ────────────────────────────────────────────────────

function buildShareText(type: CardType, data: ShareCardData): string {
  if (type === 'mark') {
    const d = data as MarkData
    const stars = d.score > 0 ? ' ' + '★'.repeat(Math.round(d.score)) : ''
    return `「${d.title}」を観ました！${stars}\n#Watched #Filmo`
  }
  if (type === 'clip') {
    const d = data as ClipData
    return `「${d.title}」が気になる！\n#Watchlist #Filmo`
  }
  // level_up
  const d = data as LevelUpData
  return `Filmoでレベル${d.level}「${d.title}」に昇格しました！\n#映画好き #Filmo #レベルアップ`
}

function buildXIntentUrl(text: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`
}

// ── Types ──────────────────────────────────────────────────────────────────

type CardType = 'mark' | 'clip' | 'level_up'

interface MarkData {
  title: string; posterPath: string | null; score: number; reviewBody: string
}
interface ClipData {
  title: string; posterPath: string | null; score: number; memo: string
}
interface LevelUpData {
  level: number; title: string; color: string; totalPoints: number
}

type ShareCardData = MarkData | ClipData | LevelUpData

interface Props {
  type: CardType
  data: ShareCardData
  userId: string
  onClose: () => void
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function ShareCard({ type, data, userId, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imgUrl, setImgUrl] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shared, setShared] = useState(false)
  const [comment, setComment] = useState('')
  const [drawing, setDrawing] = useState(true)

  // Draw card on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    setDrawing(true)

    const draw = async () => {
      if (type === 'mark') {
        const d = data as MarkData
        await drawMarkCard(ctx, { ...d, comment })
      } else if (type === 'clip') {
        const d = data as ClipData
        await drawClipCard(ctx, { ...d, comment })
      } else {
        drawLevelUpCard(ctx, data as LevelUpData, comment)
      }
      setImgUrl(canvas.toDataURL('image/png'))
      setDrawing(false)
    }
    draw()
  }, [type, data, comment])

  const awardSharePoints = async () => {
    if (shared) return
    setShared(true)
    try { await addPoints(userId, POINT_CONFIG.REVIEW_SHORT, 'シェアボーナス') } catch {}
  }

  const handleDownload = async () => {
    if (!imgUrl) return
    const a = document.createElement('a')
    a.href = imgUrl
    a.download = `filmo_${type}_${Date.now()}.png`
    a.click()
    await awardSharePoints()
  }

  const handleShareNative = async () => {
    if (!imgUrl || sharing) return
    setSharing(true)
    try {
      const blob = await (await fetch(imgUrl)).blob()
      const file = new File([blob], `filmo_${type}.png`, { type: 'image/png' })
      const text = buildShareText(type, data)

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text })
        await awardSharePoints()
      } else {
        await handleDownload()
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') await handleDownload()
    }
    setSharing(false)
  }

  const handleShareX = async () => {
    const text = buildShareText(type, data)
    window.open(buildXIntentUrl(text), '_blank', 'noopener,noreferrer')
    // Also trigger download so user can attach the image manually
    await handleDownload()
  }

  const cardLabel = type === 'mark' ? '✓ Watched カード' : type === 'clip' ? '📌 Watchlist カード' : '🎉 レベルアップカード'
  const accentColor = type === 'mark' ? '#e91e63' : type === 'clip' ? '#3498db' : '#9b59b6'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', zIndex: 9000, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1a2e', borderRadius: 20, padding: 16,
          maxWidth: 400, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ color: accentColor, fontWeight: 'bold', fontSize: 15, margin: 0 }}>{cardLabel}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {/* Comment input */}
        <div style={{ marginBottom: 10 }}>
          <p style={{ color: '#888', fontSize: 12, margin: '0 0 4px' }}>💬 一言（カードに表示されます）</p>
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="例: 最高の映画体験でした！"
            maxLength={60}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              border: '1px solid #333', background: '#07090f', color: 'white',
              boxSizing: 'border-box', fontSize: 13,
            }}
          />
          <p style={{ color: '#444', fontSize: 10, margin: '2px 0 0', textAlign: 'right' }}>{comment.length}/60</p>
        </div>

        {/* Hidden canvas + Preview */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {imgUrl && !drawing && (
          <img src={imgUrl} alt="share card" style={{ width: '100%', borderRadius: 12, marginBottom: 12, display: 'block' }} />
        )}
        {drawing && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: '#888' }}>生成中...</div>
        )}

        {/* Share bonus message */}
        {shared && (
          <div style={{ background: '#0d2a1a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, textAlign: 'center' }}>
            <p style={{ color: '#2ecc8a', fontSize: 13, margin: 0 }}>
              ✅ シェアボーナス +{POINT_CONFIG.REVIEW_SHORT}pt 獲得！
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <button
            onClick={handleShareX}
            disabled={!imgUrl || sharing}
            style={{
              flex: 2, padding: 13, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: imgUrl ? '#000' : '#333', color: imgUrl ? '#fff' : '#888',
              fontWeight: 'bold', fontSize: 14, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 16 }}>𝕏</span> ポストする
          </button>
          <button
            onClick={handleShareNative}
            disabled={!imgUrl || sharing}
            style={{
              flex: 1, padding: 13, borderRadius: 10, border: `1px solid ${accentColor}44`,
              background: 'transparent', color: accentColor, fontSize: 13, cursor: 'pointer',
            }}
          >
            {sharing ? '...' : '📤 シェア'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleDownload}
            disabled={!imgUrl}
            style={{
              flex: 1, padding: 10, borderRadius: 10, border: '1px solid #333',
              background: 'transparent', color: '#aaa', fontSize: 13, cursor: 'pointer',
            }}
          >
            📥 画像を保存
          </button>
        </div>
        <p style={{ color: '#555', fontSize: 11, textAlign: 'center', margin: '8px 0 0' }}>
          シェアまたは保存で +{POINT_CONFIG.REVIEW_SHORT}pt（1回のみ）
        </p>
      </div>
    </div>
  )
}
