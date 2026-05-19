// ============================================================
// うらにゃん。: 期間限定占い (テスト期間 / 夏休み / 推し活 / etc)
// ============================================================
// 指定期間 [start, end] の各日の運勢を today.ts ロジックで計算し、
// 期間全体としての特徴を集計する。
//
// 集計:
//   - 期間ランク = 各日スコアの平均 (1〜5)
//   - 支配的な五行関係 (期間中で最も多い rel)
//   - ベスト日 / ワースト日
//   - 期間ごとのテンプレ (preset + 五行関係) でセリフ出し分け
//
// 履歴保存: 既存の uranyan_readings に menu='life' + period_label/start/end で
// 保存する想定 (UI 側で「履歴に残す」ボタン)。

import { calcSanchu, type Stem, type Branch } from './sanchu'
import { mansionOf, mansionIndex } from './sukuyo'
import { RELATION_TEMPLATES, type Relation } from './compatTemplates'

type Element = '木' | '火' | '土' | '金' | '水'
const STEM_ELEMENT: Record<Stem, Element> = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火',
  '戊': '土', '己': '土', '庚': '金', '辛': '金',
  '壬': '水', '癸': '水',
}
const STEM_YINYANG: Record<Stem, '陽' | '陰'> = {
  '甲': '陽', '乙': '陰', '丙': '陽', '丁': '陰',
  '戊': '陽', '己': '陰', '庚': '陽', '辛': '陰',
  '壬': '陽', '癸': '陰',
}
const SHENG: Record<Element, Element> = { '木':'火','火':'土','土':'金','金':'水','水':'木' }
const KE:    Record<Element, Element> = { '木':'土','火':'金','土':'水','金':'木','水':'火' }

export type GogyoRel = '比和' | '我生' | '我剋' | '剋我' | '生我'

function gogyo(s: Element, t: Element): GogyoRel {
  if (s === t) return '比和'
  if (SHENG[s] === t) return '我生'
  if (SHENG[t] === s) return '生我'
  if (KE[s] === t) return '我剋'
  return '剋我'
}

const SANMEI_BASE: Record<GogyoRel, number> = {
  '比和': 3, '我生': 5, '我剋': 4, '剋我': 2, '生我': 4,
}

function fortuneScore(f: string): number {
  return f === '大吉' ? 5 : f === '吉' ? 4 : f === '凶' ? 1 : 3
}

function relationFromDistance(d: number): Relation {
  const x = ((d % 27) + 27) % 27
  if (x === 0) return '命'
  const pair = x <= 13 ? x : 27 - x
  switch (pair) {
    case 1:  return '業'
    case 2:  return '栄'
    case 3:  return '衰'
    case 4:  return '安'
    case 5:  return '壊'
    case 6:  return '友'
    case 7:  return '親'
    case 8:  return '危'
    case 9:  return '成'
    case 10: return '業胎'
    case 11: return '栄胎'
    case 12: return '衰胎'
    case 13: return '安胎'
  }
  return '命'
}

// ─────────────────────────────────────────────────────────────
// 1 日分のスコア
// ─────────────────────────────────────────────────────────────
function dayScore(user: { stem: Stem }, userMansionIdx: number, y: number, m: number, d: number): {
  date: string
  rel: GogyoRel
  score: number
  sukuyoRel: Relation
} {
  const todayPillar = calcSanchu(y, m, d).day
  const rel = gogyo(STEM_ELEMENT[user.stem], STEM_ELEMENT[todayPillar.stem])
  const sameYY = STEM_YINYANG[user.stem] === STEM_YINYANG[todayPillar.stem]
  const sanmei = Math.max(1, Math.min(5, SANMEI_BASE[rel] + (sameYY ? 0.3 : -0.2)))

  const todayMansionIdx = mansionIndex(mansionOf(y, m, d))
  const dist = ((todayMansionIdx - userMansionIdx) + 27) % 27
  const sukuyoRel = relationFromDistance(dist)
  const sukuyo = fortuneScore(RELATION_TEMPLATES[sukuyoRel].fortune)
  const score = sanmei * 0.6 + sukuyo * 0.4

  const iso = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  return { date: iso, rel, score, sukuyoRel }
}

// ─────────────────────────────────────────────────────────────
// 期間プリセット
// ─────────────────────────────────────────────────────────────
export interface PeriodPreset {
  id: string
  label: string
  emoji: string
  /**
   * 開始日と終了日を返す。引数 today は基準日 (JST)。
   * 「最近のテスト期間」「次の夏休み」など、相対計算で決める。
   */
  range: (today: Date) => { start: Date; end: Date; labelExtra?: string }
}

