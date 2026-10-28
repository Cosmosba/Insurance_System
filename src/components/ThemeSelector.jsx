import { useState } from 'react'
import { Check, Moon, Sun } from 'lucide-react'
import { useTheme } from './ThemeContext'
import './ThemeSelector.css'

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  function selectTheme(nextTheme) {
    setError('')
    setFeedback('')
    try {
      setTheme(nextTheme)
      setFeedback(`${nextTheme === 'day' ? 'Day' : 'Night'} Mode saved for this account in this browser.`)
    } catch (selectionError) {
      setError(selectionError.message || 'Your appearance preference could not be saved.')
    }
  }

  return (
    <>
      <div className="theme-selector-options" role="group" aria-label="Choose appearance">
        <button
          type="button"
          className={`theme-selector-card theme-selector-card--day${theme === 'day' ? ' theme-selector-card--selected' : ''}`}
          onClick={() => selectTheme('day')}
          aria-pressed={theme === 'day'}
        >
          <span className="theme-selector-preview theme-selector-preview--day" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span className="theme-selector-copy">
            <strong><Sun size={17} aria-hidden="true" /> Day Mode</strong>
            <small>Light surfaces and the familiar emPLE green.</small>
          </span>
          {theme === 'day' && <Check className="theme-selector-check" size={18} aria-label="Selected" />}
        </button>
        <button
          type="button"
          className={`theme-selector-card theme-selector-card--night${theme === 'night' ? ' theme-selector-card--selected' : ''}`}
          onClick={() => selectTheme('night')}
          aria-pressed={theme === 'night'}
        >
          <span className="theme-selector-preview theme-selector-preview--night" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span className="theme-selector-copy">
            <strong><Moon size={17} aria-hidden="true" /> Night Mode</strong>
            <small>Dark, low-glare surfaces with readable contrast.</small>
          </span>
          {theme === 'night' && <Check className="theme-selector-check" size={18} aria-label="Selected" />}
        </button>
      </div>
      {error && <p className="settings-message settings-message--error" role="alert">{error}</p>}
      {feedback && <p className="settings-message settings-message--success" role="status">{feedback}</p>}
    </>
  )
}
