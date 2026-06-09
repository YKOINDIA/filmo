'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import LoginPrompt from '../components/LoginPrompt'
import {
  computeStats, levelForHours, earnedCommunityTitles,
  TARGET_PRESETS, TARGET_HOURS_MIN, TARGET_HOURS_MAX,
  FASTING_STYLES, styleOf, FOOD_TYPES, foodTypeOf,
  EXERCISE_TYPES, exerciseTypeOf, EXERCISE_UNIT_LABEL, computePlanProgress,
  type FastingStats, type LevelProgress, type CommunityTitle, type PlanProgress,
} from '../lib/fasting/levels'

// ====================================================
// テーマ
// ====================================================
const BG = '#08110d'
const ACCENT = '#4fd1a5'
const ACCENT2 = '#7cc4ff'

// ====================================================
// 型
// ====================================================
interface UserLite { name: string | null; avatar_url: string | null }

interface SessionRow {
  id: string
  user_id: string
  started_at: string
  target_hours: number
  ended_at: string | null
  result: 'completed' | 'stopped' | null
  users?: UserLite | UserLite[] | null
}

interface PostRow {
  id: string
  user_id: string
  body: string | null
  photo_url: string | null
  fasted_hours: number | null
  cheer_count: number
  created_at: string
  users?: UserLite | UserLite[] | null
}

interface FeedEvent {
  key: string
  type: 'start' | 'completed' | 'stopped'
  at: string
  name: string
  avatar: string | null
  targetHours: number
}

interface BodyLog {
  id: string
  logged_on: string
  weight_kg: number | null
  body_fat: number | null
  note: string | null
}

// 食事ウィンドウ (食べてよい時間帯)。'HH:MM:SS' のローカル時刻。本人のみ・非公開。
interface MealWindow {
  eat_start: string
  eat_end: string
}

// マイプラン (やり方・食事の種類・継続目標)。本人のみ・非公開。
interface Plan {
  style: string
  target_hours: number
  goal_days: number | null
  food_types: string[]
  food_note: string | null
  started_on: string
}

// 運動の記録。本人のみ・非公開。
interface ExerciseLog {
  id: string
  logged_on: string
  type: string
  amount: number | null
  unit: 'min' | 'reps' | 'km' | null
  note: string | null
}

function userOf(row: { users?: UserLite | UserLite[] | null }): UserLite {
  const u = row.users
  const v = Array.isArray(u) ? u[0] : u
  return { name: v?.name ?? null, avatar_url: v?.avatar_url ?? null }
}

const STAMP = '👏'

// ====================================================
// 画像圧縮 (アスペクト比維持・最大辺 1080・WebP / 非対応端末は JPEG)
// ====================================================
// 一部のモバイルブラウザでは onload/onerror/toBlob のいずれも発火せず
// Promise が永久に未解決のまま「投稿中…」で固まることがある。
// タイムアウトと WebP→JPEG フォールバックで必ず解決/失敗するようにする。
function compressImage(file: File, maxDim = 1080, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    let settled = false
    const finish = (b: Blob) => {
      if (settled) return
      settled = true; window.clearTimeout(timer); URL.revokeObjectURL(url); resolve(b)
    }
    const abort = (e: Error) => {
      if (settled) return
      settled = true; window.clearTimeout(timer); URL.revokeObjectURL(url); reject(e)
    }
    const timer = window.setTimeout(() => abort(new Error('image processing timed out')), 20000)

    img.onload = () => {
      try {
        let { width, height } = img
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width); width = maxDim
        } else if (height >= width && height > maxDim) {
          width = Math.round((width * maxDim) / height); height = maxDim
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { abort(new Error('canvas unavailable')); return }
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          b => {
            if (b) { finish(b); return }
            // WebP 非対応端末は JPEG で再試行。
            canvas.toBlob(
              b2 => b2 ? finish(b2) : abort(new Error('compress failed')),
              'image/jpeg', quality,
            )
          },
          'image/webp', quality,
        )
      } catch (e) {
        abort(e instanceof Error ? e : new Error('compress failed'))
      }
    }
    img.onerror = () => abort(new Error('image load failed'))
    img.src = url
  })
}

// ネットワーク待ち (storage アップロード・DB) が永遠に終わらず
// 「投稿中…」のまま固まるのを防ぐ。指定時間で必ず reject する。
function withTimeout<T>(work: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timer = 0
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms)
  })
  return Promise.race([Promise.resolve(work), timeout])
    .finally(() => window.clearTimeout(timer))
}

// ====================================================
// 時間フォーマット
// ====================================================
function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtRelative(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'たった今'
  if (min < 60) return `${min}分前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}時間前`
  const d = Math.floor(h / 24)
  return `${d}日前`
}

// 'HH:MM' 表記 (秒は切り捨て)。'HH:MM:SS' でも先頭 5 文字で OK。
function fmtHm(time: string): string {
  return time.slice(0, 5)
}

