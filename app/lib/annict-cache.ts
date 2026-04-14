/**
 * Annict Cache Layer
 * Annict検索結果をSupabase DBにキャッシュし、moviesテーブルに統合する。
 */
import { getSupabaseAdmin } from './supabase-admin'
import { searchAnnictWorks, getAnnictSeasonWorks, isAnnictAvailable, type AnnictWorkNormalized } from './annict'

const CACHE_TTL_HOURS = 72 // Annictデータは72時間キャッシュ

function isWithinHours(cachedAt: string, hours: number): boolean {
  const cached = new Date(cachedAt).getTime()
  return (Date.now() - cached) < hours * 60 * 60 * 1000
}

/**
 * Annict検索 + DBキャッシュ統合
 * 1. まずDBの annict_id 付きレコードからタイトル検索
 * 2. Annict APIが利用可能ならAPI検索し、結果をDBにupsert
 */
export async function searchAnnictCached(title: string): Promise<AnnictWorkNormalized[]> {
  const supabase = getSupabaseAdmin()

  // DBキャッシュから検索
  const { data: cached } = await supabase
    .from('movies')
    .select('id, title, original_title, media_type, release_date, poster_path, vote_average, annict_id, data_source, cached_at')
    .eq('data_source', 'annict')
    .or(`title.ilike.%${title}%,original_title.ilike.%${title}%`)
    .order('vote_average', { ascending: false })
    .limit(20)

  // キャッシュが新鮮なら返す
  if (cached && cached.length > 0) {
    const freshest = cached[0]
    if (freshest.cached_at && isWithinHours(freshest.cached_at, CACHE_TTL_HOURS)) {
      return cached.map(row => ({
        id: row.id,
        annict_id: row.annict_id || 0,
        title: row.title,
        original_title: row.original_title,
        media_type: row.media_type as 'movie' | 'tv',
        release_date: row.release_date,
        poster_path: row.poster_path,
        vote_average: row.vote_average || 0,
        watchers_count: 0,
        episodes_count: 0,
        data_source: 'annict' as const,
      }))
    }
  }

  // Annict APIが利用不可ならキャッシュだけ返す
  if (!isAnnictAvailable()) {
    return (cached || []).map(row => ({
      id: row.id,
      annict_id: row.annict_id || 0,
      title: row.title,
      original_title: row.original_title,
      media_type: row.media_type as 'movie' | 'tv',
      release_date: row.release_date,
      poster_path: row.poster_path,
      vote_average: row.vote_average || 0,
      watchers_count: 0,
      episodes_count: 0,
      data_source: 'annict' as const,
    }))
  }

  // Annict API検索
  try {
    const results = await searchAnnictWorks(title)
    // DBにupsert
    await upsertAnnictWorks(results)
    return results
  } catch {
    // API失敗時はキャッシュを返す
    return (cached || []).map(row => ({
      id: row.id,
      annict_id: row.annict_id || 0,
      title: row.title,
      original_title: row.original_title,
      media_type: row.media_type as 'movie' | 'tv',
      release_date: row.release_date,
      poster_path: row.poster_path,
      vote_average: row.vote_average || 0,
      watchers_count: 0,
      episodes_count: 0,
      data_source: 'annict' as const,
    }))
  }
}

/**
 * 今期のアニメを取得（シーズン指定）
 */
export async function getSeasonAnimeCached(
  year: number,
  season: 'spring' | 'summer' | 'autumn' | 'winter',
): Promise<AnnictWorkNormalized[]> {
  if (!isAnnictAvailable()) return []

  try {
    const results = await getAnnictSeasonWorks(year, season)
    await upsertAnnictWorks(results)
    return results
  } catch {
    return []
  }
}

/**
 * Annict作品をmoviesテーブルにupsert
 */
async function upsertAnnictWorks(works: AnnictWorkNormalized[]): Promise<void> {
  if (works.length === 0) return
  const supabase = getSupabaseAdmin()

  for (const work of works) {
    // annict_idで既存チェック
    const { data: existing } = await supabase
      .from('movies')
      .select('id')
      .eq('annict_id', work.annict_id)
      .limit(1)
      .maybeSingle()

    if (existing) {
      // 既存レコード更新
      await supabase.from('movies').update({
        title: work.title,
        original_title: work.original_title,
        vote_average: work.vote_average,
        release_date: work.release_date,
        poster_path: work.poster_path,
        cached_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      // 新規挿入（負のIDを生成）
      const { data: minRow } = await supabase
        .from('movies')
        .select('id')
        .order('id', { ascending: true })
        .limit(1)
        .single()
      const newId = Math.min((minRow?.id || 0) - 1, -1)

      await supabase.from('movies').insert({
        id: newId,
        tmdb_id: null,
        annict_id: work.annict_id,
        title: work.title,
        original_title: work.original_title,
        overview: null,
        media_type: work.media_type,
        release_date: work.release_date,
        poster_path: work.poster_path,
        backdrop_path: null,
        vote_average: work.vote_average,
        vote_count: work.watchers_count,
        genres: [{ id: 16, name: 'アニメ' }],
        production_countries: [{ iso_3166_1: 'JP', name: 'Japan' }],
        credits: { cast: [], crew: [] },
        data_source: 'annict',
        is_verified: true,
        cached_at: new Date().toISOString(),
      }).onConflict('annict_id').ignore()
    }
  }
}
