import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle, ArrowLeft, BriefcaseBusiness, Check, ChevronRight, CircleUserRound,
  Eye, Filter, Mail, Pencil, Plus, Search, ShieldCheck, ToggleLeft, ToggleRight, Upload, X,
} from 'lucide-react'
import { getDepartments, subscribeToDepartments } from '../../services/departmentData'
import { getSession } from '../../services/mockAuth'
import { hasPermission } from '../../services/rolePermissions'
import {
  createStaffUser,
  filterStaffUsers,
  getDepartmentStaffMembers,
  getManagedDepartments,
  getManagerAssignmentChanges,
  getStaffSummary,
  getStaffUserById,
  getStaffUsers,
  STAFF_ROLES,
  subscribeToStaffUsers,
  updateStaffUser,
  setStaffUserStatus,
  UserDataError,
} from '../../services/userData'
import StaffBulkUpload from './StaffBulkUpload'
import './UserManagement.css'

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  employeeId: '',
  role: 'department_staff',
  departmentId: '',
  status: 'Active',
}

const ROLE_LABELS = Object.fromEntries(STAFF_ROLES.map(role => [role.value, role.label]))

function getDirectoryState() {
  try {
    return {
      users: getStaffUsers(),
      departments: getDepartments(),
      error: '',
    }
  } catch (error) {
    return {
      users: [],
      departments: [],
      error: error.message || 'Unable to load staff and department records.',
    }
  }
}

function formatDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function nameOf(user) {
  return `${user.firstName} ${user.lastName}`.trim()
}

function getDepartmentLabel(user, departments) {
  if (!user.departmentId) return 'Unassigned'
  const department = departments.find(record => record.id === user.departmentId)
  return department
    ? `${department.name}${department.status === 'Inactive' ? ' (Inactive)' : ''}`
    : 'Department unavailable'
}

function getManagedDepartmentNames(userId) {
  try {
    return getManagedDepartments(userId).map(department => department.name)
  } catch {
    return []
  }
}