// ローカル日付の 'YYYY-MM-DD'。
function localDayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ミリ秒を「○時間○分」表記に。1 時間未満は「○分」。
function fmtUntil(ms: number): string {
  const totalMin = Math.max(0, Math.ceil(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h <= 0) return `${m}分`
  return `${h}時間${String(m).padStart(2, '0')}分`
}

// ====================================================
// 食事ウィンドウから「いま食べてよいか / 次の食事まで」を算出
// ====================================================
interface MealState {
  eating: boolean
  /** いま食べてよい場合: ウィンドウ終了までの残り ms */
  toEndMs: number
  /** いま断食中の場合: 次に食べ始められるまでの ms */
  toStartMs: number
  startLabel: string
  endLabel: string
}

// 'HH:MM:SS' をその日の経過分に変換。
function timeToMin(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function computeMeal(mw: MealWindow | null, now: number): MealState | null {
  if (!mw) return null
  const d = new Date(now)
  const nowMin = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
  const startMin = timeToMin(mw.eat_start)
  const endMin = timeToMin(mw.eat_end)
  const DAY = 24 * 60
  // 食べてよい時間帯に入っているか (深夜跨ぎ start>end も考慮)。
  const overnight = startMin > endMin
  const eating = overnight
    ? (nowMin >= startMin || nowMin < endMin)
    : (nowMin >= startMin && nowMin < endMin)

  // 終了 / 開始までの「分」を、跨ぎを考慮して前方向に計算。
  const fwd = (target: number) => {
    let diff = target - nowMin
    if (diff <= 0) diff += DAY
    return diff
  }
  const toEndMs = (overnight
    ? (nowMin < endMin ? endMin - nowMin : DAY - nowMin + endMin)
    : endMin - nowMin) * 60000
  const toStartMs = fwd(startMin) * 60000

  return {
    eating,
    toEndMs: Math.max(0, toEndMs),
    toStartMs: Math.max(0, toStartMs),
    startLabel: fmtHm(mw.eat_start),
    endLabel: fmtHm(mw.eat_end),
  }
}

// ====================================================
// メイン
// ====================================================
export default function FastingApp() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // 自分の状態
  const [mySession, setMySession] = useState<SessionRow | null>(null)
  const [stats, setStats] = useState<FastingStats>({ totalHours: 0, completedCount: 0, streakDays: 0, longestHours: 0 })
  const [postCount, setPostCount] = useState(0)
  const [cheersGiven, setCheersGiven] = useState(0)
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([])
  const [mealWindow, setMealWindow] = useState<MealWindow | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [achievedDays, setAchievedDays] = useState<Set<string>>(new Set())
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([])

  // コミュニティ
  const [activeCount, setActiveCount] = useState(0)
  const [feed, setFeed] = useState<FeedEvent[]>([])
  const [posts, setPosts] = useState<PostRow[]>([])
  const [myCheers, setMyCheers] = useState<Set<string>>(new Set())

  // UI
  const [now, setNow] = useState<number>(() => Date.now())
  // 目標時間ピッカー: null=非表示 / 'start'=新規開始 / 'change'=実行中の目標変更
  const [pickerMode, setPickerMode] = useState<null | 'start' | 'change'>(null)
  const [postModal, setPostModal] = useState<null | { sessionId: string | null; fastedHours: number | null }>(null)
  const [bodyModal, setBodyModal] = useState<null | { edit: BodyLog | null }>(null)
  const [mealModal, setMealModal] = useState(false)
  const [planModal, setPlanModal] = useState(false)
  const [exerciseModal, setExerciseModal] = useState<null | { edit: ExerciseLog | null }>(null)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [changingTarget, setChangingTarget] = useState(false)

  const level: LevelProgress = useMemo(() => levelForHours(stats.totalHours), [stats.totalHours])
  const communityTitles: CommunityTitle[] = useMemo(
    () => earnedCommunityTitles({ posts: postCount, cheersGiven, streakDays: stats.streakDays }),
    [postCount, cheersGiven, stats.streakDays],
  )

  // ────────────────────────────
  // コミュニティ取得 (ログイン不要)
  // ────────────────────────────
  const loadCommunity = useCallback(async (uid: string) => {
    // 同時実行ユーザー数
    const { count } = await supabase
      .from('fasting_sessions')
      .select('*', { count: 'exact', head: true })
      .is('ended_at', null)
    setActiveCount(count ?? 0)

    // タイムライン: 最近の開始 + 最近の終了 をマージ
    const [startsRes, endsRes] = await Promise.all([
      supabase
        .from('fasting_sessions')
        .select('id, user_id, started_at, target_hours, ended_at, result, users(name, avatar_url)')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(15),
      supabase
        .from('fasting_sessions')
        .select('id, user_id, started_at, target_hours, ended_at, result, users(name, avatar_url)')
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(15),
    ])
    const events: FeedEvent[] = []
    for (const s of (startsRes.data ?? []) as SessionRow[]) {
      const u = userOf(s)
      events.push({ key: `s-${s.id}`, type: 'start', at: s.started_at, name: u.name || '名無しさん', avatar: u.avatar_url, targetHours: s.target_hours })
    }
    for (const s of (endsRes.data ?? []) as SessionRow[]) {
      const u = userOf(s)
      events.push({
        key: `e-${s.id}`,
        type: s.result === 'completed' ? 'completed' : 'stopped',
        at: s.ended_at!, name: u.name || '名無しさん', avatar: u.avatar_url, targetHours: s.target_hours,
      })
    }
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    setFeed(events.slice(0, 24))

    // 回復食タイムライン
    const { data: postData } = await supabase
      .from('fasting_posts')
      .select('id, user_id, body, photo_url, fasted_hours, cheer_count, created_at, users(name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(24)
    const postRows = (postData ?? []) as PostRow[]
    setPosts(postRows)

    // 自分が応援済みの投稿
    if (uid && postRows.length > 0) {
      const ids = postRows.map(p => p.id)
      const { data: cheerData } = await supabase
        .from('fasting_cheers')
        .select('post_id')
        .eq('user_id', uid)
        .in('post_id', ids)
      setMyCheers(new Set((cheerData ?? []).map((c: { post_id: string }) => c.post_id)))
    }
  }, [])

  // ────────────────────────────
  // 自分のデータ取得 (要ログイン)
  // ────────────────────────────
  const loadMine = useCallback(async (uid: string) => {
    // 実行中セッション
    const { data: active } = await supabase
      .from('fasting_sessions')
      .select('id, user_id, started_at, target_hours, ended_at, result')
      .eq('user_id', uid)
      .is('ended_at', null)
      .limit(1)
      .maybeSingle()
    setMySession((active as SessionRow) ?? null)

    // 達成履歴 → 統計 + 達成日 (プラン継続用)
    const { data: history } = await supabase
      .from('fasting_sessions')
      .select('started_at, ended_at')
      .eq('user_id', uid)
      .eq('result', 'completed')
      .order('started_at', { ascending: false })
      .limit(1000)
    const completed = ((history ?? []) as { started_at: string; ended_at: string }[])
      .filter(h => h.ended_at)
    setStats(computeStats(completed))
    setAchievedDays(new Set(completed.map(h => localDayKey(new Date(h.started_at)))))

    // コミュニティ称号用カウント
    const [{ count: pc }, { count: cg }] = await Promise.all([
      supabase.from('fasting_posts').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('fasting_cheers').select('*', { count: 'exact', head: true }).eq('user_id', uid),
    ])
    setPostCount(pc ?? 0)
    setCheersGiven(cg ?? 0)
  }, [])

  // ────────────────────────────
  // からだの記録 (本人のみ・非公開)
  // ────────────────────────────
  const loadBody = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('fasting_body_logs')
      .select('id, logged_on, weight_kg, body_fat, note')
      .eq('user_id', uid)
      .order('logged_on', { ascending: false })
      .limit(90)
    setBodyLogs((data ?? []) as BodyLog[])
  }, [])

  // ────────────────────────────
  // 食事ウィンドウ (本人のみ・非公開)
  // ────────────────────────────
  const loadMealWindow = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('fasting_meal_windows')
      .select('eat_start, eat_end')
      .eq('user_id', uid)
      .maybeSingle()
    setMealWindow((data as MealWindow) ?? null)
  }, [])

  // ────────────────────────────
  // マイプラン (本人のみ・非公開)
  // ────────────────────────────
  const loadPlan = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('fasting_plans')
      .select('style, target_hours, goal_days, food_types, food_note, started_on')
      .eq('user_id', uid)
      .maybeSingle()
    setPlan((data as Plan) ?? null)
  }, [])

  // ────────────────────────────
  // 運動の記録 (本人のみ・非公開)
  // ────────────────────────────
  const loadExercise = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('fasting_exercise_logs')
      .select('id, logged_on, type, amount, unit, note')
      .eq('user_id', uid)
      .order('logged_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(120)
    setExerciseLogs((data ?? []) as ExerciseLog[])
  }, [])

  // ────────────────────────────
  // 初期化
  // ────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        const uid = session?.user?.id ?? ''
        setAuthed(!!session?.user)
        setUserId(uid)
        await loadCommunity(uid)
        if (uid) await Promise.all([
          loadMine(uid), loadBody(uid), loadMealWindow(uid), loadPlan(uid), loadExercise(uid),
        ])
      } catch (e) {
        console.error('[fasting] init failed', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [loadCommunity, loadMine, loadBody, loadMealWindow, loadPlan, loadExercise])

  // ────────────────────────────
  // 時計: 実行中は 1 秒、そうでなければ 30 秒
  // ────────────────────────────
  useEffect(() => {
    const period = mySession ? 1000 : 30000
    const id = window.setInterval(() => setNow(Date.now()), period)
    return () => window.clearInterval(id)
  }, [mySession])

  // ────────────────────────────
  // ポーリング: コミュニティを 25 秒ごとに再取得
  // (タブが見えている時のみ。バックグラウンドでは止める)
  // ────────────────────────────
  const uidRef = useRef(userId)
  uidRef.current = userId
  useEffect(() => {
    const tick = () => { if (!document.hidden) loadCommunity(uidRef.current) }
    const id = window.setInterval(tick, 25000)
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [loadCommunity])

  // ────────────────────────────
  // アクション
  // ────────────────────────────
  const startFast = useCallback(async (targetHours: number, startedAtISO?: string) => {
    if (!userId || mySession) return
    setStarting(true)
    try {
      const payload: { user_id: string; target_hours: number; started_at?: string } = {
        user_id: userId, target_hours: targetHours,
      }
      if (startedAtISO) payload.started_at = startedAtISO
      const { data, error } = await supabase
        .from('fasting_sessions')
        .insert(payload)
        .select('id, user_id, started_at, target_hours, ended_at, result')
        .single()
      if (error) throw error
      setMySession(data as SessionRow)
      setPickerMode(null)
      setNow(Date.now())
      loadCommunity(userId)
    } catch (e) {
      console.error('[fasting] start failed', e)
      alert('開始できませんでした。すでに実行中かもしれません。時間をおいて再度お試しください。')
      loadMine(userId)
    } finally {
      setStarting(false)
    }
  }, [userId, mySession, loadCommunity, loadMine])

  const endFast = useCallback(async () => {
    if (!userId || !mySession) return
    setEnding(true)
    try {
      const elapsedMs = Date.now() - new Date(mySession.started_at).getTime()
      const elapsedH = elapsedMs / 3_600_000
      const result: 'completed' | 'stopped' = elapsedH >= mySession.target_hours ? 'completed' : 'stopped'
      const endedAt = new Date().toISOString()
      const { error } = await supabase
        .from('fasting_sessions')
        .update({ ended_at: endedAt, result })
        .eq('id', mySession.id)
        .eq('user_id', userId)
      if (error) throw error
      const finishedSessionId = mySession.id
      setMySession(null)
      await loadMine(userId)
      loadCommunity(userId)
      // 回復食の投稿を促す
      setPostModal({ sessionId: finishedSessionId, fastedHours: Math.round(elapsedH * 10) / 10 })
    } catch (e) {
      console.error('[fasting] end failed', e)
      alert('終了処理に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setEnding(false)
    }
  }, [userId, mySession, loadMine, loadCommunity])

  // 実行中セッションの目標時間を変更する。
  const changeTarget = useCallback(async (targetHours: number) => {
    if (!userId || !mySession) return
    setChangingTarget(true)
    try {
      const { data, error } = await supabase
        .from('fasting_sessions')
        .update({ target_hours: targetHours })
        .eq('id', mySession.id)
        .eq('user_id', userId)
        .select('id, user_id, started_at, target_hours, ended_at, result')
        .single()
      if (error) throw error
      setMySession(data as SessionRow)
      setPickerMode(null)
    } catch (e) {
      console.error('[fasting] change target failed', e)
      alert('目標の変更に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setChangingTarget(false)
    }
  }, [userId, mySession])

  // 食事ウィンドウを登録/更新する (1 ユーザー 1 件・upsert)。
  const saveMealWindow = useCallback(async (eatStart: string, eatEnd: string) => {
    if (!userId) return
    const { error } = await supabase
      .from('fasting_meal_windows')
      .upsert({ user_id: userId, eat_start: eatStart, eat_end: eatEnd }, { onConflict: 'user_id' })
    if (error) throw error
    setMealWindow({ eat_start: eatStart, eat_end: eatEnd })
    setMealModal(false)
  }, [userId])

  const clearMealWindow = useCallback(async () => {
    if (!userId) return
    setMealWindow(null)
    try {
      await supabase.from('fasting_meal_windows').delete().eq('user_id', userId)
    } catch (e) {
      console.error('[fasting] meal window delete failed', e)
      loadMealWindow(userId)
    }
  }, [userId, loadMealWindow])

  // マイプランを登録/更新する (1 ユーザー 1 件・upsert)。
  const savePlan = useCallback(async (input: {
    style: string; targetHours: number; goalDays: number | null
    foodTypes: string[]; foodNote: string | null; startedOn: string
  }) => {
    if (!userId) return
    const { error } = await supabase
      .from('fasting_plans')
      .upsert({
        user_id: userId,
        style: input.style,
        target_hours: input.targetHours,
        goal_days: input.goalDays,
        food_types: input.foodTypes,
        food_note: input.foodNote,
        started_on: input.startedOn,
      }, { onConflict: 'user_id' })
    if (error) throw error
    setPlan({
      style: input.style, target_hours: input.targetHours, goal_days: input.goalDays,
      food_types: input.foodTypes, food_note: input.foodNote, started_on: input.startedOn,
    })
    setPlanModal(false)
  }, [userId])

  const clearPlan = useCallback(async () => {
    if (!userId) return
    setPlan(null)
    try {
      await supabase.from('fasting_plans').delete().eq('user_id', userId)
    } catch (e) {
      console.error('[fasting] plan delete failed', e)
      loadPlan(userId)
    }
  }, [userId, loadPlan])

  // 運動の記録を追加/更新する。
  const saveExercise = useCallback(async (input: {
    id: string | null; loggedOn: string; type: string
    amount: number | null; unit: 'min' | 'reps' | 'km' | null; note: string | null
  }) => {
    if (!userId) return
    if (input.id) {
      const { error } = await supabase
        .from('fasting_exercise_logs')
        .update({
          logged_on: input.loggedOn, type: input.type,
          amount: input.amount, unit: input.unit, note: input.note,
        })
        .eq('id', input.id).eq('user_id', userId)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('fasting_exercise_logs')
        .insert({
          user_id: userId, logged_on: input.loggedOn, type: input.type,
          amount: input.amount, unit: input.unit, note: input.note,
        })
      if (error) throw error
    }
    setExerciseModal(null)
    await loadExercise(userId)
  }, [userId, loadExercise])

  const deleteExercise = useCallback(async (id: string) => {
    if (!userId) return
    setExerciseLogs(prev => prev.filter(e => e.id !== id))
    try {
      await supabase.from('fasting_exercise_logs').delete().eq('id', id).eq('user_id', userId)
    } catch (e) {
      console.error('[fasting] exercise delete failed', e)
      loadExercise(userId)
    }
  }, [userId, loadExercise])

  const toggleCheer = useCallback(async (post: PostRow) => {
    if (!userId) { setAuthed(false); return }
    const already = myCheers.has(post.id)
    // 楽観的更新
    setMyCheers(prev => {
      const next = new Set(prev)
      if (already) next.delete(post.id); else next.add(post.id)
      return next
    })
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, cheer_count: Math.max(0, p.cheer_count + (already ? -1 : 1)) }
      : p))
    try {
      if (already) {
        await supabase.from('fasting_cheers').delete().eq('user_id', userId).eq('post_id', post.id)
        setCheersGiven(c => Math.max(0, c - 1))
      } else {
        await supabase.from('fasting_cheers').insert({ user_id: userId, post_id: post.id, stamp: STAMP })
        setCheersGiven(c => c + 1)
      }
    } catch (e) {
      console.error('[fasting] cheer failed', e)
      // 失敗したら再取得で整合
      loadCommunity(userId)
    }
  }, [userId, myCheers, loadCommunity])

  const submitPost = useCallback(async (body: string, file: File | null) => {
    if (!userId || !postModal) return
    let photo_url: string | null = null
    try {
      if (file) {
        const blob = await compressImage(file)
        const ext = blob.type === 'image/jpeg' ? 'jpg' : 'webp'
        const path = `${userId}/${Date.now()}.${ext}`
        const { error: upErr } = await withTimeout(
          supabase.storage
            .from('fasting')
            .upload(path, blob, { contentType: blob.type || 'image/webp', cacheControl: '3600' }),
          30000, 'upload',
        )
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('fasting').getPublicUrl(path)
        photo_url = urlData.publicUrl
      }
      const { error } = await withTimeout(
        supabase.from('fasting_posts').insert({
          user_id: userId,
          session_id: postModal.sessionId,
          body: body.trim() || null,
          photo_url,
          fasted_hours: postModal.fastedHours,
        }),
        20000, 'insert',
      )
      if (error) throw error
      setPostModal(null)
      setPostCount(c => c + 1)
      loadCommunity(userId)
    } catch (e) {
      console.error('[fasting] post failed', e)
      const timedOut = e instanceof Error && e.message.includes('timed out')
      alert(timedOut
        ? '通信に時間がかかり中断しました。電波の良い場所で、もう一度お試しください。'
        : '投稿に失敗しました。写真サイズを下げるか、時間をおいて再度お試しください。')
    }
  }, [userId, postModal, loadCommunity])

  const saveBody = useCallback(async (input: {
    loggedOn: string; weightKg: number | null; bodyFat: number | null; note: string | null
  }) => {
    if (!userId) return
    const { error } = await supabase
      .from('fasting_body_logs')
      .upsert({
        user_id: userId,
        logged_on: input.loggedOn,
        weight_kg: input.weightKg,
        body_fat: input.bodyFat,
        note: input.note,
      }, { onConflict: 'user_id,logged_on' })
    if (error) throw error
    setBodyModal(null)
    await loadBody(userId)
  }, [userId, loadBody])

  const deleteBody = useCallback(async (id: string) => {
    if (!userId) return
    setBodyLogs(prev => prev.filter(b => b.id !== id))
    try {
      await supabase.from('fasting_body_logs').delete().eq('id', id).eq('user_id', userId)
    } catch (e) {
      console.error('[fasting] body delete failed', e)
      loadBody(userId)
    }
  }, [userId, loadBody])

  // ────────────────────────────
  // 派生値: タイマー表示
  // ────────────────────────────
  const timer = useMemo(() => {
    if (!mySession) return null
    const startMs = new Date(mySession.started_at).getTime()
    const elapsedMs = now - startMs
    const targetMs = mySession.target_hours * 3_600_000
    const ratio = Math.min(1, elapsedMs / targetMs)
    const reached = elapsedMs >= targetMs
    const remainMs = Math.max(0, targetMs - elapsedMs)
    // 経過の「N日目」。開始した瞬間が 1 日目。
    const dayNumber = Math.floor(Math.max(0, elapsedMs) / 86_400_000) + 1
    return { elapsedMs, ratio, reached, remainMs, dayNumber }
  }, [mySession, now])

  // ────────────────────────────
  // 派生値: 次の食事までのカウントダウン
  // ────────────────────────────
  const meal = useMemo(() => computeMeal(mealWindow, now), [mealWindow, now])

  // ────────────────────────────
  // 派生値: マイプランの継続状況
  // ────────────────────────────
  const planProgress: PlanProgress | null = useMemo(() => {
    if (!plan) return null
    // プラン開始日以降の達成日だけを数える。
    const since = new Set(
      [...achievedDays].filter(k => k >= plan.started_on),
    )
    return computePlanProgress(plan.started_on, since, new Date(now))
  }, [plan, achievedDays, now])

  // ────────────────────────────
  // レンダリング
  // ────────────────────────────
  return (
    <div style={{ background: BG, minHeight: '100dvh', color: '#dfe9e4', paddingBottom: 60 }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(8,17,13,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${ACCENT}33`,
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href="/" aria-label="ホームに戻る" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', textDecoration: 'none', fontSize: 18,
        }}>←</Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: ACCENT, letterSpacing: 1, fontWeight: 700, textTransform: 'uppercase' }}>
            🌌 Filmo Universe
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>
            🍃 Filmo ファスティング
          </h1>
        </div>
        <ActiveCountBadge count={activeCount} />
      </header>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#789' }}>読み込み中…</div>
      )}

      {!loading && (
        <>
          {/* ===== タイマー / 開始エリア ===== */}
          <section style={{ padding: '18px 16px 6px' }}>
            {authed && mySession && timer ? (
              <ActiveTimerCard
                timer={timer}
                targetHours={mySession.target_hours}
                meal={meal}
                onEnd={endFast}
                onChangeTarget={() => setPickerMode('change')}
                ending={ending}
              />
            ) : authed ? (
              <StartCard
                onStart={() => setPickerMode('start')}
                starting={starting}
                plan={plan}
                progress={planProgress}
              />
            ) : (
              <GuestCallout onLogin={() => setAuthed(false)} />
            )}
          </section>

          {/* ===== 安全アラート (常時) ===== */}
          <SafetyBanner active={!!mySession} />

          {/* ===== 未ログイン: ログインフォーム ===== */}
          {authed === false && (
            <section style={{ padding: '4px 0' }}>
              <LoginPrompt
                title="Filmo ファスティング"
                subtitle="ログインすると、タイマー・記録・回復食シェア・応援が使えます。"
                onAuthenticated={async (uid) => {
                  setAuthed(true)
                  setUserId(uid)
                  setLoading(true)
                  await loadCommunity(uid)
                  await Promise.all([
                    loadMine(uid), loadBody(uid), loadMealWindow(uid), loadPlan(uid), loadExercise(uid),
                  ])
                  setLoading(false)
                }}
              />
            </section>
          )}

          {/* ===== レベル / 称号 (ログイン時) ===== */}
          {authed && (
            <section style={{ padding: '8px 16px' }}>
              <LevelCard level={level} stats={stats} titles={communityTitles} />
            </section>
          )}

          {/* ===== マイプラン (ログイン時・非公開) ===== */}
          {authed && (
            <section style={{ padding: '8px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <SectionTitle emoji="🗓" title="マイプラン" sub="やり方・食事の種類・継続目標（自分だけが見られます）" noMargin />
                <button
                  onClick={() => setPlanModal(true)}
                  style={{
                    padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: '#06231a',
                    fontSize: 13, fontWeight: 800, flexShrink: 0,
                  }}>
                  {plan ? '変更' : '＋ 設定'}
                </button>
              </div>
              <MyPlanSection plan={plan} progress={planProgress} onSetup={() => setPlanModal(true)} />
            </section>
          )}

          {/* ===== からだの記録 (ログイン時・非公開) ===== */}
          {authed && (
            <section style={{ padding: '8px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <SectionTitle emoji="📉" title="からだの記録" sub="体重・体の変化（自分だけが見られます）" noMargin />
                <button
                  onClick={() => setBodyModal({ edit: null })}
                  style={{
                    padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: '#06231a',
                    fontSize: 13, fontWeight: 800, flexShrink: 0,
                  }}>
                  ＋ 記録
                </button>
              </div>
              <BodySection
                logs={bodyLogs}
                onEdit={log => setBodyModal({ edit: log })}
                onDelete={deleteBody}
              />
            </section>
          )}

          {/* ===== 食事のタイミング (ログイン時・非公開) ===== */}
          {authed && (
            <section style={{ padding: '8px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <SectionTitle emoji="🍽" title="食事のタイミング" sub="食べてよい時間帯（自分だけが見られます）" noMargin />
                <button
                  onClick={() => setMealModal(true)}
                  style={{
                    padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: '#06231a',
                    fontSize: 13, fontWeight: 800, flexShrink: 0,
                  }}>
                  {mealWindow ? '変更' : '＋ 登録'}
                </button>
              </div>
              <MealSection meal={meal} mealWindow={mealWindow} />
            </section>
          )}

          {/* ===== 運動の記録 (ログイン時・非公開) ===== */}
          {authed && (
            <section style={{ padding: '8px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <SectionTitle emoji="🏃" title="運動の記録" sub="ストレッチ・ウォーキング・筋トレなど（自分だけが見られます）" noMargin />
                <button
                  onClick={() => setExerciseModal({ edit: null })}
                  style={{
                    padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: '#06231a',
                    fontSize: 13, fontWeight: 800, flexShrink: 0,
                  }}>
                  ＋ 記録
                </button>
              </div>
              <ExerciseSection
                logs={exerciseLogs}
                onEdit={log => setExerciseModal({ edit: log })}
                onDelete={deleteExercise}
              />
            </section>
          )}

          {/* ===== みんなの今 (タイムライン) ===== */}
          <section style={{ padding: '8px 16px' }}>
            <SectionTitle emoji="⚡" title="みんなの今" sub={`いま ${activeCount} 人がファスティング中`} />
            <TimelineFeed feed={feed} now={now} />
          </section>

          {/* ===== 回復食シェア ===== */}
          <section style={{ padding: '8px 16px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <SectionTitle emoji="🍲" title="回復食シェア" sub="断食明けの一食を称え合おう" noMargin />
              {authed && (
                <button
                  onClick={() => setPostModal({ sessionId: null, fastedHours: null })}
                  style={{
                    padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: '#06231a',
                    fontSize: 13, fontWeight: 800, flexShrink: 0,
                  }}>
                  ＋ シェア
                </button>
              )}
            </div>
            {posts.length === 0 ? (
              <div style={{
                padding: 28, textAlign: 'center', color: '#789', fontSize: 13,
                border: `1px dashed ${ACCENT}33`, borderRadius: 16,
              }}>
                まだ投稿がありません。最初の回復食をシェアしてみよう。
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {posts.map(p => (
                  <PostCard
                    key={p.id}
                    post={p}
                    cheered={myCheers.has(p.id)}
                    now={now}
                    onCheer={() => toggleCheer(p)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ===== 友達を招待 ===== */}
          <section style={{ padding: '0 16px 28px' }}>
            <SectionTitle emoji="🎉" title="友達を招待" sub="一緒に頑張る仲間を誘おう" />
            <InviteCard />
          </section>
        </>
      )}

      {/* ===== 目標時間ピッカー ===== */}
      {pickerMode && (
        <TargetPicker
          mode={pickerMode}
          initialTarget={pickerMode === 'change' && mySession ? mySession.target_hours : (plan?.target_hours ?? 16)}
          onPick={startFast}
          onChange={changeTarget}
          onClose={() => setPickerMode(null)}
          busy={pickerMode === 'change' ? changingTarget : starting}
          now={now}
        />
      )}

      {/* ===== 回復食 投稿モーダル ===== */}
      {postModal && (
        <PostModal
          fastedHours={postModal.fastedHours}
          onSubmit={submitPost}
          onClose={() => setPostModal(null)}
        />
      )}

      {/* ===== からだの記録 モーダル ===== */}
      {bodyModal && (
        <BodyModal
          edit={bodyModal.edit}
          onSave={saveBody}
          onClose={() => setBodyModal(null)}
        />
      )}

      {/* ===== 食事のタイミング モーダル ===== */}
      {mealModal && (
        <MealWindowModal
          current={mealWindow}
          onSave={saveMealWindow}
          onClear={mealWindow ? clearMealWindow : undefined}
          onClose={() => setMealModal(false)}
        />
      )}

      {/* ===== マイプラン モーダル ===== */}
      {planModal && (
        <PlanModal
          current={plan}
          onSave={savePlan}
          onClear={plan ? clearPlan : undefined}
          onClose={() => setPlanModal(false)}
        />
      )}

      {/* ===== 運動の記録 モーダル ===== */}
      {exerciseModal && (
        <ExerciseModal
          edit={exerciseModal.edit}
          onSave={saveExercise}
          onClose={() => setExerciseModal(null)}
        />
      )}
    </div>
  )
}

// ====================================================
// パーツ
// ====================================================
function ActiveCountBadge({ count }: { count: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
      padding: '6px 12px', borderRadius: 999,
      background: `${ACCENT}1f`, border: `1px solid ${ACCENT}55`,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: ACCENT,
        boxShadow: `0 0 8px ${ACCENT}`, animation: 'fastPulse 1.6s ease-in-out infinite',
      }} />
      <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{count}</span>
      <span style={{ fontSize: 10, color: '#bcd' }}>人 断食中</span>
      <style>{`@keyframes fastPulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
    </div>
  )
}

function SectionTitle({ emoji, title, sub, noMargin }: { emoji: string; title: string; sub?: string; noMargin?: boolean }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{emoji}</span>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: 0 }}>{title}</h2>
      </div>
      {sub && <div style={{ fontSize: 11, color: '#8aa79b', marginTop: 3, marginLeft: 24 }}>{sub}</div>}
    </div>
  )
}

