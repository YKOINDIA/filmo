/**
 * マッチ度計算 - Phase 1: ルールベース（ジャンル・監督・俳優）
 *
 * ユーザーの鑑賞履歴（watchlist + score）から嗜好プロファイルを構築し、
 * 各作品に対する「マッチ度 0-100%」を算出する。
 */
import { supabase } from './supabase'

// ── Types ────────────────────────────────────────────────────────────

export interface TasteProfile {
  /** ジャンルID → 親和度 (0-1) */
  genreAffinity: Record<number, number>
  /** 高評価した監督ID set */
  likedDirectorIds: Set<number>
  /** 高評価した俳優ID set */
  likedActorIds: Set<number>
  /** プロファイル構築に使った評価数 */
  ratedCount: number
}

interface WatchlistRow {
  movie_id: number
  score: number | null
}

interface MovieRow {
  id: number
  tmdb_id: number
  genres: { id: number; name: string }[] | string
  credits: { cast?: { id: number }[]; crew?: { id: number; job: string }[] } | string
}

interface FanRow {
  person_id: number
  person_type: string
}

// ── Weights ──────────────────────────────────────────────────────────

const WEIGHT_GENRE = 0.60
const WEIGHT_DIRECTOR = 0.25
const WEIGHT_ACTOR = 0.15

/** score >= この値の作品から監督・俳優の好みを抽出 */
const HIGH_SCORE_THRESHOLD = 3.5

/** マッチ度表示の最低評価数 */
export const MIN_RATINGS_FOR_MATCH = 5

// ── Build Taste Profile ──────────────────────────────────────────────

export async function buildTasteProfile(userId: string): Promise<TasteProfile> {
  // 1. ユーザーの全評価済みwatchlistを取得
  const { data: watchlists } = await supabase
    .from('watchlists')
    .select('movie_id, score')
    .eq('user_id', userId)
    .eq('status', 'watched')
    .limit(500)

  const ratedEntries: WatchlistRow[] = (watchlists || []).filter(
    (w: WatchlistRow) => w.score != null && w.score > 0
  )

  if (ratedEntries.length === 0) {
    return { genreAffinity: {}, likedDirectorIds: new Set(), likedActorIds: new Set(), ratedCount: 0 }
  }

  // 2. 対応する映画データを取得（ジャンル・クレジット）
  const movieIds = ratedEntries.map(w => w.movie_id)
  const scoreMap = new Map(ratedEntries.map(w => [w.movie_id, w.score!]))

  // Batch fetch movies (PostgREST has URL length limits for large IN queries)
  const movies: MovieRow[] = []
  for (let i = 0; i < movieIds.length; i += 100) {
    const batch = movieIds.slice(i, i + 100)
    const { data } = await supabase
      .from('movies')
      .select('id, tmdb_id, genres, credits')
      .in('id', batch)
      .limit(100)
    if (data) movies.push(...(data as unknown as MovieRow[]))
  }

  // 3. ジャンル親和度を計算
  const genreScoreSum: Record<number, number> = {}
  const genreCount: Record<number, number> = {}

  const likedDirectorIds = new Set<number>()
  const likedActorIds = new Set<number>()

  for (const movie of movies) {
    const userScore = scoreMap.get(movie.id)
    if (userScore == null) continue

    // Parse genres (might be JSON string or array)
    const genres = typeof movie.genres === 'string' ? JSON.parse(movie.genres) : (movie.genres || [])
    for (const g of genres) {
      const gid = g.id || g
      genreScoreSum[gid] = (genreScoreSum[gid] || 0) + userScore
      genreCount[gid] = (genreCount[gid] || 0) + 1
    }

    // Extract directors/actors from high-rated movies
    if (userScore >= HIGH_SCORE_THRESHOLD) {
      const credits = typeof movie.credits === 'string' ? JSON.parse(movie.credits) : (movie.credits || {})
      if (credits.crew) {
        for (const c of credits.crew) {
          if (c.job === 'Director') likedDirectorIds.add(c.id)
        }
      }
      if (credits.cast) {
        // Top 5 cast members
        for (const a of credits.cast.slice(0, 5)) {
          likedActorIds.add(a.id)
        }
      }
    }
  }

  // 4. Fan!登録も追加
  const { data: fans } = await supabase
    .from('fans')
    .select('person_id, person_type')
    .eq('user_id', userId)
    .limit(200)

  if (fans) {
    for (const f of fans as unknown as FanRow[]) {
      if (f.person_type === 'director') likedDirectorIds.add(f.person_id)
      if (f.person_type === 'actor') likedActorIds.add(f.person_id)
    }
  }

  // 5. ジャンル親和度を正規化 (0-1)
  const genreAffinity: Record<number, number> = {}
  for (const gid of Object.keys(genreScoreSum)) {
    const id = Number(gid)
    const avg = genreScoreSum[id] / genreCount[id] // 0.5-5.0
    genreAffinity[id] = (avg - 0.5) / 4.5 // normalize to 0-1
  }

  return {
    genreAffinity,
    likedDirectorIds,
    likedActorIds,
    ratedCount: ratedEntries.length,
  }
}

