'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { addPoints, POINT_CONFIG } from '../../lib/points'
import { trackMinigameShared } from '../../lib/analytics'
import GameShareButtons, { type GameShareChannel } from '../../components/GameShareButtons'
import { useFilmius, type FilmiusResult } from '../../lib/filmius/useGame'
import { type Difficulty, type ShipType, LOGICAL_H, LOGICAL_W, SHIPS } from '../../lib/filmius/engine'

const SHARE_URL = 'https://filmo.me/games/filmius'
const DIFFICULTY_STORAGE_KEY = 'filmius:difficulty'
const SHIP_STORAGE_KEY = 'filmius:ship'
const SHIP_ORDER: ShipType[] = ['standard', 'scout', 'heavy']

// ====================================================
// Types
// ====================================================
type Phase = 'menu' | 'playing' | 'result'

interface StatEntry {
  difficulty: Difficulty
  best_score: number
  max_stage_reached: number
  total_plays: number
  total_clears: number
  no_miss_clears: number
}

type StatsByDifficulty = Record<Difficulty, StatEntry>

const EMPTY_STATS: StatsByDifficulty = {
  easy:   { difficulty: 'easy',   best_score: 0, max_stage_reached: 1, total_plays: 0, total_clears: 0, no_miss_clears: 0 },
  normal: { difficulty: 'normal', best_score: 0, max_stage_reached: 1, total_plays: 0, total_clears: 0, no_miss_clears: 0 },
  hard:   { difficulty: 'hard',   best_score: 0, max_stage_reached: 1, total_plays: 0, total_clears: 0, no_miss_clears: 0 },
}

const DIFFICULTY_META: Record<Difficulty, {
  label: string; sublabel: string; emoji: string; color: string;
}> = {
  easy:   { label: 'EASY',   sublabel: '残機 5 / 敵弱め',     emoji: '🌱', color: '#2ecc8a' },
  normal: { label: 'NORMAL', sublabel: '残機 3 / 標準',       emoji: '⚡', color: '#6cf2ff' },
  hard:   { label: 'HARD',   sublabel: '残機 2 / 敵強め',     emoji: '🔥', color: '#ff6188' },
}

const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'hard']

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
    case 1:  return 'STAGE 1 / GALACTIC PREMIERE'
    case 2:  return 'STAGE 2 / ASTEROID OF MEMORIES'
    case 3:  return 'STAGE 3 / THE FINAL CUT'
    case 4:  return 'STAGE 4 / NEBULA OF TRIALS'
    case 5:  return "STAGE 5 / DIRECTOR'S CUT"
    case 6:  return 'STAGE 6 / SEQUEL FATIGUE'
    case 7:  return 'STAGE 7 / REEL OF SHADOWS'
    case 8:  return "STAGE 8 / CRITIC'S NIGHTMARE"
    case 9:  return 'STAGE 9 / WRAP PARTY'
    case 10: return 'STAGE 10 / GOLDEN CURTAIN'
    case 11: return '★ ALL CLEAR ★'
    default: return 'STAGE 1'
  }
}

