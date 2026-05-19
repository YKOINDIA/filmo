'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import {
  trackUranyanShared, trackUranyanSaved, trackUranyanReviewed, trackUranyanAppShared,
} from '../../lib/analytics'
import { shareToLine, shareToTwitter, copyToClipboard } from '../../lib/share'
import { buildLifeReading } from '../../lib/uranyan/templates'
import { buildCompatibilityReading } from '../../lib/uranyan/compatTemplates'
import { buildGroupCompatReading, type GroupCompatReading } from '../../lib/uranyan/groupCompat'
import { buildDailyReading, dailyShareText, type DailyReading } from '../../lib/uranyan/today'
import {
  buildPeriodReading, periodShareText, PERIOD_PRESETS,
  type PeriodPreset,
} from '../../lib/uranyan/period'
import { buildFashionReading, fashionShareText } from '../../lib/uranyan/fashion'
import { shareOrDownloadImage, buildImageFileName } from '../../lib/uranyan/imageExport'
import {
  saveReading, loadReadings, reviewReading, deleteReading, isReviewable,
  buildLifeSavePayload, buildCompatSavePayload, buildGroupCompatSavePayload,
  buildPeriodSavePayload,
  type ReadingRow, type SaveInput,
} from '../../lib/uranyan/history'
import {
  CAT_BREEDS, DOG_BREEDS, getCatBreed, getDogBreed,
  DEFAULT_CAT_BREED, DEFAULT_DOG_BREED,
  RELATIONSHIPS, RELATIONSHIP_LABELS,
  type BreedOption, type Relationship,
} from '../../lib/uranyan/characters'
import { DogIcon, CatIcon } from '../../lib/uranyan/breedIcons'

// ====================================================
// 型
// ====================================================
type Mode = 'life' | 'compat' | 'group' | 'period' | 'fashion'
type Phase =
  | 'menu' | 'pickLife' | 'pickCompat' | 'pickGroup' | 'pickPeriod'
  | 'edit' | 'result' | 'character' | 'history' | 'today' | 'fashion'

const GROUP_MIN = 3
const GROUP_MAX = 8
const SHARE_URL = 'https://filmo.me/games/uranyan'

interface TargetCard {
  id: string
  name: string
  relationship: Relationship
  birth_year: number
  birth_month: number
  birth_day: number
  color_tag: string | null
  emoji: string | null
  isSelf: boolean
}

interface MyProfile {
  id: string
  name: string
  birth_year: number | null
  birth_month: number | null
  birth_day: number | null
  uranyan_cat_breed: string | null
  uranyan_dog_breed: string | null
}

interface EditDraft {
  targetId: string | null
  isSelf: boolean
  name: string
  relationship: Relationship
  year: string
  month: string
  day: string
  emoji: string
  colorTag: string
}

const COLOR_PRESETS = [
  '#FF7AAE', '#FF9F1C', '#FFD24A', '#7ED957',
  '#5EE2C8', '#6CA9FF', '#A29BFE', '#C374FF',
]
const EMOJI_PRESETS = ['🌸','✨','💫','🌙','⭐','🍑','🍓','🦋','💎','🎀','🔥','🐰']

