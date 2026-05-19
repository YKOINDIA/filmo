'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  /** リンク先 URL (例: /?work=123&type=movie) */
  href: string
  /** CTA ラベル */
  label?: string
}

/**
 * ログイン済みユーザーにだけ表示される sticky ボトムバー。
 * 公開 SEO ページから Filmo アプリ（SPA）へ誘導し、
 * レビュー・FAN!・星評価などのインタラクティブ操作を可能にする。
 */
export default function OpenInAppBar({ href, label = 'レビュー・評価する' }: Props) {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setAuthed(!!session?.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!cancelled) setAuthed(!!s?.user)
    })
    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  if (!authed) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 9000,
      background: 'var(--fm-bg)',
      borderTop: '1px solid var(--fm-border)',
      padding: '10px 16px',
      paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
    }}>
      <span style={{ fontSize: 13, color: 'var(--fm-text-sub)', flex: '0 1 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        Filmoアプリで開く
      </span>
      <a
        href={href}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '10px 24px', borderRadius: 8,
          background: 'var(--fm-accent)', color: '#fff',
          fontSize: 14, fontWeight: 700, textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </a>
    </div>
  )
}
