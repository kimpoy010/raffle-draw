import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import './App.css'

const DRAW_DURATION_MS = 2500
const TICK_INTERVAL_MS = 60

function parseWorkbook(workbook, sheetName, hasHeader) {
  const sheet = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const rows = raw.filter(row => row.some(cell => String(cell).trim() !== ''))
  if (rows.length === 0) return { headers: [], dataRows: [] }
  if (hasHeader) {
    const headers = rows[0].map((h, i) => ({
      label: String(h).trim() || `Column ${i + 1}`,
      index: i,
    }))
    return { headers, dataRows: rows.slice(1) }
  } else {
    const cols = rows[0].length
    const headers = Array.from({ length: cols }, (_, i) => ({
      label: `Column ${i + 1}`,
      index: i,
    }))
    return { headers, dataRows: rows }
  }
}

export default function App() {
  const [entries, setEntries] = useState([])
  const [drawnWinners, setDrawnWinners] = useState([])
  const [currentWinner, setCurrentWinner] = useState(null)
  const [spinning, setSpinning] = useState(false)
  const [spinDisplay, setSpinDisplay] = useState('')
  const [fileName, setFileName] = useState('')
  const [columnOptions, setColumnOptions] = useState([])
  const [selectedColumn, setSelectedColumn] = useState(null)
  const [sheetNames, setSheetNames] = useState([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [hasHeader, setHasHeader] = useState(true)
  const [workbook, setWorkbook] = useState(null)
  const [dataRows, setDataRows] = useState([])
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
    setSheetNames([])
    setSelectedSheet('')
    setHasHeader(true)
    setWorkbook(null)
    setDataRows([])
    setError('')
    setDrawCount(1)
    if (fileRef.current) fileRef.current.value = ''
  }

  const applySelection = (wb, sheetName, colIndex, header) => {
    const { headers, dataRows: rows } = parseWorkbook(wb, sheetName, header)
    setColumnOptions(headers)
    setDataRows(rows)
    const names = rows
      .map(row => String(row[colIndex] ?? '').trim())
      .filter(Boolean)
    setEntries(names)
    setDrawnWinners([])
    setCurrentWinner(null)
  }

  const parseFile = (file) => {
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb = XLSX.read(data, { type: 'array', cellText: true, cellDates: true })

        if (!wb.SheetNames.length) {
          setError('No sheets found in this file.')
          return
        }

        const sheetName = wb.SheetNames[0]
        const sheet = wb.Sheets[sheetName]

        // Try both JSON approaches to find data
        const asArrays = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
        const nonEmpty = asArrays.filter(row =>
          Array.isArray(row) && row.some(cell => String(cell).trim() !== '')
        )

        console.log('[Raffle] Sheet names:', wb.SheetNames)
        console.log('[Raffle] Total rows (raw):', asArrays.length)
        console.log('[Raffle] Non-empty rows:', nonEmpty.length)
        console.log('[Raffle] First 3 rows:', nonEmpty.slice(0, 3))

        if (nonEmpty.length === 0) {
          setError(`No data found in sheet "${sheetName}". Check the browser console (F12) for debug info.`)
          return
        }

        if (nonEmpty.length === 1) {
          setError(`Only the header row was found in "${sheetName}" — no data rows below it.`)
          return
        }

        const headers = nonEmpty[0].map((h, i) => ({
          label: String(h).trim() || `Column ${i + 1}`,
          index: i,
        }))
        const rows = nonEmpty.slice(1)

        setWorkbook(wb)
        setSheetNames(wb.SheetNames)
        setSelectedSheet(sheetName)
        setHasHeader(true)
        setColumnOptions(headers)
        setDataRows(rows)
        setSelectedColumn(0)
        setFileName(file.name)
        const names = rows.map(row => String(row[0] ?? '').trim()).filter(Boolean)
        setEntries(names)
        setDrawnWinners([])
        setCurrentWinner(null)
      } catch (err) {
        console.error('[Raffle] Parse error:', err)
        setError(`Failed to read the file: ${err.message}`)
      }
    }
    reader.onerror = (err) => setError(`File read error: ${err}`)
    reader.readAsArrayBuffer(file)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSheetChange = (sheet) => {
    setSelectedSheet(sheet)
    setSelectedColumn(0)
    applySelection(workbook, sheet, 0, hasHeader)
  }

  const handleHeaderToggle = (val) => {
    setHasHeader(val)
    setSelectedColumn(0)
    applySelection(workbook, selectedSheet, 0, val)
  }

  const handleColumnChange = (colIndex) => {
    setSelectedColumn(colIndex)
    const names = dataRows.map(row => String(row[colIndex] ?? '').trim()).filter(Boolean)
    setEntries(names)
    setDrawnWinners([])
    setCurrentWinner(null)
  }

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

        {sheetNames.length > 1 && (
          <div className="column-row">
            <label htmlFor="sheet-select">Sheet:</label>
            <select
              id="sheet-select"
              value={selectedSheet}
              onChange={e => handleSheetChange(e.target.value)}
            >
              {sheetNames.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {fileName && (
          <div className="column-row">
            <label>
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={e => handleHeaderToggle(e.target.checked)}
              />
              {' '}First row is a header
            </label>
          </div>
        )}

        {columnOptions.length > 0 && (
          <div className="column-row">
            <label htmlFor="col-select">Name column:</label>
            <select
              id="col-select"
              value={selectedColumn ?? ''}
              onChange={e => handleColumnChange(Number(e.target.value))}
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
