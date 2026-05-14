'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { addPoints, POINT_CONFIG } from '../../lib/points'
import { useGame } from '../../lib/crystalBlast/useGame'
import { useMultiplayer } from '../../lib/crystalBlast/useMultiplayer'
import {
  type Board as EngineBoard,
  type Piece,
  pieceCells,
  COLS,
  ROWS,
} from '../../lib/crystalBlast/engine'

// ====================================================
// Phases
// ====================================================
type Phase =
  | 'menu'
  | 'solo-playing'
  | 'solo-result'
  | 'versus-lobby'
  | 'versus-waiting'
  | 'versus-playing'
  | 'versus-result'

interface LeaderboardEntry {
  user_id: string
  user_name: string
  user_avatar: string | null
  best_score: number
  max_chain: number
  achieved_at: string
}

interface SoloStats {
  best_score: number
  max_chain: number
  total_plays: number
}

interface MatchStats {
  wins: number
  losses: number
  draws: number
}

const CRYSTAL_COLORS: Record<number, string> = {
  1: 'linear-gradient(135deg, #ff5757, #c81e1e)',
  2: 'linear-gradient(135deg, #6dd66d, #1aa31a)',
  3: 'linear-gradient(135deg, #4ea6ff, #1c66c8)',
  4: 'linear-gradient(135deg, #ffd24a, #d39800)',
  5: 'linear-gradient(135deg, #c374ff, #7d1ed4)',
}
const GARBAGE_COLOR = 'linear-gradient(135deg, #888, #555)'

function genRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

// ====================================================
// Board renderer
// ====================================================
function renderBoardCells(board: EngineBoard, piece: Piece | null) {
  // 描画する派生ボード: piece は仮置きで重ねる
  const view: number[][] = board.length
    ? board.map(row => row.slice())
    : Array.from({ length: ROWS }, () => Array(COLS).fill(0))
  if (piece) {
    const { axis, sat } = pieceCells(piece)
    for (const [pos, color] of [[axis, piece.axisColor], [sat, piece.satColor]] as const) {
      const [r, c] = pos
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) view[r][c] = color
    }
  }
  return view
}

