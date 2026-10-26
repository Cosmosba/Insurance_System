import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileSearch, Clock, CheckCircle2, BadgeCheck,
  Search, ChevronRight, FilePlus, AlertTriangle,
} from 'lucide-react'
import { getSession } from '../services/mockAuth'
import { getCustomerWorkspaceData, getClaimSummary, formatGHS } from '../services/customerData'
import './MyClaims.css'

const STATUS_FILTERS = ['All', 'Under Review', 'Approved', 'Rejected', 'Completed']

const statusBadge = {
  'Under Review': 'cl2-badge--info',
  'Pending':      'cl2-badge--warning',
  'Approved':     'cl2-badge--success',
  'Rejected':     'cl2-badge--danger',
  'Completed':    'cl2-badge--neutral',
  'Settled':      'cl2-badge--neutral',
}

export default function MyClaims() {
  const navigate = useNavigate()
  const { claims } = getCustomerWorkspaceData(getSession()?.email)
  const summary  = getClaimSummary(claims)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const summaryCards = [
    { label: 'Total Claims',  value: summary.total,       icon: FileSearch,   accent: '#8DB600' },
    { label: 'Under Review',  value: summary.underReview, icon: Clock,        accent: '#4a90a4' },
    { label: 'Approved',      value: summary.approved,    icon: CheckCircle2, accent: '#2e7d32' },
    { label: 'Settled',       value: summary.settled,     icon: BadgeCheck,   accent: '#7b5ea7' },
  ]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return claims
      .filter(c => {
        const matchesFilter = filter === 'All' || c.status === filter
        const matchesSearch = !q ||
          c.ref.toLowerCase().includes(q) ||
          c.type.toLowerCase().includes(q) ||
          c.policyId.toLowerCase().includes(q) ||
          c.policyName.toLowerCase().includes(q)
        return matchesFilter && matchesSearch
      })
      .slice()
      .sort((a, b) => new Date(b.submitted) - new Date(a.submitted))
  }, [claims, search, filter])

  return (
    <div className="cl2-page">

      {/* ── Page heading ── */}
      <header className="cl2-header">
        <div>
          <h1 className="cl2-title">My Claims</h1>
          <p className="cl2-subtitle">Track your claims and review their current status.</p>
        </div>
        <button
          type="button"
          className="cl2-new-btn"
          onClick={() => navigate('/customer/claims/new')}
          aria-label="Submit a new claim"
        >
          <FilePlus size={16} aria-hidden="true" />
          New Claim
        </button>
      </header>

      {/* ── Summary cards ── */}
      <section aria-labelledby="cl2-summary-heading">
        <h2 id="cl2-summary-heading" className="cl2-section-label">Overview</h2>
        <div className="cl2-cards-grid">
          {summaryCards.map(({ label, value, icon: Icon, accent }) => (
            <article key={label} className="cl2-card" style={{ '--cl2-accent': accent }}>
              <div className="cl2-card-icon" aria-hidden="true"><Icon size={20} /></div>
              <div className="cl2-card-body">
                <span className="cl2-card-value">{value}</span>
                <span className="cl2-card-label">{label}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Claims list ── */}
      <section aria-labelledby="cl2-list-heading" className="cl2-section">
        <h2 id="cl2-list-heading" className="cl2-section-label">Claims History</h2>

        <div className="cl2-toolbar">
          <div className="cl2-search-wrap">
            <Search size={15} className="cl2-search-icon" aria-hidden="true" />
            <input
              id="cl2-search"
              type="search"
              className="cl2-search"
              placeholder="Search by reference, type or policy…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search claims"
            />
          </div>
          <div className="cl2-filters" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                type="button"
                className={`cl2-filter-btn${filter === f ? ' cl2-filter-btn--active' : ''}`}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="cl2-empty">
            <AlertTriangle size={28} className="cl2-empty-icon" aria-hidden="true" />
            <p className="cl2-empty-msg">
              {claims.length === 0
                ? 'You have no claims on record.'
                : 'No claims match your search or filter.'}
            </p>
            {(search || filter !== 'All') && (
              <button
                type="button"
                className="cl2-empty-reset"
                onClick={() => { setSearch(''); setFilter('All') }}
              >
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <div className="cl2-table-wrap">
            <table className="cl2-table">
              <thead>
                <tr>
                  <th scope="col">Claim Ref</th>
                  <th scope="col">Type</th>
                  <th scope="col">Policy</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Date Reported</th>
                  <th scope="col">Last Updated</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={c.ref}
                    className="cl2-table-row"
                    onClick={() => navigate(`/customer/claims/${c.ref}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="cl2-mono">{c.ref}</td>
                    <td className="cl2-type">{c.type}</td>
                    <td>
                      <span className="cl2-policy-name">{c.policyName}</span>
                      <span className="cl2-policy-id">{c.policyId}</span>
                    </td>
                    <td className="cl2-amount">
                      {c.amount != null ? formatGHS(c.amount) : '—'}
                    </td>
                    <td className="cl2-date-cell">{c.submitted}</td>
                    <td className="cl2-date-cell">{c.lastUpdated ?? '—'}</td>
                    <td>
                      <span className={`cl2-badge ${statusBadge[c.status] ?? ''}`}>{c.status}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cl2-view-btn"
                        onClick={e => { e.stopPropagation(); navigate(`/customer/claims/${c.ref}`) }}
                        aria-label={`View details for ${c.ref}`}
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
