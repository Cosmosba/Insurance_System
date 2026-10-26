import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Edit3,
  Plus, Search, Upload, Users, X, XCircle,
} from 'lucide-react'
import { getSession } from '../../services/mockAuth'
import { hasPermission } from '../../services/rolePermissions'
import {
  createCustomer,
  CustomerDataError,
  getCustomerDirectory,
  getCustomerProfile,
  getCustomerSummary,
  filterCustomerDirectory,
  setCustomerStatus,
  subscribeToCustomerDirectory,
  updateCustomer,
} from '../../services/customerDirectoryData'
import CustomerBulkUpload from './CustomerBulkUpload'
import './CustomerManagement.css'

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  altPhone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
}
const PAGE_SIZE = 10

function can(permission) {
  const session = getSession()
  return hasPermission(session, 'customers.manage') || hasPermission(session, permission)
}

function loadDirectory() {
  try {
    return { customers: getCustomerDirectory(), error: '' }
  } catch (error) {
    return { customers: [], error: error.message || 'Unable to load customer records.' }
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

function fullName(customer) {
  return `${customer.firstName} ${customer.lastName}`.trim()
}

function ErrorNotice({ children }) {
  return <div className="cm-alert cm-alert--error" role="alert">{children}</div>
}

function EmptySection({ children }) {
  return <p className="cm-empty-section">{children}</p>
}

export default function CustomerManagement() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dialogRef = useRef(null)
  const [directory, setDirectory] = useState(loadDirectory)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [formMessage, setFormMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingId, setPendingId] = useState(null)
  const [notice, setNotice] = useState('')
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false)

  const refreshDirectory = useCallback(() => setDirectory(loadDirectory()), [])

  useEffect(() => subscribeToCustomerDirectory(refreshDirectory), [refreshDirectory])

  useEffect(() => {
    if (formOpen && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal()
  }, [formOpen])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const summary = useMemo(() => getCustomerSummary(directory.customers), [directory.customers])
  const { profile, profileError } = useMemo(() => {
    if (!id) return { profile: null, profileError: '' }
    if (!directory.customers.some(customer => customer.id === id)) {
      return { profile: null, profileError: directory.error || 'The selected customer could not be found.' }
    }
    try {
      return { profile: getCustomerProfile(id), profileError: '' }
    } catch (error) {
      return { profile: null, profileError: error.message || 'Unable to load this customer profile.' }
    }
  }, [directory.customers, directory.error, id])
  const filteredCustomers = useMemo(() => {
    return filterCustomerDirectory(directory.customers, search, { status: statusFilter, sort })
  }, [directory.customers, search, sort, statusFilter])
  const pageCount = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleCustomers = filteredCustomers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function openCreateForm() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setFormErrors({})
    setFormMessage('')
    setFormOpen(true)
  }

  function openEditForm(customer) {
    setEditingId(customer.id)
    setForm({
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      altPhone: customer.altPhone ?? '',
      dateOfBirth: customer.dateOfBirth ?? '',
      gender: customer.gender ?? '',
      address: customer.address ?? '',
    })
    setFormErrors({})
    setFormMessage('')
    setFormOpen(true)
  }

  function updateForm(field, value) {
    setForm(current => ({ ...current, [field]: value }))
    setFormErrors(current => ({ ...current, [field]: '' }))
    setFormMessage('')
  }

  function closeForm() {
    if (dialogRef.current?.open) dialogRef.current.close()
    setFormOpen(false)
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setFormErrors({})
    setFormMessage('')
    try {
      const saved = editingId ? updateCustomer(editingId, form) : await createCustomer(form)
      refreshDirectory()
      closeForm()
      setNotice(editingId ? 'Customer details saved.' : 'Customer registered. A first-login password change is required.')
      if (!editingId) navigate(`/admin/customers/${saved.id}`)
    } catch (error) {
      if (error instanceof CustomerDataError && error.fieldErrors) setFormErrors(error.fieldErrors)
      setFormMessage(error.message || 'Unable to save this customer.')
    } finally {
      setSaving(false)
    }
  }

  function handleStatusChange(customer) {
    const nextStatus = customer.status === 'Active' ? 'Inactive' : 'Active'
    const action = nextStatus === 'Active' ? 'activate' : 'deactivate'
    if (!window.confirm(`${action === 'activate' ? 'Activate' : 'Deactivate'} ${fullName(customer)}’s account?`)) return
    setPendingId(customer.id)
    try {
      setCustomerStatus(customer.id, nextStatus)
      refreshDirectory()
      setNotice(`Customer account ${nextStatus.toLocaleLowerCase()}.`)
    } catch (error) {
      setNotice(error.message || 'Unable to update customer status.')
    } finally {
      setPendingId(null)
    }
  }

  if (id) {
    return (
      <main className="cm-page">
        <button type="button" className="cm-back" onClick={() => navigate('/admin/customers')}>
          <ArrowLeft size={16} aria-hidden="true" /> Customer directory
        </button>
        {profileError && <ErrorNotice>{profileError}</ErrorNotice>}
        {profile && (
          <>
            <header className="cm-header">
              <div>
                <span className="cm-eyebrow">Customer profile</span>
                <h1>{fullName(profile)}</h1>
                <p>{profile.id} · Registered {formatDate(profile.registrationDate)}</p>
              </div>
              <div className="cm-actions">
                {can('customers.edit') && (
                  <button type="button" className="cm-button cm-button--secondary" onClick={() => openEditForm(profile)}>
                    <Edit3 size={16} aria-hidden="true" /> Edit details
                  </button>
                )}
                {profile.status === 'Active' && can('customers.deactivate') && (
                  <button type="button" className="cm-button cm-button--warning" disabled={pendingId === profile.id} onClick={() => handleStatusChange(profile)}>
                    <XCircle size={16} aria-hidden="true" /> Deactivate
                  </button>
                )}
                {profile.status === 'Inactive' && can('customers.activate') && (
                  <button type="button" className="cm-button cm-button--primary" disabled={pendingId === profile.id} onClick={() => handleStatusChange(profile)}>
                    <CheckCircle2 size={16} aria-hidden="true" /> Activate
                  </button>
                )}
              </div>
            </header>
            {notice && <div className="cm-alert cm-alert--success" role="status">{notice}</div>}
            <div className="cm-profile-grid">
              <section className="cm-card">
                <h2>Personal information</h2>
                <dl className="cm-details">
                  <div><dt>Full name</dt><dd>{fullName(profile)}</dd></div>
                  <div><dt>Date of birth</dt><dd>{profile.dateOfBirth || 'Not recorded'}</dd></div>
                  <div><dt>Gender</dt><dd>{profile.gender || 'Not recorded'}</dd></div>
                  <div><dt>Customer ID</dt><dd>{profile.id}</dd></div>
                </dl>
              </section>
              <section className="cm-card">
                <h2>Contact details</h2>
                <dl className="cm-details">
                  <div><dt>Email</dt><dd>{profile.email}</dd></div>
                  <div><dt>Phone</dt><dd>{profile.phone || 'Not recorded'}</dd></div>
                  <div><dt>Alternate phone</dt><dd>{profile.altPhone || 'Not recorded'}</dd></div>
                  <div><dt>Address</dt><dd>{profile.address || 'Not recorded'}</dd></div>
                </dl>
              </section>
              <section className="cm-card cm-status-card">
                <h2>Account status</h2>
                <span className={`cm-status cm-status--${profile.status.toLowerCase()}`}>{profile.status}</span>
                <p>Registered {formatDate(profile.registrationDate)}</p>
                {profile.authManaged && <p>This record is linked to an existing sign-in account. Its email cannot be changed here.</p>}
              </section>
            </div>
            <RecordSection title="Insurance policies" count={profile.policies.length}>
              {profile.policies.length ? (
                <div className="cm-table-wrap"><table className="cm-table">
                  <thead><tr><th>Policy</th><th>Product</th><th>Status</th><th>Start date</th></tr></thead>
                  <tbody>{profile.policies.map(policy => (
                    <tr key={policy.id}><td>{policy.id}</td><td>{policy.product}</td><td>{policy.status}</td><td>{policy.startDate}</td></tr>
                  ))}</tbody>
                </table></div>
              ) : <EmptySection>No existing policy records are linked to this customer.</EmptySection>}
            </RecordSection>
            <RecordSection title="Payments" count={profile.payments.length}>
              {profile.payments.length ? (
                <div className="cm-table-wrap"><table className="cm-table">
                  <thead><tr><th>Reference</th><th>Policy</th><th>Amount</th><th>Status</th><th>Due date</th></tr></thead>
                  <tbody>{profile.payments.map(payment => (
                    <tr key={payment.ref}><td>{payment.ref}</td><td>{payment.policyName}</td><td>GHS {Number(payment.amount).toFixed(2)}</td><td>{payment.status}</td><td>{payment.dueDate}</td></tr>
                  ))}</tbody>
                </table></div>
              ) : <EmptySection>No existing payment records are linked to this customer.</EmptySection>}
            </RecordSection>
            <RecordSection title="Claims" count={profile.claims.length}>
              {profile.claims.length ? (
                <div className="cm-table-wrap"><table className="cm-table">
                  <thead><tr><th>Reference</th><th>Type</th><th>Policy</th><th>Status</th><th>Submitted</th></tr></thead>
                  <tbody>{profile.claims.map(claim => (
                    <tr key={claim.ref}><td>{claim.ref}</td><td>{claim.type}</td><td>{claim.policyName}</td><td>{claim.status}</td><td>{claim.submitted}</td></tr>
                  ))}</tbody>
                </table></div>
              ) : <EmptySection>No existing claim records are linked to this customer.</EmptySection>}
            </RecordSection>
            <RecordSection title="Service requests" count={profile.serviceRequests.length}>
              <EmptySection>No service request records are available in the current system.</EmptySection>
            </RecordSection>
          </>
        )}
        <CustomerForm
          dialogRef={dialogRef} open={formOpen} editing={Boolean(editingId)} form={form}
          errors={formErrors} message={formMessage} saving={saving}
          emailLocked={Boolean(profile?.authManaged)}
          onChange={updateForm} onClose={closeForm} onSubmit={handleSave}
        />
      </main>
    )
  }

  return (
    <main className="cm-page">
      <header className="cm-header">
        <div>
          <span className="cm-eyebrow">Customer services</span>
          <h1>Customer Management</h1>
          <p>Register customers and manage their directory records and account status.</p>
        </div>
        {can('customers.create') && (
          <div className="cm-actions">
            <button type="button" className="cm-button cm-button--secondary" onClick={() => setBulkUploadOpen(true)}>
              <Upload size={16} aria-hidden="true" /> Bulk Upload
            </button>
            <button type="button" className="cm-button cm-button--primary" onClick={openCreateForm}>
              <Plus size={17} aria-hidden="true" /> Register Customer
            </button>
          </div>
        )}
      </header>
      {notice && <div className="cm-alert cm-alert--success" role="status">{notice}</div>}
      {directory.error && <ErrorNotice>{directory.error}</ErrorNotice>}
      <section className="cm-summary" aria-label="Customer summary">
        <SummaryCard label="Total customers" value={summary.total} icon={Users} />
        <SummaryCard label="Active customers" value={summary.active} icon={CheckCircle2} />
        <SummaryCard label="Inactive customers" value={summary.inactive} icon={XCircle} />
        <SummaryCard label="Registered in the last 30 days" value={summary.recent} icon={Clock3} />
      </section>
      <section className="cm-card cm-directory">
        <div className="cm-directory-heading">
          <div><h2>Customer directory</h2><p>Search and filter customer accounts.</p></div>
          <span className="cm-result-count">{filteredCustomers.length} {filteredCustomers.length === 1 ? 'record' : 'records'}</span>
        </div>
        <div className="cm-toolbar">
          <label className="cm-search">
            <Search size={16} aria-hidden="true" />
            <span className="cm-sr-only">Search customers</span>
            <input value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Search name, email, phone or ID" />
          </label>
          <label className="cm-select">
            <span className="cm-sr-only">Filter by account status</span>
            <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1) }}>
              <option value="">All statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option>
            </select>
          </label>
          <label className="cm-select">
            <span className="cm-sr-only">Sort customers</span>
            <select value={sort} onChange={event => setSort(event.target.value)}>
              <option value="newest">Newest registration</option><option value="name">Name A–Z</option>
            </select>
          </label>
        </div>
        {directory.error ? null : filteredCustomers.length ? (
          <>
            <div className="cm-table-wrap">
              <table className="cm-table">
                <thead><tr><th>Customer ID</th><th>Full name</th><th>Email</th><th>Phone</th><th>Registered</th><th>Status</th><th><span className="cm-sr-only">View profile</span></th></tr></thead>
                <tbody>{visibleCustomers.map(customer => (
                  <tr key={customer.id}>
                    <td className="cm-id">{customer.id}</td>
                    <td><button type="button" className="cm-customer-link" onClick={() => navigate(`/admin/customers/${customer.id}`)}>{fullName(customer)}</button></td>
                    <td>{customer.email}</td><td>{customer.phone || 'Not recorded'}</td><td>{formatDate(customer.registrationDate)}</td>
                    <td><span className={`cm-status cm-status--${customer.status.toLowerCase()}`}>{customer.status}</span></td>
                    <td><button type="button" className="cm-view-link" onClick={() => navigate(`/admin/customers/${customer.id}`)}>View</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="cm-pagination">
              <span>Showing {Math.min(filteredCustomers.length, (currentPage - 1) * PAGE_SIZE + 1)}–{Math.min(filteredCustomers.length, currentPage * PAGE_SIZE)} of {filteredCustomers.length}</span>
              <div>
                <button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button>
                <span>Page {currentPage} of {pageCount}</span>
                <button type="button" aria-label="Next page" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button>
              </div>
            </div>
          </>
        ) : (
          <EmptySection>{search || statusFilter ? 'No customers match these search and filter criteria.' : 'No customer records are available.'}</EmptySection>
        )}
      </section>
      <CustomerForm
        dialogRef={dialogRef} open={formOpen} editing={Boolean(editingId)} form={form}
        errors={formErrors} message={formMessage} saving={saving}
        emailLocked={Boolean(directory.customers.find(customer => customer.id === editingId)?.authManaged)}
        onChange={updateForm} onClose={closeForm} onSubmit={handleSave}
      />
      <CustomerBulkUpload
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onImported={count => {
          refreshDirectory()
          setNotice(`${count} customer${count === 1 ? '' : 's'} imported successfully.`)
        }}
      />
    </main>
  )
}

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <article className="cm-summary-card">
      <span className="cm-summary-icon"><Icon size={19} aria-hidden="true" /></span>
      <strong>{value}</strong><span>{label}</span>
    </article>
  )
}

