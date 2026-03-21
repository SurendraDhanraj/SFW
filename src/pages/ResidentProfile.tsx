import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useParams, Link } from 'react-router-dom'
import { type Id } from '../../convex/_generated/dataModel'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { formatDistanceToNow } from '../utils/date'
import { formatAddress } from '../utils/address'
import MediaUploader from '../components/MediaUploader'

export default function ResidentProfile() {
  const { id } = useParams<{ id: string }>()
  const resident = useQuery(api.residents.getResident, { id: id as Id<'residents'> })
  const issues = useQuery(api.issues.listIssues, { residentId: id as Id<'residents'> })
  const mediaFiles = useQuery(api.media.getMediaForResident, { residentId: id as Id<'residents'> })
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || !resident?.lat || !resident?.lng) return
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
    const map = L.map(mapRef.current).setView([resident.lat, resident.lng], 16)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
    L.marker([resident.lat, resident.lng]).addTo(map).bindPopup(formatAddress(resident)).openPopup()
    mapInstanceRef.current = map
    return () => { map.remove(); mapInstanceRef.current = null }
  }, [resident?.lat, resident?.lng, resident?.address])

  if (resident === undefined || issues === undefined) {
    return <div className="spinner-wrap"><div className="spinner" /></div>
  }
  if (resident === null) {
    return <div className="empty-state"><p>Resident not found.</p></div>
  }

  const openIssueCount = issues.filter(i => i.status !== 'closed').length

  return (
    <>
      <div className="page-header">
        <Link to="/residents" className="header-back-btn" id="back-to-directory">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="flex-1">
          <div className="page-header-title">Resident Profile</div>
          <div className="page-header-subtitle">{resident.corporation ?? ''}</div>
        </div>
        <Link to={`/issues/new?residentId=${resident._id}`} className="btn btn-primary btn-sm" id="log-issue-btn">
          <span className="material-symbols-outlined icon-sm">add_location_alt</span> Log Issue
        </Link>
      </div>

      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-name">{resident.name}</div>
        <div className="profile-address">
          {formatAddress(resident)}
        </div>
        <div className="resident-card-geo" style={{ marginTop: '0.75rem' }}>
          {resident.parliamentaryDistrict && <span className="geo-tag">{resident.parliamentaryDistrict}</span>}
          {resident.municipalDistrict && <span className="geo-tag">{resident.municipalDistrict}</span>}
          {resident.pollingDivision && <span className="geo-tag">PD {resident.pollingDivision}</span>}
        </div>
      </div>

      {/* GIS Map */}
      <div className="section-header">
        <span className="section-title">Address & Vicinity</span>
        {!resident.lat && <span className="label-sm text-muted">No location tagged</span>}
      </div>
      <div ref={mapRef} className="map-container">
        {!resident.lat && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--on-surface-variant)', flexDirection: 'column', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '32px', opacity: 0.4 }}>location_off</span>
            <span className="label-sm">No location tagged</span>
          </div>
        )}
      </div>

      {/* Address Media */}
      {(mediaFiles?.filter(m => m.linkedTo === 'address') ?? []).length > 0 && (
        <>
          <div className="section-header"><span className="section-title">Address Photos</span></div>
          <div className="media-grid">
            {mediaFiles!.filter(m => m.linkedTo === 'address').map(m => (
              <div key={m._id} className="media-thumb">
                {m.url && <a href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt={m.caption ?? 'Media'} loading="lazy" /></a>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Upload address media */}
      <div className="section-header"><span className="section-title">Field Documentation</span></div>
      <MediaUploader linkedTo="address" residentId={id as Id<'residents'>} />

      {/* Issues */}
      <div className="section-header">
        <span className="section-title">Linked Issues</span>
        <span className="chip chip-open" style={{ fontSize: '0.6875rem' }}>{openIssueCount} open</span>
      </div>

      {issues.length === 0 ? (
        <div className="empty-state" style={{ padding: '1.5rem' }}>
          <span className="empty-state-sub">No issues logged for this resident.</span>
        </div>
      ) : (
        issues.map(issue => (
          <Link key={issue._id} to={`/issues/${issue._id}`} className="issue-card" id={`issue-${issue._id}`}>
            <div className="issue-card-header">
              <div className="flex-1">
                <div className="issue-card-num">#{String(issue._id).slice(-6).toUpperCase()}</div>
                <div className="issue-card-title">{issue.title}</div>
              </div>
              <span className={`chip chip-${issue.priority}`}>{issue.priority}</span>
            </div>
            <div className="issue-card-footer">
              <span className={`chip chip-${issue.status}`}>{issue.status.replace('_', ' ')}</span>
              <span className="label-sm text-muted">{formatDistanceToNow(issue.createdAt)}</span>
            </div>
          </Link>
        ))
      )}

      <div style={{ height: '1rem' }} />
    </>
  )
}
