// ============================================
// FILMAPPY — stage definitions
// ============================================
// 3 ステージのレイアウト (トランポリン列・アイテム・敵配置・ドア)。
// マッピーランド方針: ステージ全アイテム回収でクリア。
//
// 座標系は engine.LOGICAL_W (480) × LOGICAL_H (270)、
// floorIdx 0 が最上段で FLOOR_COUNT-1 が最下段。

import {
  type ItemKind,
  type Stage,
  type State,
  type StageRuntime,
  FLOOR_COUNT,
  LOGICAL_W,
  floorYFor,
  loadStage,
} from './engine'

// アイテムを「floorIdx + x」で指定するための薄いヘルパ
function item(floorIdx: number, x: number, kind: ItemKind) {
  return { x, y: floorYFor(floorIdx) - 8, kind }
}

// ============================================
// STAGE 1: GRAND PREMIERE
// ============================================
// 入門ステージ。トランポリン 3 本、敵 2 体。
const STAGE_1: Stage = {
  name: 'GRAND PREMIERE',
  subtitle: 'STAGE 1',
  trampolines: [
    { cx: 130, topFloor: 0, bottomFloor: FLOOR_COUNT - 1 },
    { cx: 240, topFloor: 0, bottomFloor: FLOOR_COUNT - 1 },
    { cx: 350, topFloor: 0, bottomFloor: FLOOR_COUNT - 1 },
  ],
  doors: [
    { floorIdx: 0, side: 'left'  },
    { floorIdx: 2, side: 'right' },
    { floorIdx: 4, side: 'left'  },
  ],
  items: [
    // 上段: フィルムリール 連続配置 (コンボ狙い)
    item(0, 60,  'reel'),
    item(0, 190, 'reel'),
    item(0, 300, 'reel'),
    item(0, 420, 'reel'),

    // 2段目: ポップコーン
    item(1, 80,  'popcorn'),
    item(1, 180, 'popcorn'),
    item(1, 300, 'popcorn'),
    item(1, 410, 'popcorn'),

    // 中段: ポスター + チケットを混ぜる
    item(2, 60,  'poster'),
    item(2, 175, 'ticket'),
    item(2, 305, 'poster'),
    item(2, 420, 'ticket'),

    // 4段目: ポップコーン
    item(3, 70,  'popcorn'),
    item(3, 190, 'popcorn'),
    item(3, 295, 'popcorn'),
    item(3, 410, 'popcorn'),

    // 下段: フィナーレのオスカー像
    item(4, 70,  'oscar'),
    item(4, 410, 'oscar'),
  ],
  enemies: [
    { kind: 'spoiler', floorIdx: 0, x: LOGICAL_W - 40, facing: 'left'  },
    { kind: 'pirate',  floorIdx: 2, x: 40,             facing: 'right' },
  ],
}

// ============================================
// STAGE 2: SNEAK PREVIEW
// ============================================
// トランポリン 3 本だが、フロアの「歩ける幅」が狭く敵が多い。
const STAGE_2: Stage = {
  name: 'SNEAK PREVIEW',
  subtitle: 'STAGE 2',
  trampolines: [
    { cx: 100, topFloor: 0, bottomFloor: FLOOR_COUNT - 1 },
    { cx: 230, topFloor: 0, bottomFloor: FLOOR_COUNT - 1 },
    { cx: 380, topFloor: 0, bottomFloor: FLOOR_COUNT - 1 },
  ],
  doors: [
    { floorIdx: 0, side: 'right' },
    { floorIdx: 1, side: 'left'  },
    { floorIdx: 3, side: 'right' },
    { floorIdx: 4, side: 'left'  },
  ],
  items: [
    item(0, 50,  'oscar'),
    item(0, 160, 'oscar'),
    item(0, 290, 'oscar'),
    item(0, 430, 'oscar'),

    item(1, 50,  'ticket'),
    item(1, 165, 'reel'),
    item(1, 305, 'ticket'),
    item(1, 430, 'reel'),

    item(2, 40,  'poster'),
    item(2, 150, 'poster'),
    item(2, 280, 'poster'),
    item(2, 405, 'poster'),
    item(2, 435, 'poster'),

    item(3, 50,  'popcorn'),
    item(3, 165, 'reel'),
    item(3, 305, 'popcorn'),
    item(3, 430, 'reel'),

    item(4, 50,  'ticket'),
    item(4, 165, 'ticket'),
    item(4, 305, 'ticket'),
    item(4, 430, 'ticket'),
  ],
  enemies: [
    { kind: 'spoiler', floorIdx: 0, x: 40,             facing: 'right' },
    { kind: 'pirate',  floorIdx: 2, x: LOGICAL_W - 40, facing: 'left'  },
    { kind: 'spoiler', floorIdx: 4, x: LOGICAL_W / 2,  facing: 'right' },
  ],
}

