import type { MetadataRoute } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * 動的 sitemap.
 *
 * Google Search Console / Bing 等のクローラに、Filmo の公開ページ
 * (ホーム・固定ページ + 動的ページ群) を伝える。
 *
 * 動的ページ:
 *  - 公開リスト ( /lists/[slug] )
 *  - 公開プロフィール ( /u/[id] ※ is_profile_public=true のみ )
 *
 * 100万ユーザー想定でも sitemap は分割不要(最大 50,000件まで OK)。
 * その上限を超える場合は sitemapIndex に分割するが、現状では不要。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: APP_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${APP_URL}/landing`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${APP_URL}/lists`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${APP_URL}/directors`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${APP_URL}/screenwriters`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${APP_URL}/legal`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
    { url: `${APP_URL}/support`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
  ]

  // 動的ページは Supabase から service-role で集める。
  // Build / revalidate 時に呼ばれる server-only コード。
  const dynamicEntries: MetadataRoute.Sitemap = []

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 公開リスト (curated + 一般公開リスト)
    const { data: lists } = await admin
      .from('user_lists')
      .select('id, slug, updated_at, is_public, items_count')
      .eq('is_public', true)
      .gt('items_count', 0)
      .order('updated_at', { ascending: false })
      .limit(5000)
    for (const l of (lists || []) as { id: string; slug: string | null; updated_at: string }[]) {
      dynamicEntries.push({
        url: `${APP_URL}/lists/${encodeURIComponent(l.slug || l.id)}`,
        lastModified: new Date(l.updated_at),
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }

    // 公開プロフィール (is_profile_public=true、BAN 除外)
    const { data: users } = await admin
      .from('users')
      .select('id, updated_at, is_profile_public, is_banned')
      .eq('is_profile_public', true)
      .eq('is_banned', false)
      .order('updated_at', { ascending: false })
      .limit(10000)
    for (const u of (users || []) as { id: string; updated_at: string }[]) {
      dynamicEntries.push({
        url: `${APP_URL}/u/${u.id}`,
        lastModified: new Date(u.updated_at),
        changeFrequency: 'weekly',
        priority: 0.4,
      })
    }
  } catch (err) {
    // Supabase 接続失敗時は静的エントリだけでも返す (sitemap が空になるよりマシ)
    console.error('sitemap dynamic fetch failed:', err)
  }

  return [...staticEntries, ...dynamicEntries]
}

// 6時間ごとに再生成(新規リスト・プロフィールの反映用)
export const revalidate = 21600
