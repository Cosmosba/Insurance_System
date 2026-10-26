import { getSession, getKnownCustomerProfiles } from './mockAuth'
import { claims, payments, policies } from './customerData'
import { hasPermission } from './rolePermissions'
import { recordRoleAuditEvent } from './roleAudit'

const STORAGE_KEY = 'emple_customers_v1'
const CHANGE_EVENT = 'emple:customers-updated'
const VALID_STATUSES = new Set(['Active', 'Inactive'])
const CUSTOMER_FIELDS = new Set([
  'id', 'firstName', 'lastName', 'email', 'phone', 'altPhone',
  'dateOfBirth', 'gender', 'address', 'status', 'registrationDate',
  'createdAt', 'updatedAt', 'authManaged',
])

export class CustomerDataError extends Error {
  constructor(message, fieldErrors = {}, details = {}) {
    super(message)
    this.name = 'CustomerDataError'
    this.fieldErrors = fieldErrors
    this.details = details
  }
}

function getStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('Browser storage is unavailable.')
    }
    return window.localStorage
  } catch {
    throw new CustomerDataError('Customer storage is unavailable in this browser.')
  }
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLocaleLowerCase()
}

function normalizePhone(phone) {
  return String(phone ?? '').replace(/[^\d+]/g, '')
}

function requirePermission(permissionId) {
  const session = getSession()
  if (!session) throw new CustomerDataError('Sign in to access customer records.')
  const permitted = hasPermission(session, 'customers.manage')
    || hasPermission(session, permissionId)
  if (!permitted) {
    throw new CustomerDataError('You do not have permission to perform this customer action.')
  }
  return session
}

function validateRecord(record) {
  return Boolean(
    record
    && typeof record.id === 'string'
    && typeof record.firstName === 'string'
    && typeof record.lastName === 'string'
    && typeof record.email === 'string'
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)
    && typeof record.phone === 'string'
    && /^\+?[1-9]\d{7,14}$/.test(normalizePhone(record.phone))
    && typeof record.status === 'string'
    && VALID_STATUSES.has(record.status)
    && typeof record.registrationDate === 'string'
    && !Number.isNaN(Date.parse(`${record.registrationDate}T00:00:00`))
    && typeof record.createdAt === 'string'
    && !Number.isNaN(Date.parse(record.createdAt))
    && ['altPhone', 'dateOfBirth', 'gender', 'address'].every(field => (
      record[field] === undefined || typeof record[field] === 'string'
    ))
    && (record.updatedAt === null || typeof record.updatedAt === 'string')
    && typeof record.authManaged === 'boolean'
    && Object.keys(record).every(key => CUSTOMER_FIELDS.has(key)),
  )
}

function readStoredCustomers() {
  let raw
  try {
    raw = getStorage().getItem(STORAGE_KEY)
  } catch (error) {
    if (error instanceof CustomerDataError) throw error
    throw new CustomerDataError('Unable to read customer records.')
  }
  if (raw === null) return null

  let customers
  try {
    customers = JSON.parse(raw)
  } catch {
    throw new CustomerDataError('Saved customer records are malformed. Correct or remove the invalid customer data before continuing.')
  }
  if (
    !Array.isArray(customers)
    || customers.some(customer => !validateRecord(customer))
    || new Set(customers.map(customer => customer.id)).size !== customers.length
    || new Set(customers.map(customer => normalizeEmail(customer.email))).size !== customers.length
  ) {
    throw new CustomerDataError('Saved customer records have an invalid format. Correct or remove the invalid customer data before continuing.')
  }
  return customers
}

function persistCustomers(customers) {
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(customers))
  } catch (error) {
    if (error instanceof CustomerDataError) throw error
    throw new CustomerDataError('Unable to save customer records in this browser.')
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function parseRegistrationDate(value) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10)
}

