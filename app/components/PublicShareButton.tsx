'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

interface Props {
  /** ページの canonical URL */
  url: string
  /** シェア時のタイトル（navigator.share / X 投稿テキスト） */
  title: string
}

/**
 * 公開ページ用のシェアボタン。
 * - タップで X / LINE / リンクコピー / システムシェア のシートを表示。
 * - ログイン有無に関わらず動作する。
 */
export default function PublicShareButton({ url, title }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  const shareText = `${title} / Filmo`

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }, [url])

  const handleTwitter = useCallback(() => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer',
    )
  }, [url, shareText])

  const handleLine = useCallback(() => {
    window.open(
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`,
      '_blank',
      'noopener,noreferrer',
    )
  }, [url, shareText])

  const handleSystem = useCallback(async () => {
    if (!navigator.share) return
    try {
      await navigator.share({ title, text: shareText, url })
    } catch { /* user canceled */ }
  }, [url, title, shareText])

  // 外側タップで閉じる
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="シェア"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', borderRadius: 6,
          background: 'transparent', border: '1px solid var(--fm-border)',
          color: 'var(--fm-text)', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        シェア
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 9999, padding: 0,
        }}>
          <div
            ref={sheetRef}
            style={{
              width: '100%', maxWidth: 480,
              background: 'var(--fm-bg)', borderTopLeftRadius: 16, borderTopRightRadius: 16,
              padding: '20px 16px 32px',
              animation: 'pubShareSlideUp 0.2s ease-out',
            }}
          >
            <style>{`@keyframes pubShareSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div style={{
              width: 40, height: 4, background: 'var(--fm-border)',
              borderRadius: 2, margin: '0 auto 16px',
            }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)', marginBottom: 16, textAlign: 'center' }}>
              このページをシェア
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {/* X */}
              <button onClick={handleTwitter} style={btnStyle}>
                <span style={{ fontSize: 24, fontWeight: 900, lineHeight: 1 }}>𝕏</span>
                <span style={{ fontSize: 11 }}>Xで投稿</span>
              </button>

              {/* LINE */}
              <button onClick={handleLine} style={btnStyle}>
                <span style={{ fontSize: 22, lineHeight: 1, color: '#06C755', fontWeight: 700 }}>LINE</span>
                <span style={{ fontSize: 11 }}>LINEで送る</span>
              </button>

              {/* Copy link */}
              <button onClick={handleCopy} style={btnStyle}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span style={{ fontSize: 11 }}>{copied ? 'コピー済' : 'リンクコピー'}</span>
              </button>

              {/* System share */}
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
                <button onClick={handleSystem} style={btnStyle}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  <span style={{ fontSize: 11 }}>その他</span>
                </button>
              ) : (
                <div />
              )}
            </div>

            {/* URL preview */}
            <div style={{
              padding: '10px 12px', background: 'var(--fm-bg-secondary)',
              borderRadius: 8, fontSize: 12, color: 'var(--fm-text-sub)',
              wordBreak: 'break-all', marginBottom: 16, fontFamily: 'monospace',
            }}>
              {url}
            </div>

            <button
              onClick={() => setOpen(false)}
              style={{
                width: '100%', padding: '12px', background: 'transparent',
                border: '1px solid var(--fm-border)', borderRadius: 10,
                color: 'var(--fm-text-sub)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  )
}

const btnStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  padding: '12px 8px', background: 'transparent',
  border: '1px solid var(--fm-border)', borderRadius: 10,
  cursor: 'pointer', color: 'var(--fm-text)',
}
