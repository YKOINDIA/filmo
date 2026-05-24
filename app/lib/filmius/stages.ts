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
  /** ボスの HP/連射倍率。難ステージで既存ボスを使い回すために掛ける。省略時 1.0。 */
  bossHpMul?: number
  bossFireMul?: number
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
  subtitle: 'STAGE 3',
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

// ============================================
// Stage 4: NEBULA OF TRIALS
// ============================================
// 砲台 × tank の二重圧 + 大編隊。バリアと OPTION 前提の難ステージ。
const STAGE_4: StageDef = {
  name: 'NEBULA OF TRIALS',
  subtitle: 'STAGE 4',
  bossAtMs: 56_000,
  bossKind: 'boss2',
  bossHpMul: 1.6,
  bossFireMul: 0.8,
  events: [
    // 開幕: 上下砲台 + grunt の挟撃
    { atMs:    800, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.4 }) },
    { atMs:  1_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 30, y: LOGICAL_H - 32, vx: -0.4 }) },
    { atMs:  2_000, fn: s => formation(s, 'grunt', 8, 60, 16) },
    { atMs:  3_000, fn: s => formation(s, 'grunt', 8, 200, 16, 4) },
    { atMs:  5_500, fn: s => formation(s, 'wave', 8, 100, 24, 3) },
    // 砲台連打
    { atMs:  7_500, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.6 }) },
    { atMs:  7_700, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 40, y: 14, vx: -0.6 }) },
    { atMs:  7_900, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 80, y: LOGICAL_H - 32, vx: -0.6 }) },
    { atMs: 10_000, fn: s => formation(s, 'tank' as EnemyKind, 4, 80, 40, 2) },
    { atMs: 13_000, fn: s => formation(s, 'wave', 10, 60, 22) },
    { atMs: 15_500, fn: s => formation(s, 'wave', 10, 180, 22, 5) },
    { atMs: 18_500, fn: s => formation(s, 'grunt', 12, 30, 18) },
    { atMs: 19_500, fn: s => formation(s, 'grunt', 12, 220, 18, 6) },
    // 砲台ライン (4 連)
    { atMs: 22_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.5 }) },
    { atMs: 22_100, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 30, y: LOGICAL_H - 32, vx: -0.5 }) },
    { atMs: 22_200, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 60, y: 14, vx: -0.5 }) },
    { atMs: 22_300, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 90, y: LOGICAL_H - 32, vx: -0.5 }) },
    { atMs: 25_500, fn: s => formation(s, 'tank' as EnemyKind, 4, 130, 30, 2) },
    { atMs: 28_500, fn: s => formation(s, 'wave', 12, 80, 24, 6) },
    { atMs: 31_500, fn: s => formation(s, 'grunt', 14, 200, 14) },
    { atMs: 34_000, fn: s => spawnEnemy(s, { kind: 'tank', x: LOGICAL_W, y: 70, carriesCapsule: true }) },
    { atMs: 36_500, fn: s => formation(s, 'wave', 12, 140, 26, 7) },
    { atMs: 39_500, fn: s => formation(s, 'tank' as EnemyKind, 5, 60, 50, 2) },
    { atMs: 42_500, fn: s => formation(s, 'grunt', 14, 30, 16, 7) },
    { atMs: 45_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.7 }) },
    { atMs: 45_200, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: LOGICAL_H - 32, vx: -0.7 }) },
    { atMs: 47_500, fn: s => formation(s, 'wave', 12, 120, 28, 6) },
    { atMs: 50_500, fn: s => formation(s, 'tank' as EnemyKind, 5, 150, 28, 3) },
    { atMs: 53_500, fn: s => formation(s, 'grunt', 16, 80, 14, 8) },
  ],
}

