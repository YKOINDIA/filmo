'use client'

/**
 * 致命的エラー時のメンテナンス画面。
 *
 * Next.js App Router の規約により、`app/global-error.tsx` は root layout を
 * 含めてレンダリングが失敗した際に呼ばれる最後の砦。`<html>` と `<body>` を
 * 自前で出力する必要がある (通常のレイアウトを使えない)。
 *
 * 受け取った `reset()` を「再読み込み」ボタンに繋ぐと、エラー境界を再初期化
 * してアプリの再レンダリングを試行できる。
 */

import MaintenanceCard from './components/MaintenanceCard'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ja" data-theme="dark">
      <body style={{ margin: 0 }}>
        <MaintenanceCard
          title="🛠 一時的に表示できません"
          message={
            <>
              ご不便をおかけして申し訳ありません。<br />
              ページの読み込みに失敗しました。<br />
              <br />
              再読み込みでもう一度お試しください。<br />
              繰り返し失敗する場合は、しばらく時間を置いてから<br />
              アクセスしてください。
            </>
          }
          onRetry={reset}
          retryLabel="再読み込み"
        />
      </body>
    </html>
  )
}
