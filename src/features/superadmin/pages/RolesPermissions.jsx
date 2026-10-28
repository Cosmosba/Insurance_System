import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check, ChevronRight, LockKeyhole, Pencil, ShieldCheck, Users, X,
} from 'lucide-react'
import { getDepartments, subscribeToDepartments } from '../../../services/departmentData'
import { subscribeToStaffUsers } from '../../../services/userData'
import {
  PERMISSION_CATALOG,
  getRecentRoleAuditEvents,
  getRoleDirectory,
  getRoleSummary,
  getRolePermissionIds,
  resetRolePermissionOverrides,
  updateRolePermissions,
} from '../../../services/roleData'
import {
  canGrantPermissionToRole,
  SENSITIVE_PERMISSIONS,
  subscribeToRolePermissions,
} from '../../../services/rolePermissions'
import { subscribeToRoleAuditEvents } from '../../../services/roleAudit'
import '../styles/RolesPermissions.css'

function loadPageState() {
  let directory = []
  let summary = null
  let error = ''
  try {
    directory = getRoleDirectory()
    summary = getRoleSummary(directory)
  } catch (loadError) {
    error = loadError.message || 'Unable to load role information.'
  }

  let events = []
  let auditError = ''
  try {
    events = getRecentRoleAuditEvents()
  } catch (loadError) {
    auditError = loadError.message || 'Unable to load administrative history.'
  }
  let departments = []
  try {
    departments = getDepartments()
  } catch {
    auditError ||= 'Department assignments could not be resolved.'
  }
  return { directory, summary, events, departments, error, auditError }
}

