'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import ListDetail from './ListDetail'
import { useLocale } from '../lib/i18n'
import { showToast } from '../lib/toast'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

interface UserListsProps {
  userId: string
  onOpenWork: (id: number, type?: 'movie' | 'tv') => void
}

interface ListItem {
  id: string
  title: string
  description: string
  is_public: boolean
  is_ranked: boolean
  items_count: number
  likes_count: number
  created_at: string
  updated_at: string
  user_id: string
  // joined
  user_name?: string
  user_avatar?: string | null
  posters?: string[]
}

interface TMDBResult {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  media_type?: string
}

type ViewMode = 'curated' | 'my' | 'popular' | 'recent'

export default function UserLists({ userId, onOpenWork }: UserListsProps) {
  const { t } = useLocale()
  const [viewMode, setViewMode] = useState<ViewMode>('my')
  const [lists, setLists] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedList, setSelectedList] = useState<string | null>(null)

  // Create form
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPublic, setNewPublic] = useState(true)
  const [newRanked, setNewRanked] = useState(false)
  const [newCollaborative, setNewCollaborative] = useState(false)
  const [creating, setCreating] = useState(false)

  const fetchLists = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from('user_lists').select('*')

      if (viewMode === 'my') {
        query = query.eq('user_id', userId).order('updated_at', { ascending: false })
      } else if (viewMode === 'curated') {
        // Filmo編集部のキュレーションリスト
        query = query.eq('is_curated', true).eq('is_public', true).gt('items_count', 0).order('likes_count', { ascending: false }).limit(60)
      } else if (viewMode === 'popular') {
        query = query.eq('is_public', true).eq('is_curated', false).gt('items_count', 0).order('likes_count', { ascending: false }).limit(30)
      } else {
        query = query.eq('is_public', true).eq('is_curated', false).gt('items_count', 0).order('created_at', { ascending: false }).limit(30)
      }

      const { data } = await query
      let items = (data || []) as unknown as ListItem[]

      // Fetch user names for non-my lists
      if (viewMode !== 'my' && items.length > 0) {
        const userIds = [...new Set(items.map(i => i.user_id))]
        const { data: users } = await supabase
          .from('users')
          .select('id, name, avatar_url')
          .in('id', userIds)
        const userMap = new Map<string, { name: string; avatar_url: string | null }>()
        if (users) {
          for (const u of users as unknown as { id: string; name: string; avatar_url: string | null }[]) {
            userMap.set(u.id, u)
          }
        }
        items = items.map(item => ({
          ...item,
          user_name: userMap.get(item.user_id)?.name,
          user_avatar: userMap.get(item.user_id)?.avatar_url,
        }))
      }

      // Fetch first 5 posters for each list
      if (items.length > 0) {
        const listIds = items.map(i => i.id)
        const { data: listItemsData } = await supabase
          .from('list_items')
          .select('list_id, movie_id')
          .in('list_id', listIds)
          .order('position', { ascending: true })

        if (listItemsData) {
          // Group by list, take first 5
          const listMovieMap = new Map<string, number[]>()
          for (const li of listItemsData as unknown as { list_id: string; movie_id: number }[]) {
            const existing = listMovieMap.get(li.list_id) || []
            if (existing.length < 5) {
              existing.push(li.movie_id)
              listMovieMap.set(li.list_id, existing)
            }
          }

          // Fetch movie posters
          const allMovieIds = [...new Set([...listMovieMap.values()].flat())]
          if (allMovieIds.length > 0) {
            const { data: movieData } = await supabase
              .from('movies')
              .select('tmdb_id, poster_path')
              .in('tmdb_id', allMovieIds)
            const posterMap = new Map<number, string | null>()
            if (movieData) {
              for (const m of movieData as unknown as { tmdb_id: number; poster_path: string | null }[]) {
                posterMap.set(m.tmdb_id, m.poster_path)
              }
            }
            items = items.map(item => ({
              ...item,
              posters: (listMovieMap.get(item.id) || [])
                .map(mid => posterMap.get(mid))
                .filter((p): p is string => p != null),
            }))
          }
        }
      }

      setLists(items)
    } catch (err) {
      console.error('Failed to fetch lists:', err)
    }
    setLoading(false)
  }, [userId, viewMode])

  useEffect(() => {
    fetchLists()
  }, [fetchLists])

  const handleCreate = async () => {
    if (creating) return
    if (!newTitle.trim()) {
      showToast('タイトルを入力してください')
      return
    }
    setCreating(true)
    try {
      const slug = newTitle.trim().toLowerCase().replace(/[^a-z0-9\u3040-\u9fff]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36)
      const { data, error } = await supabase
        .from('user_lists')
        .insert({
          user_id: userId,
          title: newTitle.trim(),
          description: newDesc.trim(),
          is_public: newPublic,
          is_ranked: newRanked,
          is_collaborative: newCollaborative && newPublic,
          slug,
        })
        .select()
        .single()

      if (error) throw error
      setShowCreate(false)
      setNewTitle('')
      setNewDesc('')
      setNewPublic(true)
      setNewRanked(false)
      setNewCollaborative(false)
      showToast('リストを作成しました')
      if (data) {
        // 作成したリストの詳細画面に遷移してすぐに作品追加できるようにする
        setSelectedList((data as unknown as ListItem).id)
      }
      fetchLists()
    } catch (err) {
      console.error('Failed to create list:', err)
      showToast('リストの作成に失敗しました')
    }
    setCreating(false)
  }

  if (selectedList) {
    return (
      <ListDetail
        listId={selectedList}
        userId={userId}
        onBack={() => { setSelectedList(null); fetchLists() }}
        onOpenWork={onOpenWork}
      />
    )
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 640, margin: '0 auto', padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fm-text)', margin: 0, letterSpacing: 0.3 }}>
          {t('lists.title')}
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--fm-accent)', color: '#fff', fontSize: 13, fontWeight: 600,
            transition: 'opacity 0.15s',
          }}
        >
          {t('lists.newList')}
        </button>
      </div>

      {/* View Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--fm-bg-card)', borderRadius: 8, padding: 3, overflowX: 'auto' }}>
        {([
          { key: 'curated' as ViewMode, label: '🎬 編集部' },
          { key: 'my' as ViewMode, label: t('lists.myLists') },
          { key: 'popular' as ViewMode, label: t('lists.popular') },
          { key: 'recent' as ViewMode, label: t('lists.recent') },
        ]).map(t => (
          <button key={t.key} onClick={() => setViewMode(t.key)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: viewMode === t.key ? 'var(--fm-accent)' : 'transparent',
              color: viewMode === t.key ? '#fff' : 'var(--fm-text-sub)',
              fontSize: 13, fontWeight: viewMode === t.key ? 600 : 400,
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--fm-overlay)', padding: 20,
        }}
        onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}
        >
          <div className="animate-fade-in" style={{
            background: 'var(--fm-bg-elevated)', borderRadius: 12, padding: 24,
            border: '1px solid var(--fm-border)', width: '100%', maxWidth: 440,
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 20px' }}>
              {t('lists.newListTitle')}
            </h2>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 4, fontWeight: 500 }}>{t('lists.titleLabel')}</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder={t('lists.titlePlaceholder')}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fm-border)',
                  background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14, boxSizing: 'border-box',
                }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 4, fontWeight: 500 }}>{t('lists.descriptionLabel')}</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
                rows={3} placeholder={t('lists.descriptionPlaceholder')}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fm-border)',
                  background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14, resize: 'vertical',
                  boxSizing: 'border-box', fontFamily: 'inherit',
                }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--fm-text-sub)' }}>
                <input type="checkbox" checked={newPublic} onChange={e => setNewPublic(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--fm-accent)' }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--fm-text)' }}>{t('lists.makePublic')}</div>
                  <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 1 }}>{t('lists.makePublicDesc')}</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--fm-text-sub)' }}>
                <input type="checkbox" checked={newRanked} onChange={e => setNewRanked(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--fm-accent)' }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--fm-text)' }}>{t('lists.makeRanked')}</div>
                  <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 1 }}>{t('lists.makeRankedDesc')}</div>
                </div>
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: newPublic ? 'pointer' : 'not-allowed',
                fontSize: 13, color: 'var(--fm-text-sub)',
                opacity: newPublic ? 1 : 0.5,
              }}>
                <input type="checkbox" checked={newCollaborative && newPublic}
                  disabled={!newPublic}
                  onChange={e => setNewCollaborative(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--fm-accent)' }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--fm-text)' }}>👥 みんなで作るリスト</div>
                  <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 1 }}>
                    他のユーザーがこのリストに作品を追加できます (公開リスト限定)
                  </div>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowCreate(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 8, border: '1px solid var(--fm-border)',
                  background: 'transparent', color: 'var(--fm-text-sub)', fontSize: 14,
                  fontWeight: 500, cursor: 'pointer',
                }}>
                {t('common.cancel')}
              </button>
              <button onClick={handleCreate} disabled={creating || !newTitle.trim()}
                style={{
                  flex: 1, padding: '12px', borderRadius: 8, border: 'none',
                  background: 'var(--fm-accent)', color: '#fff', fontSize: 14,
                  fontWeight: 600, cursor: 'pointer', opacity: creating || !newTitle.trim() ? 0.5 : 1,
                }}>
                {creating ? t('lists.creating') : t('lists.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List Cards */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              background: 'var(--fm-bg-card)', borderRadius: 10, height: 160,
              animation: 'pulse-skeleton 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`,
            }} />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fm-text-muted)' }}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </div>
          <p style={{ color: 'var(--fm-text-sub)', fontSize: 15, marginBottom: 4 }}>
            {viewMode === 'my' ? t('lists.noListsYet') : t('lists.noListsFound')}
          </p>
          {viewMode === 'my' && (
            <p style={{ color: 'var(--fm-text-muted)', fontSize: 13 }}>
              {t('lists.noListsHint')}
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lists.map(list => (
            <button
              key={list.id}
              onClick={() => setSelectedList(list.id)}
              className="card-hover"
              style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                background: 'var(--fm-bg-card)', borderRadius: 10, padding: 0,
                border: '1px solid var(--fm-border)', overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Poster Strip */}
              <div style={{
                height: 100, display: 'flex', overflow: 'hidden',
                background: 'var(--fm-bg-secondary)', position: 'relative',
              }}>
                {list.posters && list.posters.length > 0 ? (
                  list.posters.map((poster, idx) => (
                    <div key={idx} style={{
                      flex: 1, minWidth: 0, position: 'relative',
                      borderRight: idx < list.posters!.length - 1 ? '1px solid var(--fm-bg-card)' : 'none',
                    }}>
                      <img
                        src={`${TMDB_IMG}/w342${poster}`}
                        alt=""
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                  ))
                ) : (
                  <div style={{
                    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--fm-text-muted)', fontSize: 13,
                  }}>
                    {t('lists.noFilmsAdded')}
                  </div>
                )}
                {/* Gradient overlay */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
                  background: 'linear-gradient(to top, var(--fm-bg-card), transparent)',
                }} />
              </div>

              {/* Info */}
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                      fontSize: 15, fontWeight: 700, color: 'var(--fm-text)', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {list.title}
                    </h3>
                    {list.description && (
                      <p style={{
                        fontSize: 12, color: 'var(--fm-text-sub)', margin: '4px 0 0',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {list.description}
                      </p>
                    )}
                  </div>
                  {!list.is_public && (
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 4,
                      background: 'var(--fm-bg-secondary)', color: 'var(--fm-text-muted)',
                      flexShrink: 0,
                    }}>
                      {t('lists.private')}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 12, color: 'var(--fm-text-muted)' }}>
                  {viewMode !== 'my' && list.user_name && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {list.user_avatar ? (
                        <img src={list.user_avatar} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--fm-bg-secondary)', display: 'inline-block' }} />
                      )}
                      {list.user_name}
                    </span>
                  )}
                  <span>{t('lists.filmsCount', { count: String(list.items_count) })}</span>
                  {list.likes_count > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                      {list.likes_count}
                    </span>
                  )}
                  {list.is_ranked && (
                    <span style={{ color: 'var(--fm-accent)', fontWeight: 500 }}>{t('lists.ranked')}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
