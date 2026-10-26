import { getSession, getKnownStaffAccounts } from './mockAuth'
import { getDepartments, setDepartmentManagerReference } from './departmentData'
import { canAccessDepartment, hasPermission } from './rolePermissions'
import { recordRoleAuditEvent } from './roleAudit'

const STORAGE_KEY = 'emple_staff_users_v1'
const CHANGE_EVENT = 'emple:staff-users-updated'
const USER_FIELDS = new Set([
  'id', 'firstName', 'lastName', 'email', 'phone', 'employeeId',
  'role', 'departmentId', 'status', 'createdAt', 'updatedAt', 'createdBy', 'authManaged',
])

export const STAFF_ROLES = [
  { value: 'superadmin', label: 'Superadmin' },
  { value: 'department_manager', label: 'Department Manager' },
  { value: 'department_staff', label: 'Department Staff' },
]

const VALID_ROLES = new Set(STAFF_ROLES.map(role => role.value))
const VALID_STATUSES = new Set(['Active', 'Inactive'])

export class UserDataError extends Error {
  constructor(message, fieldErrors = {}, details = {}) {
    super(message)
    this.name = 'UserDataError'
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
    throw new UserDataError('Staff account storage is unavailable in this browser.')
  }
}

function requireSuperadmin() {
  const session = getSession()
  if (!session || session.role !== 'superadmin') {
    throw new UserDataError('Only a signed-in Superadmin can manage staff accounts.')
  }
  return session
}

function requireSuperadminPermission(permissionId) {
  const session = requireSuperadmin()
  if (!hasPermission(session, permissionId)) {
    throw new UserDataError('You do not have permission to perform this staff account action.')
  }
  return session
}

function recordCommittedAuditEvent(event) {
  try {
    recordRoleAuditEvent(event)
  } catch (error) {
    throw new UserDataError(
      'The change was saved, but the administrative history could not be updated.',
      {},
      { saved: true, cause: error },
    )
  }
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLocaleLowerCase()
}

function normalizeEmployeeId(employeeId) {
  return String(employeeId ?? '').trim().toLocaleLowerCase()
}

function persistUsers(users) {
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(users))
  } catch (error) {
    if (error instanceof UserDataError) throw error
    throw new UserDataError('Unable to save staff accounts in this browser.')
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }
}

function createInitialUsers() {
  return getKnownStaffAccounts().map(account => ({
    id: `user-${encodeURIComponent(account.email.toLowerCase())}`,
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email.toLowerCase(),
    phone: '',
    employeeId: '',
    role: account.role,
    departmentId: null,
    status: 'Active',
    createdAt: null,
    updatedAt: null,
    authManaged: true,
  }))
}

function readStoredUsers() {
  let raw
  try {
    raw = getStorage().getItem(STORAGE_KEY)
  } catch (error) {
    if (error instanceof UserDataError) throw error
    throw new UserDataError('Unable to read staff accounts from this browser.')
  }
  if (raw === null) return null

  let records
  try {
    records = JSON.parse(raw)
  } catch {
    throw new UserDataError('Saved staff account data is invalid. Contact support before changing browser data.')
  }
  if (!Array.isArray(records) || records.some(record => (
    !record
    || typeof record.id !== 'string'
    || !record.id.trim()
    || typeof record.firstName !== 'string'
    || !record.firstName.trim()
    || typeof record.lastName !== 'string'
    || !record.lastName.trim()
    || typeof record.email !== 'string'
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email.trim())
    || !VALID_ROLES.has(record.role)
    || !VALID_STATUSES.has(record.status)
    || (record.phone !== undefined && typeof record.phone !== 'string')
    || (record.employeeId !== undefined && typeof record.employeeId !== 'string')
    || (record.departmentId !== undefined && record.departmentId !== null && typeof record.departmentId !== 'string')
    || (record.createdAt !== undefined && record.createdAt !== null && typeof record.createdAt !== 'string')
    || (record.updatedAt !== undefined && record.updatedAt !== null && typeof record.updatedAt !== 'string')
    || (record.createdBy !== undefined && typeof record.createdBy !== 'string')
    || (record.authManaged !== undefined && typeof record.authManaged !== 'boolean')
  ))) {
    throw new UserDataError('Saved staff account data has an invalid format.')
  }
  const ids = new Set()
  const emails = new Set()
  const employeeIds = new Set()
  for (const record of records) {
    const email = normalizeEmail(record.email)
    const employeeId = normalizeEmployeeId(record.employeeId)
    if (ids.has(record.id) || emails.has(email) || (employeeId && employeeIds.has(employeeId))) {
      throw new UserDataError('Saved staff account data contains duplicate account identifiers.')
    }
    ids.add(record.id)
    emails.add(email)
    if (employeeId) employeeIds.add(employeeId)
  }
  const sanitized = records.map(record => Object.fromEntries(
    Object.entries(record).filter(([key]) => USER_FIELDS.has(key)),
  ))
  if (records.some(record => Object.keys(record).some(key => !USER_FIELDS.has(key)))) {
    persistUsers(sanitized)
  }
  return sanitized
}

