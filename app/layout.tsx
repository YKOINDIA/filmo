import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from 'react'
import "./globals.css";
import { LocaleProviderWrapper } from "./components/LocaleProviderWrapper";
import GoogleAnalytics from "./components/GoogleAnalytics";
import MaintenanceCard from "./components/MaintenanceCard";

// 計画メンテナンス用キルスイッチ。Vercel の環境変数で `MAINTENANCE_MODE=1` を
// セットしてデプロイすると、サイト全体がメンテナンス画面に切り替わる。
// 解除は env を空にして再デプロイ。
//   ※ ISR キャッシュが残っている古いページは次の revalidate まで残るため、
//     即時切替が必要なときは Vercel Dashboard から「Redeploy」を 1 回叩く。
//   ※ env 評価はコンポーネント内で行い、静的ビルド時の baked-in を避ける。

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = 'https://filmo.me'

// metadata は意図的に静的に保つ (cookies() を読まない)。
// 多言語対応は client 側の LocaleProvider で UI 切替する設計に揃え、
// サーバー側で全リクエストごとに dictionary を解決する Fluid CPU コストを避ける。
// OG タグは ja 固定で許容 (Google も ja でインデックス)。
export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Filmo - 映画・ドラマ・アニメの記録・レビューサービス【完全無料】',
    template: '%s | Filmo',
  },
  description: '映画・ドラマ・アニメの鑑賞記録、レビュー、配信情報をまとめて管理。星評価、統計ビジュアライズ、ゲーミフィケーションで鑑賞体験をもっと楽しく。完全無料。',
  keywords: [
    '映画レビュー', 'ドラマレビュー', 'アニメレビュー', '鑑賞記録',
    '映画アプリ', '配信情報', 'Netflix', 'Disney+', 'U-NEXT',
    '映画ランキング', 'Filmo', 'フィルモ',
  ],
  authors: [{ name: 'Filmo', url: APP_URL }],
  creator: 'Filmo',
  publisher: 'Filmo',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  alternates: { canonical: APP_URL },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: APP_URL,
    siteName: 'Filmo',
    title: 'Filmo - 映画・ドラマ・アニメの記録・レビューサービス',
    description: '映画・ドラマ・アニメの鑑賞記録、レビュー、配信情報をまとめて管理。完全無料。',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Filmo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Filmo - 映画・ドラマ・アニメの記録・レビューサービス',
    description: '映画・ドラマ・アニメの鑑賞記録、レビュー、配信情報をまとめて管理。完全無料。',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Filmo' },
  formatDetection: { telephone: false },
  // Google Search Console / Bing Webmaster Tools の所有権確認用。
  // 値は環境変数で設定 (Vercel: Production / Preview 両方に登録)。
  // 未設定なら meta tag 自体が出力されないので安全。
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: '#08090d',
  width: 'device-width',
  initialScale: 1,
  // iOS の入力フォーカス時の自動ズーム&戻れない問題を防ぐためズーム禁止。
  // ネイティブアプリ感を出すため pinch-zoom も無効化。
  // 既にズームされた状態の人向けに maximumScale=1 で強制リセット。
  maximumScale: 1,
  userScalable: false,
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'Filmo',
      url: APP_URL,
      description: '映画・ドラマ・アニメの鑑賞記録・レビュー・配信情報サービス',
      applicationCategory: 'EntertainmentApplication',
      operatingSystem: 'iOS, Android, Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
      featureList: [
        '映画・ドラマ・アニメの鑑賞記録',
        '星評価・テキストレビュー',
        '配信サービス情報',
        '統計・ビジュアライズ',
        'ゲーミフィケーション',
        'ソーシャル機能',
        '完全無料',
      ],
    },
    {
      '@type': 'Organization',
      name: 'Filmo',
      url: APP_URL,
      logo: `${APP_URL}/icon-512.png`,
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const maintenanceMode = process.env.MAINTENANCE_MODE === '1'
  return (
    // suppressHydrationWarning: 下の inline script が hydration 前に data-theme 属性を
    // セットするため React の hydration mismatch 警告を抑止する。
    // この警告は iOS WKWebView では稀に致命的になるため (本番黒画面の原因報告あり)。
    <html lang="ja" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('filmo_theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();` }} />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Filmo" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* MAINTENANCE_MODE=1 のときはアプリ本体を一切マウントせず、メンテナンス
            カードだけ描画する。これにより Supabase / 各種クライアントの初期化や
            アプリ JS のエラー伝播を完全に止められる。 */}
        {maintenanceMode ? (
          <MaintenanceCard />
        ) : (
          <>
        {/* GA4: useSearchParams() を含むので Suspense 境界で囲む (Next.js App Router 要件) */}
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <LocaleProviderWrapper>{children}</LocaleProviderWrapper>
        {/*
          Service Worker は Capacitor WebView の標準オリジン (capacitor://) では
          動かず、エラーになる場合がある。明示的に http(s) スキームのときだけ登録。
          try/catch で SW 登録失敗を握りつぶし、初回読み込みが SW で hang しないようにする。
        */}
        <script dangerouslySetInnerHTML={{
          __html: `try{if('serviceWorker' in navigator && (location.protocol==='https:'||location.protocol==='http:')){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(e){console.log('SW fail:',e)})})}}catch(e){console.log('SW skip:',e)}`
        }} />
          </>
        )}
      </body>
    </html>
  );
}