function StartCard({ onStart, starting, plan, progress }: {
  onStart: () => void
  starting: boolean
  plan: Plan | null
  progress: PlanProgress | null
}) {
  const style = plan ? styleOf(plan.style) : null
  return (
    <div style={{
      padding: '28px 20px', borderRadius: 20, textAlign: 'center',
      background: `radial-gradient(120% 120% at 50% 0%, ${ACCENT}1f, rgba(20,30,26,0.6))`,
      border: `1px solid ${ACCENT}33`,
    }}>
      <div style={{ fontSize: 40, marginBottom: 6 }}>{style?.emoji ?? '🍃'}</div>
      {plan && style ? (
        <>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            {style.label} を継続中
          </div>
          <div style={{ fontSize: 12, color: '#9fb8ad', marginBottom: 16, lineHeight: 1.6 }}>
            {progress && (
              <>
                {progress.elapsedDays}日目
                {plan.goal_days ? ` / 目標 ${plan.goal_days}日` : ''}
                ・これまで <strong style={{ color: ACCENT }}>{progress.achievedDays}回</strong>達成<br />
              </>
            )}
            目標 {plan.target_hours}h でワンタップ開始できます。
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            さあ、ファスティングを始めよう
          </div>
          <div style={{ fontSize: 12, color: '#9fb8ad', marginBottom: 18, lineHeight: 1.6 }}>
            いま頑張っている仲間がいます。<br />ワンタップで開始、いつでも終了できます。
          </div>
        </>
      )}
      <button
        onClick={onStart}
        disabled={starting}
        style={{
          width: '100%', maxWidth: 280, padding: '15px 0', borderRadius: 999, border: 'none',
          cursor: starting ? 'default' : 'pointer',
          background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: '#06231a',
          fontSize: 17, fontWeight: 900, letterSpacing: 1,
          boxShadow: `0 8px 24px ${ACCENT}44`,
        }}>
        ▶ {plan ? `${plan.target_hours}h で開始` : '開始する'}
      </button>
    </div>
  )
}

