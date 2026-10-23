import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Users, UserCheck, FileText, AlertCircle,
  CreditCard, Activity, ChevronRight, Settings,
  ShieldCheck,
} from 'lucide-react'
import { getSession } from '../../services/mockAuth'
import { departments, systemActivity, getAdminSummary } from '../../services/adminData'
import { formatGHS } from '../../services/customerData'
import './SuperadminDashboard.css'

const deptStatusBadge = {
  Active:   'sa-badge--success',
  Inactive: 'sa-badge--neutral',
  Pending:  'sa-badge--warning',
}

const categoryColour = {
  Product:    'sa-dept-cat--product',
  Operations: 'sa-dept-cat--ops',
  Compliance: 'sa-dept-cat--compliance',
}

function formatDateTime(date) {
  return (
    date.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }) +
    ' · ' +
    date.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  )
}

export default function SuperadminDashboard() {
  const navigate = useNavigate()
  const session  = getSession()
  const summary  = getAdminSummary()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const summaryCards = [
    {
      label:   'Departments',
      value:   summary.totalDepartments,
      icon:    Building2,
      accent:  '#8DB600',
    },
    {
      label:   'Total Staff',
      value:   summary.totalStaff ?? '—',
      icon:    Users,
      accent:  '#4a90a4',
      pending: summary.totalStaff === null,
    },
    {
      label:   'Total Customers',
      value:   summary.totalCustomers ?? '—',
      icon:    UserCheck,
      accent:  '#7b5ea7',
      pending: summary.totalCustomers === null,
    },
    {
      label:   'Active Policies',
      value:   summary.activePolicies,
      icon:    FileText,
      accent:  '#2e7d32',
    },
    {
      label:   'Pending Claims',
      value:   summary.pendingClaims,
      icon:    AlertCircle,
      accent:  summary.pendingClaims > 0 ? '#c0842a' : '#8DB600',
    },
    {
      label:   'Outstanding Balance',
      value:   formatGHS(summary.totalOutstanding),
      icon:    CreditCard,
      accent:  summary.overduePayments > 0 ? '#c0392b' : '#8DB600',
    },
  ]

  const quickActions = [
    { label: 'Manage Departments',      icon: Building2,      path: '/admin/departments' },
    { label: 'Manage Users',            icon: Users,          path: '/admin/users'       },
    { label: 'Roles & Permissions',     icon: ShieldCheck,    path: '/admin/roles'       },
    { label: 'Customer Management',     icon: UserCheck,      path: '/admin/customers'   },
    { label: 'System Activity',         icon: Activity,       path: '/admin/activity'    },
    { label: 'Settings',                icon: Settings,       path: '/admin/settings'    },
  ]

  return (
    <div className="sa-page">

      {/* ── Welcome header ── */}
      <header className="sa-header">
        <div>
          <h1 className="sa-title">
            Welcome, {session?.name ?? 'Administrator'}
          </h1>
          <p className="sa-subtitle">Organisation-wide overview — emPLE Life Insurance.</p>
        </div>
        <span className="sa-clock" aria-label="Current date and time" aria-live="polite">
          {formatDateTime(now)}
        </span>
      </header>

      {/* ── Summary cards ── */}
      <section aria-labelledby="sa-summary-heading">
        <h2 id="sa-summary-heading" className="sa-section-label">Organisation Overview</h2>
        <div className="sa-cards-grid">
          {summaryCards.map(({ label, value, icon: Icon, accent, pending }) => (
            <article key={label} className="sa-card" style={{ '--sa-accent': accent }}>
              <div className="sa-card-icon" aria-hidden="true"><Icon size={20} /></div>
              <div className="sa-card-body">
                <span className={`sa-card-value${pending ? ' sa-card-value--pending' : ''}`}>
                  {value}
                </span>
                <span className="sa-card-label">{label}</span>
                {pending && (
                  <span className="sa-card-pending-note">Requires user directory</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Departments ── */}
      <section aria-labelledby="sa-depts-heading" className="sa-section">
        <div className="sa-section-header">
          <h2 id="sa-depts-heading" className="sa-section-label">Departments</h2>
          <button
            type="button"
            className="sa-section-link"
            onClick={() => navigate('/admin/departments')}
          >
            Manage Departments <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th scope="col">Department</th>
                <th scope="col">Category</th>
                <th scope="col">Manager</th>
                <th scope="col">Staff</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {departments.map(dept => (
                <tr key={dept.id} className="sa-table-row">
                  <td className="sa-dept-name">{dept.name}</td>
                  <td>
                    <span className={`sa-dept-cat ${categoryColour[dept.category] ?? ''}`}>
                      {dept.category}
                    </span>
                  </td>
                  <td className="sa-muted">
                    {dept.manager ?? 'Not assigned'}
                  </td>
                  <td className="sa-muted">{dept.staffCount}</td>
                  <td>
                    <span className={`sa-badge ${deptStatusBadge[dept.status] ?? ''}`}>
                      {dept.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="sa-view-btn"
                      onClick={() => navigate(`/admin/departments/${dept.id}`)}
                      aria-label={`View ${dept.name} department`}
                    >
                      View <ChevronRight size={13} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── System Activity ── */}
      <section aria-labelledby="sa-activity-heading" className="sa-section">
        <div className="sa-section-header">
          <h2 id="sa-activity-heading" className="sa-section-label">Recent System Activity</h2>
          <button
            type="button"
            className="sa-section-link"
            onClick={() => navigate('/admin/activity')}
          >
            View All <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
        {systemActivity.length === 0 ? (
          <div className="sa-empty">
            <Activity size={26} className="sa-empty-icon" aria-hidden="true" />
            <p className="sa-empty-msg">
              No system activity has been recorded yet. Administrative events will appear here once the audit log is connected.
            </p>
          </div>
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Date</th>
                  <th scope="col">Type</th>
                </tr>
              </thead>
              <tbody>
                {systemActivity.slice(0, 8).map(item => (
                  <tr key={item.id}>
                    <td>{item.event}</td>
                    <td className="sa-mono">{item.ref}</td>
                    <td className="sa-muted">{item.date}</td>
                    <td className="sa-muted">{item.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Quick Actions ── */}
      <section aria-labelledby="sa-actions-heading" className="sa-section">
        <h2 id="sa-actions-heading" className="sa-section-label">Quick Actions</h2>
        <div className="sa-actions-grid">
          {quickActions.map(({ label, icon: Icon, path }) => (
            <button
              key={label}
              type="button"
              className="sa-action-card"
              onClick={() => navigate(path)}
              aria-label={label}
            >
              <div className="sa-action-icon" aria-hidden="true">
                <Icon size={20} />
              </div>
              <span className="sa-action-label">{label}</span>
              <ChevronRight size={15} className="sa-action-arrow" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

    </div>
  )
}
