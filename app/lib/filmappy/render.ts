// ============================================
// FILMAPPY — Canvas2D renderer
// ============================================
// engine.State を canvas に描画する。画像アセット不要、プリミティブのみ。
// 劇場内部の側面図風: 赤ベルベット背景、フロアは大理石ライン、トランポリンは
// 真っ赤なレッドカーペット (バウンド数で色が褪せる)。

import {
  type State,
  type EnemyState,
  type ItemState,
  type WaveState,
  type DoorState,
  type TrampolineState,
  ENEMY_H,
  ENEMY_W,
  FLOOR_COUNT,
  FLOOR_THICKNESS,
  FLOOR_TOP_Y,
  ITEM_COLOR,
  LOGICAL_H,
  LOGICAL_W,
  PLAYER_H,
  PLAYER_W,
  TRAMP_MAX_BOUNCES,
  TRAMP_W,
  WAVE_H,
  floorYFor,
} from './engine'

export function render(
  ctx: CanvasRenderingContext2D,
  s: State,
  viewW: number,
  viewH: number,
  dpr: number,
): void {
  const scale = Math.min(viewW / LOGICAL_W, viewH / LOGICAL_H)
  const offX = (viewW - LOGICAL_W * scale) / 2
  const offY = (viewH - LOGICAL_H * scale) / 2

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, viewW, viewH)

  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offX * dpr, offY * dpr)

  drawBackground(ctx, s)
  drawTrampolines(ctx, s)
  drawFloors(ctx, s)
  drawDoors(ctx, s)
  drawItems(ctx, s)
  drawWaves(ctx, s)
  drawEnemies(ctx, s)
  drawPlayer(ctx, s)
  drawParticles(ctx, s)

  if (s.flashLife > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(s.flashLife / 200) * 0.55})`
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H)
  }

  drawHUD(ctx, s)
  drawToast(ctx, s)
  drawStageOverlay(ctx, s)
}

// ============================================
// 背景: 劇場の壁 + シーリングライト
// ============================================
function drawBackground(ctx: CanvasRenderingContext2D, s: State): void {
  const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_H)
  // ステージごとに色味を変える
  const tints: [string, string][] = [
    ['#3a0a18', '#1a0010'], // STAGE 1: 赤ベルベット
    ['#062a3a', '#04101a'], // STAGE 2: 青
    ['#2a0a3a', '#10001a'], // STAGE 3: 紫
  ]
  const [c0, c1] = tints[Math.min(s.stageIdx, tints.length - 1)]
  grad.addColorStop(0, c0)
  grad.addColorStop(1, c1)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H)

  // 上部ステージ照明 (筋)
  for (let i = 0; i < 6; i++) {
    const x = (i + 0.5) * (LOGICAL_W / 6)
    const grad2 = ctx.createRadialGradient(x, 0, 0, x, 60, 50)
    grad2.addColorStop(0, 'rgba(255,210,120,0.18)')
    grad2.addColorStop(1, 'rgba(255,210,120,0)')
    ctx.fillStyle = grad2
    ctx.fillRect(0, 0, LOGICAL_W, 80)
  }
}

// ============================================
// フロア (大理石の段)
// ============================================
function drawFloors(ctx: CanvasRenderingContext2D, s: State): void {
  // フロアが「使えるトランポリン」で穴になる x 範囲を計算
  // (壊れたトランポリンも穴のままにして、見た目で危険を示す)
  const gaps: { x1: number; x2: number }[] = []
  for (const t of s.trampolines) {
    gaps.push({ x1: t.cx - TRAMP_W / 2, x2: t.cx + TRAMP_W / 2 })
  }
  gaps.sort((a, b) => a.x1 - b.x1)

  for (let f = 0; f < FLOOR_COUNT; f++) {
    const y = floorYFor(f)
    let cursor = 0
    for (const g of gaps) {
      if (cursor < g.x1) {
        ctx.fillStyle = '#f5e6c8'
        ctx.fillRect(cursor, y, g.x1 - cursor, FLOOR_THICKNESS)
        ctx.fillStyle = 'rgba(0,0,0,0.4)'
        ctx.fillRect(cursor, y + FLOOR_THICKNESS, g.x1 - cursor, 2)
      }
      cursor = g.x2
    }
    if (cursor < LOGICAL_W) {
      ctx.fillStyle = '#f5e6c8'
      ctx.fillRect(cursor, y, LOGICAL_W - cursor, FLOOR_THICKNESS)
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillRect(cursor, y + FLOOR_THICKNESS, LOGICAL_W - cursor, 2)
    }
  }
}

// ============================================
// トランポリン (レッドカーペット)
// ============================================
function drawTrampolines(ctx: CanvasRenderingContext2D, s: State): void {
  for (const t of s.trampolines) {
    const topY = floorYFor(t.topFloor)
    const botY = floorYFor(t.bottomFloor) + FLOOR_THICKNESS
    const x = t.cx - TRAMP_W / 2

    // 縦の筒 (バックライト)
    const grad = ctx.createLinearGradient(0, topY, 0, botY)
    if (t.broken) {
      grad.addColorStop(0, 'rgba(80,80,80,0.4)')
      grad.addColorStop(1, 'rgba(40,40,40,0.4)')
    } else {
      grad.addColorStop(0, 'rgba(255,210,120,0.10)')
      grad.addColorStop(1, 'rgba(255,210,120,0.04)')
    }
    ctx.fillStyle = grad
    ctx.fillRect(x, topY, TRAMP_W, botY - topY)

    // 各フロア交点にカーペット (バウンド数で色変化)
    for (let f = t.topFloor; f <= t.bottomFloor; f++) {
      const fy = floorYFor(f)
      drawTrampStrip(ctx, x, fy, t)
    }
  }
}

function drawTrampStrip(ctx: CanvasRenderingContext2D, x: number, y: number, t: TrampolineState): void {
  // バウンド残量に応じて色を変える
  const ratio = t.broken ? 1 : t.bounces / TRAMP_MAX_BOUNCES
  const colors = ['#ff3030', '#ff5046', '#ff7060', '#ffae40', '#888'] // 0→3+broken
  const idx = t.broken ? 4 : Math.min(3, Math.floor(ratio * 3 + 0.5))
  ctx.fillStyle = colors[idx]
  // 短いストリップ (床と同じ高さに重ねる)
  ctx.fillRect(x + 1, y - 2, TRAMP_W - 2, 4)
  if (!t.broken) {
    // 縁取り
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.fillRect(x + 2, y - 2, TRAMP_W - 4, 1)
  } else {
    // 破壊状態: 穴っぽさを強調
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(x + 2, y - 1, TRAMP_W - 4, 3)
  }
}

// ============================================
// ドア
// ============================================
function drawDoors(ctx: CanvasRenderingContext2D, s: State): void {
  for (const d of s.doors) {
    const y = floorYFor(d.floorIdx) - 20
    const ready = s.totalTimeMs >= d.cooldownUntil
    drawDoor(ctx, d, y, ready)
  }
}

function drawDoor(ctx: CanvasRenderingContext2D, d: DoorState, y: number, ready: boolean): void {
  const w = 8
  const h = 20
  const x = d.side === 'left' ? 2 : LOGICAL_W - 2 - w
  ctx.fillStyle = ready ? '#caa044' : '#6a5028'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = ready ? '#fff8d0' : '#aaaaaa'
  ctx.fillRect(x + 1, y + 1, w - 2, 1)
  // ノブ
  ctx.fillStyle = '#ffd24a'
  ctx.fillRect(d.side === 'left' ? x + w - 2 : x, y + h / 2, 2, 2)
}

// ============================================
// アイテム
// ============================================
function drawItems(ctx: CanvasRenderingContext2D, s: State): void {
  for (const it of s.items) {
    if (it.collected) continue
    drawItem(ctx, it, s)
  }
}

function drawItem(ctx: CanvasRenderingContext2D, it: ItemState, s: State): void {
  const x = it.x
  const y = it.y + Math.sin((s.totalTimeMs + it.id * 200) / 300) * 1.5
  // 後光
  ctx.fillStyle = `${ITEM_COLOR[it.kind]}55`
  ctx.beginPath()
  ctx.arc(x, y, 10, 0, Math.PI * 2)
  ctx.fill()
  // 本体: kind ごとに記号
  ctx.fillStyle = ITEM_COLOR[it.kind]
  switch (it.kind) {
    case 'reel':
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#222'
      ctx.beginPath()
      ctx.arc(x, y, 1.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x - 3, y, 1.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + 3, y, 1.2, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'popcorn':
      ctx.fillStyle = '#cc2533'
      ctx.fillRect(x - 5, y - 4, 10, 8)
      ctx.fillStyle = '#fff1a8'
      ctx.fillRect(x - 5, y - 6, 10, 3)
      ctx.fillStyle = '#fff'
      ctx.fillRect(x - 4, y - 7, 3, 2)
      ctx.fillRect(x + 1, y - 7, 3, 2)
      break
    case 'poster':
      ctx.fillRect(x - 5, y - 5, 10, 10)
      ctx.fillStyle = '#222'
      ctx.fillRect(x - 3, y - 3, 6, 1)
      ctx.fillRect(x - 3, y - 1, 6, 1)
      ctx.fillRect(x - 3, y + 1, 4, 1)
      break
    case 'oscar':
      // 立像
      ctx.fillRect(x - 1, y - 6, 3, 8)
      ctx.beginPath()
      ctx.arc(x, y - 7, 2.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(x - 3, y + 2, 7, 2)
      break
    case 'ticket':
      ctx.fillRect(x - 6, y - 3, 12, 6)
      ctx.fillStyle = '#003a4a'
      ctx.fillRect(x - 5, y - 2, 10, 1)
      ctx.fillRect(x - 5, y, 6, 1)
      break
  }
}

// ============================================
// 波
// ============================================
function drawWaves(ctx: CanvasRenderingContext2D, s: State): void {
  for (const w of s.waves) {
    drawWave(ctx, w, s.totalTimeMs)
  }
}

function drawWave(ctx: CanvasRenderingContext2D, w: WaveState, now: number): void {
  // 同心円的な縞
  const w0 = 24
  const t = (now / 60) % 1
  // 本体: 半透明の薄い帯
  ctx.fillStyle = 'rgba(108,242,255,0.35)'
  ctx.fillRect(w.x, w.y, w0, WAVE_H)
  // ジグザグ装飾
  ctx.fillStyle = 'rgba(108,242,255,0.85)'
  for (let i = 0; i < 4; i++) {
    const ox = (i * 6 + t * 6) % w0
    ctx.fillRect(w.x + ox, w.y + 4, 2, WAVE_H - 8)
  }
}

// ============================================
// 敵
// ============================================
function drawEnemies(ctx: CanvasRenderingContext2D, s: State): void {
  for (const e of s.enemies) {
    if (e.mode === 'gone') continue
    drawEnemy(ctx, e, s)
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: EnemyState, s: State): void {
  const stunned = e.mode === 'stunned'
  // ベース色
  const bodyColor = e.kind === 'spoiler'
    ? (stunned ? '#5a4d8a' : '#9c64ff')
    : (stunned ? '#5a4040' : '#ff5a64')

  // 体
  ctx.fillStyle = bodyColor
  ctx.fillRect(e.x, e.y + 4, ENEMY_W, ENEMY_H - 4)
  // 帽子 / カチンコ
  if (e.kind === 'spoiler') {
    // 「!」マーク的ネタバレ怪人
    ctx.fillStyle = '#fff'
    ctx.fillRect(e.x + ENEMY_W / 2 - 1, e.y + 7, 2, 5)
    ctx.fillRect(e.x + ENEMY_W / 2 - 1, e.y + 14, 2, 2)
  } else {
    // 海賊版業者: 黒帽子
    ctx.fillStyle = '#222'
    ctx.fillRect(e.x + 1, e.y + 2, ENEMY_W - 2, 4)
    ctx.fillStyle = '#ffd24a'
    ctx.fillRect(e.x + ENEMY_W / 2 - 2, e.y + 3, 4, 1)
  }
  // 顔
  ctx.fillStyle = '#fff'
  const eyeOffset = e.facing === 'left' ? -2 : 2
  ctx.fillRect(e.x + ENEMY_W / 2 + eyeOffset - 1, e.y + 9, 2, 2)
  // スタン: 星マーク回転
  if (stunned) {
    const t = s.totalTimeMs / 200
    ctx.fillStyle = '#ffd24a'
    for (let i = 0; i < 3; i++) {
      const a = t + (i * Math.PI * 2) / 3
      const px = e.x + ENEMY_W / 2 + Math.cos(a) * 8
      const py = e.y - 4 + Math.sin(a) * 3
      ctx.fillRect(Math.round(px), Math.round(py), 2, 2)
    }
  }
}

// ============================================
// プレイヤー (フィルム警官マピオ)
// ============================================
function drawPlayer(ctx: CanvasRenderingContext2D, s: State): void {
  const p = s.player
  if (!p.alive) return
  const blink = s.totalTimeMs < p.invincibleUntil
    && Math.floor(s.totalTimeMs / 80) % 2 === 0
  if (blink) return

  // 体: 青の警官制服
  ctx.fillStyle = '#1d6bff'
  ctx.fillRect(p.x + 2, p.y + 8, PLAYER_W - 4, PLAYER_H - 8)
  // 帽子 (警官帽)
  ctx.fillStyle = '#1240a0'
  ctx.fillRect(p.x + 1, p.y + 1, PLAYER_W - 2, 4)
  ctx.fillStyle = '#ffd24a'
  // バッジ
  ctx.fillRect(p.x + PLAYER_W / 2 - 1, p.y + 2, 2, 2)
  // 顔
  ctx.fillStyle = '#ffdfb2'
  ctx.fillRect(p.x + 3, p.y + 5, PLAYER_W - 6, 4)
  // 目
  ctx.fillStyle = '#000'
  if (p.facing === 'right') {
    ctx.fillRect(p.x + PLAYER_W - 5, p.y + 6, 2, 2)
  } else {
    ctx.fillRect(p.x + 3, p.y + 6, 2, 2)
  }
  // 足
  ctx.fillStyle = '#222'
  ctx.fillRect(p.x + 2, p.y + PLAYER_H - 2, 4, 2)
  ctx.fillRect(p.x + PLAYER_W - 6, p.y + PLAYER_H - 2, 4, 2)

  // バウンド中はちょっと押しつぶす演出
  if (p.mode === 'bounce') {
    ctx.fillStyle = 'rgba(255,255,255,0.20)'
    ctx.fillRect(p.x - 1, p.y - 1, PLAYER_W + 2, 2)
  }
}

// ============================================
// パーティクル
// ============================================
function drawParticles(ctx: CanvasRenderingContext2D, s: State): void {
  for (const p of s.particles) {
    const alpha = Math.max(0, p.life / p.maxLife)
    ctx.fillStyle = withAlpha(p.color, alpha)
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
}

function withAlpha(color: string, alpha: number): string {
  // #rgb or #rrggbb → rgba()
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    let r = 0, g = 0, b = 0
    if (color.length === 7) {
      r = parseInt(color.slice(1, 3), 16)
      g = parseInt(color.slice(3, 5), 16)
      b = parseInt(color.slice(5, 7), 16)
    } else {
      r = parseInt(color[1] + color[1], 16)
      g = parseInt(color[2] + color[2], 16)
      b = parseInt(color[3] + color[3], 16)
    }
    return `rgba(${r},${g},${b},${alpha})`
  }
  return color
}

// ============================================
// HUD
// ============================================
function drawHUD(ctx: CanvasRenderingContext2D, s: State): void {
  // 上部の黒帯
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, 0, LOGICAL_W, FLOOR_TOP_Y - 4)

  // SCORE
  ctx.fillStyle = '#ffd24a'
  ctx.font = 'bold 11px monospace'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillText('SCORE', 6, 4)
  ctx.fillStyle = '#fff'
  ctx.fillText(s.score.toString().padStart(7, '0'), 6, 16)

  // STAGE
  ctx.fillStyle = '#6cf2ff'
  ctx.textAlign = 'center'
  ctx.fillText(`STAGE ${s.stageIdx + 1}`, LOGICAL_W / 2, 4)
  ctx.fillStyle = '#fff'
  ctx.fillText(`${s.itemsCollected}/${s.items.length}`, LOGICAL_W / 2, 16)

  // ライフ
  ctx.fillStyle = '#ff7aa6'
  ctx.textAlign = 'right'
  ctx.fillText('LIVES', LOGICAL_W - 6, 4)
  ctx.textAlign = 'right'
  for (let i = 0; i < s.lives; i++) {
    drawLifeIcon(ctx, LOGICAL_W - 6 - i * 10, 18)
  }

  // 時間バー
  const barX = 80
  const barW = LOGICAL_W - 160
  const barY = 28
  ctx.fillStyle = 'rgba(255,255,255,0.10)'
  ctx.fillRect(barX, barY, barW, 3)
  const ratio = Math.max(0, Math.min(1, s.timeLeftMs / 90_000))
  ctx.fillStyle = ratio > 0.3 ? '#6cf2ff' : '#ff6188'
  ctx.fillRect(barX, barY, barW * ratio, 3)

  // コンボ表示
  if (s.comboCount >= 2 && s.lastItemKind) {
    ctx.fillStyle = '#ffd24a'
    ctx.textAlign = 'left'
    ctx.font = 'bold 10px monospace'
    ctx.fillText(`COMBO ×${s.comboCount}`, 6, 30)
  }
}

function drawLifeIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // 小さなマピオの頭アイコン
  ctx.fillStyle = '#1240a0'
  ctx.fillRect(x - 6, y, 6, 2)
  ctx.fillStyle = '#ffdfb2'
  ctx.fillRect(x - 6, y + 2, 6, 4)
  ctx.fillStyle = '#000'
  ctx.fillRect(x - 2, y + 3, 1, 1)
}

// ============================================
// トースト (短時間の通知)
// ============================================
function drawToast(ctx: CanvasRenderingContext2D, s: State): void {
  if (!s.toast) return
  const t = (s.toast.until - s.totalTimeMs) / 1400
  const alpha = Math.max(0, Math.min(1, t * 1.5))
  ctx.fillStyle = `rgba(0,0,0,${0.7 * alpha})`
  ctx.font = 'bold 12px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const tw = ctx.measureText(s.toast.text).width + 16
  const tx = LOGICAL_W / 2 - tw / 2
  const ty = LOGICAL_H - 30
  ctx.fillRect(tx, ty - 8, tw, 18)
  ctx.fillStyle = `rgba(255,210,74,${alpha})`
  ctx.fillText(s.toast.text, LOGICAL_W / 2, ty + 1)
}

// ============================================
// ステージクリア大バナー
// ============================================
function drawStageOverlay(ctx: CanvasRenderingContext2D, s: State): void {
  if (s.mode !== 'stage-cleared') return
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, LOGICAL_H / 2 - 30, LOGICAL_W, 60)
  ctx.fillStyle = '#ffd24a'
  ctx.font = 'bold 20px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const text = s.stageIdx >= 2 ? '★ ALL CLEAR ★' : 'STAGE CLEAR!'
  ctx.fillText(text, LOGICAL_W / 2, LOGICAL_H / 2)
}

