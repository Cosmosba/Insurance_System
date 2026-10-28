import { recordRoleAuditEvent } from './roleAudit'

const STORAGE_KEY = 'emple_system_settings_v1'
const CHANGE_EVENT = 'emple:system-settings-updated'
const DATE_FORMATS = new Set(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'])

export class SystemSettingsError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'SystemSettingsError'
    this.details = details
  }
}

function getDefaultSettings() {
  let timeZone = 'UTC'
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || timeZone
  } catch {
    // UTC remains a valid, explicit fallback when the runtime has no time-zone data.
  }
  return {
    organizationName: 'emPLE Life Insurance',
    contactEmail: '',
    contactPhone: '',
    timeZone,
    dateFormat: 'DD/MM/YYYY',
    updatedAt: null,
  }
}

function isValidTimeZone(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

function validateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new SystemSettingsError('Enter valid organization settings.')
  }
  const organizationName = String(input.organizationName ?? '').trim()
  const contactEmail = String(input.contactEmail ?? '').trim()
  const contactPhone = String(input.contactPhone ?? '').trim()
  const timeZone = String(input.timeZone ?? '').trim()
  const dateFormat = input.dateFormat

  if (!organizationName || organizationName.length > 100) {
    throw new SystemSettingsError('Organization name must contain 1 to 100 characters.')
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new SystemSettingsError('Enter a valid contact email address.')
  }
  if (contactPhone.length > 40 || (contactPhone && !/^[+()\d.\-\s]+$/.test(contactPhone))) {
    throw new SystemSettingsError('Enter a valid contact phone number.')
  }
  if (!isValidTimeZone(timeZone)) {
    throw new SystemSettingsError('Enter a valid time zone, such as Europe/London or UTC.')
  }
  if (!DATE_FORMATS.has(dateFormat)) {
    throw new SystemSettingsError('Choose a supported date format.')
  }

  return { organizationName, contactEmail, contactPhone, timeZone, dateFormat }
}

function getStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('Browser storage is unavailable.')
    }
    return window.localStorage
  } catch {
    throw new SystemSettingsError('Settings storage is unavailable in this browser.')
  }
}

export function getSystemSettings() {
  let raw
  try {
    raw = getStorage().getItem(STORAGE_KEY)
  } catch (error) {
    if (error instanceof SystemSettingsError) throw error
    throw new SystemSettingsError('Unable to read organization settings.')
  }
  if (raw === null) return getDefaultSettings()

  let saved
  try {
    saved = JSON.parse(raw)
  } catch {
    throw new SystemSettingsError('Saved organization settings are invalid. Review and save the form to replace them.')
  }

  let validated
  try {
    validated = validateSettings(saved)
  } catch {
    throw new SystemSettingsError('Saved organization settings have an invalid format. Review and save the form to replace them.')
  }
  if (saved.updatedAt !== null && typeof saved.updatedAt !== 'string') {
    throw new SystemSettingsError('Saved organization settings have an invalid save timestamp.')
  }
  return { ...validated, updatedAt: saved.updatedAt ?? null }
}

export function saveSystemSettings(input) {
  const values = validateSettings(input)
  const previous = (() => {
    try {
      return getSystemSettings()
    } catch (error) {
      if (!(error instanceof SystemSettingsError)) throw error
      return null
    }
  })()
  const changedFields = previous
    ? Object.keys(values).filter(key => values[key] !== previous[key])
    : Object.keys(values)
  const next = { ...values, updatedAt: new Date().toISOString() }

  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (error) {
    if (error instanceof SystemSettingsError) throw error
    throw new SystemSettingsError('Organization settings could not be saved in this browser.')
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))

  if (changedFields.length) {
    try {
      recordRoleAuditEvent({
        action: 'Organization settings updated',
        targetType: 'settings',
        targetId: 'organization',
        targetName: 'Organization settings',
        details: `Changed fields: ${changedFields.join(', ')}.`,
      })
    } catch (error) {
      throw new SystemSettingsError(
        'Settings were saved, but the administrative history could not be updated.',
        { saved: true, cause: error },
      )
    }
  }
  return { ...next }
}

export function subscribeToSystemSettings(callback) {
  if (typeof window === 'undefined') return () => {}
  const onChange = event => {
    if (event?.key && event.key !== STORAGE_KEY) return
    try {
      callback(getSystemSettings(), null)
    } catch (error) {
      callback(null, error)
    }
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function exportSystemSettings(settings = getSystemSettings()) {
  return JSON.stringify({
    exportType: 'organization-settings',
    exportedAt: new Date().toISOString(),
    settings: {
      organizationName: settings.organizationName,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      timeZone: settings.timeZone,
      dateFormat: settings.dateFormat,
      updatedAt: settings.updatedAt,
    },
  }, null, 2)
}

export { getDefaultSettings }