function getStoredUsers() {
  const stored = readStoredUsers()
  if (stored === null) {
    const initial = createInitialUsers()
    persistUsers(initial)
    return initial
  }

  const users = [...stored]
  let changed = false
  const knownAccounts = createInitialUsers()
  for (const known of knownAccounts) {
    const existing = users.find(user => normalizeEmail(user.email) === normalizeEmail(known.email))
    if (!existing) {
      users.push(known)
      changed = true
    } else if (!existing.authManaged) {
      users[users.indexOf(existing)] = { ...existing, authManaged: true }
      changed = true
    }
  }
  if (changed) persistUsers(users)
  return users
}

function getAccessibleStaffUsers() {
  const users = getStoredUsers()
  const session = getSession()
  if (!session) throw new UserDataError('Sign in before viewing staff accounts.')
  if (session.role === 'superadmin') {
    if (!hasPermission(session, 'users.view')) {
      throw new UserDataError('You do not have permission to view staff accounts.')
    }
    return users
  }

  const currentUser = users.find(user => normalizeEmail(user.email) === normalizeEmail(session.email))
  if (!currentUser || currentUser.status !== 'Active') {
    throw new UserDataError('An active staff account is required to view staff records.')
  }
  const accessUser = getCurrentAccessUser()
  if (hasPermission(accessUser, 'users.view')) {
    if (!accessUser.departmentId || !canAccessDepartment(accessUser, accessUser.departmentId)) {
      throw new UserDataError('A valid department assignment is required to view staff records.')
    }
    return users.filter(user => user.departmentId === accessUser.departmentId)
  }
  return users.filter(user => user.id === currentUser.id)
}

function getCurrentAccessUser() {
  const session = getSession()
  if (!session) return null
  if (session.role === 'superadmin') return session

  const currentUser = getStoredUsers().find(user => normalizeEmail(user.email) === normalizeEmail(session.email))
  if (!currentUser) return { ...session, status: 'Inactive', departmentId: null }
  const sessionRole = session.role === 'staff' ? 'department_staff' : session.role
  return {
    ...session,
    status: currentUser.status,
    departmentId: currentUser.role === sessionRole ? currentUser.departmentId : null,
  }
}

