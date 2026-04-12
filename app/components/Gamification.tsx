'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getLevelFromPoints, LEVEL_TITLES, checkAndAwardTitles } from '../lib/points'

interface PointEntry {
  points: number
  reason: string
  created_at: string
}

interface TitleDef {
  id: string
  name: string
  description: string
  category: string
  is_secret: boolean
}

interface EarnedTitle {
  title_id: string
  earned_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  genre: 'ジャンル',
  streak: '継続',
  time: '時間帯',
  review: 'レビュー',
  diversity: '多様性',
  social: 'ソーシャル',
  secret: 'シークレット',
}

const CATEGORY_ICONS: Record<string, string> = {
  genre: '🎭', streak: '🔥', time: '🌙', review: '✍️',
  diversity: '🌍', social: '👥', secret: '🔒',
}

export default function Gamification({ userId }: { userId: string }) {
  const [userPoints, setUserPoints] = useState(0)
  const [userLevel, setUserLevel] = useState(1)
  const [pointHistory, setPointHistory] = useState<PointEntry[]>([])
  const [allTitles, setAllTitles] = useState<TitleDef[]>([])
  const [earnedTitleIds, setEarnedTitleIds] = useState<Set<string>>(new Set())
  const [earnedMap, setEarnedMap] = useState<Record<string, string>>({})
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [checking, setChecking] = useState(false)
  const [newTitles, setNewTitles] = useState<{ name: string; id: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // ユーザー情報
      const { data: user } = await supabase.from('users').select('points, level').eq('id', userId).single()
      if (user) {
        setUserPoints(user.points || 0)
        setUserLevel(user.level || 1)
      }

      // ポイント履歴
      const { data: history } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      setPointHistory(history || [])

      // 全称号
      const { data: titles } = await supabase.from('user_titles').select('*').limit(100)
      setAllTitles((titles || []).map((t: Record<string, unknown>) => ({
        id: t.id as string || t.$id as string,
        name: t.name as string,
        description: t.description as string,
        category: t.category as string,
        is_secret: t.is_secret as boolean,
      })))

      // 取得済み称号
      const { data: earned } = await supabase
        .from('user_earned_titles')
        .select('title_id, earned_at')
        .eq('user_id', userId)
        .limit(100)
      const ids = new Set<string>((earned || []).map((e: EarnedTitle) => e.title_id))
      setEarnedTitleIds(ids)
      const map: Record<string, string> = {}
      ;(earned || []).forEach((e: EarnedTitle) => { map[e.title_id] = e.earned_at })
      setEarnedMap(map)
    } catch { /* ignore */ }
    setLoading(false)
  }

  const handleCheckTitles = async () => {
    setChecking(true)
    const result = await checkAndAwardTitles(userId)
    if (result.length > 0) {
      setNewTitles(result)
      const newIds = new Set(earnedTitleIds)
      result.forEach(t => newIds.add(t.id))
      setEarnedTitleIds(newIds)
    }
    setChecking(false)
  }

  if (loading) {
    return <div style={{ padding: 16, textAlign: 'center', color: 'var(--fm-text-sub)' }}>読み込み中...</div>
  }

  const currentLevel = getLevelFromPoints(userPoints)
  const nextLevel = LEVEL_TITLES.find(l => l.points > userPoints) || LEVEL_TITLES[LEVEL_TITLES.length - 1]
  const prevLevelPoints = currentLevel.points
  const progress = nextLevel.points > prevLevelPoints
    ? ((userPoints - prevLevelPoints) / (nextLevel.points - prevLevelPoints)) * 100
    : 100

  const categories = ['all', ...Object.keys(CATEGORY_LABELS)]
  const filteredTitles = selectedCategory === 'all'
    ? allTitles
    : allTitles.filter(t => t.category === selectedCategory)

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>🏆 ゲーミフィケーション</h2>

      {/* レベルカード */}
      <div style={{
        background: `linear-gradient(135deg, ${currentLevel.color}20, ${currentLevel.color}05)`,
        borderRadius: 16, padding: 20, border: `1px solid ${currentLevel.color}40`,
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: currentLevel.color, fontSize: 20, fontWeight: 800, color: '#fff',
          }}>
            {currentLevel.level}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: currentLevel.color }}>{currentLevel.title}</div>
            <div style={{ fontSize: 13, color: 'var(--fm-text-sub)' }}>{userPoints.toLocaleString()} pt</div>
          </div>
        </div>

        {/* プログレスバー */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fm-text-sub)', marginBottom: 4 }}>
            <span>Lv.{currentLevel.level}</span>
            <span>次のレベルまで {(nextLevel.points - userPoints).toLocaleString()} pt</span>
            <span>Lv.{nextLevel.level}</span>
          </div>
          <div style={{ height: 8, background: 'var(--fm-bg-secondary)', borderRadius: 4 }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: `linear-gradient(90deg, ${currentLevel.color}, ${currentLevel.color}80)`,
              width: `${Math.min(progress, 100)}%`,
              transition: 'width 0.5s',
            }} />
          </div>
        </div>
      </div>

      {/* 称号チェックボタン */}
      <button onClick={handleCheckTitles} disabled={checking}
        className={checking ? '' : 'pulse-glow'}
        style={{
          width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, var(--fm-accent), var(--fm-accent-light))',
          color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 16,
          opacity: checking ? 0.7 : 1,
        }}>
        {checking ? '称号チェック中...' : '🏅 称号をチェックする'}
      </button>

      {/* 新規取得称号 */}
      {newTitles.length > 0 && (
        <div className="animate-slide-up" style={{
          background: 'linear-gradient(135deg, rgba(108,92,231,0.2), rgba(255,215,0,0.1))',
          borderRadius: 12, padding: 16, border: '1px solid var(--fm-star)',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>🎉 新しい称号を獲得!</div>
          {newTitles.map(t => (
            <div key={t.id} style={{ fontSize: 14, color: 'var(--fm-star)', fontWeight: 600, padding: '4px 0' }}>
              🏅 {t.name}
            </div>
          ))}
        </div>
      )}

      {/* 称号ギャラリー */}
      <div style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--fm-border)', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🏅 称号コレクション ({earnedTitleIds.size}/{allTitles.length})</h3>

        {/* カテゴリータブ */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 12px', borderRadius: 16, border: '1px solid var(--fm-border)',
                background: selectedCategory === cat ? 'var(--fm-accent)' : 'transparent',
                color: selectedCategory === cat ? '#fff' : 'var(--fm-text-sub)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              {cat === 'all' ? '全て' : `${CATEGORY_ICONS[cat] || ''} ${CATEGORY_LABELS[cat] || cat}`}
            </button>
          ))}
        </div>

        {/* タイトルリスト */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredTitles.map(title => {
            const earned = earnedTitleIds.has(title.id)
            const isSecret = title.is_secret && !earned
            return (
              <div key={title.id} style={{
                padding: '10px 12px', borderRadius: 10,
                background: earned ? 'rgba(108,92,231,0.1)' : 'var(--fm-bg-secondary)',
                border: earned ? '1px solid var(--fm-accent)' : '1px solid transparent',
                opacity: earned ? 1 : 0.5,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{earned ? '🏅' : isSecret ? '🔒' : '⬜'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: earned ? 'var(--fm-accent)' : 'var(--fm-text-sub)' }}>
                      {isSecret ? '???' : title.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                      {isSecret ? 'シークレット称号' : title.description}
                    </div>
                    {earned && earnedMap[title.id] && (
                      <div style={{ fontSize: 10, color: 'var(--fm-text-muted)', marginTop: 2 }}>
                        取得: {new Date(earnedMap[title.id]).toLocaleDateString('ja-JP')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ポイント履歴 */}
      <div style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--fm-border)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📋 ポイント履歴</h3>
        {pointHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--fm-text-sub)', fontSize: 13 }}>
            まだポイント履歴がありません
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
            {pointHistory.map((entry, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: '1px solid var(--fm-border)',
              }}>
                <div>
                  <div style={{ fontSize: 13 }}>{entry.reason}</div>
                  <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                    {new Date(entry.created_at).toLocaleDateString('ja-JP')}
                  </div>
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 700,
                  color: entry.points > 0 ? 'var(--fm-success)' : 'var(--fm-danger)',
                }}>
                  {entry.points > 0 ? '+' : ''}{entry.points} pt
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
