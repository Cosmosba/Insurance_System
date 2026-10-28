import { getSession } from './mockAuth'

const STORAGE_PREFIX = 'emple_theme_v1:'
const CHANGE_EVENT = 'emple:theme-updated'
const THEMES = new Set(['day', 'night'])

function getThemeKey(email) {
  const normalizedEmail = String(email ?? '').trim().toLocaleLowerCase()
  return normalizedEmail ? `${STORAGE_PREFIX}${encodeURIComponent(normalizedEmail)}` : null
}

export function getCurrentTheme(email = getSession()?.email) {
  const key = getThemeKey(email)
  if (!key || typeof window === 'undefined') return 'day'

  try {
    const savedTheme = window.localStorage.getItem(key)
    return THEMES.has(savedTheme) ? savedTheme : 'day'
  } catch {
    return 'day'
  }
}

export function applyTheme(theme) {
  const selectedTheme = THEMES.has(theme) ? theme : 'day'
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = selectedTheme
  }
  return selectedTheme
}

export function setCurrentTheme(theme, email = getSession()?.email) {
  if (!THEMES.has(theme)) throw new Error('Choose Day Mode or Night Mode.')
  const key = getThemeKey(email)
  if (!key) throw new Error('Sign in before saving a personal appearance preference.')

  try {
    window.localStorage.setItem(key, theme)
  } catch {
    throw new Error('Your appearance preference could not be saved in this browser.')
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
  return theme
}

export function subscribeToThemePreferences(callback) {
  if (typeof window === 'undefined') return () => {}
  const notify = event => {
    const activeKey = getThemeKey(getSession()?.email)
    if (!event || event.key === null || event.key === activeKey) callback(getCurrentTheme())
  }
  window.addEventListener(CHANGE_EVENT, notify)
  window.addEventListener('storage', notify)
  return () => {
    window.removeEventListener(CHANGE_EVENT, notify)
    window.removeEventListener('storage', notify)
  }
}
