// ============================================
// FILMIUS — engine types & constants
// ============================================
// 横スクロールシューティング (グラディウス風) のロジック。
// 純粋関数中心の `step()` で 1 フレーム進める。レンダリングは render.ts。

export const LOGICAL_W = 480
export const LOGICAL_H = 270
export const FPS = 60
export const FRAME_MS = 1000 / FPS

// プレイヤー
export const PLAYER_W = 18
export const PLAYER_H = 10
export const PLAYER_BASE_SPEED = 2.4
export const PLAYER_SPEED_STEP = 0.5      // FAST FORWARD 1段で +0.5
export const PLAYER_MAX_SPEED_LEVEL = 3
export const PLAYER_INVINCIBLE_MS = 1800

// 弾
export const SHOT_COOLDOWN_MS = 110
export const BULLET_SPEED = 5.5
export const LASER_SPEED = BULLET_SPEED * 2   // レーザーは通常弾の 2 倍速で直進
export const LASER_LEN = 32

// ============================================
// 難易度
// ============================================
export type Difficulty = 'easy' | 'normal' | 'hard'

export interface DifficultyConfig {
  lives: number
  enemyHpMul: number          // 敵 HP の倍率
  enemyFireCooldownMul: number // 敵発射 cooldown の倍率 (大きいほど発射遅い)
  enemyBulletSpeedMul: number  // 敵弾速度の倍率
}

export const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy:   { lives: 5, enemyHpMul: 0.7, enemyFireCooldownMul: 1.5, enemyBulletSpeedMul: 0.8 },
  normal: { lives: 3, enemyHpMul: 1.0, enemyFireCooldownMul: 1.0, enemyBulletSpeedMul: 1.0 },
  hard:   { lives: 2, enemyHpMul: 1.4, enemyFireCooldownMul: 0.7, enemyBulletSpeedMul: 1.2 },
}

// ============================================
// 機体タイプ
// ============================================
// マリオカート方式で開始前に選択。性能差で個性をつける。
export type ShipType = 'standard' | 'scout' | 'heavy'

export interface ShipConfig {
  name: string
  subtitle: string
  emoji: string
  color: string            // 本体色
  trim: string             // ハイライト色
  speedMul: number         // 移動速度倍率
  fireCooldownMul: number  // 連射 cooldown 倍率 (小さいほど速い)
  normalDamage: number     // 通常弾 1 発のダメージ
  laserDamage: number      // レーザー 1 ヒットあたりのダメージ
}

export const SHIPS: Record<ShipType, ShipConfig> = {
  standard: {
    name: 'STANDARD', subtitle: '万能型',
    emoji: '🛩️', color: '#6cf2ff', trim: '#ffffff',
    speedMul: 1.0, fireCooldownMul: 1.0, normalDamage: 1, laserDamage: 2,
  },
  scout: {
    name: 'SCOUT', subtitle: '軽量・高速連射',
    emoji: '✈️', color: '#2ecc8a', trim: '#dffff0',
    speedMul: 1.4, fireCooldownMul: 0.7, normalDamage: 1, laserDamage: 2,
  },
  heavy: {
    name: 'HEAVY', subtitle: '重装甲・高火力',
    emoji: '🚀', color: '#ff7a3f', trim: '#ffd9b3',
    speedMul: 0.78, fireCooldownMul: 1.6, normalDamage: 2, laserDamage: 4,
  },
}

// パワーアップゲージ (Gradius 方式)
//   1: SPEED (Fast Forward)
//   2: MISSILE (B-Roll)
//   3: DOUBLE FEATURE
//   4: PROJECTOR BEAM (Laser、Double と排他)
//   5: BARRIER (3 ヒット吸収シールド)
//   6: SEQUEL (Option、最大 4)
export const GAUGE_SLOTS = ['SPEED', 'MISSILE', 'DOUBLE', 'LASER', 'BARRIER', 'OPTION'] as const
export type GaugeSlot = (typeof GAUGE_SLOTS)[number]
export const MAX_OPTIONS = 4
export const OPTION_TRAIL_GAP = 18 // 何フレームぶん遅れて追従するか
export const MAX_BARRIER_HP = 3

