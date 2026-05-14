'use client'

/**
 * SSR の /people/[id] ページに置く、作品追加ボタンの小さなクライアント wrapper。
 * ログインユーザーのみボタンを表示し、クリックで WorkRegisterModal を
 * 「この人物が監督 / 脚本 / キャスト」として事前埋めで開く。
 *
 * - 監督画面なら role='director'、俳優画面なら role='cast' を初期値にする。
 *   呼び出し側で role を渡す。
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import WorkRegisterModal from './WorkRegisterModal'

interface Props {
  personId: number
  personName: string
  profilePath: string | null
  role: 'director' | 'writer' | 'cast'
}

export default function PersonAddWorkTrigger({ personId, personName, profilePath, role }: Props) {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
  }, [])

  if (!userId) return null

  const label = role === 'director'
    ? 'この監督の作品を追加'
    : role === 'writer'
    ? 'この脚本家の作品を追加'
    : 'この人物の作品を追加'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '8px 18px', borderRadius: 999, border: 'none',
          background: 'var(--fm-accent)', color: '#fff',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >
        ＋ {label}
      </button>
      {open && (
        <WorkRegisterModal
          userId={userId}
          initialQuery=""
          initialPerson={{
            id: personId,
            name: personName,
            profilePath,
            role,
          }}
          onClose={() => setOpen(false)}
          onOpenWork={(id, type) => {
            const path = type === 'movie' ? 'movies' : 'tv'
            router.push(`/${path}/${id}`)
          }}
        />
      )}
    </>
  )
}
