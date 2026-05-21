/**
 * Standalone-app mode detection.
 *
 * Filmo の Capacitor アプリは、デフォルトでは Filmo 本体 (https://filmo.me) を WebView で開く。
 * 一方、うらにゃん単独 iOS アプリ (`jp.filmo.uranyan`) は同じ Web サイトを
 * `?app=uranyan` クエリ付きで開くことで、フロント側に「自分はうらにゃん専用アプリだ」と
 * 伝えるパターンを採用する。
 *
 * このモードを検出すると:
 *   - ヘッダー/ナビ等 Filmo の他機能への導線を非表示にする
 *   - 「← ホーム」が Filmo TopPage ではなくうらにゃんメニューに戻る
 *   - 外部リンク (Filmo の他画面、X など) は新しいウィンドウで開く
 *     → Capacitor は target=_blank を外部 Safari にルートするので、
 *       Apple 4.2 (Minimum Functionality) リジェクト対策にもなる
 *
 * 永続化: 一度 `?app=uranyan` で起動すれば localStorage に記録し、以降は
 * クエリ無しでもアプリモードとして扱う。サーバーサイドからは判定不可。
 */
'use client'

import { useEffect, useState } from 'react'

export type StandaloneAppMode = 'uranyan' | null

const STORAGE_KEY = 'filmo_app_mode'
const QUERY_KEY = 'app'

const VALID_MODES = new Set<string>(['uranyan'])

function readStoredMode(): StandaloneAppMode {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v && VALID_MODES.has(v)) return v as StandaloneAppMode
  } catch {
    // localStorage が無効化されている環境
  }
  return null
}

function readQueryMode(): StandaloneAppMode {
  if (typeof window === 'undefined') return null
  try {
    const v = new URL(window.location.href).searchParams.get(QUERY_KEY)
    if (v && VALID_MODES.has(v)) return v as StandaloneAppMode
  } catch {
    // URL parse 失敗
  }
  return null
}

function persistMode(mode: StandaloneAppMode) {
  if (typeof window === 'undefined') return
  try {
    if (mode) window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // 永続化失敗してもアプリ動作は継続できる (クエリで再判定可能)
  }
}

/**
 * 同期的にアプリモードを返す (SSR では常に null)。
 *
 * 初期表示時のレイアウト分岐に使いたい場合は useStandaloneApp() を推奨。
 * このユーティリティは「すでにクライアントで動いているコード」から呼ぶことを想定。
 */
export function getStandaloneAppMode(): StandaloneAppMode {
  return readQueryMode() ?? readStoredMode()
}

export function isStandaloneApp(mode: StandaloneAppMode = getStandaloneAppMode()): boolean {
  return mode !== null
}

/**
 * React hook: クライアント初期化時に URL クエリを読み、localStorage に永続化する。
 * SSR では null、ハイドレーション後に実値に更新される。
 */
export function useStandaloneApp(): StandaloneAppMode {
  const [mode, setMode] = useState<StandaloneAppMode>(null)

  useEffect(() => {
    const queryMode = readQueryMode()
    if (queryMode) {
      persistMode(queryMode)
      setMode(queryMode)
      return
    }
    setMode(readStoredMode())
  }, [])

  return mode
}