function validateUser(input, users, currentId = null) {
  const firstName = String(input.firstName ?? '').trim()
  const lastName = String(input.lastName ?? '').trim()
  const email = String(input.email ?? '').trim()
  const phone = String(input.phone ?? '').trim()
  const employeeId = String(input.employeeId ?? '').trim()
  const role = input.role
  const departmentId = input.departmentId || null
  const status = input.status
  const errors = {}

  if (!firstName) errors.firstName = 'Enter a first name.'
  if (!lastName) errors.lastName = 'Enter a last name.'
  if (!email) errors.email = 'Enter a work email address.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.'
  }
  if (!VALID_ROLES.has(role)) errors.role = 'Choose a valid staff role.'
  if (!VALID_STATUSES.has(status)) errors.status = 'Choose Active or Inactive.'

  const normalizedEmail = normalizeEmail(email)
  if (users.some(user => (
    user.id !== currentId && normalizeEmail(user.email) === normalizedEmail
  ))) {
    errors.email = 'This work email is already registered.'
  }

  const normalizedEmployeeId = normalizeEmployeeId(employeeId)
  if (normalizedEmployeeId && users.some(user => (
    user.id !== currentId
    && normalizeEmployeeId(user.employeeId) === normalizedEmployeeId
  ))) {
    errors.employeeId = 'This employee ID is already in use.'
  }

  const current = users.find(user => user.id === currentId)
  if (departmentId) {
    let department
    try {
      department = getDepartments().find(record => record.id === departmentId)
    } catch {
      errors.departmentId = 'Departments could not be loaded. Try again before assigning a department.'
    }
    if (!errors.departmentId && !department) {
      errors.departmentId = 'Choose a department that exists.'
    } else if (
      !errors.departmentId
      && department.status !== 'Active'
      && status === 'Active'
      && (current?.departmentId !== departmentId || current?.status !== 'Active')
    ) {
      errors.departmentId = 'An inactive department cannot be assigned to an active or newly assigned account.'
    }
  }

  if (Object.keys(errors).length) {
    throw new UserDataError('Check the highlighted fields and try again.', errors)
  }

  return {
    firstName,
    lastName,
    email,
    phone,
    employeeId,
    role,
    departmentId,
    status,
  }
}

function normalizeImportedRole(role) {
  const normalized = String(role ?? '').trim().toLocaleLowerCase().replace(/[\s-]+/g, '_')
  if (normalized === 'superadmin') return 'superadmin'
  if (normalized === 'department_manager') return 'department_manager'
  if (normalized === 'department_staff') return 'department_staff'
  return String(role ?? '').trim()
}

function normalizeImportedStatus(status) {
  const normalized = String(status ?? '').trim().toLocaleLowerCase()
  if (normalized === 'active') return 'Active'
  if (normalized === 'inactive') return 'Inactive'
  return String(status ?? '').trim()
}