// 敵
export type EnemyKind =
  | 'grunt'        // ストレート飛行の雑魚
  | 'wave'         // サイン波で飛んでくる
  | 'turret'       // 上下端に張り付いて自機狙い弾を撃つ
  | 'tank'         // 耐久が高い直進機
  | 'boss1'        // EVIL TWIN (双子)
  | 'boss2'        // DARK FORCE
  | 'boss3'        // PROJECTOR LORD

export interface Enemy {
  id: number
  kind: EnemyKind
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  hp: number
  maxHp: number
  score: number
  carriesCapsule: boolean
  bornAt: number       // stageTimeMs at spawn (for wave motion phase)
  baseY: number        // wave/turret 用の基準 y
  fireCooldown: number // ms
  // ボス用の汎用ステート
  phase: number
  partner: number | null   // EVIL TWIN がもう片方の id を参照
}

export interface Bullet {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  kind: 'normal' | 'laser' | 'missile'
  life: number   // ms
  hit: boolean   // laser 用: 命中したかどうか (連続貫通の判定間引き)
}

export interface EnemyBullet {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

export interface Capsule {
  id: number
  x: number
  y: number
  vx: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

export interface Star {
  x: number
  y: number
  speed: number
  bright: number
}

export interface Input {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  shoot: boolean
  equip: boolean       // 単発入力 (押した瞬間)
  equipPressed: boolean // 内部用 (前フレームでの押下保持)
}

export type Mode =
  | 'playing'
  | 'stage-cleared'
  | 'game-over'
  | 'all-cleared'

export interface State {
  mode: Mode
  difficulty: Difficulty
  ship: ShipType
  stageIdx: number          // 0..2
  stageTimeMs: number       // 現ステージ内の経過 ms
  totalTimeMs: number
  lives: number
  score: number
  enemiesKilled: number
  noMiss: boolean

  player: {
    x: number
    y: number
    alive: boolean
    invincibleUntil: number  // totalTimeMs 基準
    respawnAt: number | null
  }

  bullets: Bullet[]
  enemies: Enemy[]
  ebullets: EnemyBullet[]
  capsules: Capsule[]
  particles: Particle[]
  stars: Star[]

  gauge: number               // 0..GAUGE_SLOTS.length
  speedLevel: number          // 0..PLAYER_MAX_SPEED_LEVEL
  hasMissile: boolean
  hasDouble: boolean
  hasLaser: boolean
  barrierHp: number           // 0..MAX_BARRIER_HP (残り吸収回数)
  optionCount: number         // 0..MAX_OPTIONS

  playerTrail: { x: number; y: number }[]  // 最大 OPTION_TRAIL_GAP*MAX_OPTIONS フレーム

  bossSpawned: boolean        // 現ステージのボスが出現済みか
  stageClearedAt: number | null
  bgScroll: number
  lastShotMs: number

  nextId: number