export const PERIOD_PRESETS: PeriodPreset[] = [
  {
    id: 'test_week', label: 'テスト期間', emoji: '📚',
    range: (today) => {
      // 直近 7 日後から 5 日間
      const s = new Date(today); s.setDate(s.getDate() + 7)
      const e = new Date(s); e.setDate(e.getDate() + 4)
      return { start: s, end: e }
    },
  },
  {
    id: 'summer', label: '夏休み', emoji: '⛱️',
    range: (today) => {
      // 今年か来年の 7/20〜8/31
      const y = today.getMonth() < 7 ? today.getFullYear() : today.getFullYear() + 1
      return { start: new Date(y, 6, 20), end: new Date(y, 7, 31), labelExtra: `${y}` }
    },
  },
  {
    id: 'winter', label: '冬休み', emoji: '❄️',
    range: (today) => {
      // 12/23〜翌1/7
      const y = today.getMonth() >= 11 ? today.getFullYear() : today.getFullYear() - 1
      return { start: new Date(y, 11, 23), end: new Date(y + 1, 0, 7), labelExtra: `${y}-${y+1}` }
    },
  },
  {
    id: 'spring', label: '春休み', emoji: '🌸',
    range: (today) => {
      // 3/20〜4/7
      const y = today.getFullYear()
      return { start: new Date(y, 2, 20), end: new Date(y, 3, 7) }
    },
  },
  {
    id: 'gw', label: 'GW・連休', emoji: '🎉',
    range: (today) => {
      // 5/3〜5/6
      const y = today.getMonth() < 5 ? today.getFullYear() : today.getFullYear() + 1
      return { start: new Date(y, 4, 3), end: new Date(y, 4, 6) }
    },
  },
  {
    id: 'oshikatsu', label: '推し活ウィーク', emoji: '💖',
    range: (today) => {
      // 直近 1 週間
      const s = new Date(today)
      const e = new Date(today); e.setDate(e.getDate() + 6)
      return { start: s, end: e }
    },
  },
  {
    id: 'next_week', label: '来週の運勢', emoji: '📅',
    range: (today) => {
      const s = new Date(today); s.setDate(s.getDate() + 7 - today.getDay())
      const e = new Date(s); e.setDate(e.getDate() + 6)
      return { start: s, end: e }
    },
  },
]

// ─────────────────────────────────────────────────────────────
// 期間運勢の集計 (公開 API)
// ─────────────────────────────────────────────────────────────
export interface PeriodDay {
  date: string
  rank: number       // 1〜5 (round)
  score: number      // float 1〜5
  rel: GogyoRel
  sukuyoRel: Relation
}

export interface PeriodReading {
  startDate: string
  endDate: string
  days: PeriodDay[]
  avgScore: number
  avgRank: number             // 1〜5 (round)
  avgLabel: string            // "絶好調" 等
  avgEmoji: string
  dominantRel: GogyoRel       // 期間中最頻出
  dominantCount: number
  relDistribution: Record<GogyoRel, number>
  bestDay: PeriodDay | null
  worstDay: PeriodDay | null
  themeHeadline: string
  nyanLine: string
  pochiLine: string
  advice: string
}

function rankLabel(s: number): string {
  if (s >= 4.6) return '神回'
  if (s >= 4.0) return '絶好調'
  if (s >= 3.3) return '上向き'
  if (s >= 2.6) return 'ふつう'
  if (s >= 2.0) return 'ちょい注意'
  return '休む期間'
}
function rankEmoji(s: number): string {
  if (s >= 4.6) return '🔥'
  if (s >= 4.0) return '✨'
  if (s >= 3.3) return '🌤'
  if (s >= 2.6) return '☁️'
  if (s >= 2.0) return '🌧'
  return '⛈'
}

