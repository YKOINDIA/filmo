'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Input,
  type Mode,
  type State,
  LOGICAL_H,
  LOGICAL_W,
  PLAYER_W,
  initialState,
  step,
} from './engine'
import { makeStageRuntime } from './stages'
import { render } from './render'

export interface FilmappyResult {
  score: number
  stageReached: number   // 1..3 (途中で死亡) または 4 (全クリ)
  cleared: boolean
  noMiss: boolean
  itemsCollected: number
  enemiesStunned: number
  durationMs: number
}

interface UseFilmappyOpts {
  onEnd?: (r: FilmappyResult) => void
}

export function useFilmappy(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  opts: UseFilmappyOpts = {},
) {
  const [running, setRunning] = useState(false)
  const [snapshotMode, setSnapshotMode] = useState<Mode>('playing')

  const stateRef = useRef<State>(initialState())
  const stageRuntimeRef = useRef<ReturnType<typeof makeStageRuntime> | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number>(0)
  const lastModeRef = useRef<Mode>('playing')
  const endedRef = useRef(false)
  const inputRef = useRef<Input>({
    up: false, down: false, left: false, right: false,
    doorAction: false, doorPressed: false,
  })
  const onEndRef = useRef(opts.onEnd)
  useEffect(() => { onEndRef.current = opts.onEnd }, [opts.onEnd])

  // ───── ループ ────────────────────────────
  // 依存ゼロ。state は ref で保持し、useCallback で 1 度作るだけ。
  const loop = useCallback((now: number) => {
    const canvas = canvasRef.current
    if (!canvas) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }
    const dt = Math.min(50, now - (lastFrameRef.current || now))
    lastFrameRef.current = now

    const stage = stageRuntimeRef.current
    if (stage) step(stateRef.current, dt, inputRef.current, stage)

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const targetW = Math.floor(rect.width * dpr)
    const targetH = Math.floor(rect.height * dpr)
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW
      canvas.height = targetH
    }
    render(ctx, stateRef.current, rect.width, rect.height, dpr)

    const mode = stateRef.current.mode
    if (mode !== lastModeRef.current) {
      lastModeRef.current = mode
      setSnapshotMode(mode)
    }

    if ((mode === 'game-over' || mode === 'all-cleared') && !endedRef.current) {
      endedRef.current = true
      finishGame()
      return
    }
    rafRef.current = requestAnimationFrame(loop)
  // canvasRef.current は ref。finishGame も後段で useCallback 化されるが
  // この loop は初回マウント時に 1 回だけ作って使い回す。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finishGame = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setRunning(false)
    const s = stateRef.current
    const result: FilmappyResult = {
      score: s.score,
      stageReached: s.mode === 'all-cleared' ? 4 : s.stageIdx + 1,
      cleared: s.mode === 'all-cleared',
      noMiss: s.noMiss && s.mode === 'all-cleared',
      itemsCollected: s.itemsCollected,
      enemiesStunned: s.enemiesStunned,
      durationMs: Math.round(s.totalTimeMs),
    }
    onEndRef.current?.(result)
  }, [])

  const start = useCallback(() => {
    stateRef.current = initialState()
    stageRuntimeRef.current = makeStageRuntime()
    stageRuntimeRef.current.onStageStart(stateRef.current)
    inputRef.current = {
      up: false, down: false, left: false, right: false,
      doorAction: false, doorPressed: false,
    }
    lastFrameRef.current = 0
    lastModeRef.current = 'playing'
    endedRef.current = false
    setSnapshotMode('playing')
    setRunning(true)
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(loop)
  }, [loop])

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setRunning(false)
  }, [])

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

  // ───── キーボード入力 ────────────────────────────
  useEffect(() => {
    if (!running) return
    const down = (e: KeyboardEvent) => {
      const k = e.key
      if (k === 'ArrowUp'    || k === 'w' || k === 'W') { inputRef.current.up = true; e.preventDefault() }
      if (k === 'ArrowDown'  || k === 's' || k === 'S') { inputRef.current.down = true; e.preventDefault() }
      if (k === 'ArrowLeft'  || k === 'a' || k === 'A') { inputRef.current.left = true; e.preventDefault() }
      if (k === 'ArrowRight' || k === 'd' || k === 'D') { inputRef.current.right = true; e.preventDefault() }
      if (k === 'z' || k === 'Z' || k === 'x' || k === 'X' || k === ' ') {
        inputRef.current.doorAction = true; e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key
      if (k === 'ArrowUp'    || k === 'w' || k === 'W') inputRef.current.up = false
      if (k === 'ArrowDown'  || k === 's' || k === 'S') inputRef.current.down = false
      if (k === 'ArrowLeft'  || k === 'a' || k === 'A') inputRef.current.left = false
      if (k === 'ArrowRight' || k === 'd' || k === 'D') inputRef.current.right = false
      if (k === 'z' || k === 'Z' || k === 'x' || k === 'X' || k === ' ') inputRef.current.doorAction = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [running])

  // ───── タッチ入力 (左右ドラッグで歩行、上下フリックでバウンド方向) ────────────
  // canvas 上のタッチ: 指の x 位置がプレイヤーより右にあれば右歩行、左なら左歩行。
  // 指を上にスワイプすると Up 入力 (バウンド上方向)、下スワイプで Down 入力。
  // モバイル用ドア発射ボタンは page.tsx に置く。
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !running) return
    let dragId: number | null = null
    let scaleRef = 1
    let offXRef = 0
    let lastY = 0

    const computeScale = () => {
      const rect = canvas.getBoundingClientRect()
      scaleRef = Math.min(rect.width / LOGICAL_W, rect.height / LOGICAL_H) || 1
      offXRef = rect.left + (rect.width - LOGICAL_W * scaleRef) / 2
    }

    const applyDir = (clientX: number) => {
      computeScale()
      const logicalX = (clientX - offXRef) / scaleRef
      const p = stateRef.current.player
      const playerCx = p.x + PLAYER_W / 2
      const dead = 6
      if (logicalX < playerCx - dead) {
        inputRef.current.left = true; inputRef.current.right = false
      } else if (logicalX > playerCx + dead) {
        inputRef.current.right = true; inputRef.current.left = false
      } else {
        inputRef.current.left = false; inputRef.current.right = false
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (dragId !== null) return
      dragId = e.pointerId
      lastY = e.clientY
      applyDir(e.clientX)
      try { canvas.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== dragId) return
      applyDir(e.clientX)
      // 上下フリック
      const dy = e.clientY - lastY
      if (Math.abs(dy) > 18) {
        if (dy < 0) { inputRef.current.up = true; inputRef.current.down = false }
        else        { inputRef.current.down = true; inputRef.current.up = false }
        lastY = e.clientY
      }
    }
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== dragId) return
      dragId = null
      inputRef.current.left = false
      inputRef.current.right = false
      inputRef.current.up = false
      inputRef.current.down = false
      try { canvas.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
    }
  }, [canvasRef, running])

  // ───── 外部 API ────────────────────────────
  const triggerDoor = useCallback(() => {
    inputRef.current.doorAction = true
    setTimeout(() => { inputRef.current.doorAction = false }, 100)
  }, [])

  return {
    running,
    mode: snapshotMode,
    start,
    stop,
    triggerDoor,
    getState: () => stateRef.current,
  }
}
