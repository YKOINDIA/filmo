'use client'

import { useState } from 'react'
import Link from 'next/link'

const CATEGORIES = [
  { value: 'question', label: '❓ 質問' },
  { value: 'bug', label: '🐛 不具合' },
  { value: 'feature', label: '💡 機能要望' },
  { value: 'other', label: '💬 その他' },
] as const

export default function SupportPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>('question')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, category, subject, body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '送信に失敗しました')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--fm-bg)', color: 'var(--fm-text)' }}>
      <header style={{
        borderBottom: '1px solid var(--fm-border)', padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{
            fontSize: 16, fontWeight: 800, letterSpacing: 1.5,
            color: 'var(--fm-text)', textTransform: 'uppercase' as const,
          }}>Filmo</span>
        </Link>
        <Link href="/" style={{
          padding: '6px 16px', borderRadius: 6,
          background: 'var(--fm-accent)', color: '#fff', fontSize: 12, fontWeight: 600,
          textDecoration: 'none',
        }}>無料で始める</Link>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 60px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 8px' }}>
          お問い合わせ
        </h1>
        <p style={{ fontSize: 14, color: 'var(--fm-text-sub)', margin: '0 0 28px', lineHeight: 1.7 }}>
          ご意見・ご要望・不具合のご報告などお気軽にお寄せください。返信は登録メールアドレス宛に送信します。1〜3営業日以内にご返答します。
        </p>

        {done ? (
          <div style={{
            padding: 28, borderRadius: 12,
            background: 'rgba(46,204,138,0.12)', border: '1px solid #2ecc8a',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#2ecc8a', margin: '0 0 8px' }}>
              送信しました
            </h2>
            <p style={{ fontSize: 13, color: 'var(--fm-text-sub)', margin: 0, lineHeight: 1.6 }}>
              ご記入のメールアドレス({email})宛に1〜3営業日以内に返信します。
            </p>
            <Link href="/" style={{
              display: 'inline-block', marginTop: 20,
              padding: '10px 28px', borderRadius: 8,
              background: 'var(--fm-accent)', color: '#fff', fontSize: 14, fontWeight: 600,
              textDecoration: 'none',
            }}>トップへ戻る</Link>
          </div>
        ) : (
          <div style={{
            background: 'var(--fm-bg-card)', borderRadius: 12, padding: 24,
            border: '1px solid var(--fm-border)',
          }}>
            <Field label="メールアドレス *" hint="返信先として使用します。">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={inputStyle}
                maxLength={200}
              />
            </Field>

            <Field label="お名前(任意)" hint="">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="山田太郎"
                style={inputStyle}
                maxLength={80}
              />
            </Field>

            <Field label="カテゴリ" hint="">
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={inputStyle}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>

            <Field label="件名 *" hint="">
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="例: 配信サービスの絞り込みについて"
                style={inputStyle}
                maxLength={200}
              />
            </Field>

            <Field label="お問い合わせ内容 *" hint={`${body.length} / 5000`}>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="詳しい内容をご記入ください。"
                style={{ ...inputStyle, minHeight: 160, resize: 'vertical', fontFamily: 'inherit' }}
                maxLength={5000}
              />
            </Field>

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444',
                color: '#ef4444', fontSize: 13, fontWeight: 600,
              }}>
                ❌ {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={submitting || !email.trim() || !subject.trim() || !body.trim()}
              style={{
                width: '100%', padding: '14px 20px', borderRadius: 10, border: 'none',
                background: submitting ? 'var(--fm-text-muted)' : 'var(--fm-accent)',
                color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: (!email.trim() || !subject.trim() || !body.trim()) ? 0.5 : 1,
              }}
            >
              {submitting ? '送信中…' : '送信する'}
            </button>

            <p style={{ marginTop: 14, fontSize: 11, color: 'var(--fm-text-muted)', lineHeight: 1.6 }}>
              送信いただいた内容は <Link href="/legal" style={{ color: 'var(--fm-accent)' }}>プライバシーポリシー</Link> に従って取り扱います。
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 8,
  border: '1px solid var(--fm-border)',
  background: 'var(--fm-bg-input)',
  color: 'var(--fm-text)',
  fontSize: 14,
  boxSizing: 'border-box',
}

function Field({ label, hint, children }: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--fm-text-sub)', fontWeight: 600 }}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}