// 支配的な五行関係ごとの「期間テーマ」
const PERIOD_THEME: Record<GogyoRel, { headline: string; nyan: string; pochi: string; advice: string }> = {
  '比和': {
    headline: '安定の期間',
    nyan: 'この期間、波が無さすぎてつまんなく感じるかも。でも実はそれが一番の宝なんだよ。',
    pochi: '無理せず、いつも通りでいるのが正解だワン！',
    advice: '新しい挑戦より、好きな人や場所と過ごす時間を増やすと吉。',
  },
  '我生': {
    headline: '発信ブースト期間',
    nyan: 'あんたの言葉や行動が周りに届きやすい期間。SNS、告白、自分プロデュース全部攻め時。',
    pochi: '創作・自己表現が最高の成果を出すワン！',
    advice: '黙ってると損する期間。出す・見せる・発信する を意識して。',
  },
  '我剋': {
    headline: '勝負・押せる期間',
    nyan: 'テスト・面接・対戦、押せば取れる期間。ただし力業が裏目に出る日も混じってる。',
    pochi: '勝負ごとに前向きに突っ込んで OK だワン！',
    advice: '勝ちにいく日と、引く日を見極めて。下のカレンダー参照。',
  },
  '剋我': {
    headline: '踏ん張りの期間',
    nyan: '正直、向かい風強め。新しいこと始めるには不向き。耐えればちゃんと終わるよ。',
    pochi: 'いつもより自分に優しくしてあげるワン！',
    advice: '攻めずに守る。睡眠・食事・推しなど "回復モード" を最優先で。',
  },
  '生我': {
    headline: '受け取り期間',
    nyan: '先輩・親・大人から得るものが多い期間。ヘルプを借りる方が結果が出る。',
    pochi: '助けてって言うのも才能だワン！素直になっていいワン！',
    advice: 'プライドより結果。「教えて」「手伝って」を口に出す練習期間。',
  },
}

export function buildPeriodReading(
  user: { year: number; month: number; day: number },
  startDate: Date,
  endDate: Date,
): PeriodReading {
  // 期間が逆 / 0 日 / 巨大すぎる場合のガード
  if (endDate < startDate) throw new Error('endDate must be >= startDate')
  const days: PeriodDay[] = []
  const userSanchu = calcSanchu(user.year, user.month, user.day)
  const userMansionIdx = mansionIndex(mansionOf(user.year, user.month, user.day))

  // 最大 90 日まで計算 (無限ループ防止)
  const MAX_DAYS = 90
  const cursor = new Date(startDate)
  let count = 0
  while (cursor <= endDate && count < MAX_DAYS) {
    const y = cursor.getFullYear(), m = cursor.getMonth() + 1, d = cursor.getDate()
    const r = dayScore({ stem: userSanchu.day.stem }, userMansionIdx, y, m, d)
    days.push({
      date: r.date,
      rank: Math.max(1, Math.min(5, Math.round(r.score))),
      score: r.score,
      rel: r.rel,
      sukuyoRel: r.sukuyoRel,
    })
    cursor.setDate(cursor.getDate() + 1)
    count++
  }

  // 集計
  const avgScore = days.length > 0
    ? days.reduce((s, d) => s + d.score, 0) / days.length
    : 3
  const distribution: Record<GogyoRel, number> = {
    '比和': 0, '我生': 0, '我剋': 0, '剋我': 0, '生我': 0,
  }
  days.forEach(d => { distribution[d.rel]++ })
  let dominant: GogyoRel = '比和'
  let dominantCount = 0
  for (const rel of Object.keys(distribution) as GogyoRel[]) {
    if (distribution[rel] > dominantCount) {
      dominant = rel
      dominantCount = distribution[rel]
    }
  }
  let bestDay: PeriodDay | null = null
  let worstDay: PeriodDay | null = null
  for (const d of days) {
    if (!bestDay || d.score > bestDay.score) bestDay = d
    if (!worstDay || d.score < worstDay.score) worstDay = d
  }
  const theme = PERIOD_THEME[dominant]

  const startISO = formatISO(startDate)
  const endISO = formatISO(endDate)
  return {
    startDate: startISO,
    endDate: endISO,
    days,
    avgScore,
    avgRank: Math.max(1, Math.min(5, Math.round(avgScore))),
    avgLabel: rankLabel(avgScore),
    avgEmoji: rankEmoji(avgScore),
    dominantRel: dominant,
    dominantCount,
    relDistribution: distribution,
    bestDay, worstDay,
    themeHeadline: theme.headline,
    nyanLine: theme.nyan,
    pochiLine: theme.pochi,
    advice: theme.advice,
  }
}

function formatISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function periodShareText(periodLabel: string, name: string, r: PeriodReading): string {
  return `📅 #うらにゃん  ${periodLabel} の運勢 (${r.startDate}〜${r.endDate})\n` +
    `${name}: ${r.avgEmoji} ${r.avgLabel} (★${r.avgRank}/5)\n` +
    `テーマ: ${r.themeHeadline}\n` +
    (r.bestDay ? `🏆 ベスト日: ${r.bestDay.date} (★${r.bestDay.rank})\n` : '') +
    (r.worstDay ? `⚠️ 注意日: ${r.worstDay.date} (★${r.worstDay.rank})` : '')
}

// 不使用警告対策
void ({} as Branch)
