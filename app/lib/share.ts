// ============================================================
// 共有ヘルパー: X (Twitter) / LINE / OS ネイティブシェア / クリップボード
// ============================================================
// ティーン主体ユーザー想定で LINE を最優先導線に。
// 各ゲーム・占い結果から共通で呼べるよう統一インタフェースを用意。
//
// LINE: https://line.me/R/msg/text/?{ENCODED}
//   - text と URL を同じテキストフィールドに入れて渡す (URL 行は自動でリンク化)
//   - スマホでは LINE アプリが立ち上がり、PC では LINE Web 版が開く
// X (Twitter): https://twitter.com/intent/tweet?text=...&url=...
// ネイティブ: navigator.share() — iOS/Android では OS シェアシート

export type ShareChannel = 'twitter' | 'line' | 'native' | 'copy_link'

function isNativeShareAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export function shareToTwitter(text: string, url: string) {
  const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
  window.open(u, '_blank', 'noopener,noreferrer')
}

export function shareToLine(text: string, url: string) {
  // LINE は text と URL を同じパラメータに含めるのが標準。
  // 改行はそのまま LINE 側で表示される。
  const body = url ? `${text}\n${url}` : text
  const u = `https://line.me/R/msg/text/?${encodeURIComponent(body)}`
  window.open(u, '_blank', 'noopener,noreferrer')
}

/**
 * OS ネイティブのシェアシートを開く (iOS/Android Safari/Chrome 対応)。
 * 利用不可なら false を返すので、呼び出し側でフォールバックを。
 */
export async function shareNative(opts: {
  title?: string
  text: string
  url: string
}): Promise<boolean> {
  if (!isNativeShareAvailable()) return false
  try {
    await navigator.share({ title: opts.title, text: opts.text, url: opts.url })
    return true
  } catch (e) {
    // AbortError (ユーザーがキャンセル) はエラー扱いしない
    if ((e as Error)?.name === 'AbortError') return true
    console.warn('[share] native share failed:', e)
    return false
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
