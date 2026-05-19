'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { addPoints, POINT_CONFIG } from '../../lib/points'
import { trackMinigameShared } from '../../lib/analytics'
import { shareToLine } from '../../lib/share'

// ====================================================
// Difficulty config
// ====================================================
// 100K+ ユーザー想定でモバイル画面を最優先。横スクロールが必要な盤面サイズは避ける。
// "Hard" でも 12x16 = 192 マス。古典 Expert (16x30 = 480) より小さいが、
// モバイル前提なら充分挑戦的。

type Difficulty = 'easy' | 'normal' | 'hard'

interface DiffConfig {
  key: Difficulty
  label: string
  emoji: string
  cols: number
  rows: number
  mines: number
  winPoints: number
}

const DIFFICULTIES: DiffConfig[] = [
  { key: 'easy',   label: 'やさしい',   emoji: '🌱', cols: 9,  rows: 9,  mines: 10, winPoints: POINT_CONFIG.MINESWEEPER_WIN_EASY },
  { key: 'normal', label: 'ふつう',     emoji: '⚡', cols: 9,  rows: 12, mines: 20, winPoints: POINT_CONFIG.MINESWEEPER_WIN_NORMAL },
  { key: 'hard',   label: 'むずかしい', emoji: '🔥', cols: 12, rows: 16, mines: 40, winPoints: POINT_CONFIG.MINESWEEPER_WIN_HARD },
]

const SHARE_URL = 'https://filmo.me/games/minesweeper'

// ====================================================
// Board state
// ====================================================
interface Cell {
  isMine: boolean
  revealed: boolean
  flagged: boolean
  adjacent: number // 周囲8マスの爆弾数
}

type Phase = 'menu' | 'playing' | 'won' | 'lost'

interface LeaderboardEntry {
  user_id: string
  user_name: string
  user_avatar: string | null
  best_time_ms: number
  achieved_at: string
}

interface StatEntry {
  difficulty: Difficulty
  best_time_ms: number | null
  wins: number
  total_plays: number
}

// ====================================================
// Helpers
// ====================================================
function buildEmptyBoard(cols: number, rows: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, (): Cell => ({
      isMine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    })),
  )
}

function neighborCoords(c: number, r: number, cols: number, rows: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nc = c + dc
      const nr = r + dr
      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) out.push([nc, nr])
    }
  }
  return out
}

/**
 * 初手 (c0, r0) とその周囲には爆弾を置かない (安全初手保証)。
 * これは古典 Minesweeper の事実上の標準ルール。
 */
function placeMines(board: Cell[][], cols: number, rows: number, mines: number, c0: number, r0: number) {
  const forbidden = new Set<number>()
  forbidden.add(r0 * cols + c0)
  for (const [nc, nr] of neighborCoords(c0, r0, cols, rows)) {
    forbidden.add(nr * cols + nc)
  }

  const total = cols * rows
  const candidates: number[] = []
  for (let i = 0; i < total; i++) if (!forbidden.has(i)) candidates.push(i)
  // shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  const placed = candidates.slice(0, Math.min(mines, candidates.length))
  for (const idx of placed) {
    const r = Math.floor(idx / cols)
    const c = idx % cols
    board[r][c].isMine = true
  }

  // adjacent カウントを埋める
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].isMine) continue
      let count = 0
      for (const [nc, nr] of neighborCoords(c, r, cols, rows)) {
        if (board[nr][nc].isMine) count++
      }
      board[r][c].adjacent = count
    }
  }
}

/**
 * 0 マスから波及して開けるフラッドフィル。flag されたマスは開けない。
 */
function flood(board: Cell[][], cols: number, rows: number, c: number, r: number): number {
  let revealed = 0
  const stack: Array<[number, number]> = [[c, r]]
  while (stack.length) {
    const [cc, rr] = stack.pop()!
    const cell = board[rr][cc]
    if (cell.revealed || cell.flagged) continue
    cell.revealed = true
    revealed++
    if (cell.adjacent === 0 && !cell.isMine) {
      for (const [nc, nr] of neighborCoords(cc, rr, cols, rows)) {
        const n = board[nr][nc]
        if (!n.revealed && !n.flagged) stack.push([nc, nr])
      }
    }
  }
  return revealed
}

