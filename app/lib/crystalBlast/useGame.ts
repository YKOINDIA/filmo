'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  COLS,
  ROWS,
  emptyBoard,
  newPiece,
  lockPiece,
  resolveChain,
  dropGarbage,
  scoreToGarbage,
  softDrop,
  tryMove,
  tryRotate,
  hardDropTarget,
  isTopOut,
  mulberry32,
  type Board,
  type Piece,
} from './engine'

export interface GameState {
  board: Board
  current: Piece | null
  next: Piece | null
  score: number
  chain: number      // 直近の連鎖数
  maxChain: number   // セッション中の最大連鎖
  totalPops: number
  pendingGarbage: number // 相手から送られて未着の garbage
  flashCells: [number, number][] // 最後に消えたセル (アニメーション用)
  gameOver: boolean
  startedAt: number
  level: number      // 落下速度の段階
}

export interface GameCallbacks {
  /** 自分が連鎖を起こしたとき、相手に送る garbage 数 */
  onAttack?: (garbage: number, chain: number, score: number) => void
  /** ゲーム終了時 */
  onGameOver?: (finalScore: number, maxChain: number, totalPops: number, durationMs: number) => void
}

export interface UseGameOptions {
  /** 乱数シード (対戦時に同期する場合に指定。未指定ならランダム) */
  seed?: number
  /** 受信した garbage キューを外部から差し込めるようにする */
  callbacks?: GameCallbacks
  /** スタート時に自動でループを開始するか */
  autoStart?: boolean
}

function initialState(seed: number): GameState {
  const rand = mulberry32(seed)
  return {
    board: emptyBoard(),
    current: newPiece(rand),
    next: newPiece(rand),
    score: 0,
    chain: 0,
    maxChain: 0,
    totalPops: 0,
    pendingGarbage: 0,
    flashCells: [],
    gameOver: false,
    startedAt: Date.now(),
    level: 1,
  }
}

const BASE_TICK_MS = 800
const MIN_TICK_MS = 180

function tickMsForLevel(level: number) {
  return Math.max(MIN_TICK_MS, BASE_TICK_MS - (level - 1) * 60)
}