  // UI 通知用
  flashLife: number           // 0..200 ms、被弾フラッシュ
  toast: { text: string; until: number } | null
}

export function initialState(
  difficulty: Difficulty = 'normal',
  ship: ShipType = 'standard',
): State {
  return {
    mode: 'playing',
    difficulty,
    ship,
    stageIdx: 0,
    stageTimeMs: 0,
    totalTimeMs: 0,
    lives: DIFFICULTY[difficulty].lives,
    score: 0,
    enemiesKilled: 0,
    noMiss: true,

    player: {
      x: 60,
      y: LOGICAL_H / 2,
      alive: true,
      invincibleUntil: PLAYER_INVINCIBLE_MS,
      respawnAt: null,
    },

    bullets: [],
    enemies: [],
    ebullets: [],
    capsules: [],
    particles: [],
    stars: makeStarfield(),

    gauge: 0,
    speedLevel: 0,
    hasMissile: false,
    hasDouble: false,
    hasLaser: false,
    barrierHp: 0,
    optionCount: 0,
    playerTrail: [],

    bossSpawned: false,
    stageClearedAt: null,
    bgScroll: 0,
    lastShotMs: -9999,

    nextId: 1,

    flashLife: 0,
    toast: null,
  }
}

function makeStarfield(): Star[] {
  const out: Star[] = []
  for (let i = 0; i < 80; i++) {
    out.push({
      x: Math.random() * LOGICAL_W,
      y: Math.random() * LOGICAL_H,
      speed: 0.3 + Math.random() * 1.6,
      bright: 0.4 + Math.random() * 0.6,
    })
  }
  return out
}

// ============================================
// パワーアップ装備
// ============================================
// gauge が指すスロットを装備する。装備できなければ何も起きない (ゲージは残す)。
export function tryEquip(s: State): boolean {
  if (s.gauge <= 0 || s.gauge > GAUGE_SLOTS.length) return false
  const slot = GAUGE_SLOTS[s.gauge - 1]
  let equipped = false
  switch (slot) {
    case 'SPEED':
      if (s.speedLevel < PLAYER_MAX_SPEED_LEVEL) {
        s.speedLevel++
        equipped = true
        toast(s, '⏩ FAST FORWARD')
      }
      break
    case 'MISSILE':
      if (!s.hasMissile) {
        s.hasMissile = true
        equipped = true
        toast(s, '🎞️ B-ROLL MISSILE')
      }
      break
    case 'DOUBLE':
      if (!s.hasDouble && !s.hasLaser) {
        s.hasDouble = true
        equipped = true
        toast(s, '🎬 DOUBLE FEATURE')
      }
      break
    case 'LASER':
      if (!s.hasLaser) {
        s.hasLaser = true
        s.hasDouble = false
        equipped = true
        toast(s, '💡 PROJECTOR BEAM')
      }
      break
    case 'BARRIER':
      // 既にバリアがあっても再装備で残量を最大まで補充
      if (s.barrierHp < MAX_BARRIER_HP) {
        s.barrierHp = MAX_BARRIER_HP
        equipped = true
        toast(s, '🛡️ FORCE FIELD')
      }
      break
    case 'OPTION':
      if (s.optionCount < MAX_OPTIONS) {
        s.optionCount++
        equipped = true
        toast(s, '🎟️ SEQUEL')
      }
      break
  }
  if (equipped) s.gauge = 0
  return equipped
}

function toast(s: State, text: string) {
  s.toast = { text, until: s.totalTimeMs + 1400 }
}

// ============================================
// プレイヤー操作
// ============================================
function playerSpeed(s: State): number {
  return (PLAYER_BASE_SPEED + s.speedLevel * PLAYER_SPEED_STEP) * SHIPS[s.ship].speedMul
}

function shotCooldown(s: State): number {
  return SHOT_COOLDOWN_MS * SHIPS[s.ship].fireCooldownMul
}

function shoot(s: State) {
  // 通常弾
  const px = s.player.x + PLAYER_W / 2
  const py = s.player.y
  if (s.hasLaser) {
    pushBullet(s, { x: px, y: py, vx: LASER_SPEED, vy: 0, kind: 'laser', life: 1000 })
  } else if (s.hasDouble) {
    pushBullet(s, { x: px, y: py, vx: BULLET_SPEED, vy: 0, kind: 'normal', life: 1500 })
    pushBullet(s, { x: px, y: py, vx: BULLET_SPEED * 0.85, vy: -BULLET_SPEED * 0.55, kind: 'normal', life: 1500 })
  } else {
    pushBullet(s, { x: px, y: py, vx: BULLET_SPEED, vy: 0, kind: 'normal', life: 1500 })
  }

  // ミサイル (B-ROLL): 下方向に弧を描いて落ちる軌道。簡略化のため左下にゆっくり、地表に着いたら水平に。
  if (s.hasMissile) {
    pushBullet(s, { x: px, y: py + 4, vx: BULLET_SPEED * 0.5, vy: BULLET_SPEED * 0.7, kind: 'missile', life: 1500 })
  }

  // Option (SEQUEL) からも発射
  if (s.optionCount > 0 && s.playerTrail.length >= OPTION_TRAIL_GAP) {
    for (let i = 0; i < s.optionCount; i++) {
      const trailIdx = OPTION_TRAIL_GAP * (i + 1) - 1
      if (trailIdx >= s.playerTrail.length) continue
      const p = s.playerTrail[trailIdx]
      if (s.hasLaser) {
        pushBullet(s, { x: p.x + PLAYER_W / 2, y: p.y, vx: LASER_SPEED, vy: 0, kind: 'laser', life: 1000 })
      } else {
        pushBullet(s, { x: p.x + PLAYER_W / 2, y: p.y, vx: BULLET_SPEED, vy: 0, kind: 'normal', life: 1500 })
      }
    }
  }
}

function pushBullet(s: State, b: Omit<Bullet, 'id' | 'hit'>) {
  s.bullets.push({ id: s.nextId++, hit: false, ...b })
}

// ============================================
// 敵スポーン (stages.ts から呼ばれる)
// ============================================
export interface SpawnOpts {
  kind: EnemyKind
  x?: number
  y: number
  vx?: number
  vy?: number
  hp?: number
  score?: number
  carriesCapsule?: boolean
  phase?: number
  partner?: number | null
}

export function spawnEnemy(s: State, o: SpawnOpts): Enemy {
  const def = enemyDef(o.kind)
  const dc = DIFFICULTY[s.difficulty]
  // 難易度倍率を適用: HP は最低 1、fireCooldown は最低 100ms
  const rawHp = o.hp ?? def.hp
  const hp = Math.max(1, Math.round(rawHp * dc.enemyHpMul))
  const fireCd = def.fireCooldown > 0
    ? Math.max(100, Math.round(def.fireCooldown * dc.enemyFireCooldownMul))
    : 0
  const e: Enemy = {
    id: s.nextId++,
    kind: o.kind,
    x: o.x ?? LOGICAL_W + 20,
    y: o.y,
    vx: o.vx ?? def.vx,
    vy: o.vy ?? 0,
    w: def.w,
    h: def.h,
    hp,
    maxHp: hp,
    score: o.score ?? def.score,
    carriesCapsule: o.carriesCapsule ?? false,
    bornAt: s.stageTimeMs,
    baseY: o.y,
    fireCooldown: fireCd,
    phase: o.phase ?? 0,
    partner: o.partner ?? null,
  }
  s.enemies.push(e)
  return e
}

function enemyDef(kind: EnemyKind): {
  w: number; h: number; hp: number; vx: number; score: number; fireCooldown: number
} {
  switch (kind) {
    case 'grunt':  return { w: 16, h: 12, hp: 1,  vx: -2.4, score: 100,  fireCooldown: 0 }
    case 'wave':   return { w: 14, h: 12, hp: 1,  vx: -2.0, score: 120,  fireCooldown: 0 }
    case 'turret': return { w: 18, h: 18, hp: 3,  vx: 0,    score: 200,  fireCooldown: 1400 }
    case 'tank':   return { w: 22, h: 18, hp: 5,  vx: -1.2, score: 300,  fireCooldown: 1100 }
    case 'boss1':  return { w: 36, h: 26, hp: 36, vx: 0,    score: 3000, fireCooldown: 900 }
    case 'boss2':  return { w: 44, h: 36, hp: 60, vx: 0,    score: 5000, fireCooldown: 700 }
    case 'boss3':  return { w: 60, h: 48, hp: 90, vx: 0,    score: 8000, fireCooldown: 500 }
  }
}

// ============================================
// step() — 1 フレーム進める
// ============================================
export function step(s: State, dtMs: number, input: Input, stage: StageRuntime): void {
  if (s.mode === 'game-over' || s.mode === 'all-cleared') return

  s.totalTimeMs += dtMs
  s.bgScroll = (s.bgScroll + dtMs * 0.05) % 1000

  // 背景星
  for (const st of s.stars) {
    st.x -= st.speed * (dtMs / FRAME_MS)
    if (st.x < 0) {
      st.x = LOGICAL_W
      st.y = Math.random() * LOGICAL_H
    }
  }

  if (s.mode === 'playing') {
    s.stageTimeMs += dtMs

    // ステージスクリプト進行 (敵スポーン、ボス出現)
    stage.advance(s)

    // 入力
    if (s.player.alive) {
      const sp = playerSpeed(s) * (dtMs / FRAME_MS)
      if (input.up)    s.player.y -= sp
      if (input.down)  s.player.y += sp
      if (input.left)  s.player.x -= sp
      if (input.right) s.player.x += sp
      // 画面内クランプ
      s.player.x = Math.max(2, Math.min(LOGICAL_W - PLAYER_W - 2, s.player.x))
      s.player.y = Math.max(2, Math.min(LOGICAL_H - PLAYER_H - 2, s.player.y))

      // 装備ボタン (押下立ち上がりのみ)
      if (input.equip && !input.equipPressed) {
        tryEquip(s)
      }

      // 連射 (時間ベース)
      if (input.shoot && s.totalTimeMs - s.lastShotMs >= shotCooldown(s)) {
        shoot(s)
        s.lastShotMs = s.totalTimeMs
      }

      // プレイヤー軌跡を記録 (Option 用)
      if (s.optionCount > 0) {
        s.playerTrail.unshift({ x: s.player.x, y: s.player.y })
        const maxLen = OPTION_TRAIL_GAP * MAX_OPTIONS + 4
        if (s.playerTrail.length > maxLen) s.playerTrail.length = maxLen
      } else {
        s.playerTrail.length = 0
      }
    } else {
      // リスポーン待ち
      if (s.player.respawnAt !== null && s.totalTimeMs >= s.player.respawnAt) {
        if (s.lives > 0) {
          s.player.alive = true
          s.player.x = 60
          s.player.y = LOGICAL_H / 2
          s.player.invincibleUntil = s.totalTimeMs + PLAYER_INVINCIBLE_MS
          s.player.respawnAt = null
        } else {
          s.mode = 'game-over'
        }
      }
    }
    input.equipPressed = input.equip
  }

  // 弾の進行
  updateBullets(s, dtMs)
  updateEnemyBullets(s, dtMs)
  updateEnemies(s, dtMs)
  updateCapsules(s, dtMs)
  updateParticles(s, dtMs)

  // 衝突判定
  if (s.player.alive) {
    collidePlayer(s)
    collideCapsule(s)
  }
  collideBullets(s)

  // フラッシュ・トースト
  if (s.flashLife > 0) s.flashLife = Math.max(0, s.flashLife - dtMs)
  if (s.toast && s.totalTimeMs > s.toast.until) s.toast = null

  // ステージクリア演出から次ステージへ
  if (s.mode === 'stage-cleared' && s.stageClearedAt !== null) {
    if (s.totalTimeMs - s.stageClearedAt >= 2200) {
      if (s.stageIdx >= stage.totalStages - 1) {
        s.mode = 'all-cleared'
      } else {
        s.stageIdx++
        s.stageTimeMs = 0
        s.bossSpawned = false
        s.stageClearedAt = null
        s.enemies.length = 0
        s.ebullets.length = 0
        s.mode = 'playing'
        stage.onStageStart(s)
      }
    }
  }
}

function updateBullets(s: State, dtMs: number) {
  const k = dtMs / FRAME_MS
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i]
    b.x += b.vx * k
    b.y += b.vy * k
    b.life -= dtMs
    if (b.life <= 0 || b.x > LOGICAL_W + 20 || b.x < -20 || b.y < -20 || b.y > LOGICAL_H + 20) {
      s.bullets.splice(i, 1)
    }
  }
}