function BoardView({
  board,
  piece,
  cellSize = 32,
  flashCells = [],
  label,
  score,
  chain,
  pendingGarbage,
  highlight,
}: {
  board: EngineBoard
  piece?: Piece | null
  cellSize?: number
  flashCells?: [number, number][]
  label?: string
  score?: number
  chain?: number
  pendingGarbage?: number
  highlight?: boolean
}) {
  const cells = renderBoardCells(board, piece ?? null)
  const flash = new Set(flashCells.map(([r, c]) => `${r},${c}`))

  // 受信お邪魔予告 (1 行 = 6 個)
  const pendingRows = pendingGarbage ? Math.floor(pendingGarbage / COLS) : 0
  const pendingExtra = pendingGarbage ? pendingGarbage % COLS : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {label && (
        <div style={{
          fontSize: 12, fontWeight: 700, color: 'var(--fm-text-sub)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {label}
          {typeof chain === 'number' && chain > 1 && (
            <span style={{
              padding: '2px 6px', borderRadius: 8,
              background: 'var(--fm-accent)', color: '#fff', fontSize: 11,
            }}>{chain} 連鎖!</span>
          )}
        </div>
      )}

      {/* お邪魔予告バー */}
      {(pendingRows > 0 || pendingExtra > 0) && (
        <div style={{
          display: 'flex', gap: 2, alignSelf: 'flex-start',
          paddingLeft: 4, fontSize: 10, color: 'var(--fm-warning, #ff8c00)',
        }}>
          ⚠️ {pendingGarbage} 個落下予告
        </div>
      )}

      <div style={{
        position: 'relative',
        padding: 4,
        borderRadius: 10,
        background: 'rgba(0,0,0,0.35)',
        border: highlight ? '2px solid var(--fm-accent)' : '1px solid var(--fm-border)',
        boxShadow: highlight ? '0 0 14px rgba(0,192,48,0.35)' : undefined,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${cellSize}px)`,
          gap: 1,
          background: 'rgba(255,255,255,0.04)',
        }}>
          {cells.flatMap((row, r) =>
            row.map((v, c) => {
              const isFlash = flash.has(`${r},${c}`)
              return (
                <div
                  key={`${r}-${c}`}
                  style={{
                    width: cellSize, height: cellSize,
                    background: 'rgba(255,255,255,0.02)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'inset 0 0 1px rgba(255,255,255,0.04)',
                  }}>
                  {v !== 0 && (
                    <div style={{
                      width: cellSize - 6,
                      height: cellSize - 6,
                      borderRadius: v === -1 ? 4 : '50%',
                      background: v === -1 ? GARBAGE_COLOR : CRYSTAL_COLORS[v],
                      boxShadow: isFlash
                        ? '0 0 12px rgba(255,255,255,0.9), inset 0 0 4px rgba(255,255,255,0.8)'
                        : 'inset 0 -2px 4px rgba(0,0,0,0.35), inset 0 2px 3px rgba(255,255,255,0.35)',
                      transition: 'box-shadow 0.15s',
                    }} />
                  )}
                </div>
              )
            }),
          )}
        </div>
      </div>

      {typeof score === 'number' && (
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fm-accent)' }}>
          {score.toLocaleString()}
        </div>
      )}
    </div>
  )
}

// ====================================================
// Controls
// ====================================================
function GameControls({
  onLeft, onRight, onRotate, onSoft, onHard,
}: {
  onLeft: () => void
  onRight: () => void
  onRotate: () => void
  onSoft: () => void
  onHard: () => void
}) {
  const btn = (
    label: string,
    handler: () => void,
    flex = 1,
    big = false,
  ) => (
    <button
      onPointerDown={(e) => { e.preventDefault(); handler() }}
      onClick={(e) => e.preventDefault()}
      style={{
        flex,
        padding: big ? '20px 0' : '16px 0',
        borderRadius: 12,
        border: '1px solid var(--fm-border)',
        background: 'var(--fm-bg-card)',
        color: 'var(--fm-text)',
        fontSize: big ? 22 : 18,
        fontWeight: 700,
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
      }}>
      {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {btn('◀', onLeft)}
        {btn('↻', onRotate)}
        {btn('▶', onRight)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {btn('▼ 落下', onSoft, 1)}
        {btn('⏬ 一気に', onHard, 1.4)}
      </div>
    </div>
  )
}

// ====================================================
// Score → garbage scaling for chain reactions
// ====================================================

// ====================================================
// Main page
// ====================================================
export default function CrystalBlastPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('プレイヤー')
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('menu')
  const [error, setError] = useState('')

  const [soloStats, setSoloStats] = useState<SoloStats | null>(null)
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  // 対戦関連
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [matchMode, setMatchMode] = useState<'room' | 'random' | null>(null)
  const [roomInputValue, setRoomInputValue] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [queueStatus, setQueueStatus] = useState<'idle' | 'waiting' | 'matched'>('idle')

  // 結果
  const [matchOutcome, setMatchOutcome] = useState<'win' | 'lose' | 'draw' | null>(null)
  const [pointsAwarded, setPointsAwarded] = useState(0)

  // ====================================================
  // Auth + initial stats
  // ====================================================
  const loadStats = useCallback(async (uid: string) => {
    const [bestRes, totalRes, mRes] = await Promise.all([
      supabase
        .from('crystal_blast_solo_sessions')
        .select('score, max_chain')
        .eq('user_id', uid)
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('crystal_blast_solo_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid),
      supabase.rpc('get_crystal_blast_match_stats', { p_user_id: uid }),
    ])
    setSoloStats({
      best_score: bestRes.data?.score ?? 0,
      max_chain: bestRes.data?.max_chain ?? 0,
      total_plays: totalRes.count ?? 0,
    })
    const m = (mRes.data || [])[0]
    setMatchStats({
      wins: m?.wins ?? 0,
      losses: m?.losses ?? 0,
      draws: m?.draws ?? 0,
    })
  }, [])

  const fetchLeaderboard = useCallback(async () => {
    const { data } = await supabase.rpc('get_crystal_blast_leaderboard', { p_limit: 20 })
    setLeaderboard((data || []) as LeaderboardEntry[])
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
        const { data: profile } = await supabase
          .from('users')
          .select('name, avatar_url')
          .eq('id', session.user.id)
          .maybeSingle()
        if (profile) {
          setUserName(profile.name || 'プレイヤー')
          setUserAvatar(profile.avatar_url || null)
        }
        loadStats(session.user.id)
      }
      fetchLeaderboard()
    })
  }, [loadStats, fetchLeaderboard])

  // ====================================================
  // Solo game
  // ====================================================
  const soloCallbacks = useRef({
    onGameOver: async (score: number, maxChain: number, totalPops: number, durationMs: number) => {
      if (userId) {
        await supabase.from('crystal_blast_solo_sessions').insert({
          user_id: userId,
          score,
          max_chain: maxChain,
          total_pops: totalPops,
          duration_ms: durationMs,
        })
        // ポイント付与 (上限あり)
        const today = new Date().toISOString().slice(0, 10)
        const { data: todayLog } = await supabase
          .from('user_points')
          .select('points')
          .eq('user_id', userId)
          .ilike('reason', '%ミニゲーム%')
          .gte('created_at', `${today}T00:00:00`)
        const alreadyToday = (todayLog || []).reduce(
          (sum: number, e: { points: number | null }) => sum + (e.points || 0),
          0,
        )
        const cap = POINT_CONFIG.MINIGAME_DAILY_CAP
        const remaining = Math.max(0, cap - alreadyToday)
        // スコア 5000 ごとに 3pt + max_chain 3 以上で +5pt
        let pts = Math.floor(score / 5000) * 3
        if (maxChain >= 3) pts += 5
        if (maxChain >= 5) pts += 10
        pts = Math.min(pts, remaining)
        if (pts > 0) {
          await addPoints(userId, pts, `🎮 ミニゲーム CRYSTAL BLAST (スコア ${score})`)
        }
        setPointsAwarded(pts)
        loadStats(userId)
      }
      setPhase('solo-result')
      fetchLeaderboard()
    },
  })

  const soloGame = useGame({
    autoStart: phase === 'solo-playing',
    callbacks: {
      onGameOver: (s, mc, tp, d) => soloCallbacks.current.onGameOver(s, mc, tp, d),
    },
  })

  // ====================================================
  // Versus game (only meaningful in versus-playing phase)
  // ====================================================
  const versusGame = useGame({
    autoStart: phase === 'versus-playing',
    callbacks: {
      onAttack: (garbage, chain, score) => {
        multiplayer.sendAttack({ garbage, chain, score })
      },
      onGameOver: async (score) => {
        multiplayer.sendGameOver(score)
      },
    },
  })

  const multiplayer = useMultiplayer({
    roomCode: phase === 'versus-waiting' || phase === 'versus-playing' ? roomCode : null,
    userId: userId || '',
    userName,
    userAvatar,
    onAttackReceived: (garbage) => {
      versusGame.api.queueGarbage(garbage)
    },
    onOpponentGameOver: async (oppScore) => {
      // 相手が落ちた → 自分の勝ち (こちらがまだ生きていれば)
      versusGame.api.surrender() // 自分のゲームも止める
      const myScore = versusGame.state.score
      const winner =
        versusGame.state.gameOver && !multiplayer.opponent?.gameOver
          ? null // 自分が先に落ちた可能性も考慮
          : 'me'
      // 後段の useEffect で結果挿入する
      setMatchOutcome(winner === 'me' ? 'win' : (myScore === oppScore ? 'draw' : 'lose'))
      void oppScore // 値の参照を明示
    },
  })

  // 自分の盤面スナップショットを定期的にブロードキャスト
  useEffect(() => {
    if (phase !== 'versus-playing') return
    const t = setInterval(() => {
      multiplayer.sendState({
        board: versusGame.state.board,
        score: versusGame.state.score,
        chain: versusGame.state.chain,
        gameOver: versusGame.state.gameOver,
      })
    }, 350)
    return () => clearInterval(t)
  }, [phase, multiplayer, versusGame.state])

  // 自分がトップアウト or 相手がトップアウトなら結果画面へ
  useEffect(() => {
    if (phase !== 'versus-playing') return
    const myOver = versusGame.state.gameOver
    const oppOver = multiplayer.opponent?.gameOver
    if (!myOver && !oppOver) return
    // 結果判定
    let outcome: 'win' | 'lose' | 'draw' = 'draw'
    if (myOver && !oppOver) outcome = 'lose'
    else if (!myOver && oppOver) outcome = 'win'
    else {
      const myScore = versusGame.state.score
      const opScore = multiplayer.opponent?.score ?? 0
      outcome = myScore > opScore ? 'win' : myScore < opScore ? 'lose' : 'draw'
    }
    setMatchOutcome(outcome)
    void persistMatch(outcome)
    setPhase('versus-result')
    multiplayer.leave()
  // persistMatch は安定 (useCallback) なので含めない: 含めると無限ループ
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, versusGame.state.gameOver, multiplayer.opponent?.gameOver])

  const persistMatch = useCallback(async (outcome: 'win' | 'lose' | 'draw') => {
    if (!userId || !roomCode || !matchMode) return
    // presence から相手の user_id を取得
    const ch = supabase.getChannels().find(c => c.topic.endsWith(`crystal-blast:${roomCode}`))
    let opponentId: string | null = null
    if (ch) {
      const presenceState = ch.presenceState() as Record<string, unknown[]>
      for (const key of Object.keys(presenceState)) {
        if (key !== userId) { opponentId = key; break }
      }
    }
    // Realtime presence は user_id を track しているのでそこから取る
    if (!opponentId) return
    const me = userId
    // host (作成者) を player1 とする
    const player1Id = isHost ? me : opponentId
    const player2Id = isHost ? opponentId : me
    const myScore = versusGame.state.score
    const oppScore = multiplayer.opponent?.score ?? 0
    const winnerId =
      outcome === 'draw'
        ? null
        : outcome === 'win' ? me : opponentId
    const duration = Date.now() - versusGame.state.startedAt
    await supabase.from('crystal_blast_matches').insert({
      room_code: roomCode,
      mode: matchMode,
      player1_id: player1Id,
      player2_id: player2Id,
      winner_id: winnerId,
      player1_score: isHost ? myScore : oppScore,
      player2_score: isHost ? oppScore : myScore,
      player1_chain: isHost ? versusGame.state.maxChain : (multiplayer.opponent?.chain ?? 0),
      player2_chain: isHost ? (multiplayer.opponent?.chain ?? 0) : versusGame.state.maxChain,
      duration_ms: duration,
    })
    if (outcome === 'win') {
      // 勝利ボーナス
      const today = new Date().toISOString().slice(0, 10)
      const { data: todayLog } = await supabase
        .from('user_points')
        .select('points')
        .eq('user_id', userId)
        .ilike('reason', '%ミニゲーム%')
        .gte('created_at', `${today}T00:00:00`)
      const alreadyToday = (todayLog || []).reduce(
        (sum: number, e: { points: number | null }) => sum + (e.points || 0),
        0,
      )
      const remaining = Math.max(0, POINT_CONFIG.MINIGAME_DAILY_CAP - alreadyToday)
      const pts = Math.min(20, remaining)
      if (pts > 0) {
        await addPoints(userId, pts, '🎮 CRYSTAL BLAST 対戦勝利')
        setPointsAwarded(pts)
      }
    }
    loadStats(userId)
  }, [userId, roomCode, matchMode, isHost, multiplayer.opponent, versusGame.state.score, versusGame.state.maxChain, versusGame.state.startedAt, loadStats])

  // ====================================================
  // Keyboard
  // ====================================================
  useEffect(() => {
    const isPlaying = phase === 'solo-playing' || phase === 'versus-playing'
    if (!isPlaying) return
    const game = phase === 'solo-playing' ? soloGame : versusGame
    const handler = (e: KeyboardEvent) => {
      if (e.repeat && (e.key === 'ArrowUp' || e.key === 'z' || e.key === 'Z' || e.key === ' ')) return
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); game.api.move(-1); break
        case 'ArrowRight': e.preventDefault(); game.api.move(1); break
        case 'ArrowDown': e.preventDefault(); game.api.soft(); break
        case 'ArrowUp':
        case 'x':
        case 'X': e.preventDefault(); game.api.rotate(1); break
        case 'z':
        case 'Z': e.preventDefault(); game.api.rotate(-1); break
        case ' ': e.preventDefault(); game.api.hard(); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, soloGame, versusGame])

  // 開始時に restart
  useEffect(() => {
    if (phase === 'solo-playing') {
      soloGame.api.restart()
      soloGame.api.setPaused(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    // 対戦は両者揃ったら開始
    if (phase === 'versus-waiting' && multiplayer.opponentJoined) {
      versusGame.api.restart()
      versusGame.api.setPaused(false)
      setPhase('versus-playing')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, multiplayer.opponentJoined])

  // ====================================================
  // Matchmaking — random
  // ====================================================
  const queuePollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  async function startRandomMatch() {
    if (!userId) { setError('ログインが必要です'); return }
    setError('')
    setMatchMode('random')
    setIsHost(true) // ランダムは join_queue で先に登録した側を host とする (実用上どっちでも良い)
    setQueueStatus('waiting')
    setPhase('versus-waiting')

    const { data, error: rpcErr } = await supabase.rpc('crystal_blast_join_queue')
    if (rpcErr) { setError(rpcErr.message); setPhase('menu'); return }
    const row = (data || [])[0] as { status: string; room_code: string; opponent_id: string } | undefined
    if (row?.status === 'matched' && row.room_code) {
      setRoomCode(row.room_code)
      setQueueStatus('matched')
      setIsHost(false) // 自分が後発 (相手が先に待っていた)
      return
    }
    // 待機中 → 定期ポーリング
    queuePollTimer.current = setInterval(async () => {
      const { data: pollData } = await supabase.rpc('crystal_blast_check_queue')
      const r = (pollData || [])[0] as { status: string; room_code: string; opponent_id: string } | undefined
      if (r?.status === 'matched' && r.room_code) {
        if (queuePollTimer.current) clearInterval(queuePollTimer.current)
        setRoomCode(r.room_code)
        setQueueStatus('matched')
      }
    }, 2500)
  }

  async function cancelMatchmaking() {
    if (queuePollTimer.current) { clearInterval(queuePollTimer.current); queuePollTimer.current = null }
    try { await supabase.rpc('crystal_blast_leave_queue') } catch { /* ignore */ }
    setRoomCode(null)
    setQueueStatus('idle')
    setPhase('menu')
  }

  useEffect(() => () => {
    if (queuePollTimer.current) clearInterval(queuePollTimer.current)
  }, [])

  // ====================================================
  // Room create / join
  // ====================================================
  function createRoom() {
    if (!userId) { setError('ログインが必要です'); return }
    const code = genRoomCode()
    setRoomCode(code)
    setMatchMode('room')
    setIsHost(true)
    setPhase('versus-waiting')
  }

  function joinRoom() {
    if (!userId) { setError('ログインが必要です'); return }
    const code = roomInputValue.trim().toUpperCase()
    if (!code || code.length < 4) { setError('ルームコードを入力してください'); return }
    setRoomCode(code)
    setMatchMode('room')
    setIsHost(false)
    setPhase('versus-waiting')
  }

  // ====================================================
  // Rendering
  // ====================================================
  if (phase === 'menu') {
    const totalMatches = (matchStats?.wins ?? 0) + (matchStats?.losses ?? 0) + (matchStats?.draws ?? 0)
    const winRate = totalMatches ? Math.round(((matchStats?.wins ?? 0) / totalMatches) * 100) : 0
    return (
      <PageShell>
        <HeaderBar title="💎 CRYSTAL BLAST" />
        <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(108,92,231,0.20), rgba(255,80,80,0.10))',
            borderRadius: 16, padding: 24, marginBottom: 16,
            border: '1px solid var(--fm-border)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 44, letterSpacing: 6, marginBottom: 6 }}>💎🔵🟢🟡🟣</div>
            <p style={{ fontSize: 14, color: 'var(--fm-text-sub)', lineHeight: 1.7, margin: 0 }}>
              同じ色のクリスタルを <b>4 つ以上つなげて爆破</b>！<br />
              連鎖でスコアを稼ぎ、対戦相手にお邪魔ブロックを叩き込もう。
            </p>
          </div>

          {soloStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              <StatCard label="自己ベスト" value={soloStats.best_score.toLocaleString()} />
              <StatCard label="最大連鎖" value={soloStats.max_chain} />
              <StatCard label="プレイ数" value={soloStats.total_plays} />
            </div>
          )}
          {matchStats && totalMatches > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
              <StatCard label="勝利" value={matchStats.wins} />
              <StatCard label="敗北" value={matchStats.losses} />
              <StatCard label="勝率" value={`${winRate}%`} />
            </div>
          )}

          {error && (
            <div style={{
              padding: 12, borderRadius: 10, marginBottom: 12,
              background: 'rgba(255,80,80,0.1)', color: 'var(--fm-danger,#ff5050)', fontSize: 13,
            }}>{error}</div>
          )}

          <button
            onClick={() => setPhase('solo-playing')}
            className="pulse-glow"
            style={{
              width: '100%', padding: '16px 0', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, var(--fm-accent), var(--fm-accent-light))',
              color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', marginBottom: 8,
            }}>
            🎯 ソロモード
          </button>

          <button
            onClick={() => setPhase('versus-lobby')}
            disabled={!userId}
            style={{
              width: '100%', padding: '16px 0', borderRadius: 14, border: 'none',
              background: userId
                ? 'linear-gradient(135deg, #ff5757, #c374ff)'
                : 'var(--fm-bg-card)',
              color: '#fff', fontSize: 16, fontWeight: 800,
              cursor: userId ? 'pointer' : 'not-allowed', opacity: userId ? 1 : 0.5,
              marginBottom: 8,
            }}>
            ⚔️ オンライン対戦
            {!userId && <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2 }}>ログインが必要です</div>}
          </button>

          <div style={{ marginTop: 16, padding: 16, background: 'var(--fm-bg-card)', borderRadius: 12, border: '1px solid var(--fm-border)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📖 ルール</h3>
            <ul style={{ fontSize: 12, color: 'var(--fm-text-sub)', lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
              <li>2 個 1 組のクリスタルが上から落下</li>
              <li>同色を縦横 4 個以上つなげると爆破</li>
              <li>連鎖でスコア倍率上昇 (最大 19 連鎖)</li>
              <li>対戦: 連鎖で相手にお邪魔ブロックを送る</li>
              <li>盤面 (列 3 の最上段) が埋まると敗北</li>
              <li>ソロでも上限 {POINT_CONFIG.MINIGAME_DAILY_CAP}pt まで獲得可</li>
            </ul>
          </div>

          {leaderboard.length > 0 && (
            <SoloLeaderboard entries={leaderboard} currentUserId={userId} />
          )}
        </div>
      </PageShell>
    )
  }

  // ────────────────────────────────────────
  // Versus lobby
  // ────────────────────────────────────────
  if (phase === 'versus-lobby') {
    return (
      <PageShell>
        <HeaderBar title="⚔️ 対戦モード" />
        <div style={{ padding: 16, maxWidth: 520, margin: '0 auto' }}>
          {error && (
            <div style={{
              padding: 12, borderRadius: 10, marginBottom: 12,
              background: 'rgba(255,80,80,0.1)', color: 'var(--fm-danger,#ff5050)', fontSize: 13,
            }}>{error}</div>
          )}

          {/* ランダムマッチ */}
          <div style={{
            padding: 16, background: 'var(--fm-bg-card)',
            border: '1px solid var(--fm-border)', borderRadius: 12, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 28 }}>🎲</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>ランダム対戦</div>
                <div style={{ fontSize: 12, color: 'var(--fm-text-sub)' }}>
                  待機中の他プレイヤーと自動マッチ
                </div>
              </div>
            </div>
            <button
              onClick={startRandomMatch}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
                background: 'var(--fm-accent)', color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: 'pointer',
              }}>
              ▶ 対戦相手を探す
            </button>
          </div>

          {/* ルームコード */}
          <div style={{
            padding: 16, background: 'var(--fm-bg-card)',
            border: '1px solid var(--fm-border)', borderRadius: 12, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 28 }}>🔑</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>ルームコードで対戦</div>
                <div style={{ fontSize: 12, color: 'var(--fm-text-sub)' }}>
                  友達同士で対戦するなら
                </div>
              </div>
            </div>

            <button
              onClick={createRoom}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                marginBottom: 8,
              }}>
              🏗 ルームを作る
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={roomInputValue}
                onChange={e => setRoomInputValue(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={8}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--fm-border)', background: 'var(--fm-bg)',
                  color: 'var(--fm-text)', fontSize: 14, letterSpacing: 2,
                  textTransform: 'uppercase',
                }}
              />
              <button
                onClick={joinRoom}
                style={{
                  padding: '0 16px', borderRadius: 10, border: 'none',
                  background: 'var(--fm-accent)', color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer',
                }}>
                参加
              </button>
            </div>
          </div>

          <button
            onClick={() => setPhase('menu')}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 12,
              background: 'transparent', border: '1px solid var(--fm-border)',
              color: 'var(--fm-text-sub)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
            メニューに戻る
          </button>
        </div>
      </PageShell>
    )
  }

  // ────────────────────────────────────────
  // Versus waiting (room created/joined, before opponent connects)
  // ────────────────────────────────────────
  if (phase === 'versus-waiting') {
    const waitingForMatch = matchMode === 'random' && queueStatus === 'waiting'
    return (
      <PageShell>
        <HeaderBar title="⚔️ 対戦準備中" />
        <div style={{ padding: 16, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          {waitingForMatch ? (
            <div style={{
              padding: 32, background: 'var(--fm-bg-card)',
              border: '1px solid var(--fm-border)', borderRadius: 14, marginTop: 20,
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>対戦相手を探しています…</div>
              <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 20 }}>
                ほかにオンラインで対戦待ちのユーザーがいれば自動でマッチします
              </div>
              <button
                onClick={cancelMatchmaking}
                style={{
                  padding: '10px 24px', borderRadius: 10,
                  background: 'transparent', border: '1px solid var(--fm-border)',
                  color: 'var(--fm-text-sub)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                キャンセル
              </button>
            </div>
          ) : (
            <div style={{
              padding: 32, background: 'var(--fm-bg-card)',
              border: '1px solid var(--fm-border)', borderRadius: 14, marginTop: 20,
            }}>
              {matchMode === 'room' && isHost && roomCode && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 8 }}>
                    ルームコード (相手に共有)
                  </div>
                  <div style={{
                    fontSize: 30, fontWeight: 900, letterSpacing: 6,
                    color: 'var(--fm-accent)', marginBottom: 16,
                    fontFamily: 'monospace',
                  }}>{roomCode}</div>
                  <button
                    onClick={() => {
                      const text = `Filmoの CRYSTAL BLAST で対戦しよう！\nルームコード: ${roomCode}\nhttps://filmo.me/games/crystal-blast`
                      if (navigator.share) {
                        navigator.share({ text }).catch(() => {})
                      } else {
                        navigator.clipboard?.writeText(text)
                      }
                    }}
                    style={{
                      padding: '10px 24px', borderRadius: 10, border: 'none',
                      background: 'var(--fm-accent)', color: '#fff',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 16,
                    }}>
                    📋 コードを共有
                  </button>
                </>
              )}
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                {multiplayer.ready ? '相手の参加を待っています…' : '接続中…'}
              </div>
              {multiplayer.opponentJoined && (
                <div style={{ fontSize: 12, color: 'var(--fm-accent)', marginTop: 8 }}>
                  ✓ 対戦相手が参加しました。まもなく開始します
                </div>
              )}

              <button
                onClick={() => { multiplayer.leave(); setPhase('menu') }}
                style={{
                  marginTop: 24,
                  padding: '10px 24px', borderRadius: 10,
                  background: 'transparent', border: '1px solid var(--fm-border)',
                  color: 'var(--fm-text-sub)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                キャンセル
              </button>
            </div>
          )}
        </div>
      </PageShell>
    )
  }

  // ────────────────────────────────────────
  // Playing — solo or versus
  // ────────────────────────────────────────
  if (phase === 'solo-playing') {
    return (
      <PageShell>
        <HeaderBar
          title="💎 ソロモード"
          rightSlot={
            <div style={{ fontSize: 12, color: 'var(--fm-text-sub)' }}>
              LV {soloGame.state.level}
            </div>
          }
        />
        <div style={{ padding: 12, maxWidth: 360, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--fm-text-sub)' }}>
              {soloGame.state.chain > 1 && (
                <span style={{ color: 'var(--fm-accent)', fontWeight: 700 }}>
                  ✨ {soloGame.state.chain} 連鎖!
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {soloGame.state.next && (
                <MiniPiecePreview piece={soloGame.state.next} label="NEXT" />
              )}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <BoardView
              board={soloGame.state.board}
              piece={soloGame.state.current}
              cellSize={36}
              flashCells={soloGame.state.flashCells}
              score={soloGame.state.score}
            />
          </div>
          <GameControls
            onLeft={() => soloGame.api.move(-1)}
            onRight={() => soloGame.api.move(1)}
            onRotate={() => soloGame.api.rotate(1)}
            onSoft={() => soloGame.api.soft()}
            onHard={() => soloGame.api.hard()}
          />
          <button
            onClick={() => { soloGame.api.surrender() }}
            style={{
              marginTop: 12, width: '100%', padding: '8px 0', borderRadius: 10,
              background: 'transparent', border: '1px solid var(--fm-border)',
              color: 'var(--fm-text-muted)', fontSize: 12, cursor: 'pointer',
            }}>
            ギブアップ
          </button>
        </div>
      </PageShell>
    )
  }

  if (phase === 'versus-playing') {
    const oppBoard = multiplayer.opponent?.board || []
    return (
      <PageShell>
        <HeaderBar title="⚔️ オンライン対戦中" />
        <div style={{ padding: 8, maxWidth: 720, margin: '0 auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            justifyItems: 'center',
          }}>
            <BoardView
              board={versusGame.state.board}
              piece={versusGame.state.current}
              cellSize={26}
              flashCells={versusGame.state.flashCells}
              score={versusGame.state.score}
              chain={versusGame.state.chain}
              pendingGarbage={versusGame.state.pendingGarbage}
              label={`あなた`}
              highlight
            />
            <BoardView
              board={oppBoard}
              cellSize={26}
              score={multiplayer.opponent?.score ?? 0}
              chain={multiplayer.opponent?.chain ?? 0}
              label={multiplayer.opponent?.name || '相手'}
            />
          </div>

          <GameControls
            onLeft={() => versusGame.api.move(-1)}
            onRight={() => versusGame.api.move(1)}
            onRotate={() => versusGame.api.rotate(1)}
            onSoft={() => versusGame.api.soft()}
            onHard={() => versusGame.api.hard()}
          />
          <button
            onClick={() => { versusGame.api.surrender() }}
            style={{
              marginTop: 12, width: '100%', padding: '8px 0', borderRadius: 10,
              background: 'transparent', border: '1px solid var(--fm-border)',
              color: 'var(--fm-text-muted)', fontSize: 12, cursor: 'pointer',
            }}>
            投了
          </button>
        </div>
      </PageShell>
    )
  }

  // ────────────────────────────────────────
  // Results
  // ────────────────────────────────────────
  if (phase === 'solo-result') {
    return (
      <PageShell>
        <HeaderBar title="🏁 結果" />
        <div style={{ padding: 16, maxWidth: 520, margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(108,92,231,0.18), rgba(0,192,48,0.10))',
            borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 16,
            border: '1px solid var(--fm-border)',
          }}>
            <div style={{ fontSize: 56, fontWeight: 900, color: 'var(--fm-accent)' }}>
              {soloGame.state.score.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fm-text-sub)' }}>スコア</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
            <StatCard label="最大連鎖" value={soloGame.state.maxChain} />
            <StatCard label="爆破数" value={soloGame.state.totalPops} />
            <StatCard label="獲得pt" value={`+${pointsAwarded}`} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => { setPointsAwarded(0); setPhase('solo-playing') }}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, var(--fm-accent), var(--fm-accent-light))',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}>
              🔄 もう一度
            </button>
            <button
              onClick={() => setPhase('menu')}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 12,
                background: 'transparent', border: '1px solid var(--fm-border)',
                color: 'var(--fm-text-sub)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
              メニューに戻る
            </button>
          </div>
        </div>
      </PageShell>
    )
  }

  if (phase === 'versus-result') {
    const myScore = versusGame.state.score
    const oppScore = multiplayer.opponent?.score ?? 0
    const oppName = multiplayer.opponent?.name || '相手'
    const banner =
      matchOutcome === 'win' ? { emoji: '🏆', text: 'WIN!', color: 'linear-gradient(135deg, #ffd24a, #ff6b6b)' } :
      matchOutcome === 'lose' ? { emoji: '😢', text: 'LOSE', color: 'linear-gradient(135deg, #666, #333)' } :
                                { emoji: '🤝', text: 'DRAW', color: 'linear-gradient(135deg, #4ea6ff, #c374ff)' }
    return (
      <PageShell>
        <HeaderBar title="🏁 対戦結果" />
        <div style={{ padding: 16, maxWidth: 520, margin: '0 auto' }}>
          <div style={{
            background: banner.color,
            borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 56 }}>{banner.emoji}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>{banner.text}</div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16,
          }}>
            <div style={{
              padding: 16, background: 'var(--fm-bg-card)',
              border: '1px solid var(--fm-border)', borderRadius: 12, textAlign: 'center',
            }}>
              <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 4 }}>あなた</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--fm-accent)' }}>
                {myScore.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 4 }}>
                最大 {versusGame.state.maxChain} 連鎖
              </div>
            </div>
            <div style={{
              padding: 16, background: 'var(--fm-bg-card)',
              border: '1px solid var(--fm-border)', borderRadius: 12, textAlign: 'center',
            }}>
              <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 4 }}>{oppName}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--fm-text)' }}>
                {oppScore.toLocaleString()}
              </div>
            </div>
          </div>
          {pointsAwarded > 0 && (
            <div style={{
              padding: 12, borderRadius: 10, marginBottom: 12,
              background: 'rgba(0,192,48,0.10)', color: 'var(--fm-accent)',
              textAlign: 'center', fontWeight: 700,
            }}>
              +{pointsAwarded}pt 獲得
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => { setMatchOutcome(null); setPointsAwarded(0); setPhase('versus-lobby') }}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, var(--fm-accent), var(--fm-accent-light))',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}>
              ⚔️ もう一戦
            </button>
            <button
              onClick={() => { setMatchOutcome(null); setPhase('menu') }}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 12,
                background: 'transparent', border: '1px solid var(--fm-border)',
                color: 'var(--fm-text-sub)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
              メニューに戻る
            </button>
          </div>
        </div>
      </PageShell>
    )
  }

  return null
}

