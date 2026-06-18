// ============================================================
// 映画偏差値 (Eiga Hensachi)
// ============================================================
// 「見た映画が増えるほど上がる」体感を、母集団集計なしの計算式で実現する。
// 視聴本数を主因に、ジャンルの多様性とレビュー数を加点。
// 基準 40 から 80 でクランプ (偏差値の見た目に寄せた擬似スコア)。
// DB カラムは持たず、watchlist 等から算出する純関数として扱う。

import { supabase } from './supabase'

export interface HensachiInput {
  watchedCount: number // status = 'watched' の本数
  genreDiversity: number // 視聴作品に登場した異なるジャンル数
  reviewCount: number // 公開済みレビュー数
}

export const HENSACHI_MIN = 40
export const HENSACHI_MAX = 80

/**
 * 映画偏差値を算出する (40〜80)。
 * - 視聴本数: 最大 +30 (平方根カーブで逓減。400 本で頭打ち)
 * - ジャンル多様性: 最大 +7 (12 ジャンルで頭打ち)
 * - レビュー数: 最大 +5 (60 件で頭打ち)
 */
export function computeHensachi(input: HensachiInput): number {
  const { watchedCount, genreDiversity, reviewCount } = input

  const watchedCap = 400
  const watchedC = 30 * Math.sqrt(Math.min(Math.max(watchedCount, 0), watchedCap)) / Math.sqrt(watchedCap)
  const divC = 7 * Math.min(Math.max(genreDiversity, 0), 12) / 12
  const reviewC = 5 * Math.min(Math.max(reviewCount, 0), 60) / 60

  const raw = HENSACHI_MIN + watchedC + divC + reviewC
  return Math.round(Math.min(HENSACHI_MAX, Math.max(HENSACHI_MIN, raw)))
}

export interface HensachiRank {
  label: string
  color: string
}

/** 偏差値帯に応じたランク名と色を返す。 */
export function getHensachiRank(value: number): HensachiRank {
  if (value >= 73) return { label: '映画マスター', color: '#ff4444' }
  if (value >= 65) return { label: 'シネフィル級', color: '#9c27b0' }
  if (value >= 55) return { label: '映画好き', color: '#3498db' }
  if (value >= 45) return { label: '映画ファン', color: '#2ecc8a' }
  return { label: '映画ビギナー', color: '#888888' }
}

/**
 * ユーザーの視聴データから映画偏差値の算出に必要な指標を取得する。
 * watchlists (watched) と reviews を参照し、ジャンル多様性は movies.genres から集計。
 * 失敗時は控えめな既定値を返す。
 */
export async function loadHensachiStats(userId: string): Promise<HensachiInput> {
  const fallback: HensachiInput = { watchedCount: 0, genreDiversity: 0, reviewCount: 0 }
  try {
    const [{ data: wl }, { count: reviewCount }] = await Promise.all([
      supabase
        .from('watchlists')
        .select('movie_id')
        .eq('user_id', userId)
        .eq('status', 'watched')
        .limit(1000),
      supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_draft', false),
    ])

    const watched = wl ?? []
    const watchedCount = watched.length

    let genreDiversity = 0
    if (watchedCount > 0) {
      const movieIds = watched.map(w => w.movie_id)
      const { data: movies } = await supabase
        .from('movies')
        .select('genres')
        .in('id', movieIds)
        .limit(1000)
      const genreSet = new Set<number>()
      for (const m of movies ?? []) {
        const genres = (m.genres ?? []) as { id: number }[]
        for (const g of genres) {
          if (typeof g?.id === 'number') genreSet.add(g.id)
        }
      }
      genreDiversity = genreSet.size
    }

    return { watchedCount, genreDiversity, reviewCount: reviewCount ?? 0 }
  } catch {
    return fallback
  }
}

/** 指標の取得から偏差値算出までを一括で行うヘルパー。 */
export async function loadHensachi(userId: string): Promise<{ value: number; rank: HensachiRank; stats: HensachiInput }> {
  const stats = await loadHensachiStats(userId)
  const value = computeHensachi(stats)
  return { value, rank: getHensachiRank(value), stats }
}