// ── Calculate Match Score ────────────────────────────────────────────

interface MovieForMatch {
  genre_ids?: number[]
  genres?: { id: number; name: string }[]
  credits?: {
    cast?: { id: number }[]
    crew?: { id: number; job: string }[]
  }
}

export function calculateMatchScore(
  profile: TasteProfile,
  movie: MovieForMatch,
): number | null {
  if (profile.ratedCount < MIN_RATINGS_FOR_MATCH) return null

  // Genre match
  const genreIds = movie.genre_ids || (movie.genres?.map(g => g.id)) || []
  let genreScore = 0
  if (genreIds.length > 0) {
    let totalAffinity = 0
    let matched = 0
    for (const gid of genreIds) {
      if (profile.genreAffinity[gid] != null) {
        totalAffinity += profile.genreAffinity[gid]
        matched++
      }
    }
    genreScore = matched > 0 ? totalAffinity / matched : 0.5 // unknown genres → neutral
  } else {
    genreScore = 0.5
  }

  // Director match
  let directorScore = 0
  const crew = movie.credits?.crew || []
  const directors = crew.filter(c => c.job === 'Director')
  if (directors.length > 0) {
    directorScore = directors.some(d => profile.likedDirectorIds.has(d.id)) ? 1 : 0
  }

  // Actor match
  let actorScore = 0
  const cast = movie.credits?.cast || []
  if (cast.length > 0) {
    const topCast = cast.slice(0, 10)
    const matchedActors = topCast.filter(a => profile.likedActorIds.has(a.id)).length
    actorScore = matchedActors / Math.min(5, topCast.length)
  }

  // Weighted sum → percentage
  const raw = WEIGHT_GENRE * genreScore + WEIGHT_DIRECTOR * directorScore + WEIGHT_ACTOR * actorScore

  // Scale to 40-99 range (avoid showing very low or 100%)
  const scaled = Math.round(40 + raw * 55)
  return Math.min(99, Math.max(40, scaled))
}

// ── Simple match for cards (genre only, no credits) ──────────────────

export function calculateGenreMatchScore(
  profile: TasteProfile,
  genreIds: number[],
): number | null {
  if (profile.ratedCount < MIN_RATINGS_FOR_MATCH) return null
  if (genreIds.length === 0) return null

  let totalAffinity = 0
  let matched = 0
  for (const gid of genreIds) {
    if (profile.genreAffinity[gid] != null) {
      totalAffinity += profile.genreAffinity[gid]
      matched++
    }
  }
  const genreScore = matched > 0 ? totalAffinity / matched : 0.5

  // Genre-only → scale to 45-95 range
  const scaled = Math.round(45 + genreScore * 50)
  return Math.min(95, Math.max(45, scaled))
}
