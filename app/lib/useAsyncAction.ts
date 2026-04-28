'use client'

import { useCallback, useRef, useState } from 'react'
import { showToast } from './toast'

/**
 * 二重実行防止 + toast 付き非同期アクション。
 *
 * 例:
 *   const [save, saving] = useAsyncAction(
 *     async () => {
 *       await supabase.from('users').update({...}).eq('id', userId)
 *     },
 *     { success: '保存しました', failure: '保存に失敗しました' }
 *   )
 *   <button disabled={saving} onClick={save}>保存</button>
 *
 * - 連打しても in-flight 中は無視される (loading 中の呼び出しは throw せず黙ってスキップ)
 * - 成功時: opts.success が指定されていれば toast 表示
 * - 失敗時: opts.failure (または既定文言) を toast、エラーは console.error
 * - opts.success に空文字を渡すと成功時 toast を出さない (連続更新系で使う)
 */
export function useAsyncAction<TArgs extends unknown[], TResult = void>(
  fn: (...args: TArgs) => Promise<TResult>,
  opts?: { success?: string; failure?: string; suppressFailureToast?: boolean }
): [run: (...args: TArgs) => Promise<TResult | undefined>, loading: boolean] {
  const [loading, setLoading] = useState(false)
  // useState の値は closure に閉じ込められやすいので ref で in-flight 判定
  const inFlightRef = useRef(false)

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (inFlightRef.current) return undefined
      inFlightRef.current = true
      setLoading(true)
      try {
        const result = await fn(...args)
        if (opts?.success !== undefined && opts.success.length > 0) {
          showToast(opts.success)
        }
        return result
      } catch (err) {
        console.error(err)
        if (!opts?.suppressFailureToast) {
          showToast(opts?.failure ?? 'エラーが発生しました')
        }
        return undefined
      } finally {
        inFlightRef.current = false
        setLoading(false)
      }
    },
    // fn / opts は呼び出し側で stable に保つ前提 (ハンドラ内でクロージャを毎回作るのが普通)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return [run, loading]
}