function ActiveTimerCard({
  timer, targetHours, meal, onEnd, onChangeTarget, ending,
}: {
  timer: { elapsedMs: number; ratio: number; reached: boolean; remainMs: number; dayNumber: number }
  targetHours: number
  meal: MealState | null
  onEnd: () => void
  onChangeTarget: () => void
  ending: boolean
}) {
  const size = 220
  const stroke = 14
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * timer.ratio
  return (
    <div style={{
      padding: '22px 20px', borderRadius: 20, textAlign: 'center',
      background: `radial-gradient(120% 120% at 50% 0%, ${ACCENT}26, rgba(18,28,24,0.7))`,
      border: `1px solid ${ACCENT}44`,
    }}>
      <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={timer.reached ? '#ffd24a' : ACCENT}
            strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 0.5s linear, stroke 0.4s' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: ACCENT, letterSpacing: 1,
            padding: '2px 10px', borderRadius: 999, background: `${ACCENT}1f`, marginBottom: 4,
          }}>
            {timer.dayNumber}日目
          </div>
          <div style={{ fontSize: 11, color: '#8aa79b', letterSpacing: 1 }}>経過時間</div>
          <div style={{
            fontSize: 34, fontWeight: 900, color: '#fff',
            fontVariantNumeric: 'tabular-nums', letterSpacing: 1,
          }}>
            {fmtElapsed(timer.elapsedMs)}
          </div>
          {timer.reached ? (
            <div style={{ fontSize: 13, fontWeight: 800, color: '#ffd24a', marginTop: 4 }}>
              🎉 目標 {targetHours}h 達成！
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#9fb8ad', marginTop: 4 }}>
              目標 {targetHours}h / 残り {fmtElapsed(timer.remainMs)}
            </div>
          )}
        </div>
      </div>

      {/* 次の食事までのカウントダウン (食事ウィンドウ登録時) */}
      {meal && !meal.eating && (
        <div style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 12,
          background: `${ACCENT2}14`, border: `1px solid ${ACCENT2}40`,
          fontSize: 13, color: '#cfe',
        }}>
          🍽 次の食事（{meal.startLabel}）まで{' '}
          <strong style={{ color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{fmtUntil(meal.toStartMs)}</strong>
        </div>
      )}
      {meal && meal.eating && (
        <div style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 12,
          background: 'rgba(255,210,74,0.12)', border: '1px solid rgba(255,210,74,0.4)',
          fontSize: 13, color: '#ffe08a',
        }}>
          🍽 いまは食事タイム（〜{meal.endLabel}）。残り{' '}
          <strong style={{ color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{fmtUntil(meal.toEndMs)}</strong>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button
          onClick={onChangeTarget}
          disabled={ending}
          style={{
            flex: 1, padding: '14px 0', borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.18)',
            cursor: ending ? 'default' : 'pointer',
            background: 'rgba(255,255,255,0.06)', color: '#dfe9e4',
            fontSize: 14, fontWeight: 800,
          }}>
          🎯 目標を変更
        </button>
        <button
          onClick={onEnd}
          disabled={ending}
          style={{
            flex: 1.4, padding: '14px 0', borderRadius: 999,
            border: timer.reached ? 'none' : '1px solid rgba(255,255,255,0.18)',
            cursor: ending ? 'default' : 'pointer',
            background: timer.reached ? 'linear-gradient(135deg, #ffd24a, #ff9f43)' : 'rgba(255,255,255,0.06)',
            color: timer.reached ? '#3a2600' : '#dfe9e4',
            fontSize: 14, fontWeight: 800,
          }}>
          {ending ? '処理中…' : timer.reached ? '⏹ 終えてシェア' : '⏹ 終了する'}
        </button>
      </div>
    </div>
  )
}

function GuestCallout({ onLogin }: { onLogin: () => void }) {
  return (
    <div style={{
      padding: '22px 20px', borderRadius: 20, textAlign: 'center',
      background: `radial-gradient(120% 120% at 50% 0%, ${ACCENT}1a, rgba(20,30,26,0.6))`,
      border: `1px solid ${ACCENT}33`,
    }}>
      <div style={{ fontSize: 38, marginBottom: 6 }}>🍃</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
        仲間とファスティングを続けよう
      </div>
      <div style={{ fontSize: 12, color: '#9fb8ad', marginBottom: 16, lineHeight: 1.6 }}>
        下のタイムラインは今すぐ見られます。<br />タイマー・記録・応援にはログインが必要です。
      </div>
      <button
        onClick={onLogin}
        style={{
          padding: '12px 28px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: '#06231a',
          fontSize: 15, fontWeight: 800,
        }}>
        ログイン / 新規登録
      </button>
    </div>
  )
}

function SafetyBanner({ active }: { active: boolean }) {
  return (
    <section style={{ padding: '8px 16px 0' }}>
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: '11px 14px', borderRadius: 12,
        background: active ? 'rgba(255,159,67,0.12)' : 'rgba(124,196,255,0.08)',
        border: `1px solid ${active ? 'rgba(255,159,67,0.4)' : 'rgba(124,196,255,0.25)'}`,
      }}>
        <span style={{ fontSize: 18, lineHeight: 1.2 }}>{active ? '⚠️' : '💧'}</span>
        <div style={{ fontSize: 11.5, color: active ? '#ffd9b0' : '#bcd', lineHeight: 1.6 }}>
          <strong style={{ color: active ? '#ffb86b' : '#cfe6ff' }}>
            水分をこまめに。
          </strong>{' '}
          めまい・吐き気・強い空腹・体調の異変を感じたら<strong>すぐに終了</strong>してください。
          持病のある方・妊娠授乳中・未成年の断食は医師に相談を。Filmo は医療行為を提供しません。
        </div>
      </div>
    </section>
  )
}

