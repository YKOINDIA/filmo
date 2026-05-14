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

export const trackPersonReviewPosted = (personId: number, score?: number, isDraft?: boolean) =>
  track('person_review_posted', { person_id: personId, score: score ?? 0, is_draft: isDraft ?? false })

export const trackPersonRegistered = (personId: number, department?: string) =>
  track('person_registered', { person_id: personId, department: department || 'unknown' })

export const trackPersonEditProposed = (personId: number, changedFields: number) =>
  track('person_edit_proposed', { person_id: personId, changed_fields: changedFields })

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

export const trackMinigameShared = (
  channel: 'twitter' | 'system' | 'copy_link',
  correctCount: number,
  score: number,
) => track('minigame_shared', { share_channel: channel, correct_count: correctCount, score })

export const trackSignUp = (method: 'email' | 'google' | 'apple') =>
  track('sign_up', { method })

// ========== Funnel / Drop-off tracking (離脱ポイント分析) ==========

// --- Auth funnel ---
export const trackAuthStarted = (mode: 'login' | 'signup') =>
  track('auth_started', { mode })

export const trackAuthFailed = (mode: 'login' | 'signup', reason: string) =>
  track('auth_failed', { mode, error_reason: reason.slice(0, 100) })

export const trackSignIn = () =>
  track('sign_in', {})

// --- Onboarding funnel ---
export const trackOnboardingStep = (step: 0 | 1 | 2 | 3, action: 'view' | 'complete' | 'skip') =>
  track('onboarding_step', { step, action })

export const trackOnboardingComplete = (ratingsCount: number, fansCount: number) =>
  track('onboarding_complete', { ratings_count: ratingsCount, fans_count: fansCount })

// --- Tab navigation ---
export const trackTabChanged = (fromTab: string, toTab: string) =>
  track('tab_changed', { from_tab: fromTab, to_tab: toTab })

// --- Work detail / Watchlist funnel ---
export const trackWorkDetailOpened = (tmdbId: number, mediaType: 'movie' | 'tv', source: string) =>
  track('work_detail_opened', { tmdb_id: tmdbId, media_type: mediaType, source })

export const trackWatchStatusChanged = (tmdbId: number, status: string, hadPrevious: boolean) =>
  track('watch_status_changed', { tmdb_id: tmdbId, status, had_previous: hadPrevious })

export const trackScoreSet = (tmdbId: number, score: number) =>
  track('score_set', { tmdb_id: tmdbId, score })

export const trackAuthGateHit = (feature: string) =>
  track('auth_gate_hit', { feature })

// --- Review funnel ---
export const trackReviewStarted = (tmdbId: number) =>
  track('review_started', { tmdb_id: tmdbId })

export const trackReviewAbandoned = (tmdbId: number, bodyLength: number) =>
  track('review_abandoned', { tmdb_id: tmdbId, body_length: bodyLength })

// --- List funnel ---
export const trackListStarted = () =>
  track('list_started', {})

export const trackListItemAdded = (listId: string) =>
  track('list_item_added', { list_id: listId })

// --- Search funnel ---
export const trackSearchNoResults = (query: string, tab: string) =>
  track('search_no_results', { query: query.slice(0, 100), tab })

export const trackGenreBrowsed = (genreName: string, mediaType: string) =>
  track('genre_browsed', { genre_name: genreName, media_type: mediaType })

export const trackFilterApplied = (filterType: string, filterValue: string) =>
  track('filter_applied', { filter_type: filterType, filter_value: filterValue })
