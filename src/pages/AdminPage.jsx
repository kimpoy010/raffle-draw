import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import {
  saveRaffleConfig, triggerDraw, addDrawnWinners,
  removeDrawnWinners, resetDrawnWinners, setDrawIdle, subscribeRaffle, clearRaffle,
} from '../lib/raffle.js'
import OdometerDisplay from '../components/OdometerDisplay.jsx'
import './AdminPage.css'

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN ?? '1234'
const DRAW_DURATION_MS = 2500
const TICK_INTERVAL_MS = 60

function parseSheet(wb, sheetName) {
  const sheet = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
  return rows.filter(row => Array.isArray(row) && row.some(c => String(c).trim() !== ''))
}

function generateRange(from, to) {
  if (isNaN(from) || isNaN(to) || from > to) return []
  return Array.from({ length: to - from + 1 }, (_, i) => String(from + i))
}

export default function AdminPage() {
  const navigate = useNavigate()

  // PIN gate
  const [pinInput, setPinInput] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [pinError, setPinError] = useState(false)

  // Mode: 'excel' | 'range'
  const [mode, setMode] = useState('range')

  // Excel state
  const [fileName, setFileName] = useState('')
  const [sheetNames, setSheetNames] = useState([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [columnOptions, setColumnOptions] = useState([])
  const [selectedColumn, setSelectedColumn] = useState(0)
  const [workbookData, setWorkbookData] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  // Range state
  const [rangeFrom, setRangeFrom] = useState(1)
  const [rangeTo, setRangeTo] = useState(100)
  const [forcedWinnerNum, setForcedWinnerNum] = useState('')

  // Shared entries / winner state
  const [entries, setEntries] = useState([])
  const [forcedWinner, setForcedWinner] = useState('')
  const entriesRef = useRef([])

  // UI state
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Live Firebase state
  const [drawnWinners, setDrawnWinners] = useState([])
  const [currentWinners, setCurrentWinners] = useState([])
  const [spinning, setSpinning] = useState(false)
  const [spinDisplay, setSpinDisplay] = useState('')
  const tickRef = useRef(null)
  const lastStartRef = useRef(0)

  // Danger zone
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (!unlocked) return
    const unsub = subscribeRaffle((data) => {
      if (!data) return
      const drawn = data.drawnWinners ?? []
      setDrawnWinners(Array.isArray(drawn) ? drawn : Object.values(drawn))

      if (data.config) {
        if (!entriesRef.current.length) {
          const loaded = data.config.entries ?? []
          setEntries(loaded)
          entriesRef.current = loaded
        }
      }

      const draw = data.draw
      if (!draw || draw.state === 'idle') return
      if (draw.state === 'spinning' && draw.startedAt !== lastStartRef.current) {
        lastStartRef.current = draw.startedAt
        const elapsed = Date.now() - draw.startedAt
        startLocalSpin(draw.winners, Math.max(0, DRAW_DURATION_MS - elapsed))
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

  // PIN
  const handlePin = (e) => {
    e.preventDefault()
    if (pinInput === ADMIN_PIN) { setUnlocked(true); setPinError(false) }
    else { setPinError(true) }
  }

  // Mode switch — reset entries
  const switchMode = (m) => {
    setMode(m)
    setEntries([]); entriesRef.current = []
    setForcedWinner(''); setForcedWinnerNum('')
    setFileName(''); setWorkbookData(null)
    setSaved(false); setError('')
  }

  // Excel parsing
  const applyColumn = (wb, sheet, colIndex) => {
    const rows = parseSheet(wb, sheet)
    const names = rows.slice(1).map(r => String(r[colIndex] ?? '').trim()).filter(Boolean)
    setEntries(names); entriesRef.current = names
    setForcedWinner(''); setSaved(false)
  }

  const readFile = (file) => {
    setError(''); setSaved(false)
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
        setColumnOptions(cols); setSelectedColumn(0)
        setEntries(names); entriesRef.current = names
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

  // Range generation
  const rangeCount = (!isNaN(rangeFrom) && !isNaN(rangeTo) && rangeTo >= rangeFrom)
    ? rangeTo - rangeFrom + 1 : 0

  const handleGenerateRange = () => {
    const nums = generateRange(Number(rangeFrom), Number(rangeTo))
    if (!nums.length) { setError('Invalid range. Make sure "From" is less than or equal to "To".'); return }
    setError('')
    setEntries(nums); entriesRef.current = nums
    setForcedWinner(''); setForcedWinnerNum(''); setSaved(false)
  }

  const handleForcedWinnerNumChange = (val) => {
    setForcedWinnerNum(val)
    const num = Number(val)
    if (val === '' || isNaN(num)) { setForcedWinner(''); return }
    const str = String(num)
    setForcedWinner(entries.includes(str) ? str : '')
  }

  // Save
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

  // Draw
  const handleDraw = async () => {
    if (spinning || pool.length === 0) return
    const winners = forcedWinner && pool.includes(forcedWinner)
      ? [forcedWinner]
      : [pool[Math.floor(Math.random() * pool.length)]]
    try {
      await triggerDraw(winners)
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

  const handleClearRaffle = async () => {
    if (!confirmClear) { setConfirmClear(true); return }
    setClearing(true)
    try {
      await clearRaffle()
      setEntries([]); entriesRef.current = []
      setFileName(''); setWorkbookData(null)
      setColumnOptions([]); setSheetNames([]); setSelectedSheet('')
      setForcedWinner(''); setForcedWinnerNum('')
      setSaved(false); setCurrentWinners([])
      setDrawnWinners([]); setConfirmClear(false)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setError(`Clear failed: ${err.message}`)
    } finally {
      setClearing(false)
    }
  }

  const filteredEntries = entries.filter(e => e.toLowerCase().includes(search.toLowerCase()))

  // Validate forced number winner
  const numWinnerInRange = forcedWinnerNum !== '' &&
    !isNaN(Number(forcedWinnerNum)) &&
    entries.includes(String(Number(forcedWinnerNum))) &&
    pool.includes(String(Number(forcedWinnerNum)))

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

        {/* Step 1 — Source */}
        <section className="admin-card">
          <h2>1. Raffle Entries</h2>

          {/* Mode tabs */}
          <div className="mode-tabs">
            <button
              className={`mode-tab${mode === 'excel' ? ' active' : ''}`}
              onClick={() => switchMode('excel')}
            >
              📂 Excel File
            </button>
            <button
              className={`mode-tab${mode === 'range' ? ' active' : ''}`}
              onClick={() => switchMode('range')}
            >
              🔢 Number Range
            </button>
          </div>

          {/* Excel mode */}
          {mode === 'excel' && (
            <>
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
                  <button className="btn-ghost" onClick={() => { setFileName(''); setEntries([]); entriesRef.current = []; setWorkbookData(null) }}>Change</button>
                </div>
              )}

              {entries.length > 0 && sheetNames.length > 1 && (
                <div className="config-row" style={{ marginTop: 14 }}>
                  <label>Sheet</label>
                  <select value={selectedSheet} onChange={e => { setSelectedSheet(e.target.value); setSelectedColumn(0); if (workbookData) applyColumn(workbookData, e.target.value, 0) }}>
                    {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              {entries.length > 0 && (
                <div className="config-row" style={{ marginTop: 10 }}>
                  <label>Name column</label>
                  <select value={selectedColumn} onChange={e => { const idx = Number(e.target.value); setSelectedColumn(idx); if (workbookData) applyColumn(workbookData, selectedSheet, idx) }}>
                    {columnOptions.map(o => <option key={o.index} value={o.index}>{o.label}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Range mode */}
          {mode === 'range' && (
            <div className="range-section">
              <div className="range-inputs">
                <div className="range-field">
                  <label htmlFor="range-from">From</label>
                  <input
                    id="range-from"
                    type="number"
                    value={rangeFrom}
                    onChange={e => { setRangeFrom(e.target.value); setSaved(false) }}
                    className="range-input"
                    min={0}
                  />
                </div>
                <span className="range-dash">—</span>
                <div className="range-field">
                  <label htmlFor="range-to">To</label>
                  <input
                    id="range-to"
                    type="number"
                    value={rangeTo}
                    onChange={e => { setRangeTo(e.target.value); setSaved(false) }}
                    className="range-input"
                    min={0}
                  />
                </div>
                <button className="btn-generate" onClick={handleGenerateRange} disabled={rangeCount <= 0}>
                  Generate
                </button>
              </div>
              {rangeCount > 0 && (
                <p className="range-preview">
                  Will generate <strong>{rangeCount.toLocaleString()}</strong> numbers
                  ({rangeFrom} to {rangeTo})
                </p>
              )}
            </div>
          )}

          {error && <p className="error-msg">{error}</p>}

          {entries.length > 0 && (
            <>
              <p className="entry-count" style={{ marginTop: 14 }}>{entries.length.toLocaleString()} entries loaded</p>
              <button className="btn-save" onClick={handleSave} disabled={saving || saved} style={{ marginTop: 12 }}>
                {saving ? 'Saving…' : saved ? '✓ Saved to Firebase' : '☁️ Save to Firebase'}
              </button>
            </>
          )}
        </section>

        {/* Step 2 — Pre-select winner */}
        {saved && entries.length > 0 && (
          <section className="admin-card">
            <h2>2. Pre-select Winner <span className="optional-tag">optional</span></h2>
            <p className="section-sub">Choose a specific entry that will be drawn, or leave blank for random.</p>

            {mode === 'excel' ? (
              <div className="config-row">
                <label>Winner</label>
                <select value={forcedWinner} onChange={e => setForcedWinner(e.target.value)}>
                  <option value="">— Random —</option>
                  {pool.map((e, i) => <option key={i} value={e}>{e}</option>)}
                </select>
              </div>
            ) : (
              <div className="range-winner-row">
                <div className="config-row">
                  <label>Winner #</label>
                  <input
                    type="number"
                    className="range-input"
                    placeholder={`${rangeFrom} – ${rangeTo}`}
                    value={forcedWinnerNum}
                    min={rangeFrom}
                    max={rangeTo}
                    onChange={e => handleForcedWinnerNumChange(e.target.value)}
                  />
                  {forcedWinnerNum !== '' && (
                    <button className="btn-ghost" onClick={() => { setForcedWinnerNum(''); setForcedWinner('') }}>
                      ✕ Clear
                    </button>
                  )}
                </div>
                {forcedWinnerNum !== '' && !numWinnerInRange && (
                  <p className="range-warn">
                    Number must be between {rangeFrom} and {rangeTo} and not already drawn.
                  </p>
                )}
              </div>
            )}

            {forcedWinner && (
              <p className="forced-notice">🎯 <strong>{forcedWinner}</strong> will be drawn.</p>
            )}
          </section>
        )}

        {/* Step 3 — Control draw */}
        {saved && entries.length > 0 && (
          <section className="admin-card">
            <h2>3. Control Draw</h2>

            <div className={`mini-stage${spinning ? ' is-spinning' : ''}${currentWinners.length && !spinning ? ' has-winner' : ''}`}>
              {/* Numeric: odometer */}
              {mode === 'range' && (spinning || currentWinners.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  {spinning && <p className="spin-name" style={{ fontSize: 13, marginBottom: 4 }}>Drawing…</p>}
                  {!spinning && currentWinners.length > 0 && (
                    <p className="winner-label">🎉 {currentWinners.length === 1 ? 'Winner' : 'Winners'}!</p>
                  )}
                  <OdometerDisplay
                    value={spinning ? (spinDisplay || entries[0]) : currentWinners[0]}
                    spinning={spinning}
                    size="small"
                  />
                </div>
              )}
              {/* Text: standard */}
              {mode === 'excel' && spinning && <p className="spin-name">{spinDisplay}</p>}
              {mode === 'excel' && !spinning && currentWinners.length > 0 && (
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
              <div className="mini-stat"><strong>{pool.length.toLocaleString()}</strong><span>Remaining</span></div>
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
                  onClick={() => {
                    if (drawnWinners.includes(entry)) return
                    const next = forcedWinner === entry ? '' : entry
                    setForcedWinner(next)
                    if (mode === 'range') setForcedWinnerNum(next)
                  }}
                  title={drawnWinners.includes(entry) ? 'Already drawn' : entry === forcedWinner ? 'Click to unselect' : 'Click to pre-select'}
                >
                  {entry}
                </span>
              ))}
            </div>
            {search && <p className="search-count">{filteredEntries.length} of {entries.length} shown</p>}
          </section>
        )}

        {/* New Raffle */}
        <section className="admin-card danger-card">
          <h2>Start New Raffle</h2>
          <p className="section-sub">
            Clears all entries, drawn winners, and draw history from Firebase. This cannot be undone.
          </p>
          <button
            className={`btn-danger${confirmClear ? ' confirm' : ''}`}
            onClick={handleClearRaffle}
            disabled={clearing}
          >
            {clearing ? 'Clearing…' : confirmClear ? '⚠️ Tap again to confirm' : '🗑️ Clear & Start New Raffle'}
          </button>
          {confirmClear && (
            <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
          )}
        </section>

      </main>
    </div>
  )
}