// ====================================================
// Mini next-piece preview
// ====================================================
function MiniPiecePreview({ piece, label }: { piece: Piece; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--fm-text-muted)' }}>{label}</span>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(1, 20px)',
        gridTemplateRows: 'repeat(2, 20px)', gap: 2,
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: CRYSTAL_COLORS[piece.satColor],
        }} />
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: CRYSTAL_COLORS[piece.axisColor],
        }} />
      </div>
    </div>
  )
}

function SoloLeaderboard({
  entries,
  currentUserId,
}: {
  entries: LeaderboardEntry[]
  currentUserId: string | null
}) {
  return (
    <div style={{
      marginTop: 24, background: 'var(--fm-bg-card)', borderRadius: 12,
      padding: 16, border: '1px solid var(--fm-border)',
    }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
        🏆 ソロランキング (TOP {entries.length})
      </h3>
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
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px',
                borderBottom: i < entries.length - 1 ? '1px solid var(--fm-border)' : 'none',
                textDecoration: 'none', color: 'inherit',
                background: isSelf ? 'rgba(0,192,48,0.10)' : 'transparent',
                borderRadius: isSelf ? 8 : 0,
              }}>
              <span style={{
                minWidth: 28, fontSize: medal ? 18 : 13, fontWeight: 700,
                color: medal ? undefined : 'var(--fm-text-muted)', textAlign: 'center',
              }}>{medal || rank}</span>
              {e.user_avatar ? (
                <img src={e.user_avatar} alt="" style={{
                  width: 32, height: 32, borderRadius: '50%', objectFit: 'cover',
                  background: 'var(--fm-bg-secondary)',
                }} />
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--fm-bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: 'var(--fm-text-muted)',
                }}>{e.user_name?.[0] || '?'}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: isSelf ? 'var(--fm-accent)' : 'var(--fm-text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {e.user_name || '名無し'}{isSelf && ' (あなた)'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                  最大 {e.max_chain} 連鎖
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fm-accent)' }}>
                {e.best_score.toLocaleString()}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ====================================================
// Layout sub-components (same idiom as emoji game)
// ====================================================
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--fm-bg)', color: 'var(--fm-text)' }}>
      {children}
    </div>
  )
}

function HeaderBar({ title, rightSlot }: { title: string; rightSlot?: React.ReactNode }) {
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
      <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, flex: 1 }}>{title}</h1>
      {rightSlot}
    </header>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
      borderRadius: 10, padding: '10px 8px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fm-accent)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--fm-text-sub)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