// ============================================
// Stage 5: DIRECTOR'S CUT
// ============================================
// 弾幕 + 群体押し。強化された PROJECTOR LORD。
const STAGE_5: StageDef = {
  name: "DIRECTOR'S CUT",
  subtitle: 'STAGE 5',
  bossAtMs: 50_000,
  bossKind: 'boss3',
  bossHpMul: 2.0,
  bossFireMul: 0.7,
  events: [
    // 冒頭から圧
    { atMs:    500, fn: s => formation(s, 'grunt', 14, 50, 14) },
    { atMs:  1_500, fn: s => formation(s, 'grunt', 14, 210, 14, 7) },
    { atMs:  3_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.7 }) },
    { atMs:  3_100, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 20, y: LOGICAL_H - 32, vx: -0.7 }) },
    { atMs:  4_500, fn: s => formation(s, 'wave', 12, 90, 26) },
    { atMs:  6_500, fn: s => formation(s, 'wave', 12, 170, 26, 6) },
    // tank の壁
    { atMs:  9_000, fn: s => formation(s, 'tank' as EnemyKind, 5, 70, 36, 2) },
    { atMs: 11_500, fn: s => formation(s, 'tank' as EnemyKind, 5, 180, 36, 2) },
    { atMs: 14_000, fn: s => formation(s, 'grunt', 16, 40, 14) },
    { atMs: 15_500, fn: s => formation(s, 'grunt', 16, 200, 14, 8) },
    // 砲台 6 連 (上下交互)
    { atMs: 17_500, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W,        y: 14, vx: -0.7 }) },
    { atMs: 17_600, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 30, y: LOGICAL_H - 32, vx: -0.7 }) },
    { atMs: 17_700, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 60, y: 14, vx: -0.7 }) },
    { atMs: 17_800, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 90, y: LOGICAL_H - 32, vx: -0.7 }) },
    { atMs: 17_900, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 120, y: 14, vx: -0.7 }) },
    { atMs: 18_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 150, y: LOGICAL_H - 32, vx: -0.7 }) },
    { atMs: 21_500, fn: s => formation(s, 'wave', 14, 60, 28, 7) },
    { atMs: 24_000, fn: s => formation(s, 'wave', 14, 180, 28, 7) },
    { atMs: 26_500, fn: s => formation(s, 'tank' as EnemyKind, 6, 100, 30, 3) },
    { atMs: 29_500, fn: s => formation(s, 'grunt', 18, 30, 14, 9) },
    { atMs: 31_000, fn: s => formation(s, 'grunt', 18, 220, 14, 9) },
    { atMs: 33_500, fn: s => spawnEnemy(s, { kind: 'tank', x: LOGICAL_W, y: 80, carriesCapsule: true }) },
    { atMs: 35_500, fn: s => formation(s, 'wave', 16, 130, 24, 8) },
    { atMs: 38_500, fn: s => formation(s, 'tank' as EnemyKind, 6, 60, 40, 3) },
    { atMs: 41_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.8 }) },
    { atMs: 41_100, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: LOGICAL_H - 32, vx: -0.8 }) },
    { atMs: 41_200, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 40, y: 14, vx: -0.8 }) },
    { atMs: 41_300, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 40, y: LOGICAL_H - 32, vx: -0.8 }) },
    { atMs: 44_000, fn: s => formation(s, 'wave', 16, 100, 28, 8) },
    { atMs: 47_000, fn: s => formation(s, 'grunt', 20, 130, 12, 10) },
  ],
}

