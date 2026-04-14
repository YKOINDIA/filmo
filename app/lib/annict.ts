/**
 * Annict GraphQL API クライアント
 *
 * アニメ専門データソースとして TMDB を補完する。
 * Annict は日本のアニメに特化しており、TMDB にない作品やキャスト情報を提供する。
 */

const ANNICT_ENDPOINT = 'https://api.annict.com/graphql'
const ANNICT_TOKEN = process.env.ANNICT_ACCESS_TOKEN || ''

interface AnnictWork {
  annictId: number
  title: string
  titleEn: string | null
  titleKana: string | null
  media: string // TV, MOVIE, OVA, ONA, WEB
  seasonYear: number | null
  seasonName: string | null // SPRING, SUMMER, AUTUMN, WINTER
  episodesCount: number
  watchersCount: number
  satisfactionRate: number | null
  officialSiteUrl: string | null
  wikipediaUrl: string | null
  twitterHashtag: string | null
  malAnimeId: string | null
  image: { recommendedImageUrl: string | null } | null
}

interface AnnictSearchResult {
  searchWorks: {
    nodes: AnnictWork[]
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
  }
}

export interface AnnictWorkNormalized {
  id: number // negative: -(annictId + 1_000_000) to avoid collision with user works
  annict_id: number
  title: string
  original_title: string | null
  media_type: 'tv' | 'movie'
  release_date: string | null
  poster_path: string | null
  vote_average: number
  watchers_count: number
  episodes_count: number
  data_source: 'annict'
}

async function annictQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!ANNICT_TOKEN) {
    throw new Error('ANNICT_ACCESS_TOKEN is not set')
  }

  const res = await fetch(ANNICT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `bearer ${ANNICT_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 3600 },
  })

  if (!res.ok) {
    throw new Error(`Annict API error: ${res.status}`)
  }

  const json = await res.json()
  if (json.errors) {
    throw new Error(`Annict GraphQL error: ${json.errors[0]?.message}`)
  }

  return json.data as T
}

/**
 * タイトルでアニメを検索
 */
export async function searchAnnictWorks(
  title: string,
  first = 20,
): Promise<AnnictWorkNormalized[]> {
  const query = `
    query SearchWorks($title: String!, $first: Int!) {
      searchWorks(titles: [$title], first: $first, orderBy: { field: WATCHERS_COUNT, direction: DESC }) {
        nodes {
          annictId
          title
          titleEn
          titleKana
          media
          seasonYear
          seasonName
          episodesCount
          watchersCount
          satisfactionRate
          officialSiteUrl
          wikipediaUrl
          malAnimeId
          image {
            recommendedImageUrl
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `

  const data = await annictQuery<AnnictSearchResult>(query, { title, first })
  return data.searchWorks.nodes.map(normalizeWork)
}

/**
 * 放送シーズンでアニメを取得
 */
export async function getAnnictSeasonWorks(
  year: number,
  season: 'spring' | 'summer' | 'autumn' | 'winter',
  first = 30,
): Promise<AnnictWorkNormalized[]> {
  const seasonStr = `${year}-${season}`

  const query = `
    query SeasonWorks($seasons: [String!], $first: Int!) {
      searchWorks(seasons: $seasons, first: $first, orderBy: { field: WATCHERS_COUNT, direction: DESC }) {
        nodes {
          annictId
          title
          titleEn
          titleKana
          media
          seasonYear
          seasonName
          episodesCount
          watchersCount
          satisfactionRate
          officialSiteUrl
          wikipediaUrl
          malAnimeId
          image {
            recommendedImageUrl
          }
        }
      }
    }
  `

  const data = await annictQuery<AnnictSearchResult>(query, { seasons: [seasonStr], first })
  return data.searchWorks.nodes.map(normalizeWork)
}

/**
 * Annict Work → 統一フォーマットに変換
 */
function normalizeWork(work: AnnictWork): AnnictWorkNormalized {
  const mediaType = work.media === 'MOVIE' ? 'movie' : 'tv'

  // シーズンからリリース日を推定
  let releaseDate: string | null = null
  if (work.seasonYear) {
    const monthMap: Record<string, string> = {
      SPRING: '04', SUMMER: '07', AUTUMN: '10', WINTER: '01',
    }
    const month = work.seasonName ? monthMap[work.seasonName] || '01' : '01'
    releaseDate = `${work.seasonYear}-${month}-01`
  }

  // satisfactionRate (0-100) → 10点満点に変換
  const voteAverage = work.satisfactionRate ? (work.satisfactionRate / 10) : 0

  return {
    id: -(work.annictId + 1_000_000), // Annict用の負ID空間
    annict_id: work.annictId,
    title: work.title,
    original_title: work.titleEn,
    media_type: mediaType,
    release_date: releaseDate,
    poster_path: work.image?.recommendedImageUrl || null,
    vote_average: voteAverage,
    watchers_count: work.watchersCount,
    episodes_count: work.episodesCount,
    data_source: 'annict' as const,
  }
}

/**
 * Annict API が利用可能かチェック
 */
export function isAnnictAvailable(): boolean {
  return !!ANNICT_TOKEN
}
