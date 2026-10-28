import { useState, useEffect } from 'react'
import { Users, FileText, AlertCircle, DollarSign, UserPlus, FilePlus, CreditCard } from 'lucide-react'
import '../styles/Dashboard.css'

const summaryCards = [
  {
    label: 'Total Customers',
    value: '1,284',
    icon: Users,
    accent: '#8DB600',
    note: 'Sample figure — not real data',
  },
  {
    label: 'Active Policies',
    value: '3,047',
    icon: FileText,
    accent: '#4a90a4',
    note: 'Sample figure — not real data',
  },
  {
    label: 'Pending Claims',
    value: '38',
    icon: AlertCircle,
    accent: '#c0842a',
    note: 'Sample figure — not real data',
  },
  {
    label: 'Payments Received',
    value: '$124,500',
    icon: DollarSign,
    accent: '#5a7a3a',
    note: 'Sample figure — not real data',
  },
]

const recentActivity = [
  { activity: 'New customer registered',   reference: 'CUST-00412', date: '12 Jul 2025', status: 'Completed' },
  { activity: 'Policy issued',             reference: 'POL-20891',  date: '11 Jul 2025', status: 'Active'    },
  { activity: 'Claim submitted',           reference: 'CLM-00573',  date: '10 Jul 2025', status: 'Pending'   },
  { activity: 'Premium payment recorded',  reference: 'PAY-08834',  date: '09 Jul 2025', status: 'Completed' },
  { activity: 'Policy renewal requested',  reference: 'POL-19204',  date: '08 Jul 2025', status: 'Review'    },
]

const statusClass = {
  Completed: 'status-completed',
  Active:    'status-active',
  Pending:   'status-pending',
  Review:    'status-review',
}

function formatDate(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }) + ' · ' + date.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function Dashboard() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="dashboard">

      {/* ── Heading ── */}
      <header className="dash-header">
        <div>
          <h1 className="dash-title">Welcome to Emple Life Insurance</h1>
          <p className="dash-subtitle">Your insurance management workspace.</p>
        </div>
        <span className="dash-date" aria-label="Today's date" aria-live="polite">{formatDate(now)}</span>
      </header>

      {/* ── Summary cards ── */}
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="section-label">Overview</h2>
        <div className="cards-grid">
          {summaryCards.map(({ label, value, icon: Icon, accent, note }) => (
            <article key={label} className="summary-card" style={{ '--card-accent': accent }}>
              <div className="card-icon-wrap" aria-hidden="true">
                <Icon size={20} />
              </div>
              <div className="card-body">
                <span className="card-value">{value}</span>
                <span className="card-label">{label}</span>
                <span className="card-note">{note}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Recent Activity ── */}
      <section aria-labelledby="activity-heading" className="dash-section">
        <h2 id="activity-heading" className="section-label">Recent Activity</h2>
        <div className="table-wrapper">
          <table className="activity-table">
            <thead>
              <tr>
                <th scope="col">Activity</th>
                <th scope="col">Reference</th>
                <th scope="col">Date</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((row) => (
                <tr key={row.reference}>
                  <td>{row.activity}</td>
                  <td className="ref-cell">{row.reference}</td>
                  <td className="date-cell">{row.date}</td>
                  <td>
                    <span className={`status-badge ${statusClass[row.status]}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="table-note">Sample data only — does not represent real records.</p>
      </section>

      {/* ── Quick Actions ── */}
      <section aria-labelledby="actions-heading" className="dash-section">
        <h2 id="actions-heading" className="section-label">Quick Actions</h2>
        <div className="actions-row">
          <button type="button" className="action-btn action-primary">
            <UserPlus size={16} aria-hidden="true" />
            Add Customer
          </button>
          <button type="button" className="action-btn action-secondary">
            <FilePlus size={16} aria-hidden="true" />
            Create Policy
          </button>
          <button type="button" className="action-btn action-secondary">
            <CreditCard size={16} aria-hidden="true" />
            Record Payment
          </button>
        </div>
      </section>

    </div>
  )
}