// ============================================
// Stage 6: SEQUEL FATIGUE
// ============================================
// 双子ボスの再臨。波 (wave) と砲台の二重圧。
const STAGE_6: StageDef = {
  name: 'SEQUEL FATIGUE',
  subtitle: 'STAGE 6',
  bossAtMs: 52_000,
  bossKind: 'boss1',
  bossHpMul: 2.4,
  bossFireMul: 0.65,
  events: [
    { atMs:    600, fn: s => formation(s, 'wave', 12, 60, 22) },
    { atMs:  1_600, fn: s => formation(s, 'wave', 12, 200, 22, 6) },
    { atMs:  3_500, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.7 }) },
    { atMs:  3_700, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 30, y: LOGICAL_H - 32, vx: -0.7 }) },
    { atMs:  5_000, fn: s => formation(s, 'grunt', 14, 90, 16) },
    { atMs:  6_500, fn: s => formation(s, 'grunt', 14, 180, 16, 7) },
    { atMs:  8_500, fn: s => formation(s, 'tank' as EnemyKind, 5, 70, 36, 2) },
    { atMs: 11_500, fn: s => formation(s, 'wave', 14, 120, 26, 7) },
    // 砲台 4 連
    { atMs: 14_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.6 }) },
    { atMs: 14_100, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 40, y: LOGICAL_H - 32, vx: -0.6 }) },
    { atMs: 14_200, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 80, y: 14, vx: -0.6 }) },
    { atMs: 14_300, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 120, y: LOGICAL_H - 32, vx: -0.6 }) },
    { atMs: 17_500, fn: s => formation(s, 'tank' as EnemyKind, 5, 170, 30, 2) },
    { atMs: 20_500, fn: s => formation(s, 'grunt', 16, 40, 14) },
    { atMs: 22_000, fn: s => formation(s, 'grunt', 16, 210, 14, 8) },
    { atMs: 25_000, fn: s => formation(s, 'wave', 14, 80, 28, 7) },
    { atMs: 28_000, fn: s => spawnEnemy(s, { kind: 'tank', x: LOGICAL_W, y: 70, carriesCapsule: true }) },
    { atMs: 30_500, fn: s => formation(s, 'wave', 14, 160, 26, 7) },
    { atMs: 33_500, fn: s => formation(s, 'tank' as EnemyKind, 6, 100, 30, 3) },
    { atMs: 36_500, fn: s => formation(s, 'grunt', 18, 30, 14, 9) },
    { atMs: 39_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.8 }) },
    { atMs: 39_200, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: LOGICAL_H - 32, vx: -0.8 }) },
    { atMs: 41_500, fn: s => formation(s, 'wave', 14, 130, 28, 7) },
    { atMs: 44_500, fn: s => formation(s, 'tank' as EnemyKind, 6, 60, 40, 3) },
    { atMs: 47_500, fn: s => formation(s, 'grunt', 18, 220, 14, 9) },
  ],
}

// ============================================
// Stage 7: REEL OF SHADOWS
// ============================================
// DARK FORCE の円形弾幕が主役。tank と砲台の固い壁が増える。
const STAGE_7: StageDef = {
  name: 'REEL OF SHADOWS',
  subtitle: 'STAGE 7',
  bossAtMs: 54_000,
  bossKind: 'boss2',
  bossHpMul: 2.6,
  bossFireMul: 0.6,
  events: [
    // 開幕: tank の壁
    { atMs:    600, fn: s => formation(s, 'tank' as EnemyKind, 4, 70, 36, 1) },
    { atMs:  2_500, fn: s => formation(s, 'tank' as EnemyKind, 4, 170, 36, 2) },
    { atMs:  4_500, fn: s => formation(s, 'wave', 14, 100, 24, 7) },
    { atMs:  6_500, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.6 }) },
    { atMs:  6_600, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 24, y: 14, vx: -0.6 }) },
    { atMs:  6_700, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 48, y: LOGICAL_H - 32, vx: -0.6 }) },
    { atMs:  6_800, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 72, y: LOGICAL_H - 32, vx: -0.6 }) },
    { atMs:  9_500, fn: s => formation(s, 'grunt', 18, 60, 14, 9) },
    { atMs: 11_500, fn: s => formation(s, 'grunt', 18, 200, 14, 9) },
    { atMs: 14_000, fn: s => formation(s, 'wave', 16, 130, 26, 8) },
    { atMs: 17_000, fn: s => formation(s, 'tank' as EnemyKind, 6, 80, 32, 3) },
    { atMs: 20_000, fn: s => formation(s, 'tank' as EnemyKind, 6, 180, 32, 3) },
    // 砲台ライン (6 連)
    { atMs: 23_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.7 }) },
    { atMs: 23_100, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 30, y: LOGICAL_H - 32, vx: -0.7 }) },
    { atMs: 23_200, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 60, y: 14, vx: -0.7 }) },
    { atMs: 23_300, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 90, y: LOGICAL_H - 32, vx: -0.7 }) },
    { atMs: 23_400, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 120, y: 14, vx: -0.7 }) },
    { atMs: 23_500, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 150, y: LOGICAL_H - 32, vx: -0.7 }) },
    { atMs: 27_000, fn: s => formation(s, 'wave', 18, 60, 22, 9) },
    { atMs: 30_000, fn: s => formation(s, 'wave', 18, 200, 22, 9) },
    { atMs: 33_500, fn: s => spawnEnemy(s, { kind: 'tank', x: LOGICAL_W, y: 100, carriesCapsule: true }) },
    { atMs: 35_500, fn: s => formation(s, 'grunt', 20, 30, 12, 10) },
    { atMs: 37_500, fn: s => formation(s, 'grunt', 20, 220, 12, 10) },
    { atMs: 40_500, fn: s => formation(s, 'tank' as EnemyKind, 7, 120, 26, 3) },
    { atMs: 44_000, fn: s => formation(s, 'wave', 18, 90, 24, 9) },
    { atMs: 47_500, fn: s => formation(s, 'wave', 18, 170, 24, 9) },
    { atMs: 50_500, fn: s => formation(s, 'grunt', 22, 130, 12, 11) },
  ],
}