// ====================================================
// ページ本体
// ====================================================
export default function UranyanPage() {
  const [phase, setPhase] = useState<Phase>('menu')
  const [mode, setMode] = useState<Mode>('life')
  const [me, setMe] = useState<MyProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [targets, setTargets] = useState<TargetCard[]>([])
  const [activeTarget, setActiveTarget] = useState<TargetCard | null>(null)
  const [compatA, setCompatA] = useState<TargetCard | null>(null)
  const [compatB, setCompatB] = useState<TargetCard | null>(null)
  const [groupPicks, setGroupPicks] = useState<TargetCard[]>([])
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 履歴 / レビュー
  const [historyRows, setHistoryRows] = useState<ReadingRow[] | null>(null)
  const [historyTab, setHistoryTab] = useState<'all' | 'pending'>('all')
  const [reviewing, setReviewing] = useState<ReadingRow | null>(null)
  const [viewingHistoryReading, setViewingHistoryReading] = useState<ReadingRow | null>(null)
  // 保存モーダル状態 (履歴に残すボタン押下時に開く)
  const [savePromptOpen, setSavePromptOpen] = useState(false)
  const [savedReadingId, setSavedReadingId] = useState<string | null>(null)

  // 未ログイン時のお試し: 自分の名前+生年月日を一時保持
  const [guestDraft, setGuestDraft] = useState({ name: '', year: '', month: '', day: '' })
  const [guestPartner, setGuestPartner] = useState({ name: '', year: '', month: '', day: '' })

  const [catBreed, setCatBreed] = useState<string>(DEFAULT_CAT_BREED)
  const [dogBreed, setDogBreed] = useState<string>(DEFAULT_DOG_BREED)

  // 今日の運勢 (me.birth_* が揃っている時のみ算出)
  const today = useMemo<DailyReading | null>(() => {
    if (!me?.birth_year || !me?.birth_month || !me?.birth_day) return null
    return buildDailyReading({
      year: me.birth_year, month: me.birth_month, day: me.birth_day,
    })
  }, [me?.birth_year, me?.birth_month, me?.birth_day])

  // ────────────────────────────
  // 初期ロード
  // ────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          if (typeof window !== 'undefined') {
            const cb = localStorage.getItem('uranyan_cat_breed')
            const db = localStorage.getItem('uranyan_dog_breed')
            if (cb) setCatBreed(cb)
            if (db) setDogBreed(db)
          }
          setLoadingProfile(false)
          return
        }
        const { data: u } = await supabase
          .from('users')
          .select('id, name, birth_year, birth_month, birth_day, uranyan_cat_breed, uranyan_dog_breed')
          .eq('id', session.user.id)
          .single()
        if (u) {
          setMe(u as MyProfile)
          if (u.uranyan_cat_breed) setCatBreed(u.uranyan_cat_breed)
          if (u.uranyan_dog_breed) setDogBreed(u.uranyan_dog_breed)
        }
        const { data: t } = await supabase
          .from('uranyan_targets')
          .select('id, name, relationship, birth_year, birth_month, birth_day, color_tag, emoji')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
        const list: TargetCard[] = (t ?? []).map(row => ({
          id: row.id,
          name: row.name,
          relationship: (row.relationship ?? 'other') as Relationship,
          birth_year: row.birth_year,
          birth_month: row.birth_month,
          birth_day: row.birth_day,
          color_tag: row.color_tag,
          emoji: row.emoji,
          isSelf: false,
        }))
        if (u && u.birth_year && u.birth_month && u.birth_day) {
          list.unshift({
            id: 'self',
            name: u.name || '自分',
            relationship: 'self',
            birth_year: u.birth_year,
            birth_month: u.birth_month,
            birth_day: u.birth_day,
            color_tag: null,
            emoji: '🪞',
            isSelf: true,
          })
        }
        setTargets(list)
      } catch (e) {
        console.error('[uranyan] load failed', e)
      } finally {
        setLoadingProfile(false)
      }
    })()
  }, [])

  // ────────────────────────────
  // モード選択 → pick へ
  // ────────────────────────────
  const onChooseLife = useCallback(() => {
    setMode('life')
    setErrorMsg(null)
    setPhase('pickLife')
  }, [])

  const onChooseCompat = useCallback(() => {
    setMode('compat')
    setErrorMsg(null)
    setCompatA(null); setCompatB(null)
    setPhase('pickCompat')
  }, [])

  const onChooseGroup = useCallback(() => {
    setMode('group')
    setErrorMsg(null)
    setGroupPicks([])
    setPhase('pickGroup')
  }, [])

  // 期間限定占い: 選択された期間
  const [periodSelection, setPeriodSelection] = useState<{
    label: string; start: string; end: string
  } | null>(null)

  const onChoosePeriod = useCallback(() => {
    setMode('period')
    setErrorMsg(null)
    setPeriodSelection(null)
    setPhase('pickPeriod')
  }, [])

  const onChooseFashion = useCallback(() => {
    setMode('fashion')
    setErrorMsg(null)
    setPhase('fashion')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }, [])

  const onRunPeriod = useCallback((label: string, startISO: string, endISO: string) => {
    setErrorMsg(null)
    setPeriodSelection({ label, start: startISO, end: endISO })
    setMode('period')
    setPhase('result')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }, [])

  const onOpenHistory = useCallback(async () => {
    setPhase('history')
    setHistoryRows(null)
    const rows = await loadReadings(100)
    setHistoryRows(rows)
  }, [])

  const pickForGroup = useCallback((t: TargetCard) => {
    setErrorMsg(null)
    setGroupPicks(prev => {
      const exists = prev.find(p => p.id === t.id)
      if (exists) return prev.filter(p => p.id !== t.id)
      if (prev.length >= GROUP_MAX) {
        setErrorMsg(`グループは ${GROUP_MAX} 人までだよ`)
        return prev
      }
      return [...prev, t]
    })
  }, [])

  const onRunGroup = useCallback(() => {
    if (groupPicks.length < GROUP_MIN) {
      setErrorMsg(`グループ相性は ${GROUP_MIN} 人以上で占うよ`)
      return
    }
    setErrorMsg(null)
    setMode('group')
    setPhase('result')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }, [groupPicks])

  // ────────────────────────────
  // 編集開始
  // ────────────────────────────
  const beginAddTarget = useCallback(() => {
    setDraft({
      targetId: null, isSelf: false, name: '',
      relationship: 'friend', year: '', month: '', day: '',
      emoji: '🌸', colorTag: COLOR_PRESETS[0],
    })
    setErrorMsg(null)
    setPhase('edit')
  }, [])

  const beginEditSelf = useCallback(() => {
    if (!me) return
    setDraft({
      targetId: 'self', isSelf: true,
      name: me.name || '自分',
      relationship: 'self',
      year: me.birth_year?.toString() ?? '',
      month: me.birth_month?.toString() ?? '',
      day: me.birth_day?.toString() ?? '',
      emoji: '🪞', colorTag: COLOR_PRESETS[0],
    })
    setErrorMsg(null)
    setPhase('edit')
  }, [me])

  const beginEditTarget = useCallback((t: TargetCard) => {
    if (t.isSelf) { beginEditSelf(); return }
    setDraft({
      targetId: t.id, isSelf: false,
      name: t.name,
      relationship: t.relationship,
      year: t.birth_year.toString(),
      month: t.birth_month.toString(),
      day: t.birth_day.toString(),
      emoji: t.emoji ?? '🌸',
      colorTag: t.color_tag ?? COLOR_PRESETS[0],
    })
    setErrorMsg(null)
    setPhase('edit')
  }, [beginEditSelf])

  // ────────────────────────────
  // 保存
  // ────────────────────────────
  const saveDraft = useCallback(async () => {
    if (!draft) return
    const year = parseInt(draft.year, 10)
    const month = parseInt(draft.month, 10)
    const day = parseInt(draft.day, 10)
    if (!draft.name.trim()) { setErrorMsg('名前を入力してね'); return }
    if (!isValidDate(year, month, day)) { setErrorMsg('生年月日が正しくないよ'); return }
    if (year < 1900 || year > 2030) { setErrorMsg('生年は 1900〜2030 の範囲で'); return }

    setBusy(true)
    setErrorMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setErrorMsg('保存にはログインが必要だよ')
        setBusy(false)
        return
      }
      const userId = session.user.id

      if (draft.isSelf) {
        await supabase.from('users').update({
          name: draft.name.trim(),
          birth_year: year, birth_month: month, birth_day: day,
        }).eq('id', userId)
        setMe(prev => prev ? {
          ...prev, name: draft.name.trim(),
          birth_year: year, birth_month: month, birth_day: day,
        } : prev)
        setTargets(prev => {
          const others = prev.filter(t => !t.isSelf)
          return [{
            id: 'self', name: draft.name.trim(),
            relationship: 'self',
            birth_year: year, birth_month: month, birth_day: day,
            color_tag: null, emoji: '🪞', isSelf: true,
          }, ...others]
        })
      } else if (draft.targetId) {
        await supabase.from('uranyan_targets').update({
          name: draft.name.trim(),
          relationship: draft.relationship,
          birth_year: year, birth_month: month, birth_day: day,
          color_tag: draft.colorTag, emoji: draft.emoji,
          updated_at: new Date().toISOString(),
        }).eq('id', draft.targetId).eq('user_id', userId)
        setTargets(prev => prev.map(t => t.id === draft.targetId ? {
          ...t,
          name: draft.name.trim(),
          relationship: draft.relationship,
          birth_year: year, birth_month: month, birth_day: day,
          color_tag: draft.colorTag, emoji: draft.emoji,
        } : t))
      } else {
        const { data, error } = await supabase.from('uranyan_targets').insert({
          user_id: userId,
          name: draft.name.trim(),
          relationship: draft.relationship,
          birth_year: year, birth_month: month, birth_day: day,
          color_tag: draft.colorTag, emoji: draft.emoji,
        }).select('id').single()
        if (error) {
          if (error.code === '23505') setErrorMsg('同じ名前 + 生年月日のカードが既にあるよ')
          else setErrorMsg('保存に失敗したよ。時間を置いて試してね')
          setBusy(false)
          return
        }
        const newCard: TargetCard = {
          id: data!.id,
          name: draft.name.trim(),
          relationship: draft.relationship,
          birth_year: year, birth_month: month, birth_day: day,
          color_tag: draft.colorTag, emoji: draft.emoji,
          isSelf: false,
        }
        setTargets(prev => {
          const self = prev.find(t => t.isSelf)
          const others = prev.filter(t => !t.isSelf)
          return self ? [self, newCard, ...others] : [newCard, ...others]
        })
      }
      setDraft(null)
      setPhase(mode === 'compat' ? 'pickCompat' : 'pickLife')
    } finally {
      setBusy(false)
    }
  }, [draft, mode])

  // ────────────────────────────
  // 削除
  // ────────────────────────────
  const deleteTarget = useCallback(async (t: TargetCard) => {
    if (t.isSelf) return
    if (typeof window !== 'undefined' && !window.confirm(`「${t.name}」のカードを消す?`)) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    await supabase.from('uranyan_targets').delete().eq('id', t.id).eq('user_id', session.user.id)
    setTargets(prev => prev.filter(x => x.id !== t.id))
    setCompatA(prev => prev?.id === t.id ? null : prev)
    setCompatB(prev => prev?.id === t.id ? null : prev)
  }, [])

  // ────────────────────────────
  // 占う (天命)
  // ────────────────────────────
  const readTarget = useCallback((t: TargetCard) => {
    setActiveTarget(t)
    setMode('life')
    setPhase('result')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }, [])

  const readGuestLife = useCallback(() => {
    setErrorMsg(null)
    const year = parseInt(guestDraft.year, 10)
    const month = parseInt(guestDraft.month, 10)
    const day = parseInt(guestDraft.day, 10)
    if (!guestDraft.name.trim()) { setErrorMsg('名前を入力してね'); return }
    if (!isValidDate(year, month, day) || year < 1900 || year > 2030) {
      setErrorMsg('生年月日が正しくないよ'); return
    }
    setActiveTarget({
      id: 'guest', name: guestDraft.name.trim(),
      relationship: 'self',
      birth_year: year, birth_month: month, birth_day: day,
      color_tag: null, emoji: '✨', isSelf: false,
    })
    setMode('life')
    setPhase('result')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }, [guestDraft])

  // ────────────────────────────
  // 占う (相性)
  // ────────────────────────────
  const pickForCompat = useCallback((t: TargetCard) => {
    setErrorMsg(null)
    if (!compatA) { setCompatA(t); return }
    if (compatA.id === t.id) { setCompatA(null); return } // タップ解除
    if (compatB?.id === t.id) { setCompatB(null); return }
    setCompatB(t)
    setMode('compat')
    setPhase('result')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }, [compatA, compatB])

  const readGuestCompat = useCallback(() => {
    setErrorMsg(null)
    const a = guestDraft, b = guestPartner
    const ay = parseInt(a.year, 10), am = parseInt(a.month, 10), ad = parseInt(a.day, 10)
    const by = parseInt(b.year, 10), bm = parseInt(b.month, 10), bd = parseInt(b.day, 10)
    if (!a.name.trim() || !b.name.trim()) { setErrorMsg('2 人ぶん名前を入力してね'); return }
    if (!isValidDate(ay, am, ad) || !isValidDate(by, bm, bd)) { setErrorMsg('生年月日が正しくないよ'); return }
    if (ay < 1900 || ay > 2030 || by < 1900 || by > 2030) { setErrorMsg('生年は 1900〜2030 の範囲で'); return }
    setCompatA({ id: 'guest_a', name: a.name.trim(), relationship: 'self', birth_year: ay, birth_month: am, birth_day: ad, color_tag: null, emoji: '🪞', isSelf: false })
    setCompatB({ id: 'guest_b', name: b.name.trim(), relationship: 'other', birth_year: by, birth_month: bm, birth_day: bd, color_tag: null, emoji: '✨', isSelf: false })
    setMode('compat')
    setPhase('result')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }, [guestDraft, guestPartner])

  // ────────────────────────────
  // キャラ選好保存
  // ────────────────────────────
  const saveCharacter = useCallback(async () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('uranyan_cat_breed', catBreed)
      localStorage.setItem('uranyan_dog_breed', dogBreed)
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await supabase.from('users').update({
        uranyan_cat_breed: catBreed,
        uranyan_dog_breed: dogBreed,
      }).eq('id', session.user.id)
    }
    setPhase('menu')
  }, [catBreed, dogBreed])

  // ────────────────────────────
  // Top back action: 結果 → 該当 pick へ、pick → menu へ
  // ────────────────────────────
  const onBack = useCallback(() => {
    if (phase === 'result') {
      setSavedReadingId(null)
      setSavePromptOpen(false)
      if (viewingHistoryReading) {
        setViewingHistoryReading(null)
        setPhase('history')
        return
      }
      setPhase(
        mode === 'compat' ? 'pickCompat' :
        mode === 'group'  ? 'pickGroup'  :
        mode === 'period' ? 'pickPeriod' : 'pickLife'
      )
    } else if (phase === 'edit') {
      setDraft(null)
      setPhase(
        mode === 'compat' ? 'pickCompat' :
        mode === 'group'  ? 'pickGroup'  :
        mode === 'period' ? 'pickPeriod' : 'pickLife'
      )
    } else {
      setPhase('menu')
    }
  }, [phase, mode, viewingHistoryReading])

  // 履歴保存後、再読込が必要なら呼ぶ
  const refreshHistoryIfOpen = useCallback(async () => {
    if (phase === 'history') {
      const rows = await loadReadings(100)
      setHistoryRows(rows)
    }
  }, [phase])

  // 履歴から「結果を再表示」する
  const openHistoryReading = useCallback((r: ReadingRow) => {
    const cards: TargetCard[] = r.target_names.map((name, i) => {
      const [y, m, d] = (r.target_birthdates[i] ?? '1900-01-01').split('-').map(Number)
      return {
        id: `hist_${r.id}_${i}`,
        name,
        relationship: 'other',
        birth_year: y, birth_month: m, birth_day: d,
        color_tag: null, emoji: '📜', isSelf: false,
      }
    })
    if (r.menu === 'life') {
      setActiveTarget(cards[0] ?? null)
      setMode('life')
    } else if (r.menu === 'compat') {
      setCompatA(cards[0] ?? null)
      setCompatB(cards[1] ?? null)
      setMode('compat')
    } else if (r.menu === 'period') {
      setPeriodSelection({
        label: r.period_label ?? '期間運勢',
        start: r.period_start ?? r.target_birthdates[0] ?? '',
        end: r.period_end ?? r.target_birthdates[0] ?? '',
      })
      setMode('period')
    } else {
      setGroupPicks(cards)
      setMode('group')
    }
    setViewingHistoryReading(r)
    setSavedReadingId(r.id)
    setPhase('result')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }, [])

  const startReview = useCallback((r: ReadingRow) => setReviewing(r), [])
  const closeReview = useCallback(() => setReviewing(null), [])

  const submitReview = useCallback(async (id: string, rating: number, text: string) => {
    const ok = await reviewReading(id, rating, text)
    if (ok) {
      trackUranyanReviewed(
        (historyRows?.find(h => h.id === id)?.menu ?? 'life') as 'life' | 'compat' | 'group_compat',
        rating,
      )
      setReviewing(null)
      await refreshHistoryIfOpen()
    }
    return ok
  }, [historyRows, refreshHistoryIfOpen])

  const deleteHistoryRow = useCallback(async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('この履歴を消す? (元に戻せないよ)')) return
    const ok = await deleteReading(id)
    if (ok) await refreshHistoryIfOpen()
  }, [refreshHistoryIfOpen])

  // ====================================================
  // 描画
  // ====================================================
  return (
    <div style={pageStyle}>
      <TopBar phase={phase} onBack={onBack} />

      {phase === 'menu' && (
        <MenuView
          catBreed={catBreed} dogBreed={dogBreed}
          loggedIn={!!me}
          userName={me?.name || '自分'}
          today={today}
          hasSelfBirth={!!(me?.birth_year && me?.birth_month && me?.birth_day)}
          onOpenToday={() => { setPhase('today'); if (typeof window !== 'undefined') window.scrollTo({ top: 0 }) }}
          onChooseLife={onChooseLife}
          onChooseCompat={onChooseCompat}
          onChooseGroup={onChooseGroup}
          onChoosePeriod={onChoosePeriod}
          onChooseFashion={onChooseFashion}
          onOpenHistory={onOpenHistory}
          onOpenCharacter={() => setPhase('character')}
          onRegisterSelf={beginEditSelf}
        />
      )}

      {phase === 'today' && today && (
        <TodayResultView
          userName={me?.name || '自分'}
          today={today}
          catBreed={catBreed} dogBreed={dogBreed}
          onBack={() => setPhase('menu')}
        />
      )}

      {phase === 'fashion' && me?.birth_year && me?.birth_month && me?.birth_day && (
        <FashionResultView
          userName={me?.name || '自分'}
          userBirth={{ year: me.birth_year, month: me.birth_month, day: me.birth_day }}
          catBreed={catBreed} dogBreed={dogBreed}
          onBack={() => setPhase('menu')}
        />
      )}
      {phase === 'fashion' && !(me?.birth_year && me?.birth_month && me?.birth_day) && (
        <div style={{ padding: '8px 20px 40px' }}>
          <SectionTitle emoji="👗" title="ファッション占い" />
          <div style={inlineHintCard}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
              {me ? '自分の生年月日を登録してね' : 'ログインしてね'}
            </div>
            {me && (
              <button type="button" onClick={beginEditSelf} style={primaryBtnSmall}>
                登録する
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'pickPeriod' && (
        <PickPeriodView
          loggedIn={!!me}
          hasSelfBirth={!!(me?.birth_year && me?.birth_month && me?.birth_day)}
          onRun={onRunPeriod}
          onRegisterSelf={beginEditSelf}
        />
      )}

      {phase === 'result' && mode === 'period' && periodSelection && me?.birth_year && me?.birth_month && me?.birth_day && (
        <PeriodResultView
          userName={me?.name || '自分'}
          userBirth={{ year: me.birth_year, month: me.birth_month, day: me.birth_day }}
          periodLabel={periodSelection.label}
          startISO={periodSelection.start}
          endISO={periodSelection.end}
          catBreed={catBreed} dogBreed={dogBreed}
          loggedIn={!!me}
          savedReadingId={savedReadingId}
          setSavedReadingId={setSavedReadingId}
          savePromptOpen={savePromptOpen}
          setSavePromptOpen={setSavePromptOpen}
          onBack={() => setPhase('pickPeriod')}
        />
      )}

      {phase === 'pickGroup' && (
        <PickGroupView
          loading={loadingProfile}
          loggedIn={!!me}
          targets={targets}
          selectedIds={groupPicks.map(p => p.id)}
          errorMsg={errorMsg}
          onPick={pickForGroup}
          onClear={() => setGroupPicks([])}
          onRun={onRunGroup}
          onAddTarget={beginAddTarget}
          onEditTarget={beginEditTarget}
          onDeleteTarget={deleteTarget}
        />
      )}

      {phase === 'history' && (
        <HistoryView
          rows={historyRows}
          tab={historyTab}
          setTab={setHistoryTab}
          onOpen={openHistoryReading}
          onReview={startReview}
          onDelete={deleteHistoryRow}
        />
      )}

      {phase === 'pickLife' && (
        <PickLifeView
          loading={loadingProfile}
          loggedIn={!!me}
          targets={targets}
          guestDraft={guestDraft} setGuestDraft={setGuestDraft}
          errorMsg={errorMsg}
          onReadTarget={readTarget}
          onReadGuest={readGuestLife}
          onEditTarget={beginEditTarget}
          onAddTarget={beginAddTarget}
          onDeleteTarget={deleteTarget}
          onEditSelf={beginEditSelf}
          hasSelf={targets.some(t => t.isSelf)}
        />
      )}

      {phase === 'pickCompat' && (
        <PickCompatView
          loading={loadingProfile}
          loggedIn={!!me}
          targets={targets}
          guestDraft={guestDraft} setGuestDraft={setGuestDraft}
          guestPartner={guestPartner} setGuestPartner={setGuestPartner}
          errorMsg={errorMsg}
          compatA={compatA} compatB={compatB}
          onPick={pickForCompat}
          onClear={() => { setCompatA(null); setCompatB(null) }}
          onAddTarget={beginAddTarget}
          onEditTarget={beginEditTarget}
          onDeleteTarget={deleteTarget}
          onReadGuest={readGuestCompat}
        />
      )}

      {phase === 'edit' && draft && (
        <EditView
          draft={draft} setDraft={setDraft}
          errorMsg={errorMsg} busy={busy}
          onSave={saveDraft}
          onCancel={() => { setDraft(null); setPhase(mode === 'compat' ? 'pickCompat' : 'pickLife') }}
        />
      )}

      {phase === 'character' && (
        <CharacterView
          catBreed={catBreed} setCatBreed={setCatBreed}
          dogBreed={dogBreed} setDogBreed={setDogBreed}
          onSave={saveCharacter}
        />
      )}

      {phase === 'result' && mode === 'life' && activeTarget && (
        <LifeResultView
          target={activeTarget}
          catBreed={catBreed} dogBreed={dogBreed}
          loggedIn={!!me}
          savedReadingId={savedReadingId}
          setSavedReadingId={setSavedReadingId}
          savePromptOpen={savePromptOpen}
          setSavePromptOpen={setSavePromptOpen}
          onBack={() => setPhase(viewingHistoryReading ? 'history' : 'pickLife')}
        />
      )}

      {phase === 'result' && mode === 'compat' && compatA && compatB && (
        <CompatResultView
          a={compatA} b={compatB}
          catBreed={catBreed} dogBreed={dogBreed}
          loggedIn={!!me}
          savedReadingId={savedReadingId}
          setSavedReadingId={setSavedReadingId}
          savePromptOpen={savePromptOpen}
          setSavePromptOpen={setSavePromptOpen}
          onBack={() => {
            if (viewingHistoryReading) { setViewingHistoryReading(null); setPhase('history'); return }
            setCompatA(null); setCompatB(null); setPhase('pickCompat')
          }}
        />
      )}

      {phase === 'result' && mode === 'group' && groupPicks.length >= GROUP_MIN && (
        <GroupResultView
          members={groupPicks}
          catBreed={catBreed} dogBreed={dogBreed}
          loggedIn={!!me}
          savedReadingId={savedReadingId}
          setSavedReadingId={setSavedReadingId}
          savePromptOpen={savePromptOpen}
          setSavePromptOpen={setSavePromptOpen}
          onBack={() => {
            if (viewingHistoryReading) { setViewingHistoryReading(null); setPhase('history'); return }
            setPhase('pickGroup')
          }}
        />
      )}

      {reviewing && (
        <ReviewModal row={reviewing} onClose={closeReview} onSubmit={submitReview} />
      )}
    </div>
  )
}

// ====================================================
// 部品: TopBar
// ====================================================
function TopBar({ phase, onBack }: { phase: Phase; onBack: () => void }) {
  return (
    <div style={topBarStyle}>
      {phase === 'menu' ? (
        <Link href="/" style={topBackBtn}>← ホーム</Link>
      ) : (
        <button type="button" onClick={onBack} style={topBackBtn}>← 戻る</button>
      )}
      <div style={{ fontWeight: 800, fontSize: 16 }}>うらにゃん。</div>
      <div style={{ width: 64 }} />
    </div>
  )
}

// ====================================================
// 部品: メニュー (モード選択)
// ====================================================
function MenuView(p: {
  catBreed: string
  dogBreed: string
  loggedIn: boolean
  userName: string
  today: DailyReading | null
  hasSelfBirth: boolean
  onOpenToday: () => void
  onChooseLife: () => void
  onChooseCompat: () => void
  onChooseGroup: () => void
  onChoosePeriod: () => void
  onChooseFashion: () => void
  onOpenHistory: () => void
  onOpenCharacter: () => void
  onRegisterSelf: () => void
}) {
  const cat = getCatBreed(p.catBreed)
  const dog = getDogBreed(p.dogBreed)
  return (
    <div style={{ padding: '8px 20px 40px' }}>
      <div style={heroStyle}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
          <div style={heroAvatar}><CatIcon breed={cat} size={48} title={cat.label} /></div>
          <div style={heroAvatar}><DogIcon breed={dog} size={48} title={dog.label} /></div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', textAlign: 'center' }}>
          ニャンじろう & ポチ の
        </div>
        <div style={{
          fontSize: 28, fontWeight: 900, textAlign: 'center',
          background: 'linear-gradient(90deg, #FF7AAE, #A29BFE)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: 6,
        }}>うらにゃん。</div>
        <div style={{ fontSize: 12, color: '#bbb', textAlign: 'center' }}>
          算命学 × 宿曜占星術。当たる占いをティーン語訳。
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={p.onOpenCharacter} style={smallChipBtn}>
            🐾 ニャンポチをカスタム
          </button>
          {p.loggedIn && (
            <button type="button" onClick={p.onOpenHistory} style={smallChipBtn}>
              📜 占い履歴
            </button>
          )}
        </div>
      </div>

      {/* 今日の運勢カード (生年月日登録済みなら表示) */}
      {p.today ? (
        <TodayPreviewCard today={p.today} userName={p.userName} onTap={p.onOpenToday} />
      ) : p.loggedIn && !p.hasSelfBirth ? (
        <button type="button" onClick={p.onRegisterSelf} style={{
          width: '100%', marginTop: 16, padding: 14, borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(255,210,74,0.18), rgba(255,122,174,0.10))',
          border: '1px dashed rgba(255,210,74,0.40)', color: '#fff',
          cursor: 'pointer', textAlign: 'left',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>🔔 今日の運勢を見るには</div>
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>
            自分の生年月日を登録すると、毎日変わる運勢が見られるよ
          </div>
        </button>
      ) : null}

      <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
        <button type="button" onClick={p.onChooseLife} style={menuCardLife}>
          <div style={{ fontSize: 36 }}>🔮</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>天命トリセツ</div>
            <div style={{ fontSize: 11, color: '#ddd', marginTop: 4 }}>
              算命学 (陽占 三主星) で、あんたの外キャラ/中キャラ/裏キャラをぶっちゃける
            </div>
          </div>
          <div style={{ fontSize: 22, color: '#FFD24A' }}>→</div>
        </button>
        <button type="button" onClick={p.onChooseCompat} style={menuCardCompat}>
          <div style={{ fontSize: 36 }}>💞</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>相性診断 (2人)</div>
            <div style={{ fontSize: 11, color: '#ddd', marginTop: 4 }}>
              宿曜占星術 (27宿) で、2 人の関係性を「成 / 壊 / 友 / 親…」14 種で判定
            </div>
          </div>
          <div style={{ fontSize: 22, color: '#A29BFE' }}>→</div>
        </button>
        <button type="button" onClick={p.onChooseGroup} style={menuCardGroup}>
          <div style={{ fontSize: 36 }}>👥</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>グループ相性 (3〜8人)</div>
            <div style={{ fontSize: 11, color: '#ddd', marginTop: 4 }}>
              友達グループ・家族・部活の調和度を計算。ベストペア/ワーストペアも出るよ
            </div>
          </div>
          <div style={{ fontSize: 22, color: '#5EE2C8' }}>→</div>
        </button>
        <button type="button" onClick={p.onChoosePeriod} style={menuCardPeriod}>
          <div style={{ fontSize: 36 }}>📅</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>期間限定占い</div>
            <div style={{ fontSize: 11, color: '#ddd', marginTop: 4 }}>
              テスト期間・夏休み・推し活ウィーク。期間まとめ運勢で先読み&後日レビュー
            </div>
          </div>
          <div style={{ fontSize: 22, color: '#FF7AAE' }}>→</div>
        </button>
        <button type="button" onClick={p.onChooseFashion} style={menuCardFashion}>
          <div style={{ fontSize: 36 }}>👗</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>ファッション占い</div>
            <div style={{ fontSize: 11, color: '#ddd', marginTop: 4 }}>
              運命の勝ち服系統 (Y2K/ガーリー/ストリート/モード/etc) + 今週の合言葉
            </div>
          </div>
          <div style={{ fontSize: 22, color: '#C374FF' }}>→</div>
        </button>
      </div>

      <AppShareSection />
    </div>
  )
}

// ====================================================
// 部品: 「友達に教える」共有セクション (メニュー画面下部)
// ====================================================
function AppShareSection() {
  const [copied, setCopied] = useState(false)
  const text =
    `🔮 #うらにゃん  毒舌な猫とおちゃめな犬の占い、めっちゃ当たるよ\n` +
    `算命学で性格、宿曜で相性。友達やグループでも占える 🐱🐶`

  const onLine = useCallback(() => {
    shareToLine(text, SHARE_URL)
    trackUranyanAppShared('line')
  }, [text])
  const onX = useCallback(() => {
    shareToTwitter(text, SHARE_URL)
    trackUranyanAppShared('twitter')
  }, [text])
  const onCopy = useCallback(async () => {
    const ok = await copyToClipboard(`${text}\n${SHARE_URL}`)
    if (ok) {
      setCopied(true)
      trackUranyanAppShared('copy_link')
      setTimeout(() => setCopied(false), 2000)
    }
  }, [text])

  return (
    <div style={{
      marginTop: 24, padding: '16px 16px 14px', borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(6,199,85,0.10), rgba(255,210,74,0.08))',
      border: '1px solid rgba(6,199,85,0.25)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 4,
      }}>
        <span style={{ fontSize: 18 }}>📣</span>
        友達にうらにゃん。を教える
      </div>
      <div style={{ fontSize: 11, color: '#bbb', marginBottom: 12 }}>
        LINEグループに送ると、みんなで占い合えるよ
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button type="button" onClick={onLine} style={{
          padding: '12px 0', borderRadius: 12, border: 'none',
          background: '#06C755', color: '#fff', fontSize: 14, fontWeight: 800,
          cursor: 'pointer',
        }}>💬 LINEでシェア</button>
        <button type="button" onClick={onX} style={{
          padding: '12px 0', borderRadius: 12, border: 'none',
          background: '#000', color: '#fff', fontSize: 14, fontWeight: 800,
          cursor: 'pointer',
        }}>🐦 Xでシェア</button>
      </div>
      <button type="button" onClick={onCopy} style={{
        width: '100%', marginTop: 8, padding: '10px 0', borderRadius: 10,
        border: '1px solid var(--fm-border)', background: 'rgba(255,255,255,0.04)',
        color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>
        {copied ? '✅ コピー完了' : '🔗 リンクをコピー'}
      </button>
    </div>
  )
}

// ====================================================
// 部品: 天命 - 対象選択
// ====================================================
function PickLifeView(p: {
  loading: boolean
  loggedIn: boolean
  targets: TargetCard[]
  guestDraft: { name: string; year: string; month: string; day: string }
  setGuestDraft: (s: { name: string; year: string; month: string; day: string }) => void
  errorMsg: string | null
  onReadTarget: (t: TargetCard) => void
  onReadGuest: () => void
  onEditTarget: (t: TargetCard) => void
  onAddTarget: () => void
  onDeleteTarget: (t: TargetCard) => void
  onEditSelf: () => void
  hasSelf: boolean
}) {
  return (
    <div style={{ padding: '8px 20px 40px' }}>
      <SectionTitle emoji="🔮" title="天命トリセツ" sub="占いたい人をタップ" />
      {p.loading ? <Loading /> :
        !p.loggedIn ? (
          <GuestSingleForm draft={p.guestDraft} setDraft={p.setGuestDraft}
            error={p.errorMsg} onSubmit={p.onReadGuest} buttonLabel="天命トリセツを見る" />
        ) : (
          <>
            {!p.hasSelf && (
              <div style={inlineHintCard}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>まずは自分から占おう</div>
                <div style={{ fontSize: 12, color: '#bbb', marginBottom: 10 }}>
                  生年月日を登録すると、いつでもワンタップで占えるよ。
                </div>
                <button type="button" onClick={p.onEditSelf} style={primaryBtnSmall}>
                  自分の生年月日を登録
                </button>
              </div>
            )}
            <ListHeader title="占い帳" onAdd={p.onAddTarget} />
            <CardList targets={p.targets} onTap={p.onReadTarget}
              onEdit={p.onEditTarget} onDelete={p.onDeleteTarget} />
          </>
        )}
    </div>
  )
}

// ====================================================
// 部品: 相性 - 2 人選択
// ====================================================
function PickCompatView(p: {
  loading: boolean
  loggedIn: boolean
  targets: TargetCard[]
  guestDraft: { name: string; year: string; month: string; day: string }
  setGuestDraft: (s: { name: string; year: string; month: string; day: string }) => void
  guestPartner: { name: string; year: string; month: string; day: string }
  setGuestPartner: (s: { name: string; year: string; month: string; day: string }) => void
  errorMsg: string | null
  compatA: TargetCard | null
  compatB: TargetCard | null
  onPick: (t: TargetCard) => void
  onClear: () => void
  onAddTarget: () => void
  onEditTarget: (t: TargetCard) => void
  onDeleteTarget: (t: TargetCard) => void
  onReadGuest: () => void
}) {
  return (
    <div style={{ padding: '8px 20px 40px' }}>
      <SectionTitle emoji="💞" title="相性診断" sub="2 人選ぶと相性が出るよ" />
      {p.loading ? <Loading /> :
        !p.loggedIn ? (
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
              <Link href="/" style={{ color: '#FFD24A' }}>ログイン</Link> すると、カードを保存して何度でも占えるよ。
            </div>
            <div style={{ fontSize: 13, color: '#bbb', marginTop: 12, marginBottom: 6 }}>あなた</div>
            <GuestSingleFormInline draft={p.guestDraft} setDraft={p.setGuestDraft} />
            <div style={{ fontSize: 13, color: '#bbb', marginTop: 16, marginBottom: 6 }}>相手</div>
            <GuestSingleFormInline draft={p.guestPartner} setDraft={p.setGuestPartner} />
            {p.errorMsg && <div style={{ color: '#FF6B6B', fontSize: 12, marginTop: 10 }}>{p.errorMsg}</div>}
            <button type="button" onClick={p.onReadGuest} style={{ ...primaryBtn, width: '100%', marginTop: 14 }}>
              相性を見る
            </button>
          </div>
        ) : (
          <>
            <CompatStepBanner a={p.compatA} b={p.compatB} onClear={p.onClear} />
            <ListHeader title="占い帳" onAdd={p.onAddTarget} />
            <CardList
              targets={p.targets}
              selectedIds={[p.compatA?.id, p.compatB?.id].filter(Boolean) as string[]}
              onTap={p.onPick}
              onEdit={p.onEditTarget}
              onDelete={p.onDeleteTarget}
            />
          </>
        )}
    </div>
  )
}

function CompatStepBanner({ a, b, onClear }: {
  a: TargetCard | null; b: TargetCard | null; onClear: () => void
}) {
  return (
    <div style={{
      marginBottom: 14, padding: '12px 14px', borderRadius: 12,
      background: 'linear-gradient(90deg, rgba(255,122,174,0.15), rgba(162,155,254,0.15))',
      border: '1px solid rgba(162,155,254,0.30)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SlotChip label="あなた" target={a} accent="#FF7AAE" />
        <span style={{ fontSize: 18, color: '#fff' }}>×</span>
        <SlotChip label="相手" target={b} accent="#A29BFE" />
        {(a || b) && (
          <button type="button" onClick={onClear} style={{
            marginLeft: 'auto', ...smallChipBtn,
          }}>クリア</button>
        )}
      </div>
      <div style={{ fontSize: 11, color: '#bbb', marginTop: 8 }}>
        {!a ? 'まず "あなた" を選んで' : !b ? '次に "相手" を選ぶと結果が出るよ' : ''}
      </div>
    </div>
  )
}

function SlotChip({ label, target, accent }: { label: string; target: TargetCard | null; accent: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 10px', borderRadius: 10,
      background: target ? `${accent}26` : 'rgba(255,255,255,0.04)',
      border: `1px solid ${target ? accent : 'var(--fm-border)'}`,
      fontSize: 12, color: '#fff', fontWeight: 700,
      minWidth: 90, justifyContent: 'center',
    }}>
      <span style={{ fontSize: 10, color: '#bbb', marginRight: 4 }}>{label}</span>
      {target ? (
        <><span>{target.emoji ?? '🪞'}</span><span style={{ maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{target.name}</span></>
      ) : '—'}
    </div>
  )
}

// ====================================================
// 共通: セクションタイトル / リストヘッダ / カードリスト
// ====================================================
function SectionTitle({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>{emoji}</span>
        <span style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{title}</span>
      </div>
      {sub && <div style={{ fontSize: 12, color: '#888', marginTop: 4, marginLeft: 32 }}>{sub}</div>}
    </div>
  )
}

function ListHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div style={{ marginTop: 12, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#bbb' }}>{title}</div>
      <button type="button" onClick={onAdd} style={primaryBtnSmall}>＋ 追加</button>
    </div>
  )
}

function Loading() {
  return <div style={{ textAlign: 'center', color: '#aaa', marginTop: 24 }}>読み込み中…</div>
}

function CardList(p: {
  targets: TargetCard[]
  selectedIds?: string[]
  onTap: (t: TargetCard) => void
  onEdit: (t: TargetCard) => void
  onDelete: (t: TargetCard) => void
}) {
  if (p.targets.length === 0) {
    return (
      <div style={{
        padding: 16, borderRadius: 12, textAlign: 'center',
        background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--fm-border)',
        color: '#888', fontSize: 12,
      }}>
        友達・家族・推しの生年月日を登録すると、ここに並ぶよ
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {p.targets.map(t => (
        <TargetCardRow
          key={t.id} target={t}
          selected={p.selectedIds?.includes(t.id) ?? false}
          onTap={() => p.onTap(t)}
          onEdit={() => p.onEdit(t)}
          onDelete={() => p.onDelete(t)}
        />
      ))}
    </div>
  )
}

function TargetCardRow(p: {
  target: TargetCard
  selected: boolean
  onTap: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const rel = RELATIONSHIP_LABELS[p.target.relationship]
  return (
    <div style={{
      ...targetCardStyle,
      borderColor: p.selected ? '#FFD24A' : (p.target.color_tag ?? 'var(--fm-border)'),
      background: p.selected
        ? 'linear-gradient(135deg, rgba(255,210,74,0.22), rgba(255,122,174,0.10))'
        : (p.target.color_tag
          ? `linear-gradient(135deg, ${hex2rgba(p.target.color_tag, 0.20)}, rgba(255,255,255,0.02))`
          : 'rgba(255,255,255,0.03)'),
      boxShadow: p.selected ? '0 0 0 2px rgba(255,210,74,0.30)' : 'none',
    }}>
      <button type="button" onClick={p.onTap} style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 12,
        background: 'transparent', border: 'none', padding: 0, color: 'inherit',
        textAlign: 'left', cursor: 'pointer',
      }}>
        <div style={{ fontSize: 28 }}>{p.target.emoji ?? rel.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.target.name}
          </div>
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
            {rel.emoji} {rel.label} · {p.target.birth_year}/{p.target.birth_month}/{p.target.birth_day}
          </div>
        </div>
        <div style={{ fontSize: 18 }}>{p.selected ? '✅' : '🔮'}</div>
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 8 }}>
        <button type="button" onClick={p.onEdit} style={iconBtn} aria-label="編集">✎</button>
        {!p.target.isSelf && (
          <button type="button" onClick={p.onDelete} style={iconBtn} aria-label="削除">🗑</button>
        )}
      </div>
    </div>
  )
}

// ====================================================
// 部品: ゲスト用フォーム (天命 = 1人)
// ====================================================
function GuestSingleForm(p: {
  draft: { name: string; year: string; month: string; day: string }
  setDraft: (s: { name: string; year: string; month: string; day: string }) => void
  error: string | null
  onSubmit: () => void
  buttonLabel: string
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
        まずは試してみて。<Link href="/" style={{ color: '#FFD24A' }}>ログイン</Link> すると複数登録できるよ。
      </div>
      <GuestSingleFormInline draft={p.draft} setDraft={p.setDraft} />
      {p.error && <div style={{ color: '#FF6B6B', fontSize: 12, marginTop: 8 }}>{p.error}</div>}
      <button type="button" onClick={p.onSubmit} style={{ ...primaryBtn, width: '100%', marginTop: 12 }}>
        {p.buttonLabel}
      </button>
    </div>
  )
}

function GuestSingleFormInline(p: {
  draft: { name: string; year: string; month: string; day: string }
  setDraft: (s: { name: string; year: string; month: string; day: string }) => void
}) {
  return (
    <>
      <input
        placeholder="名前 (ニックネームでOK)"
        value={p.draft.name}
        onChange={e => p.setDraft({ ...p.draft, name: e.target.value })}
        style={inputStyle} maxLength={30}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input placeholder="年 (例 2008)" inputMode="numeric" value={p.draft.year}
          onChange={e => p.setDraft({ ...p.draft, year: e.target.value })}
          style={{ ...inputStyle, flex: 1.4 }} maxLength={4} />
        <input placeholder="月" inputMode="numeric" value={p.draft.month}
          onChange={e => p.setDraft({ ...p.draft, month: e.target.value })}
          style={{ ...inputStyle, flex: 1 }} maxLength={2} />
        <input placeholder="日" inputMode="numeric" value={p.draft.day}
          onChange={e => p.setDraft({ ...p.draft, day: e.target.value })}
          style={{ ...inputStyle, flex: 1 }} maxLength={2} />
      </div>
    </>
  )
}

// ====================================================
// 部品: 編集フォーム
// ====================================================
function EditView(p: {
  draft: EditDraft
  setDraft: (d: EditDraft) => void
  errorMsg: string | null
  busy: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const d = p.draft
  return (
    <div style={{ padding: '8px 20px 40px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
        {d.isSelf ? '自分のプロフィール' : d.targetId ? 'カードを編集' : 'カードを追加'}
      </div>
      <div style={fieldLabel}>名前</div>
      <input placeholder="名前 (ニックネームでOK)" value={d.name}
        onChange={e => p.setDraft({ ...d, name: e.target.value })}
        style={inputStyle} maxLength={30} />
      {!d.isSelf && (
        <>
          <div style={fieldLabel}>関係</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {RELATIONSHIPS.filter(r => r !== 'self').map(r => {
              const active = d.relationship === r
              return (
                <button key={r} type="button" onClick={() => p.setDraft({ ...d, relationship: r })} style={{
                  ...chipStyle,
                  background: active ? 'rgba(108,92,231,0.30)' : 'rgba(255,255,255,0.04)',
                  borderColor: active ? '#A29BFE' : 'var(--fm-border)',
                  color: active ? '#fff' : '#bbb',
                }}>{RELATIONSHIP_LABELS[r].emoji} {RELATIONSHIP_LABELS[r].label}</button>
              )
            })}
          </div>
        </>
      )}
      <div style={fieldLabel}>生年月日</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input placeholder="年" inputMode="numeric" value={d.year}
          onChange={e => p.setDraft({ ...d, year: e.target.value })}
          style={{ ...inputStyle, flex: 1.4 }} maxLength={4} />
        <input placeholder="月" inputMode="numeric" value={d.month}
          onChange={e => p.setDraft({ ...d, month: e.target.value })}
          style={{ ...inputStyle, flex: 1 }} maxLength={2} />
        <input placeholder="日" inputMode="numeric" value={d.day}
          onChange={e => p.setDraft({ ...d, day: e.target.value })}
          style={{ ...inputStyle, flex: 1 }} maxLength={2} />
      </div>
      {!d.isSelf && (
        <>
          <div style={fieldLabel}>カードの絵文字</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EMOJI_PRESETS.map(em => (
              <button key={em} type="button" onClick={() => p.setDraft({ ...d, emoji: em })} style={{
                ...emojiPickerBtn,
                borderColor: d.emoji === em ? '#A29BFE' : 'var(--fm-border)',
                background: d.emoji === em ? 'rgba(108,92,231,0.25)' : 'rgba(255,255,255,0.04)',
              }}>{em}</button>
            ))}
          </div>
          <div style={fieldLabel}>カード色</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {COLOR_PRESETS.map(c => (
              <button key={c} type="button" onClick={() => p.setDraft({ ...d, colorTag: c })}
                aria-label={`色 ${c}`}
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: c,
                  border: d.colorTag === c ? '3px solid #fff' : '1px solid var(--fm-border)',
                  cursor: 'pointer',
                }}/>
            ))}
          </div>
        </>
      )}
      {p.errorMsg && <div style={{ color: '#FF6B6B', fontSize: 12, marginTop: 12 }}>{p.errorMsg}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button type="button" onClick={p.onCancel} disabled={p.busy} style={{ ...secondaryBtn, flex: 1 }}>キャンセル</button>
        <button type="button" onClick={p.onSave} disabled={p.busy} style={{ ...primaryBtn, flex: 2 }}>
          {p.busy ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}

// ====================================================
// 部品: キャラ選好
// ====================================================
function CharacterView(p: {
  catBreed: string; setCatBreed: (s: string) => void
  dogBreed: string; setDogBreed: (s: string) => void
  onSave: () => void
}) {
  return (
    <div style={{ padding: '8px 20px 40px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>あんたのニャンポチ</div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>占いに出てくる猫と犬の見た目を選べるよ</div>
      <div style={fieldLabel}>ニャンじろう (猫) — {CAT_BREEDS.length} 種</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
        {CAT_BREEDS.map(b => (
          <button key={b.id} type="button" onClick={() => p.setCatBreed(b.id)} style={{
            ...breedPickerBtn,
            borderColor: p.catBreed === b.id ? '#FF7AAE' : 'var(--fm-border)',
            background: p.catBreed === b.id ? 'rgba(255,122,174,0.18)' : 'rgba(255,255,255,0.03)',
          }}>
            <CatIcon breed={b} size={44} title={b.label} />
            <div style={{ fontSize: 11, color: '#ddd', marginTop: 4 }}>{b.label}</div>
          </button>
        ))}
      </div>
      <div style={fieldLabel}>ポチ (犬) — {DOG_BREEDS.length} 種</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
        {DOG_BREEDS.map(b => (
          <button key={b.id} type="button" onClick={() => p.setDogBreed(b.id)} style={{
            ...breedPickerBtn,
            borderColor: p.dogBreed === b.id ? '#FFD24A' : 'var(--fm-border)',
            background: p.dogBreed === b.id ? 'rgba(255,210,74,0.18)' : 'rgba(255,255,255,0.03)',
          }}>
            <DogIcon breed={b} size={44} title={b.label} />
            <div style={{ fontSize: 11, color: '#ddd', marginTop: 4 }}>{b.label}</div>
          </button>
        ))}
      </div>
      <button type="button" onClick={p.onSave} style={{ ...primaryBtn, width: '100%', marginTop: 24 }}>
        保存して戻る
      </button>
    </div>
  )
}

// ====================================================
// 部品: 天命トリセツ 結果
// ====================================================
interface ResultActionProps {
  loggedIn: boolean
  savedReadingId: string | null
  setSavedReadingId: (id: string | null) => void
  savePromptOpen: boolean
  setSavePromptOpen: (b: boolean) => void
}

function LifeResultView(p: ResultActionProps & {
  target: TargetCard
  catBreed: string
  dogBreed: string
  onBack: () => void
}) {
  const cat = getCatBreed(p.catBreed)
  const dog = getDogBreed(p.dogBreed)
  const reading = useMemo(
    () => buildLifeReading({ year: p.target.birth_year, month: p.target.birth_month, day: p.target.birth_day }),
    [p.target],
  )
  const shareText = useMemo(() => buildLifeShareText(p.target.name, reading), [p.target.name, reading])
  const savePayload = useMemo(() => buildLifeSavePayload(
    { name: p.target.name, year: p.target.birth_year, month: p.target.birth_month, day: p.target.birth_day },
    reading,
  ), [p.target, reading])
  const cardRef = useRef<HTMLDivElement>(null)

  return (
    <div style={{ padding: '8px 16px 40px' }}>
      <div ref={cardRef} style={resultCardStyle}>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#A29BFE', letterSpacing: 2, marginBottom: 4 }}>
          うらにゃん。 / 天命トリセツ (算命学)
        </div>
        <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 2 }}>
          {p.target.name}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#888', marginBottom: 16 }}>
          {p.target.birth_year}/{String(p.target.birth_month).padStart(2,'0')}/{String(p.target.birth_day).padStart(2,'0')}
        </div>
        <BucchakeMeter level={reading.bucchakeLevel} />
        <PillarBlock part={reading.outer} cat={cat} dog={dog} accent="#FFD24A" />
        <PillarBlock part={reading.middle} cat={cat} dog={dog} accent="#5EE2C8" />
        <PillarBlock part={reading.inner} cat={cat} dog={dog} accent="#FF7AAE" highlight />
        <LuckyColorBlock color={reading.luckyColor} />
        <ShareFooter />
      </div>
      <ResultActions
        shareText={shareText} menu="life" resultSummary={savePayload.result_summary}
        onBack={p.onBack} backLabel="もう 1 人占う"
        loggedIn={p.loggedIn}
        savedReadingId={p.savedReadingId} setSavedReadingId={p.setSavedReadingId}
        savePromptOpen={p.savePromptOpen} setSavePromptOpen={p.setSavePromptOpen}
        saveInput={{
          menu: 'life',
          target_names: savePayload.target_names,
          target_birthdates: savePayload.target_birthdates,
          result_summary: savePayload.result_summary,
          result_payload: savePayload.result_payload,
        }}
        cardRef={cardRef}
        fileNameBase={`life_${p.target.name}`}
      />
    </div>
  )
}

function PillarBlock(p: {
  part: ReturnType<typeof buildLifeReading>['outer']
  cat: BreedOption
  dog: BreedOption
  accent: string
  highlight?: boolean
}) {
  return (
    <div style={{
      marginTop: 16, padding: '14px 14px 12px', borderRadius: 14,
      background: p.highlight ? 'rgba(255,122,174,0.10)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${p.highlight ? 'rgba(255,122,174,0.30)' : 'rgba(255,255,255,0.06)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 10,
          background: p.accent, color: '#1a1030', fontWeight: 800, letterSpacing: 1,
        }}>{p.part.label}</span>
        <span style={{ fontSize: 11, color: '#888' }}>{p.part.star}</span>
      </div>
      <div style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic', marginBottom: 10 }}>
        — {p.part.starHeadline}
      </div>
      <div style={dialogRow}>
        <CatIcon breed={p.cat} size={32} />
        <div style={bubbleNyan}>
          <div style={bubbleSpeaker}>ニャンじろう</div>
          {p.part.main.nyan}
        </div>
      </div>
      <div style={{ ...dialogRow, marginTop: 8 }}>
        <DogIcon breed={p.dog} size={32} />
        <div style={bubblePochi}>
          <div style={bubbleSpeaker}>ポチ</div>
          {p.part.main.pochi}
        </div>
      </div>
    </div>
  )
}

function LuckyColorBlock(p: { color: { name: string; hex: string } }) {
  return (
    <div style={{
      marginTop: 14, padding: '12px 14px', borderRadius: 14,
      display: 'flex', alignItems: 'center', gap: 12,
      background: `linear-gradient(135deg, ${hex2rgba(p.color.hex, 0.20)}, rgba(255,255,255,0.03))`,
      border: `1px solid ${hex2rgba(p.color.hex, 0.40)}`,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: p.color.hex, border: '2px solid rgba(255,255,255,0.5)',
      }}/>
      <div>
        <div style={{ fontSize: 10, color: '#888', letterSpacing: 1, fontWeight: 700 }}>LUCKY COLOR</div>
        <div style={{ fontSize: 14, color: '#fff', fontWeight: 800, marginTop: 2 }}>{p.color.name}</div>
      </div>
    </div>
  )
}

function BucchakeMeter({ level }: { level: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      padding: '6px 10px', marginBottom: 8,
      background: 'rgba(255,122,174,0.10)', borderRadius: 10,
      border: '1px solid rgba(255,122,174,0.25)',
    }}>
      <span style={{ fontSize: 10, color: '#FF7AAE', fontWeight: 800, letterSpacing: 1 }}>ぶっちゃけ度</span>
      <span style={{ fontSize: 14, letterSpacing: 1 }}>
        {'★'.repeat(level)}<span style={{ color: '#444' }}>{'☆'.repeat(5 - level)}</span>
      </span>
    </div>
  )
}

// ====================================================
// 部品: 相性診断 結果
// ====================================================
function CompatResultView(p: ResultActionProps & {
  a: TargetCard
  b: TargetCard
  catBreed: string
  dogBreed: string
  onBack: () => void
}) {
  const cat = getCatBreed(p.catBreed)
  const dog = getDogBreed(p.dogBreed)
  const compat = useMemo(
    () => buildCompatibilityReading(
      { year: p.a.birth_year, month: p.a.birth_month, day: p.a.birth_day },
      { year: p.b.birth_year, month: p.b.birth_month, day: p.b.birth_day },
    ),
    [p.a, p.b],
  )
  const shareText = useMemo(() => buildCompatShareText(p.a.name, p.b.name, compat), [p.a.name, p.b.name, compat])
  const savePayload = useMemo(() => buildCompatSavePayload(
    { name: p.a.name, year: p.a.birth_year, month: p.a.birth_month, day: p.a.birth_day },
    { name: p.b.name, year: p.b.birth_year, month: p.b.birth_month, day: p.b.birth_day },
    compat,
  ), [p.a, p.b, compat])
  const tone = fortuneColor(compat.template.fortune)
  const cardRef = useRef<HTMLDivElement>(null)
  return (
    <div style={{ padding: '8px 16px 40px' }}>
      <div ref={cardRef} style={resultCardStyle}>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#A29BFE', letterSpacing: 2, marginBottom: 4 }}>
          うらにゃん。 / 相性診断 (宿曜)
        </div>

        {/* 二人 + 関係見出し */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 6 }}>
          <PersonChip name={p.a.name} mansion={compat.selfMansion} emoji={p.a.emoji ?? '🪞'} />
          <div style={{
            padding: '4px 10px', borderRadius: 999,
            background: tone.bg, color: tone.fg, fontWeight: 900, fontSize: 13,
            border: `1px solid ${tone.fg}55`,
          }}>{compat.relation}</div>
          <PersonChip name={p.b.name} mansion={compat.targetMansion} emoji={p.b.emoji ?? '✨'} />
        </div>

        <div style={{
          marginTop: 14, padding: '14px 14px',
          borderRadius: 14, background: tone.bg, border: `1px solid ${tone.fg}55`,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{compat.template.headline}</span>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 8, color: tone.fg,
              border: `1px solid ${tone.fg}`, fontWeight: 800, letterSpacing: 1,
            }}>{compat.template.fortune}</span>
          </div>
          <div style={{ fontSize: 13, color: '#ddd', lineHeight: 1.6 }}>
            {compat.template.blurb}
          </div>
        </div>

        <div style={{ ...dialogRow, marginTop: 16 }}>
          <CatIcon breed={cat} size={32} />
          <div style={bubbleNyan}>
            <div style={bubbleSpeaker}>ニャンじろう</div>
            {compat.template.nyan}
          </div>
        </div>
        <div style={{ ...dialogRow, marginTop: 8 }}>
          <DogIcon breed={dog} size={32} />
          <div style={bubblePochi}>
            <div style={bubbleSpeaker}>ポチ</div>
            {compat.template.pochi}
          </div>
        </div>

        <div style={{
          marginTop: 14, padding: '12px 14px', borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: 13, color: '#eee', lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 10, color: '#A29BFE', fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>
            ADVICE
          </div>
          {compat.template.advice}
        </div>

        <ShareFooter />
      </div>
      <ResultActions
        shareText={shareText} menu="compat" resultSummary={savePayload.result_summary}
        onBack={p.onBack} backLabel="別の組み合わせを占う"
        loggedIn={p.loggedIn}
        savedReadingId={p.savedReadingId} setSavedReadingId={p.setSavedReadingId}
        savePromptOpen={p.savePromptOpen} setSavePromptOpen={p.setSavePromptOpen}
        saveInput={{
          menu: 'compat',
          target_names: savePayload.target_names,
          target_birthdates: savePayload.target_birthdates,
          result_summary: savePayload.result_summary,
          result_payload: savePayload.result_payload,
        }}
        cardRef={cardRef}
        fileNameBase={`compat_${p.a.name}_${p.b.name}`}
      />
    </div>
  )
}

function PersonChip({ name, mansion, emoji }: { name: string; mansion: string; emoji: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 12,
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.08)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 22 }}>{emoji}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </div>
      <div style={{ fontSize: 10, color: '#A29BFE', marginTop: 2 }}>{mansion}宿</div>
    </div>
  )
}

function ResultActions(p: ResultActionProps & {
  shareText: string
  menu: 'life' | 'compat' | 'group_compat' | 'period'
  resultSummary: string
  saveInput: SaveInput
  onBack: () => void
  backLabel: string
  cardRef?: React.RefObject<HTMLDivElement | null>
  fileNameBase?: string
}) {
  const [copied, setCopied] = useState(false)

  const onShareX = useCallback(() => {
    shareToTwitter(p.shareText, SHARE_URL)
    trackUranyanShared('twitter', p.menu, p.resultSummary)
  }, [p.shareText, p.menu, p.resultSummary])

  const onShareLINE = useCallback(() => {
    shareToLine(p.shareText, SHARE_URL)
    trackUranyanShared('line', p.menu, p.resultSummary)
  }, [p.shareText, p.menu, p.resultSummary])

  const onCopy = useCallback(async () => {
    const ok = await copyToClipboard(`${p.shareText}\n${SHARE_URL}`)
    if (ok) {
      setCopied(true)
      trackUranyanShared('copy_link', p.menu, p.resultSummary)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [p.shareText, p.menu, p.resultSummary])

  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button type="button" onClick={onShareLINE} style={{
          ...primaryBtn, background: '#06C755',
        }}>💬 LINE</button>
        <button type="button" onClick={onShareX} style={{
          ...primaryBtn, background: '#000',
        }}>🐦 X</button>
      </div>
      {p.cardRef && (
        <ImageSaveButton cardRef={p.cardRef} fileNameBase={p.fileNameBase ?? p.menu} />
      )}
      <button type="button" onClick={onCopy} style={{ ...secondaryBtn, width: '100%' }}>
        {copied ? '✅ コピー完了' : '🔗 結果テキストをコピー'}
      </button>
      {p.loggedIn && (
        p.savedReadingId ? (
          <div style={{
            ...secondaryBtn, width: '100%', textAlign: 'center',
            background: 'rgba(94,226,200,0.10)', borderColor: '#5EE2C8', color: '#5EE2C8',
            cursor: 'default',
          }}>
            ✓ 履歴に保存済み (履歴メニューから後でレビューできるよ)
          </div>
        ) : (
          <button type="button" onClick={() => p.setSavePromptOpen(true)} style={{
            ...secondaryBtn, width: '100%',
            background: 'rgba(255,210,74,0.10)', borderColor: 'rgba(255,210,74,0.40)', color: '#FFD24A',
          }}>📝 履歴に残す (後でレビュー可)</button>
        )
      )}
      <button type="button" onClick={p.onBack} style={{ ...secondaryBtn, width: '100%', background: 'transparent' }}>
        {p.backLabel}
      </button>
      {p.savePromptOpen && (
        <SavePromptModal
          input={p.saveInput}
          onClose={() => p.setSavePromptOpen(false)}
          onSaved={id => { p.setSavedReadingId(id); p.setSavePromptOpen(false) }}
        />
      )}
    </div>
  )
}

// ====================================================
// 部品: 結果カードを PNG 画像化してシェア/保存
// ====================================================
function ImageSaveButton({ cardRef, fileNameBase }: {
  cardRef: React.RefObject<HTMLDivElement | null>
  fileNameBase: string
}) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<null | 'shared' | 'downloaded' | 'failed'>(null)
  const onTap = useCallback(async () => {
    if (!cardRef.current) return
    setBusy(true)
    setStatus(null)
    const r = await shareOrDownloadImage(cardRef.current, buildImageFileName('uranyan', fileNameBase))
    setStatus(r)
    setBusy(false)
    setTimeout(() => setStatus(null), 3000)
  }, [cardRef, fileNameBase])

  const label =
    busy ? '生成中…' :
    status === 'shared' ? '✅ シェア完了' :
    status === 'downloaded' ? '✅ 画像を保存しました' :
    status === 'failed' ? '❌ 画像化に失敗 (再試行してね)' :
    '📸 画像で保存・シェア'

  return (
    <button type="button" onClick={onTap} disabled={busy} style={{
      ...secondaryBtn, width: '100%',
      background: status === 'failed' ? 'rgba(255,107,107,0.10)' :
                  status ? 'rgba(94,226,200,0.10)' : 'rgba(255,255,255,0.04)',
      borderColor: status === 'failed' ? 'rgba(255,107,107,0.40)' :
                   status ? '#5EE2C8' : 'var(--fm-border)',
      color: status === 'failed' ? '#FF6B6B' : status ? '#5EE2C8' : '#fff',
      cursor: busy ? 'wait' : 'pointer',
    }}>{label}</button>
  )
}

function ShareFooter() {
  return (
    <div style={{
      marginTop: 16, paddingTop: 12, borderTop: '1px dashed rgba(255,255,255,0.15)',
      textAlign: 'center', fontSize: 10, color: '#888',
    }}>
      #うらにゃん  ·  filmo.me/games/uranyan
    </div>
  )
}

// ====================================================
// 補助関数
// ====================================================
function isValidDate(y: number, m: number, d: number): boolean {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function hex2rgba(hex: string, a: number): string {
  const h = hex.replace('#','')
  const r = parseInt(h.slice(0,2), 16)
  const g = parseInt(h.slice(2,4), 16)
  const b = parseInt(h.slice(4,6), 16)
  return `rgba(${r},${g},${b},${a})`
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function buildLifeShareText(name: string, r: ReturnType<typeof buildLifeReading>): string {
  const stars = '★'.repeat(r.bucchakeLevel) + '☆'.repeat(5 - r.bucchakeLevel)
  return `🔮 #うらにゃん  天命トリセツ (算命学)\n` +
    `${name} の本性 (${r.inner.star}) ぶっちゃけ度 ${stars}\n` +
    `🐱「${truncate(r.inner.main.nyan, 60)}」\n` +
    `🐶「${truncate(r.inner.main.pochi, 50)}」\n` +
    `ラッキーカラー: ${r.luckyColor.name}`
}

function buildCompatShareText(
  aName: string, bName: string,
  c: ReturnType<typeof buildCompatibilityReading>,
): string {
  return `💞 #うらにゃん  相性診断 (宿曜)\n` +
    `${aName}(${c.selfMansion}宿) × ${bName}(${c.targetMansion}宿)\n` +
    `→ 「${c.relation}」: ${c.template.headline} [${c.template.fortune}]\n` +
    `🐱「${truncate(c.template.nyan, 60)}」`
}

function fortuneColor(f: 'great' | string): { bg: string; fg: string } {
  switch (f) {
    case '大吉': return { bg: 'rgba(255,210,74,0.18)', fg: '#FFD24A' }
    case '吉':   return { bg: 'rgba(94,226,200,0.16)', fg: '#5EE2C8' }
    case '凶':   return { bg: 'rgba(255,107,107,0.16)', fg: '#FF6B6B' }
    default:     return { bg: 'rgba(162,155,254,0.16)', fg: '#A29BFE' }
  }
}

// ====================================================
// 部品: 今日の運勢 (プレビューカード + 詳細ビュー)
// ====================================================
function TodayPreviewCard(p: { today: DailyReading; userName: string; onTap: () => void }) {
  const t = p.today
  return (
    <button type="button" onClick={p.onTap} style={{
      width: '100%', marginTop: 16, padding: '14px 16px', borderRadius: 16,
      background: `linear-gradient(135deg, ${hex2rgba(t.luckyColor.hex, 0.20)}, rgba(255,255,255,0.04))`,
      border: `1px solid ${hex2rgba(t.luckyColor.hex, 0.50)}`,
      color: '#fff', cursor: 'pointer', textAlign: 'left',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          fontSize: 32, lineHeight: 1, width: 48, height: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 12, background: 'rgba(0,0,0,0.20)',
        }}>{t.rankEmoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: '#bbb', letterSpacing: 1, fontWeight: 700 }}>
            {t.todayDateStr} · 今日の運勢
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 2 }}>
            {t.rankLabel}
            <span style={{ marginLeft: 8, fontSize: 13, color: '#FFD24A' }}>
              {'★'.repeat(t.rank)}<span style={{ color: '#444' }}>{'☆'.repeat(5 - t.rank)}</span>
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#ddd', marginTop: 2 }}>
            {t.oneLineSummary}
          </div>
        </div>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: t.luckyColor.hex,
          border: '2px solid rgba(255,255,255,0.5)',
        }} title={`ラッキー: ${t.luckyColor.name}`} />
      </div>
    </button>
  )
}

