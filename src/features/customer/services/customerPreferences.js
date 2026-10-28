import { getSession } from '../../../services/mockAuth'

const STORAGE_PREFIX = 'emple_customer_preferences_v1:'
const CHANGE_EVENT = 'emple:customer-preferences-updated'
const DATE_FORMATS = new Set(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'])
const TIME_FORMATS = new Set(['12-hour', '24-hour'])

export const DEFAULT_CUSTOMER_PREFERENCES = Object.freeze({
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12-hour',
})

function getPreferencesKey(email) {
  const normalizedEmail = String(email ?? '').trim().toLocaleLowerCase()
  return normalizedEmail ? `${STORAGE_PREFIX}${encodeURIComponent(normalizedEmail)}` : null
}

function getPreferencesStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('Personal preferences are unavailable in this browser.')
  }
  return window.localStorage
}

function validatePreferences(input) {
  if (
    !input
    || typeof input !== 'object'
    || !DATE_FORMATS.has(input.dateFormat)
    || !TIME_FORMATS.has(input.timeFormat)
  ) {
    throw new Error('Saved regional preferences are invalid. Choose a date and time format, then save again.')
  }
  return { dateFormat: input.dateFormat, timeFormat: input.timeFormat }
}

export function getCustomerPreferences(email = getSession()?.email) {
  const key = getPreferencesKey(email)
  if (!key) return { ...DEFAULT_CUSTOMER_PREFERENCES }

  let raw
  try {
    raw = getPreferencesStorage().getItem(key)
  } catch {
    throw new Error('Personal preferences could not be read from this browser.')
  }
  if (raw === null) return { ...DEFAULT_CUSTOMER_PREFERENCES }

  let saved
  try {
    saved = JSON.parse(raw)
  } catch {
    throw new Error('Saved regional preferences could not be read. Choose your formats and save again.')
  }
  return validatePreferences(saved)
}

export function saveCustomerPreferences(input, email = getSession()?.email) {
  const preferences = validatePreferences(input)
  const key = getPreferencesKey(email)
  if (!key) throw new Error('Sign in before saving personal preferences.')

  try {
    getPreferencesStorage().setItem(key, JSON.stringify(preferences))
  } catch {
    throw new Error('Personal preferences could not be saved in this browser.')
  }

  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
  return preferences
}

export function subscribeToCustomerPreferences(callback) {
  if (typeof window === 'undefined') return () => {}

  const notify = event => {
    const activeKey = getPreferencesKey(getSession()?.email)
    if (event?.key && event.key !== activeKey) return
    try {
      callback(getCustomerPreferences(), null)
    } catch (error) {
      callback({ ...DEFAULT_CUSTOMER_PREFERENCES }, error)
    }
  }
  window.addEventListener(CHANGE_EVENT, notify)
  window.addEventListener('storage', notify)
  return () => {
    window.removeEventListener(CHANGE_EVENT, notify)
    window.removeEventListener('storage', notify)
  }
}

function getDateParts(value, timeZone) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Object.fromEntries(new Intl.DateTimeFormat('en', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value).map(part => [part.type, part.value]))
  }

  const text = String(value ?? '').trim()
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (isoDate) return { year: isoDate[1], month: isoDate[2], day: isoDate[3] }

  const namedDate = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/.exec(text)
  if (namedDate) {
    const monthIndex = new Date(`${namedDate[2]} 1, 2000`).getMonth()
    if (!Number.isNaN(monthIndex)) {
      return {
        year: namedDate[3],
        month: String(monthIndex + 1).padStart(2, '0'),
        day: namedDate[1].padStart(2, '0'),
      }
    }
  }

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return null
  return Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).map(part => [part.type, part.value]))
}

export function formatCustomerDate(value, preferences = DEFAULT_CUSTOMER_PREFERENCES, timeZone) {
  const parts = getDateParts(value, timeZone)
  if (!parts) return value ?? '—'
  const format = DATE_FORMATS.has(preferences?.dateFormat)
    ? preferences.dateFormat
    : DEFAULT_CUSTOMER_PREFERENCES.dateFormat
  if (format === 'MM/DD/YYYY') return `${parts.month}/${parts.day}/${parts.year}`
  if (format === 'YYYY-MM-DD') return `${parts.year}-${parts.month}-${parts.day}`
  return `${parts.day}/${parts.month}/${parts.year}`
}

export function formatCustomerTime(value, preferences = DEFAULT_CUSTOMER_PREFERENCES, timeZone) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const timeFormat = TIME_FORMATS.has(preferences?.timeFormat)
    ? preferences.timeFormat
    : DEFAULT_CUSTOMER_PREFERENCES.timeFormat
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: timeFormat === '12-hour',
    ...(timeZone ? { timeZone } : {}),
  })
}
