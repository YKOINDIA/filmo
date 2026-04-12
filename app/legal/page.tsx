'use client'

import { useState } from 'react'

type Tab = 'terms' | 'privacy' | 'tokusho'

export default function LegalPage() {
  const [tab, setTab] = useState<Tab>('terms')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fm-bg)', color: 'var(--fm-text)', padding: '20px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--fm-accent)', textDecoration: 'none', fontSize: 14, marginBottom: 24 }}>
          ← トップに戻る
        </a>

        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>法的情報</h1>

        {/* タブ */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
          {([
            { key: 'terms' as Tab, label: '利用規約' },
            { key: 'privacy' as Tab, label: 'プライバシーポリシー' },
            { key: 'tokusho' as Tab, label: '特定商取引法に基づく表記' },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '10px 20px', borderRadius: 10, border: '1px solid var(--fm-border)',
                background: tab === t.key ? 'var(--fm-accent)' : 'var(--fm-bg-card)',
                color: tab === t.key ? '#fff' : 'var(--fm-text-sub)',
                fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ background: 'var(--fm-bg-card)', borderRadius: 16, padding: '32px 24px', border: '1px solid var(--fm-border)', lineHeight: 1.8, fontSize: 14 }}>
          {tab === 'terms' && <TermsContent />}
          {tab === 'privacy' && <PrivacyContent />}
          {tab === 'tokusho' && <TokushoContent />}
        </div>

        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fm-text-muted)', fontSize: 13 }}>
          &copy; {new Date().getFullYear()} Filmo. All rights reserved.
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 12, color: 'var(--fm-accent)' }}>{children}</h2>
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>{children}</h3>
}

function TermsContent() {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>利用規約</h2>
      <p style={{ color: 'var(--fm-text-muted)', marginBottom: 24 }}>最終更新日: 2026年4月12日</p>

      <SectionTitle>第1条（適用）</SectionTitle>
      <p>本規約は、Filmo（以下「本サービス」）の利用に関する条件を定めるものです。ユーザーは本規約に同意の上、本サービスを利用するものとします。</p>

      <SectionTitle>第2条（アカウント）</SectionTitle>
      <p>1. ユーザーはメールアドレスとパスワードを登録してアカウントを作成します。</p>
      <p>2. アカウント情報の管理はユーザーの責任とします。</p>
      <p>3. 他者へのアカウントの譲渡・貸与は禁止します。</p>

      <SectionTitle>第3条（禁止事項）</SectionTitle>
      <p>以下の行為を禁止します：</p>
      <ul style={{ paddingLeft: 20, marginTop: 8 }}>
        <li>法令または公序良俗に違反する行為</li>
        <li>他のユーザーへの嫌がらせ、誹謗中傷</li>
        <li>スパム行為、大量の自動アクセス</li>
        <li>虚偽の情報の登録</li>
        <li>本サービスの運営を妨害する行為</li>
        <li>不正アクセス、リバースエンジニアリング</li>
        <li>著作権その他知的財産権を侵害する行為</li>
      </ul>

      <SectionTitle>第4条（コンテンツ）</SectionTitle>
      <p>1. ユーザーが投稿したレビュー等のコンテンツの著作権はユーザーに帰属します。</p>
      <p>2. ユーザーは本サービスに対し、コンテンツの表示・配信に必要な範囲で非独占的な利用許諾を付与するものとします。</p>
      <p>3. 映画・ドラマ・アニメのデータはTMDB (The Movie Database) より提供されています。</p>

      <SectionTitle>第5条（サービスの変更・停止）</SectionTitle>
      <p>運営者は、事前の通知なくサービスの内容変更、一時停止、終了を行うことがあります。これによりユーザーに生じた損害について、運営者は責任を負いません。</p>

      <SectionTitle>第6条（免責事項）</SectionTitle>
      <p>1. 本サービスは「現状有姿」で提供されます。</p>
      <p>2. 運営者は、本サービスの正確性、完全性、有用性について保証しません。</p>
      <p>3. ユーザー間のトラブルについて、運営者は責任を負いません。</p>

      <SectionTitle>第7条（規約の変更）</SectionTitle>
      <p>運営者は本規約を変更できるものとし、変更後の規約は本サービス上に掲示した時点で効力を生じます。</p>
    </div>
  )
}