// ============================================
// Stage 8: CRITIC'S NIGHTMARE
// ============================================
// 砲台密集 × wave 弾幕。スキマを縫う精度が必要。
const STAGE_8: StageDef = {
  name: "CRITIC'S NIGHTMARE",
  subtitle: 'STAGE 8',
  bossAtMs: 55_000,
  bossKind: 'boss3',
  bossHpMul: 3.0,
  bossFireMul: 0.6,
  events: [
    // 開幕から砲台 6 連
    { atMs:    400, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W,        y: 14, vx: -0.8 }) },
    { atMs:    450, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 30, y: LOGICAL_H - 32, vx: -0.8 }) },
    { atMs:    500, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 60, y: 14, vx: -0.8 }) },
    { atMs:    550, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 90, y: LOGICAL_H - 32, vx: -0.8 }) },
    { atMs:    600, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 120, y: 14, vx: -0.8 }) },
    { atMs:    650, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 150, y: LOGICAL_H - 32, vx: -0.8 }) },
    { atMs:  3_500, fn: s => formation(s, 'wave', 18, 70, 24, 9) },
    { atMs:  5_500, fn: s => formation(s, 'wave', 18, 200, 24, 9) },
    { atMs:  8_500, fn: s => formation(s, 'tank' as EnemyKind, 6, 100, 34, 3) },
    { atMs: 11_500, fn: s => formation(s, 'grunt', 20, 40, 14, 10) },
    { atMs: 13_500, fn: s => formation(s, 'grunt', 20, 210, 14, 10) },
    // 上下砲台 + tank の二重圧
    { atMs: 16_500, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.6 }) },
    { atMs: 16_700, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: LOGICAL_H - 32, vx: -0.6 }) },
    { atMs: 17_500, fn: s => formation(s, 'tank' as EnemyKind, 4, 120, 30, 2) },
    { atMs: 20_500, fn: s => formation(s, 'wave', 18, 90, 22, 9) },
    { atMs: 23_500, fn: s => formation(s, 'wave', 18, 170, 22, 9) },
    { atMs: 26_500, fn: s => formation(s, 'tank' as EnemyKind, 7, 60, 32, 3) },
    { atMs: 29_500, fn: s => formation(s, 'tank' as EnemyKind, 7, 180, 32, 3) },
    { atMs: 33_000, fn: s => spawnEnemy(s, { kind: 'tank', x: LOGICAL_W, y: 100, carriesCapsule: true }) },
    // 砲台 8 連
    { atMs: 36_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W,        y: 14, vx: -0.9 }) },
    { atMs: 36_100, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 25, y: LOGICAL_H - 32, vx: -0.9 }) },
    { atMs: 36_200, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 50, y: 14, vx: -0.9 }) },
    { atMs: 36_300, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 75, y: LOGICAL_H - 32, vx: -0.9 }) },
    { atMs: 36_400, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 100, y: 14, vx: -0.9 }) },
    { atMs: 36_500, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 125, y: LOGICAL_H - 32, vx: -0.9 }) },
    { atMs: 36_600, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 150, y: 14, vx: -0.9 }) },
    { atMs: 36_700, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 175, y: LOGICAL_H - 32, vx: -0.9 }) },
    { atMs: 41_000, fn: s => formation(s, 'grunt', 22, 30, 12, 11) },
    { atMs: 42_500, fn: s => formation(s, 'grunt', 22, 220, 12, 11) },
    { atMs: 45_500, fn: s => formation(s, 'wave', 20, 130, 26, 10) },
    { atMs: 48_500, fn: s => formation(s, 'tank' as EnemyKind, 8, 80, 28, 4) },
    { atMs: 51_500, fn: s => formation(s, 'grunt', 24, 130, 11, 12) },
  ],
}

