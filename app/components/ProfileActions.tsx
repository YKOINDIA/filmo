'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'
import ReportModal from './ReportModal'

interface ProfileActionsProps {
  profileUserId: string
  profileDisplayName: string
}

/**
 * プロフィールページの「⋯」メニュー。
 * 通報 / ブロック / ブロック解除 を提供。
 *
 * App Store 審査ガイドライン 1.2 のための UGC 安全機能。
 * 自分のプロフィールでは何も表示しない。
 */
export default function ProfileActions({ profileUserId, profileDisplayName }: ProfileActionsProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isBlocked, setIsBlocked] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (!session?.user) {
        setCurrentUserId(null)
        return
      }
      setCurrentUserId(session.user.id)
      const { data } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', session.user.id)
        .eq('blocked_id', profileUserId)
        .maybeSingle()
      if (!cancelled) setIsBlocked(!!data)
    })()
    return () => { cancelled = true }
  }, [profileUserId])

  const handleBlock = useCallback(async () => {
    if (!confirm(`${profileDisplayName} さんをブロックします。\nブロックすると、相手のレビューやリストが表示されなくなります。`)) return
    setWorking(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { showToast('ログインが必要です'); return }
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ blockedId: profileUserId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'ブロックに失敗しました')
        return
      }
      setIsBlocked(true)
      setMenuOpen(false)
      showToast('ブロックしました')
    } catch {
      showToast('ブロックに失敗しました')
    } finally {
      setWorking(false)
    }
  }, [profileUserId, profileDisplayName])

  const handleUnblock = useCallback(async () => {
    setWorking(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { showToast('ログインが必要です'); return }
      const res = await fetch(`/api/blocks?blockedId=${encodeURIComponent(profileUserId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || '解除に失敗しました')
        return
      }
      setIsBlocked(false)
      setMenuOpen(false)
      showToast('ブロックを解除しました')
    } catch {
      showToast('解除に失敗しました')
    } finally {
      setWorking(false)
    }
  }, [profileUserId])

  // 未ログインまたは自分自身のプロフィールでは表示しない
  if (!currentUserId || currentUserId === profileUserId) return null

  return (
    <>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          aria-label="メニュー"
          disabled={working}
          style={{
            background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
            cursor: working ? 'not-allowed' : 'pointer', color: 'var(--fm-text)',
            fontSize: 18, padding: '6px 12px', borderRadius: 8, lineHeight: 1,
            opacity: working ? 0.5 : 1,
          }}
        >⋯</button>
        {menuOpen && (
          <>
            <div
              onClick={() => setMenuOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 50 }}
            />
            <div style={{
              position: 'absolute', top: '100%', right: 0, zIndex: 51, marginTop: 4,
              background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
              borderRadius: 10, minWidth: 180, padding: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              <button
                onClick={() => {
                  setShowReport(true)
                  setMenuOpen(false)
                }}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 12px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--fm-text)', fontSize: 13, borderRadius: 6,
                }}
              >🚩 ユーザーを通報</button>
              {isBlocked ? (
                <button
                  onClick={handleUnblock}
                  disabled={working}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 12px',
                    background: 'none', border: 'none',
                    cursor: working ? 'not-allowed' : 'pointer',
                    color: 'var(--fm-text)', fontSize: 13, borderRadius: 6,
                  }}
                >🔓 ブロックを解除</button>
              ) : (
                <button
                  onClick={handleBlock}
                  disabled={working}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 12px',
                    background: 'none', border: 'none',
                    cursor: working ? 'not-allowed' : 'pointer',
                    color: 'var(--fm-danger)', fontSize: 13, borderRadius: 6,
                  }}
                >🚫 ユーザーをブロック</button>
              )}
            </div>
          </>
        )}
      </div>

      {isBlocked && (
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)',
          color: 'var(--fm-danger)', fontSize: 12, marginTop: 12,
        }}>
          このユーザーをブロックしています。レビュー・リストはあなたのフィードに表示されません。
        </div>
      )}

      {showReport && (
        <ReportModal
          targetType="user"
          targetId={profileUserId}
          targetLabel={`${profileDisplayName} さん`}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  )
}
