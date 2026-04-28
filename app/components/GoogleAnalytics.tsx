'use client'

import Script from 'next/script'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Google Analytics 4 (GA4)。
 *
 * 環境変数 NEXT_PUBLIC_GA_MEASUREMENT_ID に GA4 の Measurement ID (G-XXXXXXXXXX) を設定。
 * 未設定なら一切何も出さない (本番だけ計測される)。
 *
 * SPA ルート遷移 (Next.js App Router) でもページビューを送信するため、
 * pathname / searchParams 監視で page_view イベントを手動 dispatch。
 */
export default function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!measurementId) return
    if (typeof window === 'undefined') return
    const w = window as unknown as { gtag?: (...args: unknown[]) => void }
    if (typeof w.gtag !== 'function') return

    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')
    w.gtag('event', 'page_view', {
      page_path: url,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [pathname, searchParams, measurementId])

  if (!measurementId) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}', {
            send_page_view: false
          });
        `}
      </Script>
    </>
  )
}
