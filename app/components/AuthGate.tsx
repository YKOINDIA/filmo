'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  /** ログイン済みユーザーには見せたくない要素を入れる */
  hideWhenAuthed?: boolean
  /** ログイン済み専用要素 */
  showWhenAuthed?: boolean
  children: React.ReactNode
}

export default function AuthGate({ hideWhenAuthed, showWhenAuthed, children }: Props) {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setAuthed(!!session?.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!cancelled) setAuthed(!!s?.user)
    })
    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  if (authed === null) return null
  if (hideWhenAuthed && authed) return null
  if (showWhenAuthed && !authed) return null
  return <>{children}</>
}
