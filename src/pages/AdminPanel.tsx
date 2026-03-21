import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useUser } from '../context/UserContext'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { type Id } from '../../convex/_generated/dataModel'

type AdminTab = 'roles' | 'assign' | 'staff'

export default function AdminPanel() {
  const user = useUser()
  const navigate = useNavigate()
  const isDirector = user.role?.name === 'Director'

  const AVAILABLE_PERMISSIONS = [
    { id: 'all', label: 'Full System Access', icon: 'admin_panel_settings' },
    { id: 'close_issue', label: 'Close Issues', icon: 'check_circle' },
    { id: 'assign_sub_issue', label: 'Manage Sub-Issues', icon: 'add_task' },
    { id: 'create_issue', label: 'Create Issues', icon: 'add_box' },
    { id: 'upload_media', label: 'Upload Media', icon: 'attach_file' },
    { id: 'csv_upload', label: 'Bulk Data Upload', icon: 'upload_file' }
  ]

  useEffect(() => {
    if (!isDirector) navigate('/', { replace: true })
  }, [isDirector, navigate])

  const [tab, setTab] = useState<AdminTab>('staff')

  const roles = useQuery(api.roles.getRoleMemberCounts)
  const users = useQuery(api.users.listUsers)
  const allRoles = useQuery(api.roles.listRoles)
  const createRole = useMutation(api.roles.createRole)
  const updateRole = useMutation(api.roles.updateRole)
  const deleteRole = useMutation(api.roles.deleteRole)
  const assignRole = useMutation(api.users.assignRole)
  const toggleActive = useMutation(api.users.toggleUserActiveStatus)
  const seedRoles = useMutation(api.roles.seedDefaultRoles)

  const [showNewRole, setShowNewRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { seedRoles() }, [])

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault()
    if (!newRoleName.trim()) return
    setSaving(true)
    await createRole({ name: newRoleName.trim(), permissions: [] })
    setNewRoleName(''); setShowNewRole(false); setSaving(false)
  }

  async function handleAssignRole(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUserId || !selectedRoleId) return
    setSaving(true)
    await assignRole({ userId: selectedUserId as Id<'appUsers'>, roleId: selectedRoleId as Id<'roles'> })
    setSelectedUserId(''); setSelectedRoleId(''); setSaving(false)
  }

  async function handleToggleActive(userId: Id<'appUsers'>, isActive: boolean) {
    try {
      await toggleActive({ userId, isActive })
    } catch (err: any) {
      alert(err.message || 'Failed to update user status.')
    }
  }

  async function togglePermission(roleId: Id<'roles'>, currentPermissions: string[], permissionId: string) {
    let newPerms = [...currentPermissions]
    if (newPerms.includes(permissionId)) {
      newPerms = newPerms.filter(p => p !== permissionId)
    } else {
      newPerms.push(permissionId)
    }
    await updateRole({ roleId, permissions: newPerms })
  }

  async function handleDeleteRole(roleId: Id<'roles'>) {
    try {
      await deleteRole({ roleId })
      setConfirmDeleteId(null)
    } catch (err: any) {
      alert(err.message || 'Failed to delete role.')
    }
  }

  if (!isDirector) return null

  const filteredUsers = roleFilter === 'all'
    ? users
    : users?.filter(u => u.role?.name === roleFilter)

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-header-title">Admin Panel</div>
          <div className="page-header-subtitle">
            {users?.length ?? 0} personnel · {roles?.length ?? 0} roles
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button id="tab-staff" className={`tab-btn${tab === 'staff' ? ' active' : ''}`} onClick={() => setTab('staff')}>
          <span className="material-symbols-outlined icon-sm">group</span>
          Staff&nbsp;
          <span style={{ background: 'var(--primary-container)', color: 'var(--primary)', borderRadius: 'var(--radius-full)', padding: '0 5px', fontSize: '0.6rem', fontWeight: 700 }}>
            {users?.length ?? 0}
          </span>
        </button>
        <button id="tab-roles" className={`tab-btn${tab === 'roles' ? ' active' : ''}`} onClick={() => setTab('roles')}>
          <span className="material-symbols-outlined icon-sm">badge</span>
          Roles
        </button>
        <button id="tab-assign" className={`tab-btn${tab === 'assign' ? ' active' : ''}`} onClick={() => setTab('assign')}>
          <span className="material-symbols-outlined icon-sm">manage_accounts</span>
          Assign
        </button>
      </div>

      {/* ── Staff Tab ── */}
      {tab === 'staff' && (
        <>
          {/* Role filter chips */}
          <div style={{ display: 'flex', gap: '0.375rem', padding: '0.75rem 1rem 0.25rem', overflowX: 'auto', scrollbarWidth: 'none' }}>
            <button
              className={`chip${roleFilter === 'all' ? ' chip-open' : ''}`}
              style={{ cursor: 'pointer', border: 'none', fontSize: '0.75rem', padding: '0.3rem 0.75rem', background: roleFilter === 'all' ? 'var(--primary-container)' : 'var(--surface-container)', color: roleFilter === 'all' ? 'var(--primary)' : 'var(--on-surface-variant)' }}
              onClick={() => setRoleFilter('all')}
            >
              All Roles
            </button>
            {allRoles?.map(r => (
              <button
                key={r._id}
                className="chip"
                style={{ cursor: 'pointer', border: 'none', fontSize: '0.75rem', padding: '0.3rem 0.75rem', background: roleFilter === r.name ? 'var(--primary-container)' : 'var(--surface-container)', color: roleFilter === r.name ? 'var(--primary)' : 'var(--on-surface-variant)', whiteSpace: 'nowrap' }}
                onClick={() => setRoleFilter(roleFilter === r.name ? 'all' : r.name)}
              >
                {r.name}
              </button>
            ))}
          </div>

          {!filteredUsers || filteredUsers.length === 0 ? (
            <div className="empty-state">
              <span className="material-symbols-outlined empty-state-icon">group</span>
              <p className="empty-state-title">No personnel found</p>
              <p className="empty-state-sub">
                {roleFilter !== 'all' ? `No staff with role "${roleFilter}".` : 'Users appear here after signing up.'}
              </p>
            </div>
          ) : (
            filteredUsers.map(u => (
              <div key={u._id} className="personnel-row" id={`personnel-${u._id}`}>
                <div className="personnel-avatar" style={{ filter: u.isActive === false ? 'grayscale(1)' : 'none', opacity: u.isActive === false ? 0.5 : 1 }}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="personnel-name truncate" style={{ textDecoration: u.isActive === false ? 'line-through' : 'none', color: u.isActive === false ? 'var(--on-surface-variant)' : 'inherit' }}>{u.name}</div>
                  <div className="personnel-role truncate" style={{ opacity: u.isActive === false ? 0.6 : 1 }}>{u.email}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {u._id !== user?._id && (
                     <button className={`btn btn-sm ${u.isActive === false ? 'btn-ghost' : 'btn-danger'}`} style={{ padding: '0.25rem 0.5rem', fontSize: '0.6875rem' }} onClick={() => handleToggleActive(u._id as Id<'appUsers'>, u.isActive === false)}>
                       <span className="material-symbols-outlined icon-sm">{u.isActive === false ? 'person' : 'person_off'}</span>
                       {u.isActive === false ? 'Activate' : 'Deactivate'}
                     </button>
                  )}
                  <span style={{
                    fontSize: '0.6875rem', fontFamily: 'var(--font-label)', fontWeight: 600,
                    padding: '0.25rem 0.625rem', borderRadius: 'var(--radius-full)',
                    background: u.role?.name === 'Director' ? 'var(--primary-container)' : 'var(--surface-container)',
                    color: u.role?.name === 'Director' ? 'var(--primary)' : 'var(--on-surface-variant)',
                    whiteSpace: 'nowrap',
                    opacity: u.isActive === false ? 0.5 : 1
                  }}>
                    {u.role?.name ?? '—'}
                  </span>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* ── Roles Tab ── */}
      {tab === 'roles' && (
        <>
          <div className="section-header">
            <span className="section-title">Active Roles</span>
            <button id="new-role-btn" className="btn btn-ghost btn-sm" onClick={() => setShowNewRole(r => !r)}>
              <span className="material-symbols-outlined icon-sm">add</span> New Role
            </button>
          </div>

          {showNewRole && (
            <div style={{ padding: '0 1rem', marginBottom: '0.75rem' }}>
              <form onSubmit={handleCreateRole} style={{ display: 'flex', gap: '0.5rem' }} id="create-role-form">
                <input id="new-role-name" type="text" className="field-input" placeholder="Role name…"
                  value={newRoleName} onChange={e => setNewRoleName(e.target.value)} required style={{ flex: 1 }} />
                <button id="save-role-btn" type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? '…' : 'Save'}
                </button>
              </form>
            </div>
          )}

          {roles?.map(role => (
            <div key={role._id} className="role-card" id={`role-card-${role._id}`} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '1rem', cursor: 'pointer' }} onClick={() => setEditingRole(editingRole === role._id ? null : role._id)}>
                <div className="role-icon-wrap"><span className="material-symbols-outlined">badge</span></div>
                <div style={{ flex: 1 }}>
                  <div className="role-name">{role.name}</div>
                  <div className="role-count">{role.memberCount} {role.memberCount === 1 ? 'Member' : 'Members'}</div>
                </div>
                {role.name !== 'Director' && (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={(e) => { e.stopPropagation(); setEditingRole(editingRole === role._id ? null : role._id) }}>
                      <span className="material-symbols-outlined icon-sm">{editingRole === role._id ? 'expand_less' : 'edit'}</span>
                      {editingRole === role._id ? 'Close' : 'Features'}
                    </button>
                    {confirmDeleteId === role._id ? (
                      <button className="btn btn-danger btn-sm" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={(e) => { e.stopPropagation(); handleDeleteRole(role._id as Id<'roles'>) }}>
                        Confirm
                      </button>
                    ) : (
                      <button className="btn btn-ghost btn-sm" disabled={role.memberCount > 0} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: role.memberCount > 0 ? 'inherit' : 'var(--status-closed)' }} onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(role._id) }} title={role.memberCount > 0 ? "Cannot delete roles with active personnel" : "Delete Role"}>
                        <span className="material-symbols-outlined icon-sm">delete</span>
                      </button>
                    )}
                  </div>
                )}
                <span style={{ fontSize: '1.25rem', fontFamily: 'var(--font-headline)', fontWeight: 800, color: 'var(--on-surface-variant)', opacity: 0.4 }}>
                  {role.memberCount}
                </span>
              </div>
              
              {editingRole === role._id && role.name !== 'Director' && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--surface-container)' }}>
                  <div className="label-sm text-muted" style={{ marginBottom: '0.5rem' }}>Allowed Features</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
                    {AVAILABLE_PERMISSIONS.map(perm => {
                      const hasPerm = role.permissions?.includes(perm.id) || role.permissions?.includes('all')
                      return (
                        <div key={perm.id} onClick={() => { if (!role.permissions?.includes('all') || perm.id === 'all') togglePermission(role._id as Id<'roles'>, role.permissions || [], perm.id) }} 
                             style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--outline-variant)', cursor: (role.permissions?.includes('all') && perm.id !== 'all') ? 'not-allowed' : 'pointer', opacity: (role.permissions?.includes('all') && perm.id !== 'all') ? 0.5 : 1 }}>
                          <input type="checkbox" checked={hasPerm} readOnly style={{ accentColor: 'var(--primary)' }} />
                          <span className="material-symbols-outlined icon-sm text-muted">{perm.icon}</span>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-label)', color: 'var(--on-surface)' }}>{perm.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* ── Assign Tab ── */}
      {tab === 'assign' && (
        <>
          <div className="section-header">
            <span className="section-title">Assign Role to Staff</span>
          </div>
          <div style={{ padding: '0 1rem' }}>
            <form onSubmit={handleAssignRole} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} id="assign-role-form">
              <div className="field-group" style={{ marginBottom: 0 }}>
                <label className="field-label" htmlFor="select-user">Select Personnel</label>
                <select id="select-user" className="field-select" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} required>
                  <option value="">Choose staff member…</option>
                  {users?.map(u => (
                    <option key={u._id} value={u._id}>{u.name} — {u.email}</option>
                  ))}
                </select>
              </div>
              <div className="field-group" style={{ marginBottom: 0 }}>
                <label className="field-label" htmlFor="select-role">Assign Role</label>
                <select id="select-role" className="field-select" value={selectedRoleId} onChange={e => setSelectedRoleId(e.target.value)} required>
                  <option value="">Select role…</option>
                  {allRoles?.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                </select>
              </div>
              <button id="assign-role-btn" type="submit" className="btn btn-primary" disabled={saving || !selectedUserId || !selectedRoleId}>
                <span className="material-symbols-outlined icon-sm">person_check</span>
                {saving ? 'Assigning…' : 'Assign Role'}
              </button>
            </form>
          </div>
        </>
      )}

      <div style={{ height: '1rem' }} />
    </>
  )
}