function updateEnemyBullets(s: State, dtMs: number) {
  const k = dtMs / FRAME_MS
  for (let i = s.ebullets.length - 1; i >= 0; i--) {
    const e = s.ebullets[i]
    e.x += e.vx * k
    e.y += e.vy * k
    if (e.x < -20 || e.x > LOGICAL_W + 20 || e.y < -20 || e.y > LOGICAL_H + 20) {
      s.ebullets.splice(i, 1)
    }
  }
}

function updateCapsules(s: State, dtMs: number) {
  const k = dtMs / FRAME_MS
  for (let i = s.capsules.length - 1; i >= 0; i--) {
    const c = s.capsules[i]
    c.x += c.vx * k
    if (c.x < -20) s.capsules.splice(i, 1)
  }
}

function updateParticles(s: State, dtMs: number) {
  const k = dtMs / FRAME_MS
  for (let i = s.particles.length - 1; i >= 0; i--) {
    const p = s.particles[i]
    p.x += p.vx * k
    p.y += p.vy * k
    p.life -= dtMs
    if (p.life <= 0) s.particles.splice(i, 1)
  }
}

function updateEnemies(s: State, dtMs: number) {
  const k = dtMs / FRAME_MS
  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i]
    // 基本移動 + 種別固有
    switch (e.kind) {
      case 'grunt':
        e.x += e.vx * k
        break
      case 'wave': {
        e.x += e.vx * k
        const t = (s.stageTimeMs - e.bornAt) / 1000
        e.y = e.baseY + Math.sin(t * 4) * 26
        break
      }
      case 'turret':
        // 上下端に張り付き
        e.x += e.vx * k
        break
      case 'tank':
        e.x += e.vx * k
        break
      case 'boss1':
        updateBoss1(s, e, dtMs)
        break
      case 'boss2':
        updateBoss2(s, e, dtMs)
        break
      case 'boss3':
        updateBoss3(s, e, dtMs)
        break
    }

    // 撃ち返し
    if (e.fireCooldown > 0) {
      e.fireCooldown -= dtMs
      if (e.fireCooldown <= 0) {
        enemyFire(s, e)
        const baseCd = enemyDef(e.kind).fireCooldown
        e.fireCooldown = Math.max(100, Math.round(baseCd * DIFFICULTY[s.difficulty].enemyFireCooldownMul))
        if (e.kind === 'boss1' || e.kind === 'boss2' || e.kind === 'boss3') {
          // ボスは少し短めに連射
          e.fireCooldown *= 0.75
        }
      }
    }

    // 画面外で消す (ボス除く)
    if (
      e.kind !== 'boss1' && e.kind !== 'boss2' && e.kind !== 'boss3' &&
      e.x + e.w < -20
    ) {
      s.enemies.splice(i, 1)
    }
  }
}

