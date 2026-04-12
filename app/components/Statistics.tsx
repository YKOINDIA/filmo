'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const GENRE_COLORS: Record<string, string> = {
  'アクション': '#e74c3c', 'コメディ': '#f39c12', 'ドラマ': '#3498db',
  'ホラー': '#8e44ad', 'SF': '#2ecc71', 'ロマンス': '#e91e63',
  'スリラー': '#e67e22', 'アニメ': '#00bcd4', 'ドキュメンタリー': '#607d8b',
  'ファンタジー': '#9b59b6', 'アドベンチャー': '#27ae60', 'ミステリー': '#795548',
  '犯罪': '#455a64', '歴史': '#8d6e63', '音楽': '#ff5722',
  '戦争': '#78909c', 'ファミリー': '#ffb74d', '西部劇': '#a1887f',
}

interface Stats {
  totalWatched: number
  totalReviews: number
  avgScore: number
  totalMinutes: number
  loginStreak: number
  genreDistribution: { name: string; count: number; color: string }[]
  monthlyWatches: { month: string; count: number }[]
  yearlyWatches: { year: string; count: number }[]
  watchMethods: { method: string; count: number }[]
  scoreDistribution: { range: string; count: number }[]
  topCountries: { country: string; count: number }[]
}

export default function Statistics({ userId, onOpenWork }: {
  userId: string
  onOpenWork: (id: number, type?: 'movie' | 'tv') => void
}) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      // 鑑賞リスト取得
      const { data: watchlist } = await supabase
        .from('watchlists')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'watched')
        .order('created_at', { ascending: false })
        .limit(500)

      // レビュー取得
      const { data: reviews } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('is_draft', false)
        .limit(500)

      // ユーザー情報
      const { data: user } = await supabase
        .from('users')
        .select('login_streak, total_watch_minutes')
        .eq('id', userId)
        .single()

      const items = watchlist || []
      const revs = reviews || []

      // 映画情報を取得してジャンルなどを分析
      const movieIds = [...new Set(items.map((w: Record<string, unknown>) => w.movie_id as number))]
      const movieData: Record<number, Record<string, unknown>> = {}
      for (const mid of movieIds.slice(0, 100)) {
        const { data: movie } = await supabase.from('movies').select('*').eq('id', String(mid)).single()
        if (movie) movieData[mid as number] = movie
      }

      // ジャンル分布
      const genreMap: Record<string, number> = {}
      for (const w of items) {
        const movie = movieData[w.movie_id as number]
        if (movie?.genres) {
          const genres = typeof movie.genres === 'string' ? JSON.parse(movie.genres as string) : movie.genres
          for (const g of genres as { name: string }[]) {
            genreMap[g.name] = (genreMap[g.name] || 0) + 1
          }
        }
      }
      const genreDistribution = Object.entries(genreMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count, color: GENRE_COLORS[name] || '#666' }))

      // 月別鑑賞数（過去12ヶ月）
      const monthlyMap: Record<string, number> = {}
      for (let i = 11; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthlyMap[key] = 0
      }
      for (const w of items) {
        const ca = w.created_at as string
        if (ca) {
          const key = ca.substring(0, 7)
          if (key in monthlyMap) monthlyMap[key]++
        }
      }
      const monthlyWatches = Object.entries(monthlyMap).map(([month, count]) => ({ month: month.substring(5) + '月', count }))

      // 年別
      const yearMap: Record<string, number> = {}
      for (const w of items) {
        const ca = w.created_at as string
        if (ca) {
          const year = ca.substring(0, 4)
          yearMap[year] = (yearMap[year] || 0) + 1
        }
      }
      const yearlyWatches = Object.entries(yearMap).sort().map(([year, count]) => ({ year, count }))

      // 鑑賞方法
      const methodMap: Record<string, number> = {}
      const methodLabels: Record<string, string> = { theater: '映画館', streaming: '配信', dvd: 'DVD/Blu-ray', tv: 'TV放送', other: 'その他' }
      for (const w of items) {
        const m = (w.watch_method as string) || 'other'
        const label = methodLabels[m] || m
        methodMap[label] = (methodMap[label] || 0) + 1
      }
      const watchMethods = Object.entries(methodMap).sort((a, b) => b[1] - a[1]).map(([method, count]) => ({ method, count }))

      // スコア分布
      const scoreMap: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
      for (const w of items) {
        const s = w.score as number
        if (s) {
          const bucket = String(Math.ceil(s))
          scoreMap[bucket] = (scoreMap[bucket] || 0) + 1
        }
      }
      const scoreDistribution = Object.entries(scoreMap).map(([range, count]) => ({
        range: `★${range}`,
        count,
      }))

      // 製作国
      const countryMap: Record<string, number> = {}
      for (const w of items) {
        const movie = movieData[w.movie_id as number]
        if (movie?.production_countries) {
          const countries = typeof movie.production_countries === 'string'
            ? JSON.parse(movie.production_countries as string)
            : movie.production_countries
          for (const c of countries as { name: string }[]) {
            countryMap[c.name] = (countryMap[c.name] || 0) + 1
          }
        }
      }
      const topCountries = Object.entries(countryMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([country, count]) => ({ country, count }))

      // 平均スコア
      const scores = items.filter((w: Record<string, unknown>) => w.score).map((w: Record<string, unknown>) => w.score as number)
      const avgScore = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0

      // 総視聴時間
      let totalMinutes = user?.total_watch_minutes || 0
      if (totalMinutes === 0) {
        for (const w of items) {
          const movie = movieData[w.movie_id as number]
          if (movie?.runtime) totalMinutes += movie.runtime as number
        }
      }

      setStats({
        totalWatched: items.length,
        totalReviews: revs.length,
        avgScore: Math.round(avgScore * 10) / 10,
        totalMinutes,
        loginStreak: user?.login_streak || 0,
        genreDistribution,
        monthlyWatches,
        yearlyWatches,
        watchMethods,
        scoreDistribution,
        topCountries,
      })
    } catch { /* ignore */ }
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fm-text-sub)' }}>統計データを集計中...</div>
      </div>
    )
  }

  if (!stats) return null

  const maxMonthly = Math.max(...stats.monthlyWatches.map(m => m.count), 1)
  const maxMethod = Math.max(...stats.watchMethods.map(m => m.count), 1)
  const maxScore = Math.max(...stats.scoreDistribution.map(s => s.count), 1)
  const maxCountry = Math.max(...stats.topCountries.map(c => c.count), 1)
  const totalGenre = stats.genreDistribution.reduce((a, g) => a + g.count, 0) || 1

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>📊 統計</h2>

      {/* サマリーカード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { label: '鑑賞数', value: stats.totalWatched, icon: '🎬' },
          { label: 'レビュー', value: stats.totalReviews, icon: '✍️' },
          { label: '平均評価', value: stats.avgScore.toFixed(1), icon: '⭐' },
          { label: '総時間', value: `${Math.round(stats.totalMinutes / 60)}h`, icon: '⏱️' },
          { label: '連続ログイン', value: `${stats.loginStreak}日`, icon: '🔥' },
          { label: '国数', value: stats.topCountries.length, icon: '🌍' },
        ].map((c, i) => (
          <div key={i} style={{
            background: 'var(--fm-bg-card)', borderRadius: 12, padding: '14px 12px',
            border: '1px solid var(--fm-border)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fm-accent)' }}>{c.value}</div>
            <div style={{ fontSize: 11, color: 'var(--fm-text-sub)', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ジャンル分布 */}
      {stats.genreDistribution.length > 0 && (
        <div style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--fm-border)', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🎭 ジャンル分布</h3>
          {/* SVG Pie Chart */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <svg viewBox="0 0 100 100" width={120} height={120} style={{ flexShrink: 0 }}>
              {(() => {
                let acc = 0
                return stats.genreDistribution.map((g, i) => {
                  const pct = (g.count / totalGenre) * 100
                  const start = acc
                  acc += pct
                  const startAngle = (start / 100) * 360 - 90
                  const endAngle = (acc / 100) * 360 - 90
                  const largeArc = pct > 50 ? 1 : 0
                  const sx = 50 + 40 * Math.cos((startAngle * Math.PI) / 180)
                  const sy = 50 + 40 * Math.sin((startAngle * Math.PI) / 180)
                  const ex = 50 + 40 * Math.cos((endAngle * Math.PI) / 180)
                  const ey = 50 + 40 * Math.sin((endAngle * Math.PI) / 180)
                  return (
                    <path key={i} d={`M50,50 L${sx},${sy} A40,40 0 ${largeArc},1 ${ex},${ey} Z`} fill={g.color} />
                  )
                })
              })()}
            </svg>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {stats.genreDistribution.slice(0, 6).map((g, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: g.color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--fm-text-sub)' }}>{g.name}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{g.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 月別鑑賞数 */}
      <div style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--fm-border)', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📅 月別鑑賞数</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
          {stats.monthlyWatches.map((m, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--fm-accent)', fontWeight: 600 }}>{m.count || ''}</span>
              <div style={{
                width: '100%', background: 'linear-gradient(180deg, var(--fm-accent), var(--fm-accent-dark))',
                borderRadius: '4px 4px 0 0', minHeight: 2,
                height: `${(m.count / maxMonthly) * 80}px`,
                transition: 'height 0.3s',
              }} />
              <span style={{ fontSize: 9, color: 'var(--fm-text-muted)', whiteSpace: 'nowrap' }}>{m.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 鑑賞方法 */}
      {stats.watchMethods.length > 0 && (
        <div style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--fm-border)', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📺 鑑賞方法</h3>
          {stats.watchMethods.map((m, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>{m.method}</span>
                <span style={{ fontWeight: 600 }}>{m.count}本 ({Math.round((m.count / stats.totalWatched) * 100)}%)</span>
              </div>
              <div style={{ height: 8, background: 'var(--fm-bg-secondary)', borderRadius: 4 }}>
                <div style={{
                  height: '100%', borderRadius: 4, width: `${(m.count / maxMethod) * 100}%`,
                  background: 'linear-gradient(90deg, var(--fm-accent), var(--fm-accent-light))',
                  transition: 'width 0.5s',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* スコア分布 */}
      <div style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--fm-border)', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>⭐ スコア分布</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
          {stats.scoreDistribution.map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{s.count}</span>
              <div style={{
                width: '100%', background: i < 2 ? 'var(--fm-danger)' : i < 3 ? 'var(--fm-warning)' : 'var(--fm-success)',
                borderRadius: '4px 4px 0 0', minHeight: 2,
                height: `${(s.count / maxScore) * 60}px`,
                marginTop: 2,
              }} />
              <span style={{ fontSize: 11, color: 'var(--fm-star)', marginTop: 2, display: 'block' }}>{s.range}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 製作国 */}
      {stats.topCountries.length > 0 && (
        <div style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--fm-border)', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🌍 製作国ランキング</h3>
          {stats.topCountries.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, width: 20, textAlign: 'center', color: 'var(--fm-text-sub)' }}>{i + 1}</span>
              <span style={{ fontSize: 13, flex: 1 }}>{c.country}</span>
              <div style={{ width: 100, height: 6, background: 'var(--fm-bg-secondary)', borderRadius: 3 }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${(c.count / maxCountry) * 100}%`, background: 'var(--fm-accent)' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, width: 30, textAlign: 'right' }}>{c.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
