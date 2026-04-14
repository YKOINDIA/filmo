'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

interface ListDetailProps {
  listId: string
  userId: string
  onBack: () => void
  onOpenWork: (id: number, type?: 'movie' | 'tv') => void
}

interface ListData {
  id: string
  title: string
  description: string
  is_public: boolean
  is_ranked: boolean
  items_count: number
  likes_count: number
  user_id: string
  slug: string | null
  created_at: string
  updated_at: string
}

interface ListItemData {
  id: string
  movie_id: number
  position: number
  note: string | null
  movie_title?: string
  movie_poster?: string | null
  movie_release_date?: string | null
}

interface TMDBResult {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  media_type?: string
  release_date?: string
  first_air_date?: string
}

export default function ListDetail({ listId, userId, onBack, onOpenWork }: ListDetailProps) {
  const [list, setList] = useState<ListData | null>(null)
  const [items, setItems] = useState<ListItemData[]>([])
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)

  // Add film
  const [showAdd, setShowAdd] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<number | null>(null)

  // Edit
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPublic, setEditPublic] = useState(true)
  const [saving, setSaving] = useState(false)

  // Share
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const { data: listData } = await supabase
        .from('user_lists')
        .select('*')
        .eq('id', listId)
        .single()

      if (listData) {
        const ld = listData as unknown as ListData
        setList(ld)
        setIsOwner(ld.user_id === userId)
        setLikeCount(ld.likes_count)
        setEditTitle(ld.title)
        setEditDesc(ld.description)
        setEditPublic(ld.is_public)
      }

      // Fetch items
      const { data: itemsData } = await supabase
        .from('list_items')
        .select('id, movie_id, position, note')
        .eq('list_id', listId)
        .order('position', { ascending: true })

      let listItems = (itemsData || []) as unknown as ListItemData[]

      // Fetch movie metadata
      if (listItems.length > 0) {
        const movieIds = [...new Set(listItems.map(i => i.movie_id))]
        const { data: movieData } = await supabase
          .from('movies')
          .select('tmdb_id, title, poster_path, release_date')
          .in('tmdb_id', movieIds)

        const movieMap = new Map<number, { title: string; poster_path: string | null; release_date: string | null }>()
        if (movieData) {
          for (const m of movieData as unknown as { tmdb_id: number; title: string; poster_path: string | null; release_date: string | null }[]) {
            movieMap.set(m.tmdb_id, m)
          }
        }
        listItems = listItems.map(item => ({
          ...item,
          movie_title: movieMap.get(item.movie_id)?.title,
          movie_poster: movieMap.get(item.movie_id)?.poster_path,
          movie_release_date: movieMap.get(item.movie_id)?.release_date,
        }))
      }

      setItems(listItems)

      // Check if liked
      const { data: likeData } = await supabase
        .from('list_likes')
        .select('id')
        .eq('user_id', userId)
        .eq('list_id', listId)
        .maybeSingle()
      setLiked(!!likeData)
    } catch (err) {
      console.error('Failed to fetch list:', err)
    }
    setLoading(false)
  }, [listId, userId])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/tmdb?action=search&query=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setSearchResults(data.results?.slice(0, 12) || [])
    } catch {
      setSearchResults([])
    }
    setSearching(false)
  }

  const handleAddFilm = async (movie: TMDBResult) => {
    setAdding(movie.id)
    try {
      // Ensure movie is in movies table (cache)
      const title = movie.title || movie.name || ''
      const { error: upsertErr } = await supabase.from('movies').upsert({
        id: movie.id,
        tmdb_id: movie.id,
        title,
        poster_path: movie.poster_path,
        release_date: movie.release_date || movie.first_air_date || null,
        media_type: movie.media_type === 'tv' ? 'tv' : 'movie',
      }, { onConflict: 'tmdb_id' })
      if (upsertErr) console.warn('Movie upsert warning:', upsertErr)

      const newPosition = items.length
      const { error } = await supabase.from('list_items').insert({
        list_id: listId,
        movie_id: movie.id,
        position: newPosition,
      })
      if (error) {
        if (error.code === '23505') {
          // Duplicate — already in list
          window.dispatchEvent(new CustomEvent('filmo-toast', { detail: 'Already in this list' }))
        } else {
          throw error
        }
      } else {
        setItems(prev => [...prev, {
          id: crypto.randomUUID(),
          movie_id: movie.id,
          position: newPosition,
          note: null,
          movie_title: title,
          movie_poster: movie.poster_path,
          movie_release_date: movie.release_date || movie.first_air_date || null,
        }])
        window.dispatchEvent(new CustomEvent('filmo-toast', { detail: `Added "${title}"` }))
      }
    } catch (err) {
      console.error('Failed to add film:', err)
    }
    setAdding(null)
  }

  const handleRemoveItem = async (itemId: string, movieTitle?: string) => {
    try {
      await supabase.from('list_items').delete().eq('id', itemId)
      setItems(prev => prev.filter(i => i.id !== itemId))
      window.dispatchEvent(new CustomEvent('filmo-toast', { detail: `Removed "${movieTitle || 'film'}"` }))
    } catch (err) {
      console.error('Failed to remove item:', err)
    }
  }

  const handleLike = async () => {
    try {
      if (liked) {
        await supabase.from('list_likes').delete().eq('user_id', userId).eq('list_id', listId)
        setLiked(false)
        setLikeCount(prev => Math.max(0, prev - 1))
      } else {
        await supabase.from('list_likes').insert({ user_id: userId, list_id: listId })
        setLiked(true)
        setLikeCount(prev => prev + 1)
      }
    } catch (err) {
      console.error('Failed to toggle like:', err)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await supabase.from('user_lists').update({
        title: editTitle.trim(),
        description: editDesc.trim(),
        is_public: editPublic,
      }).eq('id', listId)

      setList(prev => prev ? { ...prev, title: editTitle.trim(), description: editDesc.trim(), is_public: editPublic } : prev)
      setEditing(false)
    } catch (err) {
      console.error('Failed to save:', err)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    try {
      await supabase.from('user_lists').delete().eq('id', listId)
      onBack()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleShare = async () => {
    const slug = list?.slug
    const url = `${window.location.origin}/lists/${slug || listId}`
    try {
      if (navigator.share) {
        await navigator.share({ title: list?.title, url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch { /* ignore */ }
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ color: 'var(--fm-text-sub)', fontSize: 14 }}>Loading...</div>
      </div>
    )
  }

  if (!list) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p style={{ color: 'var(--fm-text-sub)' }}>List not found</p>
        <button onClick={onBack} style={{ color: 'var(--fm-accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, marginTop: 8 }}>
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 640, margin: '0 auto', padding: '16px' }}>
      {/* Back button */}
      <button onClick={onBack} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fm-text-sub)',
        fontSize: 13, padding: '4px 0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Lists
      </button>

      {/* List Header */}
      {!editing ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 6px', lineHeight: 1.3 }}>
                {list.title}
              </h1>
              {list.description && (
                <p style={{ fontSize: 14, color: 'var(--fm-text-sub)', margin: 0, lineHeight: 1.5 }}>
                  {list.description}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {/* Like */}
            <button onClick={handleLike} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px',
              borderRadius: 6, border: '1px solid var(--fm-border)',
              background: liked ? 'rgba(239,68,68,0.1)' : 'transparent',
              color: liked ? '#ef4444' : 'var(--fm-text-sub)',
              fontSize: 13, cursor: 'pointer', fontWeight: 500,
              transition: 'all 0.15s',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              {likeCount}
            </button>

            {/* Share */}
            {list.is_public && (
              <button onClick={handleShare} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                borderRadius: 6, border: '1px solid var(--fm-border)',
                background: 'transparent', color: 'var(--fm-text-sub)',
                fontSize: 13, cursor: 'pointer', fontWeight: 500,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                {copied ? 'Copied!' : 'Share'}
              </button>
            )}

            {/* Edit (owner only) */}
            {isOwner && (
              <>
                <button onClick={() => setEditing(true)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                  borderRadius: 6, border: '1px solid var(--fm-border)',
                  background: 'transparent', color: 'var(--fm-text-sub)',
                  fontSize: 13, cursor: 'pointer', fontWeight: 500,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
                <button onClick={() => setConfirmDelete(true)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                  borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)',
                  background: 'transparent', color: '#ef4444',
                  fontSize: 13, cursor: 'pointer', fontWeight: 500,
                }}>
                  Delete
                </button>
              </>
            )}

            <span style={{ fontSize: 12, color: 'var(--fm-text-muted)' }}>
              {items.length} films
              {list.is_ranked && ' · Ranked'}
              {!list.is_public && ' · Private'}
            </span>
          </div>
        </div>
      ) : (
        /* Edit mode */
        <div style={{
          background: 'var(--fm-bg-card)', borderRadius: 10, padding: 20,
          border: '1px solid var(--fm-border)', marginBottom: 20,
        }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 4, fontWeight: 500 }}>Title</label>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fm-border)',
                background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14, boxSizing: 'border-box',
              }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 4, fontWeight: 500 }}>Description</label>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fm-border)',
                background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14, resize: 'vertical',
                boxSizing: 'border-box', fontFamily: 'inherit',
              }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 16 }}>
            <input type="checkbox" checked={editPublic} onChange={e => setEditPublic(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--fm-accent)' }} />
            Public
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(false)}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--fm-border)', background: 'transparent', color: 'var(--fm-text-sub)', fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'var(--fm-accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--fm-overlay)', padding: 20,
        }}>
          <div className="animate-fade-in" style={{
            background: 'var(--fm-bg-elevated)', borderRadius: 12, padding: 24,
            border: '1px solid var(--fm-border)', maxWidth: 360, width: '100%', textAlign: 'center',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 8px' }}>Delete this list?</h3>
            <p style={{ fontSize: 13, color: 'var(--fm-text-sub)', margin: '0 0 20px' }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmDelete(false)}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--fm-border)', background: 'transparent', color: 'var(--fm-text-sub)', fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleDelete}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add film button (owner) */}
      {isOwner && (
        <button onClick={() => setShowAdd(true)} style={{
          width: '100%', padding: '12px', borderRadius: 8, border: '2px dashed var(--fm-border)',
          background: 'transparent', color: 'var(--fm-accent)', fontSize: 14,
          fontWeight: 600, cursor: 'pointer', marginBottom: 20,
          transition: 'border-color 0.15s',
        }}>
          + Add Film
        </button>
      )}

      {/* Add Film Modal */}
      {showAdd && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          background: 'var(--fm-overlay)', padding: '60px 20px 20px',
          overflowY: 'auto',
        }}
        onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}
        >
          <div className="animate-fade-in" style={{
            background: 'var(--fm-bg-elevated)', borderRadius: 12, padding: 24,
            border: '1px solid var(--fm-border)', width: '100%', maxWidth: 480,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fm-text)', margin: 0 }}>Add Film</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--fm-text-muted)', cursor: 'pointer', fontSize: 18, padding: 4 }}>
                ×
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search films..."
                autoFocus
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fm-border)',
                  background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14, boxSizing: 'border-box',
                }}
              />
              <button onClick={handleSearch} disabled={searching}
                style={{
                  padding: '0 18px', borderRadius: 8, border: 'none',
                  background: 'var(--fm-accent)', color: '#fff', fontSize: 13,
                  cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                  opacity: searching ? 0.6 : 1,
                }}>
                {searching ? '...' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {searchResults.map(movie => {
                  const title = movie.title || movie.name || ''
                  const year = (movie.release_date || movie.first_air_date || '').slice(0, 4)
                  const alreadyAdded = items.some(i => i.movie_id === movie.id)
                  return (
                    <div key={movie.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px',
                      borderBottom: '1px solid var(--fm-border)',
                    }}>
                      {movie.poster_path ? (
                        <img src={`${TMDB_IMG}/w92${movie.poster_path}`} alt="" style={{ width: 36, height: 54, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 36, height: 54, borderRadius: 4, background: 'var(--fm-bg-secondary)', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {title}
                        </div>
                        {year && <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>{year}</div>}
                      </div>
                      <button
                        onClick={() => !alreadyAdded && handleAddFilm(movie)}
                        disabled={alreadyAdded || adding === movie.id}
                        style={{
                          padding: '6px 14px', borderRadius: 6, border: 'none',
                          background: alreadyAdded ? 'var(--fm-bg-secondary)' : 'var(--fm-accent)',
                          color: alreadyAdded ? 'var(--fm-text-muted)' : '#fff',
                          fontSize: 12, fontWeight: 600, cursor: alreadyAdded ? 'default' : 'pointer',
                          opacity: adding === movie.id ? 0.6 : 1, flexShrink: 0,
                        }}>
                        {alreadyAdded ? 'Added' : adding === movie.id ? '...' : 'Add'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Films Grid (Letterboxd-style poster grid) */}
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--fm-text-muted)', fontSize: 14 }}>
          {isOwner ? 'Add films to get started.' : 'This list is empty.'}
        </div>
      ) : list.is_ranked ? (
        /* Ranked list — numbered rows */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((item, idx) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px',
              borderBottom: '1px solid var(--fm-border)',
            }}>
              <span style={{
                fontSize: 16, fontWeight: 700, color: 'var(--fm-text-muted)', width: 28, textAlign: 'center', flexShrink: 0,
              }}>
                {idx + 1}
              </span>
              <button onClick={() => onOpenWork(item.movie_id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, flex: 1, background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left', padding: 0, minWidth: 0,
              }}>
                {item.movie_poster ? (
                  <img src={`${TMDB_IMG}/w92${item.movie_poster}`} alt=""
                    style={{ width: 40, height: 60, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 60, borderRadius: 4, background: 'var(--fm-bg-secondary)', flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: 'var(--fm-text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.movie_title || `Movie #${item.movie_id}`}
                  </div>
                  {item.movie_release_date && (
                    <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 2 }}>
                      {item.movie_release_date.slice(0, 4)}
                    </div>
                  )}
                  {item.note && (
                    <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginTop: 3, lineHeight: 1.4 }}>
                      {item.note}
                    </div>
                  )}
                </div>
              </button>
              {isOwner && (
                <button onClick={() => handleRemoveItem(item.id, item.movie_title)}
                  style={{ background: 'none', border: 'none', color: 'var(--fm-text-muted)', cursor: 'pointer', fontSize: 16, padding: '4px 8px', flexShrink: 0 }}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Poster grid */
        <div className="poster-grid">
          {items.map(item => (
            <div key={item.id} style={{ position: 'relative' }}>
              <button onClick={() => onOpenWork(item.movie_id)}
                style={{ display: 'block', background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%' }}>
                <div className="poster-item">
                  {item.movie_poster ? (
                    <img
                      src={`${TMDB_IMG}/w300${item.movie_poster}`}
                      alt={item.movie_title || ''}
                      loading="lazy"
                    />
                  ) : (
                    <div style={{
                      width: '100%', aspectRatio: '2/3',
                      background: 'var(--fm-bg-secondary)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: 'var(--fm-text-muted)', fontSize: 11,
                    }}>
                      No Image
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--fm-text-sub)', marginTop: 4,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.movie_title}
                </div>
              </button>
              {isOwner && (
                <button onClick={() => handleRemoveItem(item.id, item.movie_title)}
                  style={{
                    position: 'absolute', top: 4, right: 4, width: 22, height: 22,
                    borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none',
                    color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    opacity: 0.6, transition: 'opacity 0.15s',
                  }}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
