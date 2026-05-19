'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { addPoints, POINT_CONFIG } from '../../lib/points'
import { trackMinigameShared } from '../../lib/analytics'
import { shareToLine } from '../../lib/share'
import { useFilmius, type FilmiusResult } from '../../lib/filmius/useGame'
import { LOGICAL_H, LOGICAL_W } from '../../lib/filmius/engine'

const SHARE_URL = 'https://filmo.me/games/filmius'

// ====================================================
// Types
// ====================================================
type Phase = 'menu' | 'playing' | 'result'

interface Stats {
  best_score: number
  max_stage_reached: number
  total_plays: number
  total_clears: number
  no_miss_clears: number
}

interface LeaderboardEntry {
  user_id: string
  user_name: string
  user_avatar: string | null
  best_score: number
  stage_reached: number
  cleared: boolean
  no_miss: boolean
  achieved_at: string
}

// ====================================================
// Helpers
// ====================================================
function fmtScore(n: number) {
  return n.toString().padStart(7, '0')
}

function stageLabel(stageReached: number, cleared: boolean): string {
  if (cleared) return '★ ALL CLEAR ★'
  switch (stageReached) {
    case 1: return 'STAGE 1 / GALACTIC PREMIERE'
    case 2: return 'STAGE 2 / ASTEROID OF MEMORIES'
    case 3: return 'STAGE 3 / THE FINAL CUT'
    case 4: return '★ ALL CLEAR ★'
    default: return 'STAGE 1'
  }
}

function buildTweetText(r: FilmiusResult): string {
  const head = r.cleared
    ? (r.noMiss ? `🎬 ノーミス全クリア！ Filmius スコア ${r.score}!`
                : `🎬 Filmius 全クリ！ スコア ${r.score}!`)
    : `🎬 Filmius STAGE ${r.stageReached} まで到達 / スコア ${r.score}!`
  return `${head}\n\nFilmoの横スクロールシューティング、挑戦してみて👇\n\n#Filmo #Filmius`
}

