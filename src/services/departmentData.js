import { hasPermission } from './rolePermissions'
import { getSession } from './mockAuth'
import { recordRoleAuditEvent } from './roleAudit'

const STORAGE_KEY = 'emple_departments_v1'
const CHANGE_EVENT = 'emple:departments-updated'

const INITIAL_DEPARTMENTS = [
  { id: 'dept-life', name: 'Life', code: 'LIFE', seedKey: 'life' },
  { id: 'dept-health', name: 'Health', code: 'HEALTH', seedKey: 'health' },
  { id: 'dept-pensions', name: 'Pensions', code: 'PENSIONS', seedKey: 'pensions' },
  { id: 'dept-hr', name: 'HR', code: 'HR', seedKey: 'hr' },
  { id: 'dept-audit', name: 'Audit', code: 'AUDIT', seedKey: 'audit' },
  { id: 'dept-media', name: 'Media', code: 'MEDIA', seedKey: 'media' },
  { id: 'dept-it', name: 'IT', code: 'IT', seedKey: 'it' },
].map(department => ({
  ...department,
  description: '',
  managerId: null,
  status: 'Active',
  createdAt: null,
  updatedAt: null,
}))

export class DepartmentDataError extends Error {
  constructor(message, fieldErrors = {}, details = {}) {
    super(message)
    this.name = 'DepartmentDataError'
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
    throw new DepartmentDataError('Department storage is unavailable in this browser.')
  }
}

function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase()
}

function normalizeName(name) {
  return String(name ?? '').trim().toLocaleLowerCase()
}

function persist(departments) {
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(departments))
  } catch (error) {
    if (error instanceof DepartmentDataError) throw error
    throw new DepartmentDataError('Unable to save departments in this browser.')
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }
}

function recordDepartmentAudit(event) {
  try {
    recordRoleAuditEvent(event)
  } catch (error) {
    throw new DepartmentDataError(
      'The department change was saved, but administrative history could not be updated.',
      {},
      { saved: true, cause: error },
    )
  }
}

function readStoredDepartments() {
  let raw
  try {
    raw = getStorage().getItem(STORAGE_KEY)
  } catch (error) {
    if (error instanceof DepartmentDataError) throw error
    throw new DepartmentDataError('Unable to read departments from this browser.')
  }

  if (raw === null) return null

  let records
  try {
    records = JSON.parse(raw)
  } catch {
    throw new DepartmentDataError('Saved department data is invalid. Clear the browser data or contact support.')
  }
  if (!Array.isArray(records) || records.some(record => (
    !record || typeof record.id !== 'string' || typeof record.name !== 'string'
  ))) {
    throw new DepartmentDataError('Saved department data has an invalid format.')
  }
  return records
}

function ensureInitialDepartments(records) {
  const departments = [...records]
  let changed = false

  for (const initial of INITIAL_DEPARTMENTS) {
    const exists = departments.some(department => (
      department.seedKey === initial.seedKey
      || normalizeCode(department.code) === initial.code
      || normalizeName(department.name) === normalizeName(initial.name)
    ))
    if (!exists) {
      departments.push({ ...initial })
      changed = true
    }
  }

  return { departments, changed }
}

function getStoredDepartments() {
  const stored = readStoredDepartments()
  if (stored === null) {
    const initial = INITIAL_DEPARTMENTS.map(department => ({ ...department }))
    persist(initial)
    return initial
  }

  const result = ensureInitialDepartments(stored)
  if (result.changed) persist(result.departments)
  return result.departments
}

function validateDepartment(input, departments, currentId = null) {
  const name = String(input.name ?? '').trim()
  const code = normalizeCode(input.code)
  const description = String(input.description ?? '').trim()
  const managerId = input.managerId || null
  const status = input.status
  const fieldErrors = {}

  if (!name) fieldErrors.name = 'Enter a department name.'
  if (!code) fieldErrors.code = 'Enter a department code.'
  if (!['Active', 'Inactive'].includes(status)) {
    fieldErrors.status = 'Choose Active or Inactive.'
  }
  if (departments.some(department => (
    department.id !== currentId && normalizeCode(department.code) === code
  ))) {
    fieldErrors.code = 'That department code is already in use.'
  }

  const current = departments.find(department => department.id === currentId)
  if (managerId !== (current?.managerId ?? null)) {
    fieldErrors.managerId = 'Assign department managers from an eligible staff account.'
  }

  if (Object.keys(fieldErrors).length) {
    throw new DepartmentDataError('Check the highlighted fields and try again.', fieldErrors)
  }
  return { name, code, description, managerId, status }
}

