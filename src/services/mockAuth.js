/**
 * DEVELOPMENT-ONLY mock authentication.
 * ─────────────────────────────────────────────────────────────────────────────
 * This module simulates authentication for UI prototyping purposes only.
 * It does NOT provide real security. Passwords are never stored or logged.
 * Frontend session storage and route guards are NOT a substitute for
 * server-side authentication and authorisation.
 *
 * Replace this entire module with a real auth service before any production use.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Demo accounts  (shared password: demo1234)
 *   customer@emple.test  →  role: customer
 *   staff@emple.test     →  role: staff
 */

const SESSION_KEY = 'emple_dev_session'
const PROFILE_KEY = 'emple_dev_profile'
const PHOTO_KEY   = 'emple_dev_photo'

// Demo password is intentionally visible here — this is a dev-only mock.
const DEMO_PASSWORD = 'demo1234'

const DEMO_ACCOUNTS = {
  'customer@emple.test':   { role: 'customer',   name: 'Demo Customer'  },
  'staff@emple.test':      { role: 'staff',       name: 'Demo Staff'     },
  'superadmin@emple.test': { role: 'superadmin',  name: 'System Admin'   },
}

export function getKnownStaffAccounts() {
  return Object.entries(DEMO_ACCOUNTS)
    .filter(([, account]) => account.role === 'staff' || account.role === 'superadmin')
    .map(([email, account]) => ({
      email,
      firstName: account.name.split(' ')[0],
      lastName: account.name.split(' ').slice(1).join(' '),
      role: account.role === 'superadmin' ? 'superadmin' : 'department_staff',
    }))
}

export function getKnownCustomerAccounts() {
  return Object.entries(DEMO_ACCOUNTS)
    .filter(([, account]) => account.role === 'customer')
    .map(([email, account]) => ({ email, name: account.name, role: account.role }))
}

// Default profile data keyed by email.
// Fields here represent what a real API would return for the authenticated customer.
const DEFAULT_PROFILES = {
  'customer@emple.test': {
    firstName:    'Demo',
    lastName:     'Customer',
    email:        'customer@emple.test',
    phone:        '+233 20 000 0001',
    altPhone:     '',
    dateOfBirth:  '15 Mar 1985',
    gender:       'Prefer not to say',
    address:      '12 Independence Avenue, Accra, Ghana',
    customerId:   'CUST-00412',
    accountSince: '01 Jan 2021',
    accountStatus:'Active',
  },
  'staff@emple.test': {
    firstName:    'Demo',
    lastName:     'Staff',
    email:        'staff@emple.test',
    phone:        '+233 20 000 0002',
    altPhone:     '',
    dateOfBirth:  '',
    gender:       '',
    address:      '',
    customerId:   'STAFF-00001',
    accountSince: '01 Jan 2020',
    accountStatus:'Active',
  },
}

/**
 * Return the stored profile photo data URL for the current user, or null.
 * @returns {string|null}
 */
export function getPhoto() {
  const session = getSession()
  if (!session) return null
  try {
    const stored = sessionStorage.getItem(PHOTO_KEY)
    if (stored) {
      const all = JSON.parse(stored)
      return all[session.email] ?? null
    }
  } catch { /* ignore */ }
  return null
}

/**
 * Persist a profile photo data URL for the current user.
 * @param {string} dataUrl
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function savePhoto(dataUrl) {
  const session = getSession()
  if (!session) return { ok: false, message: 'No active session.' }
  if (!hasPermission(session, 'profile.edit_own')) {
    return { ok: false, message: 'You do not have permission to update your profile photo.' }
  }
  try {
    const stored = sessionStorage.getItem(PHOTO_KEY)
    const all    = stored ? JSON.parse(stored) : {}
    all[session.email] = dataUrl
    sessionStorage.setItem(PHOTO_KEY, JSON.stringify(all))
    window.dispatchEvent(new Event('emple:session-updated'))
    return { ok: true }
  } catch {
    return { ok: false, message: 'Unable to save photo. Please try a smaller image.' }
  }
}

/**
 * Return the profile for the currently signed-in user.
 * Falls back to the default profile if none has been saved this session.
 * @returns {object|null}
 */
export function getProfile() {
  const session = getSession()
  if (!session) return null
  try {
    const stored = sessionStorage.getItem(PROFILE_KEY)
    if (stored) {
      const all = JSON.parse(stored)
      if (all[session.email]) return all[session.email]
    }
  } catch { /* ignore */ }
  return DEFAULT_PROFILES[session.email] ?? null
}

/**
 * Persist updated profile fields for the current session.
 * Only editable fields are accepted; protected fields are ignored.
 * @param {object} updates
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function saveProfile(updates) {
  const session = getSession()
  if (!session) return { ok: false, message: 'No active session.' }
  if (!hasPermission(session, 'profile.edit_own')) {
    return { ok: false, message: 'You do not have permission to edit your profile.' }
  }

  // Fields the customer is allowed to change
  const EDITABLE = ['firstName', 'lastName', 'phone', 'altPhone', 'address']
  const current  = getProfile() ?? {}
  const next     = { ...current }

  for (const key of EDITABLE) {
    if (key in updates) next[key] = updates[key]
  }

  try {
    const stored = sessionStorage.getItem(PROFILE_KEY)
    const all    = stored ? JSON.parse(stored) : {}
    all[session.email] = next
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(all))

    // Keep the session name in sync so the sidebar reflects the updated name
    const updatedName = `${next.firstName} ${next.lastName}`.trim()
    const updatedSession = { ...session, name: updatedName }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession))

    // Notify other components in the same tab that the session has changed
    window.dispatchEvent(new Event('emple:session-updated'))

    return { ok: true }
  } catch {
    return { ok: false, message: 'Unable to save changes. Please try again.' }
  }
}

/**
 * Attempt a mock login.
 * @param {string} email
 * @param {string} password
 * @returns {{ ok: true, session: object } | { ok: false, message: string }}
 */
export function mockLogin(email, password) {
  const account = DEMO_ACCOUNTS[email.trim().toLowerCase()]

  if (!account || password !== DEMO_PASSWORD) {
    return {
      ok: false,
      message: 'Invalid email or password. Use the demo credentials below.',
    }
  }

  const session = { email: email.trim().toLowerCase(), role: account.role, name: account.name }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return { ok: true, session }
}

/**
 * Return the current mock session, or null if none exists.
 * @returns {{ email: string, role: string, name: string } | null}
 */
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Clear the mock session (sign out).
 */
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}
import { hasPermission } from './rolePermissions'
