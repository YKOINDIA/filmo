'use client'

import { useState } from 'react'

const FEATURES = [
  { icon: '🎬', title: '映画・ドラマ・アニメ', desc: 'TMDBの膨大なデータベースから作品を検索。ジャンル、年代、評価で絞り込み。' },
  { icon: '⭐', title: '0.5刻みレビュー', desc: '星0.5〜5.0の精密な評価。ネタバレフラグ付きで安心してレビュー。' },
  { icon: '📊', title: '統計＆可視化', desc: 'ジャンル分布、月別鑑賞数、スコア分布をグラフで確認。Filmarks Premiumの機能が無料。' },
  { icon: '🏆', title: 'ゲーミフィケーション', desc: 'レビュー・鑑賞でポイント獲得。レベルアップ＆称号コレクション。' },
  { icon: '👥', title: 'ソーシャル', desc: 'フォロー、いいね、アクティビティフィード。映画好きとつながる。' },
  { icon: '📱', title: 'モバイル対応', desc: 'PWA＆Capacitorでスマホでも快適。オフラインでも閲覧可能。' },
]

const STATS = [
  { value: '100万+', label: '作品データ' },
  { value: '無料', label: '全機能利用' },
  { value: '0.5', label: '刻みの評価' },
  { value: '50+', label: '称号コレクション' },
]

export default function LandingPage() {
  const [email, setEmail] = useState('')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fm-bg)', color: 'var(--fm-text)' }}>
      {/* Hero */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center', padding: '40px 20px',
        background: 'linear-gradient(180deg, rgba(108,92,231,0.15) 0%, var(--fm-bg) 100%)',
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎬</div>
        <h1 style={{
          fontSize: 'clamp(36px, 8vw, 64px)', fontWeight: 800,
          background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: 16, lineHeight: 1.2,
        }}>
          Filmo
        </h1>
        <p style={{ fontSize: 'clamp(16px, 3vw, 22px)', color: 'var(--fm-text-sub)', maxWidth: 600, marginBottom: 32, lineHeight: 1.6 }}>
          映画・ドラマ・アニメの記録・レビュー・発見を、もっと楽しく。<br />
          統計もゲーミフィケーションも、すべて無料。
        </p>

        <a href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '16px 40px', borderRadius: 12, fontSize: 18, fontWeight: 700,
          background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff',
          textDecoration: 'none', transition: 'transform 0.2s, box-shadow 0.2s',
          boxShadow: '0 4px 20px rgba(108,92,231,0.4)',
        }}>
          今すぐ始める
        </a>

        <div style={{ marginTop: 48, display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--fm-accent)' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--fm-text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 20px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, marginBottom: 48 }}>
          Filmoの特徴
        </h2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
        }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              background: 'var(--fm-bg-card)', borderRadius: 16, padding: 24,
              border: '1px solid var(--fm-border)', transition: 'transform 0.2s',
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--fm-text-sub)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section style={{ padding: '80px 20px', background: 'var(--fm-bg-card)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, marginBottom: 48 }}>
            Filmarks vs Filmo
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid var(--fm-border)' }}>機能</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '2px solid var(--fm-border)', color: 'var(--fm-text-sub)' }}>Filmarks</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '2px solid var(--fm-border)', color: 'var(--fm-accent)', fontWeight: 700 }}>Filmo</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['統計・グラフ', 'Premium (有料)', '無料'],
                  ['ゲーミフィケーション', 'なし', '称号・レベル・ポイント'],
                  ['評価刻み', '0.5刻み', '0.5刻み'],
                  ['レビューネタバレ設定', 'あり', 'あり'],
                  ['ソーシャル機能', 'フォロー・いいね', 'フォロー・いいね・フィード'],
                  ['モバイルアプリ', 'iOS/Android', 'PWA + ネイティブ'],
                  ['ダークモード', 'なし', '対応'],
                  ['広告', 'あり', 'なし'],
                ].map(([feature, filmarks, filmo]) => (
                  <tr key={feature}>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--fm-border)' }}>{feature}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid var(--fm-border)', color: 'var(--fm-text-muted)' }}>{filmarks}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid var(--fm-border)', color: 'var(--fm-accent)', fontWeight: 600 }}>{filmo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '80px 20px', textAlign: 'center',
        background: 'linear-gradient(180deg, var(--fm-bg) 0%, rgba(108,92,231,0.1) 100%)',
      }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>映画体験を、もっと豊かに。</h2>
        <p style={{ color: 'var(--fm-text-sub)', marginBottom: 32, fontSize: 16 }}>
          無料で全機能が使えます。今すぐアカウントを作成しましょう。
        </p>
        <a href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '16px 48px', borderRadius: 12, fontSize: 18, fontWeight: 700,
          background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff',
          textDecoration: 'none', boxShadow: '0 4px 20px rgba(108,92,231,0.4)',
        }}>
          無料で始める
        </a>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '40px 20px', borderTop: '1px solid var(--fm-border)',
        textAlign: 'center', color: 'var(--fm-text-muted)', fontSize: 13,
      }}>
        <div style={{ marginBottom: 16, display: 'flex', gap: 24, justifyContent: 'center' }}>
          <a href="/legal" style={{ color: 'var(--fm-text-sub)', textDecoration: 'none' }}>利用規約・プライバシーポリシー</a>
        </div>
        <div>&copy; {new Date().getFullYear()} Filmo. All rights reserved.</div>
        <div style={{ marginTop: 8 }}>映画データ提供: TMDB</div>
      </footer>
    </div>
  )
}
