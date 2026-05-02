'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'

const CATEGORIES: { value: 'feature' | 'bug' | 'question' | 'other'; label: string; icon: string }[] = [
  { value: 'question', label: '質問', icon: '❓' },
  { value: 'bug', label: '不具合', icon: '🐛' },
  { value: 'feature', label: '機能要望', icon: '💡' },
  { value: 'other', label: 'その他', icon: '💬' },
]

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  open: { label: '未対応', color: '#f0c040' },
  in_progress: { label: '対応中', color: '#2ecc8a' },
  resolved: { label: '解決済', color: '#888' },
}

interface Thread {
  id: string
  category: string
  subject: string
  status: string
  unread_user: boolean
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  body: string
  is_admin: boolean
  created_at: string
}

/**
 * 右下に浮かぶ問い合わせウィジェット。
 *
 * 閉じてる時: 円形のチャットアイコン
 * 開いた時: ボトムシート風モーダル
 *   - スレッド一覧 (自分が立てたものだけ。RLS で保証)
 *   - 個別スレッド表示 + 返信
 *   - 新規スレッド作成 (件名・カテゴリ・本文)
 *
 * /support 公開ページとは別経路。ログインユーザー専用 (RLS で user_id 紐付け済み)。
 */
export default function FeedbackWidget({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'list' | 'new' | 'thread'>('list')
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThread, setActiveThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingThreads, setLoadingThreads] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)

  // 新規スレッド入力
  const [newCategory, setNewCategory] = useState<typeof CATEGORIES[number]['value']>('question')
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [creating, setCreating] = useState(false)

  // スレッド返信入力
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 未読バッジ用 (一覧画面で読んでなくても気づける)
  const [hasUnread, setHasUnread] = useState(false)

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true)
    try {
      const { data } = await supabase
        .from('feedback_threads')
        .select('id, category, subject, status, unread_user, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(50)
      const rows = (data || []) as Thread[]
      setThreads(rows)
      setHasUnread(rows.some(t => t.unread_user))
    } catch (err) {
      console.error('feedback threads load failed:', err)
    } finally {
      setLoadingThreads(false)
    }
  }, [userId])

  // マウント時 + 開いた時に最新を取得
  useEffect(() => {
    loadThreads()
    // 5分ごとに未読チェック (軽量)
    const t = setInterval(loadThreads, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [loadThreads])

  useEffect(() => {
    if (open) loadThreads()
  }, [open, loadThreads])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const openThread = async (thread: Thread) => {
    setActiveThread(thread)
    setView('thread')
    setLoadingMessages(true)
    try {
      const { data } = await supabase
        .from('feedback_messages')
        .select('id, body, is_admin, created_at')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true })
      setMessages((data || []) as Message[])
      // 既読マーク
      if (thread.unread_user) {
        await supabase.from('feedback_threads').update({ unread_user: false }).eq('id', thread.id)
        setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unread_user: false } : t))
        setHasUnread(prev => threads.filter(t => t.id !== thread.id).some(t => t.unread_user))
      }
    } catch (err) {
      console.error('messages load failed:', err)
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleCreate = async () => {
    if (creating) return
    if (!newSubject.trim() || newSubject.length < 2) {
      showToast('件名を入力してください')
      return
    }
    if (!newBody.trim() || newBody.length < 5) {
      showToast('本文を 5 文字以上で入力してください')
      return
    }
    setCreating(true)
    try {
      const { data: thread, error: tErr } = await supabase
        .from('feedback_threads')
        .insert({
          user_id: userId,
          category: newCategory,
          subject: newSubject.trim(),
          status: 'open',
          unread_admin: true,
          unread_user: false,
        })
        .select('id, category, subject, status, unread_user, created_at, updated_at')
        .single()
      if (tErr || !thread) throw new Error(tErr?.message || '送信に失敗')
      const { error: mErr } = await supabase
        .from('feedback_messages')
        .insert({ thread_id: thread.id, body: newBody.trim(), is_admin: false })
      if (mErr) console.warn('first message insert failed:', mErr)

      showToast('お問い合わせを送信しました')
      setNewSubject('')
      setNewBody('')
      setNewCategory('question')
      // 新スレッドをそのまま開く
      await loadThreads()
      openThread(thread as Thread)
    } catch (err) {
      console.error('create thread failed:', err)
      showToast('送信に失敗しました')
    } finally {
      setCreating(false)
    }
  }

  const handleReply = async () => {
    if (sending) return
    if (!activeThread || !replyText.trim()) return
    setSending(true)
    try {
      const body = replyText.trim()
      const { error: mErr } = await supabase
        .from('feedback_messages')
        .insert({ thread_id: activeThread.id, body, is_admin: false })
      if (mErr) throw mErr
      // 管理者再通知 + ステータス open に戻す (resolved 後の追加質問も拾えるように)
      await supabase
        .from('feedback_threads')
        .update({ unread_admin: true, status: activeThread.status === 'resolved' ? 'open' : activeThread.status, updated_at: new Date().toISOString() })
        .eq('id', activeThread.id)
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), body, is_admin: false, created_at: new Date().toISOString(),
      }])
      setReplyText('')
    } catch (err) {
      console.error('reply failed:', err)
      showToast('送信に失敗しました')
    } finally {
      setSending(false)
    }
  }

  const close = () => {
    setOpen(false)
    setView('list')
    setActiveThread(null)
    setMessages([])
  }

  return (
    <>
      {/* 浮かぶボタン */}
      <button
        aria-label="お問い合わせ"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
          color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: '0 6px 24px rgba(108,92,231,0.5)',
          zIndex: 9000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24,
        }}
      >
        💬
        {hasUnread && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 12, height: 12, borderRadius: '50%',
            background: '#ef4444', border: '2px solid var(--fm-bg)',
          }} />
        )}
      </button>

      {/* モーダル */}
      {open && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 99000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 520,
              // dvh (dynamic viewport height) を使うことで iOS キーボード表示時に
              // モーダルが自動で縮み、textarea + 送信ボタンが必ず画面内に収まる。
              // vh だとキーボード分が考慮されず、ヘッダーが画面外に押し出されて
              // 真っ黒な領域だけが見える状態になっていた。
              height: '80dvh',
              maxHeight: '80dvh',
              background: 'var(--fm-bg)', borderTopLeftRadius: 16, borderTopRightRadius: 16,
              display: 'flex', flexDirection: 'column',
              // iOS WKWebView で内部要素 (絵文字混じりボタン等) が
              // 微妙に親をはみ出して右端が切れる現象の防止。
              // overflow-x: hidden を単独で指定すると CSS 仕様で overflow-y が
              // 強制的に auto になり、内部の overflow-y: auto と二重スクロール
              // を起こすので overflow-y も明示的に hidden にする。
              overflow: 'hidden',
            }}
          >
            {/* ヘッダー */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid var(--fm-border)',
            }}>
              {view === 'list' && (
                <>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)' }}>
                    💬 お問い合わせ
                  </span>
                  <button onClick={close} style={iconBtn}>✕</button>
                </>
              )}
              {view === 'new' && (
                <>
                  <button onClick={() => setView('list')} style={iconBtn}>←</button>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fm-text)' }}>新しいお問い合わせ</span>
                  <button onClick={close} style={iconBtn}>✕</button>
                </>
              )}
              {view === 'thread' && activeThread && (
                <>
                  <button onClick={() => { setView('list'); setActiveThread(null) }} style={iconBtn}>←</button>
                  <div style={{ flex: 1, minWidth: 0, padding: '0 8px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {activeThread.subject}
                    </div>
                    <div style={{ fontSize: 11, color: STATUS_LABEL[activeThread.status]?.color || 'var(--fm-text-sub)' }}>
                      {STATUS_LABEL[activeThread.status]?.label || activeThread.status}
                    </div>
                  </div>
                  <button onClick={close} style={iconBtn}>✕</button>
                </>
              )}
            </div>

            {/* 中身 */}
            {view === 'list' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                <button
                  onClick={() => setView('new')}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                    background: 'var(--fm-accent)', color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', marginBottom: 16,
                  }}
                >
                  + 新しいお問い合わせ
                </button>

                {loadingThreads ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--fm-text-sub)', fontSize: 13 }}>
                    読み込み中…
                  </div>
                ) : threads.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--fm-text-muted)' }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
                    <div style={{ fontSize: 13 }}>まだお問い合わせはありません</div>
                  </div>
                ) : (
                  threads.map(t => {
                    const cat = CATEGORIES.find(c => c.value === t.category)
                    const status = STATUS_LABEL[t.status]
                    return (
                      <button
                        key={t.id}
                        onClick={() => openThread(t)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: 12, marginBottom: 8, borderRadius: 10,
                          background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
                          cursor: 'pointer', position: 'relative',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fm-text-muted)', marginBottom: 4 }}>
                          <span>{cat?.icon} {cat?.label || t.category}</span>
                          <span style={{ flex: 1 }} />
                          <span style={{ color: status?.color }}>● {status?.label}</span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.subject}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 4 }}>
                          {new Date(t.updated_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {t.unread_user && (
                          <span style={{
                            position: 'absolute', top: 12, right: 12,
                            width: 8, height: 8, borderRadius: '50%', background: '#ef4444',
                          }} />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            )}

            {view === 'new' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: 'var(--fm-text-sub)', fontWeight: 600, marginBottom: 6, display: 'block' }}>カテゴリ</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {CATEGORIES.map(c => {
                      const sel = newCategory === c.value
                      return (
                        <button
                          key={c.value}
                          onClick={() => setNewCategory(c.value)}
                          style={{
                            padding: '10px 4px', borderRadius: 8,
                            border: `1px solid ${sel ? 'var(--fm-accent)' : 'var(--fm-border)'}`,
                            background: sel ? 'rgba(108,92,231,0.18)' : 'var(--fm-bg-input)',
                            color: sel ? 'var(--fm-accent)' : 'var(--fm-text-sub)',
                            fontSize: 12, fontWeight: sel ? 700 : 500, cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontSize: 18 }}>{c.icon}</div>
                          {c.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: 'var(--fm-text-sub)', fontWeight: 600, marginBottom: 6, display: 'block' }}>件名</label>
                  <input
                    value={newSubject}
                    onChange={e => setNewSubject(e.target.value)}
                    placeholder="例: 配信サービスの絞り込みについて"
                    maxLength={200}
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: 'var(--fm-text-sub)', fontWeight: 600, marginBottom: 6, display: 'block' }}>
                    お問い合わせ内容 <span style={{ color: 'var(--fm-text-muted)', fontWeight: 400 }}>({newBody.length} / 5000)</span>
                  </label>
                  <textarea
                    value={newBody}
                    onChange={e => setNewBody(e.target.value)}
                    placeholder="詳しい内容をご記入ください。"
                    maxLength={5000}
                    style={{ ...inputStyle, minHeight: 140, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                <button
                  onClick={handleCreate}
                  disabled={creating || !newSubject.trim() || !newBody.trim()}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                    background: 'var(--fm-accent)', color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: creating ? 'not-allowed' : 'pointer',
                    opacity: (!newSubject.trim() || !newBody.trim() || creating) ? 0.5 : 1,
                  }}
                >
                  {creating ? '送信中…' : '送信する'}
                </button>
              </div>
            )}

            {view === 'thread' && activeThread && (
              <>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                  {loadingMessages ? (
                    <div style={{ textAlign: 'center', padding: 24, color: 'var(--fm-text-sub)', fontSize: 13 }}>読み込み中…</div>
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 24, color: 'var(--fm-text-muted)', fontSize: 13 }}>メッセージなし</div>
                  ) : (
                    messages.map(m => (
                      <div key={m.id} style={{
                        display: 'flex',
                        justifyContent: m.is_admin ? 'flex-start' : 'flex-end',
                        marginBottom: 10,
                        // 子要素が過度に伸びて吹き出しが画面右端を超えないように
                        minWidth: 0,
                      }}>
                        <div style={{
                          // 78% は iOS で時計表示と本文の組み合わせで右端が切れることがあったため少し詰める
                          maxWidth: '75%',
                          minWidth: 0,
                          padding: '10px 14px',
                          borderRadius: 14,
                          background: m.is_admin ? 'var(--fm-bg-card)' : 'var(--fm-accent)',
                          color: m.is_admin ? 'var(--fm-text)' : '#fff',
                          fontSize: 14, lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          // 改善: word-break: break-word は iOS で稀に長い英単語以外も中途半端に切る。
                          // overflow-wrap: anywhere の方が日本語 + 英数混在でも自然に折り返す。
                          overflowWrap: 'anywhere',
                          border: m.is_admin ? '1px solid var(--fm-border)' : 'none',
                        }}>
                          {m.is_admin && (
                            <div style={{ fontSize: 11, color: 'var(--fm-accent)', fontWeight: 700, marginBottom: 4 }}>
                              🎬 Filmo サポート
                            </div>
                          )}
                          {m.body}
                          <div style={{
                            fontSize: 10, color: m.is_admin ? 'var(--fm-text-muted)' : 'rgba(255,255,255,0.7)',
                            marginTop: 4, textAlign: m.is_admin ? 'left' : 'right',
                          }}>
                            {new Date(m.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div style={{
                  borderTop: '1px solid var(--fm-border)',
                  padding: '10px 12px',
                  display: 'flex', gap: 8, alignItems: 'flex-end',
                }}>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="返信を入力…"
                    rows={2}
                    maxLength={5000}
                    style={{ ...inputStyle, flex: 1, marginBottom: 0, resize: 'none', fontFamily: 'inherit' }}
                  />
                  <button
                    onClick={handleReply}
                    disabled={sending || !replyText.trim()}
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: 'none',
                      background: 'var(--fm-accent)', color: '#fff', fontSize: 13, fontWeight: 700,
                      cursor: sending ? 'not-allowed' : 'pointer',
                      opacity: !replyText.trim() ? 0.5 : 1,
                    }}
                  >
                    {sending ? '…' : '送信'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 8,
  border: '1px solid var(--fm-border)',
  background: 'var(--fm-bg-input)',
  color: 'var(--fm-text)',
  fontSize: 14,
  boxSizing: 'border-box',
}

const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--fm-text-sub)',
  fontSize: 18,
  cursor: 'pointer',
  padding: '4px 8px',
}
