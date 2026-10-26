import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Wallet, Clock, AlertCircle, CheckCircle2,
  Search, CreditCard, ChevronRight, CalendarClock,
} from 'lucide-react'
import { getSession } from '../services/mockAuth'
import { getCustomerWorkspaceData, getPaymentSummary, formatGHS } from '../services/customerData'
import './Payments.css'

const STATUS_FILTERS = ['All', 'Paid', 'Due Soon', 'Upcoming', 'Overdue']

const statusBadge = {
  'Paid':     'py-badge--success',
  'Due Soon': 'py-badge--warning',
  'Upcoming': 'py-badge--info',
  'Overdue':  'py-badge--danger',
  'Failed':   'py-badge--danger',
}

export default function Payments() {
  const navigate = useNavigate()
  const { payments } = getCustomerWorkspaceData(getSession()?.email)
  const summary  = getPaymentSummary(payments)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const summaryCards = [
    {
      label:  'Total Paid',
      value:  formatGHS(summary.totalPaid),
      icon:   CheckCircle2,
      accent: '#8DB600',
    },
    {
      label:  'Upcoming Payments',
      value:  summary.upcomingCount,
      sub:    summary.upcomingCount > 0 ? formatGHS(summary.totalDue) + ' due' : null,
      icon:   Clock,
      accent: '#4a90a4',
    },
    {
      label:  'Outstanding Balance',
      value:  formatGHS(summary.totalDue + summary.totalOverdue),
      icon:   Wallet,
      accent: '#c0842a',
    },
    {
      label:  'Overdue Payments',
      value:  summary.overdueCount,
      sub:    summary.overdueCount > 0 ? formatGHS(summary.totalOverdue) + ' overdue' : null,
      icon:   AlertCircle,
      accent: summary.overdueCount > 0 ? '#c0392b' : '#8DB600',
    },
  ]

  // History: all payments, sorted newest due date first
  const history = useMemo(() => {
    const q = search.trim().toLowerCase()
    return payments
      .filter(p => {
        const matchesFilter = filter === 'All' || p.status === filter
        const matchesSearch = !q ||
          p.ref.toLowerCase().includes(q) ||
          p.policyName.toLowerCase().includes(q) ||
          p.policyId.toLowerCase().includes(q) ||
          p.period.toLowerCase().includes(q)
        return matchesFilter && matchesSearch
      })
      .slice()
      .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
  }, [payments, search, filter])

  // Upcoming: not paid, sorted earliest first
  const upcoming = useMemo(() =>
    payments
      .filter(p => p.status === 'Due Soon' || p.status === 'Upcoming' || p.status === 'Overdue')
      .slice()
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
  [payments])

  return (
    <div className="py-page">

      {/* ── Page heading ── */}
      <header className="py-header">
        <div>
          <h1 className="py-title">Payments</h1>
          <p className="py-subtitle">View your payment history and keep track of upcoming payments.</p>
        </div>
      </header>

      {/* ── Summary cards ── */}
      <section aria-labelledby="py-summary-heading">
        <h2 id="py-summary-heading" className="py-section-label">Overview</h2>
        <div className="py-cards-grid">
          {summaryCards.map(({ label, value, sub, icon: Icon, accent }) => (
            <article key={label} className="py-card" style={{ '--py-accent': accent }}>
              <div className="py-card-icon" aria-hidden="true"><Icon size={20} /></div>
              <div className="py-card-body">
                <span className="py-card-value">{value}</span>
                <span className="py-card-label">{label}</span>
                {sub && <span className="py-card-sub">{sub}</span>}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Upcoming obligations ── */}
      <section aria-labelledby="py-upcoming-heading" className="py-section">
        <h2 id="py-upcoming-heading" className="py-section-label">Upcoming Obligations</h2>
        {upcoming.length === 0 ? (
          <div className="py-empty">
            <CalendarClock size={28} className="py-empty-icon" aria-hidden="true" />
            <p className="py-empty-msg">You have no outstanding or upcoming payments at this time.</p>
          </div>
        ) : (
          <div className="py-upcoming-list">
            {upcoming.map(p => (
              <div
                key={p.ref}
                className={`py-upcoming-item${p.status === 'Overdue' ? ' py-upcoming-item--overdue' : ''}`}
              >
                <div className="py-upcoming-icon" aria-hidden="true">
                  <CreditCard size={18} />
                </div>
                <div className="py-upcoming-info">
                  <span className="py-upcoming-policy">{p.policyName}</span>
                  <span className="py-upcoming-period">{p.policyId} · {p.period}</span>
                </div>
                <div className="py-upcoming-right">
                  <span className="py-upcoming-amount">{formatGHS(p.amount)}</span>
                  <span className="py-upcoming-due">Due {p.dueDate}</span>
                </div>
                <span className={`py-badge ${statusBadge[p.status] ?? ''}`}>{p.status}</span>
                <button
                  type="button"
                  className="py-view-btn"
                  onClick={() => navigate(`/customer/payments/${p.ref}`)}
                  aria-label={`View details for ${p.ref}`}
                >
                  View <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Payment history ── */}
      <section aria-labelledby="py-history-heading" className="py-section">
        <h2 id="py-history-heading" className="py-section-label">Payment History</h2>

        <div className="py-toolbar">
          <div className="py-search-wrap">
            <Search size={15} className="py-search-icon" aria-hidden="true" />
            <input
              id="py-search"
              type="search"
              className="py-search"
              placeholder="Search by reference, policy or period…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search payments"
            />
          </div>
          <div className="py-filters" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                type="button"
                className={`py-filter-btn${filter === f ? ' py-filter-btn--active' : ''}`}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="py-empty">
            <CreditCard size={28} className="py-empty-icon" aria-hidden="true" />
            <p className="py-empty-msg">No payments match your search or filter.</p>
            {(search || filter !== 'All') && (
              <button
                type="button"
                className="py-empty-reset"
                onClick={() => { setSearch(''); setFilter('All') }}
              >
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <div className="py-table-wrap">
            <table className="py-table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Policy</th>
                  <th scope="col">Period</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Due Date</th>
                  <th scope="col">Paid Date</th>
                  <th scope="col">Method</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {history.map(p => (
                  <tr
                    key={p.ref}
                    className="py-table-row"
                    onClick={() => navigate(`/customer/payments/${p.ref}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="py-mono">{p.ref}</td>
                    <td>
                      <span className="py-policy-name">{p.policyName}</span>
                      <span className="py-policy-id">{p.policyId}</span>
                    </td>
                    <td className="py-date-cell">{p.period}</td>
                    <td className="py-amount">{formatGHS(p.amount)}</td>
                    <td className="py-date-cell">{p.dueDate}</td>
                    <td className="py-date-cell">{p.paidDate ?? '—'}</td>
                    <td className="py-method">{p.method ?? '—'}</td>
                    <td>
                      <span className={`py-badge ${statusBadge[p.status] ?? ''}`}>{p.status}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="py-view-btn"
                        onClick={e => { e.stopPropagation(); navigate(`/customer/payments/${p.ref}`) }}
                        aria-label={`View details for ${p.ref}`}
                      >
                        View <ChevronRight size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}