function evaluateStaffImport(records, users, departments) {
  const sources = Array.isArray(records) ? records : []
  const emailCounts = new Map()
  const employeeIdCounts = new Map()
  const existingEmails = new Set(users.map(user => normalizeEmail(user.email)))
  const existingEmployeeIds = new Set(
    users.map(user => normalizeEmployeeId(user.employeeId)).filter(Boolean),
  )

  for (const source of sources) {
    const email = normalizeEmail(source?.email)
    const employeeId = normalizeEmployeeId(source?.employeeId)
    if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1)
    if (employeeId) employeeIdCounts.set(employeeId, (employeeIdCounts.get(employeeId) ?? 0) + 1)
  }

  const roleAssignmentAllowed = hasPermission(getSession(), 'roles.assign')
  const fieldLabels = {
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    phone: 'Phone',
    employeeId: 'Employee ID',
    role: 'Role',
    departmentId: 'Department',
    status: 'Status',
  }

  const evaluated = sources.map((source, index) => {
    const departmentValue = String(source?.department ?? source?.departmentId ?? '').trim()
    const normalizedDepartmentValue = departmentValue.toLocaleLowerCase()
    const department = departmentValue
      ? departments.find(record => (
        record.id === departmentValue
        || String(record.code ?? '').trim().toLocaleLowerCase() === normalizedDepartmentValue
        || normalizeEmail(record.name) === normalizeEmail(departmentValue)
      ))
      : null
    const input = {
      firstName: source?.firstName,
      lastName: source?.lastName,
      email: source?.email,
      phone: source?.phone,
      employeeId: source?.employeeId,
      role: normalizeImportedRole(source?.role),
      departmentId: department?.id ?? null,
      status: normalizeImportedStatus(source?.status),
    }
    const fieldErrors = {}
    if (departmentValue && !department) {
      fieldErrors.departmentId = 'Use a registered department name or code.'
    }

    let values = null
    try {
      values = validateUser(input, users)
    } catch (error) {
      if (!(error instanceof UserDataError)) throw error
      Object.assign(fieldErrors, error.fieldErrors)
    }

    if (input.role !== 'department_staff' && !roleAssignmentAllowed) {
      fieldErrors.role = 'You do not have permission to assign this role.'
    }

    const email = normalizeEmail(input.email)
    const employeeId = normalizeEmployeeId(input.employeeId)
    const duplicate = Boolean(
      (email && (existingEmails.has(email) || emailCounts.get(email) > 1))
      || (employeeId && (existingEmployeeIds.has(employeeId) || employeeIdCounts.get(employeeId) > 1)),
    )
    if (email && emailCounts.get(email) > 1) {
      fieldErrors.email = 'This email appears more than once in the upload.'
    }
    if (employeeId && employeeIdCounts.get(employeeId) > 1) {
      fieldErrors.employeeId = 'This employee ID appears more than once in the upload.'
    }
    if (email && existingEmails.has(email)) {
      fieldErrors.email = 'This work email is already registered.'
    }
    if (employeeId && existingEmployeeIds.has(employeeId)) {
      fieldErrors.employeeId = 'This employee ID is already in use.'
    }

    const errors = Object.entries(fieldErrors)
      .map(([field, message]) => `${fieldLabels[field] ?? field}: ${message}`)
    const status = duplicate ? 'duplicate' : errors.length ? 'invalid' : 'valid'
    return {
      rowNumber: Number.isInteger(source?.rowNumber) ? source.rowNumber : index + 2,
      fields: {
        firstName: String(source?.firstName ?? '').trim(),
        lastName: String(source?.lastName ?? '').trim(),
        email: String(source?.email ?? '').trim(),
        phone: String(source?.phone ?? '').trim(),
        employeeId: String(source?.employeeId ?? '').trim(),
        department: departmentValue,
        role: String(source?.role ?? '').trim(),
        status: String(source?.status ?? '').trim(),
      },
      status,
      errors,
      values: status === 'valid' ? values : null,
    }
  })

  return {
    records: evaluated,
    total: evaluated.length,
    valid: evaluated.filter(record => record.status === 'valid').length,
    invalid: evaluated.filter(record => record.status === 'invalid').length,
    duplicates: evaluated.filter(record => record.status === 'duplicate').length,
  }
}

function getManagerChanges(user, values) {
  if (!user) return []
  const losesManagerEligibility = (
    values.role !== 'department_manager'
    || values.status !== 'Active'
  )
  const leavesDepartment = values.departmentId !== user.departmentId
  if (!losesManagerEligibility && !leavesDepartment) return []
  return getDepartments().filter(department => department.managerId === user.id)
}

function assertActiveSuperadminRemains(users) {
  if (!users.some(user => (
    user.role === 'superadmin'
    && user.status === 'Active'
    && user.authManaged
  ))) {
    throw new UserDataError('The existing active Superadmin sign-in account must remain available.')
  }
}

function createUserId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new UserDataError('This browser cannot generate a unique staff account ID.')
  }
  return `user-${globalThis.crypto.randomUUID()}`
}

function writeUserUpdate(existingUsers, nextUsers, affectedDepartments = []) {
  persistUsers(nextUsers)
  const changedDepartments = []
  try {
    for (const department of affectedDepartments) {
      setDepartmentManagerReference(department.id, null)
      changedDepartments.push(department)
    }
  } catch (error) {
    let rollbackError = null
    try {
      persistUsers(existingUsers)
    } catch (restoreError) {
      rollbackError = restoreError
    }
    for (const department of changedDepartments.reverse()) {
      try {
        setDepartmentManagerReference(department.id, department.managerId)
      } catch (restoreError) {
        if (!rollbackError) rollbackError = restoreError
      }
    }
    throw new UserDataError(
      rollbackError
        ? 'The staff account update failed and browser storage could not fully restore the previous assignments.'
        : 'The staff account could not be fully updated because a department assignment failed.',
      {},
      { cause: error, rollbackError },
    )
  }
}