function formatTimestamp(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getPermissionGroups() {
  const groups = new Map()
  for (const permission of PERMISSION_CATALOG) {
    if (!groups.has(permission.category)) groups.set(permission.category, [])
    groups.get(permission.category).push(permission)
  }
  return [...groups.entries()].map(([name, permissions]) => ({ name, permissions }))
}

export default function RolesPermissions() {
  const navigate = useNavigate()
  const editorRef = useRef(null)
  const [page, setPage] = useState(loadPageState)
  const [selectedRoleId, setSelectedRoleId] = useState(null)
  const [editingRoleId, setEditingRoleId] = useState(null)
  const [savedPermissions, setSavedPermissions] = useState([])
  const [draftPermissions, setDraftPermissions] = useState([])
  const [notice, setNotice] = useState(null)
  const groups = useMemo(() => getPermissionGroups(), [])
  const selectedRole = page.directory.find(role => role.id === selectedRoleId) ?? null
  const editingRole = page.directory.find(role => role.id === editingRoleId) ?? null
  const canRestoreDefaults = /role permission/i.test(page.error)
  const isDirty = editingRoleId && (
    savedPermissions.length !== draftPermissions.length
    || savedPermissions.some(id => !draftPermissions.includes(id))
  )

  const refresh = useCallback(() => setPage(loadPageState()), [])

  useEffect(() => {
    const refreshAll = () => refresh()
    const unsubscribeRoles = subscribeToRolePermissions(refreshAll)
    const unsubscribeStaff = subscribeToStaffUsers(refreshAll)
    const unsubscribeDepartments = subscribeToDepartments(refreshAll)
    const unsubscribeAudit = subscribeToRoleAuditEvents(refreshAll)
    return () => {
      unsubscribeRoles()
      unsubscribeStaff()
      unsubscribeDepartments()
      unsubscribeAudit()
    }
  }, [refresh])

  useEffect(() => {
    if (editingRoleId && editorRef.current && !editorRef.current.open) {
      editorRef.current.showModal()
    }
  }, [editingRoleId])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  function openEditor(role) {
    if (!role.configurable) return
    try {
      const permissions = getRolePermissionIds(role.id)
      setSavedPermissions(permissions)
      setDraftPermissions(permissions)
      setNotice(null)
      setEditingRoleId(role.id)
    } catch (error) {
      setNotice({ type: 'error', message: error.message || 'Unable to load this role.' })
    }
  }

  function closeEditor() {
    if (isDirty && !window.confirm('Discard unsaved permission changes?')) return
    setEditingRoleId(null)
    setSavedPermissions([])
    if (editorRef.current?.open) editorRef.current.close()
  }

  function togglePermission(permissionId) {
    setDraftPermissions(current => current.includes(permissionId)
      ? current.filter(id => id !== permissionId)
      : [...current, permissionId])
  }

  function updateCategory(categoryPermissions, selected) {
    const grantable = categoryPermissions
      .filter(permission => canGrantPermissionToRole(editingRoleId, permission.id))
      .map(permission => permission.id)
    setDraftPermissions(current => {
      const next = current.filter(id => !grantable.includes(id))
      return selected ? [...next, ...grantable] : next
    })
  }

  function handleSavePermissions(event) {
    event.preventDefault()
    if (!editingRole || !isDirty) return

    const newlyGrantedSensitive = draftPermissions.filter(permissionId => (
      !savedPermissions.includes(permissionId)
      && SENSITIVE_PERMISSIONS.has(permissionId)
    ))
    let confirmedSensitive = false
    if (newlyGrantedSensitive.length) {
      const names = newlyGrantedSensitive
        .map(id => PERMISSION_CATALOG.find(permission => permission.id === id)?.name ?? id)
        .join(', ')
      confirmedSensitive = window.confirm(
        `These permissions grant access to sensitive staff, department, or operational data: ${names}. Save these changes?`,
      )
      if (!confirmedSensitive) return
    }

    try {
      updateRolePermissions(editingRole.id, draftPermissions, { confirmedSensitive })
      setEditingRoleId(null)
      setSavedPermissions([])
      if (editorRef.current?.open) editorRef.current.close()
      setNotice({ type: 'success', message: `${editingRole.name} permissions saved.` })
      refresh()
    } catch (error) {
      if (error.details?.saved) {
        setEditingRoleId(null)
        setSavedPermissions([])
        if (editorRef.current?.open) editorRef.current.close()
        setNotice({ type: 'error', message: error.message })
        refresh()
        return
      }
      setNotice({ type: 'error', message: error.message || 'Unable to save role permissions.' })
    }
  }

  function handleRestoreDefaults() {
    if (!window.confirm('Restore the default permission profiles for all built-in roles?')) return
    try {
      resetRolePermissionOverrides()
      setNotice({ type: 'success', message: 'Default role permissions restored.' })
      refresh()
    } catch (error) {
      setNotice({ type: 'error', message: error.message || 'Unable to restore default role permissions.' })
      if (error.details?.saved) refresh()
    }
  }

  const summaryCards = page.summary
    ? [
      { label: 'Total Roles', value: page.summary.totalRoles, icon: ShieldCheck },
      { label: 'Total Staff Accounts', value: page.summary.totalStaffAccounts, icon: Users },
      { label: 'Active Staff Accounts', value: page.summary.activeStaffAccounts, icon: Check },
      { label: 'Roles Currently Assigned', value: page.summary.assignedRoles, icon: LockKeyhole },
    ]
    : []

  return (
    <section className="rp-page">
      <header className="rp-header">
        <div>
          <span className="rp-eyebrow">Superadmin workspace</span>
          <h1>Roles &amp; Permissions</h1>
          <p>Review role access and manage permissions for staff and customer roles.</p>
        </div>
      </header>

      {notice && (
        <div className={`rp-notice rp-notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          <span>{notice.message}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {page.error && (
        <div className="rp-error" role="alert">
          <span>{page.error}</span>
          {canRestoreDefaults && (
            <button type="button" className="rp-link-button" onClick={handleRestoreDefaults}>
              Restore default permissions
            </button>
          )}
        </div>
      )}

      {page.summary && (
        <section aria-labelledby="rp-summary-heading" className="rp-section">
          <h2 id="rp-summary-heading" className="rp-section-title">Role Overview</h2>
          <div className="rp-summary-grid">
            {summaryCards.map(({ label, value, icon: Icon }) => (
              <article key={label} className="rp-summary-card">
                <span className="rp-summary-icon" aria-hidden="true"><Icon size={19} /></span>
                <span className="rp-summary-value">{value}</span>
                <span className="rp-summary-label">{label}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="rp-section" aria-labelledby="rp-directory-heading">
        <div className="rp-section-heading">
          <div>
            <h2 id="rp-directory-heading" className="rp-section-title">Role Directory</h2>
            <p>Department assignments limit each staff member’s scope; cross-department access is not enabled.</p>
          </div>
        </div>
        <div className="rp-table-wrap">
          <table className="rp-table">
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Type</th>
                <th scope="col">Description</th>
                <th scope="col">Assigned users</th>
                <th scope="col">Permissions</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {page.directory.map(role => (
                <tr key={role.id}>
                  <td className="rp-role-name">{role.name}</td>
                  <td><span className="rp-type-badge">{role.type}</span></td>
                  <td className="rp-description">{role.description}</td>
                  <td>{role.assignedUsers}</td>
                  <td>{role.permissionCount}</td>
                  <td><span className="rp-status">Active</span></td>
                  <td className="rp-actions">
                    <button type="button" className="rp-link-button" onClick={() => setSelectedRoleId(role.id)}>
                      View
                    </button>
                    {role.configurable && (
                      <button type="button" className="rp-link-button" onClick={() => openEditor(role)}>
                        <Pencil size={14} aria-hidden="true" /> Edit Permissions
                      </button>
                    )}
                    {!role.configurable && (
                      <span className="rp-locked-label"><LockKeyhole size={13} aria-hidden="true" /> Protected</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRole && (
        <section className="rp-section rp-detail" aria-labelledby="rp-detail-heading">
          <div className="rp-section-heading">
            <div>
              <h2 id="rp-detail-heading" className="rp-section-title">{selectedRole.name}</h2>
              <p>{selectedRole.description}</p>
            </div>
            <button type="button" className="rp-close-detail" onClick={() => setSelectedRoleId(null)}>
              <X size={15} aria-hidden="true" /> Close
            </button>
          </div>
          <div className="rp-detail-stats">
            <span><strong>{selectedRole.assignedUsers}</strong> assigned user{selectedRole.assignedUsers === 1 ? '' : 's'}</span>
            <span><strong>{selectedRole.permissionCount}</strong> permissions</span>
            <span>{selectedRole.type} role</span>
          </div>
          {selectedRole.members.length ? (
            <>
              <div className="rp-member-list">
                {selectedRole.members.map(member => {
                  const department = page.departments.find(item => item.id === member.departmentId)
                  return (
                    <div className="rp-member" key={member.id}>
                      <div>
                        <strong>{member.name}</strong>
                        <span>{member.email}</span>
                      </div>
                      <span>{department?.name ?? (member.role === 'customer' ? 'Customer account' : 'Unassigned')}</span>
                      <span className={`rp-member-status${member.status === 'Inactive' ? ' rp-member-status--inactive' : ''}`}>
                        {member.status}
                      </span>
                    </div>
                  )
                })}
              </div>
              {selectedRole.id !== 'customer' && (
                <button type="button" className="rp-secondary-button" onClick={() => navigate('/admin/users')}>
                  Manage staff role assignments <ChevronRight size={15} aria-hidden="true" />
                </button>
              )}
            </>
          ) : (
            <p className="rp-empty">No accounts are currently assigned to this role.</p>
          )}
        </section>
      )}

      <section className="rp-section" aria-labelledby="rp-matrix-heading">
        <div className="rp-section-heading">
          <div>
            <h2 id="rp-matrix-heading" className="rp-section-title">Permission Matrix</h2>
            <p>Compare role access by permission. Open Edit Permissions to change a configurable role.</p>
          </div>
        </div>
        <div className="rp-matrix-wrap" role="region" aria-label="Role permission comparison" tabIndex="0">
          <table className="rp-matrix">
            <thead>
              <tr>
                <th scope="col">Permission</th>
                {page.directory.map(role => (
                  <th scope="col" key={role.id}>{role.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <PermissionGroup
                  key={group.name}
                  group={group}
                  roles={page.directory}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rp-section" aria-labelledby="rp-history-heading">
        <div className="rp-section-heading">
          <div>
            <h2 id="rp-history-heading" className="rp-section-title">Recent Access Changes</h2>
            <p>Local administrative history records changes made in this browser.</p>
          </div>
        </div>
        {page.auditError && <div className="rp-error" role="alert">{page.auditError}</div>}
        {page.events.length === 0 ? (
          <p className="rp-empty">No permission changes have been recorded.</p>
        ) : (
          <div className="rp-history-list">
            {page.events.map(event => (
              <article className="rp-history-item" key={event.id}>
                <div>
                  <strong>{event.action}</strong>
                  <span>{event.targetName}{event.details ? ` · ${event.details}` : ''}</span>
                </div>
                <div className="rp-history-meta">
                  <span>{event.actor ?? 'Actor unavailable'}</span>
                  <time dateTime={event.timestamp}>{formatTimestamp(event.timestamp)}</time>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="rp-security-note">
        Permission settings are stored in this browser. A production service must enforce access on the server.
      </p>

      <dialog
        ref={editorRef}
        className="rp-dialog"
        aria-labelledby="rp-editor-title"
        onCancel={event => {
          event.preventDefault()
          closeEditor()
        }}
        onClose={() => setEditingRoleId(null)}
      >
        {editingRole && (
          <form onSubmit={handleSavePermissions}>
            <header className="rp-dialog-header">
              <div>
                <span className="rp-eyebrow">Permission profile</span>
                <h2 id="rp-editor-title">Edit {editingRole.name}</h2>
                <p>Changes apply to this role profile, not to the current administrator.</p>
              </div>
              <button type="button" className="rp-icon-button" aria-label="Close editor" onClick={closeEditor}>
                <X size={18} />
              </button>
            </header>
            <div className="rp-editor-body">
              {groups.map(group => {
                const selectable = group.permissions.filter(permission => (
                  canGrantPermissionToRole(editingRole.id, permission.id)
                ))
                const selectedCount = selectable.filter(permission => draftPermissions.includes(permission.id)).length
                return (
                  <fieldset className="rp-permission-group" key={group.name}>
                    <legend>{group.name}</legend>
                    <div className="rp-group-actions">
                      <span>{selectedCount} of {selectable.length} allowed</span>
                      <button type="button" onClick={() => updateCategory(group.permissions, true)}>Select all</button>
                      <button type="button" onClick={() => updateCategory(group.permissions, false)}>Clear all</button>
                    </div>
                    {group.permissions.map(permission => {
                      const grantable = canGrantPermissionToRole(editingRole.id, permission.id)
                      return (
                        <label className={`rp-permission-option${!grantable ? ' rp-permission-option--locked' : ''}`} key={permission.id}>
                          <input
                            type="checkbox"
                            checked={draftPermissions.includes(permission.id)}
                            disabled={!grantable}
                            onChange={() => togglePermission(permission.id)}
                          />
                          <span className="rp-permission-option-text">
                            <span className="rp-permission-option-title">
                              {permission.name}
                              {!permission.implemented && <span className="rp-planned">Not available yet</span>}
                              {!grantable && <span className="rp-planned">Restricted</span>}
                            </span>
                            <span className="rp-permission-description">{permission.description}</span>
                          </span>
                        </label>
                      )
                    })}
                  </fieldset>
                )
              })}
            </div>
            <footer className="rp-dialog-footer">
              {isDirty && <span className="rp-unsaved">Unsaved changes</span>}
              <button type="button" className="rp-secondary-button" onClick={closeEditor}>Cancel</button>
              <button type="submit" className="rp-primary-button" disabled={!isDirty}>Save permissions</button>
            </footer>
          </form>
        )}
      </dialog>
    </section>
  )
}

function PermissionGroup({ group, roles }) {
  return (
    <>
      <tr className="rp-matrix-category">
        <th scope="rowgroup" colSpan={roles.length + 1}>{group.name}</th>
      </tr>
      {group.permissions.map(permission => (
        <tr key={permission.id}>
          <th scope="row">
            <span className="rp-matrix-permission-name">{permission.name}</span>
            <span className="rp-matrix-description">{permission.description}</span>
            {!permission.implemented && <span className="rp-planned">Not available yet</span>}
          </th>
          {roles.map(role => (
            <td key={role.id} className="rp-matrix-cell">
              {role.permissions.includes(permission.id)
                ? <Check size={17} className="rp-matrix-allowed" aria-label={`${role.name}: allowed`} />
                : <span className="rp-matrix-denied" aria-label={`${role.name}: not allowed`}>—</span>}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
