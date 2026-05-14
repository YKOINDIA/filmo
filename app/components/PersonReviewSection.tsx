'use client'

/**
 * 人物 (監督・俳優・脚本家) へのレビュー表示・投稿コンポーネント。
 * PersonDetail モーダル / 将来的に /people/[id] ページ内のクライアント領域に埋め込む。
 *
 * 作品レビュー (WorkDetail 内) のロジックをほぼ踏襲。主な相違点:
 *  - has_spoiler は無し (人物にネタバレ概念がない)
 *  - 1 ユーザー 1 人物につき 1 レビュー (UNIQUE 制約)
 *  - 通報は target_type='person_review'
 *  - 集計 (avg, count) は親が SSR で出す。投稿後に楽観更新する。
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addPoints, POINT_CONFIG, checkDailyLikeLimit, incrementDailyLikeCount } from '../lib/points'
import { showToast } from '../lib/toast'
import { trackPersonReviewPosted } from '../lib/analytics'
import ReportModal from './ReportModal'
import StarRating from './StarRating'

interface PersonReview {
  id: string
  user_id: string
  score: number | null
  body: string | null
  is_draft: boolean
  likes_count: number
  created_at: string
  users?: { name: string; avatar_url: string | null } | null
  liked_by_me?: boolean
}

interface Props {
  personId: number
  personName: string
  /** 未ログインなら空文字を渡す。レビュー投稿UIは出さない */
  userId: string
  /** ログインを促す共通フックがあれば渡す。なければ alert */
  onRequireAuth?: () => void
}

const BODY_MAX = 5000