// ============================================
// Stage 9: WRAP PARTY
// ============================================
// 全員集合。EVIL TWIN ふたたび、HP 大盛り。
const STAGE_9: StageDef = {
  name: 'WRAP PARTY',
  subtitle: 'STAGE 9',
  bossAtMs: 56_000,
  bossKind: 'boss1',
  bossHpMul: 3.4,
  bossFireMul: 0.55,
  events: [
    // 怒涛の開幕
    { atMs:    400, fn: s => formation(s, 'grunt', 20, 40, 12, 10) },
    { atMs:  1_400, fn: s => formation(s, 'grunt', 20, 220, 12, 10) },
    { atMs:  2_500, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.8 }) },
    { atMs:  2_600, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 30, y: LOGICAL_H - 32, vx: -0.8 }) },
    { atMs:  2_700, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 60, y: 14, vx: -0.8 }) },
    { atMs:  2_800, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 90, y: LOGICAL_H - 32, vx: -0.8 }) },
    { atMs:  4_500, fn: s => formation(s, 'wave', 18, 80, 22, 9) },
    { atMs:  6_500, fn: s => formation(s, 'wave', 18, 200, 22, 9) },
    { atMs:  9_000, fn: s => formation(s, 'tank' as EnemyKind, 6, 100, 32, 3) },
    { atMs: 11_500, fn: s => formation(s, 'tank' as EnemyKind, 6, 180, 32, 3) },
    { atMs: 14_500, fn: s => formation(s, 'grunt', 22, 60, 12, 11) },
    { atMs: 16_500, fn: s => formation(s, 'grunt', 22, 210, 12, 11) },
    // 砲台 6 連
    { atMs: 19_500, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -0.9 }) },
    { atMs: 19_600, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 30, y: LOGICAL_H - 32, vx: -0.9 }) },
    { atMs: 19_700, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 60, y: 14, vx: -0.9 }) },
    { atMs: 19_800, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 90, y: LOGICAL_H - 32, vx: -0.9 }) },
    { atMs: 19_900, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 120, y: 14, vx: -0.9 }) },
    { atMs: 20_000, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 150, y: LOGICAL_H - 32, vx: -0.9 }) },
    { atMs: 23_500, fn: s => formation(s, 'wave', 20, 90, 24, 10) },
    { atMs: 26_500, fn: s => formation(s, 'wave', 20, 170, 24, 10) },
    { atMs: 29_500, fn: s => formation(s, 'tank' as EnemyKind, 8, 70, 28, 4) },
    { atMs: 32_500, fn: s => spawnEnemy(s, { kind: 'tank', x: LOGICAL_W, y: 100, carriesCapsule: true }) },
    { atMs: 35_000, fn: s => formation(s, 'wave', 20, 130, 24, 10) },
    { atMs: 38_000, fn: s => formation(s, 'grunt', 24, 40, 12, 12) },
    { atMs: 39_500, fn: s => formation(s, 'grunt', 24, 220, 12, 12) },
    { atMs: 42_500, fn: s => formation(s, 'tank' as EnemyKind, 8, 150, 28, 4) },
    { atMs: 45_500, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -1.0 }) },
    { atMs: 45_600, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: LOGICAL_H - 32, vx: -1.0 }) },
    { atMs: 45_700, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 40, y: 14, vx: -1.0 }) },
    { atMs: 45_800, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 40, y: LOGICAL_H - 32, vx: -1.0 }) },
    { atMs: 48_500, fn: s => formation(s, 'wave', 22, 100, 26, 11) },
    { atMs: 51_500, fn: s => formation(s, 'grunt', 26, 130, 10, 13) },
  ],
}

