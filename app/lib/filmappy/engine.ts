// ============================================
// FILMAPPY — engine types & constants
// ============================================
// マッピーランド風アクションを映画モチーフでアレンジ。
//   - 5 段フロア構造を、3 本のレッドカーペット・トランポリンが縦に貫く
//   - プレイヤー (フィルム警官マピオ) は左右に歩き、トランポリン列に
//     乗ると自動的に上下にバウンド。Up/Down 入力でジャンプ階高さを切替
//   - 同じトランポリンで 4 回連続バウンドするとカーペットが破れて落下死
//   - 映画アイテム (フィルム/ポップコーン/ポスター/オスカー/チケット) を
//     全て回収するとステージクリア
//   - 同種アイテムを連続で取るとボーナス倍率がアップ
//   - 映写室ドア (左右の壁) を開けると "波" が水平に走り、敵をスタン
//   - ステージ 3 をクリアすると ALL CLEAR、ボーナス
//
// レンダリングは render.ts、ステージレイアウトは stages.ts、
// 純粋関数 step() で 1 フレーム進める。

export const LOGICAL_W = 480
export const LOGICAL_H = 270
export const FPS = 60
export const FRAME_MS = 1000 / FPS

// HUD と劇場の余白
export const FLOOR_TOP_Y = 38          // 最上段フロアの y
export const FLOOR_GAP = 46            // フロア間隔
export const FLOOR_COUNT = 5
export const FLOOR_THICKNESS = 4
export const TRAMP_W = 28              // トランポリン列の x 方向幅
export const TRAMP_PAD = 2             // フロア端からのマージン

export const PLAYER_W = 14
export const PLAYER_H = 18
export const PLAYER_WALK_SPEED = 1.4
export const PLAYER_BOUNCE_PERIOD_MS = 520  // 1 バウンドにかかる時間 (床→床)
export const PLAYER_INVINCIBLE_MS = 1400
export const PLAYER_LIVES = 3
export const TRAMP_MAX_BOUNCES = 4

// ドア波
export const WAVE_SPEED = 3.6
export const WAVE_LIFE_MS = 1600
export const WAVE_H = 18

// 敵
export const ENEMY_W = 14
export const ENEMY_H = 18
export const ENEMY_WALK_SPEED = 1.0
export const ENEMY_RESPAWN_MS = 6000
export const ENEMY_STUN_MS = 2400

// アイテム
export const ITEM_W = 14
export const ITEM_H = 12

// スコア
export const ITEM_BASE_SCORE = 100
export const COMBO_SCORE_MULT = [1, 2, 5, 10] as const   // 1個目..4個目以降の倍率
export const STAGE_CLEAR_BONUS = 2000
export const ALL_CLEAR_BONUS   = 8000
export const ENEMY_STUN_SCORE  = 200
export const WAVE_PIN_BONUS    = 500   // ドア波の中央で敵を捕まえた時
export const TIME_BONUS_PER_SEC = 30   // 残時間 (ms) → 秒換算でボーナス

export const STAGE_TIME_LIMIT_MS = 90_000

// ============================================
// Types
// ============================================
export type ItemKind = 'reel' | 'popcorn' | 'poster' | 'oscar' | 'ticket'

export const ITEM_KINDS: ItemKind[] = ['reel', 'popcorn', 'poster', 'oscar', 'ticket']

export const ITEM_EMOJI: Record<ItemKind, string> = {
  reel:    '🎞️',
  popcorn: '🍿',
  poster:  '🎬',
  oscar:   '🏆',
  ticket:  '🎟️',
}

export const ITEM_COLOR: Record<ItemKind, string> = {
  reel:    '#ffd24a',
  popcorn: '#fff1a8',
  poster:  '#ff7aa6',
  oscar:   '#f5d35a',
  ticket:  '#6cf2ff',
}

export type Facing = 'left' | 'right'

export interface PlayerState {
  // 位置 (足元基準でなく、左上原点 16x18 の bbox)
  x: number
  y: number
  facing: Facing
  alive: boolean
  invincibleUntil: number   // totalTimeMs 基準
  respawnAt: number | null

  // 歩行/バウンド状態
  mode: 'walk' | 'bounce' | 'falling'
  floorIdx: number              // walk: 現在のフロア (0=最上段, FLOOR_COUNT-1=最下段)

