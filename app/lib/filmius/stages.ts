// ============================================
// FILMIUS — stage definitions
// ============================================
// 各ステージは「スクリプトされたスポーンイベント」のリスト。
// ステージ時刻 (stageTimeMs) が atMs を超えるとイベントを発火する。

import {
  type State,
  type StageRuntime,
  type EnemyKind,
  spawnEnemy,
  LOGICAL_H,
  LOGICAL_W,
} from './engine'

interface ScriptEvent {
  atMs: number
  fn: (s: State) => void
}

export interface StageDef {
  name: string
  subtitle: string
  events: ScriptEvent[]
  bossAtMs: number
  bossKind: 'boss1' | 'boss2' | 'boss3'
}

// 編隊生成ユーティリティ
function formation(s: State, kind: EnemyKind, count: number, baseY: number, spread = 22, capsuleAt = -1) {
  for (let i = 0; i < count; i++) {
    spawnEnemy(s, {
      kind,
      x: LOGICAL_W + i * 28,
      y: baseY + (i % 2 === 0 ? 0 : spread),
      carriesCapsule: i === capsuleAt,
    })
  }
}

// ============================================
// Stage 1: GALACTIC PREMIERE
// ============================================
const STAGE_1: StageDef = {
  name: 'GALACTIC PREMIERE',
  subtitle: 'STAGE 1',
  bossAtMs: 50_000,
  bossKind: 'boss1',
  events: [
    { atMs:  1_200, fn: s => formation(s, 'grunt', 4, 60) },
    { atMs:  3_400, fn: s => formation(s, 'grunt', 4, 180, 22, 1) },
    { atMs:  6_500, fn: s => formation(s, 'wave', 3, 90) },
    { atMs:  9_500, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.6 }) },
    { atMs: 11_000, fn: s => formation(s, 'grunt', 5, 140, 18, 2) },
    { atMs: 14_500, fn: s => formation(s, 'wave', 4, 70, 24, 3) },
    { atMs: 17_500, fn: s => spawnEnemy(s, { kind: 'tank', x: LOGICAL_W, y: 150 }) },
    { atMs: 20_500, fn: s => formation(s, 'grunt', 6, 200, 16) },
    { atMs: 23_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: LOGICAL_H - 32, vx: -0.6 }) },
    { atMs: 25_500, fn: s => formation(s, 'wave', 4, 120, 30, 0) },
    { atMs: 28_500, fn: s => formation(s, 'grunt', 5, 80, 18) },
    { atMs: 30_500, fn: s => spawnEnemy(s, { kind: 'tank', x: LOGICAL_W, y: 70, carriesCapsule: true }) },
    { atMs: 33_500, fn: s => formation(s, 'wave', 5, 150, 22, 2) },
    { atMs: 36_500, fn: s => formation(s, 'grunt', 6, 30, 20) },
    { atMs: 39_500, fn: s => formation(s, 'grunt', 6, 220, 20, 3) },
    { atMs: 42_500, fn: s => spawnEnemy(s, { kind: 'tank', x: LOGICAL_W, y: 130 }) },
    { atMs: 45_500, fn: s => formation(s, 'wave', 4, 100, 30, 1) },
  ],
}

// ============================================
// Stage 2: ASTEROID OF MEMORIES
// ============================================
const STAGE_2: StageDef = {
  name: 'ASTEROID OF MEMORIES',
  subtitle: 'STAGE 2',
  bossAtMs: 52_000,
  bossKind: 'boss2',
  events: [
    { atMs:  1_200, fn: s => formation(s, 'wave', 5, 80, 24) },
    { atMs:  3_500, fn: s => formation(s, 'wave', 5, 180, 24, 2) },
    { atMs:  6_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.4 }) },
    { atMs:  6_400, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 30, y: LOGICAL_H - 32, vx: -0.4 }) },
    { atMs:  9_500, fn: s => formation(s, 'tank' as EnemyKind, 2, 130, 50, 1) },
    { atMs: 12_500, fn: s => formation(s, 'grunt', 8, 60, 18) },
    { atMs: 15_000, fn: s => formation(s, 'grunt', 8, 200, 18, 4) },
    { atMs: 18_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.5 }) },
    { atMs: 18_200, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: LOGICAL_H - 32, vx: -0.5 }) },
    { atMs: 21_000, fn: s => formation(s, 'wave', 6, 120, 28, 3) },
    { atMs: 24_000, fn: s => formation(s, 'tank' as EnemyKind, 3, 80, 60, 1) },
    { atMs: 28_000, fn: s => formation(s, 'wave', 7, 160, 22, 5) },
    { atMs: 31_000, fn: s => formation(s, 'grunt', 8, 40, 18) },
    { atMs: 33_500, fn: s => formation(s, 'grunt', 8, 220, 18) },
    { atMs: 36_500, fn: s => spawnEnemy(s, { kind: 'tank', x: LOGICAL_W, y: 130, carriesCapsule: true }) },
    { atMs: 39_500, fn: s => formation(s, 'wave', 6, 90, 30, 2) },
    { atMs: 42_500, fn: s => formation(s, 'tank' as EnemyKind, 3, 150, 30) },
    { atMs: 45_500, fn: s => formation(s, 'wave', 6, 120, 26, 3) },
    { atMs: 48_000, fn: s => formation(s, 'grunt', 10, 80, 16, 5) },
  ],
}

