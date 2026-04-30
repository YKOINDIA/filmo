'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'
import { trackListLiked, trackListForked, trackListShared, trackFollow } from '../lib/analytics'

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
  is_collaborative: boolean
  forked_from_list_id: string | null
  items_count: number
  likes_count: number
  user_id: string
  slug: string | null
  created_at: string
  updated_at: string
  // joined
  owner_name?: string
  owner_avatar?: string | null
  forked_from_title?: string
  forked_from_slug?: string | null
}

interface ListItemData {
  id: string
  movie_id: number
  position: number
  note: string | null
  added_by_user_id: string | null
  movie_title?: string
  movie_poster?: string | null
  movie_release_date?: string | null
  added_by_name?: string
  added_by_avatar?: string | null
}

interface LikerRow {
  user_id: string
  user_name: string
  user_avatar: string | null
}

interface CommentRow {
  id: string
  user_id: string
  body: string
  created_at: string
  user_name: string
  user_avatar: string | null
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

  // Edit collaborative toggle
  const [editCollaborative, setEditCollaborative] = useState(false)

  // 二重実行防止用 (各操作の in-flight 状態)
  const [liking, setLiking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [removingItemIds, setRemovingItemIds] = useState<Set<string>>(new Set())
  const [deletingCommentIds, setDeletingCommentIds] = useState<Set<string>>(new Set())
  const [togglingFollowIds, setTogglingFollowIds] = useState<Set<string>>(new Set())

  // Likers
  const [likers, setLikers] = useState<LikerRow[]>([])
  const [showAllLikers, setShowAllLikers] = useState(false)
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set())

  // Comments
  const [comments, setComments] = useState<CommentRow[]>([])
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  // Fork
  const [forking, setForking] = useState(false)

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
        // owner プロフィール取得
        const { data: ownerData } = await supabase
          .from('users').select('name, avatar_url').eq('id', ld.user_id).maybeSingle()

        // forked-from のタイトル取得 (あれば)
        let forkedFromTitle: string | undefined
        let forkedFromSlug: string | null | undefined
        if (ld.forked_from_list_id) {
          const { data: forkSrc } = await supabase
            .from('user_lists').select('title, slug').eq('id', ld.forked_from_list_id).maybeSingle()
          if (forkSrc) {
            forkedFromTitle = (forkSrc as { title: string }).title
            forkedFromSlug = (forkSrc as { slug: string | null }).slug
          }
        }

