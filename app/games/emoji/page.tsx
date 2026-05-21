'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { addPoints, POINT_CONFIG } from '../../lib/points'
import { trackMinigameShared } from '../../lib/analytics'
import { useTranslation } from '../../lib/i18n'
import GameShareButtons from '../../components/GameShareButtons'

const SHARE_URL = 'https://filmo.me/games/emoji'

type TFn = (key: string, params?: Record<string, string | number>) => string

function buildTweetText(correctCount: number, score: number, results: AttemptResult[], t: TFn) {
  // 正解した問題の絵文字をティーザーとして1つ載せる。なければ最初の問題のものを使う。
  const teaserQuiz = results.find(r => r.isCorrect)?.quiz || results[0]?.quiz
  const emojis = teaserQuiz?.emojis.join('') || '🎬✨❓'

  let opener: string
  if (correctCount === 10) {
    opener = t('games.emoji.tweetPerfect', { score })
  } else if (correctCount >= 7) {
    opener = t('games.emoji.tweetGood', { correct: correctCount, score })
  } else if (correctCount >= 4) {
    opener = t('games.emoji.tweetOk', { correct: correctCount, score })
  } else {
    opener = t('games.emoji.tweetBad', { correct: correctCount })
  }

  return opener + t('games.emoji.tweetTail', { emojis })
}

interface Quiz {
  id: string
  tmdb_id: number
  media_type: 'movie' | 'tv'
  title: string
  emojis: string[]
  difficulty: number
  poster_path: string | null
  release_year: number | null
  genres: string[] | null
}

interface SessionStats {
  best_score: number
  total_played: number
  total_correct: number
}

interface AttemptResult {
  quiz: Quiz
  isCorrect: boolean
  timeMs: number
  hintUsed: boolean
}

interface LeaderboardEntry {
  user_id: string
  user_name: string
  user_avatar: string | null
  best_score: number
  total_time_ms: number
  achieved_at: string
}

type Phase = 'menu' | 'loading' | 'playing' | 'result'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w185'
const QUESTIONS_PER_SESSION = 10
const POOL_FETCH_SIZE = 200
const RECENT_EXCLUDE_DAYS = 30
const LEADERBOARD_LIMIT = 20

