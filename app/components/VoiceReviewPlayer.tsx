'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getVoiceModeLabel } from '../lib/voice-modes'

interface VoiceReviewPlayerProps {
  audioUrl: string
  voiceReviewId: string
  userName: string
  userAvatar?: string | null
  voiceMode: string
  durationSeconds: number
  hasSpoiler?: boolean
  initialReactions?: { clap: number; laugh: number; replay: number }
}

function createFallbackBars(seed: number) {
  return Array.from({ length: 32 }, (_, i) => 0.2 + Math.abs(Math.sin((i + 1) * seed)) * 0.6)
}

export default function VoiceReviewPlayer({
  audioUrl,
  voiceReviewId,
  userName,
  userAvatar,
  voiceMode,
  durationSeconds,
  hasSpoiler = false,
  initialReactions = { clap: 0, laugh: 0, replay: 0 },
}: VoiceReviewPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [revealed, setRevealed] = useState(!hasSpoiler)
  const fallbackBars = useMemo(() => createFallbackBars(durationSeconds / 7 + 0.4), [durationSeconds])
  const [bars, setBars] = useState<number[]>(fallbackBars)
  const [reactions, setReactions] = useState(initialReactions)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    let mounted = true
    let context: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    let sourceNode: MediaElementAudioSourceNode | null = null
    let dataArray: Uint8Array<ArrayBuffer> | null = null

    const updateBars = () => {
      if (!analyser || !dataArray || !mounted) return
      analyser.getByteFrequencyData(dataArray)
      const nextBars = Array.from({ length: 32 }, (_, i) => {
        const bucketSize = Math.max(1, Math.floor(dataArray!.length / 32))
        let total = 0
        for (let j = i * bucketSize; j < Math.min(dataArray!.length, (i + 1) * bucketSize); j++) {
          total += dataArray![j]
        }
        return Math.max(0.14, total / Math.max(1, bucketSize) / 255)
      })
      setBars(nextBars)
      frameRef.current = requestAnimationFrame(updateBars)
    }

    const boot = async () => {
      try {
        context = new AudioContext()
        analyser = context.createAnalyser()
        analyser.fftSize = 256
        sourceNode = context.createMediaElementSource(audio)
        sourceNode.connect(analyser)
        analyser.connect(context.destination)
        dataArray = new Uint8Array(analyser.frequencyBinCount)
      } catch { setBars(fallbackBars) }
    }
    void boot()

    const handlePlay = async () => {
      setIsPlaying(true)
      if (context?.state === 'suspended') await context.resume()
      updateBars()
    }
    const handlePause = () => {
      setIsPlaying(false)
      setBars(fallbackBars)
      if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null }
    }

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handlePause)
    return () => {
      mounted = false
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handlePause)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      sourceNode?.disconnect()
      analyser?.disconnect()
      void context?.close()
    }
  }, [audioUrl, fallbackBars])

  const sendReaction = async (type: 'clap' | 'laugh' | 'replay') => {
    setReactions(prev => ({ ...prev, [type]: prev[type] + 1 }))
    try {
      await fetch('/api/voice-reactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ voiceReviewId, soundType: type }),
      })
    } catch { /* optimistic UI */ }
  }

  if (!revealed) {
    return (
      <div style={{
        background: 'rgba(255,107,107,0.08)', borderRadius: 14, padding: 14,
        border: '1px solid rgba(255,107,107,0.2)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, color: 'var(--fm-danger)', marginBottom: 8 }}>
          ⚠️ ネタバレを含むボイスレビュー
        </div>
        <button onClick={() => setRevealed(true)} style={{
          background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.3)',
          borderRadius: 8, padding: '6px 16px', color: 'var(--fm-danger)',
          cursor: 'pointer', fontSize: 12, fontWeight: 600,
        }}>
          表示する
        </button>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--fm-bg-card)', borderRadius: 14, padding: 14,
      border: '1px solid var(--fm-border)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', overflow: 'hidden',
          background: 'var(--fm-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: 'var(--fm-text-muted)', flexShrink: 0,
        }}>
          {userAvatar ? (
            <img src={userAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : '👤'}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fm-text)' }}>{userName}</span>
        <span style={{
          fontSize: 10, background: 'rgba(108,92,231,0.15)', color: '#6c5ce7',
          borderRadius: 4, padding: '1px 6px', fontWeight: 600,
        }}>
          🎙️ {getVoiceModeLabel(voiceMode)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginLeft: 'auto' }}>
          {durationSeconds}秒
        </span>
      </div>

      {/* Waveform */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 2, height: 40,
        marginBottom: 8, padding: '0 4px',
      }}>
        {bars.map((h, i) => (
          <div key={i} style={{
            flex: 1, height: `${Math.round(h * 100)}%`, minHeight: 3,
            borderRadius: 2,
            background: isPlaying
              ? 'linear-gradient(to top, #6c5ce7, #a29bfe)'
              : 'rgba(108,92,231,0.3)',
            transition: isPlaying ? 'none' : 'height 0.3s ease',
          }} />
        ))}
      </div>

      {/* Audio player */}
      <audio ref={audioRef} controls src={audioUrl} style={{ width: '100%', height: 32, marginBottom: 8 }} />

      {/* Reactions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {([
          { key: 'clap' as const, emoji: '👏', label: '拍手' },
          { key: 'laugh' as const, emoji: '😂', label: '笑い' },
          { key: 'replay' as const, emoji: '🔁', label: 'もう一回' },
        ]).map(r => (
          <button key={r.key} onClick={() => sendReaction(r.key)} style={{
            background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.15)',
            borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
            fontSize: 12, color: 'var(--fm-text-sub)', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {r.emoji} {reactions[r.key]}
          </button>
        ))}
      </div>
    </div>
  )
}