// ====================================================
// Page
// ====================================================
export default function FilmiusPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('menu')
  const [result, setResult] = useState<FilmiusResult | null>(null)
  const [pointsAwarded, setPointsAwarded] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [stats, setStats] = useState<Stats>({
    best_score: 0, max_stage_reached: 1, total_plays: 0, total_clears: 0, no_miss_clears: 0,
  })
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [error, setError] = useState('')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // ─── 戦績 ─────────────────────────────
  const loadStats = useCallback(async (uid: string) => {
    const { data } = await supabase.rpc('get_filmius_stats', { p_user_id: uid })
    if (!data) return
    const row = (Array.isArray(data) ? data[0] : data) as Stats | undefined
    if (row) {
      setStats({
        best_score: row.best_score || 0,
        max_stage_reached: row.max_stage_reached || 1,
        total_plays: row.total_plays || 0,
        total_clears: row.total_clears || 0,
        no_miss_clears: row.no_miss_clears || 0,
      })
    }
  }, [])

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true)
    try {
      const { data } = await supabase.rpc('get_filmius_leaderboard', { p_limit: 20 })
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

  // 初回マウント時にリーダーボードを取得。fetchLeaderboard 内の setState は意図的。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchLeaderboard() }, [fetchLeaderboard])

  // ─── ポイント付与 (ミニゲーム日次キャップ共有) ─────────────
  const awardClearPoints = useCallback(async (uid: string, r: FilmiusResult): Promise<number> => {
    let total = 0
    const breakdown: { pts: number; reason: string }[] = []
    if (r.stageReached >= 2) breakdown.push({ pts: POINT_CONFIG.FILMIUS_CLEAR_STAGE1, reason: '🎮 ミニゲーム Filmius STAGE 1 クリア' })
    if (r.stageReached >= 3) breakdown.push({ pts: POINT_CONFIG.FILMIUS_CLEAR_STAGE2, reason: '🎮 ミニゲーム Filmius STAGE 2 クリア' })
    if (r.cleared)           breakdown.push({ pts: POINT_CONFIG.FILMIUS_CLEAR_ALL,    reason: '🎮 ミニゲーム Filmius 全クリア' })
    if (r.cleared && r.noMiss) breakdown.push({ pts: POINT_CONFIG.FILMIUS_NO_MISS_BONUS, reason: '🎮 ミニゲーム Filmius ノーミスボーナス' })
    if (breakdown.length === 0) return 0

    const today = new Date().toISOString().slice(0, 10)
    const { data: todayLog } = await supabase
      .from('user_points')
      .select('points')
      .eq('user_id', uid)
      .ilike('reason', '%ミニゲーム%')
      .gte('created_at', `${today}T00:00:00`)
    const alreadyToday = (todayLog || []).reduce(
      (sum: number, e: { points: number | null }) => sum + (e.points || 0), 0,
    )
    const cap = POINT_CONFIG.MINIGAME_DAILY_CAP

    for (const { pts, reason } of breakdown) {
      const remaining = Math.max(0, cap - alreadyToday - total)
      const award = Math.min(pts, remaining)
      if (award > 0) {
        await addPoints(uid, award, reason)
        total += award
      }
    }
    return total
  }, [])

  // ─── 終了時の処理 ─────────────────────────
  const handleEnd = useCallback(async (r: FilmiusResult) => {
    setResult(r)
    setPhase('result')

    if (!userId) return
    try {
      await supabase.from('filmius_sessions').insert({
        user_id: userId,
        score: r.score,
        stage_reached: r.stageReached,
        cleared: r.cleared,
        no_miss: r.noMiss,
        enemies_killed: r.enemiesKilled,
        duration_ms: r.durationMs,
      })
      if (r.score > stats.best_score) setNewBest(true)
      const pts = await awardClearPoints(userId, r)
      setPointsAwarded(pts)
      await loadStats(userId)
    } catch (e) {
      console.error('filmius end insert error:', e)
      setError('スコアの保存に失敗しました')
    }
    fetchLeaderboard()
  }, [userId, stats.best_score, loadStats, fetchLeaderboard, awardClearPoints])

  // ─── ゲームフック ──────────────────────────
  const game = useFilmius(canvasRef, { onEnd: handleEnd })

  // ─── シェア ──────────────────────────────
  function openTwitterShare(text: string) {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SHARE_URL)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleShareTweet() {
    if (!result) return
    trackMinigameShared('twitter', result.enemiesKilled, result.score)
    openTwitterShare(buildTweetText(result))
  }
  function handleShareLine() {
    if (!result) return
    trackMinigameShared('line', result.enemiesKilled, result.score)
    shareToLine(buildTweetText(result), SHARE_URL)
  }

  function startGame() {
    setResult(null)
    setPointsAwarded(0)
    setNewBest(false)
    setError('')
    setPhase('playing')
    // canvas のマウントを待ってから start
    setTimeout(() => game.start(), 0)
  }

  function backToMenu() {
    game.stop()
    setPhase('menu')
  }

  // ====================================================
  // Render
  // ====================================================
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'radial-gradient(ellipse at top, #1a0033 0%, #050015 60%, #000 100%)',
      color: '#fff',
      padding: '12px 0 max(80px, env(safe-area-inset-bottom)) 0',
    }}>
      {/* ヘッダ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px', marginBottom: 14,
      }}>
        <Link href="/" style={{
          color: '#6cf2ff', textDecoration: 'none', fontSize: 14, fontWeight: 700,
        }}>← トップ</Link>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            fontFamily: 'monospace', fontWeight: 800, fontSize: 18,
            letterSpacing: 2, color: '#ffd24a',
          }}>F I L M I U S</div>
          <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
            横スクロール・シューティング
          </div>
        </div>
        <div style={{ width: 48 }} />
      </div>

      {phase === 'menu' && (
        <MenuView
          stats={stats}
          leaderboard={leaderboard}
          leaderboardLoading={leaderboardLoading}
          onStart={startGame}
        />
      )}

      {phase !== 'menu' && (
        <div style={{
          position: 'relative',
          maxWidth: 920,
          margin: '0 auto',
          padding: '0 12px',
        }}>
          {/* Canvas */}
          <div style={{
            position: 'relative',
            background: '#000',
            border: '1px solid rgba(255,210,74,0.35)',
            borderRadius: 8,
            overflow: 'hidden',
            aspectRatio: `${LOGICAL_W} / ${LOGICAL_H}`,
            touchAction: 'none',
          }}>
            <canvas
              ref={canvasRef}
              style={{
                width: '100%', height: '100%',
                display: 'block',
                imageRendering: 'pixelated',
              }}
            />
            {/* モバイル: EQUIP ボタン */}
            {phase === 'playing' && (
              <button
                onClick={() => game.triggerEquip()}
                style={{
                  position: 'absolute', right: 10, bottom: 10,
                  width: 64, height: 64, borderRadius: 32,
                  background: 'rgba(255,210,74,0.85)', color: '#3a1500',
                  border: '2px solid #fff', fontWeight: 900,
                  fontSize: 14, fontFamily: 'monospace',
                  touchAction: 'manipulation',
                }}>
                EQUIP
              </button>
            )}
          </div>

          {phase === 'playing' && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#aaa', textAlign: 'center' }}>
              PC: ←↑↓→ 移動 / Z 連射 / X 装備　　モバイル: ドラッグで移動・自動連射 / EQUIP ボタンで装備
            </div>
          )}

          {phase === 'result' && result && (
            <ResultView
              result={result}
              newBest={newBest}
              pointsAwarded={pointsAwarded}
              error={error}
              onRetry={startGame}
              onMenu={backToMenu}
              onShareTweet={handleShareTweet}
              onShareLine={handleShareLine}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ====================================================
// MenuView
// ====================================================
function MenuView({
  stats, leaderboard, leaderboardLoading, onStart,
}: {
  stats: Stats
  leaderboard: LeaderboardEntry[]
  leaderboardLoading: boolean
  onStart: () => void
}) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      {/* タイトル */}
      <div style={{
        textAlign: 'center', padding: '14px 0 26px 0',
      }}>
        <div style={{
          fontFamily: 'monospace', fontSize: 40, fontWeight: 900,
          letterSpacing: 6, color: '#ffd24a',
          textShadow: '0 0 18px rgba(255,210,74,0.55), 0 0 4px #fff',
        }}>FILMIUS</div>
        <div style={{
          fontSize: 12, color: '#6cf2ff', letterSpacing: 4, marginTop: 4,
        }}>FILMO × HORIZONTAL SHOOTER</div>
      </div>

      <button
        onClick={onStart}
        style={{
          width: '100%', padding: '18px 16px',
          fontSize: 18, fontWeight: 900, fontFamily: 'monospace',
          letterSpacing: 4, color: '#000',
          background: 'linear-gradient(135deg, #ffd24a 0%, #ff7a3f 100%)',
          border: 'none', borderRadius: 14, cursor: 'pointer',
          boxShadow: '0 4px 22px rgba(255,210,74,0.45)',
        }}>
        ▶ INSERT COIN
      </button>

      {/* 操作説明 */}
      <div style={{
        marginTop: 18, padding: 14, borderRadius: 12,
        background: 'rgba(108,242,255,0.06)',
        border: '1px solid rgba(108,242,255,0.25)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#6cf2ff', marginBottom: 8 }}>
          ▸ 操作
        </div>
        <div style={{ display: 'grid', gap: 6, fontSize: 12, color: '#ddd' }}>
          <div>📱 <b>モバイル:</b> 画面をドラッグして移動 (自動連射)、<b>EQUIP</b> ボタンで装備</div>
          <div>⌨️ <b>PC:</b> <kbd>←↑↓→</kbd>/WASD 移動、<kbd>Z</kbd> 連射、<kbd>X</kbd> 装備</div>
          <div>🟧 オレンジの <b>P</b> カプセルを取るとゲージが進む。装備ボタンで現在のスロットを装備</div>
        </div>
      </div>

      {/* パワーアップ説明 */}
      <div style={{
        marginTop: 12, padding: 14, borderRadius: 12,
        background: 'rgba(255,210,74,0.06)',
        border: '1px solid rgba(255,210,74,0.25)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#ffd24a', marginBottom: 8 }}>
          ▸ パワーアップ (5スロット)
        </div>
        <div style={{ display: 'grid', gap: 4, fontSize: 12, color: '#ddd' }}>
          <div><b>1. SPEED</b> ⏩ — 移動速度UP (最大3段)</div>
          <div><b>2. MISSILE</b> 🎞️ — B-ROLL 追加弾</div>
          <div><b>3. DOUBLE FEATURE</b> 🎬 — 2way 弾</div>
          <div><b>4. PROJECTOR BEAM</b> 💡 — 貫通レーザー (DOUBLE と排他)</div>
          <div><b>5. SEQUEL</b> 🎟️ — 軌跡追従オプション (最大2)</div>
        </div>
      </div>

      {/* 自分の戦績 */}
      <div style={{
        marginTop: 16, padding: 14, borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
          ▸ 戦績
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12 }}>
          <StatChip label="ベストスコア" value={fmtScore(stats.best_score)} accent="#ffd24a" mono />
          <StatChip label="最高到達" value={stageLabel(stats.max_stage_reached, false).split(' / ')[0]} accent="#6cf2ff" />
          <StatChip label="プレイ回数" value={`${stats.total_plays} 回`} />
          <StatChip label="クリア回数" value={`${stats.total_clears} 回 (ノーミス ${stats.no_miss_clears})`} />
        </div>
      </div>

      {/* リーダーボード */}
      <div style={{
        marginTop: 16, padding: 14, borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>▸ HIGH SCORES</div>
          <div style={{ fontSize: 10, color: '#aaa', fontFamily: 'monospace' }}>TOP 20</div>
        </div>
        {leaderboardLoading ? (
          <div style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: 16 }}>
            読み込み中…
          </div>
        ) : leaderboard.length === 0 ? (
          <div style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: 16 }}>
            まだ記録がありません。最初の挑戦者になろう！
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 4 }}>
            {leaderboard.map((row, idx) => (
              <LeaderRow key={row.user_id} rank={idx + 1} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatChip({ label, value, accent, mono }: {
  label: string; value: string; accent?: string; mono?: boolean
}) {
  return (
    <div style={{
      padding: 10, borderRadius: 10,
      background: 'rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ fontSize: 10, color: '#aaa' }}>{label}</div>
      <div style={{
        fontSize: 14, fontWeight: 800, marginTop: 2,
        color: accent ?? '#fff',
        fontFamily: mono ? 'monospace' : 'inherit',
      }}>{value}</div>
    </div>
  )
}

function LeaderRow({ rank, row }: { rank: number; row: LeaderboardEntry }) {
  const rankColor = rank === 1 ? '#ffd24a' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#888'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 8px', borderRadius: 8,
      background: rank <= 3 ? 'rgba(255,210,74,0.05)' : 'transparent',
    }}>
      <div style={{
        width: 28, textAlign: 'right', fontWeight: 900,
        fontFamily: 'monospace', color: rankColor,
      }}>{rank}</div>
      {row.user_avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.user_avatar} alt=""
          width={24} height={24}
          style={{ borderRadius: 12, objectFit: 'cover' }}
        />
      ) : (
        <div style={{
          width: 24, height: 24, borderRadius: 12,
          background: 'rgba(255,255,255,0.1)',
        }} />
      )}
      <Link
        href={`/u/${row.user_id}`}
        style={{
          flex: 1, fontSize: 13, color: '#fff', textDecoration: 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
        {row.user_name || '名無し'}
      </Link>
      <div style={{ display: 'flex', gap: 4, fontSize: 10 }}>
        {row.cleared && <span title="全クリア">⭐</span>}
        {row.no_miss && <span title="ノーミス">💎</span>}
      </div>
      <div style={{
        fontFamily: 'monospace', fontWeight: 800, color: '#ffd24a',
        minWidth: 70, textAlign: 'right',
      }}>{fmtScore(row.best_score)}</div>
    </div>
  )
}

// ====================================================
// ResultView
// ====================================================
function ResultView({
  result, newBest, pointsAwarded, error,
  onRetry, onMenu, onShareTweet, onShareLine,
}: {
  result: FilmiusResult
  newBest: boolean
  pointsAwarded: number
  error: string
  onRetry: () => void
  onMenu: () => void
  onShareTweet: () => void
  onShareLine: () => void
}) {
  return (
    <div style={{
      marginTop: 18, padding: 18, borderRadius: 14,
      background: result.cleared
        ? 'linear-gradient(135deg, rgba(255,210,74,0.18), rgba(255,122,63,0.12))'
        : 'rgba(255,255,255,0.05)',
      border: `1px solid ${result.cleared ? 'rgba(255,210,74,0.5)' : 'rgba(255,255,255,0.15)'}`,
    }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{
          fontFamily: 'monospace', fontSize: 22, fontWeight: 900,
          color: result.cleared ? '#ffd24a' : '#fff',
        }}>{result.cleared ? '★ GAME CLEARED ★' : 'GAME OVER'}</div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
          {stageLabel(result.stageReached, result.cleared)}
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12,
      }}>
        <StatChip label="スコア" value={fmtScore(result.score)} accent="#ffd24a" mono />
        <StatChip label="撃破数" value={`${result.enemiesKilled}`} />
        <StatChip
          label="プレイ時間"
          value={`${(result.durationMs / 1000).toFixed(1)} 秒`}
        />
        <StatChip
          label="ノーミス"
          value={result.noMiss && result.cleared ? '達成 💎' : '—'}
          accent={result.noMiss && result.cleared ? '#6cf2ff' : undefined}
        />
      </div>

      {newBest && (
        <div style={{
          textAlign: 'center', padding: 10, borderRadius: 10,
          background: 'rgba(255,210,74,0.18)', color: '#ffd24a',
          fontWeight: 800, marginBottom: 10,
          fontFamily: 'monospace', letterSpacing: 2,
        }}>
          🏆 NEW BEST SCORE!
        </div>
      )}

      {pointsAwarded > 0 && (
        <div style={{
          textAlign: 'center', padding: 8, borderRadius: 8,
          background: 'rgba(46,204,138,0.12)', color: '#2ecc8a',
          fontSize: 13, marginBottom: 10,
        }}>
          +{pointsAwarded} pt 獲得
        </div>
      )}

      {error && (
        <div style={{
          textAlign: 'center', padding: 8, borderRadius: 8,
          background: 'rgba(239,68,68,0.12)', color: '#ef4444',
          fontSize: 12, marginBottom: 10,
        }}>{error}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={onRetry} style={primaryBtn}>もう一度</button>
        <button onClick={onMenu} style={secondaryBtn}>メニューへ</button>
      </div>

      <div style={{
        marginTop: 14, paddingTop: 12,
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8, textAlign: 'center' }}>
          結果をシェア
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={onShareTweet} style={{
            ...secondaryBtn,
            background: 'rgba(29,155,240,0.18)',
            border: '1px solid rgba(29,155,240,0.4)',
            color: '#5fa9f7',
          }}>𝕏 でシェア</button>
          <button onClick={onShareLine} style={{
            ...secondaryBtn,
            background: 'rgba(6,199,85,0.18)',
            border: '1px solid rgba(6,199,85,0.4)',
            color: '#6fdba0',
          }}>LINE でシェア</button>
        </div>
      </div>
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  padding: '14px 16px', fontSize: 14, fontWeight: 800,
  color: '#000', background: 'linear-gradient(135deg, #ffd24a, #ff7a3f)',
  border: 'none', borderRadius: 12, cursor: 'pointer',
  fontFamily: 'monospace', letterSpacing: 2,
}
const secondaryBtn: React.CSSProperties = {
  padding: '14px 16px', fontSize: 14, fontWeight: 700,
  color: '#fff', background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12,
  cursor: 'pointer', fontFamily: 'monospace',
}