export default function EmojiQuizPage() {
  const { t } = useTranslation()
  const [userId, setUserId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('menu')
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [error, setError] = useState<string>('')

  // Session state
  const [questions, setQuestions] = useState<Quiz[]>([])
  const [distractors, setDistractors] = useState<Quiz[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [choices, setChoices] = useState<Quiz[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hintShown, setHintShown] = useState(false)
  const [questionStart, setQuestionStart] = useState(0)
  const [results, setResults] = useState<AttemptResult[]>([])
  const [pointsAwarded, setPointsAwarded] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)

  const loadStats = useCallback(async (uid: string) => {
    const [bestRes, totalRes, correctRes] = await Promise.all([
      supabase
        .from('emoji_quiz_sessions')
        .select('score')
        .eq('user_id', uid)
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('emoji_quiz_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid),
      supabase
        .from('emoji_quiz_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('is_correct', true),
    ])
    setStats({
      best_score: bestRes.data?.score ?? 0,
      total_played: totalRes.count ?? 0,
      total_correct: correctRes.count ?? 0,
    })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
        loadStats(session.user.id)
      }
    })
  }, [loadStats])

  function setupQuestion(idx: number, qs: Quiz[], pool: Quiz[]) {
    const correct = qs[idx]
    const others = pool
      .filter(d => d.id !== correct.id && d.title !== correct.title)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
    const shuffled = [correct, ...others].sort(() => Math.random() - 0.5)
    setChoices(shuffled)
    setSelectedId(null)
    setHintShown(false)
    setQuestionStart(Date.now())
  }

  async function startGame() {
    setError('')
    setPhase('loading')
    try {
      const { data, error: qErr } = await supabase
        .from('emoji_quizzes')
        .select('id,tmdb_id,media_type,title,emojis,difficulty,poster_path,release_year,genres')
        .eq('is_active', true)
        .limit(POOL_FETCH_SIZE)
      if (qErr) throw qErr
      if (!data || data.length < QUESTIONS_PER_SESSION + 3) {
        setError(t('games.emoji.poolNotReady'))
        setPhase('menu')
        return
      }

      let pool: Quiz[] = data as Quiz[]

      if (userId) {
        const sinceISO = new Date(Date.now() - RECENT_EXCLUDE_DAYS * 86400000).toISOString()
        const { data: recent } = await supabase
          .from('emoji_quiz_attempts')
          .select('quiz_id')
          .eq('user_id', userId)
          .gte('created_at', sinceISO)
          .limit(500)
        const seen = new Set((recent || []).map((r: { quiz_id: string }) => r.quiz_id))
        const fresh = pool.filter(q => !seen.has(q.id))
        if (fresh.length >= QUESTIONS_PER_SESSION + 3) pool = fresh
      }

      const shuffled = [...pool].sort(() => Math.random() - 0.5)
      const qs = shuffled.slice(0, QUESTIONS_PER_SESSION)
      const dist = shuffled.slice(QUESTIONS_PER_SESSION)

      setQuestions(qs)
      setDistractors(dist)
      setResults([])
      setQIndex(0)
      setNewBest(false)
      setPointsAwarded(0)
      setupQuestion(0, qs, dist)
      setPhase('playing')
    } catch (e) {
      setError((e as Error).message || t('games.emoji.loadFailed'))
      setPhase('menu')
    }
  }

  async function handleAnswer(choice: Quiz) {
    if (selectedId) return
    const correct = questions[qIndex]
    const isCorrect = choice.id === correct.id
    const timeMs = Math.min(Date.now() - questionStart, 600000)
    setSelectedId(choice.id)

    const result: AttemptResult = { quiz: correct, isCorrect, timeMs, hintUsed: hintShown }
    setResults(prev => [...prev, result])

    if (userId) {
      // 失敗してもセッションは続くので await しない
      supabase
        .from('emoji_quiz_attempts')
        .insert({
          user_id: userId,
          quiz_id: correct.id,
          is_correct: isCorrect,
          hints_used: hintShown ? 1 : 0,
          time_ms: timeMs,
        })
        .then(() => undefined)
    }
  }

  function nextQuestion() {
    const next = qIndex + 1
    if (next >= QUESTIONS_PER_SESSION) {
      finishSession()
    } else {
      setQIndex(next)
      setupQuestion(next, questions, distractors)
    }
  }

  function calcScore(rs: AttemptResult[]) {
    let s = 0
    let correctCount = 0
    for (const r of rs) {
      if (!r.isCorrect) continue
      correctCount++
      let q = 10
      const tsec = r.timeMs / 1000
      if (tsec < 5) q += 5
      else if (tsec < 10) q += Math.max(0, Math.round(5 * (1 - (tsec - 5) / 5)))
      if (!r.hintUsed) q += 2
      s += q
    }
    if (correctCount === QUESTIONS_PER_SESSION) s += 50
    return s
  }

  async function awardGamePoints(uid: string, correctCount: number) {
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
    if (remaining <= 0) return 0

    let pts = correctCount * POINT_CONFIG.MINIGAME_CORRECT
    if (correctCount === QUESTIONS_PER_SESSION) pts += POINT_CONFIG.MINIGAME_PERFECT
    pts = Math.min(pts, remaining)
    if (pts > 0) {
      await addPoints(uid, pts, t('games.emoji.awardReason', { correct: correctCount, total: QUESTIONS_PER_SESSION }))
    }
    return pts
  }

  async function finishSession() {
    const score = calcScore(results)
    const correctCount = results.filter(r => r.isCorrect).length
    const totalTime = results.reduce((s, r) => s + r.timeMs, 0)

    if (userId) {
      await supabase.from('emoji_quiz_sessions').insert({
        user_id: userId,
        correct_count: correctCount,
        total_count: QUESTIONS_PER_SESSION,
        total_time_ms: totalTime,
        score,
      })
      const pts = await awardGamePoints(userId, correctCount)
      setPointsAwarded(pts)
      if (stats && score > stats.best_score) setNewBest(true)
    }
    setPhase('result')
    fetchLeaderboard()
  }

  async function fetchLeaderboard() {
    setLeaderboardLoading(true)
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_emoji_quiz_leaderboard', {
        p_limit: LEADERBOARD_LIMIT,
      })
      if (rpcErr) throw rpcErr
      setLeaderboard((data || []) as LeaderboardEntry[])
    } catch {
      setLeaderboard([])
    }
    setLeaderboardLoading(false)
  }

  function backToMenu() {
    setPhase('menu')
    if (userId) loadStats(userId)
  }

  // ── Rendering ─────────────────────────────────────────────
  if (phase === 'menu') {
    return (
      <PageShell>
        <HeaderBar title={t('games.emoji.title')} backAria={t('games.emoji.backAria')} />
        <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(108,92,231,0.18), rgba(0,192,48,0.10))',
            borderRadius: 16, padding: 24, marginBottom: 16,
            border: '1px solid var(--fm-border)',
          }}>
            <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>🚢💎🥶</div>
            <p style={{ fontSize: 14, color: 'var(--fm-text-sub)', textAlign: 'center', lineHeight: 1.6 }}>
              {t('games.emoji.intro')}<br />
              {t('games.emoji.introSub')}
            </p>
          </div>

          {stats && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16,
            }}>
              <StatCard label={t('games.emoji.statsBest')} value={stats.best_score} />
              <StatCard label={t('games.emoji.statsPlayed')} value={stats.total_played} />
              <StatCard label={t('games.emoji.statsCorrect')} value={stats.total_correct} />
            </div>
          )}

          {error && (
            <div style={{
              padding: 12, borderRadius: 10,
              background: 'rgba(255,80,80,0.1)', color: 'var(--fm-danger,#ff5050)',
              fontSize: 13, marginBottom: 12,
            }}>{error}</div>
          )}

          <button
            onClick={startGame}
            className="pulse-glow"
            style={{
              width: '100%', padding: '16px 0', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, var(--fm-accent), var(--fm-accent-light))',
              color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'pointer',
              letterSpacing: 0.5,
            }}>
            {t('games.emoji.start')}
          </button>

          {!userId && (
            <p style={{ fontSize: 12, color: 'var(--fm-text-muted)', textAlign: 'center', marginTop: 12 }}>
              {t('games.emoji.loginHint')}
            </p>
          )}

          <div style={{ marginTop: 24, padding: 16, background: 'var(--fm-bg-card)', borderRadius: 12, border: '1px solid var(--fm-border)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{t('games.emoji.rulesHeading')}</h3>
            <ul style={{ fontSize: 12, color: 'var(--fm-text-sub)', lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
              <li>{t('games.emoji.rule1')}</li>
              <li>{t('games.emoji.rule2')}</li>
              <li>{t('games.emoji.rule3')}</li>
              <li>{t('games.emoji.rule4')}</li>
              <li>{t('games.emoji.rule5', { cap: POINT_CONFIG.MINIGAME_DAILY_CAP })}</li>
            </ul>
          </div>
        </div>
      </PageShell>
    )
  }

  if (phase === 'loading') {
    return (
      <PageShell>
        <HeaderBar title={t('games.emoji.title')} backAria={t('games.emoji.backAria')} />
        <FullCenter>{t('games.emoji.loading')}</FullCenter>
      </PageShell>
    )
  }

  if (phase === 'playing') {
    const current = questions[qIndex]
    const answered = selectedId !== null
    const correctId = current.id
    const hintGenre = (current.genres || [])[0]
    const hintYear = current.release_year

    return (
      <PageShell>
        <HeaderBar title={t('games.emoji.progress', { q: qIndex + 1, total: QUESTIONS_PER_SESSION })} backAria={t('games.emoji.backAria')} />
        <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
          {/* Progress bar */}
          <div style={{ height: 6, background: 'var(--fm-bg-secondary)', borderRadius: 3, marginBottom: 24 }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: 'linear-gradient(90deg, var(--fm-accent), var(--fm-accent-light))',
              width: `${((qIndex + 1) / QUESTIONS_PER_SESSION) * 100}%`,
              transition: 'width 0.3s',
            }} />
          </div>

          {/* Emojis */}
          <div style={{
            background: 'var(--fm-bg-card)', borderRadius: 16, padding: '32px 16px',
            border: '1px solid var(--fm-border)', textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 52, letterSpacing: 6, lineHeight: 1.2 }}>
              {current.emojis.join('')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 12 }}>
              {t(current.media_type === 'tv' ? 'games.emoji.tagTv' : 'games.emoji.tagMovie')} ・ {t('games.emoji.difficultyLabel')} {'⭐'.repeat(current.difficulty)}
            </div>
          </div>

          {/* Hint */}
          {!answered && (
            <button
              onClick={() => setHintShown(true)}
              disabled={hintShown}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 10,
                border: '1px solid var(--fm-border)', background: 'transparent',
                color: hintShown ? 'var(--fm-text-sub)' : 'var(--fm-accent)',
                fontSize: 12, fontWeight: 600, marginBottom: 12,
                cursor: hintShown ? 'default' : 'pointer',
              }}>
              {hintShown
                ? t('games.emoji.hintShown', { genre: hintGenre || '?', year: hintYear ?? '?' })
                : t('games.emoji.hintShow')}
            </button>
          )}

          {/* Choices */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {choices.map(c => {
              const isPicked = selectedId === c.id
              const isCorrectChoice = c.id === correctId
              let bg = 'var(--fm-bg-card)'
              let border = '1px solid var(--fm-border)'
              let color = 'var(--fm-text)'
              if (answered) {
                if (isCorrectChoice) {
                  bg = 'rgba(0,192,48,0.18)'
                  border = '1px solid var(--fm-accent)'
                  color = 'var(--fm-accent)'
                } else if (isPicked) {
                  bg = 'rgba(255,80,80,0.12)'
                  border = '1px solid rgba(255,80,80,0.6)'
                  color = 'var(--fm-text-sub)'
                } else {
                  color = 'var(--fm-text-muted)'
                }
              }
              return (
                <button
                  key={c.id}
                  onClick={() => handleAnswer(c)}
                  disabled={answered}
                  style={{
                    padding: '14px 16px', borderRadius: 12, background: bg, border,
                    color, fontSize: 14, fontWeight: 600, textAlign: 'left',
                    cursor: answered ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                  }}>
                  {c.title}
                  {answered && isCorrectChoice && ' ✅'}
                  {answered && isPicked && !isCorrectChoice && ' ❌'}
                </button>
              )
            })}
          </div>

          {/* After-answer reveal */}
          {answered && (
            <div className="animate-slide-up" style={{ marginTop: 20 }}>
              <Link
                href={current.media_type === 'tv' ? `/tv/${current.tmdb_id}` : `/movies/${current.tmdb_id}`}
                style={{
                  display: 'flex', gap: 12, padding: 12, borderRadius: 12,
                  background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
                  textDecoration: 'none', color: 'inherit', marginBottom: 12,
                }}>
                {current.poster_path && (
                  <img
                    src={`${TMDB_IMG}${current.poster_path}`}
                    alt=""
                    style={{ width: 60, height: 90, borderRadius: 6, objectFit: 'cover' }}
                  />
                )}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{current.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginTop: 2 }}>
                    {current.release_year ?? '—'} ・ {(current.genres || [])[0] || ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fm-accent)', marginTop: 6 }}>
                    {t('games.emoji.viewDetail')}
                  </div>
                </div>
              </Link>

              <button
                onClick={nextQuestion}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                  background: 'var(--fm-accent)', color: '#fff', fontSize: 15, fontWeight: 700,
                  cursor: 'pointer',
                }}>
                {qIndex + 1 >= QUESTIONS_PER_SESSION ? t('games.emoji.viewResult') : t('games.emoji.next')}
              </button>
            </div>
          )}
        </div>
      </PageShell>
    )
  }

  // Result phase
  const correctCount = results.filter(r => r.isCorrect).length
  const score = calcScore(results)
  const totalSec = Math.round(results.reduce((s, r) => s + r.timeMs, 0) / 1000)
  const isPerfect = correctCount === QUESTIONS_PER_SESSION

  return (
    <PageShell>
      <HeaderBar title={t('games.emoji.resultTitle')} backAria={t('games.emoji.backAria')} />
      <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
        <div style={{
          background: isPerfect
            ? 'linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,107,107,0.10))'
            : 'linear-gradient(135deg, rgba(108,92,231,0.18), rgba(0,192,48,0.10))',
          borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 16,
          border: `1px solid ${isPerfect ? 'var(--fm-star,#ffd700)' : 'var(--fm-border)'}`,
        }}>
          {isPerfect && <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--fm-star,#ffd700)', marginBottom: 4 }}>{t('games.emoji.perfect')}</div>}
          {newBest && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fm-accent)', marginBottom: 4 }}>{t('games.emoji.newBest')}</div>}
          <div style={{ fontSize: 56, fontWeight: 900 }}>{score}</div>
          <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginTop: 4 }}>{t('games.emoji.scoreLabel')}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
          <StatCard label={t('games.emoji.correctLabel')} value={`${correctCount}/${QUESTIONS_PER_SESSION}`} />
          <StatCard label={t('games.emoji.timeLabel')} value={`${totalSec}s`} />
          <StatCard label={t('games.emoji.earnedLabel')} value={`+${pointsAwarded}`} />
        </div>

        {/* Question breakdown */}
        <div style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: 12, border: '1px solid var(--fm-border)', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--fm-text-sub)' }}>{t('games.emoji.breakdown')}</div>
          {results.map((r, i) => (
            <Link
              key={i}
              href={r.quiz.media_type === 'tv' ? `/tv/${r.quiz.tmdb_id}` : `/movies/${r.quiz.tmdb_id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                borderBottom: i < results.length - 1 ? '1px solid var(--fm-border)' : 'none',
                textDecoration: 'none', color: 'inherit',
              }}>
              <span style={{ width: 20, fontSize: 14 }}>{r.isCorrect ? '✅' : '❌'}</span>
              <span style={{ flex: 1, fontSize: 13 }}>
                {r.quiz.emojis.join('')} <span style={{ color: 'var(--fm-text-sub)' }}>→ {r.quiz.title}</span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                {(r.timeMs / 1000).toFixed(1)}s
              </span>
            </Link>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <GameShareButtons
            shareText={buildTweetText(correctCount, score, results, t)}
            shareUrl={SHARE_URL}
            onTrack={(channel) => trackMinigameShared(channel, correctCount, score)}
          />
          <button
            onClick={startGame}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, var(--fm-accent), var(--fm-accent-light))',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
            {t('games.emoji.replay')}
          </button>
          <button
            onClick={backToMenu}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 12,
              background: 'transparent', border: '1px solid var(--fm-border)',
              color: 'var(--fm-text-sub)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
            {t('games.emoji.back')}
          </button>
        </div>

        <Leaderboard
          entries={leaderboard}
          loading={leaderboardLoading}
          currentUserId={userId}
          t={t}
        />
      </div>
    </PageShell>
  )
}

function Leaderboard({
  entries,
  loading,
  currentUserId,
  t,
}: {
  entries: LeaderboardEntry[]
  loading: boolean
  currentUserId: string | null
  t: TFn
}) {
  return (
    <div style={{
      marginTop: 24, background: 'var(--fm-bg-card)', borderRadius: 12,
      padding: 16, border: '1px solid var(--fm-border)',
    }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
        {t('games.emoji.leaderboardTitle', { n: entries.length || '' })}
      </h3>

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--fm-text-sub)', fontSize: 13 }}>
          {t('games.emoji.leaderboardLoading')}
        </div>
      ) : entries.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--fm-text-sub)', fontSize: 13 }}>
          {t('games.emoji.leaderboardEmpty')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {entries.map((e, i) => {
            const rank = i + 1
            const isSelf = currentUserId === e.user_id
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : ''
            const timeSec = Math.round(e.total_time_ms / 1000)
            const timeLabel = timeSec >= 60
              ? `${Math.floor(timeSec / 60)}m ${timeSec % 60}s`
              : `${timeSec}s`
            return (
              <Link
                key={e.user_id}
                href={`/u/${e.user_id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 8px',
                  borderBottom: i < entries.length - 1 ? '1px solid var(--fm-border)' : 'none',
                  textDecoration: 'none', color: 'inherit',
                  background: isSelf ? 'rgba(0,192,48,0.10)' : 'transparent',
                  borderRadius: isSelf ? 8 : 0,
                  margin: isSelf ? '0 -4px' : 0,
                  paddingLeft: isSelf ? 12 : 8,
                  paddingRight: isSelf ? 12 : 8,
                }}>
                <span style={{
                  minWidth: 28, fontSize: medal ? 18 : 13, fontWeight: 700,
                  color: medal ? undefined : 'var(--fm-text-muted)', textAlign: 'center',
                }}>
                  {medal || rank}
                </span>
                {e.user_avatar ? (
                  <img
                    src={e.user_avatar}
                    alt=""
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      objectFit: 'cover', background: 'var(--fm-bg-secondary)',
                    }}
                  />
                ) : (
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--fm-bg-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, color: 'var(--fm-text-muted)',
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
                    {e.user_name || t('games.emoji.anonymous')}{isSelf && ` ${t('games.emoji.you')}`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                    {timeLabel}
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fm-accent)' }}>
                  {e.best_score}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--fm-bg)', color: 'var(--fm-text)' }}>
      {children}
    </div>
  )
}

function HeaderBar({ title, backAria }: { title: string; backAria: string }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: 'var(--fm-bg)', borderBottom: '1px solid var(--fm-border)',
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <Link
        href="/"
        aria-label={backAria}
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

function FullCenter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100dvh - 60px)', color: 'var(--fm-text-sub)', fontSize: 14,
    }}>
      {children}
    </div>
  )
}
