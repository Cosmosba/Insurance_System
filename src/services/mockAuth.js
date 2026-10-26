/**
 * DEVELOPMENT-ONLY mock authentication.
 * ─────────────────────────────────────────────────────────────────────────────
 * This module simulates authentication for UI prototyping purposes only.
 * It does NOT provide real security. Plaintext passwords are never stored or logged;
 * password verifiers are held in browser storage for this prototype.
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
import { getStoredCustomerByEmail, updateStoredCustomerProfile } from './customerRecordStore'
import {
  createPasswordCredential,
  generateDefaultPassword,
  verifyPasswordCredential,
} from './passwordCredentials'

const SESSION_KEY = 'emple_dev_session'
const PROFILE_KEY = 'emple_dev_profile'
const PHOTO_KEY   = 'emple_dev_photo'

// Demo password is intentionally visible here — this is a dev-only mock.
const DEMO_PASSWORD = 'demo1234'
const STAFF_STORAGE_KEY = 'emple_staff_users_v1'
const CUSTOMER_STORAGE_KEY = 'emple_customers_v1'
const SESSION_UPDATED_EVENT = 'emple:session-updated'

const DEMO_ACCOUNTS = {
  'customer@emple.test':   { role: 'customer',   name: 'Demo Customer'  },
  'staff@emple.test':      { role: 'staff',       name: 'Demo Staff'     },
  'superadmin@emple.test': { role: 'superadmin',  name: 'System Admin'   },
}

function withoutPasswordCredential(record) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => (
    !['passwordSalt', 'passwordHash', 'mustChangePassword'].includes(key)
  )))
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

export function getKnownCustomerProfiles() {
  return getKnownCustomerAccounts()
    .map(account => DEFAULT_PROFILES[account.email])
    .filter(Boolean)
    .map(profile => ({ ...profile }))
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
  let savedProfile = null
  try {
    const stored = sessionStorage.getItem(PROFILE_KEY)
    if (stored) {
      const all = JSON.parse(stored)
      if (all[session.email]) savedProfile = all[session.email]
    }
  } catch { /* ignore */ }
  const defaultProfile = DEFAULT_PROFILES[session.email]
  try {
    const customer = getStoredCustomerByEmail(session.email)
    if (customer) {
      const profileCustomer = withoutPasswordCredential(customer)
      return {
        ...defaultProfile,
        ...savedProfile,
        firstName: profileCustomer.firstName,
        lastName: profileCustomer.lastName,
        email: profileCustomer.email,
        phone: profileCustomer.phone,
        altPhone: profileCustomer.altPhone,
        address: profileCustomer.address,
        ...profileCustomer,
        customerId: profileCustomer.id,
        accountStatus: profileCustomer.status,
        accountSince: profileCustomer.registrationDate,
      }
    }
  } catch { /* Directory validation is reported by customer administration. */ }
  if (!defaultProfile) return null
  return { ...defaultProfile, ...savedProfile }
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
    updateStoredCustomerProfile(session.email, next)
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
export function getRoleHome(role) {
  if (role === 'superadmin') return '/admin/dashboard'
  if (role === 'customer') return '/customer/dashboard'
  if (['staff', 'department_staff', 'department_manager'].includes(role)) return '/staff/dashboard'
  return '/login'
}

function readAccountRecords(storageKey) {
  const raw = window.localStorage.getItem(storageKey)
  if (raw === null) return []
  const records = JSON.parse(raw)
  if (!Array.isArray(records)) throw new Error('Account records have an invalid format.')
  return records
}

function findStoredAccount(email) {
  const staff = readAccountRecords(STAFF_STORAGE_KEY)
    .filter(account => String(account.email ?? '').trim().toLocaleLowerCase() === email)
    .map(account => ({ ...account, accountType: 'staff' }))
  const customers = readAccountRecords(CUSTOMER_STORAGE_KEY)
    .filter(account => String(account.email ?? '').trim().toLocaleLowerCase() === email)
    .map(account => ({ ...account, accountType: 'customer', role: 'customer' }))
  const matches = [...staff, ...customers]
  if (matches.length > 1) throw new Error('This email is linked to more than one account.')
  return matches[0] ?? null
}

function hasCompleteAccountName(account) {
  return Boolean(
    String(account.firstName ?? '').trim()
    && String(account.lastName ?? '').trim(),
  )
}

