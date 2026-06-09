// ============================================================
// Filmo ファスティング — ゲーミフィケーション (レベル・称号)
// ============================================================
// 累計の「達成したファスティング時間」と「連続達成日数(ストリーク)」から
// レベルと称号を算出する純関数群。UI から切り離してテスト・再利用しやすくする。

export interface CompletedSessionLite {
  /** 開始時刻 (ISO 文字列) */
  started_at: string
  /** 終了時刻 (ISO 文字列)。completed のみ渡す想定 */
  ended_at: string
}

export interface FastingStats {
  /** 達成セッションの累計時間 (h) */
  totalHours: number
  /** 達成回数 */
  completedCount: number
  /** 連続達成日数 (今日 or 昨日から遡って連続している日数) */
  streakDays: number
  /** これまでの最長セッション (h) */
  longestHours: number
}

// ── レベル定義 (10 段階) ──────────────────────────────────────────────
// minHours: そのレベルに到達するのに必要な累計達成時間 (h)。
export interface LevelDef {
  level: number
  title: string
  minHours: number
  emoji: string
  color: string
}

export const FASTING_LEVELS: LevelDef[] = [
  { level: 1,  title: 'プチ断食見習い',          minHours: 0,    emoji: '🌱', color: '#9be39b' },
  { level: 2,  title: '空腹に慣れた者',          minHours: 16,   emoji: '🍵', color: '#7bed9f' },
  { level: 3,  title: 'オートファジー入門',      minHours: 48,   emoji: '✨', color: '#6cf2ff' },
  { level: 4,  title: 'オートファジーの使い手',  minHours: 100,  emoji: '🔥', color: '#54a0ff' },
  { level: 5,  title: 'ファスティング中級者',    minHours: 200,  emoji: '💪', color: '#5f8bff' },
  { level: 6,  title: '脂肪燃焼の探求者',        minHours: 350,  emoji: '⚡', color: '#a29bfe' },
  { level: 7,  title: 'アンチエイジング戦士',    minHours: 550,  emoji: '🛡️', color: '#c374ff' },
  { level: 8,  title: '断食の達人',              minHours: 800,  emoji: '🧘', color: '#ff7aae' },
  { level: 9,  title: '不食の賢者',              minHours: 1200, emoji: '🌙', color: '#ffd24a' },
  { level: 10, title: 'ファスティング・レジェンド', minHours: 1800, emoji: '👑', color: '#ffb347' },
]

export interface LevelProgress {
  current: LevelDef
  next: LevelDef | null
  /** 現在レベル内の進捗 0〜1 (最高レベルは 1) */
  ratio: number
  /** 次のレベルまでの残り時間 (h)。最高レベルは 0 */
  hoursToNext: number
}

/** 累計達成時間から現在レベルと次レベルへの進捗を返す。 */
export function levelForHours(totalHours: number): LevelProgress {
  let current = FASTING_LEVELS[0]
  for (const lv of FASTING_LEVELS) {
    if (totalHours >= lv.minHours) current = lv
    else break
  }
  const next = FASTING_LEVELS.find(lv => lv.level === current.level + 1) ?? null
  if (!next) {
    return { current, next: null, ratio: 1, hoursToNext: 0 }
  }
  const span = next.minHours - current.minHours
  const into = totalHours - current.minHours
  const ratio = span > 0 ? Math.min(1, Math.max(0, into / span)) : 0
  return { current, next, ratio, hoursToNext: Math.max(0, next.minHours - totalHours) }
}

// ── 統計の算出 ────────────────────────────────────────────────────────
function hoursBetween(startISO: string, endISO: string): number {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime()
  return ms > 0 ? ms / 3_600_000 : 0
}

/** ローカルタイムの 'YYYY-MM-DD' を返す。 */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 達成済みセッション一覧から累計時間・回数・ストリークを計算する。
 * ストリークは「開始日」基準。今日まだ達成が無くても、昨日まで連続していれば
 * その日数を返す (今日まだ実行中・これからの人を切り捨てない)。
 */
export function computeStats(
  sessions: CompletedSessionLite[],
  now: Date = new Date(),
): FastingStats {
  let totalHours = 0
  let longestHours = 0
  const dayKeys = new Set<string>()

  for (const s of sessions) {
    if (!s.ended_at) continue
    const h = hoursBetween(s.started_at, s.ended_at)
    totalHours += h
    if (h > longestHours) longestHours = h
    dayKeys.add(localDateKey(new Date(s.started_at)))
  }

  // ストリーク: 今日 or 昨日を起点に、達成日が途切れるまで遡る。
  let streakDays = 0
  const cursor = new Date(now)
  const todayKey = localDateKey(cursor)
  if (!dayKeys.has(todayKey)) {
    // 今日まだ無ければ昨日から数え始める (今日ぶんはこれから達成できる猶予)。
    cursor.setDate(cursor.getDate() - 1)
  }
  while (dayKeys.has(localDateKey(cursor))) {
    streakDays += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    completedCount: sessions.filter(s => s.ended_at).length,
    streakDays,
    longestHours: Math.round(longestHours * 10) / 10,
  }
}

// ── コミュニティ称号 (投稿・応援の多いユーザー) ──────────────────────────
export interface CommunityTitle {
  key: string
  label: string
  emoji: string
  /** 達成条件の説明 */
  hint: string
}

export interface CommunityCounts {
  /** 自分の回復食投稿数 */
  posts: number
  /** 自分が送った応援数 */
  cheersGiven: number
  /** 連続達成日数 */
  streakDays: number
}

/** 条件を満たしたコミュニティ称号を返す。 */
export function earnedCommunityTitles(c: CommunityCounts): CommunityTitle[] {
  const out: CommunityTitle[] = []
  if (c.posts >= 30) {
    out.push({ key: 'meister', label: '回復食マイスター', emoji: '🍲', hint: '回復食を30回シェア' })
  } else if (c.posts >= 10) {
    out.push({ key: 'cook', label: '回復食シェアラー', emoji: '🥣', hint: '回復食を10回シェア' })
  }
  if (c.cheersGiven >= 100) {
    out.push({ key: 'captain', label: '応援団長', emoji: '📣', hint: '仲間に100回エール' })
  } else if (c.cheersGiven >= 30) {
    out.push({ key: 'supporter', label: 'みんなの味方', emoji: '👏', hint: '仲間に30回エール' })
  }
  if (c.streakDays >= 30) {
    out.push({ key: 'streak30', label: '鉄の意志', emoji: '⛓️', hint: '30日連続達成' })
  } else if (c.streakDays >= 7) {
    out.push({ key: 'streak7', label: '一週間の継続者', emoji: '📅', hint: '7日連続達成' })
  }
  return out
}

// ── 目標時間プリセット ────────────────────────────────────────────────
export const TARGET_PRESETS: { hours: number; label: string; note: string }[] = [
  { hours: 12,  label: '12時間',      note: '入門・夜だけ断食' },
  { hours: 16,  label: '16時間',      note: '定番 16:8' },
  { hours: 18,  label: '18時間',      note: 'しっかりオートファジー' },
  { hours: 24,  label: '24時間',      note: '1日1食・上級' },
  { hours: 36,  label: '36時間',      note: 'ガチ勢' },
  { hours: 48,  label: '48時間 (2日)', note: '本格ファスティング' },
  { hours: 72,  label: '72時間 (3日)', note: '上級者向け' },
]

/** target_hours の許容範囲 (DB の CHECK と一致させる)。 */
export const TARGET_HOURS_MIN = 1
export const TARGET_HOURS_MAX = 168 // 7 日