function createId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new DepartmentDataError('This browser cannot generate a secure department ID.')
  }
  return `dept-${globalThis.crypto.randomUUID()}`
}

export function getDepartments() {
  return getStoredDepartments().map(department => ({ ...department }))
}

export function getDepartmentById(id) {
  return getDepartments().find(department => department.id === id) ?? null
}

export function createDepartment(input) {
  if (!hasPermission(getSession(), 'departments.create')) {
    throw new DepartmentDataError('You do not have permission to create departments.')
  }
  const departments = getStoredDepartments()
  const values = validateDepartment(input, departments)
  const now = new Date().toISOString()
  const department = {
    id: createId(),
    ...values,
    createdAt: now,
    updatedAt: now,
  }
  persist([...departments, department])
  recordDepartmentAudit({
    action: 'Department created',
    targetType: 'department',
    targetId: department.id,
    targetName: department.name,
    details: `Created by ${getSession()?.email ?? 'an administrator'}.`,
  })
  return { ...department }
}

export function updateDepartment(id, input) {
  const current = getDepartmentById(id)
  if (!current) throw new DepartmentDataError('This department no longer exists.')
  if (!hasPermission(getSession(), 'departments.edit')) {
    throw new DepartmentDataError('You do not have permission to edit departments.')
  }
  if (input.status !== current.status && !hasPermission(getSession(), 'departments.deactivate')) {
    throw new DepartmentDataError('You do not have permission to change department status.')
  }
  const departments = getStoredDepartments()
  const existing = departments.find(department => department.id === id)
  if (!existing) throw new DepartmentDataError('This department no longer exists.')

  const values = validateDepartment(input, departments, id)
  const changed = Object.keys(values).some(key => values[key] !== existing[key])
  if (!changed) return { ...existing }

  const next = { ...existing, ...values, updatedAt: new Date().toISOString() }
  persist(departments.map(department => department.id === id ? next : department))
  const changedFields = Object.keys(values).filter(key => values[key] !== existing[key])
  recordDepartmentAudit({
    action: changedFields.includes('status')
      ? `Department ${next.status === 'Active' ? 'activated' : 'deactivated'}`
      : 'Department updated',
    targetType: 'department',
    targetId: next.id,
    targetName: next.name,
    details: `Updated by ${getSession()?.email ?? 'an administrator'}; changed fields: ${changedFields.join(', ')}.`,
  })
  return { ...next }
}

export function setDepartmentManagerReference(id, managerId) {
  if (!hasPermission(getSession(), 'departments.assign_managers')) {
    throw new DepartmentDataError('You do not have permission to assign department managers.')
  }
  const departments = getStoredDepartments()
  const current = departments.find(department => department.id === id)
  if (!current) throw new DepartmentDataError('This department no longer exists.')
  if (managerId !== null && typeof managerId !== 'string') {
    throw new DepartmentDataError('The department manager reference is invalid.')
  }
  if (current.managerId === managerId) return { ...current }

  const next = { ...current, managerId, updatedAt: new Date().toISOString() }
  persist(departments.map(department => department.id === id ? next : department))
  return { ...next }
}

export function getDepartmentSummary(departments = getDepartments()) {
  return {
    total: departments.length,
    active: departments.filter(department => department.status === 'Active').length,
    inactive: departments.filter(department => department.status === 'Inactive').length,
    withoutManagers: departments.filter(department => !department.managerId).length,
  }
}

export function filterDepartments(departments, query = '', filter = 'all') {
  const search = query.trim().toLocaleLowerCase()
  return departments.filter(department => {
    const matchesSearch = !search
      || department.name.toLocaleLowerCase().includes(search)
      || String(department.code ?? '').toLocaleLowerCase().includes(search)
    const matchesFilter = (
      filter === 'all'
      || (filter === 'active' && department.status === 'Active')
      || (filter === 'inactive' && department.status === 'Inactive')
      || (filter === 'manager-assigned' && Boolean(department.managerId))
      || (filter === 'manager-unassigned' && !department.managerId)
    )
    return matchesSearch && matchesFilter
  })
}

export function subscribeToDepartments(callback) {
  if (typeof window === 'undefined') return () => {}
  const onChange = () => {
    try {
      callback(getDepartments(), null)
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
