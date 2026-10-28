import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileSearch, AlertTriangle, FileText, CheckCircle2, Circle } from 'lucide-react'
import { getSession } from '../services/mockAuth'
import { getCustomerWorkspaceData, formatGHS } from '../services/customerData'
import useCustomerPreferences from '../hooks/useCustomerPreferences'
import { formatCustomerDate } from '../services/customerPreferences'
import './MyClaims.css'

const statusBadge = {
  'Under Review': 'cl2-badge--info',
  'Pending':      'cl2-badge--warning',
  'Approved':     'cl2-badge--success',
  'Rejected':     'cl2-badge--danger',
  'Completed':    'cl2-badge--neutral',
  'Settled':      'cl2-badge--neutral',
}

function DetailRow({ label, value }) {
  return (
    <div className="cd3-row">
      <span className="cd3-row-label">{label}</span>
      <span className="cd3-row-value">{value}</span>
    </div>
  )
}

export default function ClaimDetail() {
  const { ref }  = useParams()
  const navigate = useNavigate()
  const { preferences } = useCustomerPreferences()
  const { claims, policies } = getCustomerWorkspaceData(getSession()?.email)
  const claim    = claims.find(c => c.ref === ref)

  if (!claim) {
    return (
      <div className="cl2-page">
        <div className="cl2-empty">
          <AlertTriangle size={30} className="cl2-empty-icon" aria-hidden="true" />
          <p className="cl2-empty-msg">Claim record <strong>{ref}</strong> was not found.</p>
          <button type="button" className="cl2-empty-reset" onClick={() => navigate('/customer/claims')}>
            Back to My Claims
          </button>
        </div>
      </div>
    )
  }

  const policy = policies.find(p => p.id === claim.policyId)

  return (
    <div className="cl2-page">

      {/* ── Back + heading ── */}
      <header className="cd3-header">
        <button
          type="button"
          className="cd3-back-btn"
          onClick={() => navigate('/customer/claims')}
          aria-label="Back to My Claims"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          My Claims
        </button>
        <div className="cd3-title-row">
          <div className="cd3-title-icon" aria-hidden="true">
            <FileSearch size={22} />
          </div>
          <div>
            <h1 className="cd3-title">{claim.type}</h1>
            <p className="cd3-ref">{claim.ref}</p>
          </div>
          <span className={`cl2-badge ${statusBadge[claim.status] ?? ''} cd3-status-badge`}>
            {claim.status}
          </span>
        </div>
      </header>

      {/* ── Progress timeline ── */}
      <section aria-labelledby="cd3-progress-heading" className="cl2-section">
        <h2 id="cd3-progress-heading" className="cl2-section-label">Claim Progress</h2>
        <div className="cd3-timeline-card">
          <ol className="cd3-timeline" aria-label="Claim status stages">
            {claim.statusHistory.map((step, i) => (
              <li
                key={step.stage}
                className={`cd3-step${step.done ? ' cd3-step--done' : ''}${
                  i === claim.statusHistory.findIndex(s => !s.done) - 1 ||
                  (step.done && i === claim.statusHistory.filter(s => s.done).length - 1)
                    ? ' cd3-step--current'
                    : ''
                }`}
              >
                <div className="cd3-step-icon" aria-hidden="true">
                  {step.done
                    ? <CheckCircle2 size={18} />
                    : <Circle size={18} />}
                </div>
                <div className="cd3-step-body">
                  <span className="cd3-step-label">{step.stage}</span>
                  {step.date && <span className="cd3-step-date">{formatCustomerDate(step.date, preferences)}</span>}
                </div>
                {i < claim.statusHistory.length - 1 && (
                  <div className={`cd3-connector${step.done ? ' cd3-connector--done' : ''}`} aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Claim details ── */}
      <section aria-labelledby="cd3-details-heading" className="cl2-section">
        <h2 id="cd3-details-heading" className="cl2-section-label">Claim Details</h2>
        <div className="cd3-card">
          <div className="cd3-grid">
            <DetailRow label="Claim Reference" value={claim.ref} />
            <DetailRow label="Status"          value={
              <span className={`cl2-badge ${statusBadge[claim.status] ?? ''}`}>{claim.status}</span>
            } />
            <DetailRow label="Claim Type"      value={claim.type} />
            <DetailRow label="Policy"          value={claim.policyName} />
            <DetailRow label="Policy Number"   value={claim.policyId} />
            <DetailRow label="Claim Amount"    value={claim.amount != null ? formatGHS(claim.amount) : '—'} />
            <DetailRow label="Date Reported"   value={formatCustomerDate(claim.submitted, preferences)} />
            <DetailRow label="Last Updated"    value={claim.lastUpdated ? formatCustomerDate(claim.lastUpdated, preferences) : '—'} />
          </div>
          {claim.description && (
            <div className="cd3-description">
              <p className="cd3-description-text">{claim.description}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Related policy ── */}
      {policy && (
        <section aria-labelledby="cd3-policy-heading" className="cl2-section">
          <h2 id="cd3-policy-heading" className="cl2-section-label">Related Policy</h2>
          <div className="cd3-policy-card">
            <div className="cd3-policy-icon" aria-hidden="true">
              <FileText size={18} />
            </div>
            <div className="cd3-policy-info">
              <span className="cd3-policy-name">{policy.product}</span>
              <span className="cd3-policy-meta">{policy.id} · {policy.category} · {policy.status}</span>
            </div>
            <button
              type="button"
              className="cl2-view-btn"
              onClick={() => navigate(`/customer/policies/${policy.id}`)}
              aria-label={`View policy ${policy.id}`}
            >
              View Policy
            </button>
          </div>
        </section>
      )}

    </div>
  )
}
