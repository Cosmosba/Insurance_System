import { useEffect, useState } from 'react'
import { Eye, EyeOff, KeyRound, LockKeyhole } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { changeFirstLoginPassword, clearSession, getRoleHome, getSession } from '../../../services/mockAuth'
import '../styles/ChangePassword.css'

const PASSWORD_FIELDS = [
  { key: 'currentPassword', label: 'Current password', autocomplete: 'current-password' },
  { key: 'newPassword', label: 'New password', autocomplete: 'new-password' },
  { key: 'confirmation', label: 'Confirm new password', autocomplete: 'new-password' },
]

export default function ChangePassword() {
  const navigate = useNavigate()
  const [session] = useState(getSession)
  const [values, setValues] = useState({
    currentPassword: '',
    newPassword: '',
    confirmation: '',
  })
  const [visibility, setVisibility] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!success) return undefined
    const timeout = window.setTimeout(() => navigate(getRoleHome(session.role), { replace: true }), 900)
    return () => window.clearTimeout(timeout)
  }, [navigate, session, success])

  if (!session) return <Navigate to="/login" replace />
  if (session.role === 'superadmin' || !session.mustChangePassword) {
    return <Navigate to={getRoleHome(session.role)} replace />
  }

  function updateField(field, value) {
    setValues(current => ({ ...current, [field]: value }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await changeFirstLoginPassword(
        values.currentPassword,
        values.newPassword,
        values.confirmation,
      )
      setValues({ currentPassword: '', newPassword: '', confirmation: '' })
      setSuccess(true)
    } catch (changeError) {
      setError(changeError.message || 'Unable to change your password. Try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleSignOut() {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <main className="password-page">
      <section className="password-card" aria-labelledby="password-heading">
        <div className="password-brand">
          <img src="/background.jpg" alt="emPLE Life Insurance" />
        </div>
        <span className="password-icon"><KeyRound size={20} aria-hidden="true" /></span>
        <h1 id="password-heading">Set a new password</h1>
        <p className="password-intro">For security, please change your default password before continuing.</p>

        {success ? (
          <div className="password-success" role="status">
            <strong>Password changed successfully.</strong>
            <span>Taking you to your account…</span>
          </div>
        ) : (
          <form className="password-form" onSubmit={handleSubmit} noValidate>
            {error && <p className="password-error" role="alert">{error}</p>}
            {PASSWORD_FIELDS.map(field => (
              <label className="password-field" key={field.key}>
                <span>{field.label}</span>
                <span className="password-input-wrap">
                  <LockKeyhole className="password-lock-icon" size={17} aria-hidden="true" />
                  <input
                    type={visibility[field.key] ? 'text' : 'password'}
                    value={values[field.key]}
                    onChange={event => updateField(field.key, event.target.value)}
                    autoComplete={field.autocomplete}
                    required
                    disabled={saving}
                  />
                  <button
                    type="button"
                    onClick={() => setVisibility(current => ({
                      ...current,
                      [field.key]: !current[field.key],
                    }))}
                    aria-label={visibility[field.key] ? `Hide ${field.label.toLocaleLowerCase()}` : `Show ${field.label.toLocaleLowerCase()}`}
                    disabled={saving}
                  >
                    {visibility[field.key]
                      ? <EyeOff size={16} aria-hidden="true" />
                      : <Eye size={16} aria-hidden="true" />}
                  </button>
                </span>
              </label>
            ))}
            <p className="password-hint">
              Use at least 10 characters and include three of: lowercase, uppercase, number, or symbol.
            </p>
            <button className="password-submit" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Update password'}
            </button>
            <button className="password-signout" type="button" onClick={handleSignOut} disabled={saving}>
              Sign out
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