function initialCustomers() {
  return getKnownCustomerProfiles().map(profile => {
    const registrationDate = parseRegistrationDate(profile.accountSince)
    return {
      id: profile.customerId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: normalizeEmail(profile.email),
      phone: profile.phone ?? '',
      altPhone: profile.altPhone ?? '',
      dateOfBirth: profile.dateOfBirth ?? '',
      gender: profile.gender ?? '',
      address: profile.address ?? '',
      status: profile.accountStatus === 'Inactive' ? 'Inactive' : 'Active',
      registrationDate,
      createdAt: new Date(`${registrationDate}T00:00:00.000Z`).toISOString(),
      updatedAt: null,
      authManaged: true,
    }
  })
}

function ensureCustomers() {
  const stored = readStoredCustomers()
  if (stored !== null) return stored
  const customers = initialCustomers()
  persistCustomers(customers)
  return customers
}

function recordAudit(event) {
  try {
    recordRoleAuditEvent(event)
  } catch (error) {
    throw new CustomerDataError(
      'The customer change was saved, but administrative history could not be updated.',
      {},
      { saved: true, cause: error },
    )
  }
}

function validateCustomerInput(input, customers, currentId = null) {
  const fields = {
    firstName: String(input.firstName ?? '').trim(),
    lastName: String(input.lastName ?? '').trim(),
    email: normalizeEmail(input.email),
    phone: String(input.phone ?? '').trim(),
    altPhone: String(input.altPhone ?? '').trim(),
    dateOfBirth: String(input.dateOfBirth ?? '').trim(),
    gender: String(input.gender ?? '').trim(),
    address: String(input.address ?? '').trim(),
  }
  const fieldErrors = {}
  if (!fields.firstName) fieldErrors.firstName = 'Enter the customer’s first name.'
  if (!fields.lastName) fieldErrors.lastName = 'Enter the customer’s last name.'
  if (!fields.email) fieldErrors.email = 'Enter an email address.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) fieldErrors.email = 'Enter a valid email address.'
  if (!fields.phone) fieldErrors.phone = 'Enter a phone number.'
  else if (!/^\+?[1-9]\d{7,14}$/.test(normalizePhone(fields.phone))) {
    fieldErrors.phone = 'Enter a valid phone number with 8 to 15 digits.'
  }
  const duplicateEmail = customers.find(customer => (
    customer.id !== currentId && normalizeEmail(customer.email) === fields.email
  ))
  if (duplicateEmail) fieldErrors.email = 'A customer with this email address already exists.'
  const phoneDigits = normalizePhone(fields.phone).replace(/^\+/, '')
  const duplicatePhone = customers.find(customer => (
    customer.id !== currentId && normalizePhone(customer.phone).replace(/^\+/, '') === phoneDigits
  ))
  if (duplicatePhone) fieldErrors.phone = 'A customer with this phone number already exists.'
  if (Object.keys(fieldErrors).length) {
    throw new CustomerDataError('Review the highlighted customer details.', fieldErrors)
  }
  return fields
}

function evaluateCustomerImport(records, customers) {
  const seenEmails = new Set(customers.map(customer => normalizeEmail(customer.email)))
  const seenPhones = new Set(customers.map(customer => normalizePhone(customer.phone).replace(/^\+/, '')))

  return records.map((record, index) => {
    const source = record && typeof record === 'object' ? record : {}
    const rowNumber = Number.isInteger(source.rowNumber) ? source.rowNumber : index + 2
    let fields = null
    let fieldErrors = {}
    try {
      fields = validateCustomerInput(source, customers)
    } catch (error) {
      if (!(error instanceof CustomerDataError)) throw error
      fieldErrors = error.fieldErrors
    }

    const email = normalizeEmail(source.email)
    const phone = normalizePhone(source.phone).replace(/^\+/, '')
    const duplicateEmail = Boolean(email && seenEmails.has(email))
    const duplicatePhone = Boolean(phone && seenPhones.has(phone))
    if (email) seenEmails.add(email)
    if (phone) seenPhones.add(phone)
    if (duplicateEmail) fieldErrors.email = 'A customer with this email address appears more than once or already exists.'
    if (duplicatePhone) fieldErrors.phone = 'A customer with this phone number appears more than once or already exists.'

    const isDuplicate = duplicateEmail || duplicatePhone
    const status = isDuplicate ? 'duplicate' : Object.keys(fieldErrors).length ? 'invalid' : 'valid'
    return {
      rowNumber,
      fields: fields ?? {
        firstName: String(source.firstName ?? '').trim(),
        lastName: String(source.lastName ?? '').trim(),
        email,
        phone: String(source.phone ?? '').trim(),
        altPhone: String(source.altPhone ?? '').trim(),
        dateOfBirth: String(source.dateOfBirth ?? '').trim(),
        gender: String(source.gender ?? '').trim(),
        address: String(source.address ?? '').trim(),
      },
      fieldErrors,
      errors: Object.values(fieldErrors),
      status,
    }
  })
}

