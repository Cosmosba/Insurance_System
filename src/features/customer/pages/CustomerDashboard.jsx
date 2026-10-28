import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FileText, CheckCircle, CreditCard, AlertCircle,
  Eye, Wallet, FilePlus, User,
  Activity, ShieldCheck, Clock, UserRound, Settings as SettingsIcon,
} from 'lucide-react'
import { getSession } from '../../../services/mockAuth'
import { getCustomerWorkspaceData, getSummary, formatGHS } from '../../../services/customerData'
import { getSystemSettings, subscribeToSystemSettings } from '../../../services/systemSettings'
import useCustomerPreferences from '../hooks/useCustomerPreferences'
import { formatCustomerDate, formatCustomerTime } from '../services/customerPreferences'
import '../styles/CustomerDashboard.css'

// ── Status maps ───────────────────────────────────────────────────────────────

const policyStatusBadge = {
  Active: 'cd-badge--success',
  Lapsed: 'cd-badge--warning',
  Expired:'cd-badge--neutral',
}

const paymentStatusBadge = {
  'Due Soon': 'cd-badge--warning',
  'Upcoming': 'cd-badge--info',
  'Paid':     'cd-badge--success',
}

const claimStatusBadge = {
  'Under Review': 'cd-badge--info',
  'Approved':     'cd-badge--success',
  'Completed':    'cd-badge--neutral',
  'Pending':      'cd-badge--warning',
}

const activityIcon = {
  payment: CreditCard,
  claim:   AlertCircle,
  policy:  FileText,
  profile: User,
}

