import Link from 'next/link'

/* ------------------------------------------------------------------ */
/* Filmo Fable 5 — 共通プレゼンテーション部品                           */
/* 政策提言ページ (happiness / strongest) で使う静的 UI。               */
/* ------------------------------------------------------------------ */

/** ページ全体のシェル(ダーク背景 + sticky ヘッダー) */
export function Fable5Shell({
  title,
  emoji,
  accent,
  children,
}: {
  title: string
  emoji: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: '#0a0b14',
      minHeight: '100dvh',
      color: '#e0e0e0',
      paddingBottom: 80,
    }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(10,11,20,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${accent}`,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href="/fable5" aria-label="Filmo Fable 5 に戻る" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', textDecoration: 'none', fontSize: 18,
        }}>
          ←
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#a29bfe', letterSpacing: 1, fontWeight: 700, textTransform: 'uppercase' }}>
            🌌 Filmo Universe › 🤖 Filmo Fable 5
          </div>
          <h1 style={{
            fontSize: 16, fontWeight: 800, color: '#fff', margin: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {emoji} {title}
          </h1>
        </div>
      </header>
      {children}
    </div>
  )
}

/** セクション見出し */
export function Fable5SectionTitle({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '28px 0 14px' }}>
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: 0.5 }}>
        {label}
      </h2>
      <div style={{
        flex: 1, height: 1,
        background: 'linear-gradient(90deg, rgba(195,116,255,0.3), transparent)',
        marginLeft: 4,
      }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* メーター(実現可能性・インパクト・コスト)                            */
/* ------------------------------------------------------------------ */

/** 5段階の横バーメーター */
export function Meter({
  label,
  value,
  color,
}: {
  label: string
  value: 1 | 2 | 3 | 4 | 5
  color: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: '#999', width: 56, flexShrink: 0, fontWeight: 600 }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 3, flex: 1 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            style={{
              flex: 1, height: 6, borderRadius: 3,
              background: i <= value ? color : 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </div>
    </div>
  )
}

export type Policy = {
  emoji: string
  title: string
  what: string
  why: string
  effect: string
  term: string
  feasibility: 1 | 2 | 3 | 4 | 5
  impact: 1 | 2 | 3 | 4 | 5
  cost: 1 | 2 | 3 | 4 | 5
  accent: string // rgba ベースカラー
}

/** 政策カード */
export function PolicyCard({ policy, index }: { policy: Policy; index: number }) {
  return (
    <div style={{
      borderRadius: 16,
      background: 'rgba(20,22,40,0.7)',
      border: `1px solid ${policy.accent}`,
      overflow: 'hidden',
    }}>
      {/* カードヘッダー */}
      <div style={{
        padding: '14px 16px',
        background: `linear-gradient(135deg, ${policy.accent.replace(/[\d.]+\)$/, '0.22)')}, transparent 70%)`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 10, flexShrink: 0,
          background: policy.accent.replace(/[\d.]+\)$/, '0.25)'),
          border: `1px solid ${policy.accent}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 900, color: '#fff',
        }}>
          {index + 1}
        </div>
        <div style={{ fontSize: 24, flexShrink: 0 }}>{policy.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.4 }}>
            {policy.title}
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0,
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 4, padding: '3px 7px', letterSpacing: 0.5,
        }}>
          {policy.term}
        </span>
      </div>

      {/* 本文 */}
      <div style={{ padding: '12px 16px 14px', display: 'grid', gap: 10 }}>
        <PolicyRow tag="何をする" tagColor="#7cc4ff" text={policy.what} />
        <PolicyRow tag="なぜ現実的" tagColor="#4fd1a5" text={policy.why} />
        <PolicyRow tag="効果" tagColor="#ffd24a" text={policy.effect} />

        {/* メーター群 */}
        <div style={{
          display: 'grid', gap: 6, marginTop: 4,
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(0,0,0,0.25)',
        }}>
          <Meter label="実現可能性" value={policy.feasibility} color="#4fd1a5" />
          <Meter label="インパクト" value={policy.impact} color="#ffd24a" />
          <Meter label="必要コスト" value={policy.cost} color="#ff7aae" />
        </div>
      </div>
    </div>
  )
}

function PolicyRow({ tag, tagColor, text }: { tag: string; tagColor: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{
        fontSize: 9, fontWeight: 800, color: tagColor, flexShrink: 0,
        border: `1px solid ${tagColor}55`,
        background: `${tagColor}18`,
        borderRadius: 4, padding: '2px 4px', letterSpacing: 0.5,
        marginTop: 2, width: 64, textAlign: 'center', whiteSpace: 'nowrap',
      }}>
        {tag}
      </span>
      <span style={{ fontSize: 12.5, color: '#ccc', lineHeight: 1.65, flex: 1 }}>
        {text}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* おすすめ度ランキング(効果 ÷ 実現しやすさの総合)                     */
/* ------------------------------------------------------------------ */

export function PriorityRanking({
  items,
  barColor,
}: {
  items: { label: string; emoji: string; score: number }[] // score: 0-100
  barColor: string
}) {
  const sorted = [...items].sort((a, b) => b.score - a.score)
  return (
    <div style={{
      display: 'grid', gap: 10,
      padding: '16px 16px', borderRadius: 16,
      background: 'rgba(20,22,40,0.7)',
      border: '1px solid rgba(195,116,255,0.25)',
    }}>
      {sorted.map((item, i) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 12, fontWeight: 900, width: 22, flexShrink: 0, textAlign: 'center',
            color: i === 0 ? '#ffd24a' : i === 1 ? '#cfc6e0' : i === 2 ? '#d49a6a' : '#777',
          }}>
            {i + 1}
          </span>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{item.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#ddd', marginBottom: 4 }}>
              {item.label}
            </div>
            <div style={{
              height: 8, borderRadius: 4,
              background: 'rgba(255,255,255,0.07)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${item.score}%`, height: '100%', borderRadius: 4,
                background: `linear-gradient(90deg, ${barColor}, ${barColor}88)`,
              }} />
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: barColor, width: 28, textAlign: 'right', flexShrink: 0 }}>
            {item.score}
          </span>
        </div>
      ))}
      <div style={{ fontSize: 10, color: '#777', marginTop: 2 }}>
        スコア = インパクト × 実現可能性 ÷ コスト で算出した総合おすすめ度(100点満点)
      </div>
    </div>
  )
}
