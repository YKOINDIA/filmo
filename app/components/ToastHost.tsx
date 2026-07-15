'use client'

import { useState, useEffect, useRef } from 'react'
import Toast from './Toast'

// showToast (app/lib/toast.ts) が発行する filmo-toast イベントを全ページで受ける。
// 以前は app/page.tsx の通常タブ表示ブランチだけが Toast を描画していたため、
// WorkDetail / PersonDetail の全画面表示中や /games などの別ルートでは
// トーストが一切表示されなかった (保存完了もエラーも無反応に見える)。
export default function ToastHost() {
  const [msg, setMsg] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      setMsg((e as CustomEvent).detail)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setMsg(''), 3000)
    }
    window.addEventListener('filmo-toast', handler)
    return () => {
      window.removeEventListener('filmo-toast', handler)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!msg) return null
  return <Toast message={msg} />
}
