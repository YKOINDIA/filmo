/**
 * CRYSTAL BLAST — game engine (pure, no React, no I/O).
 *
 * ぷよぷよ系のルール:
 *  - 6 列 × 12 行のフィールドに、2 個 1 組のクリスタル (axis + companion) が落下
 *  - 同色 4 個以上の連結で消滅
 *  - 連鎖 (chain) が増えるほどスコア倍率が上昇
 *  - 対戦時、スコアに応じて「お邪魔ガベージ」を相手に送る
 *
 * セル値:
 *   0  = 空
 *   1〜5 = クリスタル色
 *   -1 = ガベージ (色なし。隣接消去時のみ消える)
 */

export const COLS = 6
export const ROWS = 12
export const COLOR_COUNT = 5
export const POP_THRESHOLD = 4
export const GARBAGE_PER_ROW = 6 // 6 個 = 1 行分

export type CellValue = number // 0 / 1..5 / -1
export type Board = CellValue[][]
export type Color = 1 | 2 | 3 | 4 | 5
export type Rotation = 0 | 1 | 2 | 3 // 0=above, 1=right, 2=below, 3=left (companion 相対位置)

export interface Piece {
  axisRow: number
  axisCol: number
  axisColor: Color
  satColor: Color // satellite = companion
  rotation: Rotation
}

// ====================================================
// Random helper (seedable for replay / deterministic tests)
// ====================================================
export function mulberry32(seed: number) {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomColor(rand: () => number): Color {
  return (Math.floor(rand() * COLOR_COUNT) + 1) as Color
}

export function newPiece(rand: () => number): Piece {
  return {
    axisRow: 1,
    axisCol: 2,
    axisColor: randomColor(rand),
    satColor: randomColor(rand),
    rotation: 0,
  }
}

// ====================================================
// Board ops
// ====================================================
export function emptyBoard(): Board {
  const b: Board = []
  for (let r = 0; r < ROWS; r++) b.push(new Array(COLS).fill(0))
  return b
}

export function cloneBoard(b: Board): Board {
  return b.map(row => row.slice())
}

export function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS
}

export function satOffset(rot: Rotation): [number, number] {
  switch (rot) {
    case 0: return [-1, 0] // above
    case 1: return [0, 1]  // right
    case 2: return [1, 0]  // below
    case 3: return [0, -1] // left
  }
}

export function pieceCells(p: Piece): { axis: [number, number]; sat: [number, number] } {
  const [dr, dc] = satOffset(p.rotation)
  return {
    axis: [p.axisRow, p.axisCol],
    sat: [p.axisRow + dr, p.axisCol + dc],
  }
}

/** その位置に置けるかどうか (盤外/重複チェック)。axis が画面外でも companion が画面内ならOKとする (上スポーン用) */
export function canPlace(b: Board, p: Piece): boolean {
  const { axis, sat } = pieceCells(p)
  for (const [r, c] of [axis, sat]) {
    if (c < 0 || c >= COLS) return false
    if (r >= ROWS) return false
    if (r >= 0 && b[r][c] !== 0) return false
  }
  return true
}

export function tryMove(b: Board, p: Piece, dc: number): Piece | null {
  const np: Piece = { ...p, axisCol: p.axisCol + dc }
  return canPlace(b, np) ? np : null
}

export function tryRotate(b: Board, p: Piece, dir: 1 | -1): Piece | null {
  const nr: Rotation = (((p.rotation + dir) % 4) + 4) % 4 as Rotation
  // basic rotation
  const np: Piece = { ...p, rotation: nr }
  if (canPlace(b, np)) return np
  // wall kick: 横にずらしてみる
  for (const k of [-1, 1, -2, 2]) {
    const kicked: Piece = { ...np, axisCol: np.axisCol + k }
    if (canPlace(b, kicked)) return kicked
  }
  // double rotation kick (axis を companion 側に押し込む)
  const flipped: Piece = { ...p, rotation: ((p.rotation + 2) % 4) as Rotation }
  if (canPlace(b, flipped)) return flipped
  return null
}

