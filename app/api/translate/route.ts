import { NextRequest, NextResponse } from 'next/server'

/**
 * Review Translation API
 * Translates text to the target language using Google Translate or DeepL.
 *
 * POST /api/translate
 * Body: { text: string, target: string, source?: string }
 * Response: { translated: string, source: string, provider: string }
 */

const DEEPL_API_KEY = process.env.DEEPL_API_KEY
const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY

// DeepL language codes differ slightly
const DEEPL_LANG_MAP: Record<string, string> = {
  en: 'EN',
  ja: 'JA',
  ko: 'KO',
  zh: 'ZH',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
  pt: 'PT-BR',
  it: 'IT',
  ru: 'RU',
}

async function translateWithDeepL(text: string, target: string, source?: string) {
  const targetLang = DEEPL_LANG_MAP[target] || target.toUpperCase()
  const body: Record<string, string | string[]> = {
    text: [text],
    target_lang: targetLang,
  }
  if (source) {
    const sourceLang = DEEPL_LANG_MAP[source] || source.toUpperCase()
    body.source_lang = sourceLang
  }

  const res = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`DeepL API error: ${res.status}`)
  const data = await res.json()
  return {
    translated: data.translations[0].text,
    source: data.translations[0].detected_source_language?.toLowerCase() || source || 'auto',
    provider: 'DeepL',
  }
}

async function translateWithGoogle(text: string, target: string, source?: string) {
  const params = new URLSearchParams({
    q: text,
    target,
    format: 'text',
    key: GOOGLE_TRANSLATE_API_KEY!,
  })
  if (source) params.set('source', source)

  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?${params.toString()}`,
    { method: 'POST' }
  )

  if (!res.ok) throw new Error(`Google Translate API error: ${res.status}`)
  const data = await res.json()
  const translation = data.data.translations[0]
  return {
    translated: translation.translatedText,
    source: translation.detectedSourceLanguage || source || 'auto',
    provider: 'Google',
  }
}

/** Free fallback: Google Translate via unofficial endpoint (for dev/testing) */
async function translateFree(text: string, target: string, source: string = 'auto') {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: source,
    tl: target,
    dt: 't',
    q: text,
  })

  const res = await fetch(
    `https://translate.googleapis.com/translate_a/single?${params.toString()}`
  )

  if (!res.ok) throw new Error(`Translation failed: ${res.status}`)
  const data = await res.json()
  const translated = (data[0] as [string][]).map((s: unknown[]) => s[0]).join('')
  const detectedSource = data[2] || source

  return {
    translated,
    source: detectedSource,
    provider: 'Google',
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, target, source } = body as {
      text: string
      target: string
      source?: string
    }

    if (!text || !target) {
      return NextResponse.json({ error: 'text and target are required' }, { status: 400 })
    }

    if (text.length > 5000) {
      return NextResponse.json({ error: 'Text too long (max 5000 chars)' }, { status: 400 })
    }

    let result

    // Priority: DeepL > Google (paid) > Google (free fallback)
    if (DEEPL_API_KEY) {
      result = await translateWithDeepL(text, target, source)
    } else if (GOOGLE_TRANSLATE_API_KEY) {
      result = await translateWithGoogle(text, target, source)
    } else {
      // Free fallback for development
      result = await translateFree(text, target, source)
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('Translation error:', e)
    return NextResponse.json(
      { error: (e as Error).message || 'Translation failed' },
      { status: 500 }
    )
  }
}