function PrivacyContent() {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>プライバシーポリシー</h2>
      <p style={{ color: 'var(--fm-text-muted)', marginBottom: 24 }}>最終更新日: 2026年4月12日</p>

      <SectionTitle>1. 収集する情報</SectionTitle>
      <SubTitle>1.1 ユーザーが提供する情報</SubTitle>
      <ul style={{ paddingLeft: 20 }}>
        <li>メールアドレス、パスワード（暗号化して保存）</li>
        <li>プロフィール情報（表示名、自己紹介、アバター画像）</li>
        <li>レビュー、評価、鑑賞記録</li>
      </ul>

      <SubTitle>1.2 自動的に収集する情報</SubTitle>
      <ul style={{ paddingLeft: 20 }}>
        <li>IPアドレス（不正アクセス防止のため）</li>
        <li>アクセスログ（サービス改善のため）</li>
        <li>デバイス情報、ブラウザ情報</li>
      </ul>

      <SectionTitle>2. 情報の利用目的</SectionTitle>
      <ul style={{ paddingLeft: 20 }}>
        <li>サービスの提供・運営</li>
        <li>ユーザーサポート</li>
        <li>サービスの改善・新機能の開発</li>
        <li>不正利用の検知・防止</li>
        <li>統計データの作成（個人を特定しない形で）</li>
      </ul>

      <SectionTitle>3. 情報の共有</SectionTitle>
      <p>以下の場合を除き、個人情報を第三者に提供しません：</p>
      <ul style={{ paddingLeft: 20, marginTop: 8 }}>
        <li>ユーザーの同意がある場合</li>
        <li>法令に基づく場合</li>
        <li>サービス提供に必要な業務委託先（データ保管等）</li>
      </ul>

      <SectionTitle>4. データの保管</SectionTitle>
      <p>データはAppwriteクラウドサービスに保管されます。適切なセキュリティ対策を講じてデータを保護します。</p>

      <SectionTitle>5. ユーザーの権利</SectionTitle>
      <p>ユーザーは以下の権利を有します：</p>
      <ul style={{ paddingLeft: 20, marginTop: 8 }}>
        <li>自身のデータの閲覧・訂正</li>
        <li>アカウントの削除（設定画面より）</li>
        <li>データのエクスポート（お問い合わせにて対応）</li>
      </ul>

      <SectionTitle>6. Cookie</SectionTitle>
      <p>本サービスではセッション管理のためにCookieを使用します。ブラウザの設定でCookieを無効にできますが、一部機能が制限される場合があります。</p>

      <SectionTitle>7. 変更</SectionTitle>
      <p>本ポリシーは予告なく変更される場合があります。重要な変更がある場合はサービス内で通知します。</p>

      <SectionTitle>8. お問い合わせ</SectionTitle>
      <p>プライバシーに関するお問い合わせはアプリ内のフィードバック機能よりご連絡ください。</p>
    </div>
  )
}

function TokushoContent() {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>特定商取引法に基づく表記</h2>
      <p style={{ color: 'var(--fm-text-muted)', marginBottom: 24 }}>最終更新日: 2026年4月12日</p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {[
            ['サービス名', 'Filmo'],
            ['事業形態', '個人運営'],
            ['販売価格', '無料（全機能無料でご利用いただけます）'],
            ['お支払い方法', '該当なし（無料サービス）'],
            ['返品・キャンセル', '該当なし（無料サービス）'],
            ['お問い合わせ', 'アプリ内フィードバック機能よりご連絡ください'],
          ].map(([label, value]) => (
            <tr key={label}>
              <th style={{
                padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid var(--fm-border)',
                color: 'var(--fm-text-sub)', fontWeight: 600, width: '30%', verticalAlign: 'top',
              }}>{label}</th>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--fm-border)' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 24, color: 'var(--fm-text-muted)', fontSize: 13 }}>
        ※ 将来有料プランを導入する場合は、本ページを更新いたします。
      </p>
    </div>
  )
}
