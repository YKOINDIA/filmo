'use client'

export default function Toast({ message }: { message: string }) {
  // 失敗系メッセージは赤系で目立たせる
  const isError = /失敗|エラー|error/i.test(message)

  return (
    <div className="animate-slide-up" style={{
      // 画面上部に表示 (モーダルの操作系がボトムにある場合に隠れない)
      position: 'fixed',
      top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
      left: '50%',
      transform: 'translateX(-50%)',
      // 既存モーダルや bottom nav より高い z-index で必ず最前面
      zIndex: 100000,
      padding: '14px 24px',
      borderRadius: 12,
      background: isError ? '#3a0d12' : 'var(--fm-bg-card)',
      border: `2px solid ${isError ? '#ef4444' : 'var(--fm-accent)'}`,
      color: isError ? '#ffd1d1' : 'var(--fm-text)',
      fontSize: 14,
      fontWeight: 700,
      boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
      maxWidth: '92vw',
      // width: max-content にすることで absolute 要素の shrink-to-fit が
      // word-break: break-word と組み合わさったときに不自然な位置で改行する
      // iOS Safari の挙動を回避する (例: 「お問い合わせを送信し / ました」のような中途半端な折返し)
      width: 'max-content',
      textAlign: 'center',
      // 短文は1行で表示、長文は単語境界で折り返し (anywhere ではなく word で)
      whiteSpace: 'normal',
      overflowWrap: 'break-word',
      wordBreak: 'normal',
      lineHeight: 1.5,
      pointerEvents: 'none',
    }}>
      {message}
    </div>
  )
}
