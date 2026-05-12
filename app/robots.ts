import type { MetadataRoute } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'

/**
 * robots.txt
 *
 * 公開コンテンツ (ホーム・リスト・プロフィール・人物一覧) は全クローラ許可。
 * 管理画面・API は除外。Sitemap への参照を含める。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',         // 管理画面
          '/api/',          // 内部 API
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  }
}