  // bounce 用
  trampIdx: number | null       // 乗っているトランポリン列の index
  bounceCount: number           // 当該トランポリンでの連続バウンド数
  bounceFromFloor: number       // バウンド開始時のフロア
  bounceToFloor: number         // バウンド到達予定のフロア
  bouncePhaseMs: number         // 0..PLAYER_BOUNCE_PERIOD_MS
  verticalIntent: 'up' | 'down' // 次バウンド方向 (Up/Down 入力で変えられる)

  // falling 用 (トランポリン破壊時)
  fallVy: number
}

export interface EnemyState {
  id: number
  x: number
  y: number
  facing: Facing
  mode: 'walk' | 'bounce' | 'stunned' | 'gone'
  floorIdx: number
  trampIdx: number | null
  bounceFromFloor: number
  bounceToFloor: number
  bouncePhaseMs: number
  stunnedUntil: number          // totalTimeMs
  // AI
  nextDecisionAt: number        // 次の方向 / バウンド判断時刻
  respawnFromAt: number | null  // 復活予定時刻 (gone の時)
  kind: 'spoiler' | 'pirate'    // 見た目用 (spoiler=ネタバレ, pirate=海賊版)
}

export interface ItemState {
  id: number
  x: number
  y: number
  kind: ItemKind
  collected: boolean
}

export interface WaveState {
  id: number
  x: number               // 波の左端
  y: number               // 中央 y
  vx: number              // ±WAVE_SPEED
  life: number            // ms
  bonusZone: boolean      // 中央に敵がいた瞬間に True 化 (見た目用)
}

export interface DoorState {
  // フロア端のドア。プレイヤーがフロアの端 (壁側) に近づいて
  // 開閉ボタンを押すと wave を放つ。各ドアには複数使用可。
  id: number
  floorIdx: number
  side: 'left' | 'right'
  x: number               // ドア中心 x (壁面)
  cooldownUntil: number   // totalTimeMs
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

export interface Trampoline {
  // 列定義 (静的レイアウト)
  cx: number              // 中心 x
  topFloor: number        // 上端の到達可能フロア (=0 が多い)
  bottomFloor: number     // 下端の到達可能フロア
  // 現在の状態 (state にコピーする)
}

export interface TrampolineState {
  cx: number
  topFloor: number
  bottomFloor: number
  bounces: number         // 連続バウンド回数 (player or enemy)
  broken: boolean
  rebuildAt: number | null
}

export interface Input {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  doorAction: boolean       // 押下立ち上がりで処理
  doorPressed: boolean      // 前フレーム保持
}

export type Mode = 'playing' | 'stage-cleared' | 'game-over' | 'all-cleared'

export interface Stage {
  name: string
  subtitle: string
  trampolines: Trampoline[]
  items: { x: number; y: number; kind: ItemKind }[]
  enemies: { kind: 'spoiler' | 'pirate'; floorIdx: number; x: number; facing: Facing }[]
  doors: { floorIdx: number; side: 'left' | 'right' }[]
}

export interface State {
  mode: Mode
  stageIdx: number
  stageTimeMs: number
  totalTimeMs: number
  timeLeftMs: number          // STAGE_TIME_LIMIT_MS から減算

  lives: number
  score: number
  itemsCollected: number
  enemiesStunned: number
  noMiss: boolean

  player: PlayerState
  enemies: EnemyState[]
  items: ItemState[]
  waves: WaveState[]
  doors: DoorState[]
  trampolines: TrampolineState[]
  particles: Particle[]

  // コンボ
  lastItemKind: ItemKind | null
  comboCount: number          // 同種アイテムを何個連続で取ったか (1始まり)

  stageClearedAt: number | null
  flashLife: number           // 0..200 ms
  toast: { text: string; until: number } | null

