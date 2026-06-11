import type { Metadata } from 'next'
import Link from 'next/link'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'

export const metadata: Metadata = {
  title: 'Filmo Fable 5 — AIが考える日本の『現実的な』政策',
  description: 'AI(Claude Fable 5)が本気で考えた日本への政策提言。日本国民が幸せになる政策と、日本が最強になる政策を、実現可能性・インパクト・コストつきでわかりやすくまとめました。',
  openGraph: {
    type: 'website',
    title: 'Filmo Fable 5 — AIが考える日本の『現実的な』政策',
    description: 'AIが本気で考えた日本への政策提言。幸せになる政策と最強になる政策。',
    url: `${APP_URL}/fable5`,
    siteName: 'Filmo',
  },
}

const PAGES = [
  {
    href: '/fable5/happiness',
    emoji: '😊',
    badge: '🌸 ウェルビーイング',
    badgeColor: '#ff7aae',
    title: '日本国民が幸せになる『現実的な』政策',
    subtitle: '可処分時間・可処分所得・つながり・安心。幸福度を底上げする6つの提言',
    gradient: 'linear-gradient(135deg, rgba(255,122,174,0.25), rgba(255,210,74,0.15))',
    border: 'rgba(255,122,174,0.45)',
  },
  {
    href: '/fable5/strongest',
    emoji: '🗻',
    badge: '⚡ 国力強化',
    badgeColor: '#7cc4ff',
    title: '日本が最強になる『現実的な』政策',
    subtitle: 'エネルギー・技術・人材・食料・文化。国力の五角形を埋める7つの提言',
    gradient: 'linear-gradient(135deg, rgba(124,196,255,0.25), rgba(255,87,87,0.15))',
    border: 'rgba(124,196,255,0.45)',
  },
  {
    href: '/fable5/spacex',
    emoji: '🚀',
    badge: '🌠 未来シナリオ',
    badgeColor: '#6cf2ff',
    title: 'SpaceXが世界を“無料”にする日',
    subtitle: '宇宙太陽光・AI・小惑星採掘が実現する『欠乏なき世界』。戦争も労働も消える未来の思考実験',
    gradient: 'linear-gradient(135deg, rgba(108,242,255,0.22), rgba(162,155,254,0.18))',
    border: 'rgba(108,242,255,0.45)',
  },
]

export default function Fable5HubPage() {
  return (
    <div style={{
      background: '#0a0b14',
      minHeight: '100dvh',
      color: '#e0e0e0',
      paddingBottom: 80,
    }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(10,11,20,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(195,116,255,0.2)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href="/" aria-label="ホームに戻る" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', textDecoration: 'none', fontSize: 18,
        }}>
          ←
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#a29bfe', letterSpacing: 1, fontWeight: 700, textTransform: 'uppercase' }}>
            🌌 Filmo Universe
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>
            🤖 Filmo Fable 5
          </h1>
        </div>
      </header>

      {/* Hero */}
      <section style={{ padding: '20px 20px 8px' }}>
        <div style={{
          borderRadius: 18,
          padding: '22px 20px',
          background: 'linear-gradient(135deg, #1a0b2e 0%, #1b2a4e 55%, #3d1a3d 100%)',
          border: '1px solid rgba(195,116,255,0.35)',
        }}>
          <div style={{ fontSize: 13, color: '#cfc6e0', lineHeight: 1.8 }}>
            AI「Claude Fable 5」が本気で考えた、政策提言と未来シナリオのシリーズ。
            政策編は<strong style={{ color: '#ffd24a' }}>すでにある制度・技術・先行事例の延長線上</strong>で
            実現できる『現実的な』ものだけを選び、
            実現可能性・インパクト・コストを見える化。
            シナリオ編では、あえてスケールの大きな未来を思考実験します。
          </div>
          <div style={{
            marginTop: 12, fontSize: 11, color: '#8a82a0',
            borderTop: '1px dashed rgba(195,116,255,0.25)', paddingTop: 10,
          }}>
            ※ AIによる提言です。特定の政党・団体とは関係ありません。
          </div>
        </div>
      </section>

      {/* Pages */}
      <section style={{ padding: '14px 20px' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          {PAGES.map(p => (
            <Link
              key={p.href}
              href={p.href}
              style={{
                display: 'block',
                padding: 18,
                borderRadius: 16,
                background: p.gradient,
                border: `1px solid ${p.border}`,
                textDecoration: 'none',
                color: 'inherit',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 38, lineHeight: 1, flexShrink: 0 }}>{p.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ marginBottom: 5 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, color: p.badgeColor,
                      background: `${p.badgeColor}22`,
                      border: `1px solid ${p.badgeColor}55`,
                      borderRadius: 4, padding: '2px 6px', letterSpacing: 0.5,
                    }}>
                      {p.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: '#fff', lineHeight: 1.45 }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#ccc', marginTop: 5, lineHeight: 1.5 }}>
                    {p.subtitle}
                  </div>
                </div>
                <div style={{ fontSize: 22, color: '#ffd24a', flexShrink: 0 }}>→</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer note */}
      <section style={{ padding: '20px 20px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#666', lineHeight: 1.7 }}>
          数値・制度は2026年6月時点の情報をもとにしたAIの見解です。<br />
          「こんなテーマも考えてほしい」はお問い合わせから
        </div>
      </section>
    </div>
  )
}
