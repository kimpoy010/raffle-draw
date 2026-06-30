import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadConfig } from '../lib/store.js'
import './DrawPage.css'

const DRAW_DURATION_MS = 2500
const TICK_INTERVAL_MS = 60

export default function DrawPage() {
  const navigate = useNavigate()
  const config = loadConfig()

  const [entries] = useState(config?.entries ?? [])
  const [forcedWinner] = useState(config?.forcedWinner ?? '')
  const [drawnWinners, setDrawnWinners] = useState([])
  const [currentWinner, setCurrentWinner] = useState(null)
  const [spinning, setSpinning] = useState(false)
  const [spinDisplay, setSpinDisplay] = useState('')
  const [drawCount, setDrawCount] = useState(1)
  const tickRef = useRef(null)

  useEffect(() => () => clearInterval(tickRef.current), [])

  const pool = entries.filter(e => !drawnWinners.includes(e))

  const drawWinners = () => {
    if (spinning || pool.length === 0) return
    const count = Math.min(drawCount, pool.length)

    let winners
    if (forcedWinner && pool.includes(forcedWinner) && count === 1) {
      winners = [forcedWinner]
    } else {
      winners = [...pool].sort(() => Math.random() - 0.5).slice(0, count)
    }

    setSpinning(true)
    setCurrentWinner(null)

    let tick = 0
    const totalTicks = Math.floor(DRAW_DURATION_MS / TICK_INTERVAL_MS)

    tickRef.current = setInterval(() => {
      setSpinDisplay(pool[Math.floor(Math.random() * pool.length)])
      tick++
      if (tick >= totalTicks) {
        clearInterval(tickRef.current)
        setSpinDisplay('')
        setSpinning(false)
        setCurrentWinner(winners)
        setDrawnWinners(prev => [...prev, ...winners])
      }
    }, TICK_INTERVAL_MS)
  }

  const undoLastDraw = () => {
    if (spinning || !currentWinner) return
    setDrawnWinners(prev => prev.filter(w => !currentWinner.includes(w)))
    setCurrentWinner(null)
  }

  const resetWinners = () => {
    setDrawnWinners([])
    setCurrentWinner(null)
  }

  if (!entries.length) {
    return (
      <div className="draw-empty">
        <p className="empty-icon">🎟️</p>
        <p className="empty-title">No raffle list loaded</p>
        <p className="empty-sub">Go to Admin to upload your Excel file.</p>
        <button className="btn-draw" onClick={() => navigate('/admin')}>Go to Admin →</button>
      </div>
    )
  }

  return (
    <div className="draw-layout">
      <header className="draw-header">
        <div className="draw-header-left">
          <span className="draw-logo">🏆</span>
          <h1>Raffle Draw</h1>
        </div>
        <button className="btn-ghost" onClick={() => navigate('/admin')}>⚙️ Admin</button>
      </header>

      <div className="draw-body">

        {/* Left: entries sidebar */}
        <aside className="entries-sidebar">
          <h2>Entries <span className="sidebar-count">{entries.length}</span></h2>
          <div className="entries-scroll">
            {entries.map((entry, i) => (
              <div
                key={i}
                className={`sidebar-entry${drawnWinners.includes(entry) ? ' drawn' : ''}`}
              >
                {entry}
              </div>
            ))}
          </div>
        </aside>

        {/* Right: draw stage */}
        <main className="draw-stage">

          {/* Winner stage */}
          <div className={`winner-stage${spinning ? ' is-spinning' : ''}${currentWinner ? ' has-winner' : ''}`}>
            {spinning && (
              <div className="spin-box">
                <p className="spin-label">Drawing…</p>
                <p className="spin-name">{spinDisplay}</p>
              </div>
            )}
            {!spinning && currentWinner && (
              <div className="winner-box">
                <p className="winner-label">
                  {currentWinner.length === 1 ? '🎉 Winner!' : '🎉 Winners!'}
                </p>
                {currentWinner.map((w, i) => (
                  <p key={i} className="winner-name">{w}</p>
                ))}
              </div>
            )}
            {!spinning && !currentWinner && (
              <p className="stage-hint">Press Draw to pick a winner</p>
            )}
          </div>

          {/* Controls */}
          <div className="draw-controls">
            <div className="count-group">
              <label htmlFor="draw-count">Winners:</label>
              <input
                id="draw-count"
                type="number"
                min={1}
                max={pool.length || 1}
                value={drawCount}
                onChange={e => setDrawCount(Math.max(1, Math.min(pool.length, Number(e.target.value))))}
                className="count-input"
                disabled={spinning}
              />
            </div>
            <button
              className="btn-draw"
              onClick={drawWinners}
              disabled={spinning || pool.length === 0}
            >
              {pool.length === 0 ? 'All entries drawn' : spinning ? 'Drawing…' : '🎲 Draw'}
            </button>
            {currentWinner && !spinning && (
              <button className="btn-ghost" onClick={undoLastDraw}>↩ Undo</button>
            )}
            {drawnWinners.length > 0 && !spinning && (
              <button className="btn-ghost" onClick={resetWinners}>↺ Reset</button>
            )}
          </div>

          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-num">{entries.length}</span>
              <span className="stat-label">Total</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{pool.length}</span>
              <span className="stat-label">Remaining</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{drawnWinners.length}</span>
              <span className="stat-label">Drawn</span>
            </div>
          </div>

          {/* Previous winners */}
          {drawnWinners.length > 0 && (
            <div className="history-card">
              <h2>Previous Winners</h2>
              <ol className="history-list">
                {drawnWinners.map((w, i) => <li key={i}>{w}</li>)}
              </ol>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