export function useGame(options: UseGameOptions = {}) {
  // seed は useState の lazy init で初期化することで Math.random 呼び出しを render 中に直接行わない
  const [seed, setSeed] = useState<number>(() => options.seed ?? Math.floor(Math.random() * 0x7fffffff))
  const randRef = useRef<() => number>(mulberry32(seed))
  const [state, setState] = useState<GameState>(() => initialState(seed))
  const stateRef = useRef(state)
  const callbacksRef = useRef(options.callbacks)
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { callbacksRef.current = options.callbacks }, [options.callbacks])
  const tickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pausedRef = useRef(!options.autoStart)
  const [paused, setPausedState] = useState(!options.autoStart)

  const setPaused = useCallback((p: boolean) => {
    pausedRef.current = p
    setPausedState(p)
  }, [])

  // ====================================================
  // Lock & resolve
  // ====================================================
  const lockAndResolve = useCallback((s: GameState): GameState => {
    if (!s.current) return s
    // 1) ハードドロップ位置で固定 (current は最低位まで落ちきっている前提だが念のため)
    const dropped = hardDropTarget(s.board, s.current)
    let board = lockPiece(s.board, dropped)
    // 2) 連鎖解決
    const { board: resolvedBoard, chains, totalScore, totalPops } = resolveChain(board)
    board = resolvedBoard
    const chainLen = chains.length
    // 3) 攻撃: 連鎖したら相手にお邪魔を送る
    const garbage = scoreToGarbage(totalScore)
    if (garbage > 0 && callbacksRef.current?.onAttack) {
      callbacksRef.current.onAttack(garbage, chainLen, totalScore)
    }
    // 4) 自分のお邪魔キューを相殺してから残りを降らせる
    let pendingG = s.pendingGarbage
    const offset = Math.min(pendingG, garbage)
    pendingG -= offset
    if (pendingG > 0) {
      board = dropGarbage(board, pendingG, randRef.current)
      pendingG = 0
    }
    // 5) 次のピース
    const nextCurrent = s.next ?? newPiece(randRef.current)
    const nextNext = newPiece(randRef.current)
    const over = isTopOut(board)
    const flashCells = chains.length > 0 ? chains[chains.length - 1].cells : []

    const newScore = s.score + totalScore
    const newMaxChain = Math.max(s.maxChain, chainLen)
    const newPops = s.totalPops + totalPops
    const nextLevel = Math.max(1, Math.floor(newScore / 2000) + 1)

    return {
      ...s,
      board,
      current: over ? null : nextCurrent,
      next: over ? null : nextNext,
      score: newScore,
      chain: chainLen,
      maxChain: newMaxChain,
      totalPops: newPops,
      pendingGarbage: pendingG,
      flashCells,
      gameOver: over,
      level: nextLevel,
    }
  }, [])

  // ====================================================
  // Tick (gravity)
  // ====================================================
  const tick = useCallback(() => {
    setState(s => {
      if (s.gameOver || pausedRef.current || !s.current) return s
      const next = softDrop(s.board, s.current)
      if (next) return { ...s, current: next }
      return lockAndResolve(s)
    })
  }, [lockAndResolve])

  useEffect(() => {
    if (paused) return
    let cancelled = false
    const schedule = () => {
      const s = stateRef.current
      if (cancelled || s.gameOver) return
      tickTimer.current = setTimeout(() => {
        tick()
        schedule()
      }, tickMsForLevel(s.level))
    }
    schedule()
    return () => {
      cancelled = true
      if (tickTimer.current) clearTimeout(tickTimer.current)
    }
  }, [paused, tick, state.gameOver])

  // ====================================================
  // Game-over -> notify
  // ====================================================
  const gameOverNotified = useRef(false)
  useEffect(() => {
    if (state.gameOver && !gameOverNotified.current) {
      gameOverNotified.current = true
      const duration = Date.now() - state.startedAt
      callbacksRef.current?.onGameOver?.(state.score, state.maxChain, state.totalPops, duration)
    }
  }, [state.gameOver, state.score, state.maxChain, state.totalPops, state.startedAt])

  // ====================================================
  // Input handlers
  // ====================================================
  const move = useCallback((dc: number) => {
    setState(s => {
      if (s.gameOver || !s.current || pausedRef.current) return s
      const np = tryMove(s.board, s.current, dc)
      return np ? { ...s, current: np } : s
    })
  }, [])

  const rotate = useCallback((dir: 1 | -1 = 1) => {
    setState(s => {
      if (s.gameOver || !s.current || pausedRef.current) return s
      const np = tryRotate(s.board, s.current, dir)
      return np ? { ...s, current: np } : s
    })
  }, [])

  const soft = useCallback(() => {
    setState(s => {
      if (s.gameOver || !s.current || pausedRef.current) return s
      const np = softDrop(s.board, s.current)
      if (np) return { ...s, current: np }
      return lockAndResolve(s)
    })
  }, [lockAndResolve])

  const hard = useCallback(() => {
    setState(s => {
      if (s.gameOver || !s.current || pausedRef.current) return s
      const dropped = hardDropTarget(s.board, s.current)
      return lockAndResolve({ ...s, current: dropped })
    })
  }, [lockAndResolve])

  const restart = useCallback((newSeed?: number) => {
    gameOverNotified.current = false
    const next = newSeed ?? Math.floor(Math.random() * 0x7fffffff)
    setSeed(next)
    randRef.current = mulberry32(next)
    setState(initialState(next))
  }, [])

  /** 外部から garbage を盤面の受信キューに足す (即時降下はしない。次の lock 時に降る) */
  const queueGarbage = useCallback((count: number) => {
    if (count <= 0) return
    setState(s => ({ ...s, pendingGarbage: s.pendingGarbage + count }))
  }, [])

  // 即時に garbage を降らせるバージョン (相手が大連鎖で潰しに来る用)
  const forceDropGarbage = useCallback((count: number) => {
    if (count <= 0) return
    setState(s => {
      const board = dropGarbage(s.board, count, randRef.current)
      const over = isTopOut(board)
      return { ...s, board, gameOver: over }
    })
  }, [])

  const surrender = useCallback(() => {
    setState(s => ({ ...s, gameOver: true }))
  }, [])

  const api = useMemo(() => ({
    move,
    rotate,
    soft,
    hard,
    restart,
    setPaused,
    queueGarbage,
    forceDropGarbage,
    surrender,
    paused,
  }), [move, rotate, soft, hard, restart, setPaused, queueGarbage, forceDropGarbage, surrender, paused])

  return { state, api, COLS, ROWS } as const
}
