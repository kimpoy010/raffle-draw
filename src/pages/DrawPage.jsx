import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { subscribeRaffle } from '../lib/raffle.js'
import OdometerDisplay from '../components/OdometerDisplay.jsx'
import FallingBalloons from '../components/FallingBalloons.jsx'
import './DrawPage.css'

const DRAW_DURATION_MS = 2500
const TICK_INTERVAL_MS = 60

function launchCelebration() {
  // Cannon burst from both sides
  const left  = confetti.create(null, { resize: true, useWorker: true })
  const right = confetti.create(null, { resize: true, useWorker: true })

  const shared = {
    particleCount: 120,
    spread: 70,
    startVelocity: 55,
    gravity: 0.7,
    ticks: 600,
    colors: ['#a855f7','#ec4899','#f59e0b','#10b981','#3b82f6','#fff'],
  }

  // Party popper — left cannon
  left(null, { ...shared, angle: 60,  origin: { x: 0, y: 0.75 } })
  // Party popper — right cannon
  right(null, { ...shared, angle: 120, origin: { x: 1, y: 0.75 } })

  // Sustained rain from the top for 6 seconds
  const end = Date.now() + 6000
  const rain = () => {
    confetti({
      particleCount: 6,
      angle: 270,
      spread: 120,
      origin: { x: Math.random(), y: -0.1 },
      gravity: 0.8,
      ticks: 500,
      colors: ['#a855f7','#ec4899','#f59e0b','#10b981','#3b82f6','#fff','#fd8'],
    })
    if (Date.now() < end) requestAnimationFrame(rain)
  }
  requestAnimationFrame(rain)
}

export default function DrawPage() {
  const navigate = useNavigate()

  const [entries, setEntries]           = useState([])
  const [drawnWinners, setDrawnWinners] = useState([])
  const [currentWinners, setCurrentWinners] = useState([])
  const [spinning, setSpinning]         = useState(false)
  const [spinDisplay, setSpinDisplay]   = useState('')
  const [connected, setConnected]       = useState(false)
  const [celebrating, setCelebrating]   = useState(false)

  const tickRef         = useRef(null)
  const lastStartRef    = useRef(0)
  const entriesRef      = useRef([])
  const initialLoadRef  = useRef(true)
  const celebrateRef    = useRef(null)  // called by OdometerDisplay when last digit settles

  // Dev helper: call testCelebration() in the browser console to preview the animation
  useEffect(() => {
    window.testCelebration = () => celebrateRef.current?.()
    return () => { delete window.testCelebration }
  }, [])

  useEffect(() => {
    const unsub = subscribeRaffle((data) => {
      setConnected(true)
      if (!data) { initialLoadRef.current = false; return }

      const config     = data.config ?? {}
      const newEntries = config.entries ?? []
      setEntries(newEntries)
      entriesRef.current = newEntries

      const drawn = data.drawnWinners ?? []
      setDrawnWinners(Array.isArray(drawn) ? drawn : Object.values(drawn))

      // Ignore whatever draw state exists when the page first loads
      if (initialLoadRef.current) {
        initialLoadRef.current = false
        if (data.draw) lastStartRef.current = data.draw.startedAt ?? 0
        return
      }

      const draw = data.draw
      if (!draw || draw.state === 'idle') return
      if (draw.state === 'spinning' && draw.startedAt !== lastStartRef.current) {
        lastStartRef.current = draw.startedAt
        const elapsed   = Date.now() - draw.startedAt
        const remaining = Math.max(0, DRAW_DURATION_MS - elapsed)
        startLocalSpin(draw.winners, remaining)
      }
    })
    return () => { unsub(); clearInterval(tickRef.current) }
  }, [])

  const triggerCelebration = () => {
    setCelebrating(true)
    launchCelebration()
    setTimeout(() => setCelebrating(false), 10000)
  }

  celebrateRef.current = triggerCelebration

  const startLocalSpin = (winners, duration) => {
    clearInterval(tickRef.current)
    setSpinning(true)
    setCelebrating(false)
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
        // For non-numeric (text) raffles, celebrate after the pop-in animation
        const isNum = entriesRef.current.every(e => /^\d+$/.test(e.trim()))
        if (!isNum) {
          setTimeout(triggerCelebration, 600)
        }
        // For numeric raffles, OdometerDisplay calls celebrateRef when the last digit lands
      }
    }, TICK_INTERVAL_MS)
  }

  const pool = entries.filter(e => !drawnWinners.includes(e))

  const isNumeric = useMemo(
    () => entries.length > 0 && entries.every(e => /^\d+$/.test(e.trim())),
    [entries]
  )

  const hasWinner = currentWinners.length > 0 && !spinning

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

        {/* Celebration overlays */}
        {celebrating && (
          <>
            <FallingBalloons />
            <div className="popper popper-left">🎉</div>
            <div className="popper popper-right">🎉</div>
          </>
        )}

        {/* Draw stage */}
        <main className="draw-stage">

          <div className={`winner-stage${spinning ? ' is-spinning' : ''}${hasWinner ? ' has-winner' : ''}`}>

            {/* Numeric raffle: odometer */}
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
                  onSettled={() => celebrateRef.current?.()}
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

            {/* Text raffle */}
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

            {/* Idle */}
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
