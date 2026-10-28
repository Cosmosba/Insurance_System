import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  Building2,
  Download,
  FilterX,
  RefreshCw,
  UserRound,
  Users,
  UserRoundCheck,
  UserRoundPlus,
  X,
} from 'lucide-react'
import {
  COMPANY_REPORT_SCOPE,
  exportReportAnalyticsCsv,
  getReportAnalytics,
  subscribeToReportAnalytics,
} from '../../services/reportAnalytics'
import './ReportsAnalytics.css'

const INITIAL_FILTERS = {
  startDate: '',
  endDate: '',
  departmentId: 'all',
  status: 'all',
}

function formatNumber(value) {
  return value === null || value === undefined
    ? 'Not available'
    : new Intl.NumberFormat().format(value)
}

function formatMonth(month) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' })
    .format(new Date(`${month}-15T12:00:00`))
}

function ReportSection({ title, description, children, className = '' }) {
  return (
    <section className={`ra-card ${className}`}>
      <header className="ra-section-header">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

function useChartInteraction() {
  const chartRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  function showTooltip(event, item, pointer = true) {
    const bounds = chartRef.current?.getBoundingClientRect()
    if (!bounds) return
    const point = pointer
      ? { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
      : { x: bounds.width / 2, y: Math.max(44, bounds.height / 2) }
    const tooltipWidth = Math.min(220, Math.max(150, bounds.width - 16))
    const tooltipHeight = item.details ? 105 : 78
    const left = Math.min(Math.max(8, point.x + 15), Math.max(8, bounds.width - tooltipWidth - 8))
    const top = point.y > bounds.height * 0.6
      ? Math.max(8, point.y - tooltipHeight - 12)
      : Math.min(point.y + 14, Math.max(8, bounds.height - tooltipHeight - 8))
    setTooltip({ ...item, left, top })
  }

  function clearTooltip() {
    setTooltip(null)
  }

  return { chartRef, tooltip, showTooltip, clearTooltip }
}

function ChartTooltip({ tooltip }) {
  if (!tooltip) return null
  const unit = tooltip.value === 1 ? 'record' : 'records'
  return (
    <div
      className="ra-chart-tooltip"
      style={{ left: tooltip.left, top: tooltip.top }}
      role="status"
      aria-live="polite"
    >
      <strong>{tooltip.label}</strong>
      <span>{formatNumber(tooltip.value)} {unit}{tooltip.percentage === null ? '' : ` · ${tooltip.percentage}%`}</span>
      {tooltip.details && <small>{tooltip.details}</small>}
    </div>
  )
}

function AnalyticsBarChart({ rows, emptyText = 'No records match the selected filters.', onSelect, selectedKey }) {
  const { chartRef, tooltip, showTooltip, clearTooltip } = useChartInteraction()
  if (!rows.length) return <p className="ra-empty-chart">{emptyText}</p>
  const maximum = Math.max(1, ...rows.map(row => row.value))
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  return (
    <div className="ra-chart-interaction ra-bar-chart" ref={chartRef} role="list">
      {rows.map((row, index) => {
        const selected = selectedKey === row.key
        const item = {
          label: row.label,
          value: row.value,
          percentage: total ? Math.round((row.value / total) * 100) : null,
          details: row.details,
        }
        return (
        <div
          className={`ra-bar-row${onSelect ? ' ra-bar-row--selectable' : ''}${tooltip?.label === row.label ? ' ra-chart-mark--active' : ''}${selected ? ' ra-chart-mark--selected' : ''}${tooltip && tooltip.label !== row.label ? ' ra-chart-mark--dimmed' : ''}`}
          key={row.key ?? row.label}
          role={onSelect ? 'button' : 'listitem'}
          tabIndex="0"
          aria-label={`${row.label}: ${formatNumber(row.value)}${total ? `, ${item.percentage}%` : ''}`}
          onPointerEnter={event => showTooltip(event, item)}
          onPointerMove={event => showTooltip(event, item)}
          onPointerLeave={clearTooltip}
          onFocus={event => showTooltip(event, item, false)}
          onBlur={clearTooltip}
          onClick={onSelect ? () => onSelect(row) : undefined}
          onKeyDown={onSelect ? event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect(row)
            }
          } : undefined}
          style={{ '--ra-chart-order': index }}
        >
          <div className="ra-bar-label">
            <span>{row.label}</span>
            <strong>{formatNumber(row.value)}</strong>
          </div>
          <div className="ra-bar-track" aria-hidden="true">
            <span
              className={row.value === 0 ? 'ra-bar-fill ra-bar-fill--zero' : 'ra-bar-fill'}
              style={{ width: `${Math.max(row.value === 0 ? 0.8 : 0, (row.value / maximum) * 100)}%` }}
            />
          </div>
        </div>
        )
      })}
      <ChartTooltip tooltip={tooltip} />
    </div>
  )
}

function AnalyticsDonutChart({ rows, emptyText = 'No records match the selected filters.' }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  if (!total) return <p className="ra-empty-chart">{emptyText}</p>

  return <InteractiveDonutChart rows={rows} total={total} />
}

function InteractiveDonutChart({ rows, total }) {
  const { chartRef, tooltip, showTooltip, clearTooltip } = useChartInteraction()
  const colors = ['#8db600', '#39758b', '#d6a937', '#9b7ac5', '#e27b52']
  const radius = 48
  const circumference = 2 * Math.PI * radius

  return (
    <div className="ra-chart-interaction ra-donut-layout" ref={chartRef}>
      <div className="ra-donut-visual">
        <svg viewBox="0 0 120 120" role="group" aria-label={`Distribution of ${formatNumber(total)} records`}>
          <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(91, 112, 57, 0.1)" strokeWidth="15" />
          {rows.map((row, index) => {
            const length = (row.value / total) * circumference
            const offset = rows.slice(0, index).reduce(
              (sum, previous) => sum + (previous.value / total) * circumference,
              0,
            )
            return (
              <circle
                key={row.label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={colors[index % colors.length]}
                strokeWidth="15"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
                className={`ra-donut-segment${tooltip?.label === row.label ? ' ra-donut-segment--active' : ''}${tooltip && tooltip.label !== row.label ? ' ra-donut-segment--dimmed' : ''}`}
                role="img"
                tabIndex="0"
                aria-label={`${row.label}: ${formatNumber(row.value)}, ${Math.round((row.value / total) * 100)} percent`}
                onPointerEnter={event => showTooltip(event, {
                  label: row.label,
                  value: row.value,
                  percentage: Math.round((row.value / total) * 100),
                })}
                onPointerMove={event => showTooltip(event, {
                  label: row.label,
                  value: row.value,
                  percentage: Math.round((row.value / total) * 100),
                })}
                onPointerLeave={clearTooltip}
                onFocus={event => showTooltip(event, {
                  label: row.label,
                  value: row.value,
                  percentage: Math.round((row.value / total) * 100),
                }, false)}
                onBlur={clearTooltip}
              >
                <title>{`${row.label}: ${formatNumber(row.value)} (${Math.round((row.value / total) * 100)}%)`}</title>
              </circle>
            )
          })}
          <text x="60" y="57" textAnchor="middle" className="ra-donut-total">{formatNumber(total)}</text>
          <text x="60" y="72" textAnchor="middle" className="ra-donut-caption">records</text>
        </svg>
      </div>
      <div className="ra-donut-legend" role="list">
        {rows.map((row, index) => (
          <div className="ra-donut-legend-item" key={row.label} role="listitem">
            <i style={{ backgroundColor: colors[index % colors.length] }} aria-hidden="true" />
            <span>{row.label}</span>
            <strong>{formatNumber(row.value)}</strong>
            <small>{Math.round((row.value / total) * 100)}%</small>
          </div>
        ))}
      </div>
      <ChartTooltip tooltip={tooltip} />
    </div>
  )
}

function AnalyticsTrendChart({ rows, departmentScope = false }) {
  const visibleRows = rows.slice(-8)
  const { chartRef, tooltip, showTooltip, clearTooltip } = useChartInteraction()
  const series = [
    { key: 'customers', label: 'Customers', color: '#6f9200' },
    { key: 'staff', label: 'Staff', color: '#3b6c86' },
    { key: 'activities', label: 'Activities', color: '#b18a28' },
  ].filter(item => rows.some(row => row[item.key] !== null))

  if (!visibleRows.length || !series.length) {
    return <p className="ra-empty-chart">No dated records are available for the selected period.</p>
  }

  const width = 800
  const height = 260
  const padding = { top: 22, right: 24, bottom: 52, left: 42 }
  const graphWidth = width - padding.left - padding.right
  const graphHeight = height - padding.top - padding.bottom
  const values = visibleRows.flatMap(row => series.map(item => row[item.key] ?? 0))
  const maximum = Math.max(1, ...values)
  const xAt = index => padding.left + (visibleRows.length === 1 ? graphWidth / 2 : (index / (visibleRows.length - 1)) * graphWidth)
  const yAt = value => padding.top + graphHeight - (value / maximum) * graphHeight

  return (
    <>
      <div className="ra-chart-interaction ra-trend-chart-wrap" ref={chartRef}>
        <svg
          className="ra-trend-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Monthly trend of ${series.map(item => item.label.toLocaleLowerCase()).join(', ')}`}
          preserveAspectRatio="none"
        >
          <title>Monthly customer, workforce, and activity counts</title>
          {[0, 0.5, 1].map(position => {
            const y = padding.top + graphHeight * position
            return (
              <g key={position}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="ra-chart-grid" />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" className="ra-chart-axis">
                  {Math.round(maximum * (1 - position))}
                </text>
              </g>
            )
          })}
          {series.map(item => {
            const points = visibleRows
              .map((row, index) => row[item.key] === null ? null : `${xAt(index)},${yAt(row[item.key])}`)
              .filter(Boolean)
              .join(' ')
            return (
              <g key={item.key}>
                <polyline className="ra-trend-line" points={points} fill="none" stroke={item.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                {visibleRows.map((row, index) => row[item.key] === null ? null : (
                  <circle
                    key={`${item.key}-${row.month}`}
                    cx={xAt(index)}
                    cy={yAt(row[item.key])}
                    r="3.5"
                    fill={item.color}
                  >
                    <title>{`${formatMonth(row.month)}: ${item.label} ${formatNumber(row[item.key])}`}</title>
                  </circle>
                ))}
              </g>
            )
          })}
          {visibleRows.map((row, index) => {
            const groupWidth = Math.min(40, graphWidth / visibleRows.length * 0.65)
            const barWidth = Math.min(11, groupWidth / series.length)
            const startX = xAt(index) - (barWidth * series.length) / 2
            return (
              <g key={`bars-${row.month}`} className="ra-trend-bars">
                {series.map((item, seriesIndex) => {
                  const value = row[item.key] ?? 0
                  const barHeight = value === 0 ? 2 : Math.max(3, graphHeight * (value / maximum))
                  const x = startX + seriesIndex * barWidth
                  const y = padding.top + graphHeight - barHeight
                  const itemTotal = visibleRows.reduce((sum, monthRow) => sum + (monthRow[item.key] ?? 0), 0)
                  const chartItem = {
                    label: `${formatMonth(row.month)} · ${item.label}`,
                    value,
                    percentage: itemTotal ? Math.round((value / itemTotal) * 100) : null,
                  }
                  const handleFocus = event => showTooltip(event, chartItem, false)
                  return (
                    <rect
                      key={item.key}
                      className={`ra-trend-bar${tooltip?.label === chartItem.label ? ' ra-trend-bar--active' : ''}${tooltip && tooltip.label !== chartItem.label ? ' ra-trend-bar--dimmed' : ''}`}
                      x={x}
                      y={y}
                      width={barWidth - 1}
                      height={barHeight}
                      rx="2"
                      fill={item.color}
                      role="img"
                      tabIndex="0"
                      aria-label={`${formatMonth(row.month)} ${item.label}: ${formatNumber(value)}${chartItem.percentage === null ? '' : `, ${chartItem.percentage}% of displayed ${item.label.toLowerCase()}`}`}
                      onPointerEnter={event => showTooltip(event, chartItem)}
                      onPointerMove={event => showTooltip(event, chartItem)}
                      onPointerLeave={clearTooltip}
                      onFocus={handleFocus}
                      onBlur={clearTooltip}
                      style={{ '--ra-chart-order': index * series.length + seriesIndex }}
                    />
                  )
                })}
              </g>
            )
          })}
          {visibleRows.map((row, index) => (
            <text
              key={row.month}
              x={xAt(index)}
              y={height - 15}
              textAnchor="middle"
              className="ra-chart-axis"
            >
              {formatMonth(row.month)}
            </text>
          ))}
        </svg>
        <ChartTooltip tooltip={tooltip} />
      </div>
      <div className="ra-chart-legend" aria-label="Chart legend">
        {series.map(item => (
          <span key={item.key}>
            <i style={{ backgroundColor: item.color }} aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>
      {rows.length > visibleRows.length && (
        <p className="ra-chart-note">Showing the latest {visibleRows.length} months in the selected period.</p>
      )}
      {departmentScope && (
        <p className="ra-chart-note">Customer and system activity series are unavailable for department scope.</p>
      )}
    </>
  )
}

function DepartmentComparisonCards({ departments }) {
  if (!departments.length) {
    return <p className="ra-empty-chart">No departments match the selected filters.</p>
  }
  const maximum = Math.max(1, ...departments.map(department => department.staffCount))
  return (
    <div className="ra-department-cards">
      {departments.map(department => (
        <article className="ra-department-card" key={department.id}>
          <div className="ra-department-card-heading">
            <span className="ra-department-icon"><Building2 size={17} aria-hidden="true" /></span>
            <div>
              <h3>{department.name}</h3>
              <span>{department.code || 'Department'}</span>
            </div>
            <span className={`ra-status-badge${department.status === 'Active' ? ' ra-status-badge--active' : ''}`}>
              {department.status || 'Not recorded'}
            </span>
          </div>
          <div className="ra-department-progress">
            <div className="ra-department-progress-label">
              <span>Staff distribution</span>
              <strong>{formatNumber(department.staffCount)}</strong>
            </div>
            <div
              className="ra-bar-track"
              role="progressbar"
              aria-label={`${department.name} staff`}
              aria-valuemin="0"
              aria-valuemax={maximum}
              aria-valuenow={department.staffCount}
            >
              <span style={{ width: `${(department.staffCount / maximum) * 100}%` }} />
            </div>
          </div>
          <div className="ra-department-card-footer">
            <span><UserRound size={14} aria-hidden="true" /> Managers <strong>{formatNumber(department.managerCount)}</strong></span>
            <span className={`ra-manager-indicator${department.assignedManager ? ' ra-manager-indicator--assigned' : ''}`}>
              {department.assignedManager ? 'Manager assigned' : 'No manager assigned'}
            </span>
          </div>
        </article>
      ))}
    </div>
  )
}

function TrendHighlightCards({ rows, departmentScope = false }) {
  const visibleRows = rows.slice(-3)
  if (!visibleRows.length) return null
  const metrics = [
    { key: 'customers', label: 'Customers', color: '#6f9200' },
    { key: 'staff', label: 'Staff', color: '#3b6c86' },
    { key: 'activities', label: 'Activity', color: '#b18a28' },
  ].filter(metric => !departmentScope || metric.key === 'staff')

  return (
    <div className="ra-trend-highlights" aria-label="Recent monthly totals">
      {visibleRows.map(row => (
        <article className="ra-trend-month-card" key={row.month}>
          <h3>{formatMonth(row.month)}</h3>
          <div className="ra-trend-month-metrics">
            {metrics.map(metric => (
              <div className="ra-trend-month-metric" key={metric.key}>
                <i style={{ backgroundColor: metric.color }} aria-hidden="true" />
                <span>{metric.label}</span>
                <strong>{formatNumber(row[metric.key])}</strong>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}

export default function ReportsAnalytics() {
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [report, setReport] = useState(null)
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportError, setExportError] = useState('')
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(null)

  useEffect(() => {
    let active = true
    const refresh = (nextReport, nextError) => {
      if (!active) return
      if (nextError) {
        setError(nextError.message || 'Report data could not be loaded.')
        setReport(null)
      } else {
        setError('')
        setReport(nextReport)
        setDepartments(nextReport?.departmentOptions ?? [])
      }
      setLoading(false)
    }

    const load = () => {
      try {
        refresh(getReportAnalytics(COMPANY_REPORT_SCOPE, filters), null)
      } catch (loadError) {
        refresh(null, loadError)
      }
    }
    load()
    const unsubscribe = subscribeToReportAnalytics(COMPANY_REPORT_SCOPE, filters, refresh)
    return () => {
      active = false
      unsubscribe()
    }
  }, [filters])

  const kpis = report?.kpis
  const selectedDepartment = report?.departmentComparisons.find(
    department => department.id === selectedDepartmentId,
  )
  function updateFilter(name, value) {
    setFilters(current => ({ ...current, [name]: value }))
    setExportError('')
  }

  function resetFilters() {
    setFilters(INITIAL_FILTERS)
    setExportError('')
  }

  function exportCsv() {
    setExportError('')
    if (!report) return
    try {
      const csv = exportReportAnalyticsCsv(report)
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `emple-company-report-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (exportFailure) {
      setExportError(exportFailure.message || 'The report could not be exported.')
    }
  }

  if (loading) {
    return <div className="ra-page"><p className="ra-state" role="status">Loading company reports…</p></div>
  }

  return (
    <main className="ra-page">
      <header className="ra-page-header">
        <div>
          <span className="ra-eyebrow">Administration</span>
          <h1>Reports &amp; Analytics</h1>
          <p>Company-wide customer, workforce, department, and system activity insights.</p>
        </div>
        <button className="ra-button ra-button--primary" type="button" onClick={exportCsv} disabled={!report}>
          <Download size={17} aria-hidden="true" />
          Export CSV
        </button>
      </header>

      <div className="ra-notice" role="note">
        Company totals include every department. The department filter narrows department comparisons only;
        customer records and existing activity events are not consistently assigned to departments.
      </div>

      {error && (
        <div className="ra-alert" role="alert">
          <span>{error}</span>
          <button className="ra-button" type="button" onClick={() => setFilters(current => ({ ...current }))}>
            <RefreshCw size={15} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      <section className="ra-card ra-filter-card" aria-label="Report filters">
        <div className="ra-filter-heading">
          <div>
            <h2>Report filters</h2>
            <p>Date and status apply to customer and staff records; status also filters department comparisons. Date also filters activity.</p>
          </div>
          <button className="ra-button ra-button--quiet" type="button" onClick={resetFilters}>
            <FilterX size={16} aria-hidden="true" /> Reset filters
          </button>
        </div>
        <div className="ra-filter-grid">
          <label>
            <span>From date</span>
            <input type="date" value={filters.startDate} onChange={event => updateFilter('startDate', event.target.value)} />
          </label>
          <label>
            <span>To date</span>
            <input type="date" value={filters.endDate} onChange={event => updateFilter('endDate', event.target.value)} />
          </label>
          <label>
            <span>Department comparisons</span>
            <select value={filters.departmentId} onChange={event => updateFilter('departmentId', event.target.value)}>
              <option value="all">All departments</option>
              {departments.map(department => (
                <option value={department.id} key={department.id}>{department.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Account &amp; department status</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value)}>
              <option value="all">All statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
        </div>
      </section>

      {exportError && <p className="ra-alert ra-alert--subtle" role="alert">{exportError}</p>}
      {report && (
        <>
          <div className="ra-overview-heading">
            <h2>Executive overview</h2>
            <p>Company-wide totals remain visible when you narrow department comparisons.</p>
          </div>
          <section className="ra-kpi-grid" aria-label="Executive overview">
            <article className="ra-kpi">
              <span className="ra-kpi-icon"><Users size={20} aria-hidden="true" /></span>
              <span className="ra-kpi-label">Customers</span>
              <strong>{formatNumber(kpis.customers)}</strong>
              <small>Records matching the selected date and status filters</small>
            </article>
            <article className="ra-kpi">
              <span className="ra-kpi-icon"><UserRoundCheck size={20} aria-hidden="true" /></span>
              <span className="ra-kpi-label">Active customers</span>
              <strong>{formatNumber(kpis.activeCustomers)}</strong>
              <small>Current active customer records in the filtered dataset</small>
            </article>
            <article className="ra-kpi">
              <span className="ra-kpi-icon"><UserRoundPlus size={20} aria-hidden="true" /></span>
              <span className="ra-kpi-label">Staff</span>
              <strong>{formatNumber(kpis.staff)}</strong>
              <small>All company departments are included</small>
            </article>
            <article className="ra-kpi">
              <span className="ra-kpi-icon"><UserRoundCheck size={20} aria-hidden="true" /></span>
              <span className="ra-kpi-label">Active staff</span>
              <strong>{formatNumber(kpis.activeStaff)}</strong>
              <small>Active staff records in the filtered dataset</small>
            </article>
            <article className="ra-kpi">
              <span className="ra-kpi-icon"><Building2 size={20} aria-hidden="true" /></span>
              <span className="ra-kpi-label">Departments</span>
              <strong>{formatNumber(kpis.departments)}</strong>
              <small>Registered departments matching the status filter</small>
            </article>
          </section>

          <div className="ra-section-grid">
            <ReportSection
              title="Customer analytics"
              description="Customer registration and account status from the customer directory."
            >
              <h3 className="ra-chart-title">Customer status distribution</h3>
              <AnalyticsDonutChart rows={report.customerAnalytics.byStatus} />
              <h3 className="ra-chart-title ra-chart-title--spaced">Customer status counts</h3>
              <AnalyticsBarChart rows={report.customerAnalytics.byStatus} />
            </ReportSection>

            <ReportSection
              title="Workforce distribution"
              description="Staff roles and account assignments across the company."
            >
              <h3 className="ra-chart-title">Workforce by role</h3>
              <AnalyticsDonutChart rows={report.workforceAnalytics.byRole} />
              <h3 className="ra-chart-title ra-chart-title--spaced">Staff counts by role</h3>
              <AnalyticsBarChart rows={report.workforceAnalytics.byRole} />
              <p className="ra-inline-stat">
                <span>Staff without a registered department assignment</span>
                <strong>{formatNumber(report.workforceAnalytics.unassigned)}</strong>
              </p>
            </ReportSection>
          </div>

          <ReportSection
            title="Cross-department comparison"
            description="Compare staff distribution and manager coverage across registered departments."
            className="ra-department-section"
          >
            <div className="ra-comparison-overview">
              <div className="ra-department-chart">
                <h3 className="ra-chart-title">Staff by department</h3>
                <AnalyticsBarChart
                  rows={report.departmentComparisons.map(row => ({
                    key: row.id,
                    label: row.name,
                    value: row.staffCount,
                    details: `${formatNumber(row.managerCount)} managers · ${row.assignedManager ? 'Manager assigned' : 'No manager assigned'}`,
                  }))}
                  onSelect={row => setSelectedDepartmentId(current => current === row.key ? null : row.key)}
                  selectedKey={selectedDepartmentId}
                />
              </div>
              <div className="ra-coverage-card">
                <span className="ra-coverage-icon"><Building2 size={19} aria-hidden="true" /></span>
                <span className="ra-coverage-label">Departments with a manager</span>
                <strong>{formatNumber(report.departmentComparisons.filter(row => row.assignedManager).length)}</strong>
                <span className="ra-coverage-caption">of {formatNumber(report.departmentComparisons.length)} shown</span>
              </div>
            </div>
            {selectedDepartment && (
              <aside className="ra-selection-panel" aria-live="polite">
                <span className="ra-selection-icon"><Building2 size={18} aria-hidden="true" /></span>
                <div>
                  <strong>{selectedDepartment.name}</strong>
                  <p>
                    {formatNumber(selectedDepartment.staffCount)} staff ·{' '}
                    {formatNumber(selectedDepartment.managerCount)} managers ·{' '}
                    {selectedDepartment.status || 'Status not recorded'} ·{' '}
                    {selectedDepartment.assignedManager ? 'Manager assigned' : 'No manager assigned'}
                  </p>
                  <small>This chart selection does not change the report filters.</small>
                </div>
                <button
                  className="ra-selection-clear"
                  type="button"
                  onClick={() => setSelectedDepartmentId(null)}
                  aria-label="Clear department chart selection"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </aside>
            )}
            <DepartmentComparisonCards departments={report.departmentComparisons} />
          </ReportSection>

          <div className="ra-section-grid">
            <ReportSection
              title="System activity"
              description="Recorded audit events available in this browser; the current audit store retains up to 100 events."
            >
              <div className="ra-activity-total">
                <Activity size={19} aria-hidden="true" />
                <span>Total recorded events</span>
                <strong>{formatNumber(report.activityAnalytics.total)}</strong>
              </div>
              <h3 className="ra-chart-title">Events by module</h3>
              <AnalyticsBarChart rows={report.activityAnalytics.byModule} />
              <h3 className="ra-chart-title ra-chart-title--spaced">Events by action</h3>
              <AnalyticsBarChart rows={report.activityAnalytics.byAction} />
            </ReportSection>

            <ReportSection
              title="Time-based trends"
              description="Monthly counts use recorded customer registration, staff creation, and audit timestamps."
            >
              <AnalyticsTrendChart rows={report.trends} />
              <TrendHighlightCards rows={report.trends} />
              <p className="ra-chart-note">{report.dataNotes.staffDates}</p>
            </ReportSection>
          </div>
          <p className="ra-storage-note">
            Reports use records stored in this browser. Updates in this browser and supported cross-tab storage
            changes are reflected automatically; data is not a centralized or cross-user live reporting source.
          </p>
        </>
      )}
    </main>
  )
}
