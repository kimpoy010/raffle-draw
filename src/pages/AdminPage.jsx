import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import {
  saveRaffleConfig, triggerDraw, addDrawnWinners,
  removeDrawnWinners, resetDrawnWinners, setDrawIdle, subscribeRaffle,
} from '../lib/raffle.js'
import './AdminPage.css'

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN ?? '1234'
const DRAW_DURATION_MS = 2500
const TICK_INTERVAL_MS = 60

function parseSheet(wb, sheetName) {
  const sheet = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
  return rows.filter(row => Array.isArray(row) && row.some(c => String(c).trim() !== ''))
}

export default function AdminPage() {
  const navigate = useNavigate()

  // PIN gate
  const [pinInput, setPinInput] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [pinError, setPinError] = useState(false)

  // File / entries state
  const [fileName, setFileName] = useState('')
  const [sheetNames, setSheetNames] = useState([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [columnOptions, setColumnOptions] = useState([])
  const [selectedColumn, setSelectedColumn] = useState(0)
  const [entries, setEntries] = useState([])
  const [forcedWinner, setForcedWinner] = useState('')
  const [workbookData, setWorkbookData] = useState(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [search, setSearch] = useState('')
  const fileRef = useRef(null)

  // Live raffle state from Firebase
  const [drawnWinners, setDrawnWinners] = useState([])
  const [drawState, setDrawState] = useState('idle')
  const [currentWinners, setCurrentWinners] = useState([])
  const [spinning, setSpinning] = useState(false)
  const [spinDisplay, setSpinDisplay] = useState('')
  const tickRef = useRef(null)
  const lastStartRef = useRef(0)

  // Saving state
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Subscribe to Firebase on mount
  useEffect(() => {
    if (!unlocked) return
    const unsub = subscribeRaffle((data) => {
      if (!data) return
      const drawn = data.drawnWinners ?? []
      setDrawnWinners(Array.isArray(drawn) ? drawn : Object.values(drawn))

      if (data.config) {
        setEntries(prev => prev.length ? prev : (data.config.entries ?? []))
        setForcedWinner(prev => prev || (data.config.forcedWinner ?? ''))
      }

      const draw = data.draw
      if (!draw || draw.state === 'idle') return

      if (draw.state === 'spinning' && draw.startedAt !== lastStartRef.current) {
        lastStartRef.current = draw.startedAt
        const elapsed = Date.now() - draw.startedAt
        const remaining = Math.max(0, DRAW_DURATION_MS - elapsed)
        startLocalSpin(draw.winners, remaining)
      }
    })
    return unsub
  }, [unlocked])

  useEffect(() => () => clearInterval(tickRef.current), [])

  const startLocalSpin = (winners, duration) => {
    clearInterval(tickRef.current)
    setSpinning(true)
    setCurrentWinners([])
    const totalTicks = Math.max(1, Math.floor(duration / TICK_INTERVAL_MS))
    let tick = 0
    tickRef.current = setInterval(() => {
      setSpinDisplay(entries[Math.floor(Math.random() * entries.length)] ?? '…')
      tick++
      if (tick >= totalTicks) {
        clearInterval(tickRef.current)
        setSpinDisplay('')
        setSpinning(false)
        setCurrentWinners(winners)
      }
    }, TICK_INTERVAL_MS)
  }

  // PIN submit
  const handlePin = (e) => {
    e.preventDefault()
    if (pinInput === ADMIN_PIN) { setUnlocked(true); setPinError(false) }
    else { setPinError(true) }
  }

  // File parsing
  const applyColumn = (wb, sheet, colIndex) => {
    const rows = parseSheet(wb, sheet)
    const names = rows.slice(1).map(r => String(r[colIndex] ?? '').trim()).filter(Boolean)
    setEntries(names)
    setForcedWinner('')
    setSaved(false)
    return names
  }

  const readFile = (file) => {
    setError('')
    setSaved(false)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellText: true, cellDates: true })
        if (!wb.SheetNames.length) { setError('No sheets found.'); return }
        const sheet = wb.SheetNames[0]
        const rows = parseSheet(wb, sheet)
        console.log('[Admin] Sheets:', wb.SheetNames, '| Rows:', rows.length, '| Sample:', rows.slice(0, 2))
        if (rows.length < 2) { setError(`Sheet "${sheet}" has no data rows. Check console (F12) for details.`); return }
        const cols = rows[0].map((h, i) => ({ label: String(h).trim() || `Column ${i + 1}`, index: i }))
        const names = rows.slice(1).map(r => String(r[0] ?? '').trim()).filter(Boolean)
        setWorkbookData(wb); setSheetNames(wb.SheetNames); setSelectedSheet(sheet)
        setColumnOptions(cols); setSelectedColumn(0); setEntries(names)
        setFileName(file.name); setForcedWinner('')
      } catch (err) {
        console.error('[Admin] Parse error:', err)
        setError(`Failed to read file: ${err.message}`)
      }
    }
    reader.onerror = () => setError('Could not read the file.')
    reader.readAsArrayBuffer(file)
  }

  const handleFileChange = (e) => { if (e.target.files[0]) readFile(e.target.files[0]) }
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0])
  }, [])

  const handleSheetChange = (sheet) => {
    setSelectedSheet(sheet); setSelectedColumn(0)
    if (workbookData) applyColumn(workbookData, sheet, 0)
  }

  const handleColumnChange = (idx) => {
    setSelectedColumn(idx)
    if (workbookData) applyColumn(workbookData, selectedSheet, idx)
  }

  const handleSave = async () => {
    if (!entries.length) { setError('No entries to save.'); return }
    setSaving(true)
    try {
      await saveRaffleConfig({ entries, forcedWinner })
      await resetDrawnWinners()
      await setDrawIdle()
      setSaved(true)
    } catch (err) {
      setError(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const pool = entries.filter(e => !drawnWinners.includes(e))

  const handleDraw = async () => {
    if (spinning || pool.length === 0) return
    const winners = forcedWinner && pool.includes(forcedWinner)
      ? [forcedWinner]
      : [pool[Math.floor(Math.random() * pool.length)]]
    try {
      await triggerDraw(winners)
      // Add to the drawn list only after the animation finishes so the
      // winner doesn't appear in Previous Winners before the reveal.
      setTimeout(() => addDrawnWinners(winners), DRAW_DURATION_MS + 3000)
    } catch (err) {
      setError(`Draw failed: ${err.message}`)
    }
  }

  const handleUndo = async () => {
    if (!currentWinners.length) return
    try {
      await removeDrawnWinners(currentWinners)
      await setDrawIdle()
      setCurrentWinners([])
    } catch (err) {
      setError(`Undo failed: ${err.message}`)
    }
  }

  const handleReset = async () => {
    try {
      await resetDrawnWinners()
      await setDrawIdle()
      setCurrentWinners([])
    } catch (err) {
      setError(`Reset failed: ${err.message}`)
    }
  }

  const filteredEntries = entries.filter(e => e.toLowerCase().includes(search.toLowerCase()))

  // PIN screen
  if (!unlocked) {
    return (
      <div className="pin-screen">
        <div className="pin-card">
          <span className="pin-icon">🔒</span>
          <h1>Admin Access</h1>
          <form onSubmit={handlePin}>
            <input
              type="password"
              className={`pin-input${pinError ? ' pin-error' : ''}`}
              placeholder="Enter PIN"
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(false) }}
              autoFocus
            />
            {pinError && <p className="pin-err-msg">Incorrect PIN</p>}
            <button type="submit" className="btn-save">Unlock</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-left">
          <span className="admin-logo">⚙️</span>
          <h1>Admin</h1>
        </div>
        <button className="btn-ghost" onClick={() => navigate('/')}>← Back to Draw</button>
      </header>

      <main className="admin-main">

        {/* Upload */}
        <section className="admin-card">
          <h2>1. Upload Excel File</h2>
          {!fileName ? (
            <div
              className={`drop-zone${dragOver ? ' drag-over' : ''}`}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current.click()}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && fileRef.current.click()}
            >
              <div className="drop-icon">📂</div>
              <p className="drop-title">Drag & drop or click to upload</p>
              <p className="drop-hint">Supports .xlsx and .xls</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="sr-only" />
            </div>
          ) : (
            <div className="loaded-bar">
              <span>📄</span>
              <span className="loaded-name">{fileName}</span>
              <button className="btn-ghost" onClick={() => { setFileName(''); setEntries([]); setWorkbookData(null) }}>Change</button>
            </div>
          )}
          {error && <p className="error-msg">{error}</p>}
        </section>

        {/* Configure */}
        {entries.length > 0 && (
          <section className="admin-card">
            <h2>2. Configure</h2>
            <div className="config-grid">
              {sheetNames.length > 1 && (
                <div className="config-row">
                  <label>Sheet</label>
                  <select value={selectedSheet} onChange={e => handleSheetChange(e.target.value)}>
                    {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div className="config-row">
                <label>Name column</label>
                <select value={selectedColumn} onChange={e => handleColumnChange(Number(e.target.value))}>
                  {columnOptions.map(o => <option key={o.index} value={o.index}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <p className="entry-count">{entries.length} entries loaded</p>
            <button className="btn-save" onClick={handleSave} disabled={saving || saved} style={{ marginTop: 16 }}>
              {saving ? 'Saving…' : saved ? '✓ Saved to Firebase' : '☁️ Save Entries to Firebase'}
            </button>
          </section>
        )}

        {/* Pre-select winner */}
        {saved && entries.length > 0 && (
          <section className="admin-card">
            <h2>3. Pre-select Winner <span className="optional-tag">optional</span></h2>
            <p className="section-sub">Choose a specific entry that will be drawn, or leave blank for random.</p>
            <div className="config-row">
              <label>Winner</label>
              <select value={forcedWinner} onChange={e => setForcedWinner(e.target.value)}>
                <option value="">— Random —</option>
                {pool.map((e, i) => <option key={i} value={e}>{e}</option>)}
              </select>
            </div>
            {forcedWinner && (
              <p className="forced-notice">🎯 <strong>{forcedWinner}</strong> will be drawn.</p>
            )}
          </section>
        )}

        {/* Draw control */}
        {saved && entries.length > 0 && (
          <section className="admin-card">
            <h2>4. Control Draw</h2>

            <div className={`mini-stage${spinning ? ' is-spinning' : ''}${currentWinners.length && !spinning ? ' has-winner' : ''}`}>
              {spinning && <p className="spin-name">{spinDisplay}</p>}
              {!spinning && currentWinners.length > 0 && (
                <>
                  <p className="winner-label">🎉 {currentWinners.length === 1 ? 'Winner' : 'Winners'}!</p>
                  {currentWinners.map((w, i) => <p key={i} className="winner-name">{w}</p>)}
                </>
              )}
              {!spinning && !currentWinners.length && (
                <p className="stage-hint">Press Draw to begin</p>
              )}
            </div>

            <div className="draw-controls-row">
              <button className="btn-draw" onClick={handleDraw} disabled={spinning || pool.length === 0}>
                {pool.length === 0 ? 'All drawn' : spinning ? 'Drawing…' : '🎲 Draw'}
              </button>
              {currentWinners.length > 0 && !spinning && (
                <button className="btn-ghost" onClick={handleUndo}>↩ Undo</button>
              )}
              {drawnWinners.length > 0 && !spinning && (
                <button className="btn-ghost" onClick={handleReset}>↺ Reset All</button>
              )}
            </div>

            <div className="mini-stats">
              <div className="mini-stat"><strong>{pool.length}</strong><span>Remaining</span></div>
              <div className="mini-stat"><strong>{drawnWinners.length}</strong><span>Drawn</span></div>
            </div>

            {drawnWinners.length > 0 && (
              <div className="drawn-list-wrap">
                <p className="drawn-title">Drawn so far:</p>
                <ol className="drawn-ol">
                  {drawnWinners.map((w, i) => <li key={i}>{w}</li>)}
                </ol>
              </div>
            )}
          </section>
        )}

        {/* Entry list preview */}
        {entries.length > 0 && (
          <section className="admin-card">
            <h2>Entry List Preview</h2>
            <input
              className="search-input"
              type="search"
              placeholder="Search entries…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="entries-grid">
              {filteredEntries.map((entry, i) => (
                <span
                  key={i}
                  className={`entry-chip${entry === forcedWinner ? ' forced' : ''}${drawnWinners.includes(entry) ? ' drawn' : ''}`}
                  onClick={() => setForcedWinner(prev => prev === entry ? '' : entry)}
                  title={drawnWinners.includes(entry) ? 'Already drawn' : entry === forcedWinner ? 'Click to unselect' : 'Click to pre-select'}
                >
                  {entry}
                </span>
              ))}
            </div>
            {search && <p className="search-count">{filteredEntries.length} of {entries.length} shown</p>}
          </section>
        )}
      </main>
    </div>
  )
}