export function getStaffUsers() {
  return getAccessibleStaffUsers().map(user => ({ ...user }))
}

export function getStaffUserById(id) {
  return getStaffUsers().find(user => user.id === id) ?? null
}

export function getStaffUserByEmail(email) {
  const normalized = normalizeEmail(email)
  return getStaffUsers().find(user => normalizeEmail(user.email) === normalized) ?? null
}

export function getStaffSummary(users = getStaffUsers(), departments = getDepartments()) {
  const departmentsById = new Set(departments.map(department => department.id))
  return {
    total: users.length,
    active: users.filter(user => user.status === 'Active').length,
    inactive: users.filter(user => user.status === 'Inactive').length,
    managers: users.filter(user => user.role === 'department_manager').length,
    unassigned: users.filter(user => !user.departmentId || !departmentsById.has(user.departmentId)).length,
  }
}

export function filterStaffUsers(users, query = '', filters = {}) {
  const search = query.trim().toLocaleLowerCase()
  const validDepartmentIds = filters.validDepartmentIds
    ? new Set(filters.validDepartmentIds)
    : null
  return users.filter(user => {
    const fullName = `${user.firstName} ${user.lastName}`.toLocaleLowerCase()
    const matchesSearch = !search
      || user.firstName.toLocaleLowerCase().includes(search)
      || user.lastName.toLocaleLowerCase().includes(search)
      || fullName.includes(search)
      || user.email.toLocaleLowerCase().includes(search)
      || String(user.employeeId ?? '').toLocaleLowerCase().includes(search)
    const matchesStatus = !filters.status || user.status === filters.status
    const matchesRole = !filters.role || user.role === filters.role
    const hasValidDepartment = Boolean(user.departmentId)
      && (!validDepartmentIds || validDepartmentIds.has(user.departmentId))
    const matchesDepartment = !filters.departmentId
      || (filters.departmentId === 'unassigned' && !hasValidDepartment)
      || (filters.departmentId === 'assigned' && hasValidDepartment)
      || (!['unassigned', 'assigned'].includes(filters.departmentId)
        && user.departmentId === filters.departmentId)
    return matchesSearch && matchesStatus && matchesRole && matchesDepartment
  })
}

export function getManagedDepartments(userId) {
  requireSuperadminPermission('departments.view')
  return getDepartments().filter(department => department.managerId === userId)
}

export function getDepartmentManagerAssignmentImpact(departmentId, managerId) {
  requireSuperadminPermission('departments.assign_managers')
  const departments = getDepartments()
  const target = departments.find(department => department.id === departmentId)
  const user = managerId ? getStaffUserById(managerId) : null
  const currentAssignment = user?.departmentId
    ? departments.find(department => department.id === user.departmentId)
    : null
  const managedElsewhere = managerId
    ? departments.filter(department => department.managerId === managerId && department.id !== departmentId)
    : []
  const existingManager = target?.managerId && target.managerId !== managerId
    ? getStaffUserById(target.managerId)
    : null
  return { currentAssignment, managedElsewhere, existingManager }
}

export function getDepartmentManagerName(managerId) {
  const user = managerId ? getStaffUserById(managerId) : null
  return user ? `${user.firstName} ${user.lastName}`.trim() : null
}

export function getDepartmentStaffMembers(departmentId) {
  const accessUser = getCurrentAccessUser()
  if (!hasPermission(accessUser, 'users.view') || !canAccessDepartment(accessUser, departmentId)) {
    throw new UserDataError('You do not have access to staff in this department.')
  }
  return getStaffUsers()
    .filter(user => user.departmentId === departmentId)
    .map(user => ({ id: user.id, name: `${user.firstName} ${user.lastName}`.trim(), role: user.role, status: user.status }))
}

