import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { formatDistanceToNow } from '../utils/date'
import { useIsSuperiorRole } from '../context/UserContext'

type StatusFilter = 'all' | 'open' | 'in_progress' | 'closed'

export default function IssueList() {
  const isSuperior = useIsSuperiorRole()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmState, setConfirmState] = useState<'idle' | 'selected' | 'all' | 'all-confirm'>('idle')
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  
  const issues = useQuery(api.issues.listIssues, {
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit: 500,
  })
  
  const deleteSelected = useMutation(api.issues.deleteIssues)
  const deleteAll = useMutation(api.issues.deleteAllIssues)

  async function handleClearSelected() {
    if (selectedIds.size === 0) return
    setDeleting(true)
    try {
      await deleteSelected({ ids: Array.from(selectedIds) as any })
      setSelectedIds(new Set())
      setConfirmState('idle')
    } catch (err: any) {
      alert(err.message || 'Failed to delete issues')
    } finally {
      setDeleting(false)
    }
  }

  async function handleClearAll() {
    if (!issues) return
    if (confirmText !== String(issues.length)) return
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
    if (!issues) return
    if (selectedIds.size === issues.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(issues.map(i => i._id)))
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-header-title">Issue Feed</div>
          <div className="page-header-subtitle">{issues?.length ?? 0} issues</div>
        </div>
      </div>

      <div className="tabs">
        {(['all', 'open', 'in_progress', 'closed'] as StatusFilter[]).map(s => (
          <button
            key={s}
            id={`filter-${s}`}
            className={`tab-btn${statusFilter === s ? ' active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isSuperior && issues && issues.length > 0 && (
        <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input 
              type="checkbox" 
              checked={selectedIds.size > 0 && selectedIds.size === issues.length} 
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
                <span className="text-muted" style={{ fontSize: '0.875rem', color: 'var(--priority-critical)' }}>Type <strong>{issues.length}</strong> to confirm:</span>
                <input 
                  type="text" 
                  className="field-input" 
                  style={{ width: '80px', padding: '0.25rem 0.5rem', margin: '0 0.5rem', minHeight: '30px', fontSize: '14px' }} 
                  value={confirmText} 
                  onChange={e => setConfirmText(e.target.value)} 
                  placeholder="Count"
                />
                <button className="btn btn-danger btn-sm" onClick={handleClearAll} disabled={deleting || confirmText !== String(issues.length)}>
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

      {issues === undefined ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : issues.length === 0 ? (
        <div className="empty-state">
           <span className="material-symbols-outlined empty-state-icon">assignment_late</span>
           <p className="empty-state-title">No issues found</p>
           <p className="empty-state-sub">Tap "Report" to log a new issue.</p>
         </div>
       ) : (
         <div style={{ display: 'flex', flexDirection: 'column' }}>
         {issues.map(issue => (
          <div key={issue._id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.5rem', borderBottom: '1px solid var(--outline-variant)' }}>
            {isSuperior && (
              <input 
                type="checkbox"  
                style={{ marginLeft: '0.5rem' }}
                checked={selectedIds.has(issue._id)} 
                onChange={() => toggleSelect(issue._id)} 
              />
            )}
           <Link to={`/issues/${issue._id}`} className="issue-card" id={`issue-${issue._id}`} style={{ flex: 1, borderBottom: 'none', margin: 0, padding: '1rem 0.5rem' }}>
             <div className="issue-card-header">
               <div className="flex-1 min-w-0">
                 <div className="issue-card-num">#{String(issue._id).slice(-6).toUpperCase()}</div>
                 <div className="issue-card-title truncate">{issue.title}</div>
                 <div className="issue-card-resident">
                   <span className="material-symbols-outlined" style={{ fontSize: '12px', verticalAlign: 'middle' }}>person</span>
                   {' '}{issue.resident?.name ?? 'Unknown'}
                   {issue.resident?.corporation && ` · ${issue.resident.corporation}`}
                 </div>
               </div>
               <span className={`chip chip-${issue.priority}`}>{issue.priority}</span>
             </div>
             <div className="issue-card-footer">
               <span className={`chip chip-${issue.status}`}>{issue.status.replace('_', ' ')}</span>
               {issue.assignee && (
                 <span className="label-sm text-muted">
                   <span className="material-symbols-outlined" style={{ fontSize: '12px', verticalAlign: 'middle' }}>person_check</span>
                   {' '}{issue.assignee.name}
                 </span>
               )}
               <span className="label-sm text-muted" style={{ marginLeft: 'auto' }}>{formatDistanceToNow(issue.createdAt)}</span>
             </div>
           </Link>
          </div>
         ))}
         </div>
       )}

      <Link to="/issues/new" className="fab" id="fab-new-issue" aria-label="New issue">
        <span className="material-symbols-outlined">add</span>
      </Link>
    </>
  )
}