function TodayResultView(p: {
  userName: string
  today: DailyReading
  catBreed: string
  dogBreed: string
  onBack: () => void
}) {
  const cat = getCatBreed(p.catBreed)
  const dog = getDogBreed(p.dogBreed)
  const t = p.today
  const [copied, setCopied] = useState(false)
  const shareText = useMemo(() => dailyShareText(p.userName, t), [p.userName, t])
  const cardRef = useRef<HTMLDivElement>(null)

  const onShareLine = useCallback(() => {
    shareToLine(shareText, SHARE_URL)
    trackUranyanShared('line', 'life', `daily:${t.rank}`)
  }, [shareText, t.rank])
  const onShareX = useCallback(() => {
    shareToTwitter(shareText, SHARE_URL)
    trackUranyanShared('twitter', 'life', `daily:${t.rank}`)
  }, [shareText, t.rank])
  const onCopy = useCallback(async () => {
    const ok = await copyToClipboard(`${shareText}\n${SHARE_URL}`)
    if (ok) {
      setCopied(true)
      trackUranyanShared('copy_link', 'life', `daily:${t.rank}`)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [shareText, t.rank])

  return (
    <div style={{ padding: '8px 16px 40px' }}>
      <div ref={cardRef} style={resultCardStyle}>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#A29BFE', letterSpacing: 2, marginBottom: 4 }}>
          うらにゃん。 / 今日の運勢
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: '#888', marginBottom: 14 }}>
          {t.todayDateStr} · {p.userName}
        </div>

        {/* 大きなランク表示 */}
        <div style={{
          textAlign: 'center', padding: '14px 0 18px',
          borderRadius: 16, marginBottom: 14,
          background: `radial-gradient(circle at 50% 0%, ${hex2rgba(t.luckyColor.hex, 0.30)}, transparent 70%)`,
        }}>
          <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 6 }}>{t.rankEmoji}</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{t.rankLabel}</div>
          <div style={{ fontSize: 20, marginTop: 4, letterSpacing: 2 }}>
            <span style={{ color: '#FFD24A' }}>{'★'.repeat(t.rank)}</span>
            <span style={{ color: '#444' }}>{'☆'.repeat(5 - t.rank)}</span>
          </div>
          <div style={{ fontSize: 13, color: '#ddd', marginTop: 8, fontWeight: 700 }}>
            {t.oneLineSummary}
          </div>
        </div>

        {/* 掛け合い */}
        <div style={dialogRow}>
          <CatIcon breed={cat} size={32} />
          <div style={bubbleNyan}>
            <div style={bubbleSpeaker}>ニャンじろう</div>
            {t.nyanLine}
          </div>
        </div>
        <div style={{ ...dialogRow, marginTop: 8 }}>
          <DogIcon breed={dog} size={32} />
          <div style={bubblePochi}>
            <div style={bubbleSpeaker}>ポチ</div>
            {t.pochiLine}
          </div>
        </div>

        {/* ラッキー行動 */}
        <ActionBox icon="✨" label="ラッキー行動" tone="good" text={t.luckyAction} />
        {/* NG 行動 */}
        <ActionBox icon="🙅" label="NG 行動" tone="bad" text={t.ngAction} />

        {/* カラー 2 種 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          <ColorChip label="ラッキーカラー" color={t.luckyColor} />
          <ColorChip label="ガチ病み回避" color={t.escapeColor} small />
        </div>

        {/* 詳細メタ (折りたたみ風) */}
        <div style={{
          marginTop: 14, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 11, color: '#888', lineHeight: 1.6,
        }}>
          <span style={{ color: '#A29BFE', fontWeight: 700 }}>算命学:</span> {t.userDayStem}日生まれ vs 今日 {t.todayDayStem}{t.todayDayBranch} ({t.sanmeiRelation})
          <br />
          <span style={{ color: '#A29BFE', fontWeight: 700 }}>宿曜:</span> {t.userMansion}宿 vs 今日 {t.todayMansion}宿 → {t.sukuyoRelation}「{t.sukuyoHeadline}」
        </div>

        <ShareFooter />
      </div>

      <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" onClick={onShareLine} style={{ ...primaryBtn, background: '#06C755' }}>💬 LINE</button>
          <button type="button" onClick={onShareX} style={{ ...primaryBtn, background: '#000' }}>🐦 X</button>
        </div>
        <ImageSaveButton cardRef={cardRef} fileNameBase={`today_${t.todayDateStr}`} />
        <button type="button" onClick={onCopy} style={{ ...secondaryBtn, width: '100%' }}>
          {copied ? '✅ コピー完了' : '🔗 結果テキストをコピー'}
        </button>
        <button type="button" onClick={p.onBack} style={{ ...secondaryBtn, width: '100%', background: 'transparent' }}>
          メニューへ戻る
        </button>
      </div>
    </div>
  )
}