export function getDepartmentStaffUsers(departmentId) {
  const accessUser = getCurrentAccessUser()
  if (!hasPermission(accessUser, 'users.view') || !canAccessDepartment(accessUser, departmentId)) {
    throw new UserDataError('You do not have access to staff in this department.')
  }
  return getStaffUsers().filter(record => record.departmentId === departmentId)
}

export function getEligibleDepartmentManagers() {
  requireSuperadminPermission('departments.assign_managers')
  return getStaffUsers()
    .filter(user => user.role === 'department_manager' && user.status === 'Active')
    .map(user => ({ id: user.id, name: `${user.firstName} ${user.lastName}`.trim() }))
}

export function getManagerAssignmentChanges(userId, input) {
  requireSuperadminPermission('users.edit')
  const users = getStoredUsers()
  const user = users.find(record => record.id === userId)
  const values = validateUser(input, users, userId)
  return getManagerChanges(user, values)
}

export function previewStaffUserImport(records) {
  requireSuperadminPermission('users.create')
  if (!Array.isArray(records) || records.length === 0) {
    throw new UserDataError('The upload contains no staff records to review.')
  }
  return evaluateStaffImport(records, getStoredUsers(), getDepartments())
}

export function createStaffUsersBatch(records, { confirmedRoleAssignment = false } = {}) {
  const session = requireSuperadminPermission('users.create')
  if (!Array.isArray(records) || records.length === 0) {
    throw new UserDataError('There are no valid staff records to import.')
  }

  const evaluated = evaluateStaffImport(records, getStoredUsers(), getDepartments())
  if (evaluated.valid !== evaluated.total) {
    throw new UserDataError(
      'Staff records changed since preview. Review the updated validation results before importing.',
      {},
      { records: evaluated.records },
    )
  }
  if (
    evaluated.records.some(record => record.values.role !== 'department_staff')
    && !confirmedRoleAssignment
  ) {
    throw new UserDataError('Confirm the staff role assignment before importing.')
  }

  const now = new Date().toISOString()
  const users = evaluated.records.map(record => ({
    id: createUserId(),
    ...record.values,
    createdAt: now,
    updatedAt: now,
    createdBy: session.email,
    authManaged: false,
  }))
  const existingUsers = getStoredUsers()
  const nextUsers = [...existingUsers, ...users]
  assertActiveSuperadminRemains(nextUsers)
  persistUsers(nextUsers)

  try {
    for (const user of users) {
      const targetName = `${user.firstName} ${user.lastName}`.trim()
      recordCommittedAuditEvent({
        action: 'Staff account created',
        targetType: 'user',
        targetId: user.id,
        targetName,
        details: `Role: ${user.role}; department: ${user.departmentId ?? 'Unassigned'}`,
      })
      recordCommittedAuditEvent({
        action: 'Staff role assigned',
        targetType: 'user',
        targetId: user.id,
        targetName,
        details: `Role assigned: ${user.role}`,
      })
      if (user.departmentId) {
        recordCommittedAuditEvent({
          action: 'Department access changed',
          targetType: 'user',
          targetId: user.id,
          targetName,
          details: `Department assigned: ${user.departmentId}`,
        })
      }
    }
  } catch (error) {
    throw new UserDataError(
      error.message || 'Staff records were saved, but administrative history could not be updated.',
      {},
      { saved: true, importedCount: users.length, cause: error },
    )
  }

  return { imported: users.length, users: users.map(user => ({ ...user })) }
}

