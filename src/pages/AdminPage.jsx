import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { saveConfig, loadConfig, clearConfig } from '../lib/store.js'
import './AdminPage.css'

function parseSheet(wb, sheetName) {
  const sheet = wb.Sheets[sheetName]
  const asArrays = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
  const nonEmpty = asArrays.filter(row =>
    Array.isArray(row) && row.some(cell => String(cell).trim() !== '')
  )
  return nonEmpty
}

export default function AdminPage() {
  const navigate = useNavigate()
  const existing = loadConfig()

  const [fileName, setFileName] = useState(existing?.fileName ?? '')
  const [sheetNames, setSheetNames] = useState(existing?.sheetNames ?? [])
  const [selectedSheet, setSelectedSheet] = useState(existing?.selectedSheet ?? '')
  const [columnOptions, setColumnOptions] = useState(existing?.columnOptions ?? [])
  const [selectedColumn, setSelectedColumn] = useState(existing?.selectedColumn ?? 0)
  const [entries, setEntries] = useState(existing?.entries ?? [])
  const [forcedWinner, setForcedWinner] = useState(existing?.forcedWinner ?? '')
  const [workbookData, setWorkbookData] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [search, setSearch] = useState('')
  const fileRef = useRef(null)

  const applySheet = (wb, sheetName, colIndex) => {
    const rows = parseSheet(wb, sheetName)
    if (rows.length < 2) return []
    const cols = rows[0].map((h, i) => ({
      label: String(h).trim() || `Column ${i + 1}`,
      index: i,
    }))
    setColumnOptions(cols)
    const names = rows.slice(1).map(r => String(r[colIndex] ?? '').trim()).filter(Boolean)
    setEntries(names)
    setForcedWinner('')
    return names
  }

  const readFile = (file) => {
    setError('')
    setSaved(false)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb = XLSX.read(data, { type: 'array', cellText: true, cellDates: true })

        if (!wb.SheetNames.length) { setError('No sheets found.'); return }

        const sheetName = wb.SheetNames[0]
        const rows = parseSheet(wb, sheetName)

        console.log('[Admin] Sheets:', wb.SheetNames)
        console.log('[Admin] Rows in first sheet:', rows.length)
        console.log('[Admin] First 3 rows:', rows.slice(0, 3))

        if (rows.length < 2) {
          setError(`Sheet "${sheetName}" has no data rows. Open the console (F12) to see what was read.`)
          return
        }

        const cols = rows[0].map((h, i) => ({
          label: String(h).trim() || `Column ${i + 1}`,
          index: i,
        }))
        const names = rows.slice(1).map(r => String(r[0] ?? '').trim()).filter(Boolean)

        setWorkbookData(wb)
        setSheetNames(wb.SheetNames)
        setSelectedSheet(sheetName)
        setColumnOptions(cols)
        setSelectedColumn(0)
        setEntries(names)
        setFileName(file.name)
        setForcedWinner('')
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
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)

  const handleSheetChange = (sheet) => {
    setSelectedSheet(sheet)
    setSelectedColumn(0)
    if (workbookData) applySheet(workbookData, sheet, 0)
  }

  const handleColumnChange = (colIndex) => {
    setSelectedColumn(colIndex)
    setForcedWinner('')
    if (workbookData) {
      const rows = parseSheet(workbookData, selectedSheet)
      const names = rows.slice(1).map(r => String(r[colIndex] ?? '').trim()).filter(Boolean)
      setEntries(names)
    }
  }

  const handleSave = () => {
    if (!entries.length) { setError('No entries to save.'); return }
    saveConfig({ fileName, sheetNames, selectedSheet, columnOptions, selectedColumn, entries, forcedWinner })
    setSaved(true)
    setTimeout(() => navigate('/'), 800)
  }

  const handleClear = () => {
    clearConfig()
    setFileName('')
    setSheetNames([])
    setSelectedSheet('')
    setColumnOptions([])
    setSelectedColumn(0)
    setEntries([])
    setForcedWinner('')
    setWorkbookData(null)
    setSaved(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const filteredEntries = entries.filter(e =>
    e.toLowerCase().includes(search.toLowerCase())
  )

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
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileRef.current.click()}
              role="button"
              tabIndex={0}
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
              <button className="btn-ghost" onClick={handleClear}>Change</button>
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
                  <label htmlFor="sheet-sel">Sheet</label>
                  <select id="sheet-sel" value={selectedSheet} onChange={e => handleSheetChange(e.target.value)}>
                    {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div className="config-row">
                <label htmlFor="col-sel">Name column</label>
                <select id="col-sel" value={selectedColumn} onChange={e => handleColumnChange(Number(e.target.value))}>
                  {columnOptions.map(o => <option key={o.index} value={o.index}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <p className="entry-count">{entries.length} entries loaded</p>
          </section>
        )}

        {/* Pre-select winner */}
        {entries.length > 0 && (
          <section className="admin-card">
            <h2>3. Pre-select Winner <span className="optional-tag">optional</span></h2>
            <p className="section-sub">
              Choose a specific entry that will be drawn. Leave blank for a truly random draw.
            </p>
            <div className="config-row">
              <label htmlFor="winner-sel">Winner</label>
              <select
                id="winner-sel"
                value={forcedWinner}
                onChange={e => setForcedWinner(e.target.value)}
              >
                <option value="">— Random —</option>
                {entries.map((e, i) => <option key={i} value={e}>{e}</option>)}
              </select>
            </div>
            {forcedWinner && (
              <p className="forced-notice">🎯 <strong>{forcedWinner}</strong> will be drawn when the Draw button is pressed.</p>
            )}
          </section>
        )}

        {/* Entry preview */}
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
                  className={`entry-chip${entry === forcedWinner ? ' forced' : ''}`}
                  onClick={() => setForcedWinner(prev => prev === entry ? '' : entry)}
                  title={entry === forcedWinner ? 'Click to unselect' : 'Click to pre-select as winner'}
                >
                  {entry}
                </span>
              ))}
            </div>
            {search && <p className="search-count">{filteredEntries.length} of {entries.length} shown</p>}
          </section>
        )}

        {/* Save */}
        {entries.length > 0 && (
          <div className="save-row">
            <button className="btn-save" onClick={handleSave} disabled={saved}>
              {saved ? '✓ Saved — going to draw…' : '💾 Save & Go to Draw'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
