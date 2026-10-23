import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Download, AlertTriangle } from 'lucide-react'
import { policies, payments, claims, formatGHS } from '../services/customerData'
import './MyPolicies.css'

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

const paymentStatusBadge = {
  'Due Soon': 'mp-badge--warning',
  'Upcoming': 'mp-badge--info',
  'Paid':     'mp-badge--success',
}

const claimStatusBadge = {
  'Under Review': 'mp-badge--info',
  'Approved':     'mp-badge--success',
  'Completed':    'mp-badge--neutral',
  'Pending':      'mp-badge--warning',
}

function DetailRow({ label, value }) {
  return (
    <div className="pd-row">
      <span className="pd-row-label">{label}</span>
      <span className="pd-row-value">{value}</span>
    </div>
  )
}

export default function PolicyDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const policy   = policies.find(p => p.id === id)

  if (!policy) {
    return (
      <div className="mp-page">
        <div className="mp-empty">
          <AlertTriangle size={30} className="mp-empty-icon" aria-hidden="true" />
          <p className="mp-empty-msg">Policy <strong>{id}</strong> was not found.</p>
          <button type="button" className="mp-empty-reset" onClick={() => navigate('/customer/policies')}>
            Back to My Policies
          </button>
        </div>
      </div>
    )
  }

  const relatedPayments = payments.filter(p => p.policyId === policy.id)
  const relatedClaims   = claims.filter(c => c.policyId === policy.id)

  return (
    <div className="mp-page">

      {/* ── Back + heading ── */}
      <header className="pd-header">
        <button
          type="button"
          className="pd-back-btn"
          onClick={() => navigate('/customer/policies')}
          aria-label="Back to My Policies"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          My Policies
        </button>
        <div className="pd-title-row">
          <div className="pd-title-icon" aria-hidden="true">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="pd-title">{policy.product}</h1>
            <p className="pd-policy-id">{policy.id}</p>
          </div>
          <span className={`mp-badge ${policyStatusBadge[policy.status] ?? ''} pd-status-badge`}>
            {policy.status}
          </span>
        </div>
      </header>

      {/* ── Policy details card ── */}
      <section aria-labelledby="pd-details-heading" className="mp-section">
        <h2 id="pd-details-heading" className="mp-section-label">Policy Details</h2>
        <div className="pd-card">
          <div className="pd-grid">
            <DetailRow label="Policy Number"    value={policy.id} />
            <DetailRow label="Product"          value={policy.product} />
            <DetailRow label="Category"         value={
              <span className={`mp-cat-badge ${categoryBadge[policy.category] ?? ''}`}>
                {policy.category}
              </span>
            } />
            <DetailRow label="Policyholder"     value={policy.policyholder} />
            <DetailRow label="Start Date"       value={policy.startDate} />
            <DetailRow label="Renewal Date"     value={policy.renewalDate} />
            <DetailRow label="Sum Assured"      value={policy.sumAssured} />
            <DetailRow label="Premium"          value={policy.premium} />
            <DetailRow label="Payment Frequency" value={policy.frequency} />
            <DetailRow label="Status"           value={
              <span className={`mp-badge ${policyStatusBadge[policy.status] ?? ''}`}>
                {policy.status}
              </span>
            } />
          </div>

          {policy.description && (
            <div className="pd-description">
              <p className="pd-description-text">{policy.description}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Documents ── */}
      <section aria-labelledby="pd-docs-heading" className="mp-section">
        <h2 id="pd-docs-heading" className="mp-section-label">Policy Documents</h2>
        <div className="pd-docs-card">
          <div className="pd-doc-row">
            <Download size={16} className="pd-doc-icon" aria-hidden="true" />
            <span className="pd-doc-name">Policy Schedule — {policy.id}.pdf</span>
            <span className="pd-doc-unavailable">Document download is not available in this prototype.</span>
          </div>
        </div>
      </section>

      {/* ── Related payments ── */}
      <section aria-labelledby="pd-payments-heading" className="mp-section">
        <h2 id="pd-payments-heading" className="mp-section-label">Payments for this Policy</h2>
        {relatedPayments.length === 0 ? (
          <div className="mp-empty">
            <p className="mp-empty-msg">No payment records found for this policy.</p>
          </div>
        ) : (
          <div className="mp-table-wrap">
            <table className="mp-table">
              <thead>
                <tr>
                  <th scope="col">Payment Ref</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Due Date</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {relatedPayments.map(row => (
                  <tr key={row.ref}>
                    <td className="mp-mono">{row.ref}</td>
                    <td className="mp-amount">{formatGHS(row.amount)}</td>
                    <td className="mp-date-cell">{row.dueDate}</td>
                    <td>
                      <span className={`mp-badge ${paymentStatusBadge[row.status] ?? ''}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Related claims ── */}
      <section aria-labelledby="pd-claims-heading" className="mp-section">
        <h2 id="pd-claims-heading" className="mp-section-label">Claims for this Policy</h2>
        {relatedClaims.length === 0 ? (
          <div className="mp-empty">
            <p className="mp-empty-msg">No claims found for this policy.</p>
          </div>
        ) : (
          <div className="mp-table-wrap">
            <table className="mp-table">
              <thead>
                <tr>
                  <th scope="col">Claim Ref</th>
                  <th scope="col">Type</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {relatedClaims.map(row => (
                  <tr key={row.ref}>
                    <td className="mp-mono">{row.ref}</td>
                    <td>{row.type}</td>
                    <td className="mp-date-cell">{row.submitted}</td>
                    <td>
                      <span className={`mp-badge ${claimStatusBadge[row.status] ?? ''}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mp-note">Sample data only — does not represent real records.</p>
      </section>

    </div>
  )
}