function enemyFire(s: State, e: Enemy) {
  // ボス以外で turret/tank/wave のみ撃つ。grunt は撃たない。
  if (e.kind === 'grunt') return
  const px = s.player.x + PLAYER_W / 2
  const py = s.player.y + PLAYER_H / 2
  const dx = px - (e.x + e.w / 2)
  const dy = py - (e.y + e.h / 2)
  const d = Math.hypot(dx, dy) || 1
  const bsMul = DIFFICULTY[s.difficulty].enemyBulletSpeedMul
  const sp = 2.6 * bsMul
  switch (e.kind) {
    case 'wave':
    case 'turret':
    case 'tank':
      s.ebullets.push({
        id: s.nextId++,
        x: e.x + e.w / 2,
        y: e.y + e.h / 2,
        vx: (dx / d) * sp,
        vy: (dy / d) * sp,
        r: 3,
      })
      break
    case 'boss1':
      // 自機狙い 3way
      for (let i = -1; i <= 1; i++) {
        const a = Math.atan2(dy, dx) + i * 0.18
        s.ebullets.push({
          id: s.nextId++, x: e.x + e.w / 2, y: e.y + e.h / 2,
          vx: Math.cos(a) * 3.0 * bsMul, vy: Math.sin(a) * 3.0 * bsMul, r: 3,
        })
      }
      break
    case 'boss2':
      // 周囲に円形弾
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + e.phase * 0.1
        s.ebullets.push({
          id: s.nextId++, x: e.x + e.w / 2, y: e.y + e.h / 2,
          vx: Math.cos(a) * 2.4 * bsMul, vy: Math.sin(a) * 2.4 * bsMul, r: 3,
        })
      }
      e.phase++
      break
    case 'boss3':
      // 水平レーザー風 + 散弾
      for (let i = -2; i <= 2; i++) {
        s.ebullets.push({
          id: s.nextId++, x: e.x, y: e.y + e.h / 2 + i * 6,
          vx: -3.6 * bsMul, vy: 0, r: 3,
        })
      }
      break
  }
}

