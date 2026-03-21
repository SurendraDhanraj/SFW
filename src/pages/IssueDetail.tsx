import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useParams, Link } from 'react-router-dom'
import { type Id } from '../../convex/_generated/dataModel'
import { useState, useRef, useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useIsSuperiorRole } from '../context/UserContext'
import { formatDate, formatDistanceToNow } from '../utils/date'
import { formatAddress } from '../utils/address'
import MediaUploader from '../components/MediaUploader'

const actionIcons: Record<string, string> = {
  created: 'flag',
  assigned: 'person_check',
  media_uploaded: 'attach_file',
  comment: 'chat',
  status_changed: 'update',
  closed: 'check_circle',
  sub_issue_added: 'add_task',
}

export default function IssueDetail() {
  const { id } = useParams<{ id: string }>()
  const isSuperior = useIsSuperiorRole()

  const issue = useQuery(api.issues.getIssue, { id: id as Id<'issues'> })
  const chronology = useQuery(api.issues.getIssueChronology, { issueId: id as Id<'issues'> })
  const subIssues = useQuery(api.issues.listSubIssues, { issueId: id as Id<'issues'> })
  const mediaFiles = useQuery(api.media.getMediaForIssue, { issueId: id as Id<'issues'> })
  const allUsers = useQuery(api.users.listUsers)

  const closeIssue = useMutation(api.issues.closeIssue)
  const createSubIssue = useMutation(api.issues.createSubIssue)
  const closeSubIssue = useMutation(api.issues.closeSubIssue)
  const startSubIssue = useMutation(api.issues.startSubIssue)
  const addAction = useMutation(api.issues.addIssueAction)
  const assignIssue = useMutation(api.issues.assignIssue)

  const [showSubForm, setShowSubForm] = useState(false)
  const [subTitle, setSubTitle] = useState('')
  const [subAssignee, setSubAssignee] = useState('')
  const [comment, setComment] = useState('')
  const [expandedSubIssue, setExpandedSubIssue] = useState<string | null>(null)
  const [subComment, setSubComment] = useState<Record<string, string>>({})
  const [subAttachments, setSubAttachments] = useState<Record<string, File[]>>({})
  const [subUploading, setSubUploading] = useState<Record<string, boolean>>({})
  const [attachments, setAttachments] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [closing, setClosing] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const generateUploadUrl = useMutation(api.media.generateUploadUrl)

  const mapLat = issue?.lat ?? issue?.resident?.lat
  const mapLng = issue?.lng ?? issue?.resident?.lng

  useEffect(() => {
    if (!mapRef.current || !mapLat || !mapLng) return
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
    const map = L.map(mapRef.current).setView([mapLat, mapLng], 16)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
    L.marker([mapLat, mapLng]).addTo(map).bindPopup(issue?.title ?? 'Issue Location').openPopup()
    mapInstanceRef.current = map
    return () => { map.remove(); mapInstanceRef.current = null }
  }, [mapLat, mapLng, issue?.title])

  if (!issue) return <div className="spinner-wrap"><div className="spinner" /></div>

  async function handleClose() {
    setClosing(true)
    try {
      await closeIssue({ issueId: id as Id<'issues'> })
      setConfirmClose(false)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to close issue.')
    } finally {
      setClosing(false)
    }
  }

  async function handleAssignIssue(userId: string) {
    if (!userId) return
    try {
      await assignIssue({ issueId: id as Id<'issues'>, assignedTo: userId as Id<'appUsers'> })
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to assign issue.')
    }
  }

  const hasOpenSubIssues = subIssues?.some(s => s.status !== 'completed') ?? false

  async function handleStartSubIssue(e: React.MouseEvent, subIssueId: Id<'subIssues'>) {
    e.stopPropagation()
    try {
      await startSubIssue({ subIssueId })
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to start sub-issue.')
    }
  }

  async function handleCloseSubIssue(e: React.MouseEvent, subIssueId: Id<'subIssues'>) {
    e.stopPropagation()
    try {
      await closeSubIssue({ subIssueId })
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to complete sub-issue.')
    }
  }

  async function handleAddSubIssue(e: React.FormEvent) {
    e.preventDefault()
    await createSubIssue({
      issueId: id as Id<'issues'>,
      title: subTitle,
      assignedTo: subAssignee ? subAssignee as Id<'appUsers'> : undefined,
    })
    setSubTitle(''); setSubAssignee(''); setShowSubForm(false)
  }

  async function handleSubComment(e: React.FormEvent, subId: Id<'subIssues'>) {
    e.preventDefault()
    const text = subComment[subId]
    const files = subAttachments[subId] || []
    if (!text?.trim() && files.length === 0) return
    setSubUploading(prev => ({ ...prev, [subId]: true }))
    
    try {
      const addedMedia = []
      for (const file of files) {
        const url = await generateUploadUrl()
        const mimeType = file.type || 'application/octet-stream'
        const res = await fetch(url, { method: 'POST', body: file, headers: { 'Content-Type': mimeType } })
        if (!res.ok) throw new Error(`Upload failed for ${file.name}`)
        const { storageId } = await res.json()
        addedMedia.push({ storageId, mimeType })
      }
      
      await addAction({ 
        issueId: id as Id<'issues'>, 
        subIssueId: subId, 
        actionType: 'comment', 
        description: text || "Media attachment",
        addedMedia 
      })
      
      setSubComment(prev => ({ ...prev, [subId]: '' }))
      setSubAttachments(prev => ({ ...prev, [subId]: [] }))
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'An error occurred during sub-issue upload. Please try again.')
    } finally {
      setSubUploading(prev => ({ ...prev, [subId]: false }))
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim() && attachments.length === 0) return
    setUploading(true)
    
    try {
      const addedMedia = []
      for (const file of attachments) {
        const url = await generateUploadUrl()
        const mimeType = file.type || 'application/octet-stream'
        const res = await fetch(url, { method: 'POST', body: file, headers: { 'Content-Type': mimeType } })
        if (!res.ok) throw new Error(`Upload failed for ${file.name}`)
        const { storageId } = await res.json()
        addedMedia.push({ storageId, mimeType })
      }
      
      await addAction({ 
        issueId: id as Id<'issues'>, 
        actionType: 'comment', 
        description: comment || "Media attachment",
        addedMedia
      })
      
      setComment('')
      setAttachments([])
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'An error occurred during upload. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <Link to="/issues" className="header-back-btn" id="back-to-issues">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="flex-1">
          <div className="page-header-title">Issue #{String(id).slice(-6).toUpperCase()}</div>
          <div className="page-header-subtitle">
            {issue.resident?.corporation ?? ''}{issue.resident?.municipalDistrict ? ` · ${issue.resident.municipalDistrict}` : ''}
          </div>
        </div>
        <span className={`chip chip-${issue.status}`}>{issue.status.replace('_', ' ')}</span>
      </div>

      {/* Hero */}
      <div style={{ padding: '1rem', background: 'var(--surface-container-low)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--on-surface)', flex: 1 }}>
            {issue.title}
          </h2>
          <span className={`chip chip-${issue.priority}`}>{issue.priority}</span>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
          {issue.description}
        </p>
        {issue.resident && (
          <Link to={`/residents/${issue.residentId}`} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.75rem', color: 'var(--primary)', fontFamily: 'var(--font-label)', fontSize: '0.8125rem', textDecoration: 'none', fontWeight: 600 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person</span>
            {issue.resident.name} · {formatAddress(issue.resident)}
          </Link>
        )}
        {issue.assignee && (
          <div style={{ marginTop: '0.375rem', fontFamily: 'var(--font-label)', fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle' }}>person_check</span>
            {' '}Assigned to {issue.assignee.name}
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.6875rem', color: 'var(--on-surface-variant)', marginTop: '0.5rem' }}>
          Logged {formatDistanceToNow(issue.createdAt)} by {issue.creator?.name ?? 'Unknown'}
        </div>
      </div>

      {/* GIS Minimap */}
      <div className="section-header">
        <span className="section-title">Location</span>
        {!mapLat && <span className="label-sm text-muted">No location tagged</span>}
      </div>
      <div ref={mapRef} className="map-container" style={{ margin: '0 1rem', borderRadius: 'var(--radius-md)' }}>
        {!mapLat && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--on-surface-variant)', flexDirection: 'column', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '32px', opacity: 0.4 }}>location_off</span>
            <span className="label-sm">No location tagged</span>
          </div>
        )}
      </div>

      {/* Supervisor Controls */}
      {isSuperior && issue.status !== 'closed' && (
        <div style={{ padding: '0 1rem', marginTop: '0.75rem' }}>
          <div className="supervisor-panel">
            <div className="supervisor-panel-title">Supervisor Controls</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select 
                className="field-select" 
                style={{ width: 'auto', flex: 1, minWidth: '150px' }} 
                value={issue.assignedTo ?? ''} 
                onChange={e => handleAssignIssue(e.target.value)}
              >
                <option value="">Assign Issue to…</option>
                {allUsers?.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role?.name})</option>)}
              </select>

              <button id="add-sub-issue-btn" className="btn btn-secondary btn-sm" onClick={() => setShowSubForm(s => !s)}>
                <span className="material-symbols-outlined icon-sm">add_task</span> Add Sub-Issue
              </button>
              
              {confirmClose ? (
                <>
                  <span className="text-muted" style={{ fontSize: '0.875rem', marginLeft: '0.5rem' }}>Are you sure?</span>
                  <button className="btn btn-danger btn-sm" onClick={handleClose} disabled={closing}>
                    {closing ? 'Closing…' : 'Yes, Close'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmClose(false)} disabled={closing}>
                    Cancel
                  </button>
                </>
              ) : (
                <button 
                  id="close-issue-btn" 
                  className="btn btn-danger btn-sm" 
                  onClick={() => setConfirmClose(true)} 
                  disabled={closing || hasOpenSubIssues}
                  title={hasOpenSubIssues ? "All sub-tasks must be completed before closing" : ""}
                >
                  <span className="material-symbols-outlined icon-sm">check_circle</span>
                  Close Issue
                </button>
              )}
            </div>

            {showSubForm && (
              <form onSubmit={handleAddSubIssue} style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }} id="sub-issue-form">
                <input type="text" className="field-input" placeholder="Sub-issue title…" required value={subTitle} onChange={e => setSubTitle(e.target.value)} id="sub-issue-title" />
                <select className="field-select" value={subAssignee} onChange={e => setSubAssignee(e.target.value)} id="sub-issue-assignee">
                  <option value="">Assign to (optional)…</option>
                  {allUsers?.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role?.name})</option>)}
                </select>
                <button id="save-sub-issue-btn" type="submit" className="btn btn-primary btn-sm">
                  <span className="material-symbols-outlined icon-sm">add</span> Add Sub-Issue
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Sub-Issues */}
      {(subIssues?.length ?? 0) > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">Linked Tasks & Sub-Issues</span>
          </div>
          <div style={{ padding: '0 1rem' }}>
            {subIssues!.map(s => {
              const isExpanded = expandedSubIssue === s._id
              const subActions = chronology?.filter(a => a.subIssueId === s._id) ?? []
              return (
              <div key={s._id} style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '0.5rem', boxShadow: 'var(--shadow-float)' }} className="sub-issue-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setExpandedSubIssue(isExpanded ? null : s._id)}>
                  <div className={`sub-issue-status-dot ${s.status}`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="title-sm">{s.title}</div>
                    {s.assignee && <div className="label-sm text-muted">Assigned to {s.assignee.name}</div>}
                  </div>
                  {isSuperior && s.status === 'open' && (
                    <button className="btn btn-secondary btn-sm" onClick={(e) => handleStartSubIssue(e, s._id as Id<'subIssues'>)} style={{ fontSize: '0.6875rem', marginRight: '0.25rem' }}>
                      Start
                    </button>
                  )}
                  {isSuperior && s.status !== 'completed' && (
                    <button className="btn btn-ghost btn-sm" onClick={(e) => handleCloseSubIssue(e, s._id as Id<'subIssues'>)} style={{ fontSize: '0.6875rem' }}>
                      Done
                    </button>
                  )}
                  <span className={`chip chip-${s.status}`} style={{ fontSize: '0.625rem' }}>{s.status}</span>
                  <span className="material-symbols-outlined icon-sm text-muted" style={{ marginLeft: '0.25rem' }}>{isExpanded ? 'expand_less' : 'expand_more'}</span>
                </div>
                
                {isExpanded && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--surface-container)' }}>
                    {subActions.length > 0 ? (
                      <div className="timeline" style={{ paddingLeft: '0.25rem', margin: 0 }}>
                        {subActions.map(action => (
                          <div key={action._id} className="timeline-item" style={{ paddingBottom: '0.75rem' }}>
                            <div className="timeline-icon" style={{ left: 0, width: '16px', height: '16px', top: '2px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>{actionIcons[action.actionType] ?? 'info'}</span>
                            </div>
                            <div className="timeline-body" style={{ paddingLeft: '1.25rem' }}>
                              <div className="timeline-desc" style={{ fontSize: '0.75rem' }}>{action.description}</div>
                              {action.media && action.media.length > 0 && (
                                <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                  {action.media.map((m: any) => (
                                    <div key={m._id} style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', background: 'var(--surface-container-high)', border: '1px solid var(--outline-variant)' }}>
                                      {m.url && m.mimeType.startsWith('image/') ? (
                                         <a href={m.url} target="_blank" rel="noreferrer"><img src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Attachment" /></a>
                                      ) : (
                                        <a href={m.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'inherit', textDecoration: 'none' }}>
                                          <span className="material-symbols-outlined text-muted" style={{ fontSize: '16px' }}>attach_file</span>
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="timeline-meta" style={{ fontSize: '0.625rem' }}>{action.performer?.name ?? 'Unknown'} · {formatDate(action.createdAt)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="label-sm text-muted" style={{ marginBottom: '0.5rem' }}>No activity logged yet.</div>
                    )}
                    
                    <form onSubmit={(e) => handleSubComment(e, s._id as Id<'subIssues'>)} style={{ marginTop: '0.5rem' }}>
                      <div className="field-group" style={{ marginBottom: '0.5rem' }}>
                        <input type="text" className="field-input" style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem' }} placeholder="Add note to sub-issue..." 
                          value={subComment[s._id] || ''} onChange={e => setSubComment(prev => ({ ...prev, [s._id]: e.target.value }))} />
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {(subAttachments[s._id] || []).map((f, i) => (
                          <div key={i} style={{ background: 'var(--surface-container-high)', padding: '0.125rem 0.375rem', borderRadius: '4px', fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span className="material-symbols-outlined text-muted" style={{ fontSize: '12px' }}>attach_file</span>
                            {f.name.slice(0, 12) + (f.name.length > 12 ? '...' : '')}
                            <button type="button" style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex' }} onClick={() => setSubAttachments(prev => ({...prev, [s._id]: prev[s._id].filter((_, idx) => idx !== i)}))}>
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>close</span>
                            </button>
                          </div>
                        ))}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => document.getElementById(`sub-file-${s._id}`)?.click()} style={{ padding: '0.125rem 0.375rem', fontSize: '0.6875rem' }}>
                          <span className="material-symbols-outlined icon-sm">attach_file</span> Attach Media
                        </button>
                        <input id={`sub-file-${s._id}`} type="file" multiple style={{ display: 'none' }} accept="image/*,video/*,application/pdf" onChange={e => {
                          if (e.target.files && e.target.files.length > 0) {
                            const newFiles = Array.from(e.target.files)
                            setSubAttachments(prev => ({ ...prev, [s._id]: [...(prev[s._id] || []), ...newFiles] }))
                          }
                          e.target.value = ''
                        }} />
                        
                        <button type="submit" className="btn btn-secondary btn-sm" style={{ padding: '0.125rem 0.5rem', fontSize: '0.6875rem', marginLeft: 'auto' }} disabled={(!subComment[s._id]?.trim() && !(subAttachments[s._id]?.length)) || subUploading[s._id]}>
                          {subUploading[s._id] ? 'Posting…' : 'Post'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )})}
          </div>
        </>
      )}

      {/* Media */}
      <div className="section-header">
        <span className="section-title">Evidence & Field Documentation</span>
      </div>
      {(mediaFiles?.length ?? 0) > 0 && (
        <div className="media-grid" style={{ marginBottom: '0.75rem' }}>
          {mediaFiles!.map(m => (
            <div key={m._id} className="media-thumb">
              {m.url && m.mimeType.startsWith('image/') && (
                <a href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt={m.caption ?? ''} loading="lazy" /></a>
              )}
              {m.url && !m.mimeType.startsWith('image/') && (
                <a href={m.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: 'var(--surface-container)', color: 'inherit', textDecoration: 'none' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--on-surface-variant)' }}>attach_file</span>
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      <MediaUploader linkedTo="issue" issueId={id as Id<'issues'>} />

      {/* Issue Chronology */}
      <div className="section-header">
        <span className="section-title">Issue Chronology</span>
      </div>
      {chronology === undefined ? (
        <div className="spinner-wrap" style={{ padding: '2rem' }}><div className="spinner" /></div>
      ) : (
        <div className="timeline">
          {chronology.map(action => (
            <div key={action._id} className="timeline-item">
              <div className={`timeline-icon${action.actionType === 'created' ? ' primary' : action.actionType === 'closed' ? ' primary' : ''}`}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                  {actionIcons[action.actionType] ?? 'info'}
                </span>
              </div>
              <div className="timeline-body">
                <div className="timeline-desc">{action.description}</div>
                {action.media && action.media.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {action.media.map((m: any) => (
                      <div key={m._id} style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--surface-container-high)', border: '1px solid var(--outline-variant)' }}>
                        {m.url && m.mimeType.startsWith('image/') ? (
                           <a href={m.url} target="_blank" rel="noreferrer"><img src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Attachment" /></a>
                        ) : (
                          <a href={m.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'inherit', textDecoration: 'none' }}>
                            <span className="material-symbols-outlined text-muted">attach_file</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="timeline-meta">
                  {action.performer?.name ?? 'Unknown'} · {formatDate(action.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add comment */}
      <div style={{ padding: '1rem' }}>
        <form onSubmit={handleComment} id="comment-form">
          <div className="field-group">
            <label className="field-label" htmlFor="comment-input">Add Note to Chronology</label>
            <textarea id="comment-input" className="field-textarea" placeholder="Add a note or update…"
              value={comment} onChange={e => setComment(e.target.value)} style={{ minHeight: '72px' }} />
            
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {attachments.map((f, i) => (
                <div key={i} style={{ background: 'var(--surface-container-high)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span className="material-symbols-outlined icon-sm text-muted">attach_file</span>
                  {f.name.slice(0, 15) + (f.name.length > 15 ? '...' : '')}
                  <button type="button" style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex' }} onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}>
                    <span className="material-symbols-outlined icon-sm">close</span>
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} style={{ padding: '0.25rem 0.5rem' }}>
                <span className="material-symbols-outlined icon-sm">attach_file</span> Attach Media
              </button>
              <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} accept="image/*,video/*,application/pdf" onChange={e => {
                if (e.target.files && e.target.files.length > 0) {
                  const newFiles = Array.from(e.target.files)
                  setAttachments(prev => [...prev, ...newFiles])
                }
                e.target.value = ''
              }} />
            </div>
          </div>
          <button id="submit-comment-btn" type="submit" className="btn btn-secondary btn-sm" disabled={(!comment.trim() && attachments.length === 0) || uploading}>
            <span className="material-symbols-outlined icon-sm">{uploading ? 'hourglass_empty' : 'add_comment'}</span> 
            {uploading ? 'Posting…' : 'Add Note'}
          </button>
        </form>
      </div>

      {issue.status === 'closed' && (
        <div style={{ margin: '0 1rem 1rem', padding: '1rem', background: 'var(--status-closed-bg)', borderRadius: 'var(--radius-lg)' }}>
          <p style={{ fontFamily: 'var(--font-label)', fontWeight: 700, color: 'var(--status-closed)' }}>Issue Closed</p>
          {issue.closedAt && <p style={{ fontFamily: 'var(--font-label)', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '0.25rem' }}>{formatDate(issue.closedAt)}</p>}
        </div>
      )}

      <div style={{ height: '1rem' }} />
    </>
  )
}