function buildTweetText(r: FilmiusResult): string {
  const diff = DIFFICULTY_META[r.difficulty].label
  const sh = SHIPS[r.ship].name
  const tag = `[${sh}/${diff}]`
  const head = r.cleared
    ? (r.noMiss ? `🎬 ${tag} ノーミス全クリア！ Filmius スコア ${r.score}!`
                : `🎬 ${tag} Filmius 全クリ！ スコア ${r.score}!`)
    : `🎬 ${tag} Filmius STAGE ${r.stageReached} まで到達 / スコア ${r.score}!`
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
  const [stats, setStats] = useState<StatsByDifficulty>(EMPTY_STATS)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [ship, setShip] = useState<ShipType>('standard')
  const [leaderboardDifficulty, setLeaderboardDifficulty] = useState<Difficulty>('normal')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [error, setError] = useState('')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const playAreaRef = useRef<HTMLDivElement | null>(null)
  const canvasBoxRef = useRef<HTMLDivElement | null>(null)

  // ─── localStorage で最後に選んだ難易度 / 機体を復元 ────────────────
  // SSR ハイドレーション後にクライアントで読み込むため、effect 内 setState は意図的。
  useEffect(() => {
    try {
      const savedDiff = window.localStorage.getItem(DIFFICULTY_STORAGE_KEY) as Difficulty | null
      if (savedDiff === 'easy' || savedDiff === 'normal' || savedDiff === 'hard') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDifficulty(savedDiff)
        setLeaderboardDifficulty(savedDiff)
      }
      const savedShip = window.localStorage.getItem(SHIP_STORAGE_KEY) as ShipType | null
      if (savedShip === 'standard' || savedShip === 'scout' || savedShip === 'heavy') {
        setShip(savedShip)
      }
    } catch { /* ignore */ }
  }, [])

  function selectDifficulty(d: Difficulty) {
    setDifficulty(d)
    setLeaderboardDifficulty(d)
    try { window.localStorage.setItem(DIFFICULTY_STORAGE_KEY, d) } catch { /* ignore */ }
  }

  function selectShip(s: ShipType) {
    setShip(s)
    try { window.localStorage.setItem(SHIP_STORAGE_KEY, s) } catch { /* ignore */ }
  }

  // ─── 戦績 (難易度別) ─────────────────────────────
  const loadStats = useCallback(async (uid: string) => {
    const { data } = await supabase.rpc('get_filmius_stats', { p_user_id: uid })
    if (!data) return
    const next: StatsByDifficulty = {
      easy:   { ...EMPTY_STATS.easy },
      normal: { ...EMPTY_STATS.normal },
      hard:   { ...EMPTY_STATS.hard },
    }
    for (const row of data as StatEntry[]) {
      if (row.difficulty === 'easy' || row.difficulty === 'normal' || row.difficulty === 'hard') {
        next[row.difficulty] = {
          difficulty: row.difficulty,
          best_score: row.best_score || 0,
          max_stage_reached: row.max_stage_reached || 1,
          total_plays: row.total_plays || 0,
          total_clears: row.total_clears || 0,
          no_miss_clears: row.no_miss_clears || 0,
        }
      }
    }
    setStats(next)
  }, [])

  const fetchLeaderboard = useCallback(async (diff: Difficulty) => {
    setLeaderboardLoading(true)
    try {
      const { data } = await supabase.rpc('get_filmius_leaderboard', {
        p_difficulty: diff, p_limit: 20,
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

  // 難易度タブ切替時に該当リーダーボードを取得。setState は意図的。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchLeaderboard(leaderboardDifficulty) }, [fetchLeaderboard, leaderboardDifficulty])

  // ─── ポイント付与 (ミニゲーム日次キャップ共有) ─────────────
  const awardClearPoints = useCallback(async (uid: string, r: FilmiusResult): Promise<number> => {
    let total = 0
    const breakdown: { pts: number; reason: string }[] = []
    const tag = `[${DIFFICULTY_META[r.difficulty].label}]`
    if (r.stageReached >= 2) breakdown.push({ pts: POINT_CONFIG.FILMIUS_CLEAR_STAGE1, reason: `🎮 ミニゲーム Filmius ${tag} STAGE 1 クリア` })
    if (r.stageReached >= 3) breakdown.push({ pts: POINT_CONFIG.FILMIUS_CLEAR_STAGE2, reason: `🎮 ミニゲーム Filmius ${tag} STAGE 2 クリア` })
    if (r.cleared)           breakdown.push({ pts: POINT_CONFIG.FILMIUS_CLEAR_ALL,    reason: `🎮 ミニゲーム Filmius ${tag} 全クリア` })
    if (r.cleared && r.noMiss) breakdown.push({ pts: POINT_CONFIG.FILMIUS_NO_MISS_BONUS, reason: `🎮 ミニゲーム Filmius ${tag} ノーミスボーナス` })
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
        difficulty: r.difficulty,
        ship: r.ship,
      })
      if (r.score > stats[r.difficulty].best_score) setNewBest(true)
      const pts = await awardClearPoints(userId, r)
      setPointsAwarded(pts)
      await loadStats(userId)
    } catch (e) {
      console.error('filmius end insert error:', e)
      setError('スコアの保存に失敗しました')
    }
    setLeaderboardDifficulty(r.difficulty)
    fetchLeaderboard(r.difficulty)
  }, [userId, stats, loadStats, fetchLeaderboard, awardClearPoints])

  // ─── ゲームフック ──────────────────────────
  const game = useFilmius(canvasRef, { onEnd: handleEnd })

  // ─── シェアトラッキング ────────────────────────
  const trackShare = useCallback((channel: GameShareChannel) => {
    if (!result) return
    trackMinigameShared(channel, result.enemiesKilled, result.score)
  }, [result])

  function startGame() {
    setResult(null)
    setPointsAwarded(0)
    setNewBest(false)
    setError('')
    setPhase('playing')
    // canvas のマウントを待ってから start
    const d = difficulty
    const sh = ship
    setTimeout(() => game.start(d, sh), 0)
  }

  function backToMenu() {
    game.stop()
    setPhase('menu')
  }

  // ─── キャンバス letterbox サイジング ──────────────────
  // 横向き iPhone のような縦が短いビューポートでも、ゲーム要素 (HUD・EQUIP) が
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
        background: 'radial-gradient(ellipse at top, #1a0033 0%, #050015 60%, #000 100%)',
        color: '#fff',
        padding: '12px 0 max(80px, env(safe-area-inset-bottom)) 0',
      }}>
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
        <MenuView
          stats={stats}
          difficulty={difficulty}
          onSelectDifficulty={selectDifficulty}
          ship={ship}
          onSelectShip={selectShip}
          leaderboard={leaderboard}
          leaderboardDifficulty={leaderboardDifficulty}
          onSelectLeaderboardDifficulty={setLeaderboardDifficulty}
          leaderboardLoading={leaderboardLoading}
          onStart={startGame}
        />
      </div>
    )
  }

  // プレイ中・結果: フルスクリーンレイアウト
  // 縦・横どちらの向きでもキャンバス全体が viewport に収まるよう、
  // playArea の実寸を ResizeObserver で測って canvasBox を letterbox サイズに合わせる。
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'radial-gradient(ellipse at top, #1a0033 0%, #050015 60%, #000 100%)',
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
            background: 'rgba(108,242,255,0.12)',
            color: '#6cf2ff',
            border: '1px solid rgba(108,242,255,0.35)',
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
        }}>FILMIUS</div>
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
            border: '1px solid rgba(255,210,74,0.35)',
            borderRadius: 8,
            overflow: 'hidden',
            touchAction: 'none',
            containerType: 'size', // ResultOverlay の cqw/cqh をこのボックスに対して解決
            // width / height は useLayoutEffect が動的に設定
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
          {/* ゲーム終了オーバーレイ (スコア + リトライ + シェア) */}
          {phase === 'result' && result && (
            <ResultOverlay
              result={result}
              newBest={newBest}
              pointsAwarded={pointsAwarded}
              error={error}
              onRetry={startGame}
              onMenu={backToMenu}
              shareText={buildTweetText(result)}
              shareUrl={SHARE_URL}
              onTrack={trackShare}
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
  stats, difficulty, onSelectDifficulty,
  ship, onSelectShip,
  leaderboard, leaderboardDifficulty, onSelectLeaderboardDifficulty,
  leaderboardLoading, onStart,
}: {
  stats: StatsByDifficulty
  difficulty: Difficulty
  onSelectDifficulty: (d: Difficulty) => void
  ship: ShipType
  onSelectShip: (s: ShipType) => void
  leaderboard: LeaderboardEntry[]
  leaderboardDifficulty: Difficulty
  onSelectLeaderboardDifficulty: (d: Difficulty) => void
  leaderboardLoading: boolean
  onStart: () => void
}) {
  const currentStat = stats[difficulty]
  const shipConfig = SHIPS[ship]
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      {/* タイトル */}
      <div style={{
        textAlign: 'center', padding: '14px 0 22px 0',
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

      {/* 機体選択 */}
      <div style={{
        padding: 14, borderRadius: 12, marginBottom: 12,
        background: `linear-gradient(135deg, ${shipConfig.color}1a, rgba(255,255,255,0.02))`,
        border: `1px solid ${shipConfig.color}55`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{
            fontSize: 11, color: '#aaa',
            fontFamily: 'monospace', letterSpacing: 2,
          }}>▸ CHOOSE YOUR SHIP</div>
          <div style={{
            fontSize: 10, color: shipConfig.color,
            fontFamily: 'monospace', letterSpacing: 1, fontWeight: 700,
          }}>{shipConfig.emoji} {shipConfig.name}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {SHIP_ORDER.map(sId => {
            const sc = SHIPS[sId]
            const selected = sId === ship
            return (
              <button
                key={sId}
                onClick={() => onSelectShip(sId)}
                style={{
                  padding: '10px 6px', borderRadius: 10,
                  background: selected
                    ? `linear-gradient(135deg, ${sc.color}44, ${sc.color}11)`
                    : 'rgba(0,0,0,0.3)',
                  border: `2px solid ${selected ? sc.color : 'rgba(255,255,255,0.1)'}`,
                  color: selected ? sc.color : '#bbb',
                  fontFamily: 'monospace', fontWeight: 800,
                  cursor: 'pointer', touchAction: 'manipulation',
                  textAlign: 'center',
                }}>
                <ShipIcon body={sc.color} trim={sc.trim} dimmed={!selected} />
                <div style={{ fontSize: 12, letterSpacing: 1, marginTop: 4 }}>{sc.name}</div>
                <div style={{
                  fontSize: 9, color: selected ? sc.color : '#888',
                  marginTop: 2, fontFamily: 'inherit', fontWeight: 500,
                }}>{sc.subtitle}</div>
              </button>
            )
          })}
        </div>
        {/* 現在選択中の機体ステータス */}
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 8,
          background: 'rgba(0,0,0,0.3)',
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
          fontSize: 10, fontFamily: 'monospace',
        }}>
          <StatBar label="移動" value={shipConfig.speedMul} max={1.5} color={shipConfig.color} />
          <StatBar label="連射" value={1 / shipConfig.fireCooldownMul} max={1.5} color={shipConfig.color} />
          <StatBar label="火力" value={shipConfig.normalDamage} max={2} color={shipConfig.color} />
        </div>
      </div>

      {/* 難易度選択 */}
      <div style={{
        padding: 14, borderRadius: 12, marginBottom: 14,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}>
        <div style={{
          fontSize: 11, color: '#aaa', marginBottom: 8,
          fontFamily: 'monospace', letterSpacing: 2,
        }}>▸ DIFFICULTY</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {DIFFICULTY_ORDER.map(d => {
            const meta = DIFFICULTY_META[d]
            const selected = d === difficulty
            return (
              <button
                key={d}
                onClick={() => onSelectDifficulty(d)}
                style={{
                  padding: '10px 6px', borderRadius: 10,
                  background: selected
                    ? `linear-gradient(135deg, ${meta.color}33, ${meta.color}11)`
                    : 'rgba(0,0,0,0.3)',
                  border: `1px solid ${selected ? meta.color : 'rgba(255,255,255,0.1)'}`,
                  color: selected ? meta.color : '#bbb',
                  fontFamily: 'monospace', fontWeight: 800,
                  cursor: 'pointer', touchAction: 'manipulation',
                }}>
                <div style={{ fontSize: 18 }}>{meta.emoji}</div>
                <div style={{ fontSize: 13, letterSpacing: 1, marginTop: 2 }}>{meta.label}</div>
                <div style={{
                  fontSize: 9, color: selected ? meta.color : '#888',
                  marginTop: 4, fontFamily: 'inherit', fontWeight: 500,
                }}>{meta.sublabel}</div>
              </button>
            )
          })}
        </div>
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
        ▶ INSERT COIN  [{shipConfig.name} / {DIFFICULTY_META[difficulty].label}]
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
          <div>❤️ ミスしてもパワーアップは継続。残機が 0 になるとゲームオーバー</div>
        </div>
      </div>

      {/* パワーアップ説明 */}
      <div style={{
        marginTop: 12, padding: 14, borderRadius: 12,
        background: 'rgba(255,210,74,0.06)',
        border: '1px solid rgba(255,210,74,0.25)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#ffd24a', marginBottom: 8 }}>
          ▸ パワーアップ (6スロット)
        </div>
        <div style={{ display: 'grid', gap: 4, fontSize: 12, color: '#ddd' }}>
          <div><b>1. SPEED</b> ⏩ — 移動速度UP (最大3段)</div>
          <div><b>2. MISSILE</b> 🎞️ — B-ROLL 追加弾</div>
          <div><b>3. DOUBLE FEATURE</b> 🎬 — 2way 弾</div>
          <div><b>4. PROJECTOR BEAM</b> 💡 — 貫通レーザー (DOUBLE と排他)</div>
          <div><b>5. BARRIER</b> 🛡️ — 被弾を3回吸収するフォースフィールド</div>
          <div><b>6. SEQUEL</b> 🎟️ — 軌跡追従オプション (最大4)</div>
        </div>
      </div>

      {/* 自分の戦績 (現在選択中の難易度) */}
      <div style={{
        marginTop: 16, padding: 14, borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>▸ 戦績</div>
          <div style={{
            fontSize: 10, color: DIFFICULTY_META[difficulty].color,
            fontFamily: 'monospace', letterSpacing: 2,
          }}>{DIFFICULTY_META[difficulty].label}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12 }}>
          <StatChip label="ベストスコア" value={fmtScore(currentStat.best_score)} accent="#ffd24a" mono />
          <StatChip label="最高到達" value={stageLabel(currentStat.max_stage_reached, false).split(' / ')[0]} accent="#6cf2ff" />
          <StatChip label="プレイ回数" value={`${currentStat.total_plays} 回`} />
          <StatChip label="クリア回数" value={`${currentStat.total_clears} 回 (ノーミス ${currentStat.no_miss_clears})`} />
        </div>
      </div>

      {/* リーダーボード (難易度タブ付き) */}
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
        {/* 難易度タブ */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6, marginBottom: 12,
        }}>
          {DIFFICULTY_ORDER.map(d => {
            const meta = DIFFICULTY_META[d]
            const active = d === leaderboardDifficulty
            return (
              <button
                key={d}
                onClick={() => onSelectLeaderboardDifficulty(d)}
                style={{
                  padding: '8px 4px', borderRadius: 8,
                  background: active ? `${meta.color}22` : 'rgba(0,0,0,0.25)',
                  border: `1px solid ${active ? meta.color : 'rgba(255,255,255,0.1)'}`,
                  color: active ? meta.color : '#888',
                  fontFamily: 'monospace', fontWeight: 800, fontSize: 11,
                  cursor: 'pointer', touchAction: 'manipulation',
                  letterSpacing: 1,
                }}>
                {meta.emoji} {meta.label}
              </button>
            )
          })}
        </div>
        {leaderboardLoading ? (
          <div style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: 16 }}>
            読み込み中…
          </div>
        ) : leaderboard.length === 0 ? (
          <div style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: 16 }}>
            {DIFFICULTY_META[leaderboardDifficulty].label} の記録はまだありません。最初の挑戦者になろう！
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