/** 現在のピースを 1 マス落としたものを返す。落とせなければ null */
export function softDrop(b: Board, p: Piece): Piece | null {
  const np: Piece = { ...p, axisRow: p.axisRow + 1 }
  return canPlace(b, np) ? np : null
}

/** ハードドロップ: 現在のピースをこれ以上落とせない位置まで一気に落とした結果 */
export function hardDropTarget(b: Board, p: Piece): Piece {
  let cur = p
  while (true) {
    const next = softDrop(b, cur)
    if (!next) return cur
    cur = next
  }
}

/** ピースを盤面に固定して新しい board を返す。companion が axis より上にある場合でも、両者は個別に落下する (Puyo 仕様) */
export function lockPiece(b: Board, p: Piece): Board {
  const out = cloneBoard(b)
  const { axis, sat } = pieceCells(p)
  // それぞれを別個にその列の最も下まで落下させる
  // axis と sat が同列の場合は順序が重要 (下にある方を先に置く)
  const placements = [
    { r: axis[0], c: axis[1], color: p.axisColor as number },
    { r: sat[0], c: sat[1], color: p.satColor as number },
  ]
  // 下の行 (r が大きい) を先に処理
  placements.sort((a, b) => b.r - a.r)
  for (const { c, color } of placements) {
    if (c < 0 || c >= COLS) continue
    // その列の最も下の空きを探す
    let target = -1
    for (let r = ROWS - 1; r >= 0; r--) {
      if (out[r][c] === 0) { target = r; break }
    }
    if (target < 0) continue // 列が満杯
    out[target][c] = color
  }
  return out
}

/** 重力: 浮いているセルを下に詰める */
export function applyGravity(b: Board): Board {
  const out: Board = b.map(row => row.slice())
  for (let c = 0; c < COLS; c++) {
    let writeR = ROWS - 1
    for (let r = ROWS - 1; r >= 0; r--) {
      if (out[r][c] !== 0) {
        const v = out[r][c]
        out[r][c] = 0
        out[writeR][c] = v
        writeR--
      }
    }
  }
  return out
}

// ====================================================
// Connected groups (flood fill)
// ====================================================
interface Group {
  color: Color
  cells: [number, number][]
}

function findColorGroups(b: Board): Group[] {
  const visited: boolean[][] = []
  for (let r = 0; r < ROWS; r++) visited.push(new Array(COLS).fill(false))

  const groups: Group[] = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = b[r][c]
      if (v <= 0 || visited[r][c]) continue
      const color = v as Color
      const cells: [number, number][] = []
      const stack: [number, number][] = [[r, c]]
      visited[r][c] = true
      while (stack.length) {
        const [cr, cc] = stack.pop()!
        cells.push([cr, cc])
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const nr = cr + dr, nc = cc + dc
          if (!inBounds(nr, nc) || visited[nr][nc]) continue
          if (b[nr][nc] === color) {
            visited[nr][nc] = true
            stack.push([nr, nc])
          }
        }
      }
      groups.push({ color, cells })
    }
  }
  return groups
}

// ====================================================
// Pop + chain resolution
// ====================================================
const CHAIN_POWER: number[] = [
  0, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512,
]
const COLOR_BONUS: Record<number, number> = { 1: 0, 2: 3, 3: 6, 4: 12, 5: 24 }
function groupBonus(size: number): number {
  if (size <= 4) return 0
  if (size === 5) return 2
  if (size === 6) return 3
  if (size === 7) return 4
  if (size <= 10) return 5
  return 10
}

export interface ChainStep {
  popped: number
  colors: number
  score: number
  cells: [number, number][]
}