export default function UserManagement() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dialogRef = useRef(null)
  const [directory, setDirectory] = useState(getDirectoryState)
  const { users, departments, error } = directory
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    role: '',
    departmentId: '',
  })
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [formMessage, setFormMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false)
  const [pendingId, setPendingId] = useState(null)
  const [notice, setNotice] = useState(null)

  const refreshDirectory = useCallback(() => setDirectory(getDirectoryState()), [])

  useEffect(() => {
    const unsubscribeUsers = subscribeToStaffUsers(refreshDirectory)
    const unsubscribeDepartments = subscribeToDepartments(refreshDirectory)
    return () => {
      unsubscribeUsers()
      unsubscribeDepartments()
    }
  }, [refreshDirectory])

  useEffect(() => {
    if (formOpen && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal()
    }
  }, [formOpen])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const selectedUser = useMemo(
    () => users.find(user => user.id === id) ?? null,
    [id, users],
  )
  const summary = useMemo(() => getStaffSummary(users, departments), [users, departments])
  const visibleUsers = useMemo(() => filterStaffUsers(users, search, {
    ...filters,
    validDepartmentIds: departments.map(department => department.id),
  }), [departments, filters, search, users])
  const activeDepartments = departments.filter(department => department.status === 'Active')
  const canBulkUpload = hasPermission(getSession(), 'users.create')

  function clearFilters() {
    setSearch('')
    setFilters({ status: '', role: '', departmentId: '' })
  }

  function openCreateForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setFormMessage('')
    setFormOpen(true)
  }

  function openEditForm(user) {
    setEditingId(user.id)
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? '',
      employeeId: user.employeeId ?? '',
      role: user.role,
      departmentId: user.departmentId ?? '',
      status: user.status,
    })
    setFormErrors({})
    setFormMessage('')
    setFormOpen(true)
  }

  function closeForm() {
    if (saving) return
    setFormOpen(false)
    setFormErrors({})
    setFormMessage('')
  }

  function handleFieldChange(event) {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
    setFormErrors(current => ({ ...current, [name]: '' }))
    setFormMessage('')
  }

  function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setFormErrors({})
    setFormMessage('')
    try {
      if (editingId) {
        const existing = getStaffUserById(editingId)
        if (!existing) throw new UserDataError('This staff account no longer exists.')
        const roleChanged = existing.role !== form.role
        if (roleChanged && !window.confirm(
          `Change ${nameOf(existing)}'s role from ${ROLE_LABELS[existing.role]} to ${ROLE_LABELS[form.role]}?`,
        )) return
        const nextDepartmentId = form.departmentId || null
        const departmentChanged = existing.departmentId !== nextDepartmentId
        if (departmentChanged) {
          const previousDepartment = departments.find(item => item.id === existing.departmentId)
          const nextDepartment = departments.find(item => item.id === nextDepartmentId)
          const confirmed = window.confirm(
            `Transfer ${nameOf(existing)} from ${previousDepartment?.name ?? 'Unassigned'} `
            + `to ${nextDepartment?.name ?? 'Unassigned'}?`,
          )
          if (!confirmed) return
        }

        const managedDepartments = getManagerAssignmentChanges(editingId, form)
        if (managedDepartments.length) {
          const names = managedDepartments.map(item => item.name).join(', ')
          const confirmed = window.confirm(
            `This change will remove ${nameOf(existing)} as manager of ${names}. Continue?`,
          )
          if (!confirmed) return
        }

        updateStaffUser(editingId, form, {
          confirmManagerChanges: true,
          confirmedRoleChange: roleChanged,
        })
        setNotice({ type: 'success', message: 'Staff account changes saved in this browser.' })
      } else {
        const confirmedRoleChange = form.role === 'superadmin'
          ? window.confirm('Assign the highly privileged Superadmin role to this account?')
          : form.role !== 'department_staff'
            ? window.confirm(`Create this account with the ${ROLE_LABELS[form.role]} role?`)
            : false
        if (form.role !== 'department_staff' && !confirmedRoleChange) return
        createStaffUser(form, { confirmedRoleChange })
        setNotice({ type: 'success', message: 'Staff account added in this browser.' })
      }
      refreshDirectory()
      setFormOpen(false)
    } catch (saveError) {
      if (saveError.details?.saved) {
        refreshDirectory()
        setFormOpen(false)
        setNotice({ type: 'error', message: saveError.message })
        return
      }
      if (saveError instanceof UserDataError && Object.keys(saveError.fieldErrors).length) {
        setFormErrors(saveError.fieldErrors)
        setFormMessage(saveError.message)
      } else {
        setFormMessage(saveError.message || 'Unable to save this staff account.')
      }
    } finally {
      setSaving(false)
    }
  }

  function handleStatusChange(user) {
    const nextStatus = user.status === 'Active' ? 'Inactive' : 'Active'
    const verb = nextStatus === 'Inactive' ? 'Deactivate' : 'Activate'
    const managedDepartments = nextStatus === 'Inactive'
      ? getManagedDepartmentNames(user.id)
      : []
    const managerNote = managedDepartments.length
      ? ` This will unassign them as manager of ${managedDepartments.join(', ')}.`
      : ''
    const confirmed = window.confirm(`${verb} ${nameOf(user)}'s account?${managerNote}`)
    if (!confirmed) return

    setPendingId(user.id)
    try {
      setStaffUserStatus(user.id, nextStatus, { confirmManagerChanges: true })
      refreshDirectory()
      setNotice({ type: 'success', message: `${nameOf(user)}'s account is now ${nextStatus.toLowerCase()}.` })
    } catch (statusError) {
      if (statusError.details?.saved) refreshDirectory()
      setNotice({ type: 'error', message: statusError.message || 'Unable to update this account.' })
    } finally {
      setPendingId(null)
    }
  }

  function showDetails(user) {
    navigate(`/admin/users/${user.id}`)
  }

  function returnToDirectory() {
    navigate('/admin/users')
  }

  const userForm = (
    <UserDialog
      ref={dialogRef}
      open={formOpen}
      editing={Boolean(editingId)}
      authManaged={Boolean(users.find(user => user.id === editingId)?.authManaged)}
      form={form}
      errors={formErrors}
      message={formMessage}
      departments={departments}
      activeDepartments={activeDepartments}
      saving={saving}
      onChange={handleFieldChange}
      onSubmit={handleSave}
      onClose={closeForm}
    />
  )

  if (id && error) {
    return (
      <section className="um-page">
        <ErrorPanel message={error} />
        <button type="button" className="um-button um-button--secondary" onClick={returnToDirectory}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to staff
        </button>
      </section>
    )
  }

  if (id && !selectedUser) {
    return (
      <section className="um-page">
        <button type="button" className="um-back-link" onClick={returnToDirectory}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to User Management
        </button>
        <div className="um-empty">
          <CircleUserRound size={28} aria-hidden="true" />
          <h2>Staff account not found</h2>
          <p>The account may no longer be available in the staff directory.</p>
        </div>
      </section>
    )
  }

  if (id && selectedUser) {
    let departmentMembers = []
    let memberLoadError = ''
    if (selectedUser.departmentId) {
      try {
        departmentMembers = getDepartmentStaffMembers(selectedUser.departmentId)
      } catch (staffError) {
        memberLoadError = staffError.message || 'Unable to load department assignments.'
      }
    }
    return (
      <section className="um-page">
        {notice && <Notice notice={notice} onDismiss={() => setNotice(null)} />}
        <button type="button" className="um-back-link" onClick={returnToDirectory}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to User Management
        </button>

        <header className="um-header um-header--detail">
          <div className="um-heading">
            <span className="um-eyebrow">Superadmin / User Management</span>
            <div className="um-title-line">
              <h1>{nameOf(selectedUser)}</h1>
              <StatusBadge status={selectedUser.status} />
            </div>
            <p>Staff account information and department assignment.</p>
          </div>
          <div className="um-header-actions">
            <button type="button" className="um-button um-button--secondary" onClick={() => openEditForm(selectedUser)}>
              <Pencil size={16} aria-hidden="true" /> Edit account
            </button>
            <button
              type="button"
              className={`um-button ${selectedUser.status === 'Active' ? 'um-button--warning' : 'um-button--primary'}`}
              onClick={() => handleStatusChange(selectedUser)}
              disabled={pendingId === selectedUser.id}
            >
              {selectedUser.status === 'Active'
                ? <ToggleLeft size={17} aria-hidden="true" />
                : <ToggleRight size={17} aria-hidden="true" />}
              {selectedUser.status === 'Active' ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </header>

        {error && <ErrorPanel message={error} />}
        {memberLoadError && <ErrorPanel message={memberLoadError} />}
        <div className="um-detail-grid">
          <article className="um-card um-detail-card">
            <div className="um-card-heading">
              <span className="um-card-icon"><CircleUserRound size={18} aria-hidden="true" /></span>
              <div>
                <h2>Account information</h2>
                <p>Identity, role, and status</p>
              </div>
            </div>
            <dl className="um-info-grid">
              <InfoItem label="Full name" value={nameOf(selectedUser)} />
              <InfoItem label="Work email" value={selectedUser.email} />
              {selectedUser.phone && <InfoItem label="Phone number" value={selectedUser.phone} />}
              {selectedUser.employeeId && <InfoItem label="Employee ID" value={selectedUser.employeeId} mono />}
              <InfoItem label="Role" value={<RoleBadge role={selectedUser.role} />} />
              <InfoItem label="Account status" value={<StatusBadge status={selectedUser.status} />} />
              <InfoItem label="Department" value={getDepartmentLabel(selectedUser, departments)} />
              <InfoItem label="Created" value={formatDate(selectedUser.createdAt)} />
              <InfoItem label="Last updated" value={formatDate(selectedUser.updatedAt)} />
              <InfoItem label="Managed department" value={getManagedDepartmentNames(selectedUser.id).join(', ') || 'None'} wide />
            </dl>
          </article>

          <article className="um-card um-detail-card">
            <div className="um-card-heading">
              <span className="um-card-icon"><BriefcaseBusiness size={18} aria-hidden="true" /></span>
              <div>
                <h2>Department assignment</h2>
                <p>Current assignment and colleagues</p>
              </div>
            </div>
            <p className="um-assignment-name">{getDepartmentLabel(selectedUser, departments)}</p>
            {selectedUser.departmentId && departmentMembers.length > 0 ? (
              <ul className="um-member-list">
                {departmentMembers.map(member => (
                  <li key={member.id}>
                    <span>{member.name}</span>
                    <RoleBadge role={member.role} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="um-muted">
                {selectedUser.departmentId ? 'No other staff assignments are available.' : 'This account has no department assignment.'}
              </p>
            )}
          </article>
        </div>
        {userForm}
      </section>
    )
  }

  const hasFilters = Boolean(search.trim() || filters.status || filters.role || filters.departmentId)

  return (
    <section className="um-page">
      {notice && <Notice notice={notice} onDismiss={() => setNotice(null)} />}
      <header className="um-header">
        <div className="um-heading">
          <span className="um-eyebrow">Superadmin workspace</span>
          <h1>User Management</h1>
          <p>Manage staff accounts, roles, department assignments, and account access.</p>
        </div>
        <div className="um-header-actions">
          {canBulkUpload && (
            <button
              type="button"
              className="um-button um-button--secondary"
              onClick={() => setBulkUploadOpen(true)}
            >
              <Upload size={16} aria-hidden="true" /> Bulk Upload
            </button>
          )}
          <button type="button" className="um-button um-button--primary" onClick={openCreateForm}>
            <Plus size={17} aria-hidden="true" /> Add Staff Member
          </button>
        </div>
      </header>

      {error && <ErrorPanel message={error} />}

      <section className="um-summary-grid" aria-label="Staff account summary">
        <SummaryCard label="Total Staff Accounts" value={summary.total} icon={CircleUserRound} />
        <SummaryCard label="Active Accounts" value={summary.active} icon={Check} tone="green" />
        <SummaryCard label="Inactive Accounts" value={summary.inactive} icon={ToggleLeft} tone="slate" />
        <SummaryCard label="Department Managers" value={summary.managers} icon={ShieldCheck} tone="blue" />
        <SummaryCard label="Unassigned Staff" value={summary.unassigned} icon={BriefcaseBusiness} tone="amber" />
      </section>

      <section className="um-card um-directory-card" aria-labelledby="um-directory-heading">
        <div className="um-directory-heading">
          <div>
            <h2 id="um-directory-heading">Staff directory</h2>
            <p>Search accounts and combine role, status, and department filters.</p>
          </div>
          <span className="um-result-count" aria-live="polite">{visibleUsers.length} of {users.length}</span>
        </div>

        <div className="um-toolbar">
          <label className="um-search">
            <Search size={17} aria-hidden="true" />
            <span className="um-sr-only">Search staff</span>
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Name, email, or employee ID"
            />
            {search && (
              <button type="button" className="um-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </label>
          <label className="um-filter">
            <Filter size={15} aria-hidden="true" />
            <span className="um-sr-only">Filter by account status</span>
            <select value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}>
              <option value="">All accounts</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
          <label className="um-filter">
            <ShieldCheck size={15} aria-hidden="true" />
            <span className="um-sr-only">Filter by role</span>
            <select value={filters.role} onChange={event => setFilters(current => ({ ...current, role: event.target.value }))}>
              <option value="">All roles</option>
              {STAFF_ROLES.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </label>
          <label className="um-filter um-filter--department">
            <BriefcaseBusiness size={15} aria-hidden="true" />
            <span className="um-sr-only">Filter by department</span>
            <select value={filters.departmentId} onChange={event => setFilters(current => ({ ...current, departmentId: event.target.value }))}>
              <option value="">All departments</option>
              <option value="assigned">Assigned department</option>
              <option value="unassigned">Unassigned department</option>
              {departments.map(department => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </label>
          {hasFilters && (
            <button type="button" className="um-clear-filters" onClick={clearFilters}>Clear filters</button>
          )}
        </div>

        {visibleUsers.length === 0 ? (
          <div className="um-empty">
            <CircleUserRound size={29} aria-hidden="true" />
            <h3>{users.length ? 'No matching staff accounts' : 'No staff accounts yet'}</h3>
            <p>{users.length
              ? 'Try a different search or clear your filters.'
              : 'Add a staff account to begin managing access and department assignments.'}</p>
            {hasFilters && (
              <button type="button" className="um-button um-button--secondary" onClick={clearFilters}>
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <div className="um-table-wrap">
            <table className="um-table">
              <thead>
                <tr>
                  <th scope="col">Staff Member</th>
                  <th scope="col">Employee ID</th>
                  <th scope="col">Department</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Date Created</th>
                  <th scope="col"><span className="um-sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map(user => (
                  <tr key={user.id}>
                    <td>
                      <button type="button" className="um-user-link" onClick={() => showDetails(user)}>
                        <span className="um-avatar" aria-hidden="true">
                          {`${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()}
                        </span>
                        <span className="um-user-copy">
                          <span className="um-user-name">{nameOf(user)}</span>
                          <span className="um-user-email"><Mail size={12} aria-hidden="true" />{user.email}</span>
                        </span>
                      </button>
                    </td>
                    <td className="um-mono">{user.employeeId || '—'}</td>
                    <td className="um-department-cell">{getDepartmentLabel(user, departments)}</td>
                    <td><RoleBadge role={user.role} /></td>
                    <td><StatusBadge status={user.status} /></td>
                    <td className="um-date">{formatDate(user.createdAt)}</td>
                    <td>
                      <div className="um-row-actions">
                        <button type="button" className="um-icon-button" onClick={() => showDetails(user)} aria-label={`View ${nameOf(user)}`} title="View details">
                          <Eye size={16} aria-hidden="true" />
                        </button>
                        <button type="button" className="um-icon-button" onClick={() => openEditForm(user)} aria-label={`Edit ${nameOf(user)}`} title="Edit account">
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={`um-icon-button ${user.status === 'Active' ? 'um-icon-button--warning' : 'um-icon-button--success'}`}
                          onClick={() => handleStatusChange(user)}
                          disabled={pendingId === user.id}
                          aria-label={`${user.status === 'Active' ? 'Deactivate' : 'Activate'} ${nameOf(user)}`}
                          title={user.status === 'Active' ? 'Deactivate' : 'Activate'}
                        >
                          {user.status === 'Active'
                            ? <ToggleLeft size={17} aria-hidden="true" />
                            : <ToggleRight size={17} aria-hidden="true" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {userForm}
      {canBulkUpload && (
        <StaffBulkUpload
          open={bulkUploadOpen}
          onClose={() => setBulkUploadOpen(false)}
          onImported={count => {
            refreshDirectory()
            setNotice({
              type: 'success',
              message: `${count} staff profile${count === 1 ? '' : 's'} added to the directory.`,
            })
          }}
        />
      )}
    </section>
  )
}

function SummaryCard({ label, value, icon: Icon, tone = 'green' }) {
  return (
    <article className={`um-summary-card um-summary-card--${tone}`}>
      <span className="um-summary-icon"><Icon size={19} aria-hidden="true" /></span>
      <span className="um-summary-value">{value}</span>
      <span className="um-summary-label">{label}</span>
    </article>
  )
}

function StatusBadge({ status }) {
  return (
    <span className={`um-status um-status--${status === 'Active' ? 'active' : 'inactive'}`}>
      <span aria-hidden="true" />{status}
    </span>
  )
}

function RoleBadge({ role }) {
  const label = ROLE_LABELS[role] ?? 'Unknown Role'
  return (
    <span className={`um-role um-role--${role}`}>
      {role === 'superadmin' && <ShieldCheck size={12} aria-hidden="true" />}
      {label}
    </span>
  )
}

function InfoItem({ label, value, mono = false, wide = false }) {
  return (
    <div className={`um-info-item${wide ? ' um-info-item--wide' : ''}`}>
      <dt>{label}</dt>
      <dd className={mono ? 'um-mono' : ''}>{value}</dd>
    </div>
  )
}

function ErrorPanel({ message }) {
  return (
    <div className="um-error-panel" role="alert">
      <AlertCircle size={18} aria-hidden="true" /><span>{message}</span>
    </div>
  )
}

function Notice({ notice, onDismiss }) {
  return (
    <div className={`um-notice um-notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
      {notice.type === 'success' ? <Check size={17} aria-hidden="true" /> : <AlertCircle size={17} aria-hidden="true" />}
      <span>{notice.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification"><X size={16} aria-hidden="true" /></button>
    </div>
  )
}

function UserDialog({
  ref,
  open,
  editing,
  authManaged,
  form,
  errors,
  message,
  departments,
  activeDepartments,
  saving,
  onChange,
  onSubmit,
  onClose,
}) {
  if (!open) return null
  const existingInactiveDepartment = departments.find(item => item.id === form.departmentId && item.status !== 'Active')

  return (
    <dialog
      ref={ref}
      className="um-dialog"
      aria-labelledby="um-dialog-title"
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form className="um-dialog-form" onSubmit={onSubmit} noValidate>
        <header className="um-dialog-header">
          <div>
            <span className="um-dialog-icon"><CircleUserRound size={19} aria-hidden="true" /></span>
            <h2 id="um-dialog-title">{editing ? 'Edit staff account' : 'Add staff member'}</h2>
            <p>Set account identity, access role, and department assignment. Login credentials are managed separately.</p>
          </div>
          <button type="button" className="um-icon-button" onClick={onClose} aria-label="Close form" disabled={saving}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {message && <div className="um-form-message" role="alert">{message}</div>}

        <div className="um-form-grid">
          <FormField label="First name" required error={errors.firstName} id="um-firstName">
            <input id="um-firstName" name="firstName" value={form.firstName} onChange={onChange} autoFocus required aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? 'um-firstName-error' : undefined} />
          </FormField>
          <FormField label="Last name" required error={errors.lastName} id="um-lastName">
            <input id="um-lastName" name="lastName" value={form.lastName} onChange={onChange} required aria-invalid={Boolean(errors.lastName)} aria-describedby={errors.lastName ? 'um-lastName-error' : undefined} />
          </FormField>
          <FormField label="Work email" required error={errors.email} id="um-email">
            <input id="um-email" name="email" type="email" autoComplete="email" value={form.email} onChange={onChange} required disabled={authManaged} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'um-email-error' : undefined} />
            {authManaged && <span className="um-field-hint">The existing sign-in email is managed separately.</span>}
          </FormField>
          <FormField label="Phone number" optional error={errors.phone} id="um-phone">
            <input id="um-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={onChange} aria-invalid={Boolean(errors.phone)} />
          </FormField>
          <FormField label="Employee ID" optional error={errors.employeeId} id="um-employeeId">
            <input id="um-employeeId" name="employeeId" value={form.employeeId} onChange={onChange} aria-invalid={Boolean(errors.employeeId)} aria-describedby={errors.employeeId ? 'um-employeeId-error' : undefined} />
          </FormField>
          <FormField label="Role" required error={errors.role} id="um-role">
            <select id="um-role" name="role" value={form.role} onChange={onChange} disabled={authManaged} aria-invalid={Boolean(errors.role)} aria-describedby={errors.role ? 'um-role-error' : undefined}>
              {STAFF_ROLES.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
            {authManaged && <span className="um-field-hint">The existing sign-in role is managed separately.</span>}
          </FormField>
          <FormField label="Department" optional error={errors.departmentId} id="um-departmentId">
            <select id="um-departmentId" name="departmentId" value={form.departmentId} onChange={onChange} aria-invalid={Boolean(errors.departmentId)} aria-describedby={errors.departmentId ? 'um-departmentId-error' : undefined}>
              <option value="">Unassigned</option>
              {existingInactiveDepartment && (
                <option value={existingInactiveDepartment.id}>
                  {existingInactiveDepartment.name} (Inactive — current assignment)
                </option>
              )}
              {activeDepartments.map(department => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
            {!departments.length && <span className="um-field-hint">No departments are available.</span>}
          </FormField>
          <FormField label="Account status" required error={errors.status} id="um-status">
            <select id="um-status" name="status" value={form.status} onChange={onChange} aria-invalid={Boolean(errors.status)} aria-describedby={errors.status ? 'um-status-error' : undefined}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </FormField>
        </div>

        <footer className="um-dialog-footer">
          <span className="um-required-note"><b aria-hidden="true">*</b> Required fields</span>
          <div>
            <button type="button" className="um-button um-button--secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="um-button um-button--primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Save staff member'}
              {!saving && <ChevronRight size={16} aria-hidden="true" />}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  )
}

function FormField({ label, required = false, optional = false, error, id, children }) {
  return (
    <label className="um-form-field" htmlFor={id}>
      <span>{label} {required && <b aria-hidden="true">*</b>}{optional && <em>Optional</em>}</span>
      {children}
      {error && <span className="um-field-error" id={`${id}-error`}>{error}</span>}
    </label>
  )
}
