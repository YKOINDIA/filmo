import { supabase } from './supabase'

// Filmo レベルシステム（累積ポイント方式）
export const LEVEL_TITLES = [
  { level: 1,  title: '映画初心者',       points: 0,      color: '#888888' },
  { level: 5,  title: '映画好き',         points: 500,    color: '#2ecc8a' },
  { level: 10, title: 'シネフィル',        points: 2000,   color: '#3498db' },
  { level: 15, title: '映画通',           points: 5000,   color: '#9b59b6' },
  { level: 20, title: '映画マニア',        points: 8000,   color: '#e67e22' },
  { level: 25, title: 'シネマスター',      points: 14000,  color: '#f0c040' },
  { level: 30, title: '映画の達人',        points: 20000,  color: '#ff6b6b' },
  { level: 35, title: 'フィルムソムリエ',   points: 35000,  color: '#e91e63' },
  { level: 40, title: 'シネマの神',        points: 55000,  color: '#9c27b0' },
  { level: 45, title: '映画界の伝説',      points: 75000,  color: '#673ab7' },
  { level: 50, title: '永遠のシネフィル',   points: 100000, color: '#ff4444' },
]

export const getLevelFromPoints = (pts: number) => {
  let cur = LEVEL_TITLES[0]
  for (const t of LEVEL_TITLES) { if (pts >= t.points) cur = t }
  return cur
}

export const POINT_CONFIG = {
  REVIEW_LONG: 30,
  REVIEW_SHORT: 10,
  WATCH_COMPLETE: 10,
  LIKE_SEND: 2,
  LIKE_RECEIVE: 5,
  GENRE_FIRST_REVIEW: 20,
  LOGIN_STREAK_7: 50,
  DAILY_LIKE_LIMIT: 50,
  VOICE_REVIEW: 20,
}

export const addPoints = async (userId: string, pts: number, reason: string): Promise<void> => {
  try {
    const { data: userDoc } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .single()
    const oldPts = userDoc?.points ?? 0
    const newPts = oldPts + pts

    await supabase
      .from('users')
      .update({ points: newPts, level: getLevelFromPoints(newPts).level })
      .eq('id', userId)

    await supabase.from('user_points').insert({
      user_id: userId,
      points: pts,
      reason,
    })

    const oldLevel = getLevelFromPoints(oldPts)
    const newLevel = getLevelFromPoints(newPts)

    if (newLevel.level > oldLevel.level && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('filmo-levelup', {
        detail: { ...newLevel, totalPoints: newPts }
      }))
    }
  } catch { /* ignore */ }
}

export const checkDailyLikeLimit = async (userId: string): Promise<boolean> => {
  const today = new Date().toISOString().split('T')[0]
  try {
    const { data } = await supabase
      .from('daily_like_counts')
      .select('count')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()
    if (!data) return true
    return (data.count ?? 0) < POINT_CONFIG.DAILY_LIKE_LIMIT
  } catch {
    return true
  }
}

export const incrementDailyLikeCount = async (userId: string): Promise<void> => {
  const today = new Date().toISOString().split('T')[0]
  try {
    const { data } = await supabase
      .from('daily_like_counts')
      .select('id, count')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()
    if (data) {
      await supabase
        .from('daily_like_counts')
        .update({ count: (data.count || 0) + 1 })
        .eq('id', data.id)
    } else {
      await supabase.from('daily_like_counts').insert({
        user_id: userId,
        date: today,
        count: 1,
      })
    }
  } catch { /* ignore */ }
}

export const checkLoginStreak = async (userId: string): Promise<{ streak: number; bonus: number }> => {
  try {
    const { data: userDoc } = await supabase
      .from('users')
      .select('login_streak, last_login_date')
      .eq('id', userId)
      .single()
    if (!userDoc) return { streak: 0, bonus: 0 }

    const today = new Date().toISOString().split('T')[0]
    const lastLogin = userDoc.last_login_date

    if (lastLogin === today) return { streak: userDoc.login_streak || 0, bonus: 0 }

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    let newStreak = 1
    if (lastLogin === yesterdayStr) {
      newStreak = (userDoc.login_streak || 0) + 1
    }

    await supabase
      .from('users')
      .update({ login_streak: newStreak, last_login_date: today })
      .eq('id', userId)

    let bonus = 0
    if (newStreak > 0 && newStreak % 7 === 0) {
      bonus = POINT_CONFIG.LOGIN_STREAK_7
      await addPoints(userId, bonus, `${newStreak}日連続ログインボーナス`)
    }

    return { streak: newStreak, bonus }
  } catch {
    return { streak: 0, bonus: 0 }
  }
}

