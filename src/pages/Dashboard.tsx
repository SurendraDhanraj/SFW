import { useQuery, useMutation, useAction } from 'convex/react'
import { useState, useMemo } from 'react'
import { api } from '../../convex/_generated/api'
import { useAuthActions } from '@convex-dev/auth/react'
import { useUser } from '../context/UserContext'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from '../utils/date'

export default function Dashboard() {
  const user = useUser()
  const { signOut } = useAuthActions()
  const counts = useQuery(api.issues.getIssueCounts)
  const recentIssues = useQuery(api.issues.listIssues, { limit: 5 })
  const stats = useQuery(api.stats.getDashboardStats)
  const streetSummary = useQuery(api.stats.getStreetSummary)
  const issueDistrictStats = useQuery(api.issues.getIssueStatsByDistrict)
  const updateStats = useAction(api.stats.triggerStatsUpdate)
  
  const [tab, setTab] = useState<'summary' | 'issues'>('summary')
  const [refreshing, setRefreshing] = useState(false)
  const [tableExpanded, setTableExpanded] = useState(true)
  const [issuesTableExpanded, setIssuesTableExpanded] = useState(true)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const toggleNode = (id: string) => {
    const next = new Set(expandedNodes)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedNodes(next)
  }

  const groupedStats = useMemo(() => {
    if (!streetSummary) return {}
    const groups: Record<string, { total: number, pds: Record<string, { total: number, streets: Array<any> }> }> = {}
    
    streetSummary.forEach(row => {
      const md = row.municipalDistrict || 'Unknown District'
      const pd = row.pollingDivision || 'Unknown Division'
      const st = row.street || 'Unknown Street'
      
      if (!groups[md]) groups[md] = { total: 0, pds: {} }
      groups[md].total += row.residentCount
      
      if (!groups[md].pds[pd]) groups[md].pds[pd] = { total: 0, streets: [] }
      groups[md].pds[pd].total += row.residentCount
      groups[md].pds[pd].streets.push({ street: st, residentCount: row.residentCount })
    })
    return groups
  }, [streetSummary])

  const rowsToRender = useMemo(() => {
    const rows: Array<{ type: 'md' | 'pd' | 'st', id: string, mdLabel: string, pdLabel: string, stLabel: string, count: number }> = []
    Object.entries(groupedStats).forEach(([md, mdData]) => {
      rows.push({ type: 'md', id: md, mdLabel: md, pdLabel: '', stLabel: '', count: mdData.total })
      if (expandedNodes.has(md)) {
        Object.entries(mdData.pds).forEach(([pd, pdData]) => {
          const pdId = `${md}|${pd}`
          rows.push({ type: 'pd', id: pdId, mdLabel: '', pdLabel: pd, stLabel: '', count: pdData.total })
          if (expandedNodes.has(pdId)) {
            pdData.streets.forEach(st => {
              rows.push({ type: 'st', id: `${pdId}|${st.street}`, mdLabel: '', pdLabel: '', stLabel: st.street, count: st.residentCount })
            })
          }
        })
      }
    })
    return rows
  }, [groupedStats, expandedNodes])

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric'
  })

  return (
    <>
      {/* Hero */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-label">PARLIAMENTARY ELECTORAL DISTRICT</div>
        <div className="dashboard-hero-title">
          {user.name}
        </div>
        <div className="dashboard-hero-sub">{today}</div>
        <button
          id="sign-out-btn"
          onClick={() => signOut()}
          className="btn"
          style={{ 
            background: 'rgba(255, 255, 255, 0.1)', 
            color: '#ffffff', 
            border: '1px solid rgba(255, 255, 255, 0.2)',
            marginTop: '1.25rem', 
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>power_settings_new</span>
          Log Out
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginTop: '1rem' }}>
        <div className="stat-card primary">
          <div className="stat-value">{counts?.open ?? '—'}</div>
          <div className="stat-label">Open Issues</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--priority-critical)' }}>{counts?.critical ?? '—'}</div>
          <div className="stat-label">Critical</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{counts?.inProgress ?? '—'}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--status-closed)' }}>{counts?.closed ?? '—'}</div>
          <div className="stat-label">Closed</div>
        </div>
      </div>


      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn${tab === 'summary' ? ' active' : ''}`}
          onClick={() => setTab('summary')}
          style={{ fontWeight: '600', fontSize: '1.125rem', padding: '0.75rem 1.25rem' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>analytics</span>
          Resident Summary
        </button>
        <button
          className={`tab-btn${tab === 'issues' ? ' active' : ''}`}
          onClick={() => setTab('issues')}
          style={{ fontWeight: '600', fontSize: '1.125rem', padding: '0.75rem 1.25rem' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>list_alt</span>
          Issues
        </button>
      </div>

      {tab === 'summary' && (
        <div style={{ padding: '0 1rem' }}>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats?.residentCount?.toLocaleString() ?? '—'}</div>
              <div className="stat-label">Total Residents</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats?.homeCount?.toLocaleString() ?? '—'}</div>
              <div className="stat-label">Unique Homes</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats?.streetCount?.toLocaleString() ?? '—'}</div>
              <div className="stat-label">Unique Streets</div>
            </div>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
            <span className="label-sm text-muted">
              {stats?.lastUpdated ? `Last updated: ${formatDistanceToNow(stats.lastUpdated)}` : 'Never updated'}
            </span>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={async () => {
                setRefreshing(true)
                try {
                  await updateStats()
                } finally {
                  setRefreshing(false)
                }
              }}
              disabled={refreshing}
            >
              <span className="material-symbols-outlined icon-sm">{refreshing ? 'sync' : 'refresh'}</span>
              {refreshing ? 'Calculating...' : 'Refresh Stats'}
            </button>
          </div>

          {/* Counts Table Toggle */}
          <div 
            className="section-header" 
            style={{ marginTop: '2rem', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center' }}
            onClick={() => setTableExpanded(!tableExpanded)}
          >
            <span className="section-title" style={{ flex: 1 }}>Counts Breakdown</span>
            <span className="material-symbols-outlined">{tableExpanded ? 'expand_less' : 'expand_more'}</span>
          </div>

          {tableExpanded && (
            streetSummary === undefined ? (
               <div className="spinner-wrap" style={{ padding: '2rem' }}><div className="spinner" /></div>
            ) : streetSummary.length === 0 ? (
               <p className="body-md text-muted" style={{ padding: '1rem' }}>No data to display. Tap "Refresh Stats".</p>
            ) : (
              <div style={{ overflowX: 'auto', outline: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-md)' }}>
              <table style={{ width: '100%', minWidth: '450px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-container-high)', borderBottom: '1px solid var(--outline-variant)' }}>
                    <th style={{ padding: '0.75rem', fontWeight: 'var(--font-weight-medium)' }}>MUNICIPAL ELECTORAL DISTRICT</th>
                    <th style={{ padding: '0.75rem', fontWeight: 'var(--font-weight-medium)' }}>POLLING DIVISION</th>
                    <th style={{ padding: '0.75rem', fontWeight: 'var(--font-weight-medium)' }}>ADDRESS (street address)</th>
                    <th style={{ padding: '0.75rem', fontWeight: 'var(--font-weight-medium)', textAlign: 'right' }}>COUNTS</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsToRender.map((row, idx) => (
                    <tr 
                      key={row.id} 
                      onClick={() => row.type !== 'st' && toggleNode(row.id)}
                      style={{ 
                        borderBottom: '1px solid var(--outline-variant)', 
                        background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-container)',
                        cursor: row.type !== 'st' ? 'pointer' : 'default'
                      }}>
                      <td style={{ padding: '0.75rem', fontWeight: row.type === 'md' ? 'bold' : 'normal' }}>
                        {row.type === 'md' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span className="material-symbols-outlined icon-sm">{expandedNodes.has(row.id) ? 'expand_more' : 'chevron_right'}</span>
                            {row.mdLabel}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: row.type === 'pd' ? 'var(--font-weight-medium)' : 'normal', color: row.type === 'pd' ? 'var(--on-surface)' : 'inherit' }}>
                        {row.type === 'pd' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span className="material-symbols-outlined icon-sm">{expandedNodes.has(row.id) ? 'expand_more' : 'chevron_right'}</span>
                            {row.pdLabel}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--on-surface-variant)' }}>
                        {row.type === 'st' && row.stLabel}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: row.type !== 'st' ? 'bold' : 'normal' }}>
                        {row.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )
          )}
        </div>
      )}

      {tab === 'issues' && (
        <>
          <div 
            className="section-header" 
            style={{ marginTop: '0', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center' }}
            onClick={() => setIssuesTableExpanded(!issuesTableExpanded)}
          >
            <span className="section-title" style={{ flex: 1 }}>MUNICIPAL DISTRICT SUMMARY</span>
            <span className="material-symbols-outlined">{issuesTableExpanded ? 'expand_less' : 'expand_more'}</span>
          </div>

          {issuesTableExpanded && (
            issueDistrictStats === undefined ? (
               <div className="spinner-wrap" style={{ padding: '2rem' }}><div className="spinner" /></div>
            ) : issueDistrictStats.length === 0 ? (
               <p className="body-md text-muted" style={{ padding: '1rem' }}>No issues logged yet.</p>
            ) : (
              <div style={{ overflowX: 'auto', outline: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-md)', marginBottom: '2rem' }}>
              <table style={{ width: '100%', minWidth: '450px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-container-high)', borderBottom: '1px solid var(--outline-variant)' }}>
                    <th style={{ padding: '0.75rem', fontWeight: 'var(--font-weight-medium)' }}>MUNICIPAL ELECTORAL DISTRICT</th>
                    <th style={{ padding: '0.75rem', fontWeight: 'var(--font-weight-medium)', textAlign: 'right' }}>OPEN</th>
                    <th style={{ padding: '0.75rem', fontWeight: 'var(--font-weight-medium)', textAlign: 'right' }}>IN PROGRESS</th>
                    <th style={{ padding: '0.75rem', fontWeight: 'var(--font-weight-medium)', textAlign: 'right' }}>CLOSED</th>
                    <th style={{ padding: '0.75rem', fontWeight: 'var(--font-weight-medium)', textAlign: 'right' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {issueDistrictStats.map((row, idx) => (
                    <tr 
                      key={row.md} 
                      style={{ 
                        borderBottom: '1px solid var(--outline-variant)', 
                        background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-container)',
                      }}>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{row.md}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: row.open > 0 ? 'var(--status-open)' : 'inherit' }}>{row.open}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: row.inProgress > 0 ? 'var(--status-in-progress)' : 'inherit' }}>{row.inProgress}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: row.closed > 0 ? 'var(--status-closed)' : 'inherit' }}>{row.closed}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )
          )}
          
          <div className="section-header" style={{ marginTop: '1rem' }}>
            <span className="section-title">Priority Issues</span>
            <Link to="/issues" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}>View all</Link>
          </div>

          {recentIssues === undefined ? (
            <div className="spinner-wrap" style={{ padding: '2rem' }}><div className="spinner" /></div>
          ) : recentIssues.length === 0 ? (
            <div className="empty-state">
              <span className="material-symbols-outlined empty-state-icon">check_circle</span>
              <p className="empty-state-title">No open issues</p>
              <p className="empty-state-sub">All clear. Tap "New Issue" to log one.</p>
            </div>
          ) : (
            recentIssues.slice(0, 5).map((issue) => (
              <Link
                key={issue._id}
                to={`/issues/${issue._id}`}
                className="issue-card"
                id={`issue-card-${issue._id}`}
              >
                <div className="issue-card-header">
                  <div>
                    <div className="issue-card-num">#{String(issue._id).slice(-6).toUpperCase()}</div>
                    <div className="issue-card-title">{issue.title}</div>
                    <div className="issue-card-resident">
                      <span className="material-symbols-outlined" style={{ fontSize: '12px', verticalAlign: 'middle' }}>person</span>
                      {' '}{issue.resident?.name ?? 'Unknown'}
                    </div>
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
        </>
      )}

      <div style={{ height: '1rem' }} />
    </>
  )
}
