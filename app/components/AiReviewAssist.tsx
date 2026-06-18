'use client'

import { useState } from 'react'

// ============================================================
// AI レビュー下書きアシスト
// ------------------------------------------------------------
// 「刺さった点」をタップ選択 + 任意の一言メモ → AI がカジュアルな短評の
// 初稿を生成し、親(レビュー本文)にセットする。ユーザーは少し直すだけ。
// 星評価・誰と見たかは親(WorkDetail)が持つ値を受け取って一緒に渡す。
// ============================================================

type WatchContext = 'solo' | 'family' | 'couple' | 'friends'

// 「何が刺さった？」チップ。複数選択可。
const ASPECT_OPTIONS = [
  'ストーリー', '映像美', '演技', '音楽', 'アクション',
  '感動', '笑い', 'どんでん返し', 'キャラクター', '世界観',
  'テンポ', 'セリフ', '雰囲気', '余韻',
] as const

interface Props {
  title: string
  year?: string
  mediaType: 'movie' | 'tv'
  genres: string[]
  /** 親が持つ現在の★評価 (0 = 未設定) */
  score: number
  /** 親が持つ「誰と見た」 */
  watchContext: WatchContext | null
  /** 親の「ネタバレあり」チェック状態 */
  allowSpoiler: boolean
  /** 生成された本文を親の textarea に流し込む */
  onGenerated: (text: string) => void
  /** 既に本文が入力済みか (上書き確認用) */
  hasExistingBody: boolean
}

export default function AiReviewAssist({
  title, year, mediaType, genres, score, watchContext, allowSpoiler,
  onGenerated, hasExistingBody,
}: Props) {
  const [open, setOpen] = useState(false)
  const [aspects, setAspects] = useState<string[]>([])
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleAspect = (a: string) => {
    setAspects(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : prev.length >= 6 ? prev : [...prev, a],
    )
  }

  const handleGenerate = async () => {
    if (loading) return
    if (hasExistingBody) {
      const ok = window.confirm('入力中の感想をAIの下書きで上書きします。よろしいですか?')
      if (!ok) return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, year, mediaType, genres,
          score: score > 0 ? score : null,
          watchContext,
          aspects,
          memo,
          allowSpoiler,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.text) {
        throw new Error(data.error || '生成に失敗しました')
      }
      onGenerated(data.text)
      setOpen(false)
    } catch (e) {
      setError((e as Error).message || '生成に失敗しました。少し待って再試行してください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      border: '1px solid rgba(108,92,231,0.35)',
      background: 'rgba(108,92,231,0.07)',
      borderRadius: 12, padding: open ? '12px 14px' : '10px 14px',
    }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--fm-accent)', fontSize: 14, fontWeight: 700,
          }}
        >
          <span style={{ fontSize: 18 }}>✨</span>
          <span>AIで下書きを作る</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: 'var(--fm-text-sub)' }}>
            選ぶだけ →
          </span>
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>✨</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fm-text)' }}>
              AIで下書きを作る
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
              style={{
                marginLeft: 'auto', background: 'transparent', border: 'none',
                cursor: 'pointer', color: 'var(--fm-text-muted)', fontSize: 18, lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* 刺さった点 */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 8 }}>
              何が刺さった?（複数OK・任意）
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ASPECT_OPTIONS.map(a => {
                const active = aspects.includes(a)
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAspect(a)}
                    style={{
                      padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                      background: active ? 'var(--fm-accent)' : 'transparent',
                      color: active ? '#fff' : 'var(--fm-text-sub)',
                      border: `1px solid ${active ? 'var(--fm-accent)' : 'var(--fm-border)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {a}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 一言メモ */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 6 }}>
              一言メモ（任意・あればAIが最優先で活かします）
            </div>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              maxLength={120}
              placeholder="例: 終盤泣いた / 主役がハマり役"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 12px', borderRadius: 8, fontSize: 13,
                background: 'var(--fm-bg)', color: 'var(--fm-text)',
                border: '1px solid var(--fm-border)',
              }}
            />
          </div>

          {/* 現在の評価ヒント */}
          <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
            {score > 0 ? `★${score.toFixed(1)}` : '★未設定'}
            {watchContext ? ' ・ 鑑賞シーンを反映' : ''}
            {' '}を反映して生成します
          </div>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--fm-danger)' }}>{error}</div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            style={{
              padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: 'var(--fm-accent)', color: '#fff', border: 'none',
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? '生成中…' : '✨ この内容で下書き生成'}
          </button>
        </div>
      )}
    </div>
  )
}
