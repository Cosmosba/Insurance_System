import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, CheckCircle, Clock, XCircle, Search, ShieldCheck, ChevronRight } from 'lucide-react'
import { getSession } from '../services/mockAuth'
import { getCustomerWorkspaceData, getPolicySummary } from '../services/customerData'
import './MyPolicies.css'

const STATUS_FILTERS = ['All', 'Active', 'Pending', 'Lapsed']

const policyStatusBadge = {
  Active:  'mp-badge--success',
  Pending: 'mp-badge--warning',
  Lapsed:  'mp-badge--neutral',
  Expired: 'mp-badge--neutral',
}

const categoryBadge = {
  Life:     'mp-cat--life',
  Health:   'mp-cat--health',
  Pensions: 'mp-cat--pensions',
}

export default function MyPolicies() {
  const navigate = useNavigate()
  const { policies } = getCustomerWorkspaceData(getSession()?.email)
  const summary  = getPolicySummary(policies)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('All')

  const summaryCards = [
    { label: 'Total Policies',   value: summary.total,   icon: FileText,    accent: '#8DB600' },
    { label: 'Active Policies',  value: summary.active,  icon: CheckCircle, accent: '#4a90a4' },
    { label: 'Pending Policies', value: summary.pending, icon: Clock,       accent: '#c0842a' },
    { label: 'Expired / Lapsed', value: summary.expired, icon: XCircle,     accent: '#7b5ea7' },
  ]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return policies.filter(p => {
      const matchesFilter = filter === 'All' || p.status === filter
      const matchesSearch = !q ||
        p.id.toLowerCase().includes(q) ||
        p.product.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      return matchesFilter && matchesSearch
    })
  }, [policies, search, filter])

  return (
    <div className="mp-page">

      {/* ── Page heading ── */}
      <header className="mp-header">
        <div>
          <h1 className="mp-title">My Policies</h1>
          <p className="mp-subtitle">
            You have <strong>{summary.total}</strong> {summary.total === 1 ? 'policy' : 'policies'} on record.
            Sample data only — not real policy records.
          </p>
        </div>
      </header>

      {/* ── Summary cards ── */}
      <section aria-labelledby="mp-summary-heading">
        <h2 id="mp-summary-heading" className="mp-section-label">Overview</h2>
        <div className="mp-cards-grid">
          {summaryCards.map(({ label, value, icon: Icon, accent }) => (
            <article key={label} className="mp-card" style={{ '--mp-accent': accent }}>
              <div className="mp-card-icon" aria-hidden="true"><Icon size={20} /></div>
              <div className="mp-card-body">
                <span className="mp-card-value">{value}</span>
                <span className="mp-card-label">{label}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Search + filters ── */}
      <section aria-labelledby="mp-list-heading" className="mp-section">
        <h2 id="mp-list-heading" className="mp-section-label">Policy List</h2>

        <div className="mp-toolbar">
          <div className="mp-search-wrap">
            <Search size={15} className="mp-search-icon" aria-hidden="true" />
            <input
              id="mp-search"
              type="search"
              className="mp-search"
              placeholder="Search by policy number or product…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search policies"
            />
          </div>

          <div className="mp-filters" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                type="button"
                className={`mp-filter-btn${filter === f ? ' mp-filter-btn--active' : ''}`}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        {filtered.length === 0 ? (
          <div className="mp-empty">
            <ShieldCheck size={30} className="mp-empty-icon" aria-hidden="true" />
            <p className="mp-empty-msg">
              {policies.length === 0
                ? 'You have no policies on record.'
                : 'No policies match your search or filter.'}
            </p>
            {(search || filter !== 'All') && (
              <button
                type="button"
                className="mp-empty-reset"
                onClick={() => { setSearch(''); setFilter('All') }}
              >
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <div className="mp-table-wrap">
            <table className="mp-table">
              <thead>
                <tr>
                  <th scope="col">Policy No.</th>
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  <th scope="col">Policyholder</th>
                  <th scope="col">Start Date</th>
                  <th scope="col">End / Renewal</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr
                    key={p.id}
                    className="mp-table-row"
                    onClick={() => navigate(`/customer/policies/${p.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="mp-mono">{p.id}</td>
                    <td className="mp-product-name">{p.product}</td>
                    <td>
                      <span className={`mp-cat-badge ${categoryBadge[p.category] ?? ''}`}>
                        {p.category}
                      </span>
                    </td>
                    <td>{p.policyholder}</td>
                    <td className="mp-date-cell">{p.startDate}</td>
                    <td className="mp-date-cell">{p.renewalDate}</td>
                    <td>
                      <span className={`mp-badge ${policyStatusBadge[p.status] ?? ''}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="mp-view-btn"
                        onClick={e => { e.stopPropagation(); navigate(`/customer/policies/${p.id}`) }}
                        aria-label={`View details for ${p.id}`}
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
        <p className="mp-note">Sample data only — does not represent real policy records.</p>
      </section>

    </div>
  )
}