// ============================================
// STAGE 3: THE FINAL SHOW
// ============================================
// 敵 4 体、トランポリン 4 本、アイテムは「同色 4 連」を意識的に潰した配置。
const STAGE_3: Stage = {
  name: 'THE FINAL SHOW',
  subtitle: 'FINAL STAGE',
  trampolines: [
    { cx: 90,  topFloor: 0, bottomFloor: FLOOR_COUNT - 1 },
    { cx: 200, topFloor: 0, bottomFloor: FLOOR_COUNT - 1 },
    { cx: 290, topFloor: 0, bottomFloor: FLOOR_COUNT - 1 },
    { cx: 400, topFloor: 0, bottomFloor: FLOOR_COUNT - 1 },
  ],
  doors: [
    { floorIdx: 0, side: 'left'  },
    { floorIdx: 0, side: 'right' },
    { floorIdx: 2, side: 'left'  },
    { floorIdx: 2, side: 'right' },
    { floorIdx: 4, side: 'left'  },
    { floorIdx: 4, side: 'right' },
  ],
  items: [
    item(0, 40,  'oscar'),
    item(0, 140, 'reel'),
    item(0, 240, 'oscar'),
    item(0, 340, 'reel'),
    item(0, 440, 'oscar'),

    item(1, 40,  'popcorn'),
    item(1, 140, 'ticket'),
    item(1, 240, 'popcorn'),
    item(1, 340, 'ticket'),
    item(1, 440, 'popcorn'),

    item(2, 40,  'poster'),
    item(2, 130, 'oscar'),
    item(2, 250, 'poster'),
    item(2, 340, 'oscar'),
    item(2, 440, 'poster'),

    item(3, 40,  'popcorn'),
    item(3, 140, 'reel'),
    item(3, 240, 'popcorn'),
    item(3, 340, 'reel'),
    item(3, 440, 'popcorn'),

    item(4, 40,  'oscar'),
    item(4, 140, 'ticket'),
    item(4, 240, 'oscar'),
    item(4, 340, 'ticket'),
    item(4, 440, 'oscar'),
  ],
  enemies: [
    { kind: 'spoiler', floorIdx: 0, x: 30,             facing: 'right' },
    { kind: 'pirate',  floorIdx: 1, x: LOGICAL_W - 40, facing: 'left'  },
    { kind: 'spoiler', floorIdx: 2, x: LOGICAL_W / 2,  facing: 'left'  },
    { kind: 'pirate',  floorIdx: 4, x: 30,             facing: 'right' },
  ],
}

export const STAGES: Stage[] = [STAGE_1, STAGE_2, STAGE_3]

// ============================================
// ステージランタイム
// ============================================
export function makeStageRuntime(): StageRuntime {
  function onStageStart(s: State) {
    const stage = STAGES[Math.min(s.stageIdx, STAGES.length - 1)]
    loadStage(s, stage)
    s.toast = {
      text: `${stage.subtitle}: ${stage.name}`,
      until: s.totalTimeMs + 2400,
    }
  }
  function advance() {
    // 現状ステージ内動的スポーンなし。
    // (拡張余地: 時間経過で敵をボス化など)
  }
  return { onStageStart, advance }
}

export function getStageMeta(idx: number) {
  const st = STAGES[Math.min(idx, STAGES.length - 1)]
  return { name: st.name, subtitle: st.subtitle }
}