export function createStaffUser(input, { confirmedRoleChange = false } = {}) {
  const session = requireSuperadminPermission('users.create')
  const users = getStoredUsers()
  const values = validateUser(input, users)
  if (values.role !== 'department_staff') {
    requireSuperadminPermission('roles.assign')
  }
  if (values.role === 'superadmin' && !confirmedRoleChange) {
    throw new UserDataError('Confirm this privileged Superadmin role assignment.', {}, { confirmedRoleChange: true })
  }
  const now = new Date().toISOString()
  const user = {
    id: createUserId(),
    ...values,
    createdAt: now,
    updatedAt: now,
    createdBy: session.email,
    authManaged: false,
  }
  const nextUsers = [...users, user]
  assertActiveSuperadminRemains(nextUsers)
  persistUsers(nextUsers)
  recordCommittedAuditEvent({
    action: 'Staff account created',
    targetType: 'user',
    targetId: user.id,
    targetName: `${user.firstName} ${user.lastName}`.trim(),
    details: `Role: ${user.role}; department: ${user.departmentId ?? 'Unassigned'}`,
  })
  recordCommittedAuditEvent({
    action: 'Staff role assigned',
    targetType: 'user',
    targetId: user.id,
    targetName: `${user.firstName} ${user.lastName}`.trim(),
    details: `Role assigned: ${user.role}`,
  })
  if (user.departmentId) {
    recordCommittedAuditEvent({
      action: 'Department access changed',
      targetType: 'user',
      targetId: user.id,
      targetName: `${user.firstName} ${user.lastName}`.trim(),
      details: `Department assigned: ${user.departmentId}`,
    })
  }
  return { ...user }
}

export function updateStaffUser(id, input, {
  confirmManagerChanges = false,
  confirmedRoleChange = false,
} = {}) {
  const session = requireSuperadminPermission('users.edit')
  const users = getStoredUsers()
  const existing = users.find(user => user.id === id)
  if (!existing) throw new UserDataError('This staff account no longer exists.')

  const values = validateUser(input, users, id)
  if (values.role !== existing.role) {
    requireSuperadminPermission('roles.assign')
    if (!confirmedRoleChange) {
      throw new UserDataError('Confirm this staff role assignment change.', {}, { confirmedRoleChange: true })
    }
  }
  if (existing.authManaged && normalizeEmail(values.email) !== normalizeEmail(existing.email)) {
    throw new UserDataError('This account email is managed by the existing sign-in configuration.', {
      email: 'Change this email through the secure account service.',
    })
  }
  if (existing.authManaged && values.role !== existing.role) {
    throw new UserDataError('This account role is managed by the existing sign-in configuration.', {
      role: 'Change this role through the secure account service.',
    })
  }
  if (session.email.toLowerCase() === existing.email.toLowerCase() && values.role !== 'superadmin') {
    throw new UserDataError('You cannot change your own Superadmin role while signed in.')
  }
  const affectedDepartments = getManagerChanges(existing, values)
  if (affectedDepartments.length && !confirmManagerChanges) {
    throw new UserDataError(
      'This change affects department manager assignments and needs confirmation.',
      {},
      { affectedDepartments },
    )
  }
  const next = { ...existing, ...values, updatedAt: new Date().toISOString() }
  const nextUsers = users.map(user => user.id === id ? next : user)
  assertActiveSuperadminRemains(nextUsers)
  writeUserUpdate(users, nextUsers, affectedDepartments)
  const name = `${next.firstName} ${next.lastName}`.trim()
  if (values.role !== existing.role) {
    recordCommittedAuditEvent({
      action: 'Staff role assigned',
      targetType: 'user',
      targetId: id,
      targetName: name,
      details: `Role: ${existing.role} to ${next.role}`,
    })
  }
  if (values.departmentId !== existing.departmentId) {
    recordCommittedAuditEvent({
      action: 'Department access changed',
      targetType: 'user',
      targetId: id,
      targetName: name,
      details: `Department: ${existing.departmentId ?? 'Unassigned'} to ${next.departmentId ?? 'Unassigned'}`,
    })
  }
  return { ...next }
}