  nextId: number
}

// ============================================
// 初期化
// ============================================
export function initialState(): State {
  return {
    mode: 'playing',
    stageIdx: 0,
    stageTimeMs: 0,
    totalTimeMs: 0,
    timeLeftMs: STAGE_TIME_LIMIT_MS,

    lives: PLAYER_LIVES,
    score: 0,
    itemsCollected: 0,
    enemiesStunned: 0,
    noMiss: true,

    player: makeInitialPlayer(),
    enemies: [],
    items: [],
    waves: [],
    doors: [],
    trampolines: [],
    particles: [],

    lastItemKind: null,
    comboCount: 0,

    stageClearedAt: null,
    flashLife: 0,
    toast: null,
    nextId: 1,
  }
}

function makeInitialPlayer(): PlayerState {
  return {
    x: 20,
    y: floorYFor(FLOOR_COUNT - 1) - PLAYER_H,
    facing: 'right',
    alive: true,
    invincibleUntil: PLAYER_INVINCIBLE_MS,
    respawnAt: null,
    mode: 'walk',
    floorIdx: FLOOR_COUNT - 1,
    trampIdx: null,
    bounceCount: 0,
    bounceFromFloor: 0,
    bounceToFloor: 0,
    bouncePhaseMs: 0,
    verticalIntent: 'up',
    fallVy: 0,
  }
}

// ============================================
// 幾何ヘルパー
// ============================================
export function floorYFor(idx: number): number {
  return FLOOR_TOP_Y + idx * FLOOR_GAP
}

function aabb(ax: number, ay: number, aw: number, ah: number,
              bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

// 与えられた x がトランポリン列の中央付近に入っているかを判定。
// 入っていれば index を返す。
export function trampolineAtX(s: State, x: number): number {
  for (let i = 0; i < s.trampolines.length; i++) {
    const t = s.trampolines[i]
    if (x >= t.cx - TRAMP_W / 2 && x <= t.cx + TRAMP_W / 2) return i
  }
  return -1
}

// ============================================
// ステージランタイム (stages.ts から実装が注入される)
// ============================================
export interface StageRuntime {
  onStageStart(s: State): void
  advance(s: State): void
}

// ============================================
// ステージのセットアップ
// ============================================
export function loadStage(s: State, stage: Stage): void {
  s.stageTimeMs = 0
  s.timeLeftMs = STAGE_TIME_LIMIT_MS
  s.stageClearedAt = null
  s.lastItemKind = null
  s.comboCount = 0

  // トランポリン
  s.trampolines = stage.trampolines.map(t => ({
    cx: t.cx,
    topFloor: t.topFloor,
    bottomFloor: t.bottomFloor,
    bounces: 0,
    broken: false,
    rebuildAt: null,
  }))

  // ドア
  s.doors = stage.doors.map(d => ({
    id: s.nextId++,
    floorIdx: d.floorIdx,
    side: d.side,
    x: d.side === 'left' ? 4 : LOGICAL_W - 4,
    cooldownUntil: 0,
  }))

  // アイテム
  s.items = stage.items.map(it => ({
    id: s.nextId++,
    x: it.x,
    y: it.y,
    kind: it.kind,
    collected: false,
  }))

  // 敵
  s.enemies = stage.enemies.map(en => ({
    id: s.nextId++,
    x: en.x,
    y: floorYFor(en.floorIdx) - ENEMY_H,
    facing: en.facing,
    mode: 'walk',
    floorIdx: en.floorIdx,
    trampIdx: null,
    bounceFromFloor: 0,
    bounceToFloor: 0,
    bouncePhaseMs: 0,
    stunnedUntil: 0,
    nextDecisionAt: 1500 + Math.random() * 1500,
    respawnFromAt: null,
    kind: en.kind,
  }))

  s.waves = []
  s.particles = []

  // プレイヤーは最下段中央スタート (毎ステージ)
  s.player = makeInitialPlayer()
  // 既存の totalTimeMs 基準で無敵時間を再計算
  s.player.invincibleUntil = s.totalTimeMs + PLAYER_INVINCIBLE_MS
}

// ============================================
// step() — 1 フレーム進める
// ============================================
export function step(s: State, dtMs: number, input: Input, stage: StageRuntime): void {
  if (s.mode === 'game-over' || s.mode === 'all-cleared') return

  s.totalTimeMs += dtMs

  if (s.mode === 'playing') {
    s.stageTimeMs += dtMs
    s.timeLeftMs = Math.max(0, s.timeLeftMs - dtMs)

    stage.advance(s)

    if (s.player.alive) {
      updatePlayer(s, dtMs, input)
    } else if (s.player.respawnAt !== null && s.totalTimeMs >= s.player.respawnAt) {
      // リスポーン
      if (s.lives > 0) {
        s.player = makeInitialPlayer()
        s.player.invincibleUntil = s.totalTimeMs + PLAYER_INVINCIBLE_MS
      } else {
        s.mode = 'game-over'
      }
    }
    input.doorPressed = input.doorAction

    // 時間切れ
    if (s.timeLeftMs <= 0 && s.player.alive) {
      killPlayer(s)
      toast(s, '⏰ TIME UP')
    }
  }

  updateEnemies(s, dtMs)
  updateWaves(s, dtMs)
  updateTrampolines(s)
  updateParticles(s, dtMs)

  if (s.player.alive) {
    collectItems(s)
    checkPlayerEnemy(s)
    checkPlayerWavePin()
  }
  collideWaveEnemies(s)

  // フラッシュ / トースト
  if (s.flashLife > 0) s.flashLife = Math.max(0, s.flashLife - dtMs)
  if (s.toast && s.totalTimeMs > s.toast.until) s.toast = null

  // ステージ全アイテム回収判定
  if (s.mode === 'playing' && s.items.every(it => it.collected)) {
    onStageCleared(s)
  }

  // ステージクリア → 次ステージへ
  if (s.mode === 'stage-cleared' && s.stageClearedAt !== null) {
    if (s.totalTimeMs - s.stageClearedAt >= 2400) {
      if (s.stageIdx >= 2) {
        s.score += ALL_CLEAR_BONUS
        s.mode = 'all-cleared'
      } else {
        s.stageIdx++
        s.mode = 'playing'
        stage.onStageStart(s)
      }
    }
  }
}

function onStageCleared(s: State) {
  if (s.mode !== 'playing') return
  s.mode = 'stage-cleared'
  s.stageClearedAt = s.totalTimeMs
  // タイムボーナス
  const timeBonus = Math.floor((s.timeLeftMs / 1000) * TIME_BONUS_PER_SEC)
  s.score += STAGE_CLEAR_BONUS + timeBonus
  toast(s, s.stageIdx >= 2 ? '★ FINAL SHOW CLEAR ★' : `STAGE ${s.stageIdx + 1} CLEAR! +${STAGE_CLEAR_BONUS + timeBonus}`)
  // 派手なパーティクル
  for (let i = 0; i < 60; i++) {
    spawnSparks(s, s.player.x + PLAYER_W / 2, s.player.y + PLAYER_H / 2,
      randPick(['#ffd24a', '#ff7aa6', '#6cf2ff', '#fff']), 6)
  }
}

// ============================================
// プレイヤー
// ============================================
function updatePlayer(s: State, dtMs: number, input: Input): void {
  const p = s.player

  // 共通: ドア開閉 (押下立ち上がり)
  if (input.doorAction && !input.doorPressed) {
    tryOpenDoor(s)
  }

  if (p.mode === 'walk') {
    // 左右入力で歩く
    const k = dtMs / FRAME_MS
    const dx = (input.left ? -1 : 0) + (input.right ? 1 : 0)
    if (dx !== 0) {
      p.facing = dx < 0 ? 'left' : 'right'
      const nextX = p.x + dx * PLAYER_WALK_SPEED * k
      // 壁
      const lx = nextX
      const rx = nextX + PLAYER_W
      if (lx < 2) { p.x = 2 }
      else if (rx > LOGICAL_W - 2) { p.x = LOGICAL_W - 2 - PLAYER_W }
      else {
        // 足元中心がトランポリン列に入ったかチェック (rising-edge のみで起動)。
        // 中間フロアに着地した直後など、すでにトランポリン列上にいる時に
        // 歩こうとして即再バウンドしてしまうのを避ける。
        const prevFootCx = p.x + PLAYER_W / 2
        const nextFootCx = nextX + PLAYER_W / 2
        const prevTi = trampolineAtX(s, prevFootCx)
        const nextTi = trampolineAtX(s, nextFootCx)
        if (nextTi >= 0) {
          const t = s.trampolines[nextTi]
          const onActiveRange = p.floorIdx >= t.topFloor && p.floorIdx <= t.bottomFloor
          if (onActiveRange) {
            if (t.broken) {
              // 壊れた穴に踏み込んだ → 落下死
              p.x = nextX
              startFall(s)
              return
            }
            if (prevTi !== nextTi) {
              // 新たにトランポリン列へ踏み込んだ → バウンド開始
              enterTrampoline(s, nextTi, input)
              return
            }
          }
        }
        p.x = nextX
      }
    }
    // walk 中は y を固定 (フロアの上面に張り付ける)
    p.y = floorYFor(p.floorIdx) - PLAYER_H
    return
  }

  if (p.mode === 'bounce') {
    // Up/Down 入力で次のバウンド方向を予約
    if (input.up)   p.verticalIntent = 'up'
    if (input.down) p.verticalIntent = 'down'

    // バウンド進行
    p.bouncePhaseMs += dtMs
    const t = clamp01(p.bouncePhaseMs / PLAYER_BOUNCE_PERIOD_MS)
    // 山なり (sin) の軌道。fromFloor の上面から toFloor の上面へ。
    const y0 = floorYFor(p.bounceFromFloor) - PLAYER_H
    const y1 = floorYFor(p.bounceToFloor) - PLAYER_H
    const flightAmp = 24
    p.y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * flightAmp

    // 横方向: トランポリン中心に向けて少しだけ吸い寄せる + 任意入力で微移動
    const tramp = s.trampolines[p.trampIdx ?? 0]
    if (tramp) {
      const cx = tramp.cx
      // 自然吸引
      p.x += ((cx - PLAYER_W / 2) - p.x) * 0.2
      // 入力で横へ抜けるオプション (バウンド中の左右で微調整)
      const dx = (input.left ? -1 : 0) + (input.right ? 1 : 0)
      if (dx !== 0) {
        p.facing = dx < 0 ? 'left' : 'right'
        p.x += dx * 0.7 * (dtMs / FRAME_MS)
      }
    }

    if (p.bouncePhaseMs >= PLAYER_BOUNCE_PERIOD_MS) {
      // バウンド着地
      arriveBounceLanding(s, input)
    }
    return
  }

  if (p.mode === 'falling') {
    // トランポリン破壊などで自由落下
    p.fallVy += 0.25 * (dtMs / FRAME_MS)
    p.y += p.fallVy * (dtMs / FRAME_MS)
    if (p.y > LOGICAL_H) {
      killPlayer(s)
    }
    return
  }
}

function enterTrampoline(s: State, trampIdx: number, input: Input): void {
  const p = s.player
  const tramp = s.trampolines[trampIdx]
  if (!tramp || tramp.broken) {
    startFall(s)
    return
  }
  p.mode = 'bounce'
  p.trampIdx = trampIdx
  p.bounceCount = 1
  tramp.bounces = Math.max(tramp.bounces, 1)
  p.bounceFromFloor = p.floorIdx
  // 端にいる時は内側へ。中間にいる時はユーザ入力 (Up/Down) を優先、
  // 入力が無ければ上方向をデフォルトにする。
  if (p.floorIdx <= tramp.topFloor) {
    p.verticalIntent = 'down'
    p.bounceToFloor = Math.min(tramp.bottomFloor, p.floorIdx + 1)
  } else if (p.floorIdx >= tramp.bottomFloor) {
    p.verticalIntent = 'up'
    p.bounceToFloor = Math.max(tramp.topFloor, p.floorIdx - 1)
  } else {
    p.verticalIntent = input.down && !input.up ? 'down' : 'up'
    p.bounceToFloor = p.verticalIntent === 'down'
      ? Math.min(tramp.bottomFloor, p.floorIdx + 1)
      : Math.max(tramp.topFloor, p.floorIdx - 1)
  }
  p.bouncePhaseMs = 0
}

function arriveBounceLanding(s: State, input: Input): void {
  const p = s.player
  const tramp = p.trampIdx !== null ? s.trampolines[p.trampIdx] : null
  p.floorIdx = p.bounceToFloor
  // 次のバウンドを発生させるか?
  // 端 (top/bottom) では必ず歩行へ戻る。中間フロアでは Up/Down を押しっぱなしの時のみ
  // バウンドを継続。それ以外はそのフロアに着地して歩ける。
  if (!tramp) {
    p.mode = 'walk'
    p.y = floorYFor(p.floorIdx) - PLAYER_H
    p.trampIdx = null
    p.bounceCount = 0
    return
  }
  const atTop = p.floorIdx <= tramp.topFloor
  const atBottom = p.floorIdx >= tramp.bottomFloor
  const wantsContinue = input.up || input.down
  if (atTop || atBottom || !wantsContinue) {
    // 着地 → walk へ
    p.mode = 'walk'
    p.y = floorYFor(p.floorIdx) - PLAYER_H
    p.trampIdx = null
    p.bounceCount = 0
    // 端着地時のみ、壁めり込み防止に少し横へずらす
    if (atTop || atBottom) {
      const cx = tramp.cx
      if (p.x + PLAYER_W / 2 < cx) p.x = cx - PLAYER_W - 1
      else                          p.x = cx + 1
    }
    return
  }

  // 中間フロアで通過 → さらに次の階へ続行
  p.bounceCount++
  tramp.bounces = Math.max(tramp.bounces, p.bounceCount)
  if (p.bounceCount > TRAMP_MAX_BOUNCES) {
    // 上限超過 = 破壊
    tramp.broken = true
    tramp.rebuildAt = s.totalTimeMs + 4000
    startFall(s)
    return
  }
  // 次のバウンド先
  p.bounceFromFloor = p.floorIdx
  if (p.verticalIntent === 'up') {
    p.bounceToFloor = Math.max(tramp.topFloor, p.floorIdx - 1)
    if (p.bounceToFloor === p.floorIdx) p.verticalIntent = 'down'
  } else {
    p.bounceToFloor = Math.min(tramp.bottomFloor, p.floorIdx + 1)
    if (p.bounceToFloor === p.floorIdx) p.verticalIntent = 'up'
  }
  p.bouncePhaseMs = 0
}

function startFall(s: State): void {
  s.player.mode = 'falling'
  s.player.fallVy = 0
  s.player.trampIdx = null
}

// ============================================
// ドア / 波
// ============================================
function tryOpenDoor(s: State): void {
  const p = s.player
  if (p.mode !== 'walk') return
  for (const d of s.doors) {
    if (d.floorIdx !== p.floorIdx) continue
    if (s.totalTimeMs < d.cooldownUntil) continue
    const dist = Math.abs((p.x + PLAYER_W / 2) - d.x)
    const inRange = (d.side === 'left' && p.x < 36) ||
                    (d.side === 'right' && p.x + PLAYER_W > LOGICAL_W - 36)
    if (!inRange && dist > 30) continue
    // 波を出す (側から内側へ)
    const vx = d.side === 'left' ? WAVE_SPEED : -WAVE_SPEED
    const startX = d.side === 'left' ? 8 : LOGICAL_W - 8 - 24
    s.waves.push({
      id: s.nextId++,
      x: startX,
      y: floorYFor(p.floorIdx) - WAVE_H,
      vx,
      life: WAVE_LIFE_MS,
      bonusZone: false,
    })
    d.cooldownUntil = s.totalTimeMs + 1100
    toast(s, '🚪 DOOR WAVE')
    return
  }
}

function updateWaves(s: State, dtMs: number): void {
  const k = dtMs / FRAME_MS
  for (let i = s.waves.length - 1; i >= 0; i--) {
    const w = s.waves[i]
    w.x += w.vx * k
    w.life -= dtMs
    if (w.life <= 0 || w.x < -40 || w.x > LOGICAL_W + 40) {
      s.waves.splice(i, 1)
    }
  }
}

function collideWaveEnemies(s: State): void {
  for (const w of s.waves) {
    for (const e of s.enemies) {
      if (e.mode === 'gone' || e.mode === 'stunned') continue
      // 波と同じフロアにいる敵のみヒット
      const enemyFloorY = floorYFor(e.floorIdx) - ENEMY_H
      if (Math.abs(e.y - enemyFloorY) > 6) continue
      if (aabb(w.x, w.y, 24, WAVE_H, e.x, e.y, ENEMY_W, ENEMY_H)) {
        // スタン
        e.mode = 'stunned'
        e.stunnedUntil = s.totalTimeMs + ENEMY_STUN_MS
        s.score += ENEMY_STUN_SCORE
        s.enemiesStunned++
        spawnSparks(s, e.x + ENEMY_W / 2, e.y + ENEMY_H / 2, '#6cf2ff', 8)
        toast(s, `🌊 STUN +${ENEMY_STUN_SCORE}`)
      }
    }
  }
}

// (拡張余地: 波の中央に敵が来た時の追加ボーナス。現状は collideWaveEnemies で全判定)
function checkPlayerWavePin(): void { /* noop */ }

// ============================================
// アイテム
// ============================================
function collectItems(s: State): void {
  const p = s.player
  for (const it of s.items) {
    if (it.collected) continue
    if (aabb(p.x, p.y, PLAYER_W, PLAYER_H, it.x - ITEM_W / 2, it.y - ITEM_H / 2, ITEM_W, ITEM_H)) {
      it.collected = true
      s.itemsCollected++
      // コンボ判定
      if (s.lastItemKind === it.kind) {
        s.comboCount = Math.min(s.comboCount + 1, COMBO_SCORE_MULT.length)
      } else {
        s.comboCount = 1
      }
      s.lastItemKind = it.kind
      const mult = COMBO_SCORE_MULT[s.comboCount - 1]
      const gain = ITEM_BASE_SCORE * mult
      s.score += gain
      spawnSparks(s, it.x, it.y, ITEM_COLOR[it.kind], 5)
      if (s.comboCount >= 2) toast(s, `${ITEM_EMOJI[it.kind]} ×${mult}  +${gain}`)
    }
  }
}

// ============================================
// 敵
// ============================================
function updateEnemies(s: State, dtMs: number): void {
  for (const e of s.enemies) {
    if (e.mode === 'gone') {
      if (e.respawnFromAt !== null && s.totalTimeMs >= e.respawnFromAt) {
        // 復活: 上端フロアの左 or 右からエントリー
        e.floorIdx = 0
        e.x = Math.random() < 0.5 ? 6 : LOGICAL_W - ENEMY_W - 6
        e.facing = e.x < LOGICAL_W / 2 ? 'right' : 'left'
        e.y = floorYFor(e.floorIdx) - ENEMY_H
        e.mode = 'walk'
        e.respawnFromAt = null
        e.nextDecisionAt = s.totalTimeMs + 1200
      }
      continue
    }
    if (e.mode === 'stunned') {
      if (s.totalTimeMs >= e.stunnedUntil) {
        e.mode = 'walk'
      }
      continue
    }

    if (e.mode === 'walk') {
      const k = dtMs / FRAME_MS
      const dx = e.facing === 'left' ? -1 : 1
      const nextX = e.x + dx * ENEMY_WALK_SPEED * k
      // 壁で反転
      if (nextX < 2) {
        e.facing = 'right'
        e.x = 2
      } else if (nextX + ENEMY_W > LOGICAL_W - 2) {
        e.facing = 'left'
        e.x = LOGICAL_W - 2 - ENEMY_W
      } else {
        // トランポリン乗り判定
        const cx = nextX + ENEMY_W / 2
        const ti = trampolineAtX(s, cx)
        if (ti >= 0) {
          const t = s.trampolines[ti]
          if (!t.broken && e.floorIdx >= t.topFloor && e.floorIdx <= t.bottomFloor) {
            // 確率的に乗る (たまに止まって反転)
            if (s.totalTimeMs >= e.nextDecisionAt) {
              if (Math.random() < 0.7) {
                // 乗る
                e.mode = 'bounce'
                e.trampIdx = ti
                e.bounceFromFloor = e.floorIdx
                // 上方向 or 下方向 (画面端の方優先)
                if (e.floorIdx >= t.bottomFloor) {
                  e.bounceToFloor = Math.max(t.topFloor, e.floorIdx - 1)
                } else if (e.floorIdx <= t.topFloor) {
                  e.bounceToFloor = Math.min(t.bottomFloor, e.floorIdx + 1)
                } else {
                  e.bounceToFloor = Math.random() < 0.5
                    ? Math.max(t.topFloor, e.floorIdx - 1)
                    : Math.min(t.bottomFloor, e.floorIdx + 1)
                }
                e.bouncePhaseMs = 0
                e.nextDecisionAt = s.totalTimeMs + 1200 + Math.random() * 1200
              } else {
                e.facing = e.facing === 'left' ? 'right' : 'left'
                e.nextDecisionAt = s.totalTimeMs + 1200 + Math.random() * 1200
              }
            } else {
              // まだ判断時刻でない → 通過
              e.x = nextX
            }
          } else if (t.broken && e.floorIdx >= t.topFloor && e.floorIdx <= t.bottomFloor) {
            // 穴に転落 → 退出してリスポーン
            e.mode = 'gone'
            e.respawnFromAt = s.totalTimeMs + ENEMY_RESPAWN_MS
            spawnSparks(s, e.x + ENEMY_W / 2, e.y + ENEMY_H / 2, '#888', 4)
          } else {
            e.x = nextX
          }
        } else {
          e.x = nextX
        }
      }
      e.y = floorYFor(e.floorIdx) - ENEMY_H
    } else if (e.mode === 'bounce') {
      e.bouncePhaseMs += dtMs
      const t = clamp01(e.bouncePhaseMs / PLAYER_BOUNCE_PERIOD_MS)
      const y0 = floorYFor(e.bounceFromFloor) - ENEMY_H
      const y1 = floorYFor(e.bounceToFloor) - ENEMY_H
      e.y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 22
      const tramp = e.trampIdx !== null ? s.trampolines[e.trampIdx] : null
      if (tramp) e.x += ((tramp.cx - ENEMY_W / 2) - e.x) * 0.2
      if (e.bouncePhaseMs >= PLAYER_BOUNCE_PERIOD_MS) {
        e.floorIdx = e.bounceToFloor
        e.mode = 'walk'
        e.y = floorYFor(e.floorIdx) - ENEMY_H
        e.trampIdx = null
        // 着地後の歩行方向はランダム
        e.facing = Math.random() < 0.5 ? 'left' : 'right'
        e.nextDecisionAt = s.totalTimeMs + 1500 + Math.random() * 1500
      }
    }
  }
}

// ============================================
// トランポリン
// ============================================
function updateTrampolines(s: State): void {
  for (const t of s.trampolines) {
    if (t.broken && t.rebuildAt !== null && s.totalTimeMs >= t.rebuildAt) {
      t.broken = false
      t.bounces = 0
      t.rebuildAt = null
    }
  }
}

// ============================================
// 衝突 (プレイヤー vs 敵)
// ============================================
function checkPlayerEnemy(s: State): void {
  if (s.totalTimeMs < s.player.invincibleUntil) return
  for (const e of s.enemies) {
    if (e.mode === 'gone' || e.mode === 'stunned') continue
    if (aabb(s.player.x, s.player.y, PLAYER_W, PLAYER_H,
            e.x, e.y, ENEMY_W, ENEMY_H)) {
      // バウンド中のプレイヤーは無敵気味 → ただし同じトランポリン列上のバウンドはアウト
      killPlayer(s)
      return
    }
  }
}

function killPlayer(s: State): void {
  s.player.alive = false
  s.noMiss = false
  s.lives--
  s.flashLife = 200
  spawnSparks(s, s.player.x + PLAYER_W / 2, s.player.y + PLAYER_H / 2, '#ff6188', 14)
  s.player.respawnAt = s.totalTimeMs + 1200
}

// ============================================
// パーティクル
// ============================================
function updateParticles(s: State, dtMs: number): void {
  const k = dtMs / FRAME_MS
  for (let i = s.particles.length - 1; i >= 0; i--) {
    const p = s.particles[i]
    p.x += p.vx * k
    p.y += p.vy * k
    p.vy += 0.06 * k
    p.life -= dtMs
    if (p.life <= 0) s.particles.splice(i, 1)
  }
}

function spawnSparks(s: State, x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const v = 0.6 + Math.random() * 1.6
    s.particles.push({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6,
      life: 360 + Math.random() * 240, maxLife: 600, color, size: 1.6,
    })
  }
}

// ============================================
// ヘルパ
// ============================================
function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v }
function randPick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function toast(s: State, text: string): void {
  s.toast = { text, until: s.totalTimeMs + 1400 }
}
