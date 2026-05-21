/**
 * Filmo メンテナンス UI カード。
 *
 * 以下 3 箇所から共通で使う:
 *   - app/global-error.tsx       (致命的レンダリングエラー時の画面)
 *   - app/maintenance/page.tsx   (計画メンテナンス用の静的ページ)
 *   - app/layout.tsx             (MAINTENANCE_MODE=1 時の全画面置換)
 *
 * Server Component / Client Component どちらからも使えるよう、副作用なし。
 * `onRetry` を渡すと再試行ボタンが出る (global-error の reset 用)。
 */

interface Props {
  /** タイトル文言。デフォルト「メンテナンス中」 */
  title?: string
  /** 本文。デフォルトの定型文を上書きできる */
  message?: React.ReactNode
  /** 再試行ボタンを表示する場合のハンドラ (省略時はボタン非表示) */
  onRetry?: () => void
  /** 再試行ボタンのラベル */
  retryLabel?: string
}

const APP_URL = 'https://filmo.me'

export default function MaintenanceCard({
  title = '🛠 メンテナンス中',
  message,
  onRetry,
  retryLabel = '再読み込み',
}: Props) {
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 56, marginBottom: 4 }}>🎬</div>
        <h1 style={titleStyle}>{title}</h1>
        <p style={messageStyle}>
          {message ?? (
            <>
              ご不便をおかけして申し訳ありません。<br />
              一時的に Filmo へアクセスできない状態です。<br />
              <br />
              数分後にもう一度お試しください。
            </>
          )}
        </p>
        {onRetry && (
          <button type="button" onClick={onRetry} style={retryBtnStyle}>
            {retryLabel}
          </button>
        )}
        <div style={statusLinkRow}>
          <a href={APP_URL} style={linkStyle}>filmo.me</a>
          <span style={{ opacity: 0.3 }}>·</span>
          <a
            href="https://twitter.com/intent/follow?screen_name=filmo_jp"
            target="_blank" rel="noopener noreferrer"
            style={linkStyle}
          >
            X (@filmo_jp) で復旧情報
          </a>
        </div>
      </div>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  minHeight: '100dvh',
  background: 'radial-gradient(ellipse at top, #1a0033 0%, #050015 60%, #000 100%)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "Hiragino Sans", "Yu Gothic UI", sans-serif',
}

const cardStyle: React.CSSProperties = {
  maxWidth: 420,
  width: '100%',
  padding: '32px 24px',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,210,74,0.25)',
  textAlign: 'center',
}

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  margin: '8px 0 16px 0',
  color: '#ffd24a',
  letterSpacing: 1,
}

const messageStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: '#cbcbd0',
  margin: '0 0 24px 0',
}

const retryBtnStyle: React.CSSProperties = {
  padding: '12px 28px',
  fontSize: 14,
  fontWeight: 700,
  color: '#000',
  background: 'linear-gradient(135deg, #ffd24a, #ff7a3f)',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  marginBottom: 20,
  touchAction: 'manipulation',
}

const statusLinkRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 12,
  fontSize: 12,
  color: '#888',
}

const linkStyle: React.CSSProperties = {
  color: '#6cf2ff',
  textDecoration: 'none',
}