export function setStaffUserStatus(id, status, { confirmManagerChanges = false } = {}) {
  const session = requireSuperadminPermission(status === 'Inactive' ? 'users.deactivate' : 'users.activate')
  const users = getStoredUsers()
  const existing = users.find(user => user.id === id)
  if (!existing) throw new UserDataError('This staff account no longer exists.')
  if (!VALID_STATUSES.has(status)) throw new UserDataError('Choose Active or Inactive.')
  if (session.email.toLowerCase() === existing.email.toLowerCase() && status === 'Inactive') {
    throw new UserDataError('You cannot deactivate your own account while signed in.')
  }

  const values = validateUser({ ...existing, status }, users, id)
  const next = { ...existing, ...values, updatedAt: new Date().toISOString() }
  const affectedDepartments = getManagerChanges(existing, next)
  if (affectedDepartments.length && !confirmManagerChanges) {
    throw new UserDataError(
      'Deactivating this manager affects department assignments and needs confirmation.',
      {},
      { affectedDepartments },
    )
  }
  const nextUsers = users.map(user => user.id === id ? next : user)
  assertActiveSuperadminRemains(nextUsers)
  writeUserUpdate(users, nextUsers, affectedDepartments)
  recordCommittedAuditEvent({
    action: 'Staff account status changed',
    targetType: 'user',
    targetId: id,
    targetName: `${next.firstName} ${next.lastName}`.trim(),
    details: `Status: ${existing.status} to ${next.status}`,
  })
  return { ...next }
}

export function assignDepartmentManager(departmentId, managerId, { confirmedTransfer = false } = {}) {
  requireSuperadminPermission('departments.assign_managers')
  const departments = getDepartments()
  const department = departments.find(record => record.id === departmentId)
  if (!department) throw new UserDataError('This department no longer exists.')
  if (managerId === null || managerId === '') {
    setDepartmentManagerReference(departmentId, null)
    recordCommittedAuditEvent({
      action: 'Department manager assignment changed',
      targetType: 'department',
      targetId: departmentId,
      targetName: department.name,
      details: 'Manager unassigned',
    })
    return null
  }
  if (department.status !== 'Active') {
    throw new UserDataError('A manager can only be assigned to an active department.')
  }

  const users = getStoredUsers()
  const manager = users.find(user => user.id === managerId)
  if (!manager || manager.role !== 'department_manager' || manager.status !== 'Active') {
    throw new UserDataError('Choose an active Department Manager account.')
  }

  const impact = getDepartmentManagerAssignmentImpact(departmentId, managerId)
  const movingFromAnotherDepartment = impact.currentAssignment
    && impact.currentAssignment.id !== departmentId
  const managedElsewhere = impact.managedElsewhere.length > 0
  const replacingManager = impact.existingManager
  if ((movingFromAnotherDepartment || managedElsewhere || replacingManager) && !confirmedTransfer) {
    throw new UserDataError('Confirm the department manager assignment change.', {}, { impact })
  }

  const previousUsers = users
  const nextManager = { ...manager, departmentId, updatedAt: new Date().toISOString() }
  const nextUsers = users.map(user => user.id === manager.id ? nextManager : user)
  const departmentsToClear = impact.managedElsewhere
  const changedDepartments = []
  persistUsers(nextUsers)
  try {
    for (const previous of departmentsToClear) {
      setDepartmentManagerReference(previous.id, null)
      changedDepartments.push(previous)
    }
    setDepartmentManagerReference(departmentId, managerId)
  } catch (error) {
    let rollbackError = null
    try {
      persistUsers(previousUsers)
    } catch (restoreError) {
      rollbackError = restoreError
    }
    for (const previous of changedDepartments.reverse()) {
      try {
        setDepartmentManagerReference(previous.id, previous.managerId)
      } catch (restoreError) {
        if (!rollbackError) rollbackError = restoreError
      }
    }
    throw new UserDataError(
      rollbackError
        ? 'The manager assignment failed and browser storage could not fully restore the previous assignments.'
        : 'The manager assignment could not be fully saved.',
      {},
      { cause: error, rollbackError },
    )
  }
  recordCommittedAuditEvent({
    action: 'Department manager assignment changed',
    targetType: 'department',
    targetId: departmentId,
    targetName: department.name,
    details: manager
      ? `Manager assigned: ${manager.firstName} ${manager.lastName}`.trim()
      : 'Manager unassigned',
  })
  return { ...nextManager }
}

export function subscribeToStaffUsers(callback) {
  if (typeof window === 'undefined') return () => {}
  const onChange = () => {
    try {
      callback(getStaffUsers(), null)
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
