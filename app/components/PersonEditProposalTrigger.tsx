'use client'

/**
 * SSR の /people/[id] ページに置く、編集提案ボタンの小さなクライアント wrapper。
 * ログインユーザーのみボタン表示、クリックで PersonEditProposalModal を開く。
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import PersonEditProposalModal from './PersonEditProposalModal'

interface Props {
  personId: number
  current: {
    name?: string | null
    original_name?: string | null
    biography?: string | null
    birthday?: string | null
    place_of_birth?: string | null
    homepage?: string | null
  }
}

export default function PersonEditProposalTrigger({ personId, current }: Props) {
  const [authed, setAuthed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session?.user)
    })
  }, [])

  if (!authed) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '6px 14px', borderRadius: 999, border: '1px solid var(--fm-border)',
          background: 'transparent', color: 'var(--fm-text-sub)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        ✎ 編集を提案
      </button>
      {open && (
        <PersonEditProposalModal
          personId={personId}
          current={current}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
