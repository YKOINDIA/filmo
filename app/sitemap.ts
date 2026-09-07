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
 *  - 作品ページ ( /movies/[id], /tv/[id] ※ レビュー有り or 視聴者5人以上のみ)
 *  - 人物ページ ( /people/[id] ※ レビュー 1 件以上 かつ profile_path 持ちのみ)
 *
 * Google の 1 sitemap あたり上限は 50,000 URL。
 * (作品 × 2 type) + 人物 + 既存 lists/users で 60K を超えそうなら
 * generateSitemaps による分割が必要。当面は各カテゴリでキャップする。
 */
// sitemap に載せる作品の上限 (Google の 1 sitemap 50,000 URL 制限に対する保険)。
const WORK_LIMIT = 20000
const PERSON_LIMIT = 15000
// shouldIndexWork() と同じ閾値。ここを変えるときは PublicWorkView.tsx も合わせる。
const WATCHER_THRESHOLD = 5
// 集計元テーブルの読み取り上限。超えた分は sitemap から漏れるだけで壊れはしない。
const REVIEW_CAP = 20000
const WATCHLIST_CAP = 50000
// .in() に渡す ID 数の上限 (URL 長対策)。
const ID_CHUNK = 500

/**
 * Supabase の 1 クエリ既定上限 (1000 行) を超えて全件取得する。
 *
 * 深い range() は movies のような大テーブルで statement timeout になるが、
 * ここで使う reviews / watchlists は PK 順の浅いページングなので問題ない。
 * cap に達したら打ち切る (sitemap が不完全になるだけで、落ちるよりマシ)。
 */
async function fetchPaged<T>(
  cap: number,
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = await query(from, Math.min(from + PAGE, cap) - 1)
    if (error || !data?.length) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}
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

    // 作品ページ (レビュー有り または 視聴者 WATCHER_THRESHOLD 人以上)。
    // TMDB 作品 + ユーザー登録作品(負ID)を同列に扱う。
    //
    // 条件は shouldIndexWork() と揃える。以前は「poster_path 持ちを vote_count 順に
    // 20,000 件」だったが、これは TMDB の人気順であって Filmo 上のコンテンツ量とは
    // 無関係で、大半が noindex のページを申告することになっていた
    // (2026-09-07 時点で indexable な作品は約 10 件。人物側と同じ問題)。
    //
    // なお旧クエリは movies (約 90 万行) の vote_count 順ソートで
    // statement timeout (57014) になっており、Supabase クライアントは例外を投げず
    // { data: null } を返すため、本番 sitemap には作品が 1 件も載っていなかった。
    const reviewRows = await fetchPaged<{ movie_id: number }>(REVIEW_CAP, (from, to) =>
      admin.from('reviews').select('movie_id').order('id', { ascending: true }).range(from, to),
    )
    const watchRows = await fetchPaged<{ movie_id: number }>(WATCHLIST_CAP, (from, to) =>
      admin.from('watchlists').select('movie_id').order('id', { ascending: true }).range(from, to),
    )
    const watcherCount = new Map<number, number>()
    for (const w of watchRows) watcherCount.set(w.movie_id, (watcherCount.get(w.movie_id) ?? 0) + 1)

    const indexableWorkIds = [...new Set([
      ...reviewRows.map(r => r.movie_id),
      ...[...watcherCount].filter(([, n]) => n >= WATCHER_THRESHOLD).map(([id]) => id),
    ])].slice(0, WORK_LIMIT)

    // .in() は URL 長の制約があるので分割する。
    for (let i = 0; i < indexableWorkIds.length; i += ID_CHUNK) {
      const { data: works } = await admin
        .from('movies')
        .select('id, tmdb_id, media_type, cached_at, poster_path')
        .in('id', indexableWorkIds.slice(i, i + ID_CHUNK))
        .not('poster_path', 'is', null)
      const rows = (works || []) as {
        id: number; tmdb_id: number | null; media_type: string; cached_at: string; poster_path: string
      }[]
      for (const w of rows) {
        const path = w.media_type === 'tv' ? 'tv' : 'movies'
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

    // 人物ページ (レビューが 1 件以上ある人物のみ)
    // ユーザー登録 (tmdb_id IS NULL) も含めるため id を fallback として使用。
    //
    // 条件は shouldIndexPerson() (= レビュー 1 件以上) と揃える。揃っていないと
    // noindex のページを sitemap で申告することになり、Search Console の
    // 「送信された URL が noindex です」を大量計上してクロールバジェットを浪費する。
    //
    // cached_at 順で拾ってはいけない: cached_at は /people/[id] へのアクセスで
    // 更新されるため、クローラが未知の TMDB ID を踏むだけで sitemap の先頭を
    // 乗っ取れてしまう (2026-09-07 にスクレイパーが 211K リクエストで実際に発生させ、
    // persons が 164 万行に膨張・sitemap 上位が全て当日分に置き換わった)。
    const { data: reviewed } = await admin
      .from('person_reviews')
      .select('person_id')
      .eq('is_hidden', false)
      .eq('is_draft', false)
      .limit(PERSON_LIMIT)
    const reviewedIds = [...new Set(((reviewed || []) as { person_id: number }[]).map(r => r.person_id))]

    const { data: persons } = reviewedIds.length
      ? await admin
          .from('persons')
          .select('id, tmdb_id, profile_path, cached_at')
          .in('id', reviewedIds)
          .not('profile_path', 'is', null)
      : { data: [] }
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
