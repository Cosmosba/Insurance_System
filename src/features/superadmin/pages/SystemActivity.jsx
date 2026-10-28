import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownUp,
  CalendarDays,
  Download,
  FilterX,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'
import { getSystemActivity, filterSystemActivity, sortSystemActivity, getSystemActivitySummary, exportSystemActivityCsv } from '../../../services/systemActivity'
import { subscribeToRoleAuditEvents } from '../../../services/roleAudit'
import '../styles/SystemActivity.css'

const PAGE_SIZE = 10
const INITIAL_FILTERS = {
  query: '',
  module: 'all',
  category: 'all',
  status: 'all',
  startDate: '',
  endDate: '',
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Not recorded'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function displayValue(value) {
  return typeof value === 'string' && value.trim() ? value : 'Not recorded'
}

export default function SystemActivity() {
  const [activities, setActivities] = useState([])
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [sortDirection, setSortDirection] = useState('desc')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    function refresh() {
      try {
        setActivities(getSystemActivity())
        setError('')
      } catch (loadError) {
        setActivities([])
        setError(loadError.message || 'Unable to load system activity.')
      } finally {
        setLoading(false)
      }
    }

    refresh()
    return subscribeToRoleAuditEvents((_, subscriptionError) => {
      if (subscriptionError) {
        setError(subscriptionError.message || 'Unable to refresh system activity.')
        return
      }
      refresh()
    })
  }, [])

  const filteredActivities = useMemo(
    () => sortSystemActivity(filterSystemActivity(activities, filters), sortDirection),
    [activities, filters, sortDirection],
  )
  const summary = useMemo(() => getSystemActivitySummary(filteredActivities), [filteredActivities])
  const pageCount = Math.max(1, Math.ceil(filteredActivities.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleActivities = filteredActivities.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const modules = [...new Set(activities.map(event => event.module))].sort()
  const categories = [...new Set(activities.map(event => event.category))].sort()
  const statuses = [...new Set(activities.map(event => event.status ?? 'not-recorded'))].sort()
  const hasFilters = Object.entries(filters).some(([key, value]) => value !== INITIAL_FILTERS[key])

  function updateFilter(name, value) {
    setFilters(current => ({ ...current, [name]: value }))
    setPage(1)
    setExpandedId(null)
  }

  function clearFilters() {
    setFilters(INITIAL_FILTERS)
    setPage(1)
    setExpandedId(null)
  }

  function exportCsv() {
    setExportError('')
    if (!filteredActivities.length) {
      setExportError('There are no matching records to export.')
      return
    }

    try {
      const blob = new Blob([`\uFEFF${exportSystemActivityCsv(filteredActivities)}`], {
        type: 'text/csv;charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `system-activity-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setExportError('Unable to prepare the CSV export in this browser.')
    }
  }

  return (
    <div className="activity-page">
      <header className="activity-header">
        <div>
          <span className="activity-eyebrow">Administration</span>
          <h1>System Activity</h1>
          <p>Review recorded account, department, and permission changes.</p>
        </div>
        <button
          className="activity-button activity-button--primary"
          type="button"
          onClick={exportCsv}
          disabled={loading || filteredActivities.length === 0}
        >
          <Download size={16} aria-hidden="true" />
          Export CSV
        </button>
      </header>

      <p className="activity-disclaimer">
        Activity is stored in this browser and is not a centralized audit trail.
      </p>

      {error && (
        <div className="activity-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => {
            setLoading(true)
            try {
              setActivities(getSystemActivity())
              setError('')
            } catch (loadError) {
              setError(loadError.message || 'Unable to load system activity.')
            } finally {
              setLoading(false)
            }
          }}>
            Retry
          </button>
        </div>
      )}
      {exportError && <p className="activity-export-error" role="alert">{exportError}</p>}

      <section className="activity-summary" aria-label="Activity summary">
        <article className="activity-summary-card">
          <span className="activity-summary-icon"><Activity size={19} aria-hidden="true" /></span>
          <span className="activity-summary-label">Total Activities</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="activity-summary-card">
          <span className="activity-summary-icon activity-summary-icon--amber"><CalendarDays size={19} aria-hidden="true" /></span>
          <span className="activity-summary-label">Today&apos;s Activities</span>
          <strong>{summary.today}</strong>
        </article>
        <article className="activity-summary-card">
          <span className="activity-summary-icon activity-summary-icon--blue"><Users size={19} aria-hidden="true" /></span>
          <span className="activity-summary-label">User Management</span>
          <strong>{summary.userManagement}</strong>
        </article>
        <article className="activity-summary-card">
          <span className="activity-summary-icon activity-summary-icon--slate"><ShieldCheck size={19} aria-hidden="true" /></span>
          <span className="activity-summary-label">Security &amp; Permissions</span>
          <strong>{summary.security}</strong>
        </article>
      </section>

      <section className="activity-directory" aria-labelledby="activity-directory-title">
        <div className="activity-directory-heading">
          <div>
            <h2 id="activity-directory-title">Activity log</h2>
            <p>Only events recorded by the application are shown.</p>
          </div>
          <span className="activity-result-count">
            {filteredActivities.length} {filteredActivities.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        <div className="activity-toolbar" role="search">
          <label className="activity-search">
            <Search size={16} aria-hidden="true" />
            <span className="activity-sr-only">Search activities</span>
            <input
              type="search"
              value={filters.query}
              onChange={event => updateFilter('query', event.target.value)}
              placeholder="Search actor, action, target or details"
            />
          </label>
          <label className="activity-select">
            <span className="activity-sr-only">Filter by module</span>
            <select value={filters.module} onChange={event => updateFilter('module', event.target.value)}>
              <option value="all">All modules</option>
              {modules.map(module => <option key={module} value={module}>{module}</option>)}
            </select>
          </label>
          <label className="activity-select">
            <span className="activity-sr-only">Filter by action category</span>
            <select value={filters.category} onChange={event => updateFilter('category', event.target.value)}>
              <option value="all">All categories</option>
              {categories.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="activity-select">
            <span className="activity-sr-only">Filter by status</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value)}>
              <option value="all">All statuses</option>
              {statuses.map(status => (
                <option key={status} value={status}>
                  {status === 'not-recorded' ? 'Not recorded' : status}
                </option>
              ))}
            </select>
          </label>
          <label className="activity-date">
            <span>From</span>
            <input
              type="date"
              aria-label="Activity start date"
              value={filters.startDate}
              max={filters.endDate || undefined}
              onChange={event => updateFilter('startDate', event.target.value)}
            />
          </label>
          <label className="activity-date">
            <span>To</span>
            <input
              type="date"
              aria-label="Activity end date"
              min={filters.startDate || undefined}
              onChange={event => updateFilter('endDate', event.target.value)}
              value={filters.endDate}
            />
          </label>
          {hasFilters && (
            <button className="activity-button activity-button--secondary" type="button" onClick={clearFilters}>
              <FilterX size={15} aria-hidden="true" />
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="activity-empty" role="status">Loading activity…</div>
        ) : error ? (
          <div className="activity-empty">
            <span className="activity-empty-icon"><Activity size={22} aria-hidden="true" /></span>
            <h3>Activity unavailable</h3>
            <p>Saved activity could not be read. Resolve the storage issue and retry.</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="activity-empty">
            <span className="activity-empty-icon"><Activity size={22} aria-hidden="true" /></span>
            <h3>{activities.length ? 'No matching activity' : 'No activity recorded'}</h3>
            <p>
              {activities.length
                ? 'Try adjusting or clearing the selected filters.'
                : 'Recorded administrative changes will appear here.'}
            </p>
            {activities.length > 0 && hasFilters && (
              <button className="activity-button activity-button--secondary" type="button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="activity-table-wrap">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <button
                        className="activity-sort"
                        type="button"
                        onClick={() => setSortDirection(current => current === 'desc' ? 'asc' : 'desc')}
                        aria-label={`Sort by date and time, currently ${sortDirection === 'desc' ? 'newest first' : 'oldest first'}`}
                      >
                        Date and Time <ArrowDownUp size={13} aria-hidden="true" />
                      </button>
                    </th>
                    <th scope="col">Actor</th>
                    <th scope="col">Action</th>
                    <th scope="col">Module</th>
                    <th scope="col">Target / Affected Record</th>
                    <th scope="col">Status</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleActivities.map(event => (
                    <Fragment key={event.id}>
                      <tr key={event.id}>
                        <td className="activity-date-cell">{formatTimestamp(event.timestamp)}</td>
                        <td>
                          <span className="activity-actor">
                            <UserRound size={14} aria-hidden="true" />
                            {displayValue(event.actor)}
                          </span>
                        </td>
                        <td><span className="activity-action">{event.action}</span></td>
                        <td>{event.module}</td>
                        <td>
                          <span className="activity-target">{displayValue(event.targetName)}</span>
                          <span className="activity-target-id">{displayValue(event.targetId)}</span>
                        </td>
                        <td>
                          <span className={`activity-status${event.status ? ' activity-status--recorded' : ''}`}>
                            {displayValue(event.status)}
                          </span>
                        </td>
                        <td>
                          <button
                            className="activity-details-button"
                            type="button"
                            aria-expanded={expandedId === event.id}
                            onClick={() => setExpandedId(current => current === event.id ? null : event.id)}
                          >
                            {expandedId === event.id ? 'Hide details' : 'View details'}
                          </button>
                        </td>
                      </tr>
                      {expandedId === event.id && (
                        <tr className="activity-expanded-row" key={`${event.id}-details`}>
                          <td colSpan="7">
                            <div className="activity-expanded-content">
                              <strong>Recorded details</strong>
                              <dl>
                                <div><dt>Event ID</dt><dd>{event.id}</dd></div>
                                <div><dt>Target type</dt><dd>{displayValue(event.targetType)}</dd></div>
                                <div><dt>Category</dt><dd>{event.category}</dd></div>
                                <div className="activity-detail-wide"><dt>Details</dt><dd>{displayValue(event.details)}</dd></div>
                              </dl>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="activity-pagination">
              <span>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredActivities.length)} of {filteredActivities.length}
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => setPage(current => Math.max(1, current - 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </button>
                <span>Page {currentPage} of {pageCount}</span>
                <button
                  type="button"
                  onClick={() => setPage(current => Math.min(pageCount, current + 1))}
                  disabled={currentPage >= pageCount}
                >
                  Next
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
      <span className="activity-sr-only" aria-live="polite">
        {visibleActivities.length} activity records shown
      </span>
    </div>
  )
}
