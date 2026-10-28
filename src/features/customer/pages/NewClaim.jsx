import { useNavigate } from 'react-router-dom'
import { ArrowLeft, PhoneCall } from 'lucide-react'
import '../styles/MyClaims.css'

export default function NewClaim() {
  const navigate = useNavigate()

  return (
    <div className="nc-page">

      <header className="nc-header">
        <button
          type="button"
          className="nc-back-btn"
          onClick={() => navigate('/customer/claims')}
          aria-label="Back to My Claims"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          My Claims
        </button>
        <div>
          <h1 className="nc-title">Submit a New Claim</h1>
          <p className="nc-subtitle">Start the claims process for a covered event on one of your active policies.</p>
        </div>
      </header>

      <section aria-labelledby="nc-unavailable-heading">
        <div className="nc-unavailable-card">
          <div className="nc-unavailable-icon" aria-hidden="true">
            <PhoneCall size={22} />
          </div>
          <div>
            <h2 id="nc-unavailable-heading" className="nc-unavailable-title">
              Online claim submission is not yet available.
            </h2>
            <p className="nc-unavailable-desc">
              To submit a new claim, please contact your emPLE Life Insurance representative
              directly or visit your nearest branch. Have your policy number ready when you call.
            </p>
          </div>
          <button type="button" className="nc-unavailable-btn" disabled aria-disabled="true">
            Submit Claim Online
          </button>
        </div>
      </section>

    </div>
  )
}