function countFlags(board: Cell[][]): number {
  let n = 0
  for (const row of board) for (const c of row) if (c.flagged) n++
  return n
}

function countRevealed(board: Cell[][]): number {
  let n = 0
  for (const row of board) for (const c of row) if (c.revealed) n++
  return n
}

function isWon(board: Cell[][], totalCells: number, mines: number): boolean {
  return countRevealed(board) === totalCells - mines
}

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

const NUMBER_COLORS = [
  '',          // 0 (使わない)
  '#3b82f6',   // 1: blue
  '#10b981',   // 2: green
  '#ef4444',   // 3: red
  '#7c3aed',   // 4: purple
  '#f59e0b',   // 5: amber
  '#06b6d4',   // 6: cyan
  '#1f2937',   // 7: dark
  '#6b7280',   // 8: gray
]

// long press 判定の閾値 (ms)
const LONG_PRESS_MS = 350

// ====================================================
// Page
// ====================================================
export default function MinesweeperPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('menu')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [board, setBoard] = useState<Cell[][]>([])
  const [minesPlaced, setMinesPlaced] = useState(false)
  const [flagMode, setFlagMode] = useState(false) // モバイル: タップでフラッグ
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [pointsAwarded, setPointsAwarded] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [stats, setStats] = useState<Record<Difficulty, StatEntry>>({
    easy:   { difficulty: 'easy',   best_time_ms: null, wins: 0, total_plays: 0 },
    normal: { difficulty: 'normal', best_time_ms: null, wins: 0, total_plays: 0 },
    hard:   { difficulty: 'hard',   best_time_ms: null, wins: 0, total_plays: 0 },
  })
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardDiff, setLeaderboardDiff] = useState<Difficulty>('easy')
  const [error, setError] = useState('')

  const diffConfig = useMemo(
    () => DIFFICULTIES.find(d => d.key === difficulty) || DIFFICULTIES[0],
    [difficulty],
  )

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)

  // ── 認証 + 自分の戦績 ──────────────────────────────
  const loadStats = useCallback(async (uid: string) => {
    const { data } = await supabase.rpc('get_minesweeper_stats', { p_user_id: uid })
    if (!data) return
    const next: Record<Difficulty, StatEntry> = {
      easy:   { difficulty: 'easy',   best_time_ms: null, wins: 0, total_plays: 0 },
      normal: { difficulty: 'normal', best_time_ms: null, wins: 0, total_plays: 0 },
      hard:   { difficulty: 'hard',   best_time_ms: null, wins: 0, total_plays: 0 },
    }
    for (const row of data as StatEntry[]) {
      if (row.difficulty === 'easy' || row.difficulty === 'normal' || row.difficulty === 'hard') {
        next[row.difficulty] = {
          difficulty: row.difficulty,
          best_time_ms: row.best_time_ms,
          wins: row.wins,
          total_plays: row.total_plays,
        }
      }
    }
    setStats(next)
  }, [])

  const fetchLeaderboard = useCallback(async (diff: Difficulty) => {
    setLeaderboardLoading(true)
    try {
      const { data } = await supabase.rpc('get_minesweeper_leaderboard', {
        p_difficulty: diff,
        p_limit: 20,
      })
      setLeaderboard((data || []) as LeaderboardEntry[])
    } catch {
      setLeaderboard([])
    }
    setLeaderboardLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
        loadStats(session.user.id)
      }
    })
  }, [loadStats])

  useEffect(() => {
    fetchLeaderboard(leaderboardDiff)
  }, [fetchLeaderboard, leaderboardDiff])

  // ── タイマー ────────────────────────────────
  useEffect(() => {
    if (phase === 'playing' && startTime) {
      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTime)
      }, 200)
      return () => {
        if (tickRef.current) clearInterval(tickRef.current)
      }
    }
  }, [phase, startTime])

  // ── ゲーム開始 ──────────────────────────────
  function startGame(diff: Difficulty) {
    const cfg = DIFFICULTIES.find(d => d.key === diff) || DIFFICULTIES[0]
    setDifficulty(diff)
    setBoard(buildEmptyBoard(cfg.cols, cfg.rows))
    setMinesPlaced(false)
    setFlagMode(false)
    setStartTime(null)
    setElapsedMs(0)
    setPointsAwarded(0)
    setNewBest(false)
    setError('')
    setPhase('playing')
  }

  function restart() {
    startGame(difficulty)
  }

  // ── マス操作 ────────────────────────────────
  function handleReveal(c: number, r: number) {
    if (phase !== 'playing') return
    const cell = board[r][c]
    if (cell.flagged || cell.revealed) return

    // event handler 内なので Date.now() は副作用 OK (lint は誤検知)
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()

    // 初回クリックなら爆弾を配置
    const next = board.map(row => row.map(cc => ({ ...cc })))
    let effectiveStart = startTime
    if (!minesPlaced) {
      placeMines(next, diffConfig.cols, diffConfig.rows, diffConfig.mines, c, r)
      setMinesPlaced(true)
      setStartTime(now)
      effectiveStart = now
    }

    const target = next[r][c]
    if (target.isMine) {
      // ゲームオーバー: 全爆弾を開示
      for (const row of next) for (const cc of row) if (cc.isMine) cc.revealed = true
      target.revealed = true
      setBoard(next)
      const elapsed = effectiveStart ? now - effectiveStart : 0
      finishLost(next, elapsed)
      return
    }

    flood(next, diffConfig.cols, diffConfig.rows, c, r)
    setBoard(next)

    if (isWon(next, diffConfig.cols * diffConfig.rows, diffConfig.mines)) {
      const elapsed = effectiveStart ? now - effectiveStart : 0
      finishWon(next, elapsed)
    }
  }

  function handleFlag(c: number, r: number) {
    if (phase !== 'playing') return
    const cell = board[r][c]
    if (cell.revealed) return
    const next = board.map(row => row.map(cc => ({ ...cc })))
    next[r][c].flagged = !next[r][c].flagged
    setBoard(next)
  }

  // ── 終了処理 ────────────────────────────────
  async function finishWon(finalBoard: Cell[][], elapsed: number) {
    if (tickRef.current) clearInterval(tickRef.current)
    setElapsedMs(elapsed)
    setPhase('won')

    if (userId) {
      try {
        await supabase.from('minesweeper_sessions').insert({
          user_id: userId,
          difficulty,
          won: true,
          time_ms: elapsed,
          cells_revealed: countRevealed(finalBoard),
          flags_placed: countFlags(finalBoard),
          board_w: diffConfig.cols,
          board_h: diffConfig.rows,
          mines_count: diffConfig.mines,
        })
        const prevBest = stats[difficulty].best_time_ms
        if (prevBest == null || elapsed < prevBest) setNewBest(true)

        const pts = await awardWinPoints(userId, diffConfig.winPoints)
        setPointsAwarded(pts)
        await loadStats(userId)
      } catch (e) {
        console.error('minesweeper finishWon insert error:', e)
      }
    }
    fetchLeaderboard(difficulty)
    setLeaderboardDiff(difficulty)
  }

  async function finishLost(finalBoard: Cell[][], elapsed: number) {
    if (tickRef.current) clearInterval(tickRef.current)
    setElapsedMs(elapsed)
    setPhase('lost')

    if (userId) {
      try {
        await supabase.from('minesweeper_sessions').insert({
          user_id: userId,
          difficulty,
          won: false,
          time_ms: elapsed,
          cells_revealed: countRevealed(finalBoard),
          flags_placed: countFlags(finalBoard),
          board_w: diffConfig.cols,
          board_h: diffConfig.rows,
          mines_count: diffConfig.mines,
        })
        await loadStats(userId)
      } catch (e) {
        console.error('minesweeper finishLost insert error:', e)
      }
    }
  }

  async function awardWinPoints(uid: string, pts: number): Promise<number> {
    // 既存のミニゲーム1日上限を共有する (crystal blast / emoji と同様)
    const today = new Date().toISOString().slice(0, 10)
    const { data: todayLog } = await supabase
      .from('user_points')
      .select('points')
      .eq('user_id', uid)
      .ilike('reason', '%ミニゲーム%')
      .gte('created_at', `${today}T00:00:00`)
    const alreadyToday = (todayLog || []).reduce(
      (sum: number, e: { points: number | null }) => sum + (e.points || 0),
      0,
    )
    const cap = POINT_CONFIG.MINIGAME_DAILY_CAP
    const remaining = Math.max(0, cap - alreadyToday)
    const award = Math.min(pts, remaining)
    if (award > 0) {
      await addPoints(uid, award, `🎮 ミニゲーム Minesweeper (${difficulty})`)
    }
    return award
  }

  // ── 長押し処理 (モバイルでフラッグ) ──────────────────
  function handlePointerDown(c: number, r: number) {
    longPressFiredRef.current = false
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      handleFlag(c, r)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate?.(15) } catch { /* ignore */ }
      }
    }, LONG_PRESS_MS)
  }

  function handlePointerUp(c: number, r: number) {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    if (longPressFiredRef.current) {
      // 長押しでフラッグを置いた場合は、続けて reveal しない
      longPressFiredRef.current = false
      return
    }
    if (flagMode) {
      handleFlag(c, r)
    } else {
      handleReveal(c, r)
    }
  }

  function handlePointerCancel() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  // ── シェア ────────────────────────────────
  function buildShareText(): string {
    return phase === 'won'
      ? `💣 Minesweeper [${diffConfig.label}] クリア！ タイム ${fmtTime(elapsedMs)}\nあなたも挑戦してみて👇\n\n#Filmo #マインスイーパ`
      : `💥 Minesweeper [${diffConfig.label}] 爆死…リベンジしたい\n\n#Filmo #マインスイーパ`
  }
  function openShareX() {
    const text = buildShareText()
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SHARE_URL)}`
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer')
    trackMinigameShared('twitter', phase === 'won' ? 1 : 0, Math.floor(elapsedMs / 1000))
  }
  function openShareLine() {
    shareToLine(buildShareText(), SHARE_URL)
    trackMinigameShared('line', phase === 'won' ? 1 : 0, Math.floor(elapsedMs / 1000))
  }

  // ====================================================
  // Render
  // ====================================================
  if (phase === 'menu') {
    return (
      <PageShell>
        <HeaderBar title="💣 Minesweeper" />
        <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.20), rgba(239,68,68,0.10))',
            borderRadius: 16, padding: '24px 20px', marginBottom: 16,
            border: '1px solid var(--fm-border)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 4 }}>💣</div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>
              MINESWEEPER
            </div>
            <p style={{ fontSize: 13, color: 'var(--fm-text-sub)', lineHeight: 1.6, margin: 0 }}>
              爆弾を踏まずに全マス開けよう。<br />
              数字は周囲8マスの爆弾数。長押しで旗を立てられる。
            </p>
          </div>

          {error && (
            <div style={{
              padding: 12, borderRadius: 10,
              background: 'rgba(255,80,80,0.1)', color: 'var(--fm-danger,#ff5050)',
              fontSize: 13, marginBottom: 12,
            }}>{error}</div>
          )}

          <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
            {DIFFICULTIES.map(d => {
              const s = stats[d.key]
              return (
                <button
                  key={d.key}
                  onClick={() => startGame(d.key)}
                  style={{
                    width: '100%', padding: 16, borderRadius: 14, border: '1px solid var(--fm-border)',
                    background: 'var(--fm-bg-card)', color: 'var(--fm-text)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                  }}>
                  <div style={{ fontSize: 28 }}>{d.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{d.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--fm-text-sub)', marginTop: 2 }}>
                      {d.cols} × {d.rows} ・ 爆弾 {d.mines} 個 ・ 勝利で +{d.winPoints}pt
                    </div>
                    {s.best_time_ms != null && (
                      <div style={{ fontSize: 11, color: 'var(--fm-accent)', marginTop: 4, fontWeight: 700 }}>
                        ⏱ ベスト {fmtTime(s.best_time_ms)} ・ {s.wins}/{s.total_plays}勝
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 16, color: 'var(--fm-accent)' }}>▶</div>
                </button>
              )
            })}
          </div>

          {!userId && (
            <p style={{ fontSize: 12, color: 'var(--fm-text-muted)', textAlign: 'center', marginBottom: 12 }}>
              ログインすると記録が保存されます
            </p>
          )}

          <div style={{
            padding: 16, background: 'var(--fm-bg-card)', borderRadius: 12,
            border: '1px solid var(--fm-border)', marginBottom: 16,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📖 ルール</h3>
            <ul style={{ fontSize: 12, color: 'var(--fm-text-sub)', lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
              <li>マスをタップして開く。爆弾を踏むと負け。</li>
              <li>数字は周囲8マスの爆弾数。0なら自動で周囲も開く。</li>
              <li>長押し or 🚩 モードで旗を立てる。</li>
              <li>初手は安全 (周囲を含めて爆弾は配置されない)。</li>
              <li>爆弾以外をすべて開ければ勝利。</li>
              <li>1日のミニゲーム上限: {POINT_CONFIG.MINIGAME_DAILY_CAP}pt (他ゲームと共有)</li>
            </ul>
          </div>

          {/* リーダーボード */}
          <div style={{
            background: 'var(--fm-bg-card)', borderRadius: 12,
            padding: 16, border: '1px solid var(--fm-border)',
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
              🏆 リーダーボード
            </h3>
            <div style={{
              display: 'flex', gap: 6, marginBottom: 12,
              background: 'var(--fm-bg-secondary,#12132a)', borderRadius: 8, padding: 4,
            }}>
              {DIFFICULTIES.map(d => (
                <button
                  key={d.key}
                  onClick={() => setLeaderboardDiff(d.key)}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: leaderboardDiff === d.key ? 'var(--fm-accent)' : 'transparent',
                    color: leaderboardDiff === d.key ? '#fff' : 'var(--fm-text-sub)',
                    fontSize: 12, fontWeight: 700,
                  }}>
                  {d.emoji} {d.label}
                </button>
              ))}
            </div>
            <LeaderboardList
              entries={leaderboard}
              loading={leaderboardLoading}
              currentUserId={userId}
            />
          </div>
        </div>
      </PageShell>
    )
  }

  // ── In-game (playing / won / lost) ────────
  const remainingMines = diffConfig.mines - countFlags(board)
  const cellSize = Math.max(22, Math.min(38, Math.floor(340 / diffConfig.cols)))

  return (
    <PageShell>
      <HeaderBar title={`💣 ${diffConfig.label}`} />
      <div style={{ padding: 12, maxWidth: 600, margin: '0 auto' }}>
        {/* HUD */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, marginBottom: 12,
        }}>
          <HudPanel label="💣 残り" value={remainingMines} />
          <button
            onClick={restart}
            aria-label="やり直し"
            style={{
              width: 56, height: 44, borderRadius: 12, border: '1px solid var(--fm-border)',
              background: 'var(--fm-bg-card)', cursor: 'pointer', fontSize: 22,
            }}>
            {phase === 'won' ? '😎' : phase === 'lost' ? '😵' : '🙂'}
          </button>
          <HudPanel label="⏱ 時間" value={fmtTime(elapsedMs)} />
        </div>

        {/* Flag mode toggle (mobile-friendly) */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => setFlagMode(false)}
            disabled={phase !== 'playing'}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              border: `1px solid ${!flagMode ? 'var(--fm-accent)' : 'var(--fm-border)'}`,
              background: !flagMode ? 'rgba(0,192,48,0.12)' : 'var(--fm-bg-card)',
              color: !flagMode ? 'var(--fm-accent)' : 'var(--fm-text-sub)',
              fontWeight: 700, fontSize: 13, cursor: phase === 'playing' ? 'pointer' : 'default',
            }}>
            ⛏ 開く
          </button>
          <button
            onClick={() => setFlagMode(true)}
            disabled={phase !== 'playing'}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              border: `1px solid ${flagMode ? 'var(--fm-accent)' : 'var(--fm-border)'}`,
              background: flagMode ? 'rgba(0,192,48,0.12)' : 'var(--fm-bg-card)',
              color: flagMode ? 'var(--fm-accent)' : 'var(--fm-text-sub)',
              fontWeight: 700, fontSize: 13, cursor: phase === 'playing' ? 'pointer' : 'default',
            }}>
            🚩 旗
          </button>
        </div>

        {/* Board */}
        <div style={{
          display: 'inline-grid',
          gridTemplateColumns: `repeat(${diffConfig.cols}, ${cellSize}px)`,
          gap: 2,
          padding: 6,
          background: '#1a1b2e',
          borderRadius: 10,
          border: '1px solid var(--fm-border)',
          touchAction: 'manipulation',
          userSelect: 'none',
        }}
        onContextMenu={(e) => e.preventDefault()}
        >
          {board.flatMap((row, r) => row.map((cell, c) => (
            <CellView
              key={`${r}-${c}`}
              cell={cell}
              size={cellSize}
              gameOver={phase !== 'playing'}
              onPointerDown={() => handlePointerDown(c, r)}
              onPointerUp={() => handlePointerUp(c, r)}
              onPointerCancel={handlePointerCancel}
              onContextMenu={(e) => { e.preventDefault(); handleFlag(c, r) }}
            />
          )))}
        </div>

        {/* Result panel */}
        {(phase === 'won' || phase === 'lost') && (
          <div className="animate-slide-up" style={{
            marginTop: 16, padding: 16, borderRadius: 14,
            background: phase === 'won'
              ? 'linear-gradient(135deg, rgba(0,192,48,0.18), rgba(108,92,231,0.10))'
              : 'linear-gradient(135deg, rgba(255,80,80,0.18), rgba(0,0,0,0.05))',
            border: `1px solid ${phase === 'won' ? 'var(--fm-accent)' : 'rgba(255,80,80,0.6)'}`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 4 }}>
              {phase === 'won' ? '🏆' : '💥'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
              {phase === 'won' ? 'クリア！' : 'ゲームオーバー'}
            </div>
            {phase === 'won' && newBest && (
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fm-accent)', marginBottom: 4 }}>
                🆕 自己ベスト更新!
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--fm-text-sub)' }}>
              タイム {fmtTime(elapsedMs)}
              {phase === 'won' && pointsAwarded > 0 && ` ・ +${pointsAwarded}pt`}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={openShareLine}
                  style={{
                    padding: '12px 0', borderRadius: 10, border: 'none',
                    background: '#06C755', color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                  💬 LINEでシェア
                </button>
                <button
                  onClick={openShareX}
                  style={{
                    padding: '12px 0', borderRadius: 10, border: 'none',
                    background: '#000', color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Xでシェア
                </button>
              </div>
              <button
                onClick={restart}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, var(--fm-accent), var(--fm-accent-light))',
                  color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>
                🔄 もう一度
              </button>
              <button
                onClick={() => setPhase('menu')}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 10,
                  background: 'transparent', border: '1px solid var(--fm-border)',
                  color: 'var(--fm-text-sub)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                難易度選択へ
              </button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}

// ====================================================
// Cell view
// ====================================================
function CellView({
  cell, size, gameOver,
  onPointerDown, onPointerUp, onPointerCancel, onContextMenu,
}: {
  cell: Cell
  size: number
  gameOver: boolean
  onPointerDown: () => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const fontSize = Math.max(11, Math.floor(size * 0.55))

  let bg = 'linear-gradient(180deg, #3a3d57, #2a2c44)'
  let color = '#fff'
  let content: React.ReactNode = ''

  if (cell.revealed) {
    bg = cell.isMine ? '#ef4444' : '#1f2238'
    if (cell.isMine) content = '💣'
    else if (cell.adjacent > 0) {
      content = cell.adjacent
      color = NUMBER_COLORS[cell.adjacent] || '#fff'
    } else {
      content = ''
    }
  } else if (cell.flagged) {
    content = '🚩'
  }

  // ゲームオーバー後、フラッグが間違っていた場合のマーカー
  if (gameOver && !cell.revealed && cell.flagged && !cell.isMine) {
    content = '❌'
  }

  return (
    <div
      role="button"
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
      onContextMenu={onContextMenu}
      style={{
        width: size, height: size,
        background: bg,
        color,
        borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize, fontWeight: 800,
        boxShadow: cell.revealed ? 'inset 0 0 0 1px rgba(255,255,255,0.04)' : '0 1px 0 rgba(0,0,0,0.4)',
        cursor: gameOver ? 'default' : 'pointer',
        transition: 'background 0.12s',
        lineHeight: 1,
      }}
    >
      {content}
    </div>
  )
}

// ====================================================
// HUD panel
// ====================================================
function HudPanel({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{
      flex: 1,
      background: 'var(--fm-bg-card)',
      border: '1px solid var(--fm-border)',
      borderRadius: 10,
      padding: '8px 10px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, color: 'var(--fm-text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{
        fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
        color: 'var(--fm-accent)',
      }}>{value}</div>
    </div>
  )
}

// ====================================================
// Leaderboard list
// ====================================================
function LeaderboardList({
  entries, loading, currentUserId,
}: {
  entries: LeaderboardEntry[]
  loading: boolean
  currentUserId: string | null
}) {
  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--fm-text-sub)', fontSize: 13 }}>
        読み込み中...
      </div>
    )
  }
  if (entries.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--fm-text-sub)', fontSize: 13 }}>
        まだ記録がありません
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {entries.map((e, i) => {
        const rank = i + 1
        const isSelf = currentUserId === e.user_id
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : ''
        return (
          <Link
            key={e.user_id}
            href={`/u/${e.user_id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 6px',
              borderBottom: i < entries.length - 1 ? '1px solid var(--fm-border)' : 'none',
              textDecoration: 'none', color: 'inherit',
              background: isSelf ? 'rgba(0,192,48,0.10)' : 'transparent',
              borderRadius: isSelf ? 8 : 0,
              paddingLeft: isSelf ? 10 : 6,
              paddingRight: isSelf ? 10 : 6,
            }}>
            <span style={{
              minWidth: 24, fontSize: medal ? 16 : 12, fontWeight: 700,
              color: medal ? undefined : 'var(--fm-text-muted)', textAlign: 'center',
            }}>
              {medal || rank}
            </span>
            {e.user_avatar ? (
              <img
                src={e.user_avatar}
                alt=""
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  objectFit: 'cover', background: 'var(--fm-bg-secondary)',
                }}
              />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--fm-bg-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, color: 'var(--fm-text-muted)',
              }}>
                {e.user_name?.[0] || '?'}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: isSelf ? 'var(--fm-accent)' : 'var(--fm-text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {e.user_name || '名無し'}{isSelf && ' (あなた)'}
              </div>
            </div>
            <div style={{
              fontSize: 14, fontWeight: 800, color: 'var(--fm-accent)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmtTime(e.best_time_ms)}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// ====================================================
// Layout helpers
// ====================================================
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--fm-bg)', color: 'var(--fm-text)' }}>
      {children}
    </div>
  )
}

function HeaderBar({ title }: { title: string }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: 'var(--fm-bg)', borderBottom: '1px solid var(--fm-border)',
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <Link
        href="/"
        aria-label="戻る"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 8,
          textDecoration: 'none', color: 'var(--fm-text)',
        }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      </Link>
      <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h1>
    </header>
  )
}