// ============================================
// Stage 3: THE FINAL CUT
// ============================================
const STAGE_3: StageDef = {
  name: 'THE FINAL CUT',
  subtitle: 'FINAL STAGE',
  bossAtMs: 36_000,
  bossKind: 'boss3',
  events: [
    { atMs:  1_000, fn: s => formation(s, 'grunt', 10, 60, 16) },
    { atMs:  2_500, fn: s => formation(s, 'grunt', 10, 200, 16, 5) },
    { atMs:  5_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.6 }) },
    { atMs:  5_200, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 20, y: LOGICAL_H - 32, vx: -0.6 }) },
    { atMs:  7_500, fn: s => formation(s, 'wave', 8, 120, 30) },
    { atMs: 10_000, fn: s => formation(s, 'tank' as EnemyKind, 3, 100, 50, 1) },
    { atMs: 13_000, fn: s => formation(s, 'wave', 9, 80, 28, 4) },
    { atMs: 16_000, fn: s => formation(s, 'grunt', 12, 180, 16) },
    { atMs: 19_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.7 }) },
    { atMs: 19_200, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: LOGICAL_H - 32, vx: -0.7 }) },
    { atMs: 21_500, fn: s => formation(s, 'tank' as EnemyKind, 4, 60, 50, 2) },
    { atMs: 24_500, fn: s => formation(s, 'wave', 10, 150, 22, 6) },
    { atMs: 27_500, fn: s => formation(s, 'grunt', 12, 30, 18) },
    { atMs: 30_000, fn: s => formation(s, 'grunt', 12, 220, 18, 5) },
    { atMs: 32_500, fn: s => formation(s, 'tank' as EnemyKind, 4, 130, 30, 2) },
  ],
}

export const STAGES: StageDef[] = [STAGE_1, STAGE_2, STAGE_3]

// ============================================
// ステージランタイム
// ============================================
// 1 つのインスタンスでステージを跨いで使う。currentStageIdx と event cursor を保持。
export function makeStageRuntime(): StageRuntime & { reset: () => void } {
  let cursor = 0
  let bossSpawned = false

  function getStage(s: State): StageDef {
    return STAGES[Math.min(s.stageIdx, STAGES.length - 1)]
  }

  function reset() {
    cursor = 0
    bossSpawned = false
  }

  function onStageStart(s: State) {
    cursor = 0
    bossSpawned = false
    s.toast = {
      text: `${getStage(s).subtitle}: ${getStage(s).name}`,
      until: s.totalTimeMs + 2400,
    }
  }

  function advance(s: State) {
    const def = getStage(s)
    // スポーンイベント
    while (cursor < def.events.length && s.stageTimeMs >= def.events[cursor].atMs) {
      def.events[cursor].fn(s)
      cursor++
    }
    // ボス: 規定時刻 + 既存敵が概ね片付いていることを条件に出現
    if (!bossSpawned && s.stageTimeMs >= def.bossAtMs && nonBossEnemyCount(s) === 0) {
      spawnBoss(s, def.bossKind)
      bossSpawned = true
      s.bossSpawned = true
      s.toast = { text: '⚠ WARNING ⚠', until: s.totalTimeMs + 2200 }
    }
  }

  return { advance, onStageStart, reset }
}

function nonBossEnemyCount(s: State): number {
  let n = 0
  for (const e of s.enemies) {
    if (e.kind !== 'boss1' && e.kind !== 'boss2' && e.kind !== 'boss3') n++
  }
  return n
}

function spawnBoss(s: State, kind: 'boss1' | 'boss2' | 'boss3') {
  if (kind === 'boss1') {
    // EVIL TWIN: 双子。それぞれが他方を partner として参照
    const a = spawnEnemy(s, { kind: 'boss1', x: LOGICAL_W - 10, y: LOGICAL_H / 2 - 28 })
    const b = spawnEnemy(s, { kind: 'boss1', x: LOGICAL_W - 10, y: LOGICAL_H / 2 + 28 })
    a.partner = b.id
    b.partner = a.id
  } else if (kind === 'boss2') {
    spawnEnemy(s, { kind: 'boss2', x: LOGICAL_W - 30, y: LOGICAL_H / 2 - 18 })
  } else {
    spawnEnemy(s, { kind: 'boss3', x: LOGICAL_W - 40, y: LOGICAL_H / 2 - 24 })
  }
}
