import { useState, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type Id } from '../../convex/_generated/dataModel'
import { formatAddress } from '../utils/address'
import GISMapPicker from '../components/GISMapPicker'

export default function CreateIssue() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const prefillResidentId = params.get('residentId')

  const createIssue = useMutation(api.issues.createIssue)
  const [saving, setSaving] = useState(false)
  const [residentSearch, setResidentSearch] = useState('')
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(prefillResidentId)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [form, setForm] = useState({
    title: '', description: '', category: '', priority: 'medium' as const,
  })

  const searchResults = useQuery(api.residents.searchResidents,
    selectedResidentId ? { query: '', limit: 0 } : { query: residentSearch, limit: 8 }
  )
  const selectedResident = useQuery(api.residents.getResident,
    selectedResidentId ? { id: selectedResidentId as Id<'residents'> } : 'skip'
  )

  useEffect(() => {
    if (!selectedResident) return
    if (selectedResident.lat && selectedResident.lng) {
      setLocation({ lat: selectedResident.lat, lng: selectedResident.lng })
      return
    }

    // Attempt to geocode OpenStreetMap
    const timer = setTimeout(async () => {
      try {
        const addrPart = selectedResident.address ? `${selectedResident.address},` : ''
        const cityPart = selectedResident.municipalDistrict ? `${selectedResident.municipalDistrict},` : ''
        const addressQuery = `${addrPart} ${cityPart} Trinidad and Tobago`.trim()
        
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}`)
        const data = await res.json()
        if (data && data.length > 0) {
          setLocation({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
        }
      } catch (err) {
        console.error("Geocoding failed", err)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [selectedResident])

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedResidentId) return
    setSaving(true)
    try {
      const id = await createIssue({
        residentId: selectedResidentId as Id<'residents'>,
        title: form.title,
        description: form.description,
        category: form.category || undefined,
        priority: form.priority,
        lat: location?.lat,
        lng: location?.lng,
      })
      navigate(`/issues/${id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <button className="header-back-btn" onClick={() => navigate(-1)} id="back-btn">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <div className="page-header-title">Log New Issue</div>
          <div className="page-header-subtitle">Link to a resident & tag a location</div>
        </div>
      </div>

      <form className="form-page" onSubmit={handleSubmit} id="create-issue-form">
        {/* Resident Selection */}
        <div className="form-section-label">Resident</div>

        {selectedResident ? (
          <div className="resident-card" style={{ margin: 0, cursor: 'default' }}>
            <div className="row row-between">
              <div>
                <div className="resident-card-name">{selectedResident.name}</div>
                <div className="resident-card-address">{formatAddress(selectedResident)}</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedResidentId(null)} id="change-resident-btn">
                Change
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="search-bar" style={{ margin: 0 }}>
              <span className="material-symbols-outlined">search</span>
              <input
                id="resident-search-issue"
                type="text"
                placeholder="Search resident by name…"
                value={residentSearch}
                onChange={e => setResidentSearch(e.target.value)}
              />
            </div>
            {residentSearch && searchResults && (
              <div style={{ background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-float)', marginTop: '0.5rem' }}>
                {searchResults.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center' }}>
                    <p className="label-md text-muted">Not found.</p>
                    <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => navigate('/residents/new')}>
                      <span className="material-symbols-outlined icon-sm">person_add</span> Create New Resident
                    </button>
                  </div>
                ) : (
                  searchResults.map(r => (
                    <button
                      key={r._id} type="button" id={`select-resident-${r._id}`}
                      style={{ width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--surface-container)' }}
                      onClick={() => setSelectedResidentId(r._id)}
                    >
                      <div className="title-sm">{r.name}</div>
                      <div className="label-sm text-muted">{formatAddress(r)}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* Issue Details */}
        <div className="form-section-label">Issue Details</div>

        <div className="field-group">
          <label className="field-label" htmlFor="issue-title">Title *</label>
          <input id="issue-title" type="text" className="field-input" required
            placeholder="e.g. Water main break — Oak St." value={form.title} onChange={set('title')} />
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="issue-category">Category</label>
          <select id="issue-category" className="field-select" value={form.category} onChange={set('category')}>
            <option value="">Select category…</option>
            <option>Infrastructure</option>
            <option>Environmental</option>
            <option>Public Safety</option>
            <option>Utilities</option>
            <option>Social Services</option>
            <option>Noise Complaint</option>
            <option>Other</option>
          </select>
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="issue-priority">Priority *</label>
          <select id="issue-priority" className="field-select" value={form.priority} onChange={set('priority' as never)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="issue-description">Description *</label>
          <textarea id="issue-description" className="field-textarea" required
            placeholder="Describe the issue in detail…"
            value={form.description} onChange={set('description')} />
        </div>

        {/* GIS Location */}
        <div className="form-section-label">GIS Location Tag</div>
        <p className="label-sm text-muted" style={{ marginBottom: '0.75rem' }}>
          Tap the map to pin the exact location of this issue.
        </p>
        <GISMapPicker value={location} onChange={setLocation} />

        <button id="submit-issue-btn" type="submit" className="btn btn-primary btn-full" disabled={saving || !selectedResidentId} style={{ marginTop: '1.25rem', marginBottom: '1rem' }}>
          {saving ? 'Logging issue…' : <><span className="material-symbols-outlined icon-sm">add_location_alt</span> Log Issue</>}
        </button>
      </form>
    </>
  )
}
