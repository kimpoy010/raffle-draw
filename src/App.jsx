import { useState, useRef, useCallback } from 'react'
import readXlsxFile from 'read-excel-file/browser'
import './App.css'

const DRAW_DURATION_MS = 2500
const TICK_INTERVAL_MS = 60

export default function App() {
  const [entries, setEntries] = useState([])
  const [drawnWinners, setDrawnWinners] = useState([])
  const [currentWinner, setCurrentWinner] = useState(null)
  const [spinning, setSpinning] = useState(false)
  const [spinDisplay, setSpinDisplay] = useState('')
  const [fileName, setFileName] = useState('')
  const [columnOptions, setColumnOptions] = useState([])
  const [selectedColumn, setSelectedColumn] = useState(null)
  const [rawRows, setRawRows] = useState([])
  const [error, setError] = useState('')
  const [drawCount, setDrawCount] = useState(1)
  const fileRef = useRef(null)
  const tickRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const resetAll = () => {
    setEntries([])
    setDrawnWinners([])
    setCurrentWinner(null)
    setSpinDisplay('')
    setFileName('')
    setColumnOptions([])
    setSelectedColumn(null)
    setRawRows([])
    setError('')
    setDrawCount(1)
    if (fileRef.current) fileRef.current.value = ''
  }

  const applyColumnSelection = (rows, colIndex) => {
    const names = rows
      .slice(1)
      .map(row => String(row[colIndex] ?? '').trim())
      .filter(Boolean)
    setEntries(names)
    setDrawnWinners([])
    setCurrentWinner(null)
  }

  const parseFile = async (file) => {
    setError('')
    try {
      const rows = await readXlsxFile(file)
      if (!rows || rows.length < 2) {
        setError('The file appears to be empty or has no data rows.')
        return
      }
      const headers = rows[0].map((h, i) => ({
        label: String(h ?? `Column ${i + 1}`),
        index: i,
      }))
      setRawRows(rows)
      setColumnOptions(headers)
      setSelectedColumn(headers[0].index)
      setFileName(file.name)
      setDrawnWinners([])
      setCurrentWinner(null)
      applyColumnSelection(rows, headers[0].index)
    } catch {
      setError('Could not read the file. Please upload a valid .xlsx or .xls file.')
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) parseFile(file)
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }, [])

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)

  const pool = entries.filter(e => !drawnWinners.includes(e))

  const drawWinners = () => {
    if (spinning || pool.length === 0) return
    const count = Math.min(drawCount, pool.length)
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const winners = shuffled.slice(0, count)
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

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">🏆</span>
        <h1>Raffle Draw</h1>
      </header>

      <main className="app-main">
        {!fileName ? (
          <div
            className={`drop-zone${dragOver ? ' drag-over' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileRef.current.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && fileRef.current.click()}
          >
            <div className="drop-icon">📂</div>
            <p className="drop-title">Upload your raffle list</p>
            <p className="drop-sub">Drag & drop an Excel file here, or click to browse</p>
            <p className="drop-hint">Supports .xlsx and .xls</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="sr-only"
            />
          </div>
        ) : (
          <div className="loaded-bar">
            <span className="loaded-icon">📄</span>
            <span className="loaded-name">{fileName}</span>
            <button className="btn-ghost" onClick={resetAll}>Change file</button>
          </div>
        )}

        {error && <p className="error-msg">{error}</p>}

        {columnOptions.length > 0 && (
          <div className="column-row">
            <label htmlFor="col-select">Name column:</label>
            <select
              id="col-select"
              value={selectedColumn ?? ''}
              onChange={e => {
                const idx = Number(e.target.value)
                setSelectedColumn(idx)
                applyColumnSelection(rawRows, idx)
              }}
            >
              {columnOptions.map(opt => (
                <option key={opt.index} value={opt.index}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        {entries.length > 0 && (
          <>
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

            <div className="controls-row">
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
                {pool.length === 0
                  ? 'All entries drawn'
                  : spinning
                  ? 'Drawing…'
                  : '🎲 Draw'}
              </button>
              {drawnWinners.length > 0 && !spinning && (
                <button className="btn-ghost" onClick={resetWinners} title="Reset winners">
                  ↺ Reset
                </button>
              )}
            </div>

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
                  <button className="btn-undo" onClick={undoLastDraw}>↩ Undo</button>
                </div>
              )}
              {!spinning && !currentWinner && (
                <p className="stage-hint">Press Draw to pick a winner</p>
              )}
            </div>

            {drawnWinners.length > 0 && (
              <div className="history-section">
                <h2>Previous Winners</h2>
                <ol className="history-list">
                  {drawnWinners.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ol>
              </div>
            )}

            <div className="entries-section">
              <h2>All Entries ({entries.length})</h2>
              <div className="entries-grid">
                {entries.map((entry, i) => (
                  <span
                    key={i}
                    className={`entry-chip${drawnWinners.includes(entry) ? ' drawn' : ''}`}
                  >
                    {entry}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
