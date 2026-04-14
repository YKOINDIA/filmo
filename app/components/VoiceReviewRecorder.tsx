'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { transformVoiceBlob } from '../lib/audio/voice-transform'
import { getVoiceModeOptions, type VoiceMode } from '../lib/voice-modes'
import { supabase } from '../lib/supabase'

interface VoiceReviewRecorderProps {
  movieId: number
  movieTitle: string
  userId: string
  onComplete?: () => void
  onTranscript?: (text: string) => void
  label?: string
  promptText?: string
}

const MAX_DURATION_FREE = 15
const MAX_DURATION_PREMIUM = 60

export default function VoiceReviewRecorder({
  movieId,
  movieTitle,
  userId,
  onComplete,
  onTranscript,
  label = 'ボイスレビュー',
  promptText,
}: VoiceReviewRecorderProps) {
  const isPremium = false // TODO: check from user profile
  const maxDuration = isPremium ? MAX_DURATION_PREMIUM : MAX_DURATION_FREE
  const voiceOptions = useMemo(() => getVoiceModeOptions(isPremium), [isPremium])

  const [isRecording, setIsRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('original')
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null)
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasSpoiler, setHasSpoiler] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const processingRunRef = useRef(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  const updatePreviewUrl = (blob: Blob | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    if (!blob) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(blob)
    previewUrlRef.current = url
    setPreviewUrl(url)
  }

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  const resetTimer = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null }
  }

  // Voice transform effect
  useEffect(() => {
    if (!sourceBlob) {
      setProcessedBlob(null)
      updatePreviewUrl(null)
      return
    }
    const run = async () => {
      const runId = ++processingRunRef.current
      setIsProcessing(true)
      setStatus('ボイスを変換中...')
      try {
        const blob = await transformVoiceBlob(sourceBlob, voiceMode)
        if (processingRunRef.current !== runId) return
        setProcessedBlob(blob)
        updatePreviewUrl(blob)
        setStatus('')
      } catch {
        if (processingRunRef.current !== runId) return
        setProcessedBlob(null)
        updatePreviewUrl(null)
        setStatus('音声の変換に失敗しました。')
      } finally {
        if (processingRunRef.current === runId) setIsProcessing(false)
      }
    }
    void run()
  }, [sourceBlob, voiceMode])

  const startSpeechRecognition = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition || !onTranscriptRef.current) return
    try {
      const recognition = new SpeechRecognition()
      recognition.lang = 'ja-JP'
      recognition.continuous = true
      recognition.interimResults = false
      transcriptRef.current = ''
      recognition.onresult = (e: { results: Iterable<{ isFinal: boolean; 0: { transcript: string } }> }) => {
        const parts: string[] = []
        for (const result of e.results) {
          if (result.isFinal) parts.push(result[0].transcript)
        }
        transcriptRef.current = parts.join('')
      }
      recognition.start()
      recognitionRef.current = recognition
    } catch { /* Speech API not available — silently skip */ }
  }

  const stopSpeechRecognition = () => {
    try { recognitionRef.current?.stop() } catch { /* ignore */ }
    recognitionRef.current = null
    if (transcriptRef.current && onTranscriptRef.current) {
      onTranscriptRef.current(transcriptRef.current)
    }
  }

  const startRecording = async () => {
    try {
      setStatus('')
      setSourceBlob(null)
      setProcessedBlob(null)
      updatePreviewUrl(null)
      chunksRef.current = []
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        setSourceBlob(new Blob(chunksRef.current, { type: 'audio/webm' }))
        setIsRecording(false)
        resetTimer()
        stopTracks()
        stopSpeechRecognition()
      }

      recorder.start()
      setSeconds(0)
      setIsRecording(true)
      startSpeechRecognition()

      timerRef.current = window.setInterval(() => {
        setSeconds(cur => {
          if (cur + 1 >= maxDuration) { recorder.stop(); return maxDuration }
          return cur + 1
        })
      }, 1000)
    } catch {
      setStatus('マイクにアクセスできませんでした。')
    }
  }

  const stopRecording = () => { mediaRecorderRef.current?.stop() }

  const submitRecording = async () => {
    if (!processedBlob || isProcessing) return
    setIsSubmitting(true)
    setStatus('')

    try {
      const ext = processedBlob.type === 'audio/wav' ? 'wav' : 'webm'
      const path = `${userId}/${crypto.randomUUID()}.${ext}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('voice-reviews')
        .upload(path, processedBlob, { contentType: processedBlob.type })
      if (uploadError) throw uploadError

      // Save to DB
      const { error: dbError } = await supabase.from('voice_reviews').insert({
        user_id: userId,
        movie_id: movieId,
        storage_path: path,
        duration_seconds: Math.max(seconds, 1),
        voice_mode: voiceMode,
        has_spoiler: hasSpoiler,
      })
      if (dbError) throw dbError

      setStatus('ボイスレビューを投稿しました!')
      setSourceBlob(null)
      setProcessedBlob(null)
      updatePreviewUrl(null)
      setSeconds(0)
      onComplete?.()
    } catch (e) {
      setStatus(`投稿に失敗しました: ${e instanceof Error ? e.message : '不明なエラー'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{
      background: 'rgba(108,92,231,0.08)', borderRadius: 16,
      padding: 16, border: '1px solid rgba(108,92,231,0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>🎙️</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fm-text)' }}>
          {label}
        </span>
        <span style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginLeft: 'auto' }}>
          最大{maxDuration}秒
        </span>
      </div>

      <p style={{ fontSize: 12, color: 'var(--fm-text-sub)', margin: '0 0 12px' }}>
        {promptText || `「${movieTitle}」について声でレビューしよう`}
      </p>

      {/* Voice mode selector */}
      <div style={{ marginBottom: 12 }}>
        <select
          value={voiceMode}
          onChange={e => setVoiceMode(e.target.value as VoiceMode)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
            color: 'var(--fm-text)', fontSize: 13,
          }}
        >
          {voiceOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <p style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 4 }}>
          {voiceOptions.find(o => o.value === voiceMode)?.description}
        </p>
      </div>

      {/* Spoiler toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, color: 'var(--fm-text-sub)', cursor: 'pointer' }}>
        <input type="checkbox" checked={hasSpoiler} onChange={e => setHasSpoiler(e.target.checked)} />
        ネタバレを含む
      </label>

      {/* Recording controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {!isRecording ? (
          <button onClick={startRecording} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #e74c3c, #c0392b)', color: '#fff',
            fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
            録音開始
          </button>
        ) : (
          <button onClick={stopRecording} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: '#333', color: '#fff', fontWeight: 700, fontSize: 14,
          }}>
            ■ 録音停止 ({seconds}s / {maxDuration}s)
          </button>
        )}
        <button
          onClick={submitRecording}
          disabled={!processedBlob || isSubmitting || isProcessing}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: processedBlob && !isProcessing ? 'linear-gradient(135deg, #6c5ce7, #a29bfe)' : 'rgba(108,92,231,0.2)',
            color: processedBlob && !isProcessing ? '#fff' : '#666', fontWeight: 700, fontSize: 14,
          }}
        >
          {isSubmitting ? '投稿中...' : isProcessing ? '変換中...' : '投稿する'}
        </button>
      </div>

      {/* Audio preview */}
      {previewUrl && (
        <audio controls src={previewUrl} style={{ width: '100%', height: 36, marginBottom: 8 }} />
      )}

      {/* Status message */}
      {status && (
        <p style={{
          fontSize: 12, margin: '4px 0 0',
          color: status.includes('失敗') ? 'var(--fm-danger)' : 'var(--fm-accent)',
        }}>
          {status}
        </p>
      )}
    </div>
  )
}