// ============================================
// ボス挙動
// ============================================
function updateBoss1(s: State, e: Enemy, dtMs: number) {
  // 画面右側で待機。自機の y に向けてゆっくり追従。
  const targetX = LOGICAL_W - 70
  const targetY = s.player.y + (e.partner !== null ? -28 : 28)
  e.x += ((targetX - e.x) * 0.02) * (dtMs / FRAME_MS)
  e.y += ((targetY - e.y) * 0.04) * (dtMs / FRAME_MS)
}

function updateBoss2(s: State, e: Enemy, dtMs: number) {
  // ふわふわ円運動
  const t = s.stageTimeMs / 1000
  const cx = LOGICAL_W - 80
  const cy = LOGICAL_H / 2
  e.x += ((cx + Math.cos(t * 0.7) * 30 - e.x) * 0.04) * (dtMs / FRAME_MS)
  e.y += ((cy + Math.sin(t * 0.9) * 40 - e.y) * 0.04) * (dtMs / FRAME_MS)
}

function updateBoss3(s: State, e: Enemy, dtMs: number) {
  // ラスボス: HP が減ると挙動が速くなる
  const ratio = e.hp / e.maxHp
  const cx = LOGICAL_W - 80
  const cy = LOGICAL_H / 2
  const speedMul = 1.6 - ratio
  e.x += ((cx - e.x) * 0.03 * speedMul) * (dtMs / FRAME_MS)
  e.y += ((cy + Math.sin(s.stageTimeMs / 600) * 50 * speedMul - e.y) * 0.05) * (dtMs / FRAME_MS)
}

