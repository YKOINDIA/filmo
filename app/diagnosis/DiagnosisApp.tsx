'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { QUESTIONS, tallyScores } from '../lib/diagnosis/questions'
import { matchType, type DiagnosisType } from '../lib/diagnosis/types'
import DiagnosisResult from './DiagnosisResult'

const BG = '#0a0b14'

type Phase = 'intro' | 'quiz' | 'result'

export default function DiagnosisApp() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<DiagnosisType | null>(null)

  const total = QUESTIONS.length
  const current = QUESTIONS[step]
  const progress = useMemo(() => Math.round((step / total) * 100), [step, total])

  const start = useCallback(() => {
    setAnswers({})
    setStep(0)
    setResult(null)
    setPhase('quiz')
  }, [])

  const finish = useCallback(async (finalAnswers: Record<string, number>) => {
    const type = matchType(tallyScores(finalAnswers))
    setResult(type)
    setPhase('result')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    // ログイン中なら診断タイプをプロフィールに保存
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await supabase
          .from('users')
          .update({ diagnosis_type: type.id, diagnosis_at: new Date().toISOString() })
          .eq('id', session.user.id)
      }
    } catch { /* ignore */ }
  }, [])

  const choose = useCallback((optionIndex: number) => {
    const next = { ...answers, [current.id]: optionIndex }
    setAnswers(next)
    if (step + 1 >= total) {
      finish(next)
    } else {
      setStep(step + 1)
    }
  }, [answers, current, step, total, finish])

  const back = useCallback(() => {
    if (step > 0) setStep(step - 1)
    else setPhase('intro')
  }, [step])

  return (
    <div style={{ background: BG, minHeight: '100dvh', color: '#e0e0e0', paddingBottom: 60 }}>
      {/* ヘッダー */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(10,11,20,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(108,92,231,0.2)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href="/" aria-label="ホームに戻る" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', textDecoration: 'none', fontSize: 18,
        }}>←</Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#a29bfe', letterSpacing: 1, fontWeight: 700, textTransform: 'uppercase' }}>
            🎬 Filmo
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>映画好き診断</h1>
        </div>
      </header>

      {/* イントロ */}
      {phase === 'intro' && (
        <section style={{ maxWidth: 520, margin: '0 auto', padding: '32px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>🎬✨</div>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: '#fff', margin: '0 0 14px', lineHeight: 1.4 }}>
            あなたに合う映画を診断
          </h2>
          <p style={{ fontSize: 14, color: '#cfc6e0', lineHeight: 1.9, margin: '0 0 28px' }}>
            かんたんな{total}つの質問に答えるだけ。<br />
            あなたの「映画タイプ」と、ぴったりのおすすめ映画が分かります。<br />
            結果は X や LINE でシェアできます。
          </p>
          <button
            onClick={start}
            style={{
              width: '100%', maxWidth: 320, padding: '16px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff', fontWeight: 800, fontSize: 17,
              boxShadow: '0 8px 28px rgba(108,92,231,0.45)',
            }}
          >
            診断をはじめる →
          </button>
          <div style={{ marginTop: 16, fontSize: 12, color: '#777' }}>
            全{total}問・所要時間 約1分
          </div>
        </section>
      )}

      {/* クイズ */}
      {phase === 'quiz' && current && (
        <section style={{ maxWidth: 520, margin: '0 auto', padding: '20px 18px' }}>
          {/* プログレス */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#a29bfe', fontWeight: 700, marginBottom: 6 }}>
              <span>Q{step + 1} / {total}</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
              <div style={{
                height: '100%', borderRadius: 3, width: `${progress}%`,
                background: 'linear-gradient(90deg, #6c5ce7, #a29bfe)', transition: 'width 0.3s',
              }} />
            </div>
          </div>

          <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', margin: '0 0 22px', lineHeight: 1.5 }}>
            {current.title}
          </h2>

          <div style={{ display: 'grid', gap: 12 }}>
            {current.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => choose(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                  padding: '16px 18px', borderRadius: 14, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)',
                  border: answers[current.id] === i ? '1.5px solid #a29bfe' : '1.5px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: 15, fontWeight: 600, width: '100%',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                {opt.emoji && <span style={{ fontSize: 26, flexShrink: 0 }}>{opt.emoji}</span>}
                <span style={{ lineHeight: 1.5 }}>{opt.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={back}
            style={{
              marginTop: 22, padding: '10px 18px', borderRadius: 10, cursor: 'pointer',
              background: 'transparent', color: '#888', border: '1px solid rgba(255,255,255,0.12)',
              fontSize: 13, fontWeight: 600,
            }}
          >
            ← 戻る
          </button>
        </section>
      )}

      {/* 結果 */}
      {phase === 'result' && result && (
        <section style={{ paddingTop: 16 }}>
          <DiagnosisResult type={result} variant="inline" onRetry={start} />
        </section>
      )}
    </div>
  )
}
