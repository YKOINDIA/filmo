import type { Metadata } from 'next'
import Link from 'next/link'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'

export const metadata: Metadata = {
  title: 'Filmo Games — 映画ファンのミニゲーム集',
  description: '映画ファンのためのミニゲーム集。絵文字タイトル当て、CRYSTAL BLAST、FILMIUS、FILMAPPY、Minesweeper。スコアを競って映画好きの腕試し。',
  openGraph: {
    type: 'website',
    title: 'Filmo Games — 映画ファンのミニゲーム集',
    description: '映画ファンのためのミニゲーム集。絵文字タイトル当て、CRYSTAL BLAST、FILMIUS、FILMAPPY、Minesweeper。',
    url: `${APP_URL}/games`,
    siteName: 'Filmo',
  },
}

type Game = {
  href: string
  emoji: string
  title: string
  subtitle: string
  tagline: string
  gradient: string
  border: string
  titleFont?: string
  titleLetterSpacing?: number
  note?: string
}

const GAMES: Game[] = [
  {
    href: '/games/emoji',
    emoji: '🚢💎🥶',
    title: '絵文字タイトル当て',
    subtitle: '絵文字から作品名を当てよう',
    tagline: '全10問でスコアを競おう',
    gradient: 'linear-gradient(135deg, rgba(108,92,231,0.25), rgba(0,192,48,0.15))',
    border: 'rgba(108,92,231,0.4)',
  },
  {
    href: '/games/crystal-blast',
    emoji: '💎',
    title: 'CRYSTAL BLAST',
    subtitle: '連鎖でぶっ飛ばせ！',
    tagline: 'ソロも対戦も。クリスタル消しパズル',
    note: '⚔️ オンライン対戦はログインが必要です',
    gradient: 'linear-gradient(135deg, rgba(255,87,87,0.25), rgba(195,116,255,0.18))',
    border: 'rgba(255,87,87,0.4)',
  },
  {
    href: '/games/filmius',
    emoji: '🚀',
    title: 'FILMIUS',
    subtitle: '横スクロール・シューティング',
    tagline: '3ステージ+ボス戦。EASY/NORMAL/HARD',
    gradient: 'linear-gradient(135deg, rgba(255,210,74,0.25), rgba(108,242,255,0.15))',
    border: 'rgba(255,210,74,0.4)',
    titleFont: 'monospace',
    titleLetterSpacing: 2,
  },
  {
    href: '/games/filmappy',
    emoji: '🎞️🍿🏆',
    title: 'FILMAPPY',
    subtitle: 'マッピーランド風アクション',
    tagline: '映画館で泥棒を追え！3ステージ',
    gradient: 'linear-gradient(135deg, rgba(255,80,120,0.28), rgba(255,210,74,0.18))',
    border: 'rgba(255,80,120,0.4)',
    titleFont: 'monospace',
    titleLetterSpacing: 2,
  },
  {
    href: '/games/minesweeper',
    emoji: '💣',
    title: 'Minesweeper',
    subtitle: '古典マインスイーパ',
    tagline: '3難易度・ベストタイム争い',
    gradient: 'linear-gradient(135deg, rgba(99,102,241,0.28), rgba(239,68,68,0.15))',
    border: 'rgba(99,102,241,0.4)',
  },
]

export default function GamesHubPage() {
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
            🎮 Filmo Games
          </h1>
        </div>
      </header>

      {/* Intro */}
      <section style={{ padding: '20px 20px 8px' }}>
        <div style={{ fontSize: 13, color: '#cfc6e0', lineHeight: 1.6 }}>
          映画ファンのためのミニゲーム集。スコアでポイント獲得 → レベルアップに反映されます。
        </div>
      </section>

      {/* Games list */}
      <section style={{ padding: '8px 20px' }}>
        <div style={{ display: 'grid', gap: 12 }}>
          {GAMES.map(g => (
            <Link
              key={g.href}
              href={g.href}
              style={{
                display: 'block',
                padding: 18,
                borderRadius: 16,
                background: g.gradient,
                border: `1px solid ${g.border}`,
                textDecoration: 'none',
                color: 'inherit',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>{g.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 17, fontWeight: 800, color: '#fff',
                    fontFamily: g.titleFont,
                    letterSpacing: g.titleLetterSpacing,
                  }}>{g.title}</div>
                  <div style={{ fontSize: 13, color: '#ddd', marginTop: 3 }}>
                    {g.subtitle}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                    {g.tagline}
                  </div>
                  {g.note && (
                    <div style={{ fontSize: 11, color: '#ffd24a', marginTop: 6, fontWeight: 600 }}>
                      {g.note}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 24, color: 'var(--fm-accent)', flexShrink: 0 }}>→</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer note */}
      <section style={{ padding: '24px 20px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#666' }}>
          ゲームのリクエスト・バグ報告はお問い合わせから
        </div>
      </section>
    </div>
  )
}
