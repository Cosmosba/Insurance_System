import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell, CalendarDays, Clock3, Sun, UserRound, ArrowUpRight, Check,
} from 'lucide-react'
import ThemeSelector from '../../../components/ThemeSelector'
import useCustomerPreferences from '../hooks/useCustomerPreferences'
import { getProfile, getSession } from '../../../services/mockAuth'
import { saveCustomerPreferences } from '../services/customerPreferences'
import '../styles/CustomerSettings.css'

const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

export default function CustomerSettings() {
  const { preferences, error: preferencesError } = useCustomerPreferences()
  return (
    <CustomerSettingsContent
      preferences={preferences}
      preferencesError={preferencesError}
    />
  )
}

function CustomerSettingsContent({ preferences, preferencesError }) {
  const [draft, setDraft] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [saving, setSaving] = useState(false)
  const session = getSession()
  const profile = getProfile()
  const form = draft ?? preferences

  const hasChanges = (
    form.dateFormat !== preferences.dateFormat
    || form.timeFormat !== preferences.timeFormat
  )

  function updateField(event) {
    const { name, value } = event.target
    setDraft(current => ({ ...(current ?? preferences), [name]: value }))
    setFeedback(null)
  }

  function cancelChanges() {
    setDraft(null)
    setFeedback(null)
  }

  function savePreferences(event) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)
    try {
      saveCustomerPreferences(form, session?.email)
      setDraft(null)
      setFeedback({ type: 'success', text: 'Regional preferences saved for your account in this browser.' })
    } catch (saveError) {
      setFeedback({
        type: 'error',
        text: saveError.message || 'Regional preferences could not be saved.',
      })
    } finally {
      setSaving(false)
    }
  }

  const fullName = profile
    ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
    : session?.name ?? ''

  return (
    <div className="customer-settings-page">
      <header className="customer-settings-header">
        <span className="customer-settings-eyebrow">MY ACCOUNT</span>
        <h1>Settings</h1>
        <p>Personalize your appearance and regional display preferences.</p>
      </header>

      <section className="customer-settings-section" aria-labelledby="customer-settings-appearance">
        <div className="customer-settings-section-heading">
          <span className="customer-settings-icon">
            <Sun size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id="customer-settings-appearance">Appearance</h2>
            <p>Choose Day Mode or Night Mode for your customer account.</p>
          </div>
        </div>
        <ThemeSelector />
        <p className="customer-settings-note">
          Your choice is saved for your signed-in account in this browser and does not change other users’ appearance.
        </p>
      </section>

      <section className="customer-settings-section" aria-labelledby="customer-settings-regional">
        <div className="customer-settings-section-heading">
          <span className="customer-settings-icon">
            <CalendarDays size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id="customer-settings-regional">Regional Preferences</h2>
            <p>Choose how dates and times are displayed in your customer portal.</p>
          </div>
        </div>
        {preferencesError && (
          <p className="customer-settings-message customer-settings-message--error" role="alert">
            {preferencesError}
          </p>
        )}
        <form className="customer-settings-form" onSubmit={savePreferences}>
          <label className="customer-settings-field" htmlFor="customer-date-format">
            <span><CalendarDays size={15} aria-hidden="true" /> Date format</span>
            <select
              id="customer-date-format"
              name="dateFormat"
              value={form.dateFormat}
              onChange={updateField}
            >
              {DATE_FORMATS.map(format => <option key={format} value={format}>{format}</option>)}
            </select>
          </label>
          <label className="customer-settings-field" htmlFor="customer-time-format">
            <span><Clock3 size={15} aria-hidden="true" /> Time format</span>
            <select
              id="customer-time-format"
              name="timeFormat"
              value={form.timeFormat}
              onChange={updateField}
            >
              <option value="12-hour">12-hour clock</option>
              <option value="24-hour">24-hour clock</option>
            </select>
          </label>
          <div className="customer-settings-form-actions">
            <button type="submit" className="customer-settings-button customer-settings-button--primary" disabled={!hasChanges || saving}>
              <Check size={15} aria-hidden="true" />
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
            <button type="button" className="customer-settings-button customer-settings-button--secondary" onClick={cancelChanges} disabled={!hasChanges || saving}>
              Cancel
            </button>
          </div>
        </form>
        {feedback && (
          <p
            className={`customer-settings-message customer-settings-message--${feedback.type}`}
            role={feedback.type === 'error' ? 'alert' : 'status'}
          >
            {feedback.text}
          </p>
        )}
        <p className="customer-settings-note">
          Date and time formats are applied to the customer dashboard, profile, policies, payments, and claims. Your settings are stored in this browser and do not change the organization time zone.
        </p>
      </section>

      <section className="customer-settings-section" aria-labelledby="customer-settings-notifications">
        <div className="customer-settings-section-heading">
          <span className="customer-settings-icon">
            <Bell size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id="customer-settings-notifications">Notification Preferences</h2>
            <p>Manage how account updates reach you.</p>
          </div>
        </div>
        <div className="customer-settings-info" role="status">
          <strong>Notification preferences are not available yet.</strong>
          <p>
            This portal does not currently have a configurable in-app notification service or connected email, SMS, or push delivery. No notification controls are offered until a supported service is available.
          </p>
        </div>
      </section>

      <section className="customer-settings-section" aria-labelledby="customer-settings-account">
        <div className="customer-settings-section-heading">
          <span className="customer-settings-icon">
            <UserRound size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id="customer-settings-account">Account Preferences</h2>
            <p>Review your sign-in details and access your profile.</p>
          </div>
        </div>
        <dl className="customer-settings-account-details">
          <div>
            <dt>Name</dt>
            <dd>{fullName || 'Not available'}</dd>
          </div>
          <div>
            <dt>Email address</dt>
            <dd>{session?.email ?? 'Not available'}</dd>
          </div>
        </dl>
        <div className="customer-settings-account-actions">
          <Link className="customer-settings-button customer-settings-button--primary" to="/customer/profile">
            <UserRound size={15} aria-hidden="true" />
            Manage My Profile
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <p className="customer-settings-note">
          Account details shown here come from your signed-in profile. To update editable personal information, use Manage My Profile.
        </p>
      </section>
    </div>
  )
}