const categoryBadge = {
  Life:     'cd-cat--life',
  Health:   'cd-cat--health',
  Pensions: 'cd-cat--pensions',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getConfiguredTimeZone() {
  try {
    return { timeZone: getSystemSettings().timeZone, error: '' }
  } catch (error) {
    return {
      timeZone: '',
      error: error.message || 'Configured time zone is unavailable; using your browser time zone.',
    }
  }
}

function CustomerDateTime() {
  const [now, setNow] = useState(() => new Date())
  const [clockPreferences, setClockPreferences] = useState(getConfiguredTimeZone)
  const { preferences } = useCustomerPreferences()

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    const unsubscribe = subscribeToSystemSettings((settings, error) => {
      setClockPreferences(error
        ? { timeZone: '', error: error.message || 'Configured time zone is unavailable; using your browser time zone.' }
        : { timeZone: settings.timeZone, error: '' })
    })
    return () => {
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [])

  return (
    <span
      className="cd-date"
      aria-label="Today's date and time"
      title={clockPreferences.error || `Time zone: ${clockPreferences.timeZone}`}
    >
      {formatCustomerDate(now, preferences, clockPreferences.timeZone)}
      {' · '}
      {formatCustomerTime(now, preferences, clockPreferences.timeZone)}
    </span>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, message, action }) {
  return (
    <div className="cd-empty">
      <Icon size={28} className="cd-empty-icon" aria-hidden="true" />
      <p className="cd-empty-msg">{message}</p>
      {action && <span className="cd-empty-action">{action}</span>}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CustomerDashboard() {
  const session  = getSession()
  const { preferences } = useCustomerPreferences()
  const navigate = useNavigate()
  const { policies, payments, claims, recentActivity } = getCustomerWorkspaceData(session?.email)
  const summary  = getSummary({ policies, payments, claims })

  const summaryCards = [
    { label: 'Total Policies',     value: summary.totalPolicies,    icon: FileText,    accent: '#8DB600' },
    { label: 'Active Policies',    value: summary.activePolicies,   icon: CheckCircle, accent: '#4a90a4' },
    { label: 'Upcoming Payments',  value: summary.upcomingPayments, icon: CreditCard,  accent: '#c0842a' },
    { label: 'Claims in Progress', value: summary.claimsInProgress, icon: AlertCircle, accent: '#7b5ea7' },
  ]

  return (
    <div className="cd-dashboard">

      {/* ── Welcome ── */}
      <header className="cd-header">
        <div className="cd-header-welcome">
          <h1 className="cd-title">
            Welcome back, {session?.name ?? 'Customer'}
          </h1>
          <p className="cd-subtitle">Here is an overview of your insurance account.</p>
        </div>
        <div className="cd-header-tools">
          <CustomerDateTime />
          <div className="cd-header-actions" aria-label="Account shortcuts">
            <Link
              to="/customer/profile"
              className="cd-header-action"
              aria-label="My Profile"
              title="My Profile"
            >
              <UserRound size={19} aria-hidden="true" />
            </Link>
            <Link
              to="/customer/settings"
              className="cd-header-action"
              aria-label="Settings"
              title="Settings"
            >
              <SettingsIcon size={19} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Summary cards ── */}
      <section aria-labelledby="cd-summary-heading">
        <h2 id="cd-summary-heading" className="cd-section-label">Account Overview</h2>
        <p className="cd-sample-note">Sample figures — not real account data.</p>
        <div className="cd-cards-grid">
          {summaryCards.map(({ label, value, icon: Icon, accent }) => (
            <article key={label} className="cd-card" style={{ '--cd-accent': accent }}>
              <div className="cd-card-icon" aria-hidden="true">
                <Icon size={20} />
              </div>
              <div className="cd-card-body">
                <span className="cd-card-value">{value}</span>
                <span className="cd-card-label">{label}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── My Policies ── */}
      <section aria-labelledby="cd-policies-heading" className="cd-section">
        <h2 id="cd-policies-heading" className="cd-section-label">My Policies</h2>
        {policies.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            message="You have no policies on record."
            action="Contact emPLE Life Insurance to get started."
          />
        ) : (
          <div className="cd-table-wrap">
            <table className="cd-table">
              <thead>
                <tr>
                  <th scope="col">Policy No.</th>
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  <th scope="col">Sum Assured</th>
                  <th scope="col">Start Date</th>
                  <th scope="col">Renewal Date</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id}>
                    <td className="cd-mono">{p.id}</td>
                    <td className="cd-policy-name">{p.product}</td>
                    <td>
                      <span className={`cd-cat-badge ${categoryBadge[p.category] ?? ''}`}>
                        {p.category}
                      </span>
                    </td>
                    <td className="cd-amount">{p.sumAssured}</td>
                    <td className="cd-date-cell">{formatCustomerDate(p.startDate, preferences)}</td>
                    <td className="cd-date-cell">{formatCustomerDate(p.renewalDate, preferences)}</td>
                    <td>
                      <span className={`cd-badge ${policyStatusBadge[p.status] ?? ''}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="cd-table-note">Sample data only — does not represent real policy records.</p>
      </section>

      {/* ── Upcoming Payments ── */}
      <section aria-labelledby="cd-payments-heading" className="cd-section">
        <h2 id="cd-payments-heading" className="cd-section-label">Upcoming Payments</h2>
        {payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            message="No upcoming payments found."
            action="Your next premium due date will appear here."
          />
        ) : (
          <div className="cd-table-wrap">
            <table className="cd-table">
              <thead>
                <tr>
                  <th scope="col">Payment Ref</th>
                  <th scope="col">Policy</th>
                  <th scope="col">Amount (GHS)</th>
                  <th scope="col">Due Date</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((row) => (
                  <tr key={row.ref}>
                    <td className="cd-mono">{row.ref}</td>
                    <td>
                      <span className="cd-policy-name">{row.policyName}</span>
                      <span className="cd-sub-ref">{row.policyId}</span>
                    </td>
                    <td className="cd-amount">{formatGHS(row.amount)}</td>
                    <td className="cd-date-cell">{formatCustomerDate(row.dueDate, preferences)}</td>
                    <td>
                      <span className={`cd-badge ${paymentStatusBadge[row.status] ?? ''}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="cd-table-note">Sample data only — does not represent real payment obligations.</p>
      </section>

      {/* ── Recent Claims ── */}
      <section aria-labelledby="cd-claims-heading" className="cd-section">
        <h2 id="cd-claims-heading" className="cd-section-label">Recent Claims</h2>
        {claims.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            message="No claims on record."
            action="Submit a claim when you need to make one."
          />
        ) : (
          <div className="cd-table-wrap">
            <table className="cd-table">
              <thead>
                <tr>
                  <th scope="col">Claim Ref</th>
                  <th scope="col">Claim Type</th>
                  <th scope="col">Policy</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((row) => (
                  <tr key={row.ref}>
                    <td className="cd-mono">{row.ref}</td>
                    <td>{row.type}</td>
                    <td className="cd-mono">{row.policyId}</td>
                    <td className="cd-date-cell">{formatCustomerDate(row.submitted, preferences)}</td>
                    <td>
                      <span className={`cd-badge ${claimStatusBadge[row.status] ?? ''}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="cd-table-note">Sample data only — does not represent real claims records.</p>
      </section>

      {/* ── Recent Activity ── */}
      <section aria-labelledby="cd-activity-heading" className="cd-section">
        <h2 id="cd-activity-heading" className="cd-section-label">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <EmptyState icon={Activity} message="No recent activity to display." />
        ) : (
          <div className="cd-activity-list" role="list">
            {recentActivity.map((item) => {
              const Icon = activityIcon[item.type] ?? Activity
              return (
                <div key={item.id} className="cd-activity-item" role="listitem">
                  <div className={`cd-activity-icon cd-activity-icon--${item.type}`} aria-hidden="true">
                    <Icon size={15} />
                  </div>
                  <div className="cd-activity-body">
                    <span className="cd-activity-event">{item.event}</span>
                    <span className="cd-activity-meta">
                      <span className="cd-mono">{item.ref}</span>
                      <span className="cd-activity-dot" aria-hidden="true">·</span>
                      <Clock size={11} aria-hidden="true" />
                      {formatCustomerDate(item.date, preferences)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <p className="cd-table-note">Sample data only — does not represent real account activity.</p>
      </section>

      {/* ── Quick Actions ── */}
      <section aria-labelledby="cd-actions-heading" className="cd-section">
        <h2 id="cd-actions-heading" className="cd-section-label">Quick Actions</h2>
        <div className="cd-actions-grid">

          <button
            type="button"
            className="cd-action-card"
            onClick={() => navigate('/customer/policies')}
            aria-label="View my policies"
          >
            <div className="cd-action-card-icon cd-action-card-icon--green" aria-hidden="true">
              <Eye size={20} />
            </div>
            <span className="cd-action-card-label">View Policies</span>
          </button>

          <button
            type="button"
            className="cd-action-card"
            onClick={() => navigate('/customer/payments')}
            aria-label="Make a payment"
          >
            <div className="cd-action-card-icon cd-action-card-icon--amber" aria-hidden="true">
              <Wallet size={20} />
            </div>
            <span className="cd-action-card-label">Make Payment</span>
          </button>

          <button
            type="button"
            className="cd-action-card"
            onClick={() => navigate('/customer/claims')}
            aria-label="View my claims"
          >
            <div className="cd-action-card-icon cd-action-card-icon--purple" aria-hidden="true">
              <FilePlus size={20} />
            </div>
            <span className="cd-action-card-label">My Claims</span>
          </button>

          <button
            type="button"
            className="cd-action-card"
            onClick={() => navigate('/customer/profile')}
            aria-label="View my profile"
          >
            <div className="cd-action-card-icon cd-action-card-icon--teal" aria-hidden="true">
              <User size={20} />
            </div>
            <span className="cd-action-card-label">My Profile</span>
          </button>

        </div>
        <p className="cd-table-note">These modules are not yet available — coming in future tasks.</p>
      </section>

    </div>
  )
}