function ActionBox({ icon, label, tone, text }: {
  icon: string; label: string; tone: 'good' | 'bad'; text: string
}) {
  const fg = tone === 'good' ? '#5EE2C8' : '#FF6B6B'
  const bg = tone === 'good' ? 'rgba(94,226,200,0.10)' : 'rgba(255,107,107,0.10)'
  return (
    <div style={{
      marginTop: 12, padding: '12px 14px', borderRadius: 12,
      background: bg, border: `1px solid ${fg}40`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: fg, letterSpacing: 1 }}>{label}</span>
      </div>
      <div style={{ fontSize: 13, color: '#eee', lineHeight: 1.55 }}>{text}</div>
    </div>
  )
}

function ColorChip({ label, color, small }: {
  label: string
  color: { name: string; hex: string }
  small?: boolean
}) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 12,
      display: 'flex', alignItems: 'center', gap: 10,
      background: `linear-gradient(135deg, ${hex2rgba(color.hex, small ? 0.12 : 0.20)}, rgba(255,255,255,0.03))`,
      border: `1px solid ${hex2rgba(color.hex, 0.40)}`,
    }}>
      <div style={{
        width: small ? 28 : 36, height: small ? 28 : 36, borderRadius: '50%',
        background: color.hex, border: '2px solid rgba(255,255,255,0.5)',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, color: '#888', letterSpacing: 1, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#fff', fontWeight: 800, marginTop: 2 }}>{color.name}</div>
      </div>
    </div>
  )
}

