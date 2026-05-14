'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import type { Board } from './engine'

/**
 * 対戦用 Realtime チャネル。
 * 同じ room_code を持つ 2 名が Supabase Realtime broadcast チャネルに参加し、
 * 攻撃 (お邪魔送信)・盤面プレビュー・ゲームオーバー通知をやりとりする。
 */

export type OpponentSnapshot = {
  board: Board
  score: number
  chain: number
  gameOver: boolean
  name: string
  avatar: string | null
}

interface AttackPayload {
  garbage: number
  chain: number
  score: number
}

interface StatePayload {
  board: Board
  score: number
  chain: number
  gameOver: boolean
  name: string
  avatar: string | null
}

interface ReadyPayload {
  userId: string
  name: string
  avatar: string | null
}

export interface UseMultiplayerOptions {
  roomCode: string | null
  userId: string
  userName: string
  userAvatar: string | null
  onAttackReceived: (garbage: number, chain: number) => void
  onOpponentGameOver: (finalScore: number) => void
}

export interface MultiplayerApi {
  ready: boolean
  opponentJoined: boolean
  opponent: OpponentSnapshot | null
  /** 自分のスナップショットを送信 (定期的に) */
  sendState: (snap: Omit<StatePayload, 'name' | 'avatar'>) => void
  /** 自分の連鎖→お邪魔を相手に送る */
  sendAttack: (payload: AttackPayload) => void
  /** ゲームオーバー通知 */
  sendGameOver: (finalScore: number) => void
  /** チャネルを閉じる */
  leave: () => void
}

export function useMultiplayer(opts: UseMultiplayerOptions): MultiplayerApi {
  const {
    roomCode,
    userId,
    userName,
    userAvatar,
    onAttackReceived,
    onOpponentGameOver,
  } = opts

  const [ready, setReady] = useState(false)
  const [opponentJoined, setOpponentJoined] = useState(false)
  const [opponent, setOpponent] = useState<OpponentSnapshot | null>(null)
  // Supabase の channel 型は import しなくても shape だけ使えれば良い
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null)
  const handlersRef = useRef({ onAttackReceived, onOpponentGameOver })
  useEffect(() => {
    handlersRef.current = { onAttackReceived, onOpponentGameOver }
  }, [onAttackReceived, onOpponentGameOver])

  useEffect(() => {
    if (!roomCode || !userId) return
    const channelName = `crystal-blast:${roomCode}`
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: userId },
      },
    })

    channel.on('broadcast', { event: 'state' }, (msg: { payload: StatePayload }) => {
      const p = msg.payload
      setOpponent({
        board: p.board,
        score: p.score,
        chain: p.chain,
        gameOver: p.gameOver,
        name: p.name,
        avatar: p.avatar,
      })
    })
    channel.on('broadcast', { event: 'attack' }, (msg: { payload: AttackPayload }) => {
      handlersRef.current.onAttackReceived(msg.payload.garbage, msg.payload.chain)
    })
    channel.on('broadcast', { event: 'gameover' }, (msg: { payload: { finalScore: number } }) => {
      handlersRef.current.onOpponentGameOver(msg.payload.finalScore)
    })
    channel.on('broadcast', { event: 'ready' }, (msg: { payload: ReadyPayload }) => {
      if (msg.payload.userId !== userId) {
        setOpponentJoined(true)
        setOpponent(o => o ?? {
          board: [],
          score: 0,
          chain: 0,
          gameOver: false,
          name: msg.payload.name,
          avatar: msg.payload.avatar,
        })
      }
    })

    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState() as Record<string, unknown[]>
      const keys = Object.keys(presenceState)
      const others = keys.filter(k => k !== userId)
      setOpponentJoined(others.length > 0)
    })

    channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId, name: userName, avatar: userAvatar })
        await channel.send({
          type: 'broadcast',
          event: 'ready',
          payload: { userId, name: userName, avatar: userAvatar } satisfies ReadyPayload,
        })
        setReady(true)
      }
    })

    channelRef.current = channel
    return () => {
      try { channel.unsubscribe() } catch { /* ignore */ }
      try { supabase.removeChannel(channel) } catch { /* ignore */ }
      channelRef.current = null
      setReady(false)
      setOpponentJoined(false)
      setOpponent(null)
    }
  }, [roomCode, userId, userName, userAvatar])

  const sendState = useCallback((snap: Omit<StatePayload, 'name' | 'avatar'>) => {
    const ch = channelRef.current
    if (!ch) return
    ch.send({
      type: 'broadcast',
      event: 'state',
      payload: { ...snap, name: userName, avatar: userAvatar },
    })
  }, [userName, userAvatar])

  const sendAttack = useCallback((payload: AttackPayload) => {
    const ch = channelRef.current
    if (!ch) return
    ch.send({ type: 'broadcast', event: 'attack', payload })
  }, [])

  const sendGameOver = useCallback((finalScore: number) => {
    const ch = channelRef.current
    if (!ch) return
    ch.send({ type: 'broadcast', event: 'gameover', payload: { finalScore } })
  }, [])

  const leave = useCallback(() => {
    const ch = channelRef.current
    if (!ch) return
    try { ch.unsubscribe() } catch { /* ignore */ }
    try { supabase.removeChannel(ch) } catch { /* ignore */ }
    channelRef.current = null
  }, [])

  return { ready, opponentJoined, opponent, sendState, sendAttack, sendGameOver, leave }
}