function LevelCard({ level, stats, titles }: { level: LevelProgress; stats: FastingStats; titles: CommunityTitle[] }) {
  const c = level.current
  return (
    <div style={{
      padding: 16, borderRadius: 18,
      background: 'rgba(18,28,24,0.7)', border: '1px solid rgba(255,255,255,0.08)',
      borderLeft: `4px solid ${c.color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          fontSize: 28, width: 52, height: 52, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 14, background: `${c.color}22`, border: `1px solid ${c.color}55`,
        }}>{c.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#8aa79b', fontWeight: 700 }}>Lv.{c.level}</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{c.title}</div>
        </div>
      </div>

      {/* 次レベルへの進捗 */}
      <div style={{ marginTop: 14 }}>
        <div style={{
          height: 9, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.round(level.ratio * 100)}%`, height: '100%',
            background: `linear-gradient(90deg, ${c.color}, ${ACCENT2})`, transition: 'width 0.6s',
          }} />
        </div>
        <div style={{ fontSize: 11, color: '#8aa79b', marginTop: 6 }}>
          {level.next
            ? <>次の「{level.next.title}」まで あと <strong style={{ color: '#fff' }}>{level.hoursToNext.toFixed(1)}h</strong></>
            : <>最高レベル到達 — まさにレジェンド 👑</>}
        </div>
      </div>

      {/* 統計 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Stat label="累計時間" value={`${stats.totalHours}h`} />
        <Stat label="達成回数" value={`${stats.completedCount}`} />
        <Stat label="連続日数" value={`${stats.streakDays}日`} highlight={stats.streakDays >= 3} />
      </div>

      {/* コミュニティ称号 */}
      {titles.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
          {titles.map(t => (
            <span key={t.key} title={t.hint} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
              background: 'rgba(255,210,74,0.14)', border: '1px solid rgba(255,210,74,0.4)', color: '#ffe08a',
            }}>
              <span>{t.emoji}</span>{t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      flex: 1, textAlign: 'center', padding: '10px 4px', borderRadius: 12,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: highlight ? '#ffd24a' : '#fff' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#8aa79b', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Avatar({ name, url, size = 32 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `${ACCENT}33`, color: '#cfe', fontSize: size * 0.45, fontWeight: 800,
    }}>{(name || '?').charAt(0)}</div>
  )
}

function TimelineFeed({ feed, now }: { feed: FeedEvent[]; now: number }) {
  if (feed.length === 0) {
    return (
      <div style={{
        padding: 24, textAlign: 'center', color: '#789', fontSize: 13,
        border: `1px dashed ${ACCENT}33`, borderRadius: 16,
      }}>
        まだ動きがありません。あなたが最初の一人になろう。
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {feed.map(e => {
        const verb = e.type === 'start' ? '開始' : e.type === 'completed' ? '達成して終了' : '終了'
        const icon = e.type === 'start' ? '▶' : e.type === 'completed' ? '🎉' : '⏹'
        const color = e.type === 'start' ? ACCENT : e.type === 'completed' ? '#ffd24a' : '#9fb8ad'
        return (
          <div key={e.key} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Avatar name={e.name} url={e.avatar} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#dfe9e4', wordBreak: 'break-word' }}>
                <strong style={{ color: '#fff' }}>{e.name}</strong> さんが {e.targetHours}h を{verb}
              </div>
              <div style={{ fontSize: 10.5, color: '#789', marginTop: 1 }}>{fmtRelative(e.at, now)}</div>
            </div>
            <span style={{ fontSize: 15, color }}>{icon}</span>
          </div>
        )
      })}
    </div>
  )
}

function PostCard({ post, cheered, now, onCheer }: { post: PostRow; cheered: boolean; now: number; onCheer: () => void }) {
  const u = userOf(post)
  const name = u.name || '名無しさん'
  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      background: 'rgba(18,28,24,0.7)', border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {post.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.photo_url}
          alt="回復食"
          style={{ width: '100%', maxHeight: 360, objectFit: 'cover', display: 'block' }}
        />
      )}
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: post.body ? 8 : 0 }}>
          <Avatar name={name} url={u.avatar_url} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', wordBreak: 'break-word' }}>{name}</div>
            <div style={{ fontSize: 10.5, color: '#789' }}>
              {post.fasted_hours != null && (
                <span style={{ color: ACCENT, fontWeight: 700 }}>🍃 {post.fasted_hours}h 達成　</span>
              )}
              {fmtRelative(post.created_at, now)}
            </div>
          </div>
        </div>
        {post.body && (
          <div style={{ fontSize: 13.5, color: '#dfe9e4', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {post.body}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button
            onClick={onCheer}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
              background: cheered ? `${ACCENT}26` : 'rgba(255,255,255,0.05)',
              border: `1px solid ${cheered ? ACCENT : 'rgba(255,255,255,0.14)'}`,
              color: cheered ? ACCENT : '#bcd', fontSize: 13, fontWeight: 700,
              transition: 'all 0.15s',
            }}>
            <span style={{ fontSize: 15 }}>{STAMP}</span>
            応援 {post.cheer_count > 0 && <span>{post.cheer_count}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ====================================================
// 目標時間ピッカー (ボトムシート)
// すでに始めている人は開始時刻をさかのぼって登録できる。
// ====================================================
// datetime-local 用にローカル時刻の 'YYYY-MM-DDTHH:mm' を作る。
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const BACKDATE_CHIPS: { label: string; hoursAgo: number }[] = [
  { label: '6時間前', hoursAgo: 6 },
  { label: '12時間前', hoursAgo: 12 },
  { label: '1日前', hoursAgo: 24 },
  { label: '2日前', hoursAgo: 48 },
  { label: '3日前', hoursAgo: 72 },
  { label: '4日前', hoursAgo: 96 },
]

function TargetPicker({ mode, initialTarget, onPick, onChange, onClose, busy, now }: {
  mode: 'start' | 'change'
  initialTarget: number
  onPick: (h: number, startedAtISO?: string) => void
  onChange: (h: number) => void
  onClose: () => void
  busy: boolean
  now: number
}) {
  const isChange = mode === 'change'
  const presetMatch = TARGET_PRESETS.some(p => p.hours === initialTarget)
  const [target, setTarget] = useState<number>(initialTarget)
  const [customMode, setCustomMode] = useState(!presetMatch)
  const [customHours, setCustomHours] = useState(presetMatch ? '' : String(initialTarget))
  const [backdate, setBackdate] = useState(false)
  const [startLocal, setStartLocal] = useState<string>(() => toLocalInput(new Date(now)))

  const effectiveTarget = customMode
    ? Math.round(Number(customHours))
    : target
  const validTarget = Number.isFinite(effectiveTarget)
    && effectiveTarget >= TARGET_HOURS_MIN && effectiveTarget <= TARGET_HOURS_MAX

  const startDate = backdate ? new Date(startLocal) : null
  const startInvalid = backdate && (!startLocal || isNaN(startDate!.getTime()) || startDate!.getTime() > now)

  const elapsedNote = backdate && startDate && !startInvalid
    ? (() => {
        const h = (now - startDate.getTime()) / 3_600_000
        return h >= 1 ? `すでに約 ${Math.floor(h)} 時間が経過した状態で記録します` : 'ほぼ今から開始します'
      })()
    : null

  const setChip = (hoursAgo: number) => {
    setStartLocal(toLocalInput(new Date(now - hoursAgo * 3_600_000)))
  }

  const submit = () => {
    if (!validTarget || startInvalid || busy) return
    if (isChange) {
      onChange(effectiveTarget)
    } else {
      onPick(effectiveTarget, startDate ? startDate.toISOString() : undefined)
    }
  }

  return (
    <BottomSheet onClose={onClose} title={isChange ? '目標時間を変更' : '目標時間を選ぶ'}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {TARGET_PRESETS.map(p => {
          const sel = !customMode && target === p.hours
          return (
            <button
              key={p.hours}
              onClick={() => { setCustomMode(false); setTarget(p.hours) }}
              style={{
                display: 'block', padding: '12px 12px', borderRadius: 14, cursor: 'pointer',
                background: sel ? `${ACCENT}22` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${sel ? ACCENT : `${ACCENT}33`}`,
                color: '#dfe9e4', textAlign: 'left',
              }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{p.label}</div>
              <div style={{ fontSize: 10.5, color: '#8aa79b', marginTop: 2 }}>{p.note}</div>
            </button>
          )
        })}
        {/* カスタム */}
        <button
          onClick={() => setCustomMode(true)}
          style={{
            display: 'block', padding: '12px 12px', borderRadius: 14, cursor: 'pointer',
            background: customMode ? `${ACCENT}22` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${customMode ? ACCENT : `${ACCENT}33`}`,
            color: '#dfe9e4', textAlign: 'left',
          }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>カスタム</div>
          <div style={{ fontSize: 10.5, color: '#8aa79b', marginTop: 2 }}>自分で時間を決める</div>
        </button>
      </div>

      {customMode && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number"
            inputMode="numeric"
            value={customHours}
            onChange={e => setCustomHours(e.target.value)}
            placeholder="例: 20"
            min={TARGET_HOURS_MIN}
            max={TARGET_HOURS_MAX}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
              color: '#fff', fontSize: 16, outline: 'none',
            }}
          />
          <span style={{ fontSize: 14, color: '#bcd', fontWeight: 700 }}>時間</span>
        </div>
      )}
      {customMode && customHours !== '' && !validTarget && (
        <div style={{ fontSize: 11, color: '#ffb3b3', marginTop: 6 }}>
          {TARGET_HOURS_MIN}〜{TARGET_HOURS_MAX} 時間の範囲で入力してください。
        </div>
      )}

      {/* すでに始めている (途中参加) — 変更モードでは非表示 */}
      {!isChange && (
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, cursor: 'pointer',
        padding: '12px 14px', borderRadius: 12,
        background: backdate ? `${ACCENT2}14` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${backdate ? `${ACCENT2}55` : 'rgba(255,255,255,0.08)'}`,
      }}>
        <input
          type="checkbox"
          checked={backdate}
          onChange={e => setBackdate(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: ACCENT }}
        />
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>すでに始めている</div>
          <div style={{ fontSize: 11, color: '#8aa79b', marginTop: 2 }}>
            断食中の方も、開始時刻をさかのぼって記録できます
          </div>
        </div>
      </label>
      )}

      {!isChange && backdate && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {BACKDATE_CHIPS.map(c => (
              <button
                key={c.hoursAgo}
                onClick={() => setChip(c.hoursAgo)}
                style={{
                  padding: '7px 12px', borderRadius: 999, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.05)', border: `1px solid ${ACCENT2}40`,
                  color: '#cfe', fontSize: 12.5, fontWeight: 700,
                }}>
                {c.label}
              </button>
            ))}
          </div>
          <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 4 }}>開始した日時</label>
          <input
            type="datetime-local"
            value={startLocal}
            max={toLocalInput(new Date(now))}
            onChange={e => setStartLocal(e.target.value)}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${startInvalid ? 'rgba(255,107,107,0.5)' : 'rgba(255,255,255,0.14)'}`,
              color: '#fff', fontSize: 15, outline: 'none', colorScheme: 'dark',
            }}
          />
          {startInvalid ? (
            <div style={{ fontSize: 11, color: '#ffb3b3', marginTop: 6 }}>
              未来の時刻は指定できません。
            </div>
          ) : elapsedNote && (
            <div style={{ fontSize: 11, color: '#9fb8ad', marginTop: 6 }}>{elapsedNote}</div>
          )}
        </div>
      )}

      <button
        onClick={submit}
        disabled={!validTarget || startInvalid || busy}
        style={{
          width: '100%', marginTop: 18, padding: '15px 0', borderRadius: 999, border: 'none',
          cursor: (!validTarget || startInvalid || busy) ? 'default' : 'pointer',
          background: (!validTarget || startInvalid || busy)
            ? `${ACCENT}55`
            : `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
          color: '#06231a', fontSize: 16, fontWeight: 900, letterSpacing: 1,
        }}>
        {isChange
          ? (busy ? '変更中…' : `🎯 ${validTarget ? `${effectiveTarget}h に` : ''}変更する`)
          : (busy ? '開始中…' : `▶ ${validTarget ? `${effectiveTarget}h で` : ''}開始する`)}
      </button>

      <div style={{ fontSize: 11, color: '#789', marginTop: 14, lineHeight: 1.6, textAlign: 'center' }}>
        {isChange
          ? '経過時間はそのまま、目標だけが変わります。'
          : 'いつでも途中で終了できます。無理のない範囲で。'}
      </div>
    </BottomSheet>
  )
}

// ====================================================
// 回復食 投稿モーダル
// ====================================================
function PostModal({ fastedHours, onSubmit, onClose }: {
  fastedHours: number | null
  onSubmit: (body: string, file: File | null) => Promise<void>
  onClose: () => void
}) {
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const MAX = 20 * 1024 * 1024
    if (f.size > MAX) { setErr('画像サイズは 20MB 以下にしてください'); return }
    setErr(null)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const submit = async () => {
    if (!body.trim() && !file) { setErr('テキストか写真のどちらかを入れてください'); return }
    setBusy(true); setErr(null)
    try { await onSubmit(body, file) } finally { setBusy(false) }
  }

  return (
    <BottomSheet onClose={busy ? undefined : onClose} title="回復食をシェア">
      {fastedHours != null && (
        <div style={{
          marginBottom: 14, padding: '8px 12px', borderRadius: 10, fontSize: 13,
          background: `${ACCENT}1a`, border: `1px solid ${ACCENT}40`, color: '#cfe',
        }}>
          🍃 おつかれさま！ <strong>{fastedHours}h</strong> のファスティング達成です。
        </div>
      )}

      {/* 写真 */}
      <label style={{
        display: 'block', borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
        border: `1px dashed ${ACCENT}55`, marginBottom: 14,
      }}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="プレビュー" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: '#8aa79b' }}>
            <div style={{ fontSize: 30, marginBottom: 4 }}>📷</div>
            <div style={{ fontSize: 13 }}>写真を選ぶ（任意・1枚）</div>
            <div style={{ fontSize: 10.5, marginTop: 3, color: '#678' }}>アップロード時に自動で圧縮されます</div>
          </div>
        )}
        <input type="file" accept="image/*" onChange={onPickFile} style={{ display: 'none' }} />
      </label>

      {/* テキスト */}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="今日の回復食は…（こだわりの出汁、おかゆ、スープなど）"
        maxLength={500}
        rows={4}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
          color: '#fff', fontSize: 15, resize: 'vertical', fontFamily: 'inherit', outline: 'none',
        }}
      />

      {err && (
        <div style={{
          marginTop: 12, padding: '9px 12px', borderRadius: 8, fontSize: 13,
          background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.35)', color: '#ffb3b3',
        }}>{err}</div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} style={{
          flex: 1, padding: '12px', borderRadius: 12, cursor: busy ? 'default' : 'pointer',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
          color: '#bcd', fontSize: 14, fontWeight: 700,
        }}>
          {fastedHours != null ? 'スキップ' : 'キャンセル'}
        </button>
        <button onClick={submit} disabled={busy} style={{
          flex: 2, padding: '12px', borderRadius: 12, border: 'none',
          cursor: busy ? 'default' : 'pointer',
          background: busy ? `${ACCENT}66` : `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
          color: '#06231a', fontSize: 14, fontWeight: 800,
        }}>
          {busy ? '投稿中…' : '投稿する'}
        </button>
      </div>
    </BottomSheet>
  )
}

// ====================================================
// からだの記録セクション (本人のみ・非公開)
// 体重スパークライン + 直近の記録リスト
// ====================================================
function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function BodySection({ logs, onEdit, onDelete }: {
  logs: BodyLog[]
  onEdit: (log: BodyLog) => void
  onDelete: (id: string) => void
}) {
  // 体重のある記録のみで推移を見る (古い→新しい)。
  const weighted = useMemo(
    () => logs.filter(l => l.weight_kg != null).slice().reverse(),
    [logs],
  )

  const summary = useMemo(() => {
    if (weighted.length === 0) return null
    const first = weighted[0].weight_kg!
    const last = weighted[weighted.length - 1].weight_kg!
    const delta = Math.round((last - first) * 10) / 10
    return { first, last, delta }
  }, [weighted])

  if (logs.length === 0) {
    return (
      <div style={{
        padding: 24, textAlign: 'center', color: '#789', fontSize: 13,
        border: `1px dashed ${ACCENT}33`, borderRadius: 16,
      }}>
        まだ記録がありません。体重や体の変化を記録して、ファスティングの効果を実感しよう。
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* サマリー + スパークライン */}
      {summary && (
        <div style={{
          padding: 16, borderRadius: 16,
          background: 'rgba(18,28,24,0.7)', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>{summary.last}</span>
              <span style={{ fontSize: 13, color: '#8aa79b', marginLeft: 3 }}>kg</span>
            </div>
            {weighted.length >= 2 && (
              <span style={{
                fontSize: 13, fontWeight: 800,
                color: summary.delta < 0 ? ACCENT : summary.delta > 0 ? '#ffb86b' : '#8aa79b',
              }}>
                {summary.delta < 0 ? '▼' : summary.delta > 0 ? '▲' : '±'}
                {Math.abs(summary.delta)}kg
                <span style={{ fontSize: 10.5, color: '#789', fontWeight: 600 }}>（記録開始から）</span>
              </span>
            )}
          </div>
          {weighted.length >= 2 && <Sparkline points={weighted.map(w => w.weight_kg!)} />}
        </div>
      )}

      {/* 記録リスト */}
      <div style={{ display: 'grid', gap: 8 }}>
        {logs.slice(0, 10).map(l => (
          <div key={l.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 13px', borderRadius: 12,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 12, color: '#8aa79b', fontWeight: 700, width: 44, flexShrink: 0, paddingTop: 2 }}>
              {fmtDate(l.logged_on)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                {l.weight_kg != null && (
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
                    {l.weight_kg}<span style={{ fontSize: 11, color: '#8aa79b' }}>kg</span>
                  </span>
                )}
                {l.body_fat != null && (
                  <span style={{ fontSize: 13, color: ACCENT2, fontWeight: 700 }}>
                    体脂肪 {l.body_fat}%
                  </span>
                )}
              </div>
              {l.note && (
                <div style={{ fontSize: 12.5, color: '#bcd', marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {l.note}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={() => onEdit(l)} aria-label="編集" style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#789', fontSize: 15, padding: 4,
              }}>✏️</button>
              <button onClick={() => { if (confirm('この記録を削除しますか？')) onDelete(l.id) }} aria-label="削除" style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#789', fontSize: 15, padding: 4,
              }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Sparkline({ points }: { points: number[] }) {
  const w = 280, h = 48, pad = 4
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0
  const coords = points.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (h - pad * 2) * (1 - (v - min) / span)
    return [x, y] as const
  })
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ')
  const last = coords[coords.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ marginTop: 10, display: 'block' }} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={ACCENT} />
    </svg>
  )
}

// ====================================================
// からだの記録 入力モーダル
// ====================================================
function BodyModal({ edit, onSave, onClose }: {
  edit: BodyLog | null
  onSave: (input: { loggedOn: string; weightKg: number | null; bodyFat: number | null; note: string | null }) => Promise<void>
  onClose: () => void
}) {
  const todayKey = () => {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  const [loggedOn, setLoggedOn] = useState(edit?.logged_on ?? todayKey())
  const [weight, setWeight] = useState(edit?.weight_kg != null ? String(edit.weight_kg) : '')
  const [bodyFat, setBodyFat] = useState(edit?.body_fat != null ? String(edit.body_fat) : '')
  const [note, setNote] = useState(edit?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    const w = weight.trim() === '' ? null : Number(weight)
    const f = bodyFat.trim() === '' ? null : Number(bodyFat)
    const n = note.trim() === '' ? null : note.trim()
    if (w == null && f == null && !n) { setErr('体重・体脂肪・メモのいずれかを入力してください'); return }
    if (w != null && (!Number.isFinite(w) || w <= 0 || w >= 500)) { setErr('体重は 0〜500kg の範囲で入力してください'); return }
    if (f != null && (!Number.isFinite(f) || f < 0 || f > 100)) { setErr('体脂肪率は 0〜100% の範囲で入力してください'); return }
    setBusy(true); setErr(null)
    try {
      await onSave({ loggedOn, weightKg: w, bodyFat: f, note: n })
    } catch (e) {
      console.error('[fasting] body save failed', e)
      setErr('保存に失敗しました。時間をおいて再度お試しください。')
      setBusy(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
    color: '#fff', fontSize: 16, outline: 'none',
  }

  return (
    <BottomSheet onClose={busy ? undefined : onClose} title={edit ? '記録を編集' : 'からだの記録'}>
      <div style={{
        marginBottom: 14, padding: '8px 12px', borderRadius: 10, fontSize: 11.5,
        background: 'rgba(124,196,255,0.08)', border: '1px solid rgba(124,196,255,0.25)', color: '#bcd', lineHeight: 1.6,
      }}>
        🔒 からだの記録はあなただけが見られます。コミュニティには表示されません。
      </div>

      <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 4 }}>日付</label>
      <input
        type="date"
        value={loggedOn}
        max={todayKey()}
        onChange={e => setLoggedOn(e.target.value)}
        style={{ ...inputStyle, fontSize: 15, colorScheme: 'dark', marginBottom: 14 }}
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 4 }}>体重 (kg)</label>
          <input type="number" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)}
            placeholder="例: 58.5" step="0.1" style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 4 }}>体脂肪率 (%・任意)</label>
          <input type="number" inputMode="decimal" value={bodyFat} onChange={e => setBodyFat(e.target.value)}
            placeholder="例: 22.0" step="0.1" style={inputStyle} />
        </div>
      </div>

      <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 4 }}>体の変化メモ（任意）</label>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="肌の調子、お腹のすっきり感、体調、気づきなど…"
        maxLength={500}
        rows={3}
        style={{ ...inputStyle, fontSize: 15, resize: 'vertical', fontFamily: 'inherit' }}
      />

      {err && (
        <div style={{
          marginTop: 12, padding: '9px 12px', borderRadius: 8, fontSize: 13,
          background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.35)', color: '#ffb3b3',
        }}>{err}</div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} style={{
          flex: 1, padding: '12px', borderRadius: 12, cursor: busy ? 'default' : 'pointer',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
          color: '#bcd', fontSize: 14, fontWeight: 700,
        }}>キャンセル</button>
        <button onClick={submit} disabled={busy} style={{
          flex: 2, padding: '12px', borderRadius: 12, border: 'none',
          cursor: busy ? 'default' : 'pointer',
          background: busy ? `${ACCENT}66` : `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
          color: '#06231a', fontSize: 14, fontWeight: 800,
        }}>{busy ? '保存中…' : '保存する'}</button>
      </div>
    </BottomSheet>
  )
}

// ====================================================
// 食事のタイミング セクション (本人のみ・非公開)
// ====================================================
function MealSection({ meal, mealWindow }: { meal: MealState | null; mealWindow: MealWindow | null }) {
  if (!mealWindow || !meal) {
    return (
      <div style={{
        padding: 24, textAlign: 'center', color: '#789', fontSize: 13,
        border: `1px dashed ${ACCENT}33`, borderRadius: 16,
      }}>
        食べてよい時間帯（例 12:00〜20:00）を登録すると、次の食事までの時間が分かります。
      </div>
    )
  }
  return (
    <div style={{
      padding: 16, borderRadius: 16,
      background: 'rgba(18,28,24,0.7)', border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>🍽</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#8aa79b', fontWeight: 700 }}>食べてよい時間帯</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            {meal.startLabel} 〜 {meal.endLabel}
          </div>
        </div>
      </div>
      <div style={{
        marginTop: 12, padding: '11px 14px', borderRadius: 12,
        background: meal.eating ? 'rgba(255,210,74,0.12)' : `${ACCENT2}14`,
        border: `1px solid ${meal.eating ? 'rgba(255,210,74,0.4)' : `${ACCENT2}40`}`,
        fontSize: 13.5, color: meal.eating ? '#ffe08a' : '#cfe',
      }}>
        {meal.eating ? (
          <>いまは食事タイム。終了（{meal.endLabel}）まで{' '}
            <strong style={{ color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{fmtUntil(meal.toEndMs)}</strong></>
        ) : (
          <>次の食事（{meal.startLabel}）まで{' '}
            <strong style={{ color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{fmtUntil(meal.toStartMs)}</strong></>
        )}
      </div>
    </div>
  )
}

// ====================================================
// 食事のタイミング 入力モーダル
// ====================================================
function MealWindowModal({ current, onSave, onClear, onClose }: {
  current: MealWindow | null
  onSave: (eatStart: string, eatEnd: string) => Promise<void>
  onClear?: () => void
  onClose: () => void
}) {
  const [start, setStart] = useState(current ? fmtHm(current.eat_start) : '12:00')
  const [end, setEnd] = useState(current ? fmtHm(current.eat_end) : '20:00')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const overnight = timeToMin(start) > timeToMin(end)

  const submit = async () => {
    if (!start || !end) { setErr('開始と終了の時刻を入力してください'); return }
    if (start === end) { setErr('開始と終了が同じ時刻です'); return }
    setBusy(true); setErr(null)
    try {
      await onSave(start, end)
    } catch (e) {
      console.error('[fasting] meal window save failed', e)
      setErr('保存に失敗しました。時間をおいて再度お試しください。')
      setBusy(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    flex: 1, padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
    color: '#fff', fontSize: 16, outline: 'none', colorScheme: 'dark',
  }

  return (
    <BottomSheet onClose={busy ? undefined : onClose} title="食事のタイミング">
      <div style={{
        marginBottom: 14, padding: '8px 12px', borderRadius: 10, fontSize: 11.5,
        background: 'rgba(124,196,255,0.08)', border: '1px solid rgba(124,196,255,0.25)', color: '#bcd', lineHeight: 1.6,
      }}>
        🔒 食べてよい時間帯（例 16:8 なら 12:00〜20:00）を登録すると、次の食事までカウントダウンします。あなただけが見られます。
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 4 }}>食べ始め</label>
          <input type="time" value={start} onChange={e => setStart(e.target.value)} style={inputStyle} />
        </div>
        <span style={{ fontSize: 16, color: '#8aa79b', paddingTop: 18 }}>〜</span>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 4 }}>食べ終わり</label>
          <input type="time" value={end} onChange={e => setEnd(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {overnight && (
        <div style={{ fontSize: 11, color: '#9fb8ad', marginTop: 8 }}>
          深夜をまたぐ時間帯として登録します（例 22:00〜翌 06:00）。
        </div>
      )}

      {err && (
        <div style={{
          marginTop: 12, padding: '9px 12px', borderRadius: 8, fontSize: 13,
          background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.35)', color: '#ffb3b3',
        }}>{err}</div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} style={{
          flex: 1, padding: '12px', borderRadius: 12, cursor: busy ? 'default' : 'pointer',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
          color: '#bcd', fontSize: 14, fontWeight: 700,
        }}>キャンセル</button>
        <button onClick={submit} disabled={busy} style={{
          flex: 2, padding: '12px', borderRadius: 12, border: 'none',
          cursor: busy ? 'default' : 'pointer',
          background: busy ? `${ACCENT}66` : `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
          color: '#06231a', fontSize: 14, fontWeight: 800,
        }}>{busy ? '保存中…' : '保存する'}</button>
      </div>

      {onClear && (
        <button
          onClick={() => { if (confirm('食事のタイミングを削除しますか？')) { onClear(); onClose() } }}
          disabled={busy}
          style={{
            width: '100%', marginTop: 10, padding: '11px', borderRadius: 12,
            background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer',
            color: '#ff9b9b', fontSize: 13, fontWeight: 700,
          }}>
          登録を削除する
        </button>
      )}
    </BottomSheet>
  )
}

// ====================================================
// マイプラン セクション (本人のみ・非公開)
// ====================================================
function MyPlanSection({ plan, progress, onSetup }: {
  plan: Plan | null
  progress: PlanProgress | null
  onSetup: () => void
}) {
  if (!plan) {
    return (
      <button
        onClick={onSetup}
        style={{
          width: '100%', padding: 24, textAlign: 'center', color: '#789', fontSize: 13,
          border: `1px dashed ${ACCENT}33`, borderRadius: 16, cursor: 'pointer',
          background: 'none', lineHeight: 1.6,
        }}>
        「毎日16:8」「1日1食を1年」など、続けたいやり方を設定しよう。<br />
        食事の種類や継続目標も登録できます。
      </button>
    )
  }
  const style = styleOf(plan.style)
  const ratio = plan.goal_days && progress
    ? Math.min(1, progress.elapsedDays / plan.goal_days)
    : null
  return (
    <div style={{
      padding: 16, borderRadius: 16,
      background: 'rgba(18,28,24,0.7)', border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          fontSize: 24, width: 48, height: 48, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 14, background: `${ACCENT}1f`, border: `1px solid ${ACCENT}44`,
        }}>{style?.emoji ?? '🗓'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
            {style?.label ?? plan.style}
          </div>
          <div style={{ fontSize: 11.5, color: '#8aa79b', marginTop: 2 }}>
            目標 {plan.target_hours}h
            {progress && <>・{progress.elapsedDays}日目（{progress.achievedDays}回達成）</>}
          </div>
        </div>
      </div>

      {/* 継続目標の進捗バー */}
      {plan.goal_days && progress && ratio != null && (
        <div style={{ marginTop: 14 }}>
          <div style={{ height: 9, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.round(ratio * 100)}%`, height: '100%',
              background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT2})`, transition: 'width 0.6s',
            }} />
          </div>
          <div style={{ fontSize: 11, color: '#8aa79b', marginTop: 6 }}>
            継続目標 {plan.goal_days}日 まで あと{' '}
            <strong style={{ color: '#fff' }}>{Math.max(0, plan.goal_days - progress.elapsedDays)}日</strong>
          </div>
        </div>
      )}

      {/* 食事の種類 */}
      {plan.food_types.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
          {plan.food_types.map(k => {
            const f = foodTypeOf(k)
            if (!f) return null
            return (
              <span key={k} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                background: `${ACCENT2}14`, border: `1px solid ${ACCENT2}40`, color: '#cfe',
              }}>
                <span>{f.emoji}</span>{f.label}
              </span>
            )
          })}
        </div>
      )}

      {plan.food_note && (
        <div style={{
          fontSize: 12.5, color: '#bcd', marginTop: 12, lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)',
        }}>
          🍴 {plan.food_note}
        </div>
      )}
    </div>
  )
}