// ============================================
// 衝突判定
// ============================================
function aabb(ax: number, ay: number, aw: number, ah: number,
              bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

function collideBullets(s: State) {
  // 自機弾 vs 敵
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i]
    let hit = false
    for (let j = s.enemies.length - 1; j >= 0; j--) {
      const e = s.enemies[j]
      const bw = b.kind === 'laser' ? LASER_LEN : 6
      const bh = b.kind === 'laser' ? 3 : 3
      if (aabb(b.x, b.y - bh / 2, bw, bh, e.x, e.y, e.w, e.h)) {
        e.hp -= b.kind === 'laser' ? SHIPS[s.ship].laserDamage : SHIPS[s.ship].normalDamage
        spawnSparks(s, e.x + e.w / 2, e.y + e.h / 2, '#ffd24a', 4)
        if (b.kind !== 'laser') {
          hit = true
        }
        if (e.hp <= 0) {
          onEnemyDestroyed(s, e)
          s.enemies.splice(j, 1)
        }
        if (b.kind !== 'laser') break
      }
    }
    if (hit) s.bullets.splice(i, 1)
  }
}

function onEnemyDestroyed(s: State, e: Enemy) {
  s.score += e.score
  s.enemiesKilled++
  spawnExplosion(s, e.x + e.w / 2, e.y + e.h / 2, e.w + e.h)

  // カプセルドロップ
  if (e.carriesCapsule) {
    s.capsules.push({
      id: s.nextId++,
      x: e.x + e.w / 2,
      y: e.y + e.h / 2,
      vx: -1.4,
    })
  }

  // ボス撃破 → ステージクリア (双子ボスは両方倒してから)
  if (e.kind === 'boss1' || e.kind === 'boss2' || e.kind === 'boss3') {
    // ボス撃破演出
    for (let i = 0; i < 30; i++) {
      spawnExplosion(s, e.x + Math.random() * e.w, e.y + Math.random() * e.h, 18)
    }
    const stillBoss = s.enemies.some(
      x => x.id !== e.id && (x.kind === 'boss1' || x.kind === 'boss2' || x.kind === 'boss3'),
    )
    if (!stillBoss) {
      s.mode = 'stage-cleared'
      s.stageClearedAt = s.totalTimeMs
      toast(s, e.kind === 'boss3' ? '★ FINAL CUT ★' : 'STAGE CLEAR!')
    }
  }
}

