'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { isAdminEmail } from '../../lib/adminAuth'

// ============================================================
// うらにゃん。品質管理画面
// ============================================================
// 低評価が多いテンプレパターンを上から並べ、改善対象を特定する。
// 詳細を開くと、個別レビュー (rating + コメント) を読める。
//
// データソース:
//   - admin_uranyan_low_rated_summary(p_min_samples, p_max_avg)
//   - admin_uranyan_pattern_reviews(p_menu, p_result_summary, p_limit)
// どちらも SECURITY DEFINER。RLS をバイパスするが、ここで isAdminEmail で
// クライアント側にも認可チェックを置いて二重防衛とする。

interface LowRatedRow {
  menu: 'life' | 'compat' | 'group_compat'
  result_summary: string
  total_reviews: number
  avg_rating: number
  low_count: number
  latest_reviewed: string | null
}

interface PatternReview {
  id: string
  user_id: string
  target_names: string[]
  rating: number
  review_text: string | null
  reviewed_at: string
  created_at: string
  period_label: string | null
}

const MENU_LABEL: Record<LowRatedRow['menu'], string> = {
  life: '🔮 天命トリセツ',
  compat: '💞 相性 (2人)',
  group_compat: '👥 グループ相性',
}

export default function UranyanQualityPage() {
  const [authState, setAuthState] = useState<'loading' | 'denied' | 'ok'>('loading')
  const [rows, setRows] = useState<LowRatedRow[]>([])
  const [loading, setLoading] = useState(false)
  const [minSamples, setMinSamples] = useState(3)
  const [maxAvg, setMaxAvg] = useState(3.0)
  const [selected, setSelected] = useState<LowRatedRow | null>(null)
  const [detail, setDetail] = useState<PatternReview[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => { (async () => {
    const { data } = await supabase.auth.getSession()
    const email = data.session?.user?.email ?? ''
    setAuthState(isAdminEmail(email) ? 'ok' : 'denied')
  })() }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .rpc('admin_uranyan_low_rated_summary', { p_min_samples: minSamples, p_max_avg: maxAvg })
      if (error) { console.error(error); setRows([]); return }
      setRows((data ?? []) as LowRatedRow[])
    } finally { setLoading(false) }
  }, [minSamples, maxAvg])

  useEffect(() => {
    if (authState === 'ok') fetchRows()
  }, [authState, fetchRows])

  const openDetail = useCallback(async (row: LowRatedRow) => {
    setSelected(row)
    setDetail([])
    setDetailLoading(true)
    try {
      const { data, error } = await supabase
        .rpc('admin_uranyan_pattern_reviews', {
          p_menu: row.menu, p_result_summary: row.result_summary, p_limit: 50,
        })
      if (error) { console.error(error); return }
      setDetail((data ?? []) as PatternReview[])
    } finally { setDetailLoading(false) }
  }, [])

  if (authState === 'loading') {
    return <Shell><div style={{ color: '#888' }}>読み込み中…</div></Shell>
  }
  if (authState === 'denied') {
    return <Shell>
      <div style={{ color: '#FF6B6B' }}>管理者のみアクセス可能です。</div>
      <Link href="/" style={{ color: '#FFD24A', display: 'inline-block', marginTop: 16 }}>← ホームへ</Link>
    </Shell>
  }

  return (
    <Shell>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/admin" style={{ color: '#bbb', fontSize: 13, textDecoration: 'none' }}>← /admin</Link>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0 }}>
          うらにゃん。品質管理
        </h1>
      </div>
      <div style={{ fontSize: 12, color: '#bbb', marginBottom: 16, lineHeight: 1.6 }}>
        ユーザーが「後日レビュー」で低評価をつけた占いテンプレを集計。
        平均 {maxAvg.toFixed(1)} 未満かつサンプル {minSamples} 件以上のパターンが
        改善対象として並ぶ。
      </div>

      {/* フィルタ */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        padding: 12, borderRadius: 10,
        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--fm-border)',
        marginBottom: 16,
      }}>
        <label style={{ fontSize: 12, color: '#ddd' }}>
          最低サンプル数
          <input type="number" min={1} max={100} value={minSamples}
            onChange={e => setMinSamples(Math.max(1, parseInt(e.target.value, 10) || 1))}
            style={{ ...numInputStyle, marginLeft: 6 }} />
        </label>
        <label style={{ fontSize: 12, color: '#ddd' }}>
          平均上限
          <input type="number" min={1} max={5} step={0.1} value={maxAvg}
            onChange={e => setMaxAvg(Math.max(1, Math.min(5, parseFloat(e.target.value) || 3.0)))}
            style={{ ...numInputStyle, marginLeft: 6 }} />
        </label>
        <button type="button" onClick={fetchRows} disabled={loading} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: '#A29BFE', color: '#fff', fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer', fontSize: 13,
        }}>{loading ? '読み込み中…' : '再読込'}</button>
      </div>

      {/* 一覧テーブル */}
      {rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>
          {loading ? '集計中…' : '該当する低評価パターンなし (今は健全)'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>メニュー</th>
                <th style={th}>結果パターン</th>
                <th style={{ ...th, textAlign: 'right' }}>件数</th>
                <th style={{ ...th, textAlign: 'right' }}>平均★</th>
                <th style={{ ...th, textAlign: 'right' }}>低評価(≤2)</th>
                <th style={th}>最終レビュー</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.menu}-${r.result_summary}-${i}`} style={{
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: selected?.menu === r.menu && selected?.result_summary === r.result_summary
                    ? 'rgba(255,210,74,0.08)' : 'transparent',
                }}>
                  <td style={td}>{MENU_LABEL[r.menu]}</td>
                  <td style={{ ...td, fontWeight: 700, color: '#fff' }}>{r.result_summary}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.total_reviews}</td>
                  <td style={{ ...td, textAlign: 'right',
                    color: r.avg_rating < 2 ? '#FF6B6B' : r.avg_rating < 2.5 ? '#FF9F1C' : '#FFD24A',
                    fontWeight: 800,
                  }}>{r.avg_rating.toFixed(2)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.low_count}</td>
                  <td style={{ ...td, color: '#888' }}>
                    {r.latest_reviewed ? new Date(r.latest_reviewed).toLocaleDateString('ja-JP') : '—'}
                  </td>
                  <td style={td}>
                    <button type="button" onClick={() => openDetail(r)} style={{
                      padding: '4px 10px', borderRadius: 6, border: '1px solid #A29BFE',
                      background: 'transparent', color: '#A29BFE', fontSize: 11, cursor: 'pointer',
                    }}>詳細</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 詳細パネル */}
      {selected && (
        <div style={{
          marginTop: 24, padding: 16, borderRadius: 12,
          border: '1px solid var(--fm-border)', background: 'rgba(255,255,255,0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#bbb' }}>{MENU_LABEL[selected.menu]}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{selected.result_summary}</div>
            </div>
            <button type="button" onClick={() => setSelected(null)} style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--fm-border)',
              background: 'transparent', color: '#bbb', fontSize: 11, cursor: 'pointer',
            }}>閉じる</button>
          </div>
          {detailLoading ? <div style={{ color: '#888' }}>読み込み中…</div> :
            detail.length === 0 ? <div style={{ color: '#888' }}>レビューがありません</div> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {detail.map(d => (
                  <div key={d.id} style={{
                    padding: 10, borderRadius: 8,
                    background: d.rating <= 2 ? 'rgba(255,107,107,0.08)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${d.rating <= 2 ? 'rgba(255,107,107,0.30)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>
                        <span style={{ color: '#FFD24A' }}>{'★'.repeat(d.rating)}</span>
                        <span style={{ color: '#444' }}>{'☆'.repeat(5 - d.rating)}</span>
                      </span>
                      <span style={{ fontSize: 11, color: '#888' }}>
                        {new Date(d.reviewed_at).toLocaleDateString('ja-JP')}
                      </span>
                      {d.period_label && (
                        <span style={{ fontSize: 11, color: '#A29BFE' }}>· {d.period_label}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#ddd' }}>
                      対象: {d.target_names.join(' × ')}
                    </div>
                    {d.review_text && (
                      <div style={{
                        marginTop: 6, padding: 8, borderRadius: 6,
                        background: 'rgba(0,0,0,0.20)', fontSize: 12, color: '#fff',
                        whiteSpace: 'pre-wrap',
                      }}>「{d.review_text}」</div>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(180deg, #0a0612 0%, #08090d 100%)',
      color: 'var(--fm-text)',
      padding: '24px 16px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>{children}</div>
    </div>
  )
}

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: 13,
}
const th: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#A29BFE',
  borderBottom: '1px solid rgba(255,255,255,0.10)', fontWeight: 700, letterSpacing: 0.5,
}
const td: React.CSSProperties = {
  padding: '10px', fontSize: 13, color: '#ddd', verticalAlign: 'middle',
}
const numInputStyle: React.CSSProperties = {
  width: 70, padding: '4px 8px', borderRadius: 6,
  border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
  color: '#fff', fontSize: 13,
}
