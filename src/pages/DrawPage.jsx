import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { subscribeRaffle } from '../lib/raffle.js'
import OdometerDisplay from '../components/OdometerDisplay.jsx'
import './DrawPage.css'

const DRAW_DURATION_MS = 2500
const TICK_INTERVAL_MS = 60

export default function DrawPage() {
  const navigate = useNavigate()

  const [entries, setEntries] = useState([])
  const [drawnWinners, setDrawnWinners] = useState([])
  const [currentWinners, setCurrentWinners] = useState([])
  const [spinning, setSpinning] = useState(false)
  const [spinDisplay, setSpinDisplay] = useState('')
  const [connected, setConnected] = useState(false)

  const tickRef = useRef(null)
  const lastStartRef = useRef(0)
  const entriesRef = useRef([])

  useEffect(() => {
    const unsub = subscribeRaffle((data) => {
      setConnected(true)
      if (!data) return

      const config = data.config ?? {}
      const newEntries = config.entries ?? []
      setEntries(newEntries)
      entriesRef.current = newEntries

      const drawn = data.drawnWinners ?? []
      setDrawnWinners(Array.isArray(drawn) ? drawn : Object.values(drawn))

      const draw = data.draw
      if (!draw || draw.state === 'idle') return
      if (draw.state === 'spinning' && draw.startedAt !== lastStartRef.current) {
        lastStartRef.current = draw.startedAt
        const elapsed = Date.now() - draw.startedAt
        const remaining = Math.max(0, DRAW_DURATION_MS - elapsed)
        startLocalSpin(draw.winners, remaining)
      }
    })
    return () => { unsub(); clearInterval(tickRef.current) }
  }, [])

  const startLocalSpin = (winners, duration) => {
    clearInterval(tickRef.current)
    setSpinning(true)
    setCurrentWinners([])
    const totalTicks = Math.max(1, Math.floor(duration / TICK_INTERVAL_MS))
    let tick = 0
    tickRef.current = setInterval(() => {
      const pool = entriesRef.current
      setSpinDisplay(pool[Math.floor(Math.random() * pool.length)] ?? '…')
      tick++
      if (tick >= totalTicks) {
        clearInterval(tickRef.current)
        setSpinDisplay('')
        setSpinning(false)
        setCurrentWinners(winners)
      }
    }, TICK_INTERVAL_MS)
  }

  const pool = entries.filter(e => !drawnWinners.includes(e))

  // Detect numeric range raffle
  const isNumeric = useMemo(
    () => entries.length > 0 && entries.every(e => /^\d+$/.test(e.trim())),
    [entries]
  )

  return (
    <div className="draw-layout">
      <header className="draw-header">
        <div className="draw-header-left">
          <span className="draw-logo">🏆</span>
          <h1>Raffle Draw</h1>
        </div>
        <div className="header-right">
          <span className={`live-dot${connected ? ' live' : ''}`} title={connected ? 'Connected' : 'Connecting…'} />
        </div>
      </header>

      <div className="draw-body">

        {/* Draw stage */}
        <main className="draw-stage">

          <div className={`winner-stage${spinning ? ' is-spinning' : ''}${currentWinners.length && !spinning ? ' has-winner' : ''}`}>
            {/* Numeric raffle: odometer display */}
            {isNumeric && (spinning || currentWinners.length > 0) && (
              <div className="odometer-stage">
                {spinning && <p className="spin-label">Drawing…</p>}
                {!spinning && currentWinners.length > 0 && (
                  <p className="winner-label">
                    {currentWinners.length === 1 ? '🎉 Winner!' : '🎉 Winners!'}
                  </p>
                )}
                <OdometerDisplay
                  value={spinning ? (spinDisplay || entries[0]) : currentWinners[0]}
                  spinning={spinning}
                  size="large"
                />
                {!spinning && currentWinners.length > 1 && (
                  <div className="extra-winners">
                    {currentWinners.slice(1).map((w, i) => (
                      <p key={i} className="winner-name">{w}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Text raffle: standard display */}
            {!isNumeric && spinning && (
              <div className="spin-box">
                <p className="spin-label">Drawing…</p>
                <p className="spin-name">{spinDisplay}</p>
              </div>
            )}
            {!isNumeric && !spinning && currentWinners.length > 0 && (
              <div className="winner-box">
                <p className="winner-label">{currentWinners.length === 1 ? '🎉 Winner!' : '🎉 Winners!'}</p>
                {currentWinners.map((w, i) => <p key={i} className="winner-name">{w}</p>)}
              </div>
            )}

            {/* Idle state */}
            {!spinning && currentWinners.length === 0 && (
              <p className="stage-hint">
                {entries.length === 0
                  ? 'Waiting for admin to set up the raffle…'
                  : pool.length === 0
                  ? 'All entries have been drawn!'
                  : 'Waiting for the draw…'}
              </p>
            )}
          </div>

        </main>
      </div>
    </div>
  )
}
