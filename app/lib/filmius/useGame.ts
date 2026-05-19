'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Input,
  type Mode,
  type State,
  LOGICAL_H,
  LOGICAL_W,
  initialState,
  step,
} from './engine'
import { makeStageRuntime } from './stages'
import { render } from './render'

export interface FilmiusResult {
  score: number
  stageReached: number   // 1..3 (途中で死亡) または 4 (全クリ)
  cleared: boolean
  noMiss: boolean
  enemiesKilled: number
  durationMs: number
}

interface UseFilmiusOpts {
  onEnd?: (r: FilmiusResult) => void
}

export function useFilmius(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  opts: UseFilmiusOpts = {},
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
    shoot: false, equip: false, equipPressed: false,
  })
  const onEndRef = useRef(opts.onEnd)
  useEffect(() => { onEndRef.current = opts.onEnd }, [opts.onEnd])

  // ───── ループ ────────────────────────────
  // 依存ゼロ。state はすべて ref で持つので useCallback で 1 度だけ作れば十分。
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

    // DPR + サイズ
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
  // canvasRef.current は ref なので変わらない / finishGame も後段で useCallback 化
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finishGame = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setRunning(false)
    const s = stateRef.current
    const result: FilmiusResult = {
      score: s.score,
      stageReached: s.mode === 'all-cleared' ? 4 : s.stageIdx + 1,
      cleared: s.mode === 'all-cleared',
      noMiss: s.noMiss && s.mode === 'all-cleared',
      enemiesKilled: s.enemiesKilled,
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
      shoot: false, equip: false, equipPressed: false,
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

  // 終了時にループも止める (unmount 対応)
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

  // ───── キーボード入力 ────────────────────────────
  useEffect(() => {
    if (!running) return
    const down = (e: KeyboardEvent) => {
      const k = e.key
      if (k === 'ArrowUp' || k === 'w' || k === 'W')     { inputRef.current.up = true; e.preventDefault() }
      if (k === 'ArrowDown' || k === 's' || k === 'S')   { inputRef.current.down = true; e.preventDefault() }
      if (k === 'ArrowLeft' || k === 'a' || k === 'A')   { inputRef.current.left = true; e.preventDefault() }
      if (k === 'ArrowRight' || k === 'd' || k === 'D')  { inputRef.current.right = true; e.preventDefault() }
      if (k === 'z' || k === 'Z' || k === ' ')           { inputRef.current.shoot = true; e.preventDefault() }
      if (k === 'x' || k === 'X' || k === 'Shift')       { inputRef.current.equip = true; e.preventDefault() }
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key
      if (k === 'ArrowUp' || k === 'w' || k === 'W')     inputRef.current.up = false
      if (k === 'ArrowDown' || k === 's' || k === 'S')   inputRef.current.down = false
      if (k === 'ArrowLeft' || k === 'a' || k === 'A')   inputRef.current.left = false
      if (k === 'ArrowRight' || k === 'd' || k === 'D')  inputRef.current.right = false
      if (k === 'z' || k === 'Z' || k === ' ')           inputRef.current.shoot = false
      if (k === 'x' || k === 'X' || k === 'Shift')       inputRef.current.equip = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [running])

  // ───── タッチ入力 (canvas 上のドラッグ + 自動連射) ────────────
  // ドラッグ開始位置を基準にして、移動差分でプレイヤーを動かす方式。
  // フィンガー DOWN 中は自動連射 ON。
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !running) return
    let dragId: number | null = null
    let lastX = 0
    let lastY = 0
    let scaleRef = 1

    const computeScale = () => {
      const rect = canvas.getBoundingClientRect()
      scaleRef = Math.min(rect.width / LOGICAL_W, rect.height / LOGICAL_H) || 1
    }

    const onPointerDown = (e: PointerEvent) => {
      if (dragId !== null) return
      dragId = e.pointerId
      lastX = e.clientX
      lastY = e.clientY
      computeScale()
      inputRef.current.shoot = true
      try { canvas.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== dragId) return
      const dx = (e.clientX - lastX) / scaleRef
      const dy = (e.clientY - lastY) / scaleRef
      lastX = e.clientX
      lastY = e.clientY
      // 軽い加速度: 距離をそのまま入力として扱わず、上下左右 flag に変換
      // 引っかかりを避けるため、プレイヤーを直接 nudge する形にする
      const s = stateRef.current
      if (s.player.alive) {
        s.player.x = Math.max(2, Math.min(LOGICAL_W - 20, s.player.x + dx))
        s.player.y = Math.max(2, Math.min(LOGICAL_H - 12, s.player.y + dy))
      }
    }
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== dragId) return
      dragId = null
      inputRef.current.shoot = false
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
  const triggerEquip = useCallback(() => {
    // 単発: equip を ON にして次フレームで OFF
    inputRef.current.equip = true
    setTimeout(() => { inputRef.current.equip = false }, 100)
  }, [])

  return {
    running,
    mode: snapshotMode,
    start,
    stop,
    triggerEquip,
    /** スナップショット (読み取り専用) */
    getState: () => stateRef.current,
  }
}