// ====================================================
// マイプラン 入力モーダル
// ====================================================
function PlanModal({ current, onSave, onClear, onClose }: {
  current: Plan | null
  onSave: (input: {
    style: string; targetHours: number; goalDays: number | null
    foodTypes: string[]; foodNote: string | null; startedOn: string
  }) => Promise<void>
  onClear?: () => void
  onClose: () => void
}) {
  const todayKey = () => {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  const [styleKey, setStyleKey] = useState(current?.style ?? '16_8')
  const [targetHours, setTargetHours] = useState(
    current?.target_hours ?? (styleOf('16_8')?.defaultHours ?? 16),
  )
  const [goalDays, setGoalDays] = useState(current?.goal_days != null ? String(current.goal_days) : '')
  const [foodTypes, setFoodTypes] = useState<string[]>(current?.food_types ?? [])
  const [foodNote, setFoodNote] = useState(current?.food_note ?? '')
  const [startedOn, setStartedOn] = useState(current?.started_on ?? todayKey())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // スタイルを選ぶと既定の目標時間を反映 (ユーザーが後から微調整可)。
  const pickStyle = (key: string) => {
    setStyleKey(key)
    const def = styleOf(key)?.defaultHours
    if (def != null) setTargetHours(def)
  }

  const toggleFood = (key: string) => {
    setFoodTypes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const submit = async () => {
    const g = goalDays.trim() === '' ? null : Math.round(Number(goalDays))
    if (g != null && (!Number.isFinite(g) || g < 1 || g > 3650)) {
      setErr('継続目標は 1〜3650 日の範囲で入力してください'); return
    }
    if (!Number.isFinite(targetHours) || targetHours < TARGET_HOURS_MIN || targetHours > TARGET_HOURS_MAX) {
      setErr(`目標時間は ${TARGET_HOURS_MIN}〜${TARGET_HOURS_MAX} 時間の範囲で入力してください`); return
    }
    setBusy(true); setErr(null)
    try {
      await onSave({
        style: styleKey, targetHours, goalDays: g,
        foodTypes, foodNote: foodNote.trim() || null, startedOn,
      })
    } catch (e) {
      console.error('[fasting] plan save failed', e)
      setErr('保存に失敗しました。時間をおいて再度お試しください。')
      setBusy(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
    color: '#fff', fontSize: 16, outline: 'none',
  }

  return (
    <BottomSheet onClose={busy ? undefined : onClose} title={current ? 'マイプランを変更' : 'マイプランを設定'}>
      <div style={{
        marginBottom: 14, padding: '8px 12px', borderRadius: 10, fontSize: 11.5,
        background: 'rgba(124,196,255,0.08)', border: '1px solid rgba(124,196,255,0.25)', color: '#bcd', lineHeight: 1.6,
      }}>
        🔒 続けたいやり方・食事の種類・継続目標を登録します。あなただけが見られます。
      </div>

      {/* スタイル */}
      <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 6 }}>やり方</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
        {FASTING_STYLES.map(s => {
          const sel = styleKey === s.key
          return (
            <button
              key={s.key}
              onClick={() => pickStyle(s.key)}
              style={{
                display: 'block', padding: '11px 12px', borderRadius: 14, cursor: 'pointer',
                background: sel ? `${ACCENT}22` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${sel ? ACCENT : `${ACCENT}33`}`,
                color: '#dfe9e4', textAlign: 'left',
              }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>{s.emoji} {s.label}</div>
              <div style={{ fontSize: 10.5, color: '#8aa79b', marginTop: 2 }}>{s.note}</div>
            </button>
          )
        })}
      </div>

      {/* 目標時間・継続目標 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 4 }}>1回の目標 (時間)</label>
          <input
            type="number" inputMode="numeric"
            value={targetHours}
            min={TARGET_HOURS_MIN} max={TARGET_HOURS_MAX}
            onChange={e => setTargetHours(Math.round(Number(e.target.value)))}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 4 }}>継続目標 (日・任意)</label>
          <input
            type="number" inputMode="numeric"
            value={goalDays}
            onChange={e => setGoalDays(e.target.value)}
            placeholder="例: 365"
            style={inputStyle}
          />
        </div>
      </div>

      {/* 開始日 */}
      <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 4 }}>始めた日（継続日数の起点）</label>
      <input
        type="date"
        value={startedOn}
        max={todayKey()}
        onChange={e => setStartedOn(e.target.value)}
        style={{ ...inputStyle, fontSize: 15, colorScheme: 'dark', marginBottom: 16 }}
      />

      {/* 食事の種類 (複数選択) */}
      <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 6 }}>食事の種類（複数選択可）</label>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
        {FOOD_TYPES.map(f => {
          const sel = foodTypes.includes(f.key)
          return (
            <button
              key={f.key}
              onClick={() => toggleFood(f.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '8px 13px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                background: sel ? `${ACCENT}22` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${sel ? ACCENT : 'rgba(255,255,255,0.14)'}`,
                color: sel ? '#fff' : '#bcd',
              }}>
              <span>{f.emoji}</span>{f.label}
            </button>
          )
        })}
      </div>

      {/* 食事メモ */}
      <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 4 }}>食事の自由メモ（任意）</label>
      <textarea
        value={foodNote}
        onChange={e => setFoodNote(e.target.value)}
        placeholder="例: 1日1食は野菜と豆腐中心。週末は固形物なしで水と塩だけ。"
        maxLength={300}
        rows={3}
        style={{ ...inputStyle, fontSize: 15, resize: 'vertical', fontFamily: 'inherit' }}
      />

      {err && (
        <div style={{
          marginTop: 12, padding: '9px 12px', borderRadius: 8, fontSize: 13,
          background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.35)', color: '#ffb3b3',
        }}>{err}</div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} style={{
          flex: 1, padding: '12px', borderRadius: 12, cursor: busy ? 'default' : 'pointer',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
          color: '#bcd', fontSize: 14, fontWeight: 700,
        }}>キャンセル</button>
        <button onClick={submit} disabled={busy} style={{
          flex: 2, padding: '12px', borderRadius: 12, border: 'none',
          cursor: busy ? 'default' : 'pointer',
          background: busy ? `${ACCENT}66` : `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
          color: '#06231a', fontSize: 14, fontWeight: 800,
        }}>{busy ? '保存中…' : '保存する'}</button>
      </div>

      {onClear && (
        <button
          onClick={() => { if (confirm('マイプランを削除しますか？')) { onClear(); onClose() } }}
          disabled={busy}
          style={{
            width: '100%', marginTop: 10, padding: '11px', borderRadius: 12,
            background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer',
            color: '#ff9b9b', fontSize: 13, fontWeight: 700,
          }}>
          プランを削除する
        </button>
      )}
    </BottomSheet>
  )
}

// ====================================================
// 運動の記録 セクション (本人のみ・非公開)
// ====================================================
function ExerciseSection({ logs, onEdit, onDelete }: {
  logs: ExerciseLog[]
  onEdit: (log: ExerciseLog) => void
  onDelete: (id: string) => void
}) {
  if (logs.length === 0) {
    return (
      <div style={{
        padding: 24, textAlign: 'center', color: '#789', fontSize: 13,
        border: `1px dashed ${ACCENT}33`, borderRadius: 16,
      }}>
        まだ記録がありません。ストレッチ・ウォーキング・筋トレなど、今日動いたことを記録しよう。
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {logs.slice(0, 20).map(l => {
        const t = exerciseTypeOf(l.type)
        const unitLabel = l.unit ? EXERCISE_UNIT_LABEL[l.unit] : ''
        return (
          <div key={l.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 13px', borderRadius: 12,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 12, color: '#8aa79b', fontWeight: 700, width: 44, flexShrink: 0, paddingTop: 2 }}>
              {fmtDate(l.logged_on)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
                  {t?.emoji ?? '🏷'} {t?.label ?? l.type}
                </span>
                {l.amount != null && (
                  <span style={{ fontSize: 13, color: ACCENT, fontWeight: 800 }}>
                    {l.amount}{unitLabel}
                  </span>
                )}
              </div>
              {l.note && (
                <div style={{ fontSize: 12.5, color: '#bcd', marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {l.note}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={() => onEdit(l)} aria-label="編集" style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#789', fontSize: 15, padding: 4,
              }}>✏️</button>
              <button onClick={() => { if (confirm('この記録を削除しますか？')) onDelete(l.id) }} aria-label="削除" style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#789', fontSize: 15, padding: 4,
              }}>🗑️</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ====================================================
// 運動の記録 入力モーダル
// ====================================================
function ExerciseModal({ edit, onSave, onClose }: {
  edit: ExerciseLog | null
  onSave: (input: {
    id: string | null; loggedOn: string; type: string
    amount: number | null; unit: 'min' | 'reps' | 'km' | null; note: string | null
  }) => Promise<void>
  onClose: () => void
}) {
  const todayKey = () => {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  const [loggedOn, setLoggedOn] = useState(edit?.logged_on ?? todayKey())
  const [typeKey, setTypeKey] = useState(edit?.type ?? 'walk')
  const [amount, setAmount] = useState(edit?.amount != null ? String(edit.amount) : '')
  const [note, setNote] = useState(edit?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const type = exerciseTypeOf(typeKey)
  const unit = type?.unit ?? null
  const unitLabel = unit ? EXERCISE_UNIT_LABEL[unit] : null

  const submit = async () => {
    const a = amount.trim() === '' ? null : Number(amount)
    if (a != null && (!Number.isFinite(a) || a < 0)) { setErr('量は 0 以上の数値で入力してください'); return }
    if (!note.trim() && a == null) { setErr('量かメモのどちらかを入力してください'); return }
    setBusy(true); setErr(null)
    try {
      await onSave({
        id: edit?.id ?? null, loggedOn, type: typeKey,
        amount: unit ? a : null, unit: unit, note: note.trim() || null,
      })
    } catch (e) {
      console.error('[fasting] exercise save failed', e)
      setErr('保存に失敗しました。時間をおいて再度お試しください。')
      setBusy(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
    color: '#fff', fontSize: 16, outline: 'none',
  }

  return (
    <BottomSheet onClose={busy ? undefined : onClose} title={edit ? '運動の記録を編集' : '運動を記録'}>
      <div style={{
        marginBottom: 14, padding: '8px 12px', borderRadius: 10, fontSize: 11.5,
        background: 'rgba(124,196,255,0.08)', border: '1px solid rgba(124,196,255,0.25)', color: '#bcd', lineHeight: 1.6,
      }}>
        🔒 運動の記録はあなただけが見られます。1 日に何件でも登録できます。
      </div>

      {/* 種目 */}
      <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 6 }}>種目</label>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
        {EXERCISE_TYPES.map(t => {
          const sel = typeKey === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTypeKey(t.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '8px 13px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                background: sel ? `${ACCENT}22` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${sel ? ACCENT : 'rgba(255,255,255,0.14)'}`,
                color: sel ? '#fff' : '#bcd',
              }}>
              <span>{t.emoji}</span>{t.label}
            </button>
          )
        })}
      </div>

      <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 4 }}>日付</label>
      <input
        type="date"
        value={loggedOn}
        max={todayKey()}
        onChange={e => setLoggedOn(e.target.value)}
        style={{ ...inputStyle, fontSize: 15, colorScheme: 'dark', marginBottom: 14 }}
      />

      {/* 量 (単位がある種目のみ) */}
      {unit && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 4 }}>
            量（{unitLabel}・任意）
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={unit === 'reps' ? '例: 30' : unit === 'km' ? '例: 5' : '例: 60'}
              step={unit === 'km' ? '0.1' : '1'}
              style={inputStyle}
            />
            <span style={{ fontSize: 14, color: '#bcd', fontWeight: 700, flexShrink: 0 }}>{unitLabel}</span>
          </div>
        </div>
      )}

      <label style={{ fontSize: 11, color: '#8aa79b', display: 'block', marginBottom: 4 }}>メモ（任意）</label>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="例: 懸垂30回・腕立て20回。久しぶりでもキツくなかった。"
        maxLength={300}
        rows={3}
        style={{ ...inputStyle, fontSize: 15, resize: 'vertical', fontFamily: 'inherit' }}
      />

      {err && (
        <div style={{
          marginTop: 12, padding: '9px 12px', borderRadius: 8, fontSize: 13,
          background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.35)', color: '#ffb3b3',
        }}>{err}</div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} style={{
          flex: 1, padding: '12px', borderRadius: 12, cursor: busy ? 'default' : 'pointer',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
          color: '#bcd', fontSize: 14, fontWeight: 700,
        }}>キャンセル</button>
        <button onClick={submit} disabled={busy} style={{
          flex: 2, padding: '12px', borderRadius: 12, border: 'none',
          cursor: busy ? 'default' : 'pointer',
          background: busy ? `${ACCENT}66` : `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
          color: '#06231a', fontSize: 14, fontWeight: 800,
        }}>{busy ? '保存中…' : '保存する'}</button>
      </div>
    </BottomSheet>
  )
}

// ====================================================
// 友達を招待 (X / LINE / リンクコピー)
// ====================================================
function InviteCard() {
  const [copied, setCopied] = useState(false)
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/fasting` : ''
  const text = '一緒にファスティング始めよう🍃 仲間と励まし合えるよ！'

  const openShare = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('このリンクをコピーしてください', shareUrl)
    }
  }

  const btn: React.CSSProperties = {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    padding: '14px 8px', borderRadius: 14, cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12.5, fontWeight: 700,
  }

  return (
    <div style={{
      padding: 16, borderRadius: 16,
      background: 'rgba(18,28,24,0.7)', border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ fontSize: 12.5, color: '#9fb8ad', lineHeight: 1.6, marginBottom: 14 }}>
        ひとりより、みんなで。友達を誘って一緒に続けよう。
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => openShare(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text}\n${shareUrl}`)}`)}
          style={{ ...btn, background: 'rgba(0,0,0,0.4)' }}>
          <span style={{ fontSize: 22 }}>𝕏</span>
          X でシェア
        </button>
        <button
          onClick={() => openShare(`https://line.me/R/msg/text/?${encodeURIComponent(`${text}\n${shareUrl}`)}`)}
          style={{ ...btn, background: 'rgba(6,199,85,0.18)', border: '1px solid rgba(6,199,85,0.5)' }}>
          <span style={{ fontSize: 22 }}>💬</span>
          LINE で送る
        </button>
        <button
          onClick={copyLink}
          style={{ ...btn, background: `${ACCENT}1a`, border: `1px solid ${ACCENT}55` }}>
          <span style={{ fontSize: 22 }}>{copied ? '✓' : '🔗'}</span>
          {copied ? 'コピー済' : 'リンク'}
        </button>
      </div>
    </div>
  )
}

// ====================================================
// 共通: ボトムシート (テキスト入力を含むため dvh)
// ====================================================
function BottomSheet({ children, title, onClose }: {
  children: React.ReactNode; title: string; onClose?: () => void
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', minHeight: '100dvh',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, maxHeight: '92dvh', overflowY: 'auto',
          background: '#0d1713', borderRadius: '20px 20px 0 0',
          border: `1px solid ${ACCENT}40`, borderBottom: 'none', padding: '18px 18px 28px',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: 0 }}>{title}</h2>
          {onClose && (
            <button onClick={onClose} aria-label="閉じる" style={{
              background: 'none', border: 'none', color: '#789', fontSize: 24, cursor: 'pointer', lineHeight: 1,
            }}>×</button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
