'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  is_read: boolean
  created_at: string
}

const TYPE_ICONS: Record<string, string> = {
  new_follower: '👤',
  new_like: '❤️',
  new_release: '🎬',
  streaming_available: '📺',
  theater_showing: '🎭',
  fan_new_work: '⭐',
  system: '🔔',
  achievement: '🏆',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `${min}分前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}時間前`
  return `${Math.floor(hr / 24)}日前`
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  const loadNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter((n: Notification) => !n.is_read).length)
    }
  }

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => { setOpen(!open); if (!open) loadNotifications() }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, position: 'relative', padding: 4 }}>
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderRadius: '50%',
            background: 'var(--fm-danger)', color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div className="animate-fade-in" style={{
            position: 'absolute', top: '100%', right: 0, width: 320, maxHeight: 400,
            overflowY: 'auto', zIndex: 201, borderRadius: 12, border: '1px solid var(--fm-border)',
            background: 'var(--fm-bg-card)', boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--fm-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>通知</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead}
                  style={{ background: 'none', border: 'none', color: 'var(--fm-accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  すべて既読
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--fm-text-sub)', fontSize: 13 }}>
                通知はありません
              </div>
            ) : notifications.map(n => (
              <div key={n.id} style={{
                padding: '10px 16px', borderBottom: '1px solid var(--fm-border)',
                background: n.is_read ? 'transparent' : 'rgba(108,92,231,0.05)',
                display: 'flex', gap: 10, cursor: 'pointer',
              }} onClick={async () => {
                if (!n.is_read) {
                  await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
                  setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
                  setUnreadCount(prev => Math.max(0, prev - 1))
                }
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{TYPE_ICONS[n.type] || '🔔'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600 }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>}
                  <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 2 }}>{timeAgo(n.created_at)}</div>
                </div>
                {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--fm-accent)', flexShrink: 0, marginTop: 4 }} />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