function generateCustomerId(customers) {
  const makeId = () => {
    const token = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 10)
      ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
    return `CUST-${token.toUpperCase()}`
  }
  let id = makeId()
  while (customers.some(customer => customer.id === id)) id = makeId()
  return id
}

function requireCustomerById(customers, id) {
  const customer = customers.find(record => record.id === id)
  if (!customer) throw new CustomerDataError('The selected customer could not be found.')
  return customer
}

export function getCustomerDirectory() {
  requirePermission('customers.view')
  return ensureCustomers().map(customer => ({ ...customer }))
    .sort((a, b) => b.registrationDate.localeCompare(a.registrationDate))
}

export function filterCustomerDirectory(customers, query = '', { status = '', sort = 'newest' } = {}) {
  const normalizedQuery = String(query).trim().toLocaleLowerCase()
  return customers
    .filter(customer => !status || customer.status === status)
    .filter(customer => !normalizedQuery || [
      customer.id,
      `${customer.firstName} ${customer.lastName}`,
      customer.email,
      customer.phone,
    ].some(value => String(value ?? '').toLocaleLowerCase().includes(normalizedQuery)))
    .sort((a, b) => sort === 'name'
      ? `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      : b.registrationDate.localeCompare(a.registrationDate))
}

export function createCustomer(input) {
  const session = requirePermission('customers.create')
  const customers = ensureCustomers()
  const fields = validateCustomerInput(input, customers)
  const now = new Date().toISOString()
  const customer = {
    id: generateCustomerId(customers),
    ...fields,
    status: 'Active',
    registrationDate: now.slice(0, 10),
    createdAt: now,
    updatedAt: null,
    authManaged: false,
  }
  persistCustomers([customer, ...customers])
  recordAudit({
    action: 'created',
    targetType: 'customer',
    targetId: customer.id,
    targetName: `${customer.firstName} ${customer.lastName}`,
    details: `Registered by ${session.email}. No login credentials were created.`,
  })
  return { ...customer }
}

export function previewCustomerImport(records) {
  requirePermission('customers.create')
  if (!Array.isArray(records) || records.length === 0) {
    throw new CustomerDataError('The upload contains no customer records.')
  }
  const results = evaluateCustomerImport(records, ensureCustomers())
  return {
    total: results.length,
    valid: results.filter(record => record.status === 'valid').length,
    invalid: results.filter(record => record.status === 'invalid').length,
    duplicates: results.filter(record => record.status === 'duplicate').length,
    records: results,
  }
}

export function importCustomerRecords(records) {
  const session = requirePermission('customers.create')
  if (!Array.isArray(records) || records.length === 0) {
    throw new CustomerDataError('Select valid customer records to import.')
  }
  const customers = ensureCustomers()
  const results = evaluateCustomerImport(records, customers)
  const validRecords = results.filter(record => record.status === 'valid')
  const now = new Date().toISOString()
  const imported = []
  for (const record of validRecords) {
    imported.push({
      id: generateCustomerId([...customers, ...imported]),
      ...record.fields,
      status: 'Active',
      registrationDate: now.slice(0, 10),
      createdAt: now,
      updatedAt: null,
      authManaged: false,
    })
  }

  let auditWarning = ''
  if (imported.length) {
    persistCustomers([...imported, ...customers])
    try {
      recordAudit({
        action: 'bulk registered',
        targetType: 'customer',
        targetId: `bulk-${Date.now()}`,
        targetName: `${imported.length} customer records`,
        details: `Bulk import by ${session.email}; ${results.filter(record => record.status !== 'valid').length} records rejected.`,
      })
    } catch (error) {
      if (!error.details?.saved) throw error
      auditWarning = error.message
    }
  }

  return {
    imported: imported.length,
    skipped: results.filter(record => record.status === 'duplicate').length,
    failed: results.filter(record => record.status === 'invalid').length,
    rejected: results.filter(record => record.status !== 'valid'),
    warning: auditWarning,
  }
}

export function updateCustomer(id, input) {
  const session = requirePermission('customers.edit')
  const customers = ensureCustomers()
  const current = requireCustomerById(customers, id)
  const fields = validateCustomerInput(input, customers, id)
  if (current.authManaged && fields.email !== current.email) {
    throw new CustomerDataError('The email on this existing sign-in account cannot be changed here.', {
      email: 'This email is linked to an existing sign-in account.',
    })
  }
  const updated = { ...current, ...fields, updatedAt: new Date().toISOString() }
  persistCustomers(customers.map(customer => customer.id === id ? updated : customer))
  recordAudit({
    action: 'updated',
    targetType: 'customer',
    targetId: updated.id,
    targetName: `${updated.firstName} ${updated.lastName}`,
    details: `Updated by ${session.email}.`,
  })
  return { ...updated }
}

export function setCustomerStatus(id, status) {
  if (!VALID_STATUSES.has(status)) throw new CustomerDataError('Select a valid customer account status.')
  const permission = status === 'Active' ? 'customers.activate' : 'customers.deactivate'
  const session = requirePermission(permission)
  const customers = ensureCustomers()
  const current = requireCustomerById(customers, id)
  if (current.status === status) return { ...current }
  const updated = { ...current, status, updatedAt: new Date().toISOString() }
  persistCustomers(customers.map(customer => customer.id === id ? updated : customer))
  recordAudit({
    action: status === 'Active' ? 'activated' : 'deactivated',
    targetType: 'customer',
    targetId: updated.id,
    targetName: `${updated.firstName} ${updated.lastName}`,
    details: `Status changed by ${session.email}.`,
  })
  return { ...updated }
}

export function getCustomerProfile(id) {
  requirePermission('customers.view')
  const directory = ensureCustomers()
  const customer = requireCustomerById(directory, id)
  const customerName = `${customer.firstName} ${customer.lastName}`.trim().toLocaleLowerCase()
  const sameNameCount = directory.filter(record => (
    `${record.firstName} ${record.lastName}`.trim().toLocaleLowerCase() === customerName
  )).length
  const customerPolicies = sameNameCount === 1 || customer.authManaged
    ? policies.filter(policy => String(policy.policyholder ?? '').trim().toLocaleLowerCase() === customerName)
    : []
  const policyIds = new Set(customerPolicies.map(policy => policy.id))
  return {
    ...customer,
    policies: customerPolicies.map(policy => ({ ...policy })),
    payments: payments.filter(payment => policyIds.has(payment.policyId)).map(payment => ({ ...payment })),
    claims: claims.filter(claim => policyIds.has(claim.policyId)).map(claim => ({ ...claim })),
    serviceRequests: [],
  }
}

export function getCustomerSummary(customers = getCustomerDirectory(), now = new Date()) {
  const recentCutoff = new Date(now)
  recentCutoff.setDate(recentCutoff.getDate() - 30)
  recentCutoff.setHours(0, 0, 0, 0)
  return {
    total: customers.length,
    active: customers.filter(customer => customer.status === 'Active').length,
    inactive: customers.filter(customer => customer.status === 'Inactive').length,
    recent: customers.filter(customer => {
      const registered = new Date(`${customer.registrationDate}T00:00:00`)
      return !Number.isNaN(registered.getTime()) && registered >= recentCutoff
    }).length,
  }
}

export function subscribeToCustomerDirectory(callback) {
  if (typeof window === 'undefined') return () => {}
  const onChange = () => callback()
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
