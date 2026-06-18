// ============================================================
// 映画好き診断: 質問データ
// ============================================================
// 各選択肢は DiagnosisTag への重みを持ち、回答を集計して
// matchType() に渡すことで診断タイプを判定する。

import type { TagWeights } from './types'

export interface QuizOption {
  label: string
  emoji?: string
  weights: TagWeights
}

export interface QuizQuestion {
  id: string
  title: string
  options: QuizOption[]
}

export const QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    title: '次の中で、いちばん心が動くのは？',
    options: [
      { label: 'インターステラーのような壮大なSF', emoji: '🚀', weights: { sf: 3, fantasy: 1 } },
      { label: 'トップガンのような爽快アクション', emoji: '✈️', weights: { action: 3 } },
      { label: '君の名は。のような感動アニメ', emoji: '🌠', weights: { anime: 3, romance: 1 } },
      { label: 'ジョーカーのような重厚なドラマ', emoji: '🃏', weights: { human: 2, art: 2 } },
    ],
  },
  {
    id: 'q2',
    title: '映画に求めるのは、どっち？',
    options: [
      { label: '考えさせられる余韻', emoji: '🤔', weights: { art: 3, mystery: 1 } },
      { label: 'スカッとする爽快感', emoji: '💥', weights: { action: 2, comedy: 2 } },
    ],
  },
  {
    id: 'q3',
    title: '好きなジャンルは？',
    options: [
      { label: 'SF', emoji: '🛸', weights: { sf: 3 } },
      { label: 'サスペンス', emoji: '🕵️', weights: { mystery: 3 } },
      { label: 'アクション', emoji: '💢', weights: { action: 3 } },
      { label: 'ヒューマンドラマ', emoji: '🎭', weights: { human: 3 } },
    ],
  },
  {
    id: 'q4',
    title: '物語で、いちばん重視するのは？',
    options: [
      { label: 'どんでん返し・伏線回収', emoji: '🔀', weights: { mystery: 2, art: 1 } },
      { label: '登場人物の成長や絆', emoji: '🤝', weights: { human: 3 } },
      { label: '世界観とビジュアル', emoji: '🎨', weights: { fantasy: 2, anime: 1, sf: 1 } },
      { label: 'スリルと緊張感', emoji: '😱', weights: { horror: 2, mystery: 1 } },
    ],
  },
  {
    id: 'q5',
    title: '観るなら、どっち？',
    options: [
      { label: '静かで詩的な作品', emoji: '🌙', weights: { art: 2, anime: 1, romance: 1 } },
      { label: '派手で迫力ある作品', emoji: '🎆', weights: { action: 2, sf: 1 } },
    ],
  },
  {
    id: 'q6',
    title: 'むしろ「好物」なのは？',
    options: [
      { label: '号泣できる話', emoji: '😭', weights: { human: 2, romance: 1 } },
      { label: '心底ゾッとする話', emoji: '👻', weights: { horror: 3 } },
      { label: 'おなかを抱えて笑える話', emoji: '😂', weights: { comedy: 3 } },
      { label: '難解で噛みごたえのある話', emoji: '🧩', weights: { art: 3 } },
    ],
  },
  {
    id: 'q7',
    title: '惹かれる時代・舞台は？',
    options: [
      { label: '近未来・宇宙', emoji: '🌌', weights: { sf: 3 } },
      { label: '現代のリアルな世界', emoji: '🏙️', weights: { human: 2, mystery: 1 } },
      { label: '過去・歴史・名作の世界', emoji: '🎞️', weights: { classic: 3, art: 1 } },
      { label: '魔法と冒険の異世界', emoji: '🐉', weights: { fantasy: 3 } },
    ],
  },
  {
    id: 'q8',
    title: '映画館で、つい選んでしまうのは？',
    options: [
      { label: '話題の超大作', emoji: '🍿', weights: { action: 2, sf: 1 } },
      { label: '賞レース常連の名作', emoji: '🏆', weights: { human: 1, art: 1, classic: 2 } },
      { label: 'ハラハラするスリラー', emoji: '🔪', weights: { mystery: 2, horror: 1 } },
      { label: 'キュンとする恋愛もの', emoji: '💗', weights: { romance: 3, comedy: 1 } },
    ],
  },
]

/** 回答 (questionId -> 選択肢 index) からタグスコアを集計する。 */
export function tallyScores(answers: Record<string, number>): TagWeights {
  const scores: TagWeights = {}
  for (const q of QUESTIONS) {
    const idx = answers[q.id]
    if (idx == null) continue
    const opt = q.options[idx]
    if (!opt) continue
    for (const [tag, w] of Object.entries(opt.weights)) {
      const key = tag as keyof TagWeights
      scores[key] = (scores[key] ?? 0) + (w ?? 0)
    }
  }
  return scores
}
