import { useState, useRef, useEffect } from 'react'
import './OdometerDisplay.css'

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

const CELL_H = { large: 96, small: 52 }
const CELL_W = { large: 72, small: 46 }
const FONT_SIZE = { large: '58px', small: '34px' }
const SPIN_TICK_MS = 60 // how fast digits cycle while spinning

function OdometerReel({ digit, spinning, settleDelay, size }) {
  const [displayDigit, setDisplayDigit] = useState(digit)
  const [transitioning, setTransitioning] = useState(false)
  const spinRef = useRef(null)
  const settleRef = useRef(null)
  const currentDisplayRef = useRef(digit)

  useEffect(() => {
    if (spinning) {
      // Cancel any pending settle
      clearTimeout(settleRef.current)
      setTransitioning(false)

      let d = currentDisplayRef.current
      spinRef.current = setInterval(() => {
        d = (d + 1) % 10
        currentDisplayRef.current = d
        setDisplayDigit(d)
      }, SPIN_TICK_MS)
    } else {
      // Stop the spin tick
      clearInterval(spinRef.current)

      // After settleDelay, snap to the correct digit via transition
      settleRef.current = setTimeout(() => {
        setTransitioning(true)
        setDisplayDigit(digit)
        currentDisplayRef.current = digit
      }, settleDelay)
    }

    return () => {
      clearInterval(spinRef.current)
      clearTimeout(settleRef.current)
    }
  }, [spinning, digit, settleDelay])

  // When digit prop changes while not spinning (e.g. new draw result), update immediately
  useEffect(() => {
    if (!spinning) {
      setDisplayDigit(digit)
      currentDisplayRef.current = digit
    }
  }, [digit, spinning])

  const h = CELL_H[size]

  return (
    <div
      className="od-reel"
      style={{ height: h, width: CELL_W[size] }}
    >
      <div className="od-mask od-mask--top" />
      <div className="od-mask od-mask--bottom" />
      <div
        className="od-strip"
        style={{
          transform: `translateY(${-displayDigit * h}px)`,
          transition: transitioning ? `transform 0.65s cubic-bezier(0.25, 1, 0.5, 1)` : 'none',
        }}
      >
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
const SETTLE_INTERVAL_MS = 400

export default function OdometerDisplay({ value, spinning, size = 'large' }) {
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
          settleDelay={spinning ? 0 : i * SETTLE_INTERVAL_MS}
        />
      ))}
    </div>
  )
}