export const checkAndAwardTitles = async (userId: string): Promise<{ name: string; id: string }[]> => {
  try {
    const { data: allTitles } = await supabase
      .from('user_titles')
      .select('*')
      .limit(100)
    const { data: earned } = await supabase
      .from('user_earned_titles')
      .select('title_id')
      .eq('user_id', userId)
      .limit(100)

    const earnedIds = new Set((earned || []).map(e => e.title_id))
    const newTitles: { name: string; id: string }[] = []

    for (const title of allTitles || []) {
      if (earnedIds.has(title.id)) continue
      const met = await checkTitleCondition(userId, title)
      if (met) {
        await supabase.from('user_earned_titles').insert({
          user_id: userId,
          title_id: title.id,
        })
        newTitles.push({ name: title.name, id: title.id })
      }
    }
    return newTitles
  } catch {
    return []
  }
}

async function checkTitleCondition(userId: string, title: Record<string, unknown>): Promise<boolean> {
  const condType = title.condition_type as string
  const condValue = title.condition_value as number
  const condDetail = (title.condition_detail || {}) as Record<string, unknown>

  try {
    switch (condType) {
      case 'login_streak': {
        const { data: u } = await supabase.from('users').select('login_streak').eq('id', userId).single()
        return (u?.login_streak || 0) >= condValue
      }
      case 'follower_count': {
        const { count } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId)
        return (count || 0) >= condValue
      }
      case 'likes_given': {
        const { count } = await supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
        return (count || 0) >= condValue
      }
      case 'score_count': {
        const score = condDetail.score as number
        const { count } = await supabase
          .from('reviews')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('score', score)
          .eq('is_draft', false)
        return (count || 0) >= condValue
      }
      case 'long_review': {
        const minChars = condDetail.min_chars as number
        const { data: revs } = await supabase
          .from('reviews')
          .select('body')
          .eq('user_id', userId)
          .eq('is_draft', false)
          .limit(500)
        const count = (revs || []).filter(d => (d.body?.length || 0) >= minChars).length
        return count >= condValue
      }
      case 'short_review': {
        const maxChars = condDetail.max_chars as number
        const { data: revs } = await supabase
          .from('reviews')
          .select('body')
          .eq('user_id', userId)
          .eq('is_draft', false)
          .limit(500)
        const count = (revs || []).filter(d => {
          const len = d.body?.length || 0
          return len > 0 && len <= maxChars
        }).length
        return count >= condValue
      }
      case 'time_review': {
        const hourStart = condDetail.hour_start as number
        const hourEnd = condDetail.hour_end as number | undefined
        const day = condDetail.day as number | undefined
        const { data: revs } = await supabase
          .from('reviews')
          .select('created_at')
          .eq('user_id', userId)
          .eq('is_draft', false)
          .limit(500)
        const count = (revs || []).filter(d => {
          const dt = new Date(d.created_at)
          const h = dt.getHours()
          if (day !== undefined && dt.getDay() !== day) return false
          if (hourEnd !== undefined) return h >= hourStart && h < hourEnd
          return h >= hourStart
        }).length
        return count >= condValue
      }
      case 'genre_count': {
        const genreId = condDetail.genre_id as number
        const { data: wl } = await supabase
          .from('watchlists')
          .select('movie_id')
          .eq('user_id', userId)
          .eq('status', 'watched')
          .limit(500)
        if (!wl || wl.length === 0) return false
        const movieIds = wl.map(w => w.movie_id)
        const { data: movies } = await supabase
          .from('movies')
          .select('id, genres')
          .in('id', movieIds)
        const count = (movies || []).filter(m => {
          const genres = (m.genres || []) as { id: number }[]
          return genres.some(g => g.id === genreId)
        }).length
        return count >= condValue
      }
      default:
        return false
    }
  } catch {
    return false
  }
}
