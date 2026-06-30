import { useRef, useEffect } from 'react'
import './OdometerDisplay.css'

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

const CELL_H      = { large: 96,    small: 52    }
const CELL_W      = { large: 72,    small: 46    }
const FONT_SIZE   = { large: '58px', small: '34px' }
const SPIN_DUR    = { large: '0.4s', small: '0.28s' }
const ANIM_NAME   = { large: 'od-roll-lg', small: 'od-roll-sm' }

// Deceleration: start fast, end slow (quadratic ease on delay)
const DECEL_START_MS  = 65
const DECEL_END_MS    = 320
const MIN_DECEL_STEPS = 10

function decelDelays(fromDigit, toDigit) {
  let steps = ((toDigit - fromDigit) + 10) % 10
  if (steps === 0) steps = 10
  while (steps < MIN_DECEL_STEPS) steps += 10
  return Array.from({ length: steps }, (_, i) => {
    const t = steps > 1 ? i / (steps - 1) : 1
    return Math.round(DECEL_START_MS + (DECEL_END_MS - DECEL_START_MS) * t * t)
  })
}

function OdometerReel({ digit, spinning, settleDelay, size }) {
  const stripRef     = useRef(null)
  const readyRef     = useRef(false)
  const settleTimer  = useRef(null)
  const decelTimers  = useRef([])

  function clearDecel() {
    clearTimeout(settleTimer.current)
    decelTimers.current.forEach(clearTimeout)
    decelTimers.current = []
  }

  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const h = CELL_H[size]

    // Very first mount: place at the correct digit, no animation
    if (!readyRef.current) {
      readyRef.current = true
      el.style.animation  = 'none'
      el.style.transition = 'none'
      el.style.transform  = `translateY(${-digit * h}px)`
      return
    }

    clearDecel()

    if (spinning) {
      // Kick off CSS animation — seamless infinite upward roll
      el.style.transition = 'none'
      el.style.transform  = ''
      el.style.animation  = `${ANIM_NAME[size]} ${SPIN_DUR[size]} linear infinite`
      return
    }

    // Not spinning: wait settleDelay, then decelerate this reel
    settleTimer.current = setTimeout(() => {
      // --- Read CSS animation position & quantize to nearest digit ---
      const matrix   = new DOMMatrix(getComputedStyle(el).transform)
      const currentY = matrix.m42                             // negative offset
      const totalH   = 10 * h
      const pos      = ((-currentY) % totalH + totalH) % totalH  // 0‥totalH
      const snapDigit = Math.round(pos / h) % 10

      // Freeze at that clean digit boundary (no between-digit flash)
      el.style.animation  = 'none'
      el.style.transition = 'none'
      el.style.transform  = `translateY(${-snapDigit * h}px)`
      void el.offsetHeight  // force reflow

      // Schedule deceleration ticks (increasing delays = slows down)
      const delays = decelDelays(snapDigit, digit)
      let cumulative = 0
      let d = snapDigit
      delays.forEach(delay => {
        cumulative += delay
        const t = setTimeout(() => {
          d = (d + 1) % 10
          el.style.transform = `translateY(${-d * h}px)`
        }, cumulative)
        decelTimers.current.push(t)
      })
    }, settleDelay)

    return clearDecel
  }, [spinning, digit, settleDelay, size])

  const h = CELL_H[size]
  return (
    <div className="od-reel" style={{ height: h, width: CELL_W[size] }}>
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

const FIXED_BOXES        = 6
const SETTLE_INTERVAL_MS = 500   // gap between each reel starting to slow down

export default function OdometerDisplay({ value, spinning, size = 'large' }) {
  const str    = String(value ?? '0').padStart(FIXED_BOXES, '0')
  const digits = str.slice(-FIXED_BOXES).split('').map(Number)
  const gap    = size === 'small' ? 4 : 6

  return (
    <div className="odometer" style={{ gap }}>
      {digits.map((d, i) => (
        <OdometerReel
          key={i}
          digit={d}
          spinning={spinning}
          size={size}
          settleDelay={spinning ? 0 : i * SETTLE_INTERVAL_MS}
        />
      ))}
    </div>
  )
}
