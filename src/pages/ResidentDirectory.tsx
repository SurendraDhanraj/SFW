import { useState, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Link } from 'react-router-dom'
import Papa from 'papaparse'
import { formatAddress } from '../utils/address'
import { useIsSuperiorRole } from '../context/UserContext'

type Tab = 'directory' | 'address' | 'filters' | 'upload'

export default function ResidentDirectory() {
  const isSuperior = useIsSuperiorRole()

  const [tab, setTab] = useState<Tab>('directory')
  const [query, setQuery] = useState('')
  const [expandedAddress, setExpandedAddress] = useState<string | null>(null)
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmState, setConfirmState] = useState<'idle' | 'selected' | 'all' | 'all-confirm'>('idle')
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  
  // Geographic filters
  const [parlDist, setParlDist] = useState('')
  const [munDist, setMunDist] = useState('')
  const [pollDiv, setPollDiv] = useState('')

  const [uploading, setUploading] = useState(false)
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const residents = useQuery(api.residents.searchResidents, { 
    query, 
    limit: 30,
    parliamentaryDistrict: parlDist || undefined,
    municipalDistrict: munDist || undefined,
    pollingDivision: pollDiv || undefined
  })
  const filtersOpts = useQuery(api.geographic.getFilters)
  const residentCount = useQuery(api.residents.getResidentCount)
  const addressGroups = useQuery(api.residents.listByAddress, {
    parliamentaryDistrict: parlDist || undefined,
    municipalDistrict: munDist || undefined,
    pollingDivision: pollDiv || undefined
  })
  const batchImport = useMutation(api.residents.batchImportResidents)
  const deleteSelected = useMutation(api.residents.deleteResidents)
  const deleteAll = useMutation(api.residents.deleteAllResidents)

  async function handleClearSelected() {
    if (selectedIds.size === 0) return
    setDeleting(true)
    try {
      await deleteSelected({ ids: Array.from(selectedIds) as any })
      setSelectedIds(new Set())
      setConfirmState('idle')
    } catch (err: any) {
      alert(err.message || 'Failed to delete residents')
    } finally {
      setDeleting(false)
    }
  }

  async function handleClearAll() {
    if (confirmText !== String(residentCount)) return
    setDeleting(true)
    try {
      let hasMore = true;
      while (hasMore) {
        hasMore = await deleteAll();
      }
      setSelectedIds(new Set())
      setConfirmState('idle')
      setConfirmText('')
    } catch (err: any) {
      alert(err.message || 'Failed to clear database')
    } finally {
      setDeleting(false)
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function toggleSelectAll() {
    if (!residents) return
    if (selectedIds.size === residents.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(residents.map(r => r._id)))
    }
  }

  async function processCSV(file: File) {
    setUploading(true)
    setImportResult(null)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[]
        const mapped = rows.map(r => ({
          systemId: r['SYSTEM_ID'] ?? '',
          consecNo: r['CONSEC_NO'] ?? '',
          name: r['NAME'] ?? '',
          building: r['BUILDING'] || undefined,
          apt: r['APT'] || undefined,
          address: r['ADDRESS'] ?? '',
          pollingDivision: r['POLLING DIVISION'] || undefined,
          parliamentaryDistrict: r['PARLIAMENTARY ELECTORAL DISTRICT'] || undefined,
          municipalDistrict: r['MUNICIPAL ELECTORAL DISTRICT'] || undefined,
          registrationArea: r['REGISTRATION AREA'] || undefined,
          corporation: r['CORPORATION'] || undefined,
          securityCode: r['SECURITY CODE'] || undefined,
        })).filter(r => r.systemId && r.name)

        // batch in chunks of 100
        let totalInserted = 0, totalSkipped = 0
        const CHUNK = 100
        for (let i = 0; i < mapped.length; i += CHUNK) {
          const chunk = mapped.slice(i, i + CHUNK)
          const result = await batchImport({ residents: chunk })
          totalInserted += result.inserted
          totalSkipped += result.skipped
        }
        setImportResult({ inserted: totalInserted, skipped: totalSkipped })
        setUploading(false)
      },
      error: () => setUploading(false),
    })
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-header-title">Resident Directory</div>
          <div className="page-header-subtitle">Municipal Authority · {residentCount?.toLocaleString() ?? '—'} total residents</div>
        </div>
      </div>

      <div className="tabs">
        {([
          ['directory', 'people', 'Directory'], 
          ['address', 'home_pin', 'By Address'], 
          ['filters', 'account_tree', 'Geographic'], 
          ...(isSuperior ? [['upload', 'cloud_upload', 'Upload']] : [])
        ] as const).map(
          ([key, icon, label]) => (
            <button key={key as string} id={`tab-${key as string}`} className={`tab-btn${tab === key ? ' active' : ''}`} onClick={() => setTab(key as Tab)}>
              <span className="material-symbols-outlined icon-sm">{icon}</span>
              {label}
            </button>
          )
        )}
      </div>

      {tab === 'address' && (
        <div className="address-tab" style={{ padding: '0 1rem' }}>
          {addressGroups === undefined ? (
            <div className="spinner-wrap" style={{ padding: '2rem' }}><div className="spinner" /></div>
          ) : addressGroups.length === 0 ? (
            <div className="empty-state">
              <span className="material-symbols-outlined empty-state-icon">home_pin</span>
              <p className="empty-state-title">No addresses found</p>
              <p className="empty-state-sub">Add residents to see them grouped here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '2rem' }}>
              {addressGroups.map(group => (
                <div key={group.address} className="address-group-card" style={{ background: 'var(--surface-container)', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline-variant)', overflow: 'hidden' }}>
                  <div 
                    style={{ padding: '1rem', display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setExpandedAddress(expandedAddress === group.address ? null : group.address)}
                  >
                    <span className="material-symbols-outlined icon-sm" style={{ marginRight: '0.75rem', color: 'var(--on-surface-variant)' }}>home_pin</span>
                    <div style={{ flex: 1, fontWeight: 'bold' }}>{group.address}</div>
                    <div className="label-sm" style={{ color: 'var(--on-surface-variant)', marginRight: '1rem' }}>
                      {group.residents.length} {group.residents.length === 1 ? 'Resident' : 'Residents'}
                    </div>
                    <span className="material-symbols-outlined icon-sm text-muted">
                      {expandedAddress === group.address ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>

                  {expandedAddress === group.address && (
                    <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--outline-variant)' }}>
                      <div style={{ paddingTop: '0.5rem' }}>
                        {group.residents.map((r: any) => (
                          <Link 
                            key={r._id} 
                            to={`/residents/${r._id}`}
                            style={{ 
                              display: 'flex', alignItems: 'center', padding: '0.75rem', 
                              borderBottom: '1px solid var(--surface-container-high)', 
                              textDecoration: 'none', color: 'inherit' 
                            }}
                          >
                            <div className="personnel-avatar" style={{ marginRight: '1rem', width: '32px', height: '32px', fontSize: '14px' }}>
                              {r.name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: '0.875rem' }}>{r.name}</div>
                              <div className="text-muted" style={{ fontSize: '0.75rem' }}>ID: {r.consecNo || r.systemId}</div>
                            </div>
                            <span className="material-symbols-outlined icon-sm text-muted">chevron_right</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'directory' && (
        <>
          <div className="search-bar">
            <span className="material-symbols-outlined">search</span>
            <input
              id="resident-search"
              type="text"
              placeholder="Search by name or address…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)', display: 'flex' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            )}
          </div>

          {isSuperior && residents && residents.length > 0 && (
            <div style={{ padding: '0 1rem 1rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--surface)', borderBottom: '1px solid var(--outline-variant)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input 
                  type="checkbox" 
                  checked={selectedIds.size > 0 && selectedIds.size === residents.length} 
                  onChange={toggleSelectAll} 
                />
                Select All
              </label>
              
              <div style={{ flex: 1 }} />
              
              {confirmState === 'selected' ? (
                <>
                  <span className="text-muted" style={{ fontSize: '0.875rem' }}>Delete {selectedIds.size}?</span>
                  <button className="btn btn-danger btn-sm" onClick={handleClearSelected} disabled={deleting}>
                    {deleting ? 'Deleting…' : 'Yes'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmState('idle')} disabled={deleting}>
                    Cancel
                  </button>
                </>
              ) : confirmState === 'all' ? (
                <>
                  <span className="text-muted" style={{ fontSize: '0.875rem' }}>Clear entire database?</span>
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirmState('all-confirm')} disabled={deleting}>
                    Yes, Clear All
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmState('idle')} disabled={deleting}>
                    Cancel
                  </button>
                </>
              ) : confirmState === 'all-confirm' ? (
                <>
                  <span className="text-muted" style={{ fontSize: '0.875rem', color: 'var(--priority-critical)' }}>Type <strong>{residentCount}</strong> to confirm:</span>
                  <input 
                    type="text" 
                    className="field-input" 
                    style={{ width: '80px', padding: '0.25rem 0.5rem', margin: '0 0.5rem', minHeight: '30px', fontSize: '14px' }} 
                    value={confirmText} 
                    onChange={e => setConfirmText(e.target.value)} 
                    placeholder="Count"
                  />
                  <button className="btn btn-danger btn-sm" onClick={handleClearAll} disabled={deleting || confirmText !== String(residentCount)}>
                    {deleting ? 'Deleting…' : 'Force Delete'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setConfirmState('idle'); setConfirmText(''); }} disabled={deleting}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {selectedIds.size > 0 && (
                    <button className="btn btn-danger btn-sm" onClick={() => setConfirmState('selected')} disabled={deleting}>
                      Delete Selected ({selectedIds.size})
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-closed)' }} onClick={() => setConfirmState('all')} disabled={deleting}>
                    Clear Database
                  </button>
                </>
              )}
            </div>
          )}

          {residents === undefined ? (
            <div className="spinner-wrap"><div className="spinner" /></div>
          ) : residents.length === 0 ? (
            <div className="empty-state">
              <span className="material-symbols-outlined empty-state-icon">person_search</span>
              <p className="empty-state-title">No residents found</p>
              <p className="empty-state-sub">{query ? 'Try a different search term.' : 'Upload a CSV to populate the directory.'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {residents.map(r => (
                <div key={r._id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.5rem', borderBottom: '1px solid var(--outline-variant)' }}>
                  {isSuperior && (
                    <input 
                      type="checkbox" 
                      style={{ marginLeft: '0.5rem' }}
                      checked={selectedIds.has(r._id)} 
                      onChange={() => toggleSelect(r._id)} 
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                  <Link to={`/residents/${r._id}`} className="resident-card" id={`resident-${r._id}`} style={{ flex: 1, borderBottom: 'none', margin: 0, padding: '1rem 0.5rem' }}>
                    <div className="resident-card-name">{r.name}</div>
                    <div className="resident-card-address">
                      {formatAddress(r)}
                    </div>
                    <div className="resident-card-geo">
                      {r.parliamentaryDistrict && <span className="geo-tag">{r.parliamentaryDistrict}</span>}
                      {r.municipalDistrict && <span className="geo-tag">{r.municipalDistrict}</span>}
                      {r.pollingDivision && <span className="geo-tag">PD {r.pollingDivision}</span>}
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'filters' && (
        <div style={{ padding: '1rem' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--on-surface-variant)', marginBottom: '1rem' }}>
            Filter the directory by exact district or polling division.
          </p>
          <div className="field-group">
            <label className="field-label" htmlFor="filter-pd">Parliamentary Electoral District</label>
            <select id="filter-pd" className="field-select" value={parlDist} onChange={e => setParlDist(e.target.value)}>
              <option value="">All Parliamentary Districts</option>
              {filtersOpts?.parliamentaryDistricts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="filter-md">Municipal Electoral District</label>
            <select id="filter-md" className="field-select" value={munDist} onChange={e => setMunDist(e.target.value)}>
              <option value="">All Municipal Districts</option>
              {filtersOpts?.municipalDistricts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="filter-poll">Polling Division</label>
            <select id="filter-poll" className="field-select" value={pollDiv} onChange={e => setPollDiv(e.target.value)}>
              <option value="">All Polling Divisions</option>
              {filtersOpts?.pollingDivisions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {(parlDist || munDist || pollDiv) && (
            <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => { setParlDist(''); setMunDist(''); setPollDiv('') }}>
              Clear Filters
            </button>
          )}
        </div>
      )}

      {isSuperior && tab === 'upload' && (
        <div style={{ padding: '1rem' }}>
          <p className="body-md text-muted" style={{ marginBottom: '1rem' }}>
            Batch import from CSV. Ensure your file includes: <code style={{ fontSize: '0.75rem', background: 'var(--surface-container)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>SYSTEM_ID, CONSEC_NO, NAME, BUILDING, APT, ADDRESS, POLLING DIVISION, PARLIAMENTARY ELECTORAL DISTRICT, MUNICIPAL ELECTORAL DISTRICT, REGISTRATION AREA, CORPORATION, SECURITY CODE</code>
          </p>

          <div
            id="csv-drop-zone"
            className={`upload-zone${dragOver ? ' drag-over' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processCSV(f) }}
          >
            <div className="upload-zone-icon">
              <span className="material-symbols-outlined" style={{ fontSize: '40px' }}>cloud_upload</span>
            </div>
            <div className="upload-zone-text">Drag & Drop CSV</div>
            <div className="upload-zone-sub">Max file size: 50MB · Click to browse</div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            id="csv-file-input"
            onChange={e => { const f = e.target.files?.[0]; if (f) processCSV(f) }}
          />

          {uploading && (
            <div className="spinner-wrap" style={{ padding: '1.5rem' }}>
              <div className="spinner" />
              <span style={{ marginLeft: '1rem', fontFamily: 'var(--font-label)', color: 'var(--on-surface-variant)' }}>Importing…</span>
            </div>
          )}

          {importResult && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--status-closed-bg)', borderRadius: 'var(--radius-lg)' }}>
              <p style={{ fontFamily: 'var(--font-label)', fontWeight: 700, color: 'var(--status-closed)' }}>
                Import complete
              </p>
              <p style={{ fontFamily: 'var(--font-label)', fontSize: '0.8125rem', color: 'var(--on-surface-variant)', marginTop: '0.375rem' }}>
                ✓ {importResult.inserted} inserted · {importResult.skipped} skipped (duplicates)
              </p>
            </div>
          )}
        </div>
      )}

      {/* FAB — create new resident */}
      <Link to="/residents/new" className="fab" id="fab-new-resident" aria-label="Create new resident">
        <span className="material-symbols-outlined">person_add</span>
      </Link>
    </>
  )
}
