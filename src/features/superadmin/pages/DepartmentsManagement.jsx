import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle, ArrowLeft, Building2, Check, ChevronRight, CircleUserRound,
  Eye, Filter, Pencil, Plus, Search, ToggleLeft, ToggleRight, X,
} from 'lucide-react'
import {
  createDepartment,
  DepartmentDataError,
  getDepartmentById,
  getDepartmentSummary,
  getDepartments,
  filterDepartments,
  subscribeToDepartments,
  updateDepartment,
} from '../../../services/departmentData'
import {
  assignDepartmentManager,
  getDepartmentManagerAssignmentImpact,
  getDepartmentManagerName,
  getDepartmentStaffMembers,
  getEligibleDepartmentManagers,
  subscribeToStaffUsers,
} from '../../../services/userData'
import '../styles/DepartmentsManagement.css'

const EMPTY_FORM = {
  name: '',
  code: '',
  description: '',
  managerId: '',
  status: 'Active',
}

const FILTERS = [
  { value: 'all', label: 'All departments' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'manager-assigned', label: 'Manager assigned' },
  { value: 'manager-unassigned', label: 'Manager unassigned' },
]

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

function displayManager(department) {
  if (!department.managerId) return 'Unassigned'
  try {
    return getDepartmentManagerName(department.managerId) ?? 'Manager record unavailable'
  } catch {
    return 'Manager data unavailable'
  }
}

function getUserDirectoryState() {
  try {
    return { managers: getEligibleDepartmentManagers(), error: '' }
  } catch (error) {
    return { managers: [], error: error.message || 'Unable to load staff accounts.' }
  }
}

function getDepartmentStaffSafely(departmentId) {
  try {
    return getDepartmentStaffMembers(departmentId)
  } catch {
    return null
  }
}