/** 一度の重力後にあるグループから popping を行う。chain が起きる限り繰り返す */
export function resolveChain(initial: Board): {
  board: Board
  chains: ChainStep[]
  totalScore: number
  totalPops: number
} {
  let board = applyGravity(initial)
  const chains: ChainStep[] = []
  let totalScore = 0
  let totalPops = 0

  for (let chainIdx = 1; chainIdx <= 19; chainIdx++) {
    const groups = findColorGroups(board)
    const popping = groups.filter(g => g.cells.length >= POP_THRESHOLD)
    if (popping.length === 0) break

    const poppedCells = new Set<string>()
    const colorsPopped = new Set<Color>()
    let groupBonusSum = 0
    let poppedCount = 0
    for (const g of popping) {
      colorsPopped.add(g.color)
      groupBonusSum += groupBonus(g.cells.length)
      poppedCount += g.cells.length
      for (const [r, c] of g.cells) poppedCells.add(`${r},${c}`)
    }

    // 隣接ガベージも一緒に消す
    const garbageToPop = new Set<string>()
    for (const key of poppedCells) {
      const [r, c] = key.split(',').map(Number)
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nr = r + dr, nc = c + dc
        if (inBounds(nr, nc) && board[nr][nc] === -1) {
          garbageToPop.add(`${nr},${nc}`)
        }
      }
    }

    // スコア計算 (ぷよぷよ式)
    const chainPower = CHAIN_POWER[Math.min(chainIdx, CHAIN_POWER.length - 1)]
    const colorBonus = COLOR_BONUS[colorsPopped.size] ?? 24
    const bonus = Math.max(1, chainPower + colorBonus + groupBonusSum)
    const stepScore = poppedCount * 10 * bonus
    totalScore += stepScore
    totalPops += poppedCount

    chains.push({
      popped: poppedCount,
      colors: colorsPopped.size,
      score: stepScore,
      cells: [...poppedCells].map(s => s.split(',').map(Number) as [number, number]),
    })

    // 盤面更新
    const next = cloneBoard(board)
    for (const key of poppedCells) {
      const [r, c] = key.split(',').map(Number)
      next[r][c] = 0
    }
    for (const key of garbageToPop) {
      const [r, c] = key.split(',').map(Number)
      next[r][c] = 0
    }
    board = applyGravity(next)
  }

  return { board, chains, totalScore, totalPops }
}

// ====================================================
// Garbage drop
// ====================================================
/** 落下準備中のガベージを盤面に降らせる。最上行から順に空きへ配置する */
export function dropGarbage(b: Board, count: number, rand: () => number): Board {
  if (count <= 0) return b
  const out = cloneBoard(b)
  let remaining = Math.min(count, ROWS * COLS) // 上限あり
  const colOrder = Array.from({ length: COLS }, (_, i) => i)
  // 列をシャッフルして 1 行ずつ落とす (見た目の散らばりを出す)
  while (remaining > 0) {
    // 各列に何個落とすか: 列をシャッフルしてその先頭 N 列に 1 つずつ
    const n = Math.min(remaining, COLS)
    for (let i = colOrder.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[colOrder[i], colOrder[j]] = [colOrder[j], colOrder[i]]
    }
    for (let i = 0; i < n; i++) {
      const c = colOrder[i]
      // その列の最も上の空き行 (= 重力後にその列の最も上に積まれる位置)
      let target = -1
      for (let r = 0; r < ROWS; r++) {
        if (out[r][c] === 0) { target = r; break }
      }
      if (target >= 0) {
        // 既存ブロックの上に積みたいので、その列で空きの一番下を探す
        // (実際は applyGravity で詰めるので、空き行のうち最も小さい r に置けば良い)
        out[target][c] = -1
      }
    }
    remaining -= n
  }
  return applyGravity(out)
}

/** 連鎖スコアから相手に送る garbage 数を算出 */
export function scoreToGarbage(score: number, marginScore = 70): number {
  return Math.floor(score / marginScore)
}

// ====================================================
// Game over check
// ====================================================
/** スポーン地点 (row 1, col 2) が埋まっていれば敗北 */
export function isTopOut(b: Board): boolean {
  return b[1][2] !== 0 || b[0][2] !== 0
}
