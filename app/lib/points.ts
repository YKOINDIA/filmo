import { databases, DB_ID, COLLECTIONS, Query, ID } from './appwrite'

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
}

export const addPoints = async (userId: string, pts: number, reason: string): Promise<void> => {
  try {
    const userDoc = await databases.getDocument(DB_ID, COLLECTIONS.USERS, userId)
    const oldPts = userDoc.points ?? 0
    const newPts = oldPts + pts

    await databases.updateDocument(DB_ID, COLLECTIONS.USERS, userId, {
      points: newPts,
      level: getLevelFromPoints(newPts).level,
    })

    await databases.createDocument(DB_ID, COLLECTIONS.USER_POINTS, ID.unique(), {
      user_id: userId,
      points: pts,
      reason,
      created_at: new Date().toISOString(),
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
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.DAILY_LIKE_COUNTS, [
      Query.equal('user_id', userId),
      Query.equal('date', today),
      Query.limit(1),
    ])
    if (res.documents.length === 0) return true
    return (res.documents[0].count ?? 0) < POINT_CONFIG.DAILY_LIKE_LIMIT
  } catch {
    return true
  }
}

export const incrementDailyLikeCount = async (userId: string): Promise<void> => {
  const today = new Date().toISOString().split('T')[0]
  try {
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.DAILY_LIKE_COUNTS, [
      Query.equal('user_id', userId),
      Query.equal('date', today),
      Query.limit(1),
    ])
    if (res.documents.length > 0) {
      await databases.updateDocument(DB_ID, COLLECTIONS.DAILY_LIKE_COUNTS, res.documents[0].$id, {
        count: (res.documents[0].count || 0) + 1,
      })
    } else {
      await databases.createDocument(DB_ID, COLLECTIONS.DAILY_LIKE_COUNTS, ID.unique(), {
        user_id: userId,
        date: today,
        count: 1,
      })
    }
  } catch { /* ignore */ }
}

export const checkLoginStreak = async (userId: string): Promise<{ streak: number; bonus: number }> => {
  try {
    const userDoc = await databases.getDocument(DB_ID, COLLECTIONS.USERS, userId)
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

    await databases.updateDocument(DB_ID, COLLECTIONS.USERS, userId, {
      login_streak: newStreak,
      last_login_date: today,
    })

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
    const titlesRes = await databases.listDocuments(DB_ID, COLLECTIONS.USER_TITLES, [Query.limit(100)])
    const earnedRes = await databases.listDocuments(DB_ID, COLLECTIONS.USER_EARNED_TITLES, [
      Query.equal('user_id', userId),
      Query.limit(100),
    ])
    const earnedIds = new Set(earnedRes.documents.map(e => e.title_id))
    const newTitles: { name: string; id: string }[] = []

    for (const title of titlesRes.documents) {
      if (earnedIds.has(title.$id)) continue
      const met = await checkTitleCondition(userId, title)
      if (met) {
        await databases.createDocument(DB_ID, COLLECTIONS.USER_EARNED_TITLES, ID.unique(), {
          user_id: userId,
          title_id: title.$id,
          earned_at: new Date().toISOString(),
        })
        newTitles.push({ name: title.name, id: title.$id })
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
        const u = await databases.getDocument(DB_ID, COLLECTIONS.USERS, userId)
        return (u.login_streak || 0) >= condValue
      }
      case 'follower_count': {
        const r = await databases.listDocuments(DB_ID, COLLECTIONS.FOLLOWS, [
          Query.equal('following_id', userId), Query.limit(1),
        ])
        return (r.total || 0) >= condValue
      }
      case 'likes_given': {
        const r = await databases.listDocuments(DB_ID, COLLECTIONS.LIKES, [
          Query.equal('user_id', userId), Query.limit(1),
        ])
        return (r.total || 0) >= condValue
      }
      case 'score_count': {
        const score = condDetail.score as number
        const r = await databases.listDocuments(DB_ID, COLLECTIONS.REVIEWS, [
          Query.equal('user_id', userId),
          Query.equal('score', score),
          Query.equal('is_draft', false),
          Query.limit(1),
        ])
        return (r.total || 0) >= condValue
      }
      case 'long_review': {
        const minChars = condDetail.min_chars as number
        const r = await databases.listDocuments(DB_ID, COLLECTIONS.REVIEWS, [
          Query.equal('user_id', userId),
          Query.equal('is_draft', false),
          Query.limit(500),
        ])
        const count = r.documents.filter(d => (d.body?.length || 0) >= minChars).length
        return count >= condValue
      }
      case 'short_review': {
        const maxChars = condDetail.max_chars as number
        const r = await databases.listDocuments(DB_ID, COLLECTIONS.REVIEWS, [
          Query.equal('user_id', userId),
          Query.equal('is_draft', false),
          Query.limit(500),
        ])
        const count = r.documents.filter(d => {
          const len = d.body?.length || 0
          return len > 0 && len <= maxChars
        }).length
        return count >= condValue
      }
      case 'time_review': {
        const hourStart = condDetail.hour_start as number
        const hourEnd = condDetail.hour_end as number | undefined
        const day = condDetail.day as number | undefined
        const r = await databases.listDocuments(DB_ID, COLLECTIONS.REVIEWS, [
          Query.equal('user_id', userId),
          Query.equal('is_draft', false),
          Query.limit(500),
        ])
        const count = r.documents.filter(d => {
          const dt = new Date(d.$createdAt)
          const h = dt.getHours()
          if (day !== undefined && dt.getDay() !== day) return false
          if (hourEnd !== undefined) return h >= hourStart && h < hourEnd
          return h >= hourStart
        }).length
        return count >= condValue
      }
      case 'genre_count': {
        const genreId = condDetail.genre_id as number
        const wl = await databases.listDocuments(DB_ID, COLLECTIONS.WATCHLISTS, [
          Query.equal('user_id', userId),
          Query.equal('status', 'watched'),
          Query.limit(500),
        ])
        let count = 0
        for (const w of wl.documents) {
          try {
            const movie = await databases.getDocument(DB_ID, COLLECTIONS.MOVIES, w.movie_id)
            const genres = JSON.parse(movie.genres || '[]')
            if (genres.some((g: { id: number }) => g.id === genreId)) count++
          } catch { /* skip */ }
        }
        return count >= condValue
      }
      default:
        return false
    }
  } catch {
    return false
  }
}
