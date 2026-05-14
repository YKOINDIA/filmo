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
 *  - 作品ページ ( /movies/[id], /tv/[id] ※ poster_path 持ちのみ)
 *  - 人物ページ ( /people/[id] ※ profile_path 持ちのみ)
 *
 * Google の 1 sitemap あたり上限は 50,000 URL。
 * (作品 × 2 type) + 人物 + 既存 lists/users で 60K を超えそうなら
 * generateSitemaps による分割が必要。当面は各カテゴリでキャップする。
 */
const WORK_LIMIT_PER_TYPE = 20000
const PERSON_LIMIT = 15000
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

    // 作品ページ (poster を持つ verified 作品のみ、人気順)。
    // TMDB 作品 + ユーザー登録作品(負ID)を同列に扱う。
    // TODO: 30K 超になったら app/movies/sitemap.ts に切り出して generateSitemaps で分割。
    for (const mediaType of ['movie', 'tv'] as const) {
      const { data: works } = await admin
        .from('movies')
        .select('id, tmdb_id, cached_at, vote_count, poster_path')
        .eq('media_type', mediaType)
        .not('poster_path', 'is', null)
        .order('vote_count', { ascending: false, nullsFirst: false })
        .limit(WORK_LIMIT_PER_TYPE)
      const path = mediaType === 'movie' ? 'movies' : 'tv'
      const rows = (works || []) as { id: number; tmdb_id: number | null; cached_at: string; poster_path: string }[]
      for (const w of rows) {
        // tmdb_id が null = ユーザー登録作品。負の id をそのまま使う。
        const idForUrl = w.tmdb_id ?? w.id
        // ユーザー登録作品は完全 URL を保存しているケースがあるので両対応。
        const imageUrl = w.poster_path.startsWith('http')
          ? w.poster_path
          : `https://image.tmdb.org/t/p/w500${w.poster_path}`
        dynamicEntries.push({
          url: `${APP_URL}/${path}/${idForUrl}`,
          lastModified: w.cached_at ? new Date(w.cached_at) : new Date(),
          changeFrequency: 'monthly',
          priority: 0.6,
          images: [imageUrl],
        })
      }
    }

    // 人物ページ (profile_path を持つ persons のみ、新しいものから)
    // ユーザー登録 (tmdb_id IS NULL) も含めるため id を fallback として使用。
    const { data: persons } = await admin
      .from('persons')
      .select('id, tmdb_id, profile_path, cached_at')
      .not('profile_path', 'is', null)
      .order('cached_at', { ascending: false })
      .limit(PERSON_LIMIT)
    const personRows = (persons || []) as { id: number; tmdb_id: number | null; profile_path: string; cached_at: string }[]
    for (const p of personRows) {
      const idForUrl = p.tmdb_id ?? p.id
      const imageUrl = p.profile_path.startsWith('http')
        ? p.profile_path
        : `https://image.tmdb.org/t/p/w300${p.profile_path}`
      dynamicEntries.push({
        url: `${APP_URL}/people/${idForUrl}`,
        lastModified: p.cached_at ? new Date(p.cached_at) : new Date(),
        changeFrequency: 'monthly',
        priority: 0.5,
        images: [imageUrl],
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