function collidePlayer(s: State) {
  if (s.totalTimeMs < s.player.invincibleUntil) return

  // 敵弾 vs 自機
  for (let i = s.ebullets.length - 1; i >= 0; i--) {
    const b = s.ebullets[i]
    if (aabb(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2,
            s.player.x, s.player.y, PLAYER_W, PLAYER_H)) {
      s.ebullets.splice(i, 1)
      if (absorbHitWithBarrier(s)) return
      killPlayer(s)
      return
    }
  }
  // 敵本体 vs 自機
  for (const e of s.enemies) {
    if (aabb(e.x, e.y, e.w, e.h, s.player.x, s.player.y, PLAYER_W, PLAYER_H)) {
      // バリアあり: ザコは一撃で破壊しつつバリアも 1 消費。ボスはすり抜けず吸収のみ。
      if (absorbHitWithBarrier(s)) {
        if (e.kind !== 'boss1' && e.kind !== 'boss2' && e.kind !== 'boss3') {
          e.hp = 0
          onEnemyDestroyed(s, e)
          const idx = s.enemies.indexOf(e)
          if (idx >= 0) s.enemies.splice(idx, 1)
        }
        return
      }
      killPlayer(s)
      return
    }
  }
}

// バリアが残っていれば 1 消費して true。短時間の被弾無敵も付与し、連続吸収を防ぐ。
function absorbHitWithBarrier(s: State): boolean {
  if (s.barrierHp <= 0) return false
  s.barrierHp--
  s.flashLife = 120
  s.player.invincibleUntil = s.totalTimeMs + 280
  spawnSparks(s, s.player.x + PLAYER_W / 2, s.player.y + PLAYER_H / 2, '#6cf2ff', 10)
  if (s.barrierHp === 0) toast(s, '🛡️ BARRIER BROKEN')
  return true
}

function collideCapsule(s: State) {
  for (let i = s.capsules.length - 1; i >= 0; i--) {
    const c = s.capsules[i]
    if (aabb(c.x - 6, c.y - 6, 12, 12, s.player.x, s.player.y, PLAYER_W, PLAYER_H)) {
      s.capsules.splice(i, 1)
      s.gauge = Math.min(GAUGE_SLOTS.length, s.gauge + 1)
      s.score += 50
    }
  }
}

function killPlayer(s: State) {
  s.player.alive = false
  s.noMiss = false
  s.lives--
  s.flashLife = 200
  spawnExplosion(s, s.player.x + PLAYER_W / 2, s.player.y + PLAYER_H / 2, 32)
  // パワーアップは死亡後もそのまま継続 (ユーザビリティ重視)
  // playerTrail だけは復活位置に飛ばないようリセット
  s.playerTrail = []
  s.player.respawnAt = s.totalTimeMs + 1200
  if (s.lives <= 0) {
    // step() ループは respawn 時に lives==0 を見て game-over に切り替える
    s.player.respawnAt = s.totalTimeMs + 1400
  }
}

// ============================================
// パーティクル
// ============================================
function spawnSparks(s: State, x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const v = 0.6 + Math.random() * 1.4
    s.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 220 + Math.random() * 180, maxLife: 400, color, size: 2,
    })
  }
}

function spawnExplosion(s: State, x: number, y: number, scale: number) {
  const palette = ['#ff7a3f', '#ffd24a', '#fffbe6', '#ff4d4d']
  const count = Math.min(40, Math.floor(scale * 1.5))
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const v = 0.4 + Math.random() * (1.4 + scale / 12)
    s.particles.push({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 420 + Math.random() * 260, maxLife: 700,
      color: palette[Math.floor(Math.random() * palette.length)],
      size: 1 + Math.random() * 2.5,
    })
  }
}

// ============================================
// ステージランタイム (stages.ts から実装が注入される)
// ============================================
export interface StageRuntime {
  /** 1 フレームの始まりに呼ばれる。スポーン制御。 */
  advance(s: State): void
  /** 各ステージ開始時に呼ばれる。バナー表示などに使う。 */
  onStageStart(s: State): void
  /** 全ステージ数。all-cleared 判定に使う。 */
  totalStages: number
}
