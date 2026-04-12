'use client'

export default function Toast({ message }: { message: string }) {
  return (
    <div className="animate-slide-up" style={{
      position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, padding: '12px 24px', borderRadius: 12,
      background: 'var(--fm-bg-card)', border: '1px solid var(--fm-accent)',
      color: 'var(--fm-text)', fontSize: 14, fontWeight: 600,
      boxShadow: '0 8px 30px rgba(0,0,0,0.4)', maxWidth: '90vw',
      textAlign: 'center', whiteSpace: 'nowrap',
    }}>
      {message}
    </div>
  )
}
