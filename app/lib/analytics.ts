/**
 * Filmo Analytics — GA4 ラッパー。
 *
 * 設計方針:
 *   - gtag が無い環境 (env 未設定 / SSR) では完全 no-op
 *   - エラーで握りつぶす (analytics 起因でアプリが落ちないように)
 *   - イベント名は GA4 推奨スネークケース
 *   - パラメータは custom_* の prefix を付けないシンプル名 (GA4 でカスタムパラメータとして自動収集)
 *
 * 使用例:
 *   import { track, setUserContext } from '@/lib/analytics'
 *   setUserContext({ locale: 'ja', country: 'JP', authenticated: true, level: 5 })
 *   track('review_posted', { movie_id: 123, score: 4 })
 */

type GtagFn = (...args: unknown[]) => void

function getGtag(): GtagFn | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { gtag?: GtagFn }
  return typeof w.gtag === 'function' ? w.gtag : null
}

// ========== User context (user-scoped properties) ==========

export interface UserContext {
  locale?: string             // 'ja' | 'en' | 'ko' | 'zh' | 'es' (Filmo i18n の選択)
  country?: string | null     // ISO 2-letter (users.country)
  authenticated?: boolean
  level?: number              // gamification level
}

/**
 * ログイン状態 / locale / country などをユーザープロパティとして送る。
 * セッション中ずっと有効。値が変わったら呼び直す (locale 切替・ログイン時など)。
 */
export function setUserContext(ctx: UserContext): void {
  const gtag = getGtag()
  if (!gtag) return
  try {
    const props: Record<string, string | number> = {}
    if (ctx.locale !== undefined) props.app_locale = ctx.locale
    if (ctx.country !== undefined && ctx.country) props.user_country = ctx.country
    if (ctx.authenticated !== undefined) props.user_authenticated = ctx.authenticated ? 'true' : 'false'
    if (ctx.level !== undefined) {
      // バケット化 (1-3 / 4-7 / 8+) で、レベル分布が荒すぎないように
      props.user_level_bucket = ctx.level <= 3 ? '1-3' : ctx.level <= 7 ? '4-7' : '8+'
    }
    if (Object.keys(props).length === 0) return
    gtag('set', 'user_properties', props)
  } catch { /* ignore */ }
}

// ========== Generic event ==========

/**
 * 任意の GA4 イベントを送る薄いラッパー。
 * Filmo 既知のイベントは下の helper を使う方が型安全。
 */
export function track(eventName: string, params: Record<string, unknown> = {}): void {
  const gtag = getGtag()
  if (!gtag) return
  try {
    gtag('event', eventName, params)
  } catch { /* ignore */ }
}

// ========== Filmo-specific event helpers (型安全) ==========

export const trackReviewPosted = (movieId: number, score?: number, isDraft?: boolean) =>
  track('review_posted', { movie_id: movieId, score: score ?? 0, is_draft: isDraft ?? false })

export const trackListCreated = (listId: string, isPublic: boolean, isCollaborative: boolean) =>
  track('list_created', { list_id: listId, is_public: isPublic, is_collaborative: isCollaborative })

export const trackListLiked = (listId: string) =>
  track('list_liked', { list_id: listId })

export const trackListForked = (sourceListId: string, newListId: string) =>
  track('list_forked', { source_list_id: sourceListId, new_list_id: newListId })

export const trackListShared = (listId: string, channel: 'twitter' | 'line' | 'copy_link' | 'system') =>
  track('list_shared', { list_id: listId, share_channel: channel })

export const trackLanguageChanged = (from: string, to: string) =>
  track('language_changed', { from_lang: from, to_lang: to })

export const trackSearchPerformed = (query: string, tab: string, resultsCount: number) =>
  track('search_performed', { query: query.slice(0, 100), tab, results_count: resultsCount })

export const trackWorkOpened = (tmdbId: number, mediaType: 'movie' | 'tv', source?: string) =>
  track('work_opened', { tmdb_id: tmdbId, media_type: mediaType, source: source || 'unknown' })

export const trackTranslateClicked = (fromLang: string, toLang: string) =>
  track('translate_clicked', { from_lang: fromLang, to_lang: toLang })

export const trackFollow = (targetUserId: string, action: 'follow' | 'unfollow') =>
  track(action === 'follow' ? 'user_followed' : 'user_unfollowed', { target_user_id: targetUserId })

export const trackProfileShared = (channel: 'twitter' | 'line' | 'copy_link' | 'system') =>
  track('profile_shared', { share_channel: channel })

export const trackSignUp = (method: 'email' | 'google' | 'apple') =>
  track('sign_up', { method })
