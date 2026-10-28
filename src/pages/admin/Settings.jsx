import { useCallback, useEffect, useState } from 'react'
import {
  Building2, Check, Download, Info, Moon, Save, ShieldCheck, Sun, Bell,
} from 'lucide-react'
import packageInfo from '../../../package.json'
import { useTheme } from '../../components/ThemeContext'
import { getCustomerDirectory, subscribeToCustomerDirectory } from '../../services/customerDirectoryData'
import { getDepartments, subscribeToDepartments } from '../../services/departmentData'
import {
  exportSystemSettings,
  getDefaultSettings,
  getSystemSettings,
  saveSystemSettings,
  subscribeToSystemSettings,
} from '../../services/systemSettings'
import { getStaffUsers, subscribeToStaffUsers } from '../../services/userData'
import './Settings.css'

const DATE_FORMAT_OPTIONS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

function getSystemCounts() {
  return {
    departments: getDepartments().length,
    customers: getCustomerDirectory().length,
    staff: getStaffUsers().length,
  }
}

function getInitialSettings() {
  try {
    const settings = getSystemSettings()
    return { settings, error: '' }
  } catch (error) {
    return {
      settings: getDefaultSettings(),
      error: error.message || 'Organization settings could not be loaded.',
    }
  }
}

function getInitialCounts() {
  try {
    return { counts: getSystemCounts(), error: '' }
  } catch (error) {
    return { counts: null, error: error.message || 'System information could not be loaded.' }
  }
}

