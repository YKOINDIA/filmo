'use client'

/**
 * 共通の 5 星 + 半クリック (0.5 刻み) 星評価コンポーネント。
 *
 * - 作品レビュー (WorkDetail) と人物レビュー (PersonReviewSection) で共有。
 * - 各星に「左半分 = 0.5 / 右半分 = 1.0」のクリック領域を重ねている。
 * - ホバー時のプレビュー表示あり。
 *
 * 値の型は `number | null` を許可:
 *  - 作品レビュー: 常に number を渡す (null は来ない)
 *  - 人物レビュー: 未評価を null で表現し、onClear で解除できる
 */
import { useState } from 'react'

interface Props {
  /** 現在のスコア (0.5〜5.0)。未評価は null。 */
  value: number | null
  /** 星クリック時に呼ばれる (0.5 刻みの値)。 */
  onChange?: (v: number) => void
  /**
   * 既に同じ値が入っている星を再クリックした際の解除コールバック。
   * 指定があれば「クリアできる」UI になる (人物レビュー想定)。
   * 未指定なら再クリックは onChange を再度呼ぶだけ (作品レビュー想定)。
   */
  onClear?: () => void
  /** クリック不可。表示専用。 */
  readonly?: boolean
  /** 1 星の幅 / 高さ / フォントサイズ (px)。デフォルト 20。 */
  size?: number
  /** 右側に数値ラベルを表示する。 */
  showValue?: boolean
}

export default function StarRating({
  value, onChange, onClear, readonly = false, size = 20, showValue = false,
}: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value ?? 0
  const interactive = !readonly && (!!onChange || !!onClear)

  const handleClick = (target: number) => {
    if (readonly) return
    if (value === target && onClear) {
      onClear()
      return
    }
    onChange?.(target)
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span
        style={{ display: 'inline-flex', gap: 2, cursor: interactive ? 'pointer' : 'default' }}
        onMouseLeave={() => interactive && setHover(null)}
      >
        {[1, 2, 3, 4, 5].map(star => {
          const full = display >= star
          const half = !full && display >= star - 0.5
          return (
            <span
              key={star}
              style={{ position: 'relative', width: size, height: size, fontSize: size, lineHeight: 1 }}
            >
              {/* 背景 (グレーの星) */}
              <span style={{ position: 'absolute', inset: 0, color: 'var(--fm-text-muted)' }}>★</span>
              {/* 塗り (full or half) */}
              {(full || half) && (
                <span style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: full ? '100%' : '50%', overflow: 'hidden',
                  color: 'var(--fm-star)',
                }}>★</span>
              )}
              {/* インタラクティブな場合のクリック領域 (左半分 = 0.5刻み / 右半分 = 1刻み) */}
              {interactive && (
                <>
                  <span
                    style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', zIndex: 2 }}
                    onMouseEnter={() => setHover(star - 0.5)}
                    onClick={() => handleClick(star - 0.5)}
                    role="button"
                    aria-label={`${star - 0.5}星`}
                  />
                  <span
                    style={{ position: 'absolute', left: '50%', top: 0, width: '50%', height: '100%', zIndex: 2 }}
                    onMouseEnter={() => setHover(star)}
                    onClick={() => handleClick(star)}
                    role="button"
                    aria-label={`${star}星`}
                  />
                </>
              )}
            </span>
          )
        })}
      </span>
      {showValue && (
        <span style={{ fontSize: 12, color: 'var(--fm-text-muted)', marginLeft: 10 }}>
          {value != null ? value.toFixed(1) : '---'}
        </span>
      )}
    </span>
  )
}
