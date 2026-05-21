'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { addPoints, POINT_CONFIG } from '../../lib/points'
import { trackMinigameShared } from '../../lib/analytics'
import { shareToLine } from '../../lib/share'
import { useFilmappy, type FilmappyResult } from '../../lib/filmappy/useGame'
import { LOGICAL_H, LOGICAL_W } from '../../lib/filmappy/engine'

const SHARE_URL = 'https://filmo.me/games/filmappy'

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
    case 1: return 'STAGE 1 / GRAND PREMIERE'
    case 2: return 'STAGE 2 / SNEAK PREVIEW'
    case 3: return 'STAGE 3 / THE FINAL SHOW'
    case 4: return '★ ALL CLEAR ★'
    default: return 'STAGE 1'
  }
}

function buildTweetText(r: FilmappyResult): string {
  const head = r.cleared
    ? (r.noMiss ? `🎬 ノーミス全クリ！ Filmappy スコア ${r.score}!`
                : `🎬 Filmappy 全クリ！ スコア ${r.score}!`)
    : `🎬 Filmappy STAGE ${r.stageReached} まで到達 / スコア ${r.score}!`
  return `${head}\n\nFilmoのシネマ泥棒、挑戦してみて👇\n\n#Filmo #Filmappy`
}

// ====================================================
// Page
// ====================================================
export default function FilmappyPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('menu')
  const [result, setResult] = useState<FilmappyResult | null>(null)
  const [pointsAwarded, setPointsAwarded] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [stats, setStats] = useState<Stats>({
    best_score: 0, max_stage_reached: 1, total_plays: 0, total_clears: 0, no_miss_clears: 0,
  })
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [error, setError] = useState('')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const playAreaRef = useRef<HTMLDivElement | null>(null)
  const canvasBoxRef = useRef<HTMLDivElement | null>(null)

  // ─── 戦績 ─────────────────────────────
  const loadStats = useCallback(async (uid: string) => {
    const { data } = await supabase.rpc('get_filmappy_stats', { p_user_id: uid })
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
      const { data } = await supabase.rpc('get_filmappy_leaderboard', { p_limit: 20 })
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

  // 初回マウント時にリーダーボードを取得。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchLeaderboard() }, [fetchLeaderboard])

  // ─── ポイント付与 (ミニゲーム日次キャップ共有) ─────────────
  const awardClearPoints = useCallback(async (uid: string, r: FilmappyResult): Promise<number> => {
    let total = 0
    const breakdown: { pts: number; reason: string }[] = []
    if (r.stageReached >= 2) breakdown.push({ pts: POINT_CONFIG.FILMAPPY_CLEAR_STAGE1, reason: '🎮 ミニゲーム Filmappy STAGE 1 クリア' })
    if (r.stageReached >= 3) breakdown.push({ pts: POINT_CONFIG.FILMAPPY_CLEAR_STAGE2, reason: '🎮 ミニゲーム Filmappy STAGE 2 クリア' })
    if (r.cleared)           breakdown.push({ pts: POINT_CONFIG.FILMAPPY_CLEAR_ALL,    reason: '🎮 ミニゲーム Filmappy 全クリア' })
    if (r.cleared && r.noMiss) breakdown.push({ pts: POINT_CONFIG.FILMAPPY_NO_MISS_BONUS, reason: '🎮 ミニゲーム Filmappy ノーミスボーナス' })
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
  const handleEnd = useCallback(async (r: FilmappyResult) => {
    setResult(r)
    setPhase('result')

    if (!userId) return
    try {
      await supabase.from('filmappy_sessions').insert({
        user_id: userId,
        score: r.score,
        stage_reached: r.stageReached,
        cleared: r.cleared,
        no_miss: r.noMiss,
        items_collected: r.itemsCollected,
        enemies_stunned: r.enemiesStunned,
        duration_ms: r.durationMs,
      })
      if (r.score > stats.best_score) setNewBest(true)
      const pts = await awardClearPoints(userId, r)
      setPointsAwarded(pts)
      await loadStats(userId)
    } catch (e) {
      console.error('filmappy end insert error:', e)
      setError('スコアの保存に失敗しました')
    }
    fetchLeaderboard()
  }, [userId, stats.best_score, loadStats, fetchLeaderboard, awardClearPoints])

  // ─── ゲームフック ──────────────────────────
  const game = useFilmappy(canvasRef, { onEnd: handleEnd })

  // ─── シェア ──────────────────────────────
  function openTwitterShare(text: string) {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SHARE_URL)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleShareTweet() {
    if (!result) return
    trackMinigameShared('twitter', result.itemsCollected, result.score)
    openTwitterShare(buildTweetText(result))
  }
  function handleShareLine() {
    if (!result) return
    trackMinigameShared('line', result.itemsCollected, result.score)
    shareToLine(buildTweetText(result), SHARE_URL)
  }

  function startGame() {
    setResult(null)
    setPointsAwarded(0)
    setNewBest(false)
    setError('')
    setPhase('playing')
    setTimeout(() => game.start(), 0)
  }

  function backToMenu() {
    game.stop()
    setPhase('menu')
  }

  // ─── キャンバス letterbox サイジング ──────────────────
  // 横向き iPhone のような縦が短いビューポートでも、ゲーム要素 (HUD・操作) が
  // 必ず画面に収まるよう、プレイエリアの実寸からアスペクトを保ったサイズを計算する。
  useLayoutEffect(() => {
    if (phase === 'menu') return
    const playArea = playAreaRef.current
    const canvasBox = canvasBoxRef.current
    if (!playArea || !canvasBox) return

    const ASPECT = LOGICAL_W / LOGICAL_H
    const update = () => {
      const availW = playArea.clientWidth
      const availH = playArea.clientHeight
      let w = availW
      let h = w / ASPECT
      if (h > availH) {
        h = availH
        w = h * ASPECT
      }
      canvasBox.style.width = `${Math.floor(w)}px`
      canvasBox.style.height = `${Math.floor(h)}px`
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(playArea)
    window.addEventListener('orientationchange', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', update)
    }
  }, [phase])

  // ====================================================
  // Render
  // ====================================================

  // メニュー画面: 通常の縦スクロールページ
  if (phase === 'menu') {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'radial-gradient(ellipse at top, #3a0a18 0%, #1a0010 60%, #000 100%)',
        color: '#fff',
        padding: '12px 0 max(80px, env(safe-area-inset-bottom)) 0',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 16px', marginBottom: 14,
        }}>
          <Link href="/" style={{
            color: '#ff7aa6', textDecoration: 'none', fontSize: 14, fontWeight: 700,
          }}>← トップ</Link>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              fontFamily: 'monospace', fontWeight: 800, fontSize: 18,
              letterSpacing: 2, color: '#ffd24a',
            }}>F I L M A P P Y</div>
            <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
              シネマ泥棒
            </div>
          </div>
          <div style={{ width: 48 }} />
        </div>
        <MenuView
          stats={stats}
          leaderboard={leaderboard}
          leaderboardLoading={leaderboardLoading}
          onStart={startGame}
        />
      </div>
    )
  }

  // プレイ中・結果: フルスクリーンレイアウト
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'radial-gradient(ellipse at top, #3a0a18 0%, #1a0010 60%, #000 100%)',
      color: '#fff',
      display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)',
      zIndex: 50,
    }}>
      {/* コンパクトヘッダ */}
      <div style={{
        flexShrink: 0,
        padding: '6px 10px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <button
          onClick={backToMenu}
          style={{
            background: 'rgba(255,122,166,0.12)',
            color: '#ff7aa6',
            border: '1px solid rgba(255,122,166,0.35)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            touchAction: 'manipulation',
          }}>
          ← 終了
        </button>
        <div style={{
          flex: 1, textAlign: 'center',
          fontFamily: 'monospace', color: '#ffd24a',
          fontWeight: 800, fontSize: 13, letterSpacing: 3,
        }}>FILMAPPY</div>
        <div style={{ width: 56 }} />
      </div>

      {/* プレイエリア (canvas を中央に letterbox 配置) */}
      <div
        ref={playAreaRef}
        style={{
          flex: 1, minHeight: 0, minWidth: 0,
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
        <div
          ref={canvasBoxRef}
          style={{
            position: 'relative',
            background: '#000',
            border: '1px solid rgba(255,122,166,0.35)',
            borderRadius: 8,
            overflow: 'hidden',
            touchAction: 'none',
            containerType: 'size',
          }}>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%', height: '100%',
              display: 'block',
              imageRendering: 'pixelated',
            }}
          />
          {/* モバイル: ドア (波) ボタン */}
          {phase === 'playing' && (
            <button
              onClick={() => game.triggerDoor()}
              style={{
                position: 'absolute', right: 10, bottom: 10,
                width: 64, height: 64, borderRadius: 32,
                background: 'rgba(108,242,255,0.85)', color: '#003a4a',
                border: '2px solid #fff', fontWeight: 900,
                fontSize: 14, fontFamily: 'monospace',
                touchAction: 'manipulation',
              }}>
              🌊 DOOR
            </button>
          )}
          {/* ゲーム終了オーバーレイ */}
          {phase === 'result' && result && (
            <ResultOverlay
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
      </div>
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
          fontFamily: 'monospace', fontSize: 36, fontWeight: 900,
          letterSpacing: 5, color: '#ffd24a',
          textShadow: '0 0 18px rgba(255,210,74,0.55), 0 0 4px #fff',
        }}>FILMAPPY</div>
        <div style={{
          fontSize: 12, color: '#ff7aa6', letterSpacing: 4, marginTop: 4,
        }}>シネマ泥棒</div>
      </div>

      <button
        onClick={onStart}
        style={{
          width: '100%', padding: '18px 16px',
          fontSize: 18, fontWeight: 900, fontFamily: 'monospace',
          letterSpacing: 4, color: '#fff',
          background: 'linear-gradient(135deg, #ff3060 0%, #ff7aa6 100%)',
          border: 'none', borderRadius: 14, cursor: 'pointer',
          boxShadow: '0 4px 22px rgba(255,80,120,0.45)',
        }}>
        ▶ 上映開始
      </button>

      {/* あらすじ */}
      <div style={{
        marginTop: 18, padding: 14, borderRadius: 12,
        background: 'rgba(255,210,74,0.08)',
        border: '1px solid rgba(255,210,74,0.25)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#ffd24a', marginBottom: 8 }}>
          ▸ あらすじ
        </div>
        <div style={{ fontSize: 12, color: '#ddd', lineHeight: 1.6 }}>
          フィルム警官マピオが、5 階建ての映画館に潜む「ネタバレ怪人」と「海賊版業者」から
          盗まれた映画コレクションを取り返す！　レッドカーペット・トランポリンを跳び回り、
          フィルムリール🎞️・ポップコーン🍿・ポスター🎬・オスカー像🏆・チケット🎟️ を全て回収しよう。
        </div>
      </div>

      {/* 操作説明 */}
      <div style={{
        marginTop: 12, padding: 14, borderRadius: 12,
        background: 'rgba(108,242,255,0.06)',
        border: '1px solid rgba(108,242,255,0.25)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#6cf2ff', marginBottom: 8 }}>
          ▸ 操作
        </div>
        <div style={{ display: 'grid', gap: 6, fontSize: 12, color: '#ddd', lineHeight: 1.6 }}>
          <div>📱 <b>モバイル:</b> 画面をタッチした位置に向かって歩行。上下フリックでバウンド方向。
            <b>🌊 DOOR</b> ボタンで映写室ドアを開けて波で敵スタン</div>
          <div>⌨️ <b>PC:</b> <kbd>←→</kbd>/AD で歩く、<kbd>↑↓</kbd>/WS でバウンド方向、
            <kbd>Z</kbd>/<kbd>X</kbd>/<kbd>Space</kbd> でドア解放</div>
          <div>🎬 同じアイテムを連続で取ると <b>×2 / ×5 / ×10</b> のコンボ倍率</div>
          <div>🌀 同じレッドカーペットで <b>4 連バウンド</b> すると破れて落下死</div>
        </div>
      </div>

      {/* アイテム説明 */}
      <div style={{
        marginTop: 12, padding: 14, borderRadius: 12,
        background: 'rgba(255,122,166,0.06)',
        border: '1px solid rgba(255,122,166,0.25)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#ff7aa6', marginBottom: 8 }}>
          ▸ コレクション
        </div>
        <div style={{ display: 'grid', gap: 4, fontSize: 12, color: '#ddd' }}>
          <div>🎞️ <b>フィルムリール</b> / 🍿 <b>ポップコーン</b> / 🎬 <b>ポスター</b></div>
          <div>🏆 <b>オスカー像</b> / 🎟️ <b>チケット</b></div>
          <div style={{ color: '#aaa', marginTop: 6, fontSize: 11 }}>
            ※ 全アイテム回収でステージクリア。残時間 × 30 = タイムボーナス
          </div>
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
// ResultOverlay — キャンバス内に重ねる結果画面
// ====================================================
function ResultOverlay({
  result, newBest, pointsAwarded, error,
  onRetry, onMenu, onShareTweet, onShareLine,
}: {
  result: FilmappyResult
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
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,8,0.86)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 'clamp(6px, 1.5cqh, 12px)',
      padding: 'clamp(8px, 3%, 22px)',
      overflowY: 'auto',
    }}>
      <div style={{
        fontFamily: 'monospace', fontWeight: 900,
        fontSize: 'clamp(18px, 5cqw, 30px)',
        letterSpacing: 3, textAlign: 'center',
        color: result.cleared ? '#ffd24a' : '#ff6188',
        textShadow: result.cleared
          ? '0 0 18px rgba(255,210,74,0.6)'
          : '0 0 14px rgba(255,97,136,0.5)',
      }}>
        {result.cleared ? '★ ALL CLEARED ★' : 'GAME OVER'}
      </div>
      <div style={{
        fontFamily: 'monospace', fontWeight: 800,
        fontSize: 'clamp(13px, 3.4cqw, 20px)',
        color: '#fff', letterSpacing: 2,
      }}>
        SCORE {fmtScore(result.score)}
      </div>
      <div style={{
        display: 'flex', gap: 14, fontSize: 'clamp(10px, 2.4cqw, 13px)',
        color: '#aaa', flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <span>{stageLabel(result.stageReached, result.cleared).split(' / ')[0]}</span>
        <span>回収 {result.itemsCollected}</span>
        <span>スタン {result.enemiesStunned}</span>
        <span>{(result.durationMs / 1000).toFixed(1)} 秒</span>
        {result.noMiss && result.cleared && <span style={{ color: '#6cf2ff' }}>💎 ノーミス</span>}
      </div>

      {newBest && (
        <div style={{
          padding: '6px 14px', borderRadius: 8,
          background: 'rgba(255,210,74,0.22)', color: '#ffd24a',
          fontWeight: 800, fontFamily: 'monospace', letterSpacing: 2,
          fontSize: 'clamp(11px, 2.4cqw, 13px)',
        }}>
          🏆 NEW BEST!
        </div>
      )}
      {pointsAwarded > 0 && (
        <div style={{
          fontSize: 'clamp(11px, 2.4cqw, 13px)',
          color: '#2ecc8a', fontWeight: 700,
        }}>
          +{pointsAwarded} pt 獲得
        </div>
      )}
      {error && (
        <div style={{
          fontSize: 'clamp(10px, 2cqw, 12px)',
          color: '#ef4444',
        }}>{error}</div>
      )}

      <div style={{
        display: 'flex', gap: 10, width: '100%',
        maxWidth: 420, marginTop: 4,
      }}>
        <button onClick={onRetry} style={overlayPrimaryBtn}>▶ もう一度</button>
        <button onClick={onMenu} style={overlaySecondaryBtn}>メニュー</button>
      </div>
      <div style={{
        display: 'flex', gap: 10, width: '100%',
        maxWidth: 420,
      }}>
        <button onClick={onShareTweet} style={{
          ...overlaySecondaryBtn,
          background: 'rgba(29,155,240,0.20)',
          border: '1px solid rgba(29,155,240,0.45)',
          color: '#5fa9f7',
          padding: '10px 12px',
        }}>𝕏 でシェア</button>
        <button onClick={onShareLine} style={{
          ...overlaySecondaryBtn,
          background: 'rgba(6,199,85,0.20)',
          border: '1px solid rgba(6,199,85,0.45)',
          color: '#6fdba0',
          padding: '10px 12px',
        }}>LINE でシェア</button>
      </div>
    </div>
  )
}

const overlayPrimaryBtn: React.CSSProperties = {
  flex: 1, padding: '12px 10px',
  fontSize: 'clamp(13px, 3cqw, 16px)', fontWeight: 900,
  color: '#fff', background: 'linear-gradient(135deg, #ff3060, #ff7aa6)',
  border: 'none', borderRadius: 12, cursor: 'pointer',
  fontFamily: 'monospace', letterSpacing: 2,
  boxShadow: '0 4px 18px rgba(255,80,120,0.45)',
  touchAction: 'manipulation',
}
const overlaySecondaryBtn: React.CSSProperties = {
  flex: 1, padding: '12px 10px',
  fontSize: 'clamp(13px, 3cqw, 16px)', fontWeight: 800,
  color: '#fff', background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12,
  cursor: 'pointer', fontFamily: 'monospace',
  touchAction: 'manipulation',
}