export default function PersonReviewSection({ personId, personName, userId, onRequireAuth }: Props) {
  const [reviews, setReviews] = useState<PersonReview[]>([])
  const [loading, setLoading] = useState(true)
  const [myReview, setMyReview] = useState<PersonReview | null>(null)
  const [draft, setDraft] = useState<{ score: number | null; body: string }>({ score: null, body: '' })
  const [submitting, setSubmitting] = useState(false)
  const [sortMode, setSortMode] = useState<'newest' | 'likes' | 'score_high' | 'score_low'>('likes')
  const [reportTargetId, setReportTargetId] = useState<string | null>(null)
  const [reviewJustSaved, setReviewJustSaved] = useState(false)

  const isAuthed = !!userId

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const { data: rows } = await supabase
        .from('person_reviews')
        .select('id, user_id, score, body, is_draft, likes_count, created_at, users:user_id(name, avatar_url)')
        .eq('person_id', personId)
        .order('created_at', { ascending: false })
        .limit(200)

      const all = (rows || []) as unknown as PersonReview[]

      // 自分のレビュー (下書き含む) を分離
      const mine = isAuthed ? all.find(r => r.user_id === userId) ?? null : null
      const others = all.filter(r => !r.is_draft && r.user_id !== userId)

      // liked_by_me を一括ロード
      let likedSet = new Set<string>()
      if (isAuthed && others.length > 0) {
        const { data: likes } = await supabase
          .from('person_review_likes')
          .select('person_review_id')
          .eq('user_id', userId)
          .in('person_review_id', others.map(r => r.id))
        likedSet = new Set(((likes || []) as { person_review_id: string }[]).map(l => l.person_review_id))
      }

      setMyReview(mine)
      if (mine) {
        setDraft({ score: mine.score, body: mine.body || '' })
      }
      setReviews(others.map(r => ({ ...r, liked_by_me: likedSet.has(r.id) })))
    } catch (e) {
      console.error('fetchPersonReviews failed:', e)
    } finally {
      setLoading(false)
    }
  }, [personId, userId, isAuthed])

  useEffect(() => { fetchAll() }, [fetchAll])

  const sorted = (() => {
    const arr = [...reviews]
    switch (sortMode) {
      case 'newest':
        return arr.sort((a, b) => b.created_at.localeCompare(a.created_at))
      case 'likes':
        return arr.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0) || b.created_at.localeCompare(a.created_at))
      case 'score_high':
        return arr.sort((a, b) => (b.score || 0) - (a.score || 0))
      case 'score_low':
        return arr.sort((a, b) => (a.score || 0) - (b.score || 0))
      default:
        return arr
    }
  })()

  const handleSave = async (isDraft: boolean) => {
    if (!isAuthed) {
      onRequireAuth?.()
      return
    }
    const body = draft.body.trim()
    if (!body && draft.score == null) {
      showToast('星評価か本文のどちらかを入力してください')
      return
    }
    if (body.length > BODY_MAX) {
      showToast(`本文は ${BODY_MAX} 文字以内にしてください`)
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        user_id: userId,
        person_id: personId,
        score: draft.score,
        body: body || null,
        is_draft: isDraft,
      }
      let saved: PersonReview | null = null
      if (myReview) {
        const { data, error } = await supabase
          .from('person_reviews')
          .update(payload)
          .eq('id', myReview.id)
          .select('id, user_id, score, body, is_draft, likes_count, created_at, users:user_id(name, avatar_url)')
          .single()
        if (error) throw error
        saved = data as unknown as PersonReview
      } else {
        const { data, error } = await supabase
          .from('person_reviews')
          .insert(payload)
          .select('id, user_id, score, body, is_draft, likes_count, created_at, users:user_id(name, avatar_url)')
          .single()
        if (error) throw error
        saved = data as unknown as PersonReview
        // 初投稿のみポイント付与 (編集では加算しない)
        if (!isDraft) {
          const pts = body.length >= 100 ? POINT_CONFIG.REVIEW_LONG : POINT_CONFIG.REVIEW_SHORT
          await addPoints(userId, pts, '監督レビュー投稿')
        }
      }

      setMyReview(saved)
      trackPersonReviewPosted(personId, draft.score ?? undefined, isDraft)
      showToast(isDraft ? '下書きを保存しました' : 'レビューを投稿しました')
      setReviewJustSaved(true)
      setTimeout(() => setReviewJustSaved(false), 2000)
    } catch (e) {
      console.error('save person review failed:', e)
      showToast('保存に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!myReview) return
    if (!confirm('レビューを削除しますか?')) return
    try {
      await supabase.from('person_reviews').delete().eq('id', myReview.id)
      setMyReview(null)
      setDraft({ score: null, body: '' })
      showToast('レビューを削除しました')
    } catch {
      showToast('削除に失敗しました')
    }
  }

  const handleToggleLike = async (review: PersonReview) => {
    if (!isAuthed) { onRequireAuth?.(); return }
    if (review.user_id === userId) return // self-like 禁止
    const liked = !!review.liked_by_me
    // 楽観更新
    setReviews(prev => prev.map(r => r.id === review.id ? {
      ...r,
      liked_by_me: !liked,
      likes_count: (r.likes_count || 0) + (liked ? -1 : 1),
    } : r))

    try {
      if (liked) {
        await supabase
          .from('person_review_likes')
          .delete()
          .eq('user_id', userId)
          .eq('person_review_id', review.id)
        await supabase
          .from('person_reviews')
          .update({ likes_count: Math.max(0, (review.likes_count || 0) - 1) })
          .eq('id', review.id)
      } else {
        const ok = await checkDailyLikeLimit(userId)
        if (!ok) {
          showToast('1日のいいね上限に達しました')
          // ロールバック
          setReviews(prev => prev.map(r => r.id === review.id ? { ...r, liked_by_me: false, likes_count: review.likes_count } : r))
          return
        }
        await supabase.from('person_review_likes').insert({
          user_id: userId,
          person_review_id: review.id,
        })
        await supabase
          .from('person_reviews')
          .update({ likes_count: (review.likes_count || 0) + 1 })
          .eq('id', review.id)
        await incrementDailyLikeCount(userId)
        await addPoints(userId, POINT_CONFIG.LIKE_SEND, 'いいね送信(監督レビュー)')
        await addPoints(review.user_id, POINT_CONFIG.LIKE_RECEIVE, 'いいね受取(監督レビュー)')
      }
    } catch (e) {
      console.error('like toggle failed:', e)
      // ロールバック
      setReviews(prev => prev.map(r => r.id === review.id ? review : r))
    }
  }

  return (
    <section style={{ padding: '0 16px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          💬 監督レビュー
          {reviews.length + (myReview && !myReview.is_draft ? 1 : 0) > 0 && (
            <span style={{ fontSize: 13, color: 'var(--fm-text-muted)', fontWeight: 500 }}>
              {reviews.length + (myReview && !myReview.is_draft ? 1 : 0)}件
            </span>
          )}
        </h3>
      </div>

      {/* 自分のレビュー composer */}
      <div style={{
        padding: 14, borderRadius: 10, marginBottom: 16,
        background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--fm-text-muted)', marginBottom: 8 }}>
          {personName} について{myReview ? '(編集中)' : 'あなたのレビュー'}
        </div>
        <StarRating
          value={draft.score}
          onChange={s => setDraft(d => ({ ...d, score: s }))}
          onClear={() => setDraft(d => ({ ...d, score: null }))}
          readonly={!isAuthed}
          size={22}
          showValue
        />
        <textarea
          value={draft.body}
          onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
          placeholder={isAuthed ? `${personName} の作風・印象などを書いてみよう` : 'ログインするとレビューを書けます'}
          maxLength={BODY_MAX}
          disabled={!isAuthed}
          rows={4}
          style={{
            width: '100%', marginTop: 10, padding: 10, borderRadius: 8,
            background: 'var(--fm-bg)', border: '1px solid var(--fm-border)',
            color: 'var(--fm-text)', fontSize: 14, lineHeight: 1.6,
            resize: 'vertical', fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
            {draft.body.length} / {BODY_MAX}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {myReview && (
              <button onClick={handleDelete} disabled={submitting}
                style={btnStyle('ghost')}>
                削除
              </button>
            )}
            <button onClick={() => handleSave(true)} disabled={submitting || !isAuthed}
              style={btnStyle('ghost')}>
              下書き保存
            </button>
            <button onClick={() => handleSave(false)} disabled={submitting || !isAuthed}
              style={btnStyle('primary')}>
              {myReview && !myReview.is_draft ? '更新する' : '投稿する'}
            </button>
          </div>
        </div>
        {reviewJustSaved && (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--fm-accent)' }}>
            ✓ 保存しました
          </div>
        )}
      </div>

      {/* 公開レビュー一覧 */}
      {reviews.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {(['likes', 'newest', 'score_high', 'score_low'] as const).map(m => (
            <button
              key={m}
              onClick={() => setSortMode(m)}
              style={{
                padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: sortMode === m ? 'var(--fm-accent)' : 'var(--fm-bg-card)',
                color: sortMode === m ? '#fff' : 'var(--fm-text-sub)',
                border: '1px solid var(--fm-border)',
              }}
            >
              {m === 'likes' ? '人気順' : m === 'newest' ? '新着順' : m === 'score_high' ? '高評価順' : '低評価順'}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--fm-text-muted)', fontSize: 13 }}>読み込み中...</div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--fm-text-muted)', fontSize: 13 }}>
          まだ他のユーザーのレビューはありません
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(r => (
            <article key={r.id} style={{
              padding: 12, borderRadius: 10,
              background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
            }}>
              <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                {r.users?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.users.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--fm-bg-secondary)' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fm-text)' }}>{r.users?.name || 'User'}</div>
                  <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>{r.created_at.slice(0, 10)}</div>
                </div>
                {r.score != null && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <StarRating value={r.score} size={14} readonly />
                    <span style={{ fontSize: 12, color: 'var(--fm-star)', fontWeight: 700 }}>{r.score.toFixed(1)}</span>
                  </span>
                )}
                <button
                  onClick={() => setReportTargetId(r.id)}
                  aria-label="通報"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fm-text-muted)', fontSize: 14, padding: 4 }}
                >
                  ⋯
                </button>
              </header>
              {r.body && (
                <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--fm-text-sub)', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {r.body}
                </p>
              )}
              <button
                onClick={() => handleToggleLike(r)}
                disabled={r.user_id === userId}
                style={{
                  marginTop: 8, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  background: r.liked_by_me ? 'rgba(231, 76, 60, 0.15)' : 'transparent',
                  color: r.liked_by_me ? '#e74c3c' : 'var(--fm-text-muted)',
                  border: '1px solid ' + (r.liked_by_me ? '#e74c3c44' : 'var(--fm-border)'),
                  cursor: r.user_id === userId ? 'default' : 'pointer',
                }}
              >
                {r.liked_by_me ? '♥' : '♡'} {r.likes_count || 0}
              </button>
            </article>
          ))}
        </div>
      )}

      {reportTargetId && (
        <ReportModal
          targetType="person_review"
          targetId={reportTargetId}
          onClose={() => setReportTargetId(null)}
        />
      )}
    </section>
  )
}

// ── small UI helpers ────────────────────────────────────────────────────────

function btnStyle(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') {
    return {
      padding: '7px 14px', borderRadius: 8, border: 'none',
      background: 'var(--fm-accent)', color: '#fff',
      fontSize: 13, fontWeight: 600, cursor: 'pointer',
    }
  }
  return {
    padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: 'transparent', color: 'var(--fm-text-sub)',
    border: '1px solid var(--fm-border)', cursor: 'pointer',
  }
}
