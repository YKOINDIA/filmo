import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

// ============================================================
// AI レビュー下書き生成 (Gemini)
// ------------------------------------------------------------
// レビュー画面で「★評価・刺さった点・誰と見た・一言メモ」を選ぶだけで、
// X にそのまま投稿できるカジュアルな短評の初期値を生成する。
// 文章は「叩き台」であり、ユーザーが少し直してから投稿する前提。
//
// プロバイダはプロジェクト既存の Gemini (@google/genai + GEMINI_API_KEY)。
// thinkingBudget: 0 で flash の思考を切り、初稿の体感速度を最優先。
// ============================================================

export const runtime = 'nodejs'
// LLM 出力は毎回変わるためキャッシュさせない
export const dynamic = 'force-dynamic'

type MediaType = 'movie' | 'tv'
type WatchContext = 'solo' | 'family' | 'couple' | 'friends'

const WATCH_CONTEXT_LABEL: Record<WatchContext, string> = {
  solo: '一人で',
  family: '家族と',
  couple: '恋人・パートナーと',
  friends: '友人と',
}

// 入力上限 (悪用・暴発防止)。100K ユーザー規模を想定し、
// プロンプトに渡す自由入力は短く制限しておく。
const MAX_MEMO = 120
const MAX_ASPECTS = 6
const MAX_TITLE = 200

function scoreSentiment(score: number | null): string {
  if (!score || score <= 0) return '評価は明言されていない'
  if (score >= 4.5) return '大絶賛・最高レベル'
  if (score >= 4) return 'かなり良かった'
  if (score >= 3) return '良かった / おおむね満足'
  if (score >= 2) return '可もなく不可もなく / やや微妙'
  return 'イマイチ・物足りない'
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI is not configured' }, { status: 503 })
  }

  let body: {
    title?: string
    year?: string | number
    mediaType?: MediaType
    genres?: string[]
    score?: number | null
    watchContext?: WatchContext | null
    aspects?: string[]
    memo?: string
    allowSpoiler?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const title = (body.title || '').toString().slice(0, MAX_TITLE).trim()
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const mediaType: MediaType = body.mediaType === 'tv' ? 'tv' : 'movie'
  const workWord = mediaType === 'tv' ? 'ドラマ/作品' : '映画'
  const year = body.year ? String(body.year).slice(0, 4) : ''
  const genres = Array.isArray(body.genres)
    ? body.genres.filter(g => typeof g === 'string').slice(0, 5)
    : []
  const score = typeof body.score === 'number' ? body.score : null
  const watchContext =
    body.watchContext && body.watchContext in WATCH_CONTEXT_LABEL ? body.watchContext : null
  const aspects = Array.isArray(body.aspects)
    ? body.aspects.filter(a => typeof a === 'string' && a.trim()).slice(0, MAX_ASPECTS)
    : []
  const memo = (body.memo || '').toString().slice(0, MAX_MEMO).trim()
  const allowSpoiler = body.allowSpoiler === true

  // ── プロンプト構築 ─────────────────────────────────────
  const facts: string[] = [
    `作品: 「${title}」${year ? `(${year})` : ''} ${workWord}`,
  ]
  if (genres.length) facts.push(`ジャンル: ${genres.join('・')}`)
  facts.push(`総合評価: ${scoreSentiment(score)}${score ? ` (★${score.toFixed(1)}/5)` : ''}`)
  if (aspects.length) facts.push(`特に印象に残った点: ${aspects.join('・')}`)
  if (watchContext) facts.push(`鑑賞シーン: ${WATCH_CONTEXT_LABEL[watchContext]}鑑賞`)
  if (memo) facts.push(`本人の一言メモ: ${memo}`)

  const prompt = [
    'あなたは映画好きのユーザー本人になりきって、SNS(X/旧Twitter)にそのまま投稿できる短い感想文を書きます。',
    '',
    '【入力情報】',
    ...facts.map(f => `- ${f}`),
    '',
    '【ルール】',
    '- 日本語のカジュアルな話し言葉。一人称の感想として自然に。',
    '- 全体で120〜180字程度。長すぎない、X にそのまま貼れる長さ。',
    '- 上の「印象に残った点」と「一言メモ」を必ず感想の軸にする。メモがあればその気持ちを最優先で活かす。',
    allowSpoiler
      ? '- ネタバレOK。ただし核心の結末を断定的に書きすぎない。'
      : '- ネタバレ厳禁。具体的なあらすじ・結末・展開には触れず、観た「感想・気持ち」だけを書く。',
    '- 知らない事実を捏造しない。あらすじを語らず、あくまで感じたことを書く。',
    '- 絵文字は0〜2個まで。ハッシュタグ「#」は付けない。文章全体をクオートで囲まない。',
    '- 前置きや説明は一切書かず、感想本文だけを出力する。',
    '',
    '感想本文:',
  ].join('\n')

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.95,
        maxOutputTokens: 400,
        thinkingConfig: { thinkingBudget: 0 },
      },
    })

    const text = (response.text || '').trim()
    if (!text) {
      return NextResponse.json({ error: 'empty generation' }, { status: 502 })
    }
    // 文章全体がクオートで囲まれている場合のみ外す
    // (タイトルを『』で囲む等の途中のクオートは残す)
    const cleaned = text
      .replace(/^"([\s\S]*)"$/, '$1')
      .replace(/^「([\s\S]*)」$/, '$1')
      .trim()
    return NextResponse.json({ text: cleaned })
  } catch (e) {
    console.error('[ai-review] generation failed:', e)
    return NextResponse.json({ error: (e as Error).message || 'generation failed' }, { status: 500 })
  }
}