        const enriched: ListData = {
          ...ld,
          owner_name: (ownerData as { name?: string } | null)?.name,
          owner_avatar: (ownerData as { avatar_url?: string | null } | null)?.avatar_url ?? null,
          forked_from_title: forkedFromTitle,
          forked_from_slug: forkedFromSlug,
        }
        setList(enriched)
        setIsOwner(ld.user_id === userId)
        setLikeCount(ld.likes_count)
        setEditTitle(ld.title)
        setEditDesc(ld.description)
        setEditPublic(ld.is_public)
        setEditCollaborative(ld.is_collaborative ?? false)
      }

      // Fetch items
      const { data: itemsData } = await supabase
        .from('list_items')
        .select('id, movie_id, position, note, added_by_user_id')
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

        // added_by_user_id でユーザー名/アバター取得
        const contributorIds = [...new Set(listItems.map(i => i.added_by_user_id).filter((x): x is string => !!x))]
        const contributorMap = new Map<string, { name: string; avatar_url: string | null }>()
        if (contributorIds.length > 0) {
          const { data: contribs } = await supabase
            .from('users').select('id, name, avatar_url').in('id', contributorIds)
          for (const u of (contribs || []) as { id: string; name: string; avatar_url: string | null }[]) {
            contributorMap.set(u.id, { name: u.name, avatar_url: u.avatar_url })
          }
        }

        listItems = listItems.map(item => ({
          ...item,
          movie_title: movieMap.get(item.movie_id)?.title,
          movie_poster: movieMap.get(item.movie_id)?.poster_path,
          movie_release_date: movieMap.get(item.movie_id)?.release_date,
          added_by_name: item.added_by_user_id ? contributorMap.get(item.added_by_user_id)?.name : undefined,
          added_by_avatar: item.added_by_user_id ? contributorMap.get(item.added_by_user_id)?.avatar_url ?? null : null,
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

  // Likers + Comments + Following を並列で取得
  const fetchSocial = useCallback(async () => {
    try {
      const [likersRes, commentsRes, myFollowsRes] = await Promise.all([
        supabase.from('list_likes')
          .select('user_id, created_at')
          .eq('list_id', listId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('list_comments')
          .select('id, user_id, body, created_at')
          .eq('list_id', listId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('follows')
          .select('following_id')
          .eq('follower_id', userId),
      ])

      const likeRows = (likersRes.data || []) as { user_id: string }[]
      const commentRows = (commentsRes.data || []) as { id: string; user_id: string; body: string; created_at: string }[]
      const followRows = (myFollowsRes.data || []) as { following_id: string }[]

      setFollowingSet(new Set(followRows.map(f => f.following_id)))

      const userIds = [...new Set([
        ...likeRows.map(l => l.user_id),
        ...commentRows.map(c => c.user_id),
      ])]

      const userMap = new Map<string, { name: string; avatar_url: string | null }>()
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users').select('id, name, avatar_url').in('id', userIds)
        for (const u of (usersData || []) as { id: string; name: string; avatar_url: string | null }[]) {
          userMap.set(u.id, { name: u.name, avatar_url: u.avatar_url })
        }
      }

      setLikers(likeRows.map(l => ({
        user_id: l.user_id,
        user_name: userMap.get(l.user_id)?.name || 'Unknown',
        user_avatar: userMap.get(l.user_id)?.avatar_url ?? null,
      })))

      setComments(commentRows.map(c => ({
        id: c.id,
        user_id: c.user_id,
        body: c.body,
        created_at: c.created_at,
        user_name: userMap.get(c.user_id)?.name || 'Unknown',
        user_avatar: userMap.get(c.user_id)?.avatar_url ?? null,
      })))
    } catch (err) {
      console.error('Failed to fetch social data:', err)
    }
  }, [listId, userId])

  useEffect(() => {
    fetchList()
    fetchSocial()
  }, [fetchList, fetchSocial])

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
    if (adding === movie.id) return
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
        added_by_user_id: userId,
      })
      if (error) {
        if (error.code === '23505') {
          // Duplicate — already in list
          showToast('既にリストに追加済みです')
        } else {
          throw error
        }
      } else {
        setItems(prev => [...prev, {
          id: crypto.randomUUID(),
          movie_id: movie.id,
          position: newPosition,
          note: null,
          added_by_user_id: userId,
          movie_title: title,
          movie_poster: movie.poster_path,
          movie_release_date: movie.release_date || movie.first_air_date || null,
        }])
        showToast(`「${title}」を追加しました`)
      }
    } catch (err) {
      console.error('Failed to add film:', err)
      showToast('追加に失敗しました')
    }
    setAdding(null)
  }

  const handleRemoveItem = async (itemId: string, movieTitle?: string) => {
    if (removingItemIds.has(itemId)) return
    setRemovingItemIds(prev => new Set(prev).add(itemId))
    try {
      const { error } = await supabase.from('list_items').delete().eq('id', itemId)
      if (error) throw error
      setItems(prev => prev.filter(i => i.id !== itemId))
      showToast(`「${movieTitle || '作品'}」を削除しました`)
    } catch (err) {
      console.error('Failed to remove item:', err)
      showToast('削除に失敗しました')
    } finally {
      setRemovingItemIds(prev => {
        const next = new Set(prev); next.delete(itemId); return next
      })
    }
  }

  const handleLike = async () => {
    if (liking) return
    setLiking(true)
    // 楽観的UI更新 (体感速度を上げる)
    const wasLiked = liked
    setLiked(!wasLiked)
    setLikeCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1)
    try {
      if (wasLiked) {
        const { error } = await supabase.from('list_likes').delete().eq('user_id', userId).eq('list_id', listId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('list_likes').insert({ user_id: userId, list_id: listId })
        if (error) throw error
        // GA4: いいね (バイラル指標)
        trackListLiked(listId)
      }
    } catch (err) {
      // ロールバック
      console.error('Failed to toggle like:', err)
      setLiked(wasLiked)
      setLikeCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1))
      showToast('いいねの更新に失敗しました')
    } finally {
      setLiking(false)
    }
  }

  const handleSave = async () => {
    if (saving) return
    if (!editTitle.trim()) {
      showToast('タイトルを入力してください')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('user_lists').update({
        title: editTitle.trim(),
        description: editDesc.trim(),
        is_public: editPublic,
        is_collaborative: editCollaborative,
      }).eq('id', listId)
      if (error) throw error

      setList(prev => prev ? { ...prev, title: editTitle.trim(), description: editDesc.trim(), is_public: editPublic, is_collaborative: editCollaborative } : prev)
      setEditing(false)
      showToast('リストを更新しました')
    } catch (err) {
      console.error('Failed to save:', err)
      showToast('保存に失敗しました')
    }
    setSaving(false)
  }

  // === Social actions ===
  const handleFollow = async (targetUserId: string) => {
    if (targetUserId === userId) return
    if (togglingFollowIds.has(targetUserId)) return
    setTogglingFollowIds(prev => new Set(prev).add(targetUserId))
    const wasFollowing = followingSet.has(targetUserId)
    // 楽観的更新
    setFollowingSet(prev => {
      const next = new Set(prev)
      if (wasFollowing) next.delete(targetUserId); else next.add(targetUserId)
      return next
    })
    try {
      if (wasFollowing) {
        const { error } = await supabase.from('follows').delete()
          .eq('follower_id', userId).eq('following_id', targetUserId)
        if (error) throw error
        trackFollow(targetUserId, 'unfollow')
        showToast('フォローを解除しました')
      } else {
        const { error } = await supabase.from('follows').insert({ follower_id: userId, following_id: targetUserId })
        if (error) throw error
        trackFollow(targetUserId, 'follow')
        showToast('フォローしました')
      }
    } catch (err) {
      // ロールバック
      console.error('Follow toggle failed:', err)
      setFollowingSet(prev => {
        const next = new Set(prev)
        if (wasFollowing) next.add(targetUserId); else next.delete(targetUserId)
        return next
      })
      showToast('フォロー操作に失敗しました')
    } finally {
      setTogglingFollowIds(prev => {
        const next = new Set(prev); next.delete(targetUserId); return next
      })
    }
  }

  const handleAddComment = async () => {
    if (postingComment) return
    const body = newComment.trim()
    if (!body) {
      showToast('コメントを入力してください')
      return
    }
    setPostingComment(true)
    try {
      const { data, error } = await supabase
        .from('list_comments')
        .insert({ list_id: listId, user_id: userId, body })
        .select('id, user_id, body, created_at')
        .single()
      if (error) throw error

      // 自分のユーザー情報も取得して即座に表示
      const { data: me } = await supabase.from('users').select('name, avatar_url').eq('id', userId).maybeSingle()
      const meRow = me as { name?: string; avatar_url?: string | null } | null
      const newRow: CommentRow = {
        id: data!.id,
        user_id: userId,
        body,
        created_at: data!.created_at,
        user_name: meRow?.name || 'You',
        user_avatar: meRow?.avatar_url ?? null,
      }
      setComments(prev => [newRow, ...prev])
      setNewComment('')
      showToast('コメントを投稿しました')
    } catch (err) {
      console.error('Failed to post comment:', err)
      showToast('コメントの投稿に失敗しました')
    }
    setPostingComment(false)
  }

  const handleDeleteComment = async (commentId: string) => {
    if (deletingCommentIds.has(commentId)) return
    if (!confirm('このコメントを削除しますか?')) return
    setDeletingCommentIds(prev => new Set(prev).add(commentId))
    try {
      const { error } = await supabase.from('list_comments').delete().eq('id', commentId)
      if (error) throw error
      setComments(prev => prev.filter(c => c.id !== commentId))
      showToast('コメントを削除しました')
    } catch (err) {
      console.error('Failed to delete comment:', err)
      showToast('削除に失敗しました')
    } finally {
      setDeletingCommentIds(prev => {
        const next = new Set(prev); next.delete(commentId); return next
      })
    }
  }

  // === Fork: 元リストの items を自分のリストとしてコピー ===
  const handleFork = async () => {
    if (!list || forking) return
    setForking(true)
    try {
      // 1) 新しい list を作成
      const { data: newList, error: listErr } = await supabase
        .from('user_lists')
        .insert({
          user_id: userId,
          title: `${list.title} (コピー)`,
          description: list.description,
          is_public: false, // 初期は非公開
          is_ranked: list.is_ranked,
          is_collaborative: false,
          forked_from_list_id: list.id,
        })
        .select('id')
        .single()
      if (listErr) throw listErr

      // 2) items を全コピー (added_by_user_id = 自分)
      if (items.length > 0) {
        const rows = items.map((it, idx) => ({
          list_id: newList!.id,
          movie_id: it.movie_id,
          position: idx,
          note: it.note,
          added_by_user_id: userId,
        }))
        const { error: itemErr } = await supabase.from('list_items').insert(rows)
        if (itemErr) throw itemErr
      }

      // GA4: Fork (バイラル指標)
      trackListForked(list.id, newList!.id)
      showToast(`「${list.title}」を自分のリストにコピーしました`)
      // 元リストに留まる(自分のリストへ遷移するなら onBack 経由でリスト一覧に戻る)
      onBack()
    } catch (err) {
      console.error('Fork failed:', err)
      showToast('コピーに失敗しました')
    }
    setForking(false)
  }

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('user_lists').delete().eq('id', listId)
      if (error) throw error
      showToast('リストを削除しました')
      onBack()
    } catch (err) {
      console.error('Failed to delete:', err)
      showToast('削除に失敗しました')
      setDeleting(false)
    }
  }

  const buildShareUrl = useCallback(() => {
    const slug = list?.slug
    return `${window.location.origin}/lists/${slug || listId}`
  }, [list?.slug, listId])

  const buildShareText = useCallback(() => {
    const title = list?.title || 'リスト'
    const count = list?.items_count ?? 0
    return `「${title}」(${count}本) / Filmo`
  }, [list?.title, list?.items_count])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(buildShareUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      trackListShared(listId, 'copy_link')
    } catch { /* ignore */ }
  }

  const handleShareTwitter = () => {
    const url = encodeURIComponent(buildShareUrl())
    const text = encodeURIComponent(buildShareText())
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer')
    trackListShared(listId, 'twitter')
  }

  const handleShareLine = () => {
    const url = encodeURIComponent(buildShareUrl())
    const text = encodeURIComponent(buildShareText())
    window.open(`https://social-plugins.line.me/lineit/share?url=${url}&text=${text}`, '_blank', 'noopener,noreferrer')
    trackListShared(listId, 'line')
  }

  const handleSystemShare = async () => {
    if (!navigator.share) return
    try {
      await navigator.share({ title: list?.title, text: buildShareText(), url: buildShareUrl() })
      trackListShared(listId, 'system')
    } catch { /* user canceled */ }
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 6px', lineHeight: 1.3 }}>
                {list.title}
              </h1>

              {/* Owner display + forked-from */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                {!isOwner && (
                  <a href={`/u/${list.user_id}`} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12, color: 'var(--fm-text-sub)', textDecoration: 'none',
                  }}>
                    {list.owner_avatar ? (
                      <img src={list.owner_avatar} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--fm-bg-secondary)' }} />
                    )}
                    <span>by <strong style={{ color: 'var(--fm-text)' }}>{list.owner_name || 'Unknown'}</strong></span>
                  </a>
                )}
                {list.is_collaborative && (
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: 'rgba(46,204,138,0.15)', color: '#2ecc8a', fontWeight: 600,
                  }}>
                    👥 みんなで作るリスト
                  </span>
                )}
                {list.forked_from_list_id && list.forked_from_title && (
                  <span style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                    ↪ <a href={`/lists/${list.forked_from_slug || list.forked_from_list_id}`} style={{ color: 'var(--fm-text-muted)' }}>
                      「{list.forked_from_title}」からコピー
                    </a>
                  </span>
                )}
              </div>

              {list.description && (
                <p style={{ fontSize: 14, color: 'var(--fm-text-sub)', margin: 0, lineHeight: 1.5 }}>
                  {list.description}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {/* Like */}
            <button onClick={handleLike} disabled={liking} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px',
              borderRadius: 6, border: '1px solid var(--fm-border)',
              background: liked ? 'rgba(239,68,68,0.1)' : 'transparent',
              color: liked ? '#ef4444' : 'var(--fm-text-sub)',
              fontSize: 13, cursor: liking ? 'wait' : 'pointer', fontWeight: 500,
              transition: 'all 0.15s', opacity: liking ? 0.6 : 1,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              {likeCount}
            </button>

            {/* Share */}
            {list.is_public && (
              <button onClick={() => setShowShare(true)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                borderRadius: 6, border: '1px solid var(--fm-border)',
                background: 'transparent', color: 'var(--fm-text-sub)',
                fontSize: 13, cursor: 'pointer', fontWeight: 500,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                シェア
              </button>
            )}

            {/* Fork (non-owner only) */}
            {!isOwner && (
              <button onClick={handleFork} disabled={forking} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                borderRadius: 6, border: '1px solid var(--fm-accent)',
                background: 'rgba(108,92,231,0.12)', color: 'var(--fm-accent)',
                fontSize: 13, cursor: forking ? 'not-allowed' : 'pointer', fontWeight: 600,
                opacity: forking ? 0.6 : 1,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                {forking ? 'コピー中…' : 'コピーして自分のリストにする'}
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

          {/* Likers row */}
          {likers.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--fm-border)' }}>
              <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 8, fontWeight: 500 }}>
                ❤ {likeCount} 人がいいねしました
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                {(showAllLikers ? likers : likers.slice(0, 10)).map(liker => {
                  const isMe = liker.user_id === userId
                  const isFollowing = followingSet.has(liker.user_id)
                  return (
                    <div key={liker.user_id} style={{
                      flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      width: 80,
                    }}>
                      <a href={`/u/${liker.user_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        {liker.user_avatar ? (
                          <img src={liker.user_avatar} alt={liker.user_name}
                            style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{
                            width: 48, height: 48, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 18, fontWeight: 700,
                          }}>
                            {liker.user_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{
                          fontSize: 11, color: 'var(--fm-text)', textAlign: 'center', marginTop: 4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 70,
                        }}>
                          {liker.user_name}
                        </div>
                      </a>
                      {!isMe && (() => {
                        const busy = togglingFollowIds.has(liker.user_id)
                        return (
                          <button onClick={() => handleFollow(liker.user_id)} disabled={busy} style={{
                            padding: '3px 10px', borderRadius: 12,
                            border: `1px solid ${isFollowing ? 'var(--fm-border)' : 'var(--fm-accent)'}`,
                            background: isFollowing ? 'transparent' : 'var(--fm-accent)',
                            color: isFollowing ? 'var(--fm-text-sub)' : '#fff',
                            fontSize: 11, fontWeight: 600,
                            cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
                          }}>
                            {isFollowing ? '解除' : 'フォロー'}
                          </button>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
              {!showAllLikers && likers.length > 10 && (
                <button onClick={() => setShowAllLikers(true)} style={{
                  marginTop: 8, fontSize: 12, color: 'var(--fm-accent)',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}>
                  すべて表示 ({likers.length}人) ›
                </button>
              )}
            </div>
          )}
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 10 }}>
            <input type="checkbox" checked={editPublic} onChange={e => setEditPublic(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--fm-accent)' }} />
            公開する
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 16 }}>
            <input type="checkbox" checked={editCollaborative} onChange={e => setEditCollaborative(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--fm-accent)' }} />
            <span>
              他のユーザーが作品を追加できる
              <span style={{ fontSize: 11, color: 'var(--fm-text-muted)', display: 'block', marginTop: 2 }}>
                公開リストの場合のみ有効。みんなで作るリストにする時にON。
              </span>
            </span>
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
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: deleting ? 'wait' : 'pointer', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? '削除中…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add film button (owner OR collaborative public list) */}
      {(isOwner || (list.is_collaborative && list.is_public)) && (
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
              {(isOwner || item.added_by_user_id === userId) && (
                <button onClick={() => handleRemoveItem(item.id, item.movie_title)}
                  disabled={removingItemIds.has(item.id)}
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
                {/* Contributor name (non-owner contributors on collaborative lists) */}
                {list.is_collaborative && item.added_by_user_id && item.added_by_user_id !== list.user_id && (
                  <div style={{ fontSize: 10, color: 'var(--fm-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    +{item.added_by_name || 'someone'}
                  </div>
                )}
              </button>
              {(isOwner || item.added_by_user_id === userId) && (
                <button onClick={() => handleRemoveItem(item.id, item.movie_title)}
                  disabled={removingItemIds.has(item.id)}
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

      {/* Comments section */}
      <section style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--fm-border)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 16px' }}>
          💬 コメント ({comments.length})
        </h2>

        {/* Comment input */}
        <div style={{ marginBottom: 20 }}>
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="このリストにコメント…"
            rows={2}
            maxLength={500}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
              color: 'var(--fm-text)', fontSize: 14, resize: 'vertical',
              boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>{newComment.length} / 500</span>
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || postingComment}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: newComment.trim() ? 'var(--fm-accent)' : 'var(--fm-border)',
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: newComment.trim() && !postingComment ? 'pointer' : 'not-allowed',
                opacity: postingComment ? 0.6 : 1,
              }}
            >
              {postingComment ? '投稿中…' : 'コメント'}
            </button>
          </div>
        </div>

        {/* Comments list */}
        {comments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--fm-text-muted)', fontSize: 13 }}>
            まだコメントがありません。最初のコメントを投稿しよう。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <a href={`/u/${c.user_id}`} style={{ flexShrink: 0, textDecoration: 'none' }}>
                  {c.user_avatar ? (
                    <img src={c.user_avatar} alt={c.user_name}
                      style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 14, fontWeight: 700,
                    }}>
                      {c.user_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </a>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <a href={`/u/${c.user_id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--fm-text)', textDecoration: 'none' }}>
                      {c.user_name}
                    </a>
                    <span style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                      {new Date(c.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </span>
                    {c.user_id === userId && (() => {
                      const busy = deletingCommentIds.has(c.id)
                      return (
                        <button onClick={() => handleDeleteComment(c.id)} disabled={busy} style={{
                          marginLeft: 'auto', background: 'none', border: 'none',
                          color: 'var(--fm-text-muted)', fontSize: 11,
                          cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1,
                        }}>
                          {busy ? '削除中…' : '削除'}
                        </button>
                      )
                    })()}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--fm-text)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {c.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Share modal */}
      {showShare && list && (
        <div
          onClick={() => setShowShare(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 100, padding: 0,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              background: 'var(--fm-bg)', borderTopLeftRadius: 16, borderTopRightRadius: 16,
              padding: '20px 16px 32px',
              animation: 'slideUp 0.2s ease-out',
            }}
          >
            <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div style={{
              width: 40, height: 4, background: 'var(--fm-border)',
              borderRadius: 2, margin: '0 auto 16px',
            }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)', marginBottom: 16, textAlign: 'center' }}>
              リストをシェア
            </div>
            <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
              「{list.title}」を友達に教えよう
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {/* X (Twitter) */}
              <button
                onClick={handleShareTwitter}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '12px 8px', background: 'transparent',
                  border: '1px solid var(--fm-border)', borderRadius: 10,
                  cursor: 'pointer', color: 'var(--fm-text)',
                }}
              >
                <span style={{ fontSize: 24, fontWeight: 900, lineHeight: 1 }}>𝕏</span>
                <span style={{ fontSize: 11 }}>Xで投稿</span>
              </button>

              {/* LINE */}
              <button
                onClick={handleShareLine}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '12px 8px', background: 'transparent',
                  border: '1px solid var(--fm-border)', borderRadius: 10,
                  cursor: 'pointer', color: 'var(--fm-text)',
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1, color: '#06C755', fontWeight: 700 }}>LINE</span>
                <span style={{ fontSize: 11 }}>LINEで送る</span>
              </button>

              {/* Copy link */}
              <button
                onClick={handleCopyLink}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '12px 8px', background: 'transparent',
                  border: '1px solid var(--fm-border)', borderRadius: 10,
                  cursor: 'pointer', color: 'var(--fm-text)',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <span style={{ fontSize: 11 }}>{copied ? 'コピー済' : 'リンクコピー'}</span>
              </button>

              {/* System share (mobile only) */}
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
                <button
                  onClick={handleSystemShare}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '12px 8px', background: 'transparent',
                    border: '1px solid var(--fm-border)', borderRadius: 10,
                    cursor: 'pointer', color: 'var(--fm-text)',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                  <span style={{ fontSize: 11 }}>その他</span>
                </button>
              ) : (
                <div /> /* spacer */
              )}
            </div>

            {/* URL preview */}
            <div style={{
              padding: '10px 12px', background: 'var(--fm-bg-secondary)',
              borderRadius: 8, fontSize: 12, color: 'var(--fm-text-sub)',
              wordBreak: 'break-all', marginBottom: 16, fontFamily: 'monospace',
            }}>
              {buildShareUrl()}
            </div>

            <button
              onClick={() => setShowShare(false)}
              style={{
                width: '100%', padding: '12px', background: 'transparent',
                border: '1px solid var(--fm-border)', borderRadius: 10,
                color: 'var(--fm-text-sub)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
