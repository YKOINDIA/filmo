import type { Metadata } from 'next'
import MaintenanceCard from '../components/MaintenanceCard'

// 通常時にもアクセス可能な「メンテナンスのお知らせ」用静的ページ。
// 計画メンテナンスを告知する際は、Vercel の env で `MAINTENANCE_MODE=1` を
// 設定すると root layout が全リクエストでこのカードを描画する (デプロイ済み)。
// このページ自体は env 未設定でも閲覧できる (例: 案内 LINE に直リンク貼る等)。

export const metadata: Metadata = {
  title: 'メンテナンス中',
  robots: { index: false, follow: false },
}

export default function MaintenancePage() {
  return <MaintenanceCard />
}
