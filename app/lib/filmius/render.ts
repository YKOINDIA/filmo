// ============================================
// FILMIUS — Canvas2D renderer
// ============================================
// engine.State を canvas に描画する。画像アセットは一切使わず、
// プリミティブ (rect, polygon, arc, line) だけで構成する。

import {
  type State,
  type Enemy,
  GAUGE_SLOTS,
  LASER_LEN,
  LOGICAL_H,
  LOGICAL_W,
  OPTION_TRAIL_GAP,
  PLAYER_H,
  PLAYER_W,
  SHIPS,
} from './engine'
import { STAGES } from './stages'
const COLOR_OPTION = '#ffd24a'

export function render(ctx: CanvasRenderingContext2D, s: State, viewW: number, viewH: number, dpr: number) {
  // ロジカル -> ビューのスケール
  const scale = Math.min(viewW / LOGICAL_W, viewH / LOGICAL_H)
  const offX = (viewW - LOGICAL_W * scale) / 2
  const offY = (viewH - LOGICAL_H * scale) / 2

  // 全面クリア (レターボックス込み)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, viewW, viewH)

  // ロジカル座標系へ
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offX * dpr, offY * dpr)

  // 背景: 縦グラデ + 星
  drawBackground(ctx, s)

  // パーティクル (背景側に先に描く)
  drawParticles(ctx, s)

  // カプセル
  drawCapsules(ctx, s)

  // 敵弾
  drawEnemyBullets(ctx, s)

  // 自機弾
  drawPlayerBullets(ctx, s)

  // 敵
  for (const e of s.enemies) drawEnemy(ctx, s, e)

  // Option (SEQUEL) — 自機の前に描いてもいい
  drawOptions(ctx, s)

  // 自機
  if (s.player.alive) drawPlayer(ctx, s)

  // 被弾フラッシュ
  if (s.flashLife > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(s.flashLife / 200) * 0.55})`
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H)
  }

  // HUD
  drawHUD(ctx, s)
}

function drawBackground(ctx: CanvasRenderingContext2D, s: State) {
  const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_H)
  grad.addColorStop(0, '#080026')
  grad.addColorStop(1, '#16003a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H)

  // 遠景: 大きな星雲 (ステージごとに色味を変える)
  const tints = ['rgba(255,90,160,0.05)', 'rgba(120,180,255,0.06)', 'rgba(255,210,120,0.06)']
  ctx.fillStyle = tints[s.stageIdx] ?? tints[0]
  ctx.beginPath()
  ctx.ellipse(
    (LOGICAL_W * 0.7 - s.bgScroll * 0.05) % (LOGICAL_W * 1.5),
    LOGICAL_H * 0.5,
    180, 110, 0, 0, Math.PI * 2,
  )
  ctx.fill()

  // 星
  for (const st of s.stars) {
    ctx.fillStyle = `rgba(255,255,255,${st.bright})`
    ctx.fillRect(Math.floor(st.x), Math.floor(st.y), 1, 1)
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, s: State) {
  const blink = s.totalTimeMs < s.player.invincibleUntil
    && Math.floor(s.totalTimeMs / 80) % 2 === 0
  if (blink) {
    ctx.globalAlpha = 0.35
  }
  const ship = SHIPS[s.ship]
  drawShip(ctx, s.player.x, s.player.y, ship.color, ship.trim)
  ctx.globalAlpha = 1
}

// 自機・Option 共用の小さな宇宙船 (映写機モチーフ)
function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, body: string, trim: string) {
  // 本体 (台形)
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(x,            y + 2)
  ctx.lineTo(x + PLAYER_W - 4, y + 1)
  ctx.lineTo(x + PLAYER_W,     y + PLAYER_H / 2)
  ctx.lineTo(x + PLAYER_W - 4, y + PLAYER_H - 1)
  ctx.lineTo(x,                y + PLAYER_H - 2)
  ctx.closePath()
  ctx.fill()
  // ハイライト
  ctx.fillStyle = trim
  ctx.fillRect(x + 2, y + 3, PLAYER_W - 8, 1)
  // 噴射 (青)
  ctx.fillStyle = '#a8e9ff'
  ctx.fillRect(x - 4, y + PLAYER_H / 2 - 1, 4, 2)
  // レンズ (映写機オマージュ)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(x + PLAYER_W - 3, y + PLAYER_H / 2, 2, 0, Math.PI * 2)
  ctx.fill()
}

function drawOptions(ctx: CanvasRenderingContext2D, s: State) {
  if (s.optionCount === 0) return
  for (let i = 0; i < s.optionCount; i++) {
    const idx = OPTION_TRAIL_GAP * (i + 1) - 1
    if (idx >= s.playerTrail.length) continue
    const p = s.playerTrail[idx]
    // 少し小さくして描画
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.scale(0.75, 0.75)
    drawShip(ctx, 0, 0, COLOR_OPTION, '#fff7b6')
    ctx.restore()
  }
}

function drawPlayerBullets(ctx: CanvasRenderingContext2D, s: State) {
  for (const b of s.bullets) {
    if (b.kind === 'laser') {
      // 横方向に伸びる光線
      const grad = ctx.createLinearGradient(b.x, b.y, b.x + LASER_LEN, b.y)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(1, 'rgba(108,242,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(b.x, b.y - 1.5, LASER_LEN, 3)
      // コア
      ctx.fillStyle = '#fff'
      ctx.fillRect(b.x, b.y - 0.5, LASER_LEN, 1)
    } else if (b.kind === 'missile') {
      ctx.fillStyle = '#ffd24a'
      ctx.fillRect(b.x - 2, b.y - 1, 5, 2)
      ctx.fillStyle = '#ff7a3f'
      ctx.fillRect(b.x - 4, b.y - 0.5, 2, 1)
    } else {
      ctx.fillStyle = '#fffbe6'
      ctx.fillRect(b.x - 2, b.y - 1, 6, 2)
      ctx.fillStyle = '#6cf2ff'
      ctx.fillRect(b.x + 2, b.y - 0.5, 3, 1)
    }
  }
}

function drawEnemyBullets(ctx: CanvasRenderingContext2D, s: State) {
  ctx.fillStyle = '#ff6188'
  for (const b of s.ebullets) {
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fill()
  }
  // ハイライト
  ctx.fillStyle = '#fff'
  for (const b of s.ebullets) {
    ctx.fillRect(b.x - 0.5, b.y - 0.5, 1, 1)
  }
}

function drawCapsules(ctx: CanvasRenderingContext2D, s: State) {
  for (const c of s.capsules) {
    const pulse = 1 + Math.sin(s.totalTimeMs / 120) * 0.15
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.scale(pulse, pulse)
    // 外枠
    ctx.fillStyle = '#ff7a3f'
    ctx.fillRect(-6, -6, 12, 12)
    ctx.fillStyle = '#ffd24a'
    ctx.fillRect(-5, -5, 10, 10)
    // P 文字
    ctx.fillStyle = '#3a1500'
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('P', 0, 1)
    ctx.restore()
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, s: State, e: Enemy) {
  switch (e.kind) {
    case 'grunt':
      ctx.fillStyle = '#ff6188'
      ctx.beginPath()
      ctx.moveTo(e.x + e.w, e.y + e.h / 2)
      ctx.lineTo(e.x + 4,   e.y)
      ctx.lineTo(e.x,       e.y + e.h / 2)
      ctx.lineTo(e.x + 4,   e.y + e.h)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillRect(e.x + 6, e.y + e.h / 2 - 1, 2, 2)
      break
    case 'wave':
      ctx.fillStyle = '#c374ff'
      ctx.beginPath()
      ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillRect(e.x + e.w / 2 - 1, e.y + e.h / 2 - 1, 2, 2)
      break
    case 'turret': {
      // 天井/床に張り付くタイプ。上端なら下向き砲身。
      const onTop = e.y < LOGICAL_H / 2
      ctx.fillStyle = '#888'
      ctx.fillRect(e.x, e.y, e.w, e.h)
      ctx.fillStyle = '#444'
      ctx.fillRect(e.x + 2, e.y + (onTop ? e.h - 6 : 0), e.w - 4, 6)
      ctx.fillStyle = '#ff4d4d'
      ctx.fillRect(e.x + e.w / 2 - 1, onTop ? e.y + e.h - 2 : e.y, 2, 2)
      break
    }
    case 'tank':
      ctx.fillStyle = '#2ecc8a'
      ctx.fillRect(e.x, e.y, e.w, e.h)
      ctx.fillStyle = '#0a4a2c'
      ctx.fillRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4)
      ctx.fillStyle = '#ffd24a'
      ctx.fillRect(e.x - 4, e.y + e.h / 2 - 2, 4, 4)
      break
    case 'boss1':
      drawBoss1(ctx, e)
      break
    case 'boss2':
      drawBoss2(ctx, e, s)
      break
    case 'boss3':
      drawBoss3(ctx, e, s)
      break
  }

  // HP バー (ボスのみ画面下端、雑魚は省略)
  if (e.kind === 'boss1' || e.kind === 'boss2' || e.kind === 'boss3') {
    drawBossHP(ctx, e)
  }
}

function drawBoss1(ctx: CanvasRenderingContext2D, e: Enemy) {
  // 反転して鏡映ペアっぽくする
  ctx.fillStyle = '#ff6188'
  ctx.beginPath()
  ctx.moveTo(e.x,         e.y + e.h / 2)
  ctx.lineTo(e.x + e.w,   e.y)
  ctx.lineTo(e.x + e.w,   e.y + e.h)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.fillRect(e.x + e.w - 8, e.y + e.h / 2 - 2, 4, 4)
  ctx.fillStyle = '#fff8'
  ctx.fillRect(e.x + 4, e.y + 2, e.w - 12, 2)
}

function drawBoss2(ctx: CanvasRenderingContext2D, e: Enemy, s: State) {
  // 黒い球体 + 周囲にリング
  ctx.fillStyle = '#1a0033'
  ctx.beginPath()
  ctx.arc(e.x + e.w / 2, e.y + e.h / 2, Math.max(e.w, e.h) / 2 - 2, 0, Math.PI * 2)
  ctx.fill()
  // リング
  ctx.strokeStyle = '#c374ff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(e.x + e.w / 2, e.y + e.h / 2, Math.max(e.w, e.h) / 2 + 2 + Math.sin(s.totalTimeMs / 200) * 2, 0, Math.PI * 2)
  ctx.stroke()
  // コア
  ctx.fillStyle = '#ff4d4d'
  ctx.beginPath()
  ctx.arc(e.x + e.w / 2, e.y + e.h / 2, 4, 0, Math.PI * 2)
  ctx.fill()
}

function drawBoss3(ctx: CanvasRenderingContext2D, e: Enemy, s: State) {
  // 巨大映写機型
  // 本体
  ctx.fillStyle = '#3a3a3a'
  ctx.fillRect(e.x + 6, e.y + 8, e.w - 6, e.h - 16)
  // 大型レンズ
  ctx.fillStyle = '#222'
  ctx.beginPath()
  ctx.arc(e.x + 6, e.y + e.h / 2, e.h / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffd24a'
  ctx.beginPath()
  ctx.arc(e.x + 6, e.y + e.h / 2, e.h / 2 - 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ff4d4d'
  ctx.beginPath()
  ctx.arc(e.x + 6, e.y + e.h / 2, e.h / 2 - 10, 0, Math.PI * 2)
  ctx.fill()
  // フィルム巻きリール (上下)
  ctx.fillStyle = '#666'
  ctx.beginPath()
  ctx.arc(e.x + e.w / 2 + 6, e.y + 4, 8, 0, Math.PI * 2)
  ctx.arc(e.x + e.w / 2 + 6, e.y + e.h - 4, 8, 0, Math.PI * 2)
  ctx.fill()
  // 内側のスポーク (回転)
  ctx.save()
  for (const cy of [e.y + 4, e.y + e.h - 4]) {
    ctx.save()
    ctx.translate(e.x + e.w / 2 + 6, cy)
    ctx.rotate(s.totalTimeMs / 300 * (cy === e.y + 4 ? 1 : -1))
    ctx.strokeStyle = '#ccc'
    ctx.lineWidth = 1
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(i * Math.PI / 2) * 6, Math.sin(i * Math.PI / 2) * 6)
      ctx.stroke()
    }
    ctx.restore()
  }
  ctx.restore()
}

function drawBossHP(ctx: CanvasRenderingContext2D, e: Enemy) {
  const barW = LOGICAL_W - 40
  const barH = 4
  const x = 20
  const y = LOGICAL_H - 10
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(x, y, barW, barH)
  ctx.fillStyle = '#ff4d4d'
  ctx.fillRect(x, y, Math.max(0, barW * (e.hp / e.maxHp)), barH)
}

function drawParticles(ctx: CanvasRenderingContext2D, s: State) {
  for (const p of s.particles) {
    const a = Math.max(0, p.life / p.maxLife)
    ctx.globalAlpha = a
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = 1
}

function drawHUD(ctx: CanvasRenderingContext2D, s: State) {
  ctx.font = 'bold 8px monospace'
  ctx.textBaseline = 'top'

  // SCORE
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.fillText(`SCORE  ${s.score.toString().padStart(7, '0')}`, 6, 4)

  // STAGE
  ctx.textAlign = 'center'
  ctx.fillText(`${STAGES[s.stageIdx]?.subtitle ?? 'STAGE'}`, LOGICAL_W / 2, 4)

  // LIVES
  ctx.textAlign = 'right'
  ctx.fillText(`LIVES x${Math.max(0, s.lives)}`, LOGICAL_W - 6, 4)

  // ゲージ (Gradius 風)
  const slotW = 36
  const slotH = 9
  const gx = LOGICAL_W / 2 - (slotW * GAUGE_SLOTS.length) / 2
  const gy = LOGICAL_H - 22
  ctx.font = 'bold 7px monospace'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < GAUGE_SLOTS.length; i++) {
    const active = s.gauge === i + 1
    const equipped = slotEquipped(s, i + 1)
    const x = gx + i * slotW
    ctx.fillStyle = active ? '#ffd24a' : equipped ? '#2ecc8a' : 'rgba(255,255,255,0.08)'
    ctx.fillRect(x + 1, gy, slotW - 2, slotH)
    ctx.fillStyle = active ? '#000' : '#fff'
    ctx.textAlign = 'center'
    ctx.fillText(slotLabel(i + 1, s), x + slotW / 2, gy + slotH / 2 + 0.5)
  }

  // トースト
  if (s.toast && s.totalTimeMs < s.toast.until) {
    const fade = Math.min(1, (s.toast.until - s.totalTimeMs) / 400)
    ctx.globalAlpha = fade
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.toast.text, LOGICAL_W / 2, LOGICAL_H / 2 - 40)
    ctx.globalAlpha = 1
  }

  // ゲームオーバー
  if (s.mode === 'game-over') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H)
    ctx.fillStyle = '#ff4d4d'
    ctx.font = 'bold 24px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('THE END', LOGICAL_W / 2, LOGICAL_H / 2)
  }
  if (s.mode === 'all-cleared') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H)
    ctx.fillStyle = '#ffd24a'
    ctx.font = 'bold 22px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('★ ALL CLEARED ★', LOGICAL_W / 2, LOGICAL_H / 2)
  }
}

function slotEquipped(s: State, slot: number): boolean {
  switch (slot) {
    case 1: return s.speedLevel > 0
    case 2: return s.hasMissile
    case 3: return s.hasDouble
    case 4: return s.hasLaser
    case 5: return s.optionCount > 0
  }
  return false
}

function slotLabel(slot: number, s: State): string {
  switch (slot) {
    case 1: return s.speedLevel > 0 ? `SPD x${s.speedLevel}` : 'SPEED'
    case 2: return 'MISSILE'
    case 3: return 'DOUBLE'
    case 4: return 'LASER'
    case 5: return s.optionCount > 0 ? `OPT x${s.optionCount}` : 'OPTION'
  }
  return ''
}
