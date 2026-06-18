'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { shareToTwitter, shareToLine, shareNative } from '../lib/share'
import { loadHensachi, type HensachiRank } from '../lib/eiga-hensachi'
import type { DiagnosisType } from '../lib/diagnosis/types'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w342'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'

interface MovieCard {
  id: number
  title: string
  poster_path: string | null
}

export default function DiagnosisResult({
  type,
  variant = 'inline',
  onRetry,
}: {
  type: DiagnosisType
  /** 'inline' = 診断直後 (アプリ内), 'page' = 共有用結果ページ */
  variant?: 'inline' | 'page'
  onRetry?: () => void
}) {
  const [movies, setMovies] = useState<MovieCard[]>([])
  const [hensachi, setHensachi] = useState<{ value: number; rank: HensachiRank } | null>(null)

  // おすすめ映画のポスターを TMDB から取得
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const results = await Promise.all(
        type.recommendations.map(async (rec) => {
          try {
            const res = await fetch(`/api/tmdb?action=detail&id=${rec.id}&type=movie`)
            if (!res.ok) throw new Error('fetch failed')
            const data = await res.json()
            return {
              id: rec.id,
              title: data.title || data.name || rec.title,
              poster_path: data.poster_path ?? null,
            } as MovieCard
          } catch {
            return { id: rec.id, title: rec.title, poster_path: null } as MovieCard
          }
        }),
      )
      if (!cancelled) setMovies(results)
    })()
    return () => { cancelled = true }
  }, [type])

  // ログイン中なら映画偏差値を表示
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled || !session?.user) return
        const { value, rank } = await loadHensachi(session.user.id)
        if (!cancelled) setHensachi({ value, rank })
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [])

  const shareUrl = `${APP_URL}/diagnosis/result/${type.id}`
  const shareText = `私の映画タイプは「${type.name}」${type.emoji}\n${type.tagline}\nあなたは何タイプ？ #Filmo映画診断`

  const onNativeShare = async () => {
    const ok = await shareNative({ title: 'Filmo 映画好き診断', text: shareText, url: shareUrl })
    if (!ok) shareToTwitter(shareText, shareUrl)
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '8px 16px 40px' }}>
      {/* ヒーロー: タイプ名 */}
      <div style={{
        background: `linear-gradient(160deg, ${type.color}, ${type.color}dd)`,
        border: `1px solid ${type.accent}55`,
        borderRadius: 20,
        padding: '28px 22px',
        textAlign: 'center',
        boxShadow: `0 12px 40px ${type.color}66`,
      }}>
        <div style={{ fontSize: 12, letterSpacing: 2, fontWeight: 700, color: type.accent, textTransform: 'uppercase', marginBottom: 10 }}>
          あなたの映画タイプは
        </div>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 12 }}>{type.emoji}</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: '0 0 8px', lineHeight: 1.35 }}>
          「{type.name}」
        </h1>
        <div style={{ fontSize: 14, color: type.accent, fontWeight: 600 }}>{type.tagline}</div>
      </div>

      {/* 説明 */}
      <p style={{ fontSize: 14, lineHeight: 1.9, color: '#d4d4dd', margin: '20px 4px 0' }}>
        {type.description}
      </p>

      {/* 映画偏差値 (ログイン時) */}
      {hensachi && (
        <div style={{
          marginTop: 20,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${hensachi.rank.color}55`,
          borderRadius: 16,
          padding: '16px 18px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#aaa', fontWeight: 600 }}>映画偏差値</div>
            <div style={{ fontSize: 34, fontWeight: 900, color: hensachi.rank.color, lineHeight: 1.1 }}>
              {hensachi.value}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: hensachi.rank.color }}>{hensachi.rank.label}</div>
            <div style={{ fontSize: 12, color: '#bbb', marginTop: 3, lineHeight: 1.6 }}>
              見た映画を記録するほど偏差値はアップ。鑑賞ログを増やして上を目指そう！
            </div>
          </div>
        </div>
      )}

      {/* おすすめ映画 */}
      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 14px' }}>
          🎬 あなたへのおすすめ映画
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {(movies.length ? movies : type.recommendations.map(r => ({ id: r.id, title: r.title, poster_path: null }))).map(m => (
            <Link
              key={m.id}
              href={`/movies/${m.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{
                aspectRatio: '2 / 3',
                borderRadius: 10,
                overflow: 'hidden',
                background: '#1a1b26',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {m.poster_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${TMDB_IMG}${m.poster_path}`} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 26 }}>🎞️</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#cfc6e0', marginTop: 6, lineHeight: 1.35, textAlign: 'center' }}>
                {m.title}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* シェア */}
      <div style={{ marginTop: 30 }}>
        <div style={{ fontSize: 13, color: '#aaa', textAlign: 'center', marginBottom: 12 }}>
          結果をシェアして、友達の映画タイプも診断してみよう！
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => shareToTwitter(shareText, shareUrl)}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: '#000', color: '#fff', fontWeight: 800, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            𝕏 でシェア
          </button>
          <button
            onClick={() => shareToLine(shareText, shareUrl)}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: '#06c755', color: '#fff', fontWeight: 800, fontSize: 15,
            }}
          >
            LINE
          </button>
          <button
            onClick={onNativeShare}
            aria-label="その他の方法でシェア"
            style={{
              width: 52, padding: '13px 0', borderRadius: 12, cursor: 'pointer',
              background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 700, fontSize: 18,
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            ⤴
          </button>
        </div>
      </div>

      {/* CTA */}
      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {variant === 'inline' && onRetry ? (
          <button
            onClick={onRetry}
            style={{
              padding: '14px 0', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 14,
              background: 'transparent', color: '#cfc6e0', border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            🔄 もう一度診断する
          </button>
        ) : (
          <Link
            href="/diagnosis"
            style={{
              padding: '14px 0', borderRadius: 12, textAlign: 'center', textDecoration: 'none',
              fontWeight: 800, fontSize: 15,
              background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff',
            }}
          >
            🎬 自分の映画タイプを診断する
          </Link>
        )}
        <Link
          href="/"
          style={{ fontSize: 12, color: '#888', textAlign: 'center', textDecoration: 'none' }}
        >
          Filmo トップへ
        </Link>
      </div>
    </div>
  )
}
