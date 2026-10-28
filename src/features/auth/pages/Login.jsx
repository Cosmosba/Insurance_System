import { useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { mockLogin, getRoleHome, getSession } from '../../../services/mockAuth'
import '../styles/Login.css'

const TYPEWRITER_TEXT = 'Sign into your account to continue'

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Login() {
  const navigate = useNavigate()
  const [displayed, setDisplayed] = useState(reducedMotion ? TYPEWRITER_TEXT : '')
  const [typingDone, setTypingDone] = useState(reducedMotion)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [needsNameCompletion, setNeedsNameCompletion] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If already signed in, redirect immediately
  useEffect(() => {
    const session = getSession()
    if (session) {
      const dest = session.mustChangePassword ? '/change-password' : getRoleHome(session.role)
      navigate(dest, { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    if (reducedMotion) return
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(TYPEWRITER_TEXT.slice(0, i))
      if (i === TYPEWRITER_TEXT.length) {
        clearInterval(interval)
        setTypingDone(true)
      }
    }, 45)
    return () => clearInterval(interval)
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    setError('')
    setLoading(true)

    // Simulate a brief async delay for realistic feedback
    setTimeout(async () => {
      let result
      try {
        result = await mockLogin(email, password, needsNameCompletion ? { firstName, lastName } : {})
      } catch {
        result = { ok: false, message: 'Unable to sign in right now. Please try again.' }
      }
      setLoading(false)
      if (!result.ok) {
        if (result.needsNameCompletion) {
          setNeedsNameCompletion(true)
          setFirstName(result.firstName)
          setLastName(result.lastName)
          setError(result.message
            || 'Complete the missing name fields and enter the current password to verify the account. The changes are saved only after sign-in is verified.')
        } else {
          setError(result.message)
        }
        return
      }
      setNeedsNameCompletion(false)
      const dest = result.session.mustChangePassword
        ? '/change-password'
        : getRoleHome(result.session.role)
      navigate(dest, { replace: true })
    }, 600)
  }

  return (
    <div className="login-page">
      <div className="login-bg" aria-hidden="true" />

      <div className="login-inner">
        {/* Card */}
        <div className="login-card" role="main">
          {/* Favicon + Brand */}
          <div className="login-card-brand">
            <img src="/favicon.png" alt="Emple Life Insurance" className="login-favicon" />
            <span className="login-brand-name">Emple Life Insurance</span>
          </div>

          {/* Typewriter */}
          <p className="login-typewriter" aria-label={TYPEWRITER_TEXT}>
            {displayed}
            {!typingDone && <span className="login-cursor" aria-hidden="true" />}
          </p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {error && (
              <p className="login-error" role="alert">{error}</p>
            )}

            {/* Email */}
            <div className="form-group">
              <label htmlFor="login-email" className="form-label">Email Address</label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="Enter your email address"
                value={email}
                onChange={e => {
                  setEmail(e.target.value)
                  setNeedsNameCompletion(false)
                  setFirstName('')
                  setLastName('')
                }}
                autoComplete="email"
                disabled={loading}
              />
            </div>

            {needsNameCompletion && (
              <>
                <div className="form-group">
                  <label htmlFor="login-first-name" className="form-label">First Name</label>
                  <input
                    id="login-first-name"
                    type="text"
                    className="form-input"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    disabled={loading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="login-last-name" className="form-label">Surname</label>
                  <input
                    id="login-last-name"
                    type="text"
                    className="form-input"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    autoComplete="family-name"
                    disabled={loading}
                  />
                </div>
              </>
            )}

            {/* Password */}
            <div className="form-group">
              <label htmlFor="login-password" className="form-label">Password</label>
              <div className="input-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me + Forgot password */}
            <div className="login-row">
              <label className="remember-label">
                <input
                  type="checkbox"
                  className="remember-checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  disabled={loading}
                />
                Remember me
              </label>
              <button type="button" className="forgot-link" disabled={loading}>
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Signing in…' : needsNameCompletion ? 'Verify and continue' : 'Sign In'}
            </button>
          </form>

          {/* Registration prompt */}
          <p className="login-register">
            Don&apos;t have an account?{' '}
            <button type="button" className="register-link">Create one</button>
          </p>
        </div>
      </div>
    </div>
  )
}