function getDevelopmentAccount(email) {
  const staff = getKnownStaffAccounts().find(account => account.email.toLocaleLowerCase() === email)
  if (staff) {
    return {
      id: `user-${encodeURIComponent(staff.email.toLocaleLowerCase())}`,
      ...staff,
      phone: '',
      employeeId: '',
      departmentId: null,
      status: 'Active',
      createdAt: null,
      updatedAt: null,
      authManaged: true,
      accountType: 'staff',
    }
  }
  const customer = getKnownCustomerProfiles().find(
    profile => profile.email.toLocaleLowerCase() === email,
  )
  if (!customer) return null
  const registrationDate = new Date(customer.accountSince).toISOString().slice(0, 10)
  return {
    id: customer.customerId,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email.toLocaleLowerCase(),
    phone: customer.phone ?? '',
    altPhone: customer.altPhone ?? '',
    dateOfBirth: customer.dateOfBirth ?? '',
    gender: customer.gender ?? '',
    address: customer.address ?? '',
    status: customer.accountStatus === 'Inactive' ? 'Inactive' : 'Active',
    registrationDate,
    createdAt: new Date(`${registrationDate}T00:00:00.000Z`).toISOString(),
    updatedAt: null,
    authManaged: true,
    accountType: 'customer',
    role: 'customer',
  }
}

function writeStoredAccount(account, fields) {
  const storageKey = account.accountType === 'customer' ? CUSTOMER_STORAGE_KEY : STAFF_STORAGE_KEY
  const records = readAccountRecords(storageKey)
  const index = records.findIndex(record => (
    String(record.email ?? '').trim().toLocaleLowerCase() === account.email.toLocaleLowerCase()
  ))
  const record = Object.fromEntries(Object.entries(account).filter(([key]) => key !== 'accountType'))
  const updated = { ...record, ...fields }
  if (index < 0) records.push(updated)
  else records[index] = { ...records[index], ...fields }
  window.localStorage.setItem(storageKey, JSON.stringify(records))
  window.dispatchEvent(new Event(
    account.accountType === 'customer'
      ? 'emple:customers-updated'
      : 'emple:staff-users-updated',
  ))
  return updated
}

function persistCompletedAccountName(account, firstName, lastName, credential) {
  return writeStoredAccount(account, {
    firstName,
    lastName,
    ...credential,
    mustChangePassword: account.mustChangePassword !== false,
  })
}

function saveAccountCredential(account, credential) {
  writeStoredAccount(account, { ...credential, mustChangePassword: false })
}

