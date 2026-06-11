'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { initAds, showAppBanner, hideAppBanner } from '../lib/ads'

/**
 * 広告の初期化とバナー表示制御を行う常駐コンポーネント (layout.tsx にマウント)。
 * 描画は何もしない。
 *
 * バナーを出すルート:
 *   - `/`      … メインアプリ (ホーム/検索/フィード/リスト/プロフィールのタブ)
 *   - `/games` … ミニゲームハブ (一覧画面)
 *
 * 個別ゲーム画面 (/games/xxx) はプレイの邪魔になるためバナーなし。
 * 代わりに結果画面でインタースティシャルを出す (GameShareButtons 経由)。
 * その他のルート (fasting / agey / 公開ページ等) は表示崩れ検証が済むまで対象外。
 */
const BANNER_ROUTES = new Set(['/', '/games'])

export default function AdsInit() {
  const pathname = usePathname()

  useEffect(() => {
    // initAds は共有 Promise なので何度呼んでも初期化は一度だけ。
    // パス変化のたびに同じ Promise へ .then を積む形になり、コールバックは
    // 登録順に実行されるため、初期化完了が遅れても最新パスの判定が最後に勝つ。
    void initAds().then(() => {
      if (BANNER_ROUTES.has(pathname)) {
        void showAppBanner()
      } else {
        void hideAppBanner()
      }
    })
  }, [pathname])

  return null
}
