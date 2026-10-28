import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard, AlertTriangle, FileText } from 'lucide-react'
import { getSession } from '../services/mockAuth'
import { getCustomerWorkspaceData, formatGHS } from '../services/customerData'
import useCustomerPreferences from '../hooks/useCustomerPreferences'
import { formatCustomerDate } from '../services/customerPreferences'
import './Payments.css'

const statusBadge = {
  'Paid':     'py-badge--success',
  'Due Soon': 'py-badge--warning',
  'Upcoming': 'py-badge--info',
  'Overdue':  'py-badge--danger',
  'Failed':   'py-badge--danger',
}

function DetailRow({ label, value }) {
  return (
    <div className="pd2-row">
      <span className="pd2-row-label">{label}</span>
      <span className="pd2-row-value">{value}</span>
    </div>
  )
}

export default function PaymentDetail() {
  const { ref }  = useParams()
  const navigate = useNavigate()
  const { preferences } = useCustomerPreferences()
  const { payments, policies } = getCustomerWorkspaceData(getSession()?.email)
  const payment  = payments.find(p => p.ref === ref)

  if (!payment) {
    return (
      <div className="py-page">
        <div className="py-empty">
          <AlertTriangle size={30} className="py-empty-icon" aria-hidden="true" />
          <p className="py-empty-msg">Payment record <strong>{ref}</strong> was not found.</p>
          <button type="button" className="py-empty-reset" onClick={() => navigate('/customer/payments')}>
            Back to Payments
          </button>
        </div>
      </div>
    )
  }

  const policy = policies.find(p => p.id === payment.policyId)
  const isPending = payment.status !== 'Paid'

  return (
    <div className="py-page">

      {/* ── Back + heading ── */}
      <header className="pd2-header">
        <button
          type="button"
          className="pd2-back-btn"
          onClick={() => navigate('/customer/payments')}
          aria-label="Back to Payments"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Payments
        </button>
        <div className="pd2-title-row">
          <div className="pd2-title-icon" aria-hidden="true">
            <CreditCard size={22} />
          </div>
          <div>
            <h1 className="pd2-title">Payment Record</h1>
            <p className="pd2-ref">{payment.ref}</p>
          </div>
          <span className={`py-badge ${statusBadge[payment.status] ?? ''} pd2-status-badge`}>
            {payment.status}
          </span>
        </div>
      </header>

      {/* ── Payment details card ── */}
      <section aria-labelledby="pd2-details-heading" className="py-section">
        <h2 id="pd2-details-heading" className="py-section-label">Payment Details</h2>
        <div className="pd2-card">
          <div className="pd2-grid">
            <DetailRow label="Payment Reference" value={payment.ref} />
            <DetailRow label="Status"            value={
              <span className={`py-badge ${statusBadge[payment.status] ?? ''}`}>{payment.status}</span>
            } />
            <DetailRow label="Policy"            value={payment.policyName} />
            <DetailRow label="Policy Number"     value={payment.policyId} />
            <DetailRow label="Coverage Period"   value={payment.period} />
            <DetailRow label="Amount"            value={formatGHS(payment.amount)} />
            <DetailRow label="Due Date"          value={formatCustomerDate(payment.dueDate, preferences)} />
            <DetailRow label="Date Paid"         value={payment.paidDate ? formatCustomerDate(payment.paidDate, preferences) : '—'} />
            <DetailRow label="Payment Method"    value={payment.method ?? '—'} />
            <DetailRow label="Policyholder"      value={policy?.policyholder ?? '—'} />
          </div>
        </div>
      </section>

      {/* ── Related policy ── */}
      {policy && (
        <section aria-labelledby="pd2-policy-heading" className="py-section">
          <h2 id="pd2-policy-heading" className="py-section-label">Related Policy</h2>
          <div className="pd2-policy-card">
            <div className="pd2-policy-icon" aria-hidden="true">
              <FileText size={18} />
            </div>
            <div className="pd2-policy-info">
              <span className="pd2-policy-name">{policy.product}</span>
              <span className="pd2-policy-meta">{policy.id} · {policy.category} · {policy.status}</span>
            </div>
            <button
              type="button"
              className="py-view-btn"
              onClick={() => navigate(`/customer/policies/${policy.id}`)}
              aria-label={`View policy ${policy.id}`}
            >
              View Policy
            </button>
          </div>
        </section>
      )}

      {/* ── Pay now (unavailable state) ── */}
      {isPending && (
        <section aria-labelledby="pd2-action-heading" className="py-section">
          <h2 id="pd2-action-heading" className="py-section-label">Payment Action</h2>
          <div className="pd2-action-card">
            <div className="pd2-action-body">
              <p className="pd2-action-title">Online payment is not yet available.</p>
              <p className="pd2-action-desc">
                To make a payment for this obligation, please contact your emPLE representative
                or visit a branch. Quote reference <strong>{payment.ref}</strong> when making your payment.
              </p>
            </div>
            <button type="button" className="pd2-action-btn" disabled aria-disabled="true">
              Pay {formatGHS(payment.amount)}
            </button>
          </div>
        </section>
      )}

    </div>
  )
}
