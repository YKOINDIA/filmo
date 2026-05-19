// ============================================================
// うらにゃん。: 結果カード PNG 画像化
// ============================================================
// html-to-image (~16KB) で DOM 要素を PNG 化し、
// (a) Web Share API でファイル添付シェア (iOS/Android 対応)
// (b) フォールバックでローカルダウンロード
// を提供する。Instagram ストーリーへの貼り付け運用を想定。

import { toBlob } from 'html-to-image'

const PNG_OPTIONS = {
  cacheBust: true,
  pixelRatio: 2,                          // Retina 用に 2x で書き出し
  backgroundColor: '#0a0612',             // 背景透明だと SNS で白枠になるので明示
  fetchRequestInit: { mode: 'no-cors' as RequestMode }, // 外部画像の CORS 失敗で出力空になる対策
}

/**
 * 要素を PNG Blob 化する。エラー時は null。
 */
export async function captureElementToBlob(el: HTMLElement): Promise<Blob | null> {
  try {
    const blob = await toBlob(el, PNG_OPTIONS)
    return blob
  } catch (e) {
    console.warn('[imageExport] toBlob failed:', e)
    return null
  }
}

/**
 * iOS/Android: Web Share API でファイル添付シェア (シェアシート起動)
 * 未対応: ローカルダウンロード
 *
 * 返り値: 'shared' | 'downloaded' | 'failed'
 */
export async function shareOrDownloadImage(el: HTMLElement, fileName: string): Promise<'shared' | 'downloaded' | 'failed'> {
  const blob = await captureElementToBlob(el)
  if (!blob) return 'failed'

  // Web Share API (files 対応) を試す
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], fileName, { type: 'image/png' })
      const canShareFiles = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
      if (canShareFiles) {
        await navigator.share({
          files: [file],
          title: 'うらにゃん。',
          text: '#うらにゃん',
        })
        return 'shared'
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'shared' // ユーザーキャンセル扱い
      console.warn('[imageExport] navigator.share failed:', e)
    }
  }

  // フォールバック: <a download> でダウンロード
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return 'downloaded'
  } catch (e) {
    console.warn('[imageExport] download fallback failed:', e)
    return 'failed'
  }
}

/**
 * 占い種別 + 日付 でファイル名を作る
 */
export function buildImageFileName(menu: string, label?: string): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const safeLabel = (label ?? menu).replace(/[\s/\\:*?"<>|]/g, '_').slice(0, 40)
  return `uranyan_${safeLabel}_${y}${m}${d}.png`
}