// ============================================
// Stage 10: GOLDEN CURTAIN (TRUE FINAL)
// ============================================
// 真のラスト。全敵種が踊り狂う極限弾幕。最終ボスは桁違いの HP。
const STAGE_10: StageDef = {
  name: 'GOLDEN CURTAIN',
  subtitle: 'FINAL STAGE',
  bossAtMs: 58_000,
  bossKind: 'boss3',
  bossHpMul: 4.0,
  bossFireMul: 0.5,
  events: [
    // 開幕弾幕
    { atMs:    300, fn: s => formation(s, 'grunt', 24, 40, 12, 12) },
    { atMs:  1_300, fn: s => formation(s, 'grunt', 24, 220, 12, 12) },
    { atMs:  2_500, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -1.0 }) },
    { atMs:  2_550, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 25, y: LOGICAL_H - 32, vx: -1.0 }) },
    { atMs:  2_600, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 50, y: 14, vx: -1.0 }) },
    { atMs:  2_650, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 75, y: LOGICAL_H - 32, vx: -1.0 }) },
    { atMs:  4_500, fn: s => formation(s, 'wave', 20, 70, 22, 10) },
    { atMs:  6_500, fn: s => formation(s, 'wave', 20, 200, 22, 10) },
    { atMs:  9_000, fn: s => formation(s, 'tank' as EnemyKind, 7, 90, 30, 3) },
    { atMs: 11_500, fn: s => formation(s, 'tank' as EnemyKind, 7, 180, 30, 3) },
    { atMs: 14_500, fn: s => formation(s, 'grunt', 24, 30, 12, 12) },
    { atMs: 16_000, fn: s => formation(s, 'grunt', 24, 230, 12, 12) },
    // 砲台 10 連
    { atMs: 18_500, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W,        y: 14, vx: -1.0 }) },
    { atMs: 18_550, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 22, y: LOGICAL_H - 32, vx: -1.0 }) },
    { atMs: 18_600, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 44, y: 14, vx: -1.0 }) },
    { atMs: 18_650, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 66, y: LOGICAL_H - 32, vx: -1.0 }) },
    { atMs: 18_700, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 88, y: 14, vx: -1.0 }) },
    { atMs: 18_750, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 110, y: LOGICAL_H - 32, vx: -1.0 }) },
    { atMs: 18_800, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 132, y: 14, vx: -1.0 }) },
    { atMs: 18_850, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 154, y: LOGICAL_H - 32, vx: -1.0 }) },
    { atMs: 18_900, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 176, y: 14, vx: -1.0 }) },
    { atMs: 18_950, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 198, y: LOGICAL_H - 32, vx: -1.0 }) },
    { atMs: 22_500, fn: s => formation(s, 'wave', 22, 80, 24, 11) },
    { atMs: 25_000, fn: s => formation(s, 'wave', 22, 190, 24, 11) },
    { atMs: 28_000, fn: s => formation(s, 'tank' as EnemyKind, 9, 60, 28, 4) },
    { atMs: 31_000, fn: s => formation(s, 'tank' as EnemyKind, 9, 180, 28, 4) },
    { atMs: 34_500, fn: s => spawnEnemy(s, { kind: 'tank', x: LOGICAL_W, y: 100, carriesCapsule: true }) },
    { atMs: 36_500, fn: s => formation(s, 'grunt', 26, 40, 11, 13) },
    { atMs: 38_000, fn: s => formation(s, 'grunt', 26, 220, 11, 13) },
    { atMs: 40_500, fn: s => formation(s, 'wave', 22, 130, 26, 11) },
    { atMs: 43_500, fn: s => formation(s, 'tank' as EnemyKind, 10, 80, 26, 5) },
    { atMs: 46_500, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: 14, vx: -1.1 }) },
    { atMs: 46_550, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W, y: LOGICAL_H - 32, vx: -1.1 }) },
    { atMs: 46_600, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 36, y: 14, vx: -1.1 }) },
    { atMs: 46_650, fn: s => spawnEnemy(s, { kind: 'turret', x: LOGICAL_W + 36, y: LOGICAL_H - 32, vx: -1.1 }) },
    { atMs: 49_500, fn: s => formation(s, 'wave', 24, 100, 24, 12) },
    { atMs: 52_500, fn: s => formation(s, 'grunt', 28, 130, 10, 14) },
    { atMs: 55_000, fn: s => formation(s, 'tank' as EnemyKind, 10, 150, 24, 5) },
  ],
}