function RecordSection({ title, count, children }) {
  return (
    <section className="cm-card cm-record-section">
      <div className="cm-section-heading"><h2>{title}</h2><span>{count}</span></div>
      {children}
    </section>
  )
}

function CustomerForm({ dialogRef, open, editing, form, errors, message, saving, emailLocked, onChange, onClose, onSubmit }) {
  if (!open) return null
  const fields = [
    ['firstName', 'First name', true],
    ['lastName', 'Last name', true],
    ['email', 'Email address', true],
    ['phone', 'Phone number', true],
    ['altPhone', 'Alternate phone', false],
    ['dateOfBirth', 'Date of birth', false],
    ['gender', 'Gender', false],
    ['address', 'Address', false],
  ]
  return (
    <dialog ref={dialogRef} className="cm-dialog" onCancel={onClose}>
      <form onSubmit={onSubmit} noValidate>
        <header className="cm-dialog-header">
          <div><h2>{editing ? 'Edit customer details' : 'Register a customer'}</h2><p>New customer accounts must change their password when they first sign in.</p></div>
          <button type="button" className="cm-close" onClick={onClose} aria-label="Close form"><X size={19} /></button>
        </header>
        {message && <ErrorNotice>{message}</ErrorNotice>}
        <div className="cm-form-grid">
          {fields.map(([field, label, required]) => (
            <label className={`cm-field${field === 'address' ? ' cm-field--wide' : ''}`} key={field}>
              <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
              {field === 'address' ? (
                <textarea rows="3" value={form[field]} onChange={event => onChange(field, event.target.value)} aria-invalid={Boolean(errors[field])} />
              ) : (
                <input
                  type={field === 'email' ? 'email' : field === 'dateOfBirth' ? 'text' : 'text'}
                  value={form[field]}
                  onChange={event => onChange(field, event.target.value)}
                  aria-invalid={Boolean(errors[field])}
                  aria-describedby={errors[field] ? `${field}-error` : undefined}
                  disabled={field === 'email' && emailLocked}
                  required={required}
                  placeholder={field === 'dateOfBirth' ? 'e.g. 15 Mar 1985' : undefined}
                />
              )}
              {errors[field] && <small id={`${field}-error`} className="cm-field-error">{errors[field]}</small>}
            </label>
          ))}
        </div>
        <footer className="cm-dialog-footer">
          <button type="button" className="cm-button cm-button--secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="cm-button cm-button--primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Register customer'}</button>
        </footer>
      </form>
    </dialog>
  )
}
