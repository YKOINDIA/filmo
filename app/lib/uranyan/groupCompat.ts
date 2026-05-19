// ============================================================
// うらにゃん。: グループ相性 (3〜8人) — 宿曜ベース
// ============================================================
// 全ペアの宿曜相性を計算してまとめる:
//   - members[i] と members[j] の関係 + 吉凶
//   - グループ調和度 = 全ペアの吉凶スコア平均 (1〜5)
//   - ベストペア / ワーストペア
//   - 各メンバーの「平均吉凶」 (誰がグループの調和を高めているか)

import { mansionOf, type Mansion, mansionIndex } from './sukuyo'
import {
  RELATION_TEMPLATES, type Relation, type RelationTemplate,
  type Fortune,
} from './compatTemplates'

export interface GroupMember {
  name: string
  year: number
  month: number
  day: number
}

export interface PairResult {
  i: number
  j: number
  aName: string
  bName: string
  aMansion: Mansion
  bMansion: Mansion
  relation: Relation
  template: RelationTemplate
  score: number   // 1〜5
}

export interface MemberSummary {
  index: number
  name: string
  mansion: Mansion
  avgScore: number       // 自分と他全員との平均
  role: string           // "ムードメーカー" 等のキャッチー役割名
}

export interface GroupCompatReading {
  members: Array<GroupMember & { mansion: Mansion }>
  pairs: PairResult[]
  harmonyScore: number       // 全ペア平均 (1〜5)
  harmonyLabel: string       // "最強" "ぼちぼち" 等
  bestPair: PairResult | null
  worstPair: PairResult | null
  memberSummaries: MemberSummary[]
}

// ─────────────────────────────────────────────────────────────
// 吉凶 → スコア
// ─────────────────────────────────────────────────────────────
function fortuneScore(f: Fortune): number {
  switch (f) {
    case '大吉': return 5
    case '吉':   return 4
    case '中':   return 3
    case '凶':   return 1
  }
}

function harmonyLabelOf(score: number): string {
  if (score >= 4.3) return 'グループ最強'
  if (score >= 3.7) return '盛り上がる'
  if (score >= 3.0) return 'ぼちぼち'
  if (score >= 2.3) return 'ちょっと注意'
  return '要相談メンバー'
}

function roleOf(memberAvg: number, groupAvg: number): string {
  const delta = memberAvg - groupAvg
  if (memberAvg >= 4.5)            return '太陽みたいな人'
  if (memberAvg >= 4.0)            return 'ムードメーカー'
  if (delta >= 0.5)                return 'グループの潤滑油'
  if (delta <= -0.5 && memberAvg < 2.5) return '個性が強すぎる人'
  if (delta <= -0.3)               return 'マイペース派'
  return 'バランサー'
}

// ─────────────────────────────────────────────────────────────
// 公開: グループ相性算出
// ─────────────────────────────────────────────────────────────
export function buildGroupCompatReading(members: GroupMember[]): GroupCompatReading {
  if (members.length < 3 || members.length > 8) {
    throw new Error('グループ相性は 3〜8 人で計算します')
  }
  // 各メンバーの宿を事前計算
  const withMansion = members.map(m => ({
    ...m,
    mansion: mansionOf(m.year, m.month, m.day),
  }))
  // 全ペア
  const pairs: PairResult[] = []
  for (let i = 0; i < withMansion.length; i++) {
    for (let j = i + 1; j < withMansion.length; j++) {
      const a = withMansion[i], b = withMansion[j]
      const d = (mansionIndex(b.mansion) - mansionIndex(a.mansion) + 27) % 27
      const rel = relationFromDistance(d)
      const tmpl = RELATION_TEMPLATES[rel]
      pairs.push({
        i, j,
        aName: a.name, bName: b.name,
        aMansion: a.mansion, bMansion: b.mansion,
        relation: rel, template: tmpl,
        score: fortuneScore(tmpl.fortune),
      })
    }
  }
  // 調和度 = 全ペア平均
  const harmonyScore = pairs.reduce((s, p) => s + p.score, 0) / Math.max(1, pairs.length)
  // ベスト/ワースト
  let bestPair: PairResult | null = null
  let worstPair: PairResult | null = null
  for (const p of pairs) {
    if (!bestPair || p.score > bestPair.score) bestPair = p
    if (!worstPair || p.score < worstPair.score) worstPair = p
  }
  // メンバーごとの平均
  const memberSummaries: MemberSummary[] = withMansion.map((m, idx) => {
    const relPairs = pairs.filter(p => p.i === idx || p.j === idx)
    const avg = relPairs.length
      ? relPairs.reduce((s, p) => s + p.score, 0) / relPairs.length
      : 3
    return {
      index: idx, name: m.name, mansion: m.mansion,
      avgScore: avg,
      role: roleOf(avg, harmonyScore),
    }
  })
  return {
    members: withMansion,
    pairs, harmonyScore,
    harmonyLabel: harmonyLabelOf(harmonyScore),
    bestPair, worstPair, memberSummaries,
  }
}

// 距離 → 関係名 (compatTemplates 内の relationOf と同じ実装。
// 外部公開されていないため再実装。両者は将来統合してもよい)
function relationFromDistance(distance: number): Relation {
  const d = ((distance % 27) + 27) % 27
  if (d === 0) return '命'
  const pair = d <= 13 ? d : 27 - d
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