// 機体選択ボタン内の小アイコン
function ShipIcon({ body, trim, dimmed }: { body: string; trim: string; dimmed?: boolean }) {
  // engine の自機シェイプを簡易再現した SVG
  return (
    <svg viewBox="0 0 32 18" width="44" height="24"
         style={{ display: 'block', margin: '0 auto', opacity: dimmed ? 0.55 : 1 }}>
      {/* 噴射 */}
      <rect x="0" y="8" width="4" height="2" fill="#a8e9ff" />
      {/* 本体 (台形) */}
      <polygon points="4,3 24,2 30,9 24,16 4,15" fill={body} />
      {/* ハイライト */}
      <rect x="6" y="5" width="14" height="1.5" fill={trim} />
      {/* レンズ */}
      <circle cx="26" cy="9" r="2" fill="#fff" />
    </svg>
  )
}

// 機体ステータス比較用の小バー
function StatBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string
}) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div>
      <div style={{ color: '#aaa', marginBottom: 2 }}>{label}</div>
      <div style={{
        height: 4, borderRadius: 2,
        background: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: color, borderRadius: 2,
        }} />
      </div>
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
// フルスクリーンレイアウト上で、キャンバスにオーバーレイされる形で
// スコア / リトライ / シェアまで一画面に収める。
function ResultOverlay({
  result, newBest, pointsAwarded, error,
  onRetry, onMenu, shareText, shareUrl, onTrack,
}: {
  result: FilmiusResult
  newBest: boolean
  pointsAwarded: number
  error: string
  onRetry: () => void
  onMenu: () => void
  shareText: string
  shareUrl: string
  onTrack: (channel: GameShareChannel) => void
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
        <span style={{ color: SHIPS[result.ship].color }}>
          {SHIPS[result.ship].emoji} {SHIPS[result.ship].name}
        </span>
        <span style={{ color: DIFFICULTY_META[result.difficulty].color }}>
          {DIFFICULTY_META[result.difficulty].emoji} {DIFFICULTY_META[result.difficulty].label}
        </span>
        <span>{stageLabel(result.stageReached, result.cleared).split(' / ')[0]}</span>
        <span>撃破 {result.enemiesKilled}</span>
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
      <div style={{ width: '100%', maxWidth: 420 }}>
        <GameShareButtons
          shareText={shareText}
          shareUrl={shareUrl}
          onTrack={onTrack}
          variant="compact"
        />
      </div>
    </div>
  )
}

const overlayPrimaryBtn: React.CSSProperties = {
  flex: 1, padding: '12px 10px',
  fontSize: 'clamp(13px, 3cqw, 16px)', fontWeight: 900,
  color: '#000', background: 'linear-gradient(135deg, #ffd24a, #ff7a3f)',
  border: 'none', borderRadius: 12, cursor: 'pointer',
  fontFamily: 'monospace', letterSpacing: 2,
  boxShadow: '0 4px 18px rgba(255,210,74,0.45)',
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