function formatSavedAt(value, settings) {
  if (!value) return 'No saved changes yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Save time unavailable'
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
      timeZone: settings.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date).map(part => [part.type, part.value]))
    const formattedDate = settings.dateFormat === 'MM/DD/YYYY'
      ? `${parts.month}/${parts.day}/${parts.year}`
      : settings.dateFormat === 'YYYY-MM-DD'
        ? `${parts.year}-${parts.month}-${parts.day}`
        : `${parts.day}/${parts.month}/${parts.year}`
    return `${formattedDate} ${parts.hour}:${parts.minute} (${settings.timeZone})`
  } catch {
    return 'Save time unavailable'
  }
}

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const [initialSettings] = useState(getInitialSettings)
  const [settings, setSettings] = useState(initialSettings.settings)
  const [form, setForm] = useState(initialSettings.settings)
  const [settingsError, setSettingsError] = useState(initialSettings.error)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [themeError, setThemeError] = useState('')
  const [themeFeedback, setThemeFeedback] = useState('')
  const [exportError, setExportError] = useState('')
  const [initialCounts] = useState(getInitialCounts)
  const [counts, setCounts] = useState(initialCounts.counts)
  const [systemInfoError, setSystemInfoError] = useState(initialCounts.error)

  const refreshSettings = useCallback((nextSettings, error) => {
    if (error) {
      setSettingsError(error.message || 'Organization settings could not be loaded.')
      return
    }
    setSettings(nextSettings)
    setForm(nextSettings)
    setSettingsError('')
  }, [])

  const refreshCounts = useCallback(() => {
    try {
      setCounts(getSystemCounts())
      setSystemInfoError('')
    } catch (error) {
      setSystemInfoError(error.message || 'System information could not be loaded.')
    }
  }, [])

  useEffect(() => {
    const unsubscribeSettings = subscribeToSystemSettings(refreshSettings)
    const unsubscribeDepartments = subscribeToDepartments(refreshCounts)
    const unsubscribeCustomers = subscribeToCustomerDirectory(refreshCounts)
    const unsubscribeStaff = subscribeToStaffUsers(refreshCounts)
    return () => {
      unsubscribeSettings()
      unsubscribeDepartments()
      unsubscribeCustomers()
      unsubscribeStaff()
    }
  }, [refreshCounts, refreshSettings])

  function updateField(event) {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
    setFeedback(null)
  }

  function cancelChanges() {
    setForm(settings)
    setFeedback(null)
  }

  function saveSettings(event) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)
    try {
      const saved = saveSystemSettings(form)
      setSettings(saved)
      setForm(saved)
      setSettingsError('')
      setFeedback({ type: 'success', text: 'Organization settings saved in this browser.' })
    } catch (error) {
      if (error.details?.saved) {
        try {
          const saved = getSystemSettings()
          setSettings(saved)
          setForm(saved)
        } catch (loadError) {
          setSettingsError(loadError.message)
        }
        setFeedback({ type: 'warning', text: error.message })
      } else {
        setFeedback({ type: 'error', text: error.message || 'Organization settings could not be saved.' })
      }
    } finally {
      setSaving(false)
    }
  }

  function selectTheme(nextTheme) {
    setThemeError('')
    setThemeFeedback('')
    try {
      setTheme(nextTheme)
      setThemeFeedback(`${nextTheme === 'day' ? 'Day' : 'Night'} Mode saved for this account in this browser.`)
    } catch (error) {
      setThemeError(error.message || 'Your appearance preference could not be saved.')
    }
  }

  function exportSettings() {
    setExportError('')
    try {
      const file = new Blob([exportSystemSettings(settings)], { type: 'application/json' })
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = 'emple-organization-settings.json'
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setExportError(error.message || 'Settings could not be exported.')
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div>
          <span className="settings-eyebrow">ADMINISTRATION</span>
          <h1>Settings</h1>
          <p>Manage organization preferences and your personal appearance.</p>
        </div>
        <div className="settings-save-time">
          <Check size={16} aria-hidden="true" />
          <span>Last saved: {formatSavedAt(settings.updatedAt, settings)}</span>
        </div>
      </header>

      <section className="settings-section" aria-labelledby="settings-general-heading">
        <div className="settings-section-heading">
          <span className="settings-section-icon"><Building2 size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="settings-general-heading">General settings</h2>
            <p>Organization details and regional display preferences.</p>
          </div>
        </div>
        {settingsError && <p className="settings-message settings-message--error" role="alert">{settingsError}</p>}
        <form className="settings-form" onSubmit={saveSettings}>
          <label className="settings-field">
            <span>Organization display name</span>
            <input
              name="organizationName"
              value={form.organizationName}
              onChange={updateField}
              maxLength={100}
              required
            />
          </label>
          <label className="settings-field">
            <span>Contact email <small>Optional</small></span>
            <input
              name="contactEmail"
              type="email"
              value={form.contactEmail}
              onChange={updateField}
              autoComplete="email"
            />
          </label>
          <label className="settings-field">
            <span>Contact phone <small>Optional</small></span>
            <input
              name="contactPhone"
              type="tel"
              value={form.contactPhone}
              onChange={updateField}
              autoComplete="tel"
            />
          </label>
          <label className="settings-field">
            <span>Time zone</span>
            <input
              name="timeZone"
              value={form.timeZone}
              onChange={updateField}
              list="settings-time-zones"
              placeholder="e.g. Europe/London"
              required
            />
            <datalist id="settings-time-zones">
              <option value="UTC" />
              <option value="Europe/London" />
              <option value="Africa/Lagos" />
              <option value="America/New_York" />
            </datalist>
          </label>
          <label className="settings-field">
            <span>Date format</span>
            <select name="dateFormat" value={form.dateFormat} onChange={updateField}>
              {DATE_FORMAT_OPTIONS.map(format => <option key={format} value={format}>{format}</option>)}
            </select>
          </label>
          <div className="settings-form-actions">
            <div aria-live="polite">
              {feedback && (
                <p
                  className={`settings-message settings-message--${feedback.type}`}
                  role={feedback.type === 'error' ? 'alert' : 'status'}
                >
                  {feedback.text}
                </p>
              )}
            </div>
            <button type="button" className="settings-button settings-button--secondary" onClick={cancelChanges}>
              Cancel
            </button>
            <button type="submit" className="settings-button settings-button--primary" disabled={saving}>
              <Save size={16} aria-hidden="true" />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      <section className="settings-section" aria-labelledby="settings-appearance-heading">
        <div className="settings-section-heading">
          <span className="settings-section-icon"><Sun size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="settings-appearance-heading">Appearance</h2>
            <p>This preference belongs to your signed-in account on this browser.</p>
          </div>
        </div>
        <div className="settings-theme-options" role="group" aria-label="Choose appearance">
          <button
            type="button"
            className={`settings-theme-card settings-theme-card--day${theme === 'day' ? ' settings-theme-card--selected' : ''}`}
            onClick={() => selectTheme('day')}
            aria-pressed={theme === 'day'}
          >
            <span className="settings-theme-preview settings-theme-preview--day" aria-hidden="true">
              <i /><i /><i />
            </span>
            <span className="settings-theme-copy">
              <strong><Sun size={17} aria-hidden="true" /> Day Mode</strong>
              <small>Light surfaces and the familiar emPLE green.</small>
            </span>
            {theme === 'day' && <Check className="settings-theme-check" size={18} aria-label="Selected" />}
          </button>
          <button
            type="button"
            className={`settings-theme-card settings-theme-card--night${theme === 'night' ? ' settings-theme-card--selected' : ''}`}
            onClick={() => selectTheme('night')}
            aria-pressed={theme === 'night'}
          >
            <span className="settings-theme-preview settings-theme-preview--night" aria-hidden="true">
              <i /><i /><i />
            </span>
            <span className="settings-theme-copy">
              <strong><Moon size={17} aria-hidden="true" /> Night Mode</strong>
              <small>Dark, low-glare surfaces with readable contrast.</small>
            </span>
            {theme === 'night' && <Check className="settings-theme-check" size={18} aria-label="Selected" />}
          </button>
        </div>
        {themeError && <p className="settings-message settings-message--error" role="alert">{themeError}</p>}
        {themeFeedback && <p className="settings-message settings-message--success" role="status">{themeFeedback}</p>}
      </section>

      <section className="settings-section" aria-labelledby="settings-access-heading">
        <div className="settings-section-heading">
          <span className="settings-section-icon"><ShieldCheck size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="settings-access-heading">User and access settings</h2>
            <p>Access policy is managed in Roles &amp; Permissions and User Management.</p>
          </div>
        </div>
        <div className="settings-info-panel">
          <Info size={18} aria-hidden="true" />
          <p>There are no additional session or password policy controls supported by the current application, so none are exposed here.</p>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-notifications-heading">
        <div className="settings-section-heading">
          <span className="settings-section-icon"><Bell size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="settings-notifications-heading">Notification preferences</h2>
            <p>Only notification channels implemented by the application can be configured.</p>
          </div>
        </div>
        <div className="settings-info-panel">
          <Info size={18} aria-hidden="true" />
          <p>No configurable in-app notification service is currently available. Email, SMS, and push preferences are not offered.</p>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-system-heading">
        <div className="settings-section-heading">
          <span className="settings-section-icon"><Info size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="settings-system-heading">System information</h2>
            <p>Information available from the current application and browser storage.</p>
          </div>
        </div>
        {systemInfoError && <p className="settings-message settings-message--error" role="alert">{systemInfoError}</p>}
        <dl className="settings-facts">
          <div><dt>Application</dt><dd>emPLE Life Insurance Management System</dd></div>
          <div><dt>Version</dt><dd>{packageInfo.version}</dd></div>
          <div><dt>Departments</dt><dd>{counts?.departments ?? '—'}</dd></div>
          <div><dt>Customers</dt><dd>{counts?.customers ?? '—'}</dd></div>
          <div><dt>Staff accounts</dt><dd>{counts?.staff ?? '—'}</dd></div>
          <div><dt>Storage</dt><dd>Browser localStorage; data is not synchronized to other devices.</dd></div>
        </dl>
      </section>

      <section className="settings-section" aria-labelledby="settings-data-heading">
        <div className="settings-section-heading">
          <span className="settings-section-icon"><Download size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="settings-data-heading">Data management</h2>
            <p>Export organization settings without including customer or staff records.</p>
          </div>
        </div>
        <div className="settings-export-row">
          <div>
            <strong>Export settings configuration</strong>
            <p>This downloads the settings shown here. It is not a backup of application business data.</p>
          </div>
          <button type="button" className="settings-button settings-button--secondary" onClick={exportSettings}>
            <Download size={16} aria-hidden="true" />
            Export settings
          </button>
        </div>
        {exportError && <p className="settings-message settings-message--error" role="alert">{exportError}</p>}
      </section>
    </div>
  )
}
