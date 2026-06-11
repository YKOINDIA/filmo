'use client'

import { useCallback, useEffect, useState } from 'react'
import { copyToClipboard, shareToLine, shareToTwitter } from '../lib/share'
import { maybeShowInterstitial } from '../lib/ads'

export type GameShareChannel = 'twitter' | 'line' | 'copy_link'

interface Props {
  /** シェアテキスト本文 (URL は含めない。コピー時にこの末尾に \n + shareUrl が付加される) */
  shareText: string
  /** 共有 URL (ゲームページ等) */
  shareUrl: string
  /** ボタンが押された際に analytics などを発火するコールバック */
  onTrack?: (channel: GameShareChannel) => void
  /**
   * normal: LINE + X (2 列) + コピー (フル幅) の縦並びレイアウト。
   * compact: 3 ボタンを 1 行に並べる狭い領域用 (例: Filmius の結果オーバーレイ)。
   */
  variant?: 'normal' | 'compact'
}

/**
 * Filmo の各ミニゲーム共通のシェアボタン群。
 * LINE / X (Twitter) / リンクコピー の 3 ボタンを統一 UI で提供する。
 * コピー成功時は 2 秒間 "✅" 表示にフィードバックする。
 */
export default function GameShareButtons({
  shareText, shareUrl, onTrack, variant = 'normal',
}: Props) {
  const [copied, setCopied] = useState(false)

  // このコンポーネントは各ゲームの結果画面 (ゲームオーバー/クリア) にだけ
  // マウントされるので、「プレイの区切り」としてインタースティシャル広告の
  // トリガーに使う。頻度制御 (3 分間隔・日次上限・新規 24h 免除) は
  // maybeShowInterstitial 側に内蔵。ネイティブアプリ以外では no-op。
  useEffect(() => {
    void maybeShowInterstitial('game_result')
  }, [])

  const onLine = useCallback(() => {
    shareToLine(shareText, shareUrl)
    onTrack?.('line')
  }, [shareText, shareUrl, onTrack])

  const onX = useCallback(() => {
    shareToTwitter(shareText, shareUrl)
    onTrack?.('twitter')
  }, [shareText, shareUrl, onTrack])

  const onCopy = useCallback(async () => {
    const ok = await copyToClipboard(`${shareText}\n${shareUrl}`)
    if (ok) {
      setCopied(true)
      onTrack?.('copy_link')
      setTimeout(() => setCopied(false), 2000)
    }
  }, [shareText, shareUrl, onTrack])

  if (variant === 'compact') {
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 6, width: '100%',
      }}>
        <button type="button" onClick={onLine} style={{
          ...compactBtn, background: '#06C755', color: '#fff',
        }}>💬 LINE</button>
        <button type="button" onClick={onX} style={{
          ...compactBtn, background: '#000', color: '#fff',
        }}>
          <XIcon size={11} /> <span style={{ marginLeft: 4 }}>X</span>
        </button>
        <button type="button" onClick={onCopy} style={{
          ...compactBtn,
          background: copied ? 'rgba(46,204,138,0.20)' : 'rgba(255,255,255,0.12)',
          color: copied ? '#2ecc8a' : '#fff',
          border: `1px solid ${copied ? 'rgba(46,204,138,0.45)' : 'rgba(255,255,255,0.25)'}`,
        }}>
          {copied ? '✅' : '🔗 コピー'}
        </button>
      </div>
    )
  }

  // normal: LINE + X (2列) ＋ コピー (フル幅)
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button type="button" onClick={onLine} style={{
          ...primaryBtn, background: '#06C755',
        }}>💬 LINEでシェア</button>
        <button type="button" onClick={onX} style={{
          ...primaryBtn, background: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <XIcon size={14} />
          <span>X でシェア</span>
        </button>
      </div>
      <button type="button" onClick={onCopy} style={{
        ...secondaryBtn,
        background: copied ? 'rgba(46,204,138,0.12)' : 'rgba(255,255,255,0.06)',
        borderColor: copied ? 'rgba(46,204,138,0.45)' : 'rgba(255,255,255,0.20)',
        color: copied ? '#2ecc8a' : '#fff',
      }}>
        {copied ? '✅ 結果テキストをコピーしました' : '🔗 結果テキストをコピー'}
      </button>
    </div>
  )
}

function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
}

const primaryBtn: React.CSSProperties = {
  padding: '14px 12px', borderRadius: 12,
  border: 'none', cursor: 'pointer',
  color: '#fff', fontSize: 14, fontWeight: 700,
  touchAction: 'manipulation',
}
const secondaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.20)',
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
  touchAction: 'manipulation',
}
const compactBtn: React.CSSProperties = {
  padding: '10px 4px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.2)',
  fontSize: 'clamp(10px, 2.4cqw, 13px)', fontWeight: 700,
  fontFamily: 'monospace',
  cursor: 'pointer',
  touchAction: 'manipulation',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
}