export default function DepartmentsManagement() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dialogRef = useRef(null)
  const [departmentState, setDepartmentState] = useState(() => {
    try {
      return { departments: getDepartments(), loadError: '', loaded: true }
    } catch (error) {
      return {
        departments: [],
        loadError: error.message || 'Unable to load departments.',
        loaded: true,
      }
    }
  })
  const { departments, loadError, loaded } = departmentState
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [formMessage, setFormMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingId, setPendingId] = useState(null)
  const [notice, setNotice] = useState(null)
  const [userDirectory, setUserDirectory] = useState(getUserDirectoryState)

  const refreshDepartments = useCallback((records, error) => {
    if (error) {
      setDepartmentState({
        departments: [],
        loadError: error.message || 'Unable to load departments.',
        loaded: true,
      })
      return
    }
    setDepartmentState({ departments: records, loadError: '', loaded: true })
  }, [])

  useEffect(() => subscribeToDepartments(refreshDepartments), [refreshDepartments])
  useEffect(() => subscribeToStaffUsers(() => setUserDirectory(getUserDirectoryState())), [])

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

  const department = useMemo(
    () => departments.find(record => record.id === id) ?? null,
    [departments, id],
  )
  const managers = userDirectory.managers
  const summary = useMemo(() => getDepartmentSummary(departments), [departments])
  const visibleDepartments = useMemo(
    () => filterDepartments(departments, search, filter),
    [departments, filter, search],
  )

  const clearFilters = () => {
    setSearch('')
    setFilter('all')
  }

  function openCreateForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setFormMessage('')
    setFormOpen(true)
  }

  function openEditForm(record) {
    setEditingId(record.id)
    setForm({
      name: record.name,
      code: record.code ?? '',
      description: record.description ?? '',
      managerId: record.managerId ?? '',
      status: record.status,
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
        const current = getDepartmentById(editingId)
        if (!current) throw new DepartmentDataError('This department no longer exists.')
        if ((form.managerId || null) !== (current.managerId || null)) {
          const impact = getDepartmentManagerAssignmentImpact(editingId, form.managerId || null)
          const managerName = form.managerId
            ? managers.find(manager => manager.id === form.managerId)?.name ?? 'the selected manager'
            : 'no manager'
          const impacted = [
            impact.currentAssignment && impact.currentAssignment.id !== editingId
              ? `move ${managerName} from ${impact.currentAssignment.name}`
              : '',
            ...impact.managedElsewhere.map(record => `remove ${managerName} as manager of ${record.name}`),
            impact.existingManager
              ? `replace ${impact.existingManager.firstName} ${impact.existingManager.lastName}`
              : '',
          ].filter(Boolean)
          const confirmed = window.confirm(
            `Assign ${managerName} to ${current.name}?`
            + (impacted.length ? ` This will ${impacted.join(' and ')}.` : ''),
          )
          if (!confirmed) {
            refreshDepartments(getDepartments(), null)
            return
          }
          assignDepartmentManager(editingId, form.managerId || null, { confirmedTransfer: true })
        }
        updateDepartment(editingId, { ...form, managerId: form.managerId || null })
        setNotice({ type: 'success', message: 'Department changes saved in this browser.' })
      } else {
        createDepartment(form)
        setNotice({ type: 'success', message: 'Department added and saved in this browser.' })
      }
      refreshDepartments(getDepartments(), null)
      setFormOpen(false)
    } catch (error) {
      if (error.details?.saved) {
        refreshDepartments(getDepartments(), null)
        setFormOpen(false)
        setNotice({ type: 'error', message: error.message })
        return
      }
      if (error instanceof DepartmentDataError && Object.keys(error.fieldErrors).length) {
        setFormErrors(error.fieldErrors)
        setFormMessage(error.message)
      } else {
        setFormMessage(error.message || 'Unable to save this department.')
      }
    } finally {
      setSaving(false)
    }
  }

  function handleStatusChange(record) {
    const nextStatus = record.status === 'Active' ? 'Inactive' : 'Active'
    const action = nextStatus === 'Inactive' ? 'deactivate' : 'activate'
    const confirmed = window.confirm(
      `${action === 'deactivate' ? 'Deactivate' : 'Activate'} "${record.name}"? `
      + `This only changes the department status; it will not deactivate staff or alter policies or claims.`,
    )
    if (!confirmed) return

    setPendingId(record.id)
    try {
      updateDepartment(record.id, { ...record, status: nextStatus })
      refreshDepartments(getDepartments(), null)
      setNotice({
        type: 'success',
        message: `${record.name} department ${nextStatus.toLowerCase()} in this browser.`,
      })
    } catch (error) {
      if (error.details?.saved) {
        refreshDepartments(getDepartments(), null)
        setNotice({ type: 'error', message: error.message })
        return
      }
      setNotice({ type: 'error', message: error.message || 'Unable to update department status.' })
    } finally {
      setPendingId(null)
    }
  }

  function openDetails(record) {
    navigate(`/admin/departments/${record.id}`)
  }

  function returnToList() {
    navigate('/admin/departments')
  }

  function renderFieldError(field) {
    return formErrors[field]
      ? <span className="dm-field-error" id={`dm-${field}-error`}>{formErrors[field]}</span>
      : null
  }

  if (id && loadError) {
    return (
      <section className="dm-page">
        <ErrorPanel message={loadError} />
        <button type="button" className="dm-button dm-button--secondary" onClick={returnToList}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to departments
        </button>
      </section>
    )
  }

  if (id && !department && !loadError) {
    if (!loaded) {
      return <div className="dm-loading" role="status">Loading department…</div>
    }
    return (
      <section className="dm-page">
        <button type="button" className="dm-back-link" onClick={returnToList}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to departments
        </button>
        <div className="dm-empty">
          <Building2 size={28} aria-hidden="true" />
          <h2>Department not found</h2>
          <p>It may have been removed from the saved department records.</p>
        </div>
      </section>
    )
  }

  if (id && department) {
    const staffMembers = getDepartmentStaffSafely(department.id)
    return (
      <section className="dm-page">
        {notice && <Notice notice={notice} onDismiss={() => setNotice(null)} />}
        <button type="button" className="dm-back-link" onClick={returnToList}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to departments
        </button>

        <header className="dm-header dm-header--detail">
          <div className="dm-heading">
            <span className="dm-eyebrow">Superadmin / Departments</span>
            <div className="dm-title-line">
              <h1>{department.name}</h1>
              <StatusBadge status={department.status} />
            </div>
            <p>Department record and current assignments.</p>
          </div>
          <div className="dm-header-actions">
            <button type="button" className="dm-button dm-button--secondary" onClick={() => openEditForm(department)}>
              <Pencil size={16} aria-hidden="true" /> Edit department
            </button>
            <button
              type="button"
              className={`dm-button ${department.status === 'Active' ? 'dm-button--warning' : 'dm-button--primary'}`}
              onClick={() => handleStatusChange(department)}
              disabled={pendingId === department.id}
            >
              {department.status === 'Active'
                ? <ToggleLeft size={17} aria-hidden="true" />
                : <ToggleRight size={17} aria-hidden="true" />}
              {department.status === 'Active' ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </header>

        {loadError && <ErrorPanel message={loadError} />}
        {userDirectory.error && <ErrorPanel message={userDirectory.error} />}
        <div className="dm-detail-grid">
          <article className="dm-card dm-detail-card">
            <div className="dm-card-heading">
              <span className="dm-card-icon"><Building2 size={18} aria-hidden="true" /></span>
              <div>
                <h2>Department information</h2>
                <p>Identity and lifecycle dates</p>
              </div>
            </div>
            <dl className="dm-info-grid">
              <InfoItem label="Department name" value={department.name} />
              <InfoItem label="Department code" value={department.code || 'Not set'} mono />
              <InfoItem label="Status" value={<StatusBadge status={department.status} />} />
              <InfoItem label="Created" value={formatDate(department.createdAt)} />
              <InfoItem label="Last updated" value={formatDate(department.updatedAt)} />
              <InfoItem
                label="Description"
                value={department.description || 'No description provided.'}
                wide
              />
            </dl>
          </article>

          <article className="dm-card dm-assignment-card">
            <div className="dm-card-heading">
              <span className="dm-card-icon"><CircleUserRound size={18} aria-hidden="true" /></span>
              <div>
                <h2>Assignments</h2>
                <p>Manager and department staff</p>
              </div>
            </div>
            <div className="dm-assignment">
              <span className="dm-assignment-label">Department manager</span>
              <span className="dm-assignment-value">{displayManager(department)}</span>
              {!department.managerId && (
                <p>Assign a manager when an eligible manager account is available.</p>
              )}
            </div>
            <div className="dm-assignment">
              <span className="dm-assignment-label">Department staff</span>
              {staffMembers === null
                ? <span className="dm-assignment-value">Staff directory unavailable</span>
                : staffMembers.length
                  ? <ul className="dm-staff-list">{staffMembers.map(member => (
                    <li key={member.id}>{member.name}</li>
                  ))}</ul>
                  : <span className="dm-assignment-value">No staff assigned</span>}
            </div>
          </article>
        </div>

        <DepartmentDialog
          ref={dialogRef}
          open={formOpen}
          title={editingId ? 'Edit department' : 'Add department'}
          form={form}
          formErrors={formErrors}
          formMessage={formMessage}
          managers={managers}
          saving={saving}
          editingId={editingId}
          onFieldChange={handleFieldChange}
          onSave={handleSave}
          onClose={closeForm}
          renderFieldError={renderFieldError}
        />
      </section>
    )
  }

  const hasFilters = Boolean(search.trim()) || filter !== 'all'

  return (
    <section className="dm-page">
      {notice && <Notice notice={notice} onDismiss={() => setNotice(null)} />}
      <header className="dm-header">
        <div className="dm-heading">
          <span className="dm-eyebrow">Superadmin workspace</span>
          <h1>Departments Management</h1>
          <p>Organise departments, review assignments, and manage their status.</p>
        </div>
        <button type="button" className="dm-button dm-button--primary" onClick={openCreateForm}>
          <Plus size={17} aria-hidden="true" /> Add Department
        </button>
      </header>

      <section className="dm-summary-grid" aria-label="Department summary">
        <SummaryCard label="Total Departments" value={summary.total} icon={Building2} tone="green" />
        <SummaryCard label="Active Departments" value={summary.active} icon={Check} tone="green" />
        <SummaryCard label="Inactive Departments" value={summary.inactive} icon={ToggleLeft} tone="slate" />
        <SummaryCard label="Without Managers" value={summary.withoutManagers} icon={CircleUserRound} tone="amber" />
      </section>

      {loadError && <ErrorPanel message={loadError} />}

      <section className="dm-card dm-list-card" aria-labelledby="dm-list-heading">
        <div className="dm-list-heading">
          <div>
            <h2 id="dm-list-heading">Department directory</h2>
            <p>Search by department name or code and narrow the list by status or manager assignment.</p>
          </div>
          <span className="dm-result-count" aria-live="polite">
            {visibleDepartments.length} of {departments.length}
          </span>
        </div>

        <div className="dm-toolbar">
          <label className="dm-search">
            <Search size={17} aria-hidden="true" />
            <span className="dm-sr-only">Search departments</span>
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search name or code"
            />
            {search && (
              <button type="button" className="dm-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </label>
          <label className="dm-filter">
            <Filter size={16} aria-hidden="true" />
            <span className="dm-sr-only">Filter departments</span>
            <select value={filter} onChange={event => setFilter(event.target.value)}>
              {FILTERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {hasFilters && (
            <button type="button" className="dm-clear-filters" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        {userDirectory.error && <ErrorPanel message={userDirectory.error} />}

        {loadError ? (
          <ErrorPanel message={loadError} />
        ) : visibleDepartments.length === 0 ? (
          <div className="dm-empty">
            <Building2 size={28} aria-hidden="true" />
            <h3>{departments.length ? 'No matching departments' : 'No departments yet'}</h3>
            <p>
              {departments.length
                ? 'Try another search or clear the current filters.'
                : 'Add your first department to begin organising assignments.'}
            </p>
            {hasFilters && (
              <button type="button" className="dm-button dm-button--secondary" onClick={clearFilters}>
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <div className="dm-table-wrap">
            <table className="dm-table">
              <thead>
                <tr>
                  <th scope="col">Department</th>
                  <th scope="col">Manager</th>
                  <th scope="col">Staff</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last updated</th>
                  <th scope="col"><span className="dm-sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleDepartments.map(record => (
                  <tr key={record.id}>
                    <td>
                      <button type="button" className="dm-department-link" onClick={() => openDetails(record)}>
                        <span className="dm-department-icon"><Building2 size={17} aria-hidden="true" /></span>
                        <span className="dm-department-copy">
                          <span className="dm-department-name">{record.name}</span>
                          <span className="dm-department-code">{record.code}</span>
                        </span>
                      </button>
                      <p className="dm-description" title={record.description || undefined}>
                        {record.description || 'No description'}
                      </p>
                    </td>
                    <td className="dm-muted">{displayManager(record)}</td>
                    <td className="dm-muted">{getDepartmentStaffSafely(record.id)?.length ?? 'Unavailable'}</td>
                    <td><StatusBadge status={record.status} /></td>
                    <td className="dm-date">{formatDate(record.updatedAt)}</td>
                    <td>
                      <div className="dm-row-actions">
                        <button
                          type="button"
                          className="dm-icon-button"
                          onClick={() => openDetails(record)}
                          aria-label={`View ${record.name} department`}
                          title="View"
                        >
                          <Eye size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="dm-icon-button"
                          onClick={() => openEditForm(record)}
                          aria-label={`Edit ${record.name} department`}
                          title="Edit"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={`dm-icon-button ${record.status === 'Active' ? 'dm-icon-button--warning' : 'dm-icon-button--success'}`}
                          onClick={() => handleStatusChange(record)}
                          aria-label={`${record.status === 'Active' ? 'Deactivate' : 'Activate'} ${record.name} department`}
                          title={record.status === 'Active' ? 'Deactivate' : 'Activate'}
                          disabled={pendingId === record.id}
                        >
                          {record.status === 'Active'
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

      <DepartmentDialog
        ref={dialogRef}
        open={formOpen}
        title={editingId ? 'Edit department' : 'Add department'}
        form={form}
        formErrors={formErrors}
        formMessage={formMessage}
        managers={managers}
        saving={saving}
        editingId={editingId}
        onFieldChange={handleFieldChange}
        onSave={handleSave}
        onClose={closeForm}
        renderFieldError={renderFieldError}
      />
    </section>
  )
}

function SummaryCard({ label, value, icon: Icon, tone }) {
  return (
    <article className={`dm-summary-card dm-summary-card--${tone}`}>
      <span className="dm-summary-icon"><Icon size={19} aria-hidden="true" /></span>
      <span className="dm-summary-value">{value}</span>
      <span className="dm-summary-label">{label}</span>
    </article>
  )
}

function StatusBadge({ status }) {
  return (
    <span className={`dm-status dm-status--${status === 'Active' ? 'active' : 'inactive'}`}>
      <span aria-hidden="true" />
      {status}
    </span>
  )
}

function InfoItem({ label, value, mono = false, wide = false }) {
  return (
    <div className={`dm-info-item${wide ? ' dm-info-item--wide' : ''}`}>
      <dt>{label}</dt>
      <dd className={mono ? 'dm-mono' : ''}>{value}</dd>
    </div>
  )
}

function ErrorPanel({ message }) {
  return (
    <div className="dm-error-panel" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

function Notice({ notice, onDismiss }) {
  return (
    <div className={`dm-notice dm-notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
      {notice.type === 'success' ? <Check size={17} aria-hidden="true" /> : <AlertCircle size={17} aria-hidden="true" />}
      <span>{notice.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

function DepartmentDialog({
  ref,
  open,
  title,
  form,
  formErrors,
  formMessage,
  managers,
  saving,
  editingId,
  onFieldChange,
  onSave,
  onClose,
  renderFieldError,
}) {
  if (!open) return null

  const selectedManagerUnavailable = form.managerId
    && !managers.some(manager => manager.id === form.managerId)

  return (
    <dialog
      ref={ref}
      className="dm-dialog"
      aria-labelledby="dm-dialog-title"
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form className="dm-dialog-form" onSubmit={onSave} noValidate>
        <header className="dm-dialog-header">
          <div>
            <span className="dm-dialog-icon"><Building2 size={19} aria-hidden="true" /></span>
            <h2 id="dm-dialog-title">{title}</h2>
            <p>Enter the department details and assignment options.</p>
          </div>
          <button type="button" className="dm-icon-button" onClick={onClose} aria-label="Close form" disabled={saving}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {formMessage && <div className="dm-form-message" role="alert">{formMessage}</div>}

        <div className="dm-form-grid">
          <label className="dm-form-field" htmlFor="dm-name">
            <span>Department name <b aria-hidden="true">*</b></span>
            <input
              id="dm-name"
              name="name"
              value={form.name}
              onChange={onFieldChange}
              autoFocus
              required
              aria-invalid={Boolean(formErrors.name)}
              aria-describedby={formErrors.name ? 'dm-name-error' : undefined}
            />
            {renderFieldError('name')}
          </label>

          <label className="dm-form-field" htmlFor="dm-code">
            <span>Department code <b aria-hidden="true">*</b></span>
            <input
              id="dm-code"
              name="code"
              value={form.code}
              onChange={onFieldChange}
              required
              maxLength={20}
              aria-invalid={Boolean(formErrors.code)}
              aria-describedby={formErrors.code ? 'dm-code-error' : undefined}
            />
            {renderFieldError('code')}
          </label>

          <label className="dm-form-field dm-form-field--wide" htmlFor="dm-description">
            <span>Description <em>Optional</em></span>
            <textarea
              id="dm-description"
              name="description"
              value={form.description}
              onChange={onFieldChange}
              rows={3}
              maxLength={500}
            />
          </label>

          <label className="dm-form-field" htmlFor="dm-manager">
            <span>Department manager <em>Optional</em></span>
            <select
              id="dm-manager"
              name="managerId"
              value={form.managerId}
              onChange={onFieldChange}
              aria-invalid={Boolean(formErrors.managerId)}
              aria-describedby={formErrors.managerId ? 'dm-managerId-error' : undefined}
            >
              <option value="">Unassigned</option>
              {selectedManagerUnavailable && (
                <option value={form.managerId}>Current manager record unavailable</option>
              )}
              {managers.map(manager => (
                <option key={manager.id} value={manager.id}>{manager.name}</option>
              ))}
            </select>
            {renderFieldError('managerId')}
            {!managers.length && !selectedManagerUnavailable && (
              <span className="dm-field-hint">No eligible manager accounts are available.</span>
            )}
          </label>

          <label className="dm-form-field" htmlFor="dm-status">
            <span>Status</span>
            <select
              id="dm-status"
              name="status"
              value={form.status}
              onChange={onFieldChange}
              aria-invalid={Boolean(formErrors.status)}
              aria-describedby={formErrors.status ? 'dm-status-error' : undefined}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            {renderFieldError('status')}
          </label>
        </div>

        <footer className="dm-dialog-footer">
          <span className="dm-required-note"><b aria-hidden="true">*</b> Required fields</span>
          <div>
            <button type="button" className="dm-button dm-button--secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="dm-button dm-button--primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save department'}
              {!saving && <ChevronRight size={16} aria-hidden="true" />}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  )
}
