'use client'

/**
 * うらにゃん 専用のログイン/新規登録ページ。
 *
 * うらにゃん iOS スタンドアロンアプリ (jp.filmo.uranyan) は Filmo Dashboard を
 * WebView 内に表示したくない (Apple 4.2 Minimum Functionality 対策 + UX)。
 * かといって Web Safari に外部リンクで飛ばすと、Safari と WebView の localStorage
 * が分離していて Supabase セッションが共有されない → 戻ってきても未ログインのまま。
 *
 * そこで「うらにゃんブランドのまま」「Filmo の他画面を見せずに」ログイン/新規登録
 * できる専用ページを用意する。LoginPrompt コンポーネントを再利用しているので、
 * 認証ロジックは Filmo 本体と同じ Supabase (アカウント完全共通)。
 *
 * 認証成功 → /games/uranyan に戻る (?app=uranyan を維持してスタンドアロン状態を保つ)。
 */

import { Suspense, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import LoginPrompt from '../../../components/LoginPrompt'
import { useStandaloneApp } from '../../../lib/standaloneApp'

function UranyanAuthInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const standaloneMode = useStandaloneApp()
  const isStandalone = standaloneMode === 'uranyan'

  // 戻り先 URL — ?app=uranyan を維持するとアプリモード判定が継続する
  const returnHref = isStandalone || searchParams.get('app') === 'uranyan'
    ? '/games/uranyan?app=uranyan'
    : '/games/uranyan'

  const goToUranyan = useCallback(() => {
    router.push(returnHref)
  }, [router, returnHref])

  // 既にログイン済みなら自動でうらにゃんに戻る
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) goToUranyan()
    })
  }, [goToUranyan])

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(180deg, #FF7AAE 0%, #FFB6D1 100%)',
      color: '#2A2A3A',
    }}>
      {/* ヘッダー */}
      <header style={{
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href={returnHref} style={{
          color: '#FFFFFF',
          fontSize: 14, fontWeight: 600, textDecoration: 'none',
          textShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}>
          ← 戻る
        </Link>
        <div style={{
          fontWeight: 800, fontSize: 16, color: '#FFFFFF',
          textShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}>
          うらにゃん。
        </div>
        <div style={{ width: 40 }} />
      </header>

      {/* メイン */}
      <main style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '24px 16px 60px',
      }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: 20,
          padding: '32px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🐱</div>
            <h1 style={{
              fontSize: 20, fontWeight: 800, margin: 0,
              color: '#2A2A3A',
            }}>
              うらにゃんにログイン
            </h1>
            <p style={{
              fontSize: 13, color: '#888',
              margin: '8px 0 0',
              lineHeight: 1.5,
            }}>
              占い結果の保存・履歴の振り返り・グループ相性などの機能が使えるようになります。
            </p>
          </div>

          <LoginPrompt onAuthenticated={goToUranyan} />

          <div style={{
            marginTop: 20,
            paddingTop: 20,
            borderTop: '1px solid #EEE',
            textAlign: 'center',
          }}>
            <Link href={returnHref} style={{
              color: '#888', fontSize: 13, textDecoration: 'underline',
            }}>
              ログインせずに使う
            </Link>
          </div>
        </div>

        <p style={{
          marginTop: 20,
          fontSize: 11, color: '#FFFFFF',
          textAlign: 'center',
          textShadow: '0 1px 2px rgba(0,0,0,0.15)',
          lineHeight: 1.6,
        }}>
          アカウントは Filmo (映画記録アプリ) と共通です。<br />
          どちらかで登録済みなら同じ ID/パスワードでログインできます。
        </p>
      </main>
    </div>
  )
}

export default function UranyanAuthPage() {
  // useSearchParams を含むので Suspense 境界が必要 (Next.js App Router 要件)
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#FF7AAE' }} />}>
      <UranyanAuthInner />
    </Suspense>
  )
}
