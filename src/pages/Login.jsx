import { useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { mockLogin, getSession } from '../services/mockAuth'
import './Login.css'

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
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If already signed in, redirect immediately
  useEffect(() => {
    const session = getSession()
    if (session) {
      const dest = session.role === 'superadmin' ? '/admin/dashboard'
        : session.role === 'staff' ? '/staff/dashboard'
        : '/customer/dashboard'
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
    setTimeout(() => {
      const result = mockLogin(email, password)
      setLoading(false)
      if (!result.ok) {
        setError(result.message)
        return
      }
      const dest = result.session.role === 'superadmin' ? '/admin/dashboard'
        : result.session.role === 'staff' ? '/staff/dashboard'
        : '/customer/dashboard'
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
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
              />
            </div>

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
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Dev hint */}
          <div className="login-dev-hint" aria-label="Development demo credentials">
            <strong>Demo accounts</strong>
            <span>customer@emple.test · staff@emple.test</span>
            <span>Password: demo1234</span>
          </div>

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