export const STAGES: StageDef[] = [
  STAGE_1, STAGE_2, STAGE_3, STAGE_4, STAGE_5,
  STAGE_6, STAGE_7, STAGE_8, STAGE_9, STAGE_10,
]

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
      spawnBoss(s, def.bossKind, def.bossHpMul ?? 1, def.bossFireMul ?? 1)
      bossSpawned = true
      s.bossSpawned = true
      s.toast = { text: '⚠ WARNING ⚠', until: s.totalTimeMs + 2200 }
    }
  }

  return { advance, onStageStart, reset, totalStages: STAGES.length }
}

function nonBossEnemyCount(s: State): number {
  let n = 0
  for (const e of s.enemies) {
    if (e.kind !== 'boss1' && e.kind !== 'boss2' && e.kind !== 'boss3') n++
  }
  return n
}

function spawnBoss(
  s: State,
  kind: 'boss1' | 'boss2' | 'boss3',
  hpMul: number,
  fireMul: number,
) {
  const apply = (e: ReturnType<typeof spawnEnemy>) => {
    if (hpMul !== 1) {
      const newHp = Math.max(1, Math.round(e.maxHp * hpMul))
      e.hp = newHp
      e.maxHp = newHp
    }
    if (fireMul !== 1 && e.fireCooldown > 0) {
      e.fireCooldown = Math.max(80, Math.round(e.fireCooldown * fireMul))
    }
  }
  if (kind === 'boss1') {
    // EVIL TWIN: 双子。それぞれが他方を partner として参照
    const a = spawnEnemy(s, { kind: 'boss1', x: LOGICAL_W - 10, y: LOGICAL_H / 2 - 28 })
    const b = spawnEnemy(s, { kind: 'boss1', x: LOGICAL_W - 10, y: LOGICAL_H / 2 + 28 })
    a.partner = b.id
    b.partner = a.id
    apply(a); apply(b)
  } else if (kind === 'boss2') {
    apply(spawnEnemy(s, { kind: 'boss2', x: LOGICAL_W - 30, y: LOGICAL_H / 2 - 18 }))
  } else {
    apply(spawnEnemy(s, { kind: 'boss3', x: LOGICAL_W - 40, y: LOGICAL_H / 2 - 24 }))
  }
}