// ====================================================
// 部品: ファッション占い 結果ビュー
// ====================================================
function FashionResultView(p: {
  userName: string
  userBirth: { year: number; month: number; day: number }
  catBreed: string
  dogBreed: string
  onBack: () => void
}) {
  const cat = getCatBreed(p.catBreed)
  const dog = getDogBreed(p.dogBreed)
  const reading = useMemo(() => buildFashionReading(p.userBirth), [p.userBirth])
  const [copied, setCopied] = useState(false)
  const shareText = useMemo(() => fashionShareText(p.userName, reading), [p.userName, reading])
  const cardRef = useRef<HTMLDivElement>(null)

  const onShareLine = useCallback(() => {
    shareToLine(shareText, SHARE_URL)
    trackUranyanShared('line', 'life', `fashion:${reading.star}`)
  }, [shareText, reading.star])
  const onShareX = useCallback(() => {
    shareToTwitter(shareText, SHARE_URL)
    trackUranyanShared('twitter', 'life', `fashion:${reading.star}`)
  }, [shareText, reading.star])
  const onCopy = useCallback(async () => {
    const ok = await copyToClipboard(`${shareText}\n${SHARE_URL}`)
    if (ok) {
      setCopied(true)
      trackUranyanShared('copy_link', 'life', `fashion:${reading.star}`)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [shareText, reading.star])

  return (
    <div style={{ padding: '8px 16px 40px' }}>
      <div ref={cardRef} style={resultCardStyle}>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#A29BFE', letterSpacing: 2, marginBottom: 4 }}>
          うらにゃん。 / ファッション占い
        </div>
        <div style={{ textAlign: 'center', fontSize: 14, color: '#bbb', marginBottom: 4 }}>
          {p.userName} の運命の勝ち服系統
        </div>

        {/* 系統ヘッドライン */}
        <div style={{
          textAlign: 'center', padding: '16px 14px', borderRadius: 16, marginTop: 8,
          background: `linear-gradient(135deg, ${hex2rgba(reading.palette[0]?.hex ?? '#C374FF', 0.20)}, rgba(255,255,255,0.04))`,
          border: `1px solid ${hex2rgba(reading.palette[0]?.hex ?? '#C374FF', 0.40)}`,
        }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>
            👗 {reading.style.headline}
          </div>
          <div style={{ fontSize: 12, color: '#ddd', marginTop: 6, fontStyle: 'italic' }}>
            {reading.style.vibe}
          </div>
          <div style={{
            display: 'inline-block', marginTop: 10, padding: '4px 12px', borderRadius: 999,
            background: 'rgba(255,210,74,0.20)', border: '1px solid rgba(255,210,74,0.40)',
            fontSize: 12, fontWeight: 800, color: '#FFD24A',
          }}>
            合言葉: {reading.style.weeklyMantra}
          </div>
        </div>

        {/* 勝ち服 */}
        <div style={{
          marginTop: 14, padding: '12px 14px', borderRadius: 12,
          background: 'rgba(94,226,200,0.10)', border: '1px solid rgba(94,226,200,0.30)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#5EE2C8', letterSpacing: 1, marginBottom: 6 }}>
            🏆 勝ち服アイテム
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#eee', lineHeight: 1.7 }}>
            {reading.style.winItems.map(item => <li key={item}>{item}</li>)}
          </ul>
        </div>

        {/* NG */}
        <div style={{
          marginTop: 10, padding: '12px 14px', borderRadius: 12,
          background: 'rgba(255,107,107,0.10)', border: '1px solid rgba(255,107,107,0.30)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#FF6B6B', letterSpacing: 1, marginBottom: 6 }}>
            🙅 NG 服装
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#eee', lineHeight: 1.7 }}>
            {reading.style.ngItems.map(item => <li key={item}>{item}</li>)}
          </ul>
        </div>

        {/* カラーパレット */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#A29BFE', letterSpacing: 1, marginBottom: 6 }}>
            🎨 ラッキーカラーパレット ({reading.paletteElement})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {reading.palette.map(c => (
              <div key={c.hex} style={{
                padding: '12px 8px', borderRadius: 10,
                background: hex2rgba(c.hex, 0.12),
                border: `1px solid ${hex2rgba(c.hex, 0.40)}`,
                textAlign: 'center',
              }}>
                <div style={{
                  width: 32, height: 32, margin: '0 auto', borderRadius: '50%',
                  background: c.hex, border: '2px solid rgba(255,255,255,0.5)',
                }}/>
                <div style={{ fontSize: 11, color: '#fff', fontWeight: 700, marginTop: 6 }}>{c.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* アクセント */}
        <div style={{
          marginTop: 12, padding: '12px 14px', borderRadius: 12,
          background: 'rgba(255,210,74,0.08)', border: '1px solid rgba(255,210,74,0.30)',
          fontSize: 13, color: '#fff5d8',
        }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#FFD24A', letterSpacing: 1 }}>✨ 今週のアクセント</span>
          <div style={{ marginTop: 4, fontWeight: 700 }}>{reading.accent}</div>
        </div>

        {/* 掛け合い */}
        <div style={{ ...dialogRow, marginTop: 14 }}>
          <CatIcon breed={cat} size={32} />
          <div style={bubbleNyan}>
            <div style={bubbleSpeaker}>ニャンじろう</div>
            {reading.nyanLine}
          </div>
        </div>
        <div style={{ ...dialogRow, marginTop: 8 }}>
          <DogIcon breed={dog} size={32} />
          <div style={bubblePochi}>
            <div style={bubbleSpeaker}>ポチ</div>
            {reading.pochiLine}
          </div>
        </div>

        <ShareFooter />
      </div>

      <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" onClick={onShareLine} style={{ ...primaryBtn, background: '#06C755' }}>💬 LINE</button>
          <button type="button" onClick={onShareX} style={{ ...primaryBtn, background: '#000' }}>🐦 X</button>
        </div>
        <button type="button" onClick={onCopy} style={{ ...secondaryBtn, width: '100%' }}>
          {copied ? '✅ コピー完了' : '🔗 結果テキストをコピー'}
        </button>
        <ImageSaveButton cardRef={cardRef} fileNameBase={`fashion_${reading.star}`} />
        <button type="button" onClick={p.onBack} style={{ ...secondaryBtn, width: '100%', background: 'transparent' }}>
          メニューへ戻る
        </button>
      </div>
    </div>
  )
}

// ====================================================
// 部品: 期間限定占い ピッカー & 結果
// ====================================================
function PickPeriodView(p: {
  loggedIn: boolean
  hasSelfBirth: boolean
  onRun: (label: string, startISO: string, endISO: string) => void
  onRegisterSelf: () => void
}) {
  const [customLabel, setCustomLabel] = useState('')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const today = useMemo(() => new Date(), [])

  const ymdISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

  const runPreset = (preset: PeriodPreset) => {
    setErr(null)
    const r = preset.range(today)
    const lbl = preset.label + (r.labelExtra ? ` ${r.labelExtra}` : '')
    p.onRun(lbl, ymdISO(r.start), ymdISO(r.end))
  }
  const runCustom = () => {
    setErr(null)
    if (!customLabel.trim()) { setErr('期間の名前を入力してね (例: 中間テスト)'); return }
    if (!customStart || !customEnd) { setErr('開始日と終了日を選んでね'); return }
    const s = new Date(customStart), e = new Date(customEnd)
    if (e < s) { setErr('終了日は開始日より後にしてね'); return }
    const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1
    if (days > 90) { setErr('期間は 90 日以内にしてね'); return }
    p.onRun(customLabel.trim(), customStart, customEnd)
  }

  if (!p.loggedIn) {
    return (
      <div style={{ padding: '8px 20px 40px' }}>
        <SectionTitle emoji="📅" title="期間限定占い" />
        <div style={inlineHintCard}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
            ログインが必要だよ
          </div>
          <div style={{ fontSize: 12, color: '#bbb' }}>
            期間運勢は履歴保存して後日レビューする前提だから、
            <Link href="/" style={{ color: '#FFD24A' }}>ログイン</Link> してね。
          </div>
        </div>
      </div>
    )
  }
  if (!p.hasSelfBirth) {
    return (
      <div style={{ padding: '8px 20px 40px' }}>
        <SectionTitle emoji="📅" title="期間限定占い" />
        <div style={inlineHintCard}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
            自分の生年月日が必要だよ
          </div>
          <button type="button" onClick={p.onRegisterSelf} style={primaryBtnSmall}>
            自分の生年月日を登録
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 20px 40px' }}>
      <SectionTitle emoji="📅" title="期間限定占い" sub="プリセット or カスタム期間で運勢を先読み" />

      <div style={{ fontSize: 12, color: '#bbb', fontWeight: 700, marginBottom: 8 }}>
        プリセット
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {PERIOD_PRESETS.map(preset => {
          const r = preset.range(today)
          return (
            <button key={preset.id} type="button" onClick={() => runPreset(preset)} style={{
              padding: '12px 10px', borderRadius: 12,
              border: '1px solid var(--fm-border)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff', textAlign: 'left', cursor: 'pointer',
            }}>
              <div style={{ fontSize: 22 }}>{preset.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{preset.label}</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                {ymdISO(r.start)}〜{ymdISO(r.end)}
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 12, color: '#bbb', fontWeight: 700, marginTop: 24, marginBottom: 8 }}>
        カスタム
      </div>
      <input value={customLabel} onChange={e => setCustomLabel(e.target.value)}
        placeholder="期間の名前 (例: 期末テスト / 修学旅行)" maxLength={40}
        style={inputStyle} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
          style={{ ...inputStyle, flex: 1 }} />
        <span style={{ color: '#888' }}>〜</span>
        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
          style={{ ...inputStyle, flex: 1 }} />
      </div>
      {err && <div style={{ color: '#FF6B6B', fontSize: 12, marginTop: 8 }}>{err}</div>}
      <button type="button" onClick={runCustom} style={{ ...primaryBtn, width: '100%', marginTop: 12 }}>
        この期間を占う
      </button>
    </div>
  )
}

function PeriodResultView(p: ResultActionProps & {
  userName: string
  userBirth: { year: number; month: number; day: number }
  periodLabel: string
  startISO: string
  endISO: string
  catBreed: string
  dogBreed: string
  onBack: () => void
}) {
  const cat = getCatBreed(p.catBreed)
  const dog = getDogBreed(p.dogBreed)
  const reading = useMemo(() => {
    const s = new Date(p.startISO), e = new Date(p.endISO)
    return buildPeriodReading(p.userBirth, s, e)
  }, [p.userBirth, p.startISO, p.endISO])
  const shareText = useMemo(
    () => periodShareText(p.periodLabel, p.userName, reading),
    [p.periodLabel, p.userName, reading],
  )
  const savePayload = useMemo(() => buildPeriodSavePayload(
    { name: p.userName, ...p.userBirth },
    p.periodLabel,
    reading,
  ), [p.userName, p.userBirth, p.periodLabel, reading])
  const cardRef = useRef<HTMLDivElement>(null)

  return (
    <div style={{ padding: '8px 16px 40px' }}>
      <div ref={cardRef} style={resultCardStyle}>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#A29BFE', letterSpacing: 2, marginBottom: 4 }}>
          うらにゃん。 / 期間限定占い
        </div>
        <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 2 }}>
          {p.periodLabel}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#888', marginBottom: 14 }}>
          {reading.startDate} 〜 {reading.endDate} ({reading.days.length} 日間)
        </div>

        {/* ランク */}
        <div style={{
          textAlign: 'center', padding: '14px 0 18px', borderRadius: 16, marginBottom: 14,
          background: 'radial-gradient(circle at 50% 0%, rgba(255,210,74,0.20), transparent 70%)',
        }}>
          <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 6 }}>{reading.avgEmoji}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{reading.avgLabel}</div>
          <div style={{ fontSize: 20, marginTop: 4, letterSpacing: 2 }}>
            <span style={{ color: '#FFD24A' }}>{'★'.repeat(reading.avgRank)}</span>
            <span style={{ color: '#444' }}>{'☆'.repeat(5 - reading.avgRank)}</span>
          </div>
          <div style={{ fontSize: 13, color: '#ddd', marginTop: 8, fontWeight: 700 }}>
            テーマ: {reading.themeHeadline}
          </div>
        </div>

        {/* 掛け合い */}
        <div style={dialogRow}>
          <CatIcon breed={cat} size={32} />
          <div style={bubbleNyan}>
            <div style={bubbleSpeaker}>ニャンじろう</div>
            {reading.nyanLine}
          </div>
        </div>
        <div style={{ ...dialogRow, marginTop: 8 }}>
          <DogIcon breed={dog} size={32} />
          <div style={bubblePochi}>
            <div style={bubbleSpeaker}>ポチ</div>
            {reading.pochiLine}
          </div>
        </div>

        {/* アドバイス */}
        <div style={{
          marginTop: 14, padding: '12px 14px', borderRadius: 12,
          background: 'rgba(94,226,200,0.10)', border: '1px solid rgba(94,226,200,0.30)',
          fontSize: 13, color: '#eee', lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 10, color: '#5EE2C8', fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>
            ADVICE
          </div>
          {reading.advice}
        </div>

        {/* ベスト / ワースト */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          {reading.bestDay && <PeakDayChip title="🏆 ベスト日" tone="good" day={reading.bestDay} />}
          {reading.worstDay && <PeakDayChip title="⚠️ 注意日" tone="bad"  day={reading.worstDay} />}
        </div>

        {/* 日別カレンダー (★) */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: '#A29BFE', fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>
            日別の運勢
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 4,
          }}>
            {reading.days.map(d => (
              <div key={d.date} style={{
                padding: '6px 4px', borderRadius: 6, textAlign: 'center',
                background: d.rank >= 4 ? 'rgba(255,210,74,0.15)' :
                            d.rank <= 2 ? 'rgba(255,107,107,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${d.rank >= 4 ? 'rgba(255,210,74,0.35)' :
                            d.rank <= 2 ? 'rgba(255,107,107,0.30)' : 'rgba(255,255,255,0.08)'}`,
              }}>
                <div style={{ fontSize: 9, color: '#888' }}>
                  {d.date.slice(5).replace('-', '/')}
                </div>
                <div style={{ fontSize: 11, marginTop: 2 }}>
                  <span style={{ color: '#FFD24A' }}>{'★'.repeat(d.rank)}</span>
                  <span style={{ color: '#444' }}>{'☆'.repeat(5 - d.rank)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ShareFooter />
      </div>
      <ResultActions
        shareText={shareText} menu="period" resultSummary={savePayload.result_summary}
        onBack={p.onBack} backLabel="別の期間を選ぶ"
        loggedIn={p.loggedIn}
        savedReadingId={p.savedReadingId} setSavedReadingId={p.setSavedReadingId}
        savePromptOpen={p.savePromptOpen} setSavePromptOpen={p.setSavePromptOpen}
        saveInput={{
          menu: 'period',
          target_names: savePayload.target_names,
          target_birthdates: savePayload.target_birthdates,
          result_summary: savePayload.result_summary,
          result_payload: savePayload.result_payload,
          period_label: p.periodLabel,
          period_start: p.startISO,
          period_end: p.endISO,
        }}
        cardRef={cardRef}
        fileNameBase={`period_${p.periodLabel}`}
      />
    </div>
  )
}

function PeakDayChip(p: {
  title: string
  tone: 'good' | 'bad'
  day: { date: string; rank: number; rel: string }
}) {
  const fg = p.tone === 'good' ? '#5EE2C8' : '#FF6B6B'
  const bg = p.tone === 'good' ? 'rgba(94,226,200,0.10)' : 'rgba(255,107,107,0.10)'
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 12,
      background: bg, border: `1px solid ${fg}55`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: fg, letterSpacing: 1 }}>{p.title}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 4 }}>
        {p.day.date}
      </div>
      <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
        ★{p.day.rank}/5 ・ {p.day.rel}
      </div>
    </div>
  )
}

// ====================================================
// 部品: グループ相性 ピッカー
// ====================================================
function PickGroupView(p: {
  loading: boolean
  loggedIn: boolean
  targets: TargetCard[]
  selectedIds: string[]
  errorMsg: string | null
  onPick: (t: TargetCard) => void
  onClear: () => void
  onRun: () => void
  onAddTarget: () => void
  onEditTarget: (t: TargetCard) => void
  onDeleteTarget: (t: TargetCard) => void
}) {
  const count = p.selectedIds.length
  return (
    <div style={{ padding: '8px 20px 40px' }}>
      <SectionTitle emoji="👥" title="グループ相性" sub={`${GROUP_MIN}〜${GROUP_MAX} 人選んでね`} />
      {p.loading ? <Loading /> : !p.loggedIn ? (
        <div style={inlineHintCard}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
            グループ相性はログインが必要だよ
          </div>
          <div style={{ fontSize: 12, color: '#bbb' }}>
            複数のカードを保存してから組み合わせるので、
            <Link href="/" style={{ color: '#FFD24A' }}>ログイン</Link>してね。
          </div>
        </div>
      ) : (
        <>
          <div style={{
            marginBottom: 14, padding: '10px 14px', borderRadius: 12,
            background: count >= GROUP_MIN
              ? 'linear-gradient(90deg, rgba(94,226,200,0.20), rgba(255,210,74,0.18))'
              : 'rgba(255,255,255,0.04)',
            border: `1px solid ${count >= GROUP_MIN ? '#5EE2C8' : 'var(--fm-border)'}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
              選択中: {count} / {GROUP_MAX}
            </div>
            <div style={{ fontSize: 11, color: '#bbb', flex: 1 }}>
              {count < GROUP_MIN ? `あと ${GROUP_MIN - count} 人選ぼう` : '占う準備OK'}
            </div>
            {count > 0 && (
              <button type="button" onClick={p.onClear} style={smallChipBtn}>クリア</button>
            )}
          </div>
          {p.errorMsg && <div style={{ color: '#FF6B6B', fontSize: 12, marginBottom: 10 }}>{p.errorMsg}</div>}
          <ListHeader title="占い帳" onAdd={p.onAddTarget} />
          <CardList
            targets={p.targets}
            selectedIds={p.selectedIds}
            onTap={p.onPick}
            onEdit={p.onEditTarget}
            onDelete={p.onDeleteTarget}
          />
          <button type="button"
            onClick={p.onRun}
            disabled={count < GROUP_MIN}
            style={{
              ...primaryBtn, width: '100%', marginTop: 16,
              opacity: count < GROUP_MIN ? 0.5 : 1,
              cursor: count < GROUP_MIN ? 'not-allowed' : 'pointer',
            }}>
            {count >= GROUP_MIN ? `${count} 人のグループ相性を見る` : `${GROUP_MIN} 人以上で占える`}
          </button>
        </>
      )}
    </div>
  )
}

// ====================================================
// 部品: グループ相性 結果
// ====================================================
function GroupResultView(p: ResultActionProps & {
  members: TargetCard[]
  catBreed: string
  dogBreed: string
  onBack: () => void
}) {
  const reading = useMemo(
    () => buildGroupCompatReading(p.members.map(m => ({
      name: m.name, year: m.birth_year, month: m.birth_month, day: m.birth_day,
    }))),
    [p.members],
  )
  const shareText = useMemo(
    () => buildGroupShareText(p.members.map(m => m.name), reading),
    [p.members, reading],
  )
  const savePayload = useMemo(() => buildGroupCompatSavePayload(
    p.members.map(m => ({ name: m.name, year: m.birth_year, month: m.birth_month, day: m.birth_day })),
    reading,
  ), [p.members, reading])
  const cardRef = useRef<HTMLDivElement>(null)

  return (
    <div style={{ padding: '8px 16px 40px' }}>
      <div ref={cardRef} style={resultCardStyle}>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#A29BFE', letterSpacing: 2, marginBottom: 4 }}>
          うらにゃん。 / グループ相性 (宿曜)
        </div>
        <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 4 }}>
          調和度 {reading.harmonyScore.toFixed(1)} <span style={{ fontSize: 14, color: '#bbb' }}>/ 5.0</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#FFD24A', marginTop: 2 }}>
          「{reading.harmonyLabel}」
        </div>

        {/* メンバーサマリ */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: '#A29BFE', fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>
            メンバー ({reading.members.length})
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {reading.memberSummaries.map(ms => (
              <div key={ms.index} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 18 }}>{p.members[ms.index]?.emoji ?? '🪞'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ms.name} <span style={{ fontSize: 10, color: '#888' }}>({ms.mansion}宿)</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#FFD24A', marginTop: 2 }}>
                    {ms.role}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#bbb' }}>
                  {ms.avgScore.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ベスト/ワースト */}
        {reading.bestPair && (
          <PairHighlight title="ベストペア" tone="good" pair={reading.bestPair} />
        )}
        {reading.worstPair && reading.worstPair !== reading.bestPair && (
          <PairHighlight title="要注意ペア" tone="bad" pair={reading.worstPair} />
        )}

        {/* 全ペア行列 */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: '#A29BFE', fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>
            全ペア ({reading.pairs.length})
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {reading.pairs.map((pair, idx) => {
              const tone = fortuneColor(pair.template.fortune)
              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ flex: 1, fontSize: 12, color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pair.aName} × {pair.bName}
                  </div>
                  <div style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 6,
                    background: tone.bg, color: tone.fg, fontWeight: 800,
                    border: `1px solid ${tone.fg}66`,
                  }}>{pair.relation}</div>
                  <div style={{ fontSize: 10, color: tone.fg, fontWeight: 700, minWidth: 24, textAlign: 'right' }}>
                    {pair.template.fortune}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <ShareFooter />
      </div>
      <ResultActions
        shareText={shareText} menu="group_compat" resultSummary={savePayload.result_summary}
        onBack={p.onBack} backLabel="メンバーを選び直す"
        loggedIn={p.loggedIn}
        savedReadingId={p.savedReadingId} setSavedReadingId={p.setSavedReadingId}
        savePromptOpen={p.savePromptOpen} setSavePromptOpen={p.setSavePromptOpen}
        saveInput={{
          menu: 'group_compat',
          target_names: savePayload.target_names,
          target_birthdates: savePayload.target_birthdates,
          result_summary: savePayload.result_summary,
          result_payload: savePayload.result_payload,
        }}
        cardRef={cardRef}
        fileNameBase={`group_${p.members.length}nin`}
      />
    </div>
  )
}

function PairHighlight(p: {
  title: string
  tone: 'good' | 'bad'
  pair: import('../../lib/uranyan/groupCompat').PairResult
}) {
  const fg = p.tone === 'good' ? '#5EE2C8' : '#FF6B6B'
  const bg = p.tone === 'good' ? 'rgba(94,226,200,0.10)' : 'rgba(255,107,107,0.10)'
  return (
    <div style={{
      marginTop: 14, padding: '12px 14px', borderRadius: 12,
      background: bg, border: `1px solid ${fg}55`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: fg, letterSpacing: 1 }}>{p.title}</span>
        <span style={{ fontSize: 10, color: '#888' }}>{p.pair.template.fortune}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
        {p.pair.aName} × {p.pair.bName} → 「{p.pair.relation}」
      </div>
      <div style={{ fontSize: 12, color: '#ddd', marginTop: 4 }}>
        {p.pair.template.headline}
      </div>
    </div>
  )
}

// ====================================================
// 部品: 保存モーダル (期間タグ付きで履歴に残す)
// ====================================================
function SavePromptModal(p: {
  input: SaveInput
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const [periodLabel, setPeriodLabel] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const onSave = useCallback(async () => {
    setBusy(true); setErr(null)
    try {
      const id = await saveReading({
        ...p.input,
        period_label: periodLabel.trim() || null,
        period_start: periodStart || null,
        period_end: periodEnd || null,
      })
      if (!id) { setErr('保存に失敗したよ'); setBusy(false); return }
      trackUranyanSaved(p.input.menu, !!(periodLabel || periodEnd))
      p.onSaved(id)
    } finally { setBusy(false) }
  }, [p, periodLabel, periodStart, periodEnd])

  return (
    <ModalShell onClose={p.onClose}>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 4 }}>
        履歴に残す
      </div>
      <div style={{ fontSize: 12, color: '#bbb', marginBottom: 16 }}>
        後で「当たってたか」をレビューできるよ。
        期間を付けると、終了後に振り返り通知が出るよ。
      </div>
      <div style={fieldLabel}>期間ラベル (任意)</div>
      <input value={periodLabel} onChange={e => setPeriodLabel(e.target.value)}
        placeholder="例: 夏休み2026 / テスト期間 / 推し活運" maxLength={40}
        style={inputStyle} />
      <div style={fieldLabel}>占う期間 (任意)</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
          style={{ ...inputStyle, flex: 1 }} />
        <span style={{ color: '#888' }}>〜</span>
        <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
          style={{ ...inputStyle, flex: 1 }} />
      </div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
        終了日を過ぎると、履歴で「レビューする」ボタンが出るよ。
      </div>
      {err && <div style={{ color: '#FF6B6B', fontSize: 12, marginTop: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button type="button" onClick={p.onClose} disabled={busy} style={{ ...secondaryBtn, flex: 1 }}>
          キャンセル
        </button>
        <button type="button" onClick={onSave} disabled={busy} style={{ ...primaryBtn, flex: 2 }}>
          {busy ? '保存中…' : '残す'}
        </button>
      </div>
    </ModalShell>
  )
}

// ====================================================
// 部品: レビューモーダル (★1〜5 + コメント)
// ====================================================
function ReviewModal(p: {
  row: ReadingRow
  onClose: () => void
  onSubmit: (id: string, rating: number, text: string) => Promise<boolean>
}) {
  const [rating, setRating] = useState<number>(p.row.rating ?? 0)
  const [text, setText] = useState(p.row.review_text ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = useCallback(async () => {
    if (rating < 1) { setErr('★を選んでね'); return }
    setBusy(true); setErr(null)
    const ok = await p.onSubmit(p.row.id, rating, text)
    if (!ok) { setErr('保存に失敗したよ'); setBusy(false) }
  }, [p, rating, text])

  return (
    <ModalShell onClose={p.onClose}>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 4 }}>
        この占い、当たってた?
      </div>
      <div style={{ fontSize: 12, color: '#bbb', marginBottom: 16 }}>
        {p.row.target_names.join(' × ')} ・ {p.row.period_label || '占ったとき'}
      </div>
      <div style={fieldLabel}>評価</div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '4px 0 8px' }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n}つ星`}
            style={{
              fontSize: 30, padding: '4px 8px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: n <= rating ? '#FFD24A' : '#555',
            }}>★</button>
        ))}
      </div>
      <div style={fieldLabel}>コメント (任意)</div>
      <textarea value={text} onChange={e => setText(e.target.value)}
        placeholder="どこが当たった? / どこが外れた? 自由にどうぞ"
        maxLength={500}
        style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
      {err && <div style={{ color: '#FF6B6B', fontSize: 12, marginTop: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button type="button" onClick={p.onClose} disabled={busy} style={{ ...secondaryBtn, flex: 1 }}>
          後でやる
        </button>
        <button type="button" onClick={submit} disabled={busy} style={{ ...primaryBtn, flex: 2 }}>
          {busy ? '送信中…' : 'レビューを残す'}
        </button>
      </div>
    </ModalShell>
  )
}

// ====================================================
// 部品: 履歴一覧
// ====================================================
function HistoryView(p: {
  rows: ReadingRow[] | null
  tab: 'all' | 'pending'
  setTab: (t: 'all' | 'pending') => void
  onOpen: (r: ReadingRow) => void
  onReview: (r: ReadingRow) => void
  onDelete: (id: string) => void
}) {
  if (p.rows === null) return (
    <div style={{ padding: '8px 20px' }}>
      <SectionTitle emoji="📜" title="占い履歴" />
      <Loading />
    </div>
  )
  const pendingRows = p.rows.filter(r => r.rating === null && isReviewable(r))
  const visibleRows = p.tab === 'pending' ? pendingRows : p.rows
  return (
    <div style={{ padding: '8px 20px 40px' }}>
      <SectionTitle emoji="📜" title="占い履歴" sub={`${p.rows.length} 件 (うちレビュー待ち ${pendingRows.length})`} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button type="button" onClick={() => p.setTab('all')} style={{
          ...chipStyle, flex: 1,
          background: p.tab === 'all' ? 'rgba(108,92,231,0.30)' : 'rgba(255,255,255,0.04)',
          borderColor: p.tab === 'all' ? '#A29BFE' : 'var(--fm-border)',
          color: p.tab === 'all' ? '#fff' : '#bbb', textAlign: 'center',
        }}>すべて</button>
        <button type="button" onClick={() => p.setTab('pending')} style={{
          ...chipStyle, flex: 1,
          background: p.tab === 'pending' ? 'rgba(255,210,74,0.20)' : 'rgba(255,255,255,0.04)',
          borderColor: p.tab === 'pending' ? '#FFD24A' : 'var(--fm-border)',
          color: p.tab === 'pending' ? '#fff' : '#bbb', textAlign: 'center',
        }}>レビュー待ち {pendingRows.length > 0 ? `(${pendingRows.length})` : ''}</button>
      </div>
      {visibleRows.length === 0 ? (
        <div style={{
          padding: 24, borderRadius: 12, textAlign: 'center',
          background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--fm-border)',
          color: '#888', fontSize: 13,
        }}>
          {p.tab === 'pending'
            ? 'レビューできる占いはまだないよ\n期間ありで占ったら、終了後にここに並ぶよ'
            : '占い履歴はまだないよ\n結果画面で「履歴に残す」を押すと、ここに並ぶよ'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {visibleRows.map(r => (
            <HistoryRow key={r.id} row={r}
              onOpen={() => p.onOpen(r)}
              onReview={() => p.onReview(r)}
              onDelete={() => p.onDelete(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryRow(p: {
  row: ReadingRow
  onOpen: () => void
  onReview: () => void
  onDelete: () => void
}) {
  const r = p.row
  const menuLabel = r.menu === 'life' ? '🔮 天命'
    : r.menu === 'compat' ? '💞 相性'
    : r.menu === 'period' ? '📅 期間'
    : '👥 グループ'
  const reviewable = isReviewable(r)
  const reviewed = r.rating !== null
  return (
    <div style={{
      padding: 12, borderRadius: 12,
      border: `1px solid ${reviewed ? '#5EE2C8' : reviewable ? '#FFD24A' : 'var(--fm-border)'}`,
      background: reviewed
        ? 'rgba(94,226,200,0.06)'
        : reviewable ? 'rgba(255,210,74,0.06)' : 'rgba(255,255,255,0.03)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 10, padding: '2px 6px', borderRadius: 6,
          background: 'rgba(255,255,255,0.06)', color: '#ddd', fontWeight: 700,
        }}>{menuLabel}</span>
        <span style={{ fontSize: 11, color: '#888' }}>
          {new Date(r.created_at).toLocaleDateString('ja-JP')}
        </span>
        {reviewed && (
          <span style={{ marginLeft: 'auto', fontSize: 13 }}>
            <span style={{ color: '#FFD24A' }}>{'★'.repeat(r.rating!)}</span>
            <span style={{ color: '#444' }}>{'☆'.repeat(5 - r.rating!)}</span>
          </span>
        )}
      </div>
      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.target_names.join(' × ')}
      </div>
      <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
        結果: {r.result_summary}
        {r.period_label ? ` ・ ${r.period_label}` : ''}
        {r.period_end ? ` (〜${r.period_end})` : ''}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button type="button" onClick={p.onOpen} style={{
          ...secondaryBtn, flex: 1, padding: '8px 10px', fontSize: 12,
        }}>結果を見る</button>
        {!reviewed && reviewable && (
          <button type="button" onClick={p.onReview} style={{
            ...primaryBtn, flex: 1, padding: '8px 10px', fontSize: 12,
            background: 'linear-gradient(90deg, #FFD24A, #FF7AAE)',
          }}>レビューする</button>
        )}
        <button type="button" onClick={p.onDelete} style={{
          ...iconBtn, width: 36, height: 36,
        }} aria-label="削除">🗑</button>
      </div>
    </div>
  )
}

// ====================================================
// 部品: モーダルシェル (オーバーレイ)
// ====================================================
function ModalShell(p: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={p.onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'linear-gradient(160deg, #20122E 0%, #1A1A2E 100%)',
        borderRadius: 18, padding: 20,
        border: '1px solid rgba(255,255,255,0.10)',
        width: '100%', maxWidth: 420, maxHeight: '85dvh', overflowY: 'auto',
      }}>
        {p.children}
      </div>
    </div>
  )
}

function buildGroupShareText(names: string[], r: GroupCompatReading): string {
  const bp = r.bestPair
  return `👥 #うらにゃん  グループ相性 (宿曜)\n` +
    `${names.join(' × ')}\n` +
    `→ 調和度 ${r.harmonyScore.toFixed(1)}/5 「${r.harmonyLabel}」\n` +
    (bp ? `🏆 ベスト: ${bp.aName}×${bp.bName} (${bp.relation})` : '')
}

// ====================================================
// スタイル
// ====================================================
const pageStyle: React.CSSProperties = {
  minHeight: '100dvh',
  background: 'linear-gradient(180deg, #0a0612 0%, #08090d 100%)',
  color: 'var(--fm-text)',
  paddingBottom: 'env(safe-area-inset-bottom)',
}

const topBarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(8,9,13,0.85)',
  backdropFilter: 'blur(10px)',
  position: 'sticky', top: 0, zIndex: 10,
}

const topBackBtn: React.CSSProperties = {
  background: 'transparent', border: 'none',
  color: '#bbb', fontSize: 13, padding: '6px 8px', cursor: 'pointer',
  textDecoration: 'none', width: 64, textAlign: 'left',
}

const heroStyle: React.CSSProperties = {
  marginTop: 16, padding: '20px 16px 18px', borderRadius: 18,
  background: 'radial-gradient(circle at 50% 0%, rgba(195,116,255,0.25), transparent 60%), linear-gradient(180deg, rgba(255,122,174,0.10), rgba(108,92,231,0.06))',
  border: '1px solid rgba(255,122,174,0.20)',
}

const heroAvatar: React.CSSProperties = {
  width: 56, height: 56, borderRadius: '50%',
  background: 'rgba(255,255,255,0.06)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 32, border: '1px solid rgba(255,255,255,0.10)',
}

const menuCardLife: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14,
  padding: '18px 16px', borderRadius: 16,
  background: 'linear-gradient(135deg, rgba(255,210,74,0.20), rgba(255,122,174,0.12))',
  border: '1px solid rgba(255,210,74,0.30)',
  cursor: 'pointer',
}

const menuCardCompat: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14,
  padding: '18px 16px', borderRadius: 16,
  background: 'linear-gradient(135deg, rgba(195,116,255,0.20), rgba(94,226,200,0.12))',
  border: '1px solid rgba(195,116,255,0.30)',
  cursor: 'pointer',
}

const menuCardGroup: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14,
  padding: '18px 16px', borderRadius: 16,
  background: 'linear-gradient(135deg, rgba(94,226,200,0.20), rgba(108,169,255,0.14))',
  border: '1px solid rgba(94,226,200,0.30)',
  cursor: 'pointer',
}

const menuCardPeriod: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14,
  padding: '18px 16px', borderRadius: 16,
  background: 'linear-gradient(135deg, rgba(255,122,174,0.20), rgba(255,159,28,0.14))',
  border: '1px solid rgba(255,122,174,0.30)',
  cursor: 'pointer',
}

const menuCardFashion: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14,
  padding: '18px 16px', borderRadius: 16,
  background: 'linear-gradient(135deg, rgba(195,116,255,0.20), rgba(255,210,74,0.12))',
  border: '1px solid rgba(195,116,255,0.30)',
  cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
  color: 'var(--fm-text)', fontSize: 15, boxSizing: 'border-box',
}

const fieldLabel: React.CSSProperties = {
  fontSize: 12, color: '#bbb', fontWeight: 700, marginTop: 16, marginBottom: 6,
}

const primaryBtn: React.CSSProperties = {
  padding: '12px 16px', borderRadius: 12, border: 'none',
  background: 'linear-gradient(90deg, #C374FF, #FF7AAE)',
  color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
}

const primaryBtnSmall: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 10, border: 'none',
  background: 'linear-gradient(90deg, #C374FF, #FF7AAE)',
  color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer',
}

const secondaryBtn: React.CSSProperties = {
  padding: '12px 16px', borderRadius: 12,
  border: '1px solid var(--fm-border)', background: 'rgba(255,255,255,0.04)',
  color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
}

const smallChipBtn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
}

const chipStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 18,
  border: '1px solid var(--fm-border)',
  fontSize: 12, cursor: 'pointer',
}

const iconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8,
  border: '1px solid var(--fm-border)',
  background: 'rgba(255,255,255,0.04)',
  color: '#ccc', fontSize: 13, cursor: 'pointer',
}

const targetCardStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'stretch',
  padding: 12, borderRadius: 14,
  border: '1px solid var(--fm-border)',
  background: 'rgba(255,255,255,0.03)',
  transition: 'all 0.15s ease',
}

const inlineHintCard: React.CSSProperties = {
  marginTop: 8, padding: 16, borderRadius: 14,
  border: '1px dashed rgba(195,116,255,0.40)',
  background: 'rgba(195,116,255,0.08)',
}

const emojiPickerBtn: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 10,
  border: '1px solid var(--fm-border)',
  background: 'rgba(255,255,255,0.04)',
  fontSize: 22, cursor: 'pointer',
}

const breedPickerBtn: React.CSSProperties = {
  padding: '12px 6px', borderRadius: 12,
  border: '1px solid var(--fm-border)',
  background: 'rgba(255,255,255,0.03)',
  textAlign: 'center', cursor: 'pointer',
}

const dialogRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 8,
}

const bubbleNyan: React.CSSProperties = {
  flex: 1, padding: '10px 12px', borderRadius: 12,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  fontSize: 13, color: '#eee', lineHeight: 1.55,
}

const bubblePochi: React.CSSProperties = {
  flex: 1, padding: '10px 12px', borderRadius: 12,
  background: 'rgba(255,210,74,0.08)',
  border: '1px solid rgba(255,210,74,0.20)',
  fontSize: 13, color: '#fff5d8', lineHeight: 1.55,
}

const bubbleSpeaker: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#aaa',
  marginBottom: 4, letterSpacing: 0.5,
}

const resultCardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, #20122E 0%, #1A1A2E 60%, #2A1535 100%)',
  borderRadius: 18, padding: '20px 18px',
  border: '1px solid rgba(255,255,255,0.08)',
}
