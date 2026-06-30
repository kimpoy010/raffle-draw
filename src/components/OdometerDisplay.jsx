import { useEffect, useRef } from 'react'
import './OdometerDisplay.css'

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

// Large cell: 96px tall, small cell: 52px tall
const CELL_H = { large: 96, small: 52 }
const CELL_W = { large: 72, small: 46 }
const FONT_SIZE = { large: '58px', small: '34px' }
const SPIN_DURATION = { large: '0.38s', small: '0.26s' }
const ANIM_NAME = { large: 'od-roll-lg', small: 'od-roll-sm' }

function OdometerReel({ digit, spinning, settleDelay, size }) {
  const stripRef = useRef(null)
  const ready = useRef(false)

  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const h = CELL_H[size]

    if (!ready.current) {
      ready.current = true
      // Initial: snap to position without any animation
      el.style.transition = 'none'
      el.style.animation = 'none'
      el.style.transform = `translateY(${-digit * h}px)`
      return
    }

    if (spinning) {
      // Always-upward CSS animation
      el.style.transition = 'none'
      el.style.transform = ''
      el.style.animation = `${ANIM_NAME[size]} ${SPIN_DURATION[size]} linear infinite`
    } else {
      // Read where the running animation left the strip
      const matrix = new DOMMatrix(getComputedStyle(el).transform)
      const currentY = matrix.m42

      // Freeze at current position (no jump)
      el.style.animation = 'none'
      el.style.transition = 'none'
      el.style.transform = `translateY(${currentY}px)`

      // Force reflow so browser registers the frozen position
      void el.offsetHeight

      // Ease into the winning digit
      el.style.transition = `transform 0.65s cubic-bezier(0.25, 1, 0.5, 1) ${settleDelay}ms`
      el.style.transform = `translateY(${-digit * h}px)`
    }
  }, [spinning, digit, size, settleDelay])

  const h = CELL_H[size]
  return (
    <div
      className="od-reel"
      style={{ height: h, width: CELL_W[size] }}
    >
      <div className="od-mask od-mask--top" />
      <div className="od-mask od-mask--bottom" />
      <div ref={stripRef} className="od-strip">
        {DIGITS.map(d => (
          <span
            key={d}
            className="od-digit"
            style={{ height: h, lineHeight: `${h}px`, fontSize: FONT_SIZE[size] }}
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  )
}

const FIXED_BOXES = 6
const SETTLE_INTERVAL_MS = 400 // gap between each box settling

export default function OdometerDisplay({ value, spinning, size = 'large' }) {
  // Always 6 boxes, padded with leading zeros
  const str = String(value ?? '0').padStart(FIXED_BOXES, '0')
  const digits = str.slice(-FIXED_BOXES).split('').map(Number)
  const gap = size === 'small' ? 4 : 6

  return (
    <div className="odometer" style={{ gap }}>
      {digits.map((d, i) => (
        <OdometerReel
          key={i}
          digit={d}
          spinning={spinning}
          size={size}
          // Left-to-right reveal: first box stops first, last box stops last
          settleDelay={spinning ? 0 : i * SETTLE_INTERVAL_MS}
        />
      ))}
    </div>
  )
}