export async function mockLogin(email, password, { firstName = '', lastName = '' } = {}) {
  const normalizedEmail = email.trim().toLowerCase()
  const account = DEMO_ACCOUNTS[normalizedEmail]

  if (account?.role === 'superadmin') {
    if (password !== DEMO_PASSWORD) {
      return { ok: false, message: 'Invalid email or password.' }
    }
    if (account.role === 'customer') {
      try {
        const customer = getStoredCustomerByEmail(normalizedEmail)
        if (customer?.status === 'Inactive') {
          return { ok: false, message: 'This customer account is inactive. Contact an administrator for assistance.' }
        }
        if (customer && customer.status !== 'Active') {
          return { ok: false, message: 'Customer account data could not be verified. Contact an administrator.' }
        }
      } catch {
        return { ok: false, message: 'Customer account data could not be verified. Contact an administrator.' }
      }
    }
    const session = {
      email: normalizedEmail,
      role: account.role,
      name: account.name,
      mustChangePassword: false,
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return { ok: true, session }
  }

  let storedAccount
  try {
    storedAccount = findStoredAccount(normalizedEmail)
    if (!storedAccount) storedAccount = getDevelopmentAccount(normalizedEmail)
  } catch {
    return { ok: false, message: 'Account information could not be verified. Contact an administrator.' }
  }
  if (
    !storedAccount
    || storedAccount.role === 'superadmin'
    || storedAccount.status !== 'Active'
  ) {
    return { ok: false, message: 'Invalid email or password. Contact an administrator if you need access.' }
  }

  try {
    if (!hasCompleteAccountName(storedAccount)) {
      const hasVerifier = (
        typeof storedAccount.passwordHash === 'string'
        && typeof storedAccount.passwordSalt === 'string'
      )
      if (!hasVerifier) {
        return {
          ok: false,
          message: 'This account is missing required name details. Contact an administrator to update the account before signing in.',
        }
      }
      if (
        (String(storedAccount.firstName ?? '').trim() && !String(lastName ?? '').trim())
        || (!String(storedAccount.firstName ?? '').trim() && !String(firstName ?? '').trim())
      ) {
        return {
          ok: false,
          needsNameCompletion: true,
          firstName: String(storedAccount.firstName ?? ''),
          lastName: String(storedAccount.lastName ?? ''),
        }
      }
      const completedFirstName = String(storedAccount.firstName ?? '').trim() || String(firstName).trim()
      const completedLastName = String(storedAccount.lastName ?? '').trim() || String(lastName).trim()
      try {
        generateDefaultPassword(completedFirstName, completedLastName)
      } catch (error) {
        return { ok: false, needsNameCompletion: true, firstName, lastName, message: error.message }
      }
      if (!await verifyPasswordCredential(password, storedAccount)) {
        return { ok: false, message: 'Invalid email or password.' }
      }
      const credential = {
        passwordSalt: storedAccount.passwordSalt,
        passwordHash: storedAccount.passwordHash,
      }
      persistCompletedAccountName(
        storedAccount,
        completedFirstName,
        completedLastName,
        credential,
      )
      const session = {
        email: normalizedEmail,
        role: storedAccount.role,
        name: `${completedFirstName} ${completedLastName}`.trim(),
        mustChangePassword: true,
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
      return { ok: true, session }
    }

    let credential = storedAccount
    if (typeof storedAccount.passwordHash !== 'string' || typeof storedAccount.passwordSalt !== 'string') {
      const defaultPassword = generateDefaultPassword(storedAccount.firstName, storedAccount.lastName)
      if (password !== defaultPassword) {
        return { ok: false, message: 'Invalid email or password. Contact an administrator if you need access.' }
      }
      const generatedCredential = await createPasswordCredential(defaultPassword)
      credential = writeStoredAccount(storedAccount, {
        ...generatedCredential,
        mustChangePassword: true,
      })
    } else if (!await verifyPasswordCredential(password, storedAccount)) {
      return { ok: false, message: 'Invalid email or password. Contact an administrator if you need access.' }
    }

    const session = {
      email: normalizedEmail,
      role: storedAccount.role,
      name: `${storedAccount.firstName} ${storedAccount.lastName}`.trim(),
      mustChangePassword: credential.mustChangePassword !== false,
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return { ok: true, session }
  } catch {
    return { ok: false, message: 'Account information could not be verified. Contact an administrator.' }
  }
}

export async function changeFirstLoginPassword(currentPassword, newPassword, confirmation) {
  const session = getSession()
  if (!session || session.role === 'superadmin' || !session.mustChangePassword) {
    throw new Error('A first-login password change is not required for this account.')
  }
  if (typeof currentPassword !== 'string' || !currentPassword) {
    throw new Error('Enter your current password.')
  }
  if (typeof newPassword !== 'string' || newPassword.length < 10) {
    throw new Error('Use at least 10 characters for your new password.')
  }
  const strengthChecks = [
    /[a-z]/.test(newPassword),
    /[A-Z]/.test(newPassword),
    /\d/.test(newPassword),
    /[^A-Za-z0-9]/.test(newPassword),
  ].filter(Boolean).length
  if (strengthChecks < 3) {
    throw new Error('Include at least three of these: lowercase, uppercase, number, or symbol.')
  }
  if (newPassword !== confirmation) throw new Error('The new password and confirmation do not match.')
  const account = findStoredAccount(session.email.toLocaleLowerCase())
  if (!account || account.role !== session.role || account.status !== 'Active') {
    throw new Error('This account is no longer available for password changes.')
  }
  const currentMatches = account.passwordHash && account.passwordSalt
    ? await verifyPasswordCredential(currentPassword, account)
    : currentPassword === generateDefaultPassword(account.firstName, account.lastName)
  if (!currentMatches) throw new Error('Your current password is incorrect.')
  if (newPassword === currentPassword) {
    throw new Error('Choose a new password different from your current password.')
  }
  if (newPassword === generateDefaultPassword(account.firstName, account.lastName)) {
    throw new Error('Choose a new password different from the temporary password.')
  }

  const credential = await createPasswordCredential(newPassword)
  saveAccountCredential(account, credential)
  window.dispatchEvent(new Event(SESSION_UPDATED_EVENT))
}

/**
 * Return the current mock session, or null if none exists.
 * @returns {{ email: string, role: string, name: string } | null}
 */
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    const session = raw ? JSON.parse(raw) : null
    if (!session || typeof session.email !== 'string') return null

    const demoAccount = DEMO_ACCOUNTS[session.email.toLocaleLowerCase()]
    if (demoAccount?.role === 'superadmin') {
      if (session.role !== demoAccount.role) return null
      return {
        ...session,
        mustChangePassword: false,
      }
    }
    const account = findStoredAccount(session.email.toLocaleLowerCase())
      ?? getDevelopmentAccount(session.email.toLocaleLowerCase())
    if (
      !account
      || account.status !== 'Active'
      || account.role === 'superadmin'
      || session.role !== account.role
      || !hasCompleteAccountName(account)
    ) return null
    return { ...session, mustChangePassword: account.mustChangePassword !== false }
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
