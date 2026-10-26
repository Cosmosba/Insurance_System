import { getSession } from './mockAuth'

const STORAGE_KEY = 'emple_role_audit_v1'
const CHANGE_EVENT = 'emple:role-audit-updated'
const MAX_EVENTS = 100

export class RoleAuditError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RoleAuditError'
  }
}

function getEventModule({ action, targetType }) {
  const normalizedAction = action.toLocaleLowerCase()
  const normalizedTarget = targetType.toLocaleLowerCase()
  if (
    normalizedTarget.includes('role')
    || normalizedTarget.includes('permission')
    || normalizedAction.includes('role')
    || normalizedAction.includes('permission')
    || normalizedAction.includes('security')
  ) {
    return 'Security & Permissions'
  }
  if (normalizedAction.includes('department access')) return 'Security & Permissions'
  if (normalizedTarget === 'department' || normalizedAction.includes('department')) return 'Departments'
  if (normalizedTarget === 'customer') return 'Customer Management'
  if (normalizedTarget === 'user') return 'User Management'
  return normalizedTarget
    ? normalizedTarget.replace(/(^\w|\s\w)/g, value => value.toLocaleUpperCase())
    : 'Other'
}

function getStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('Browser storage is unavailable.')
    }
    return window.localStorage
  } catch {
    throw new RoleAuditError('Administrative history storage is unavailable.')
  }
}

export function getRoleAuditEvents() {
  let raw
  try {
    raw = getStorage().getItem(STORAGE_KEY)
  } catch (error) {
    if (error instanceof RoleAuditError) throw error
    throw new RoleAuditError('Unable to read administrative history.')
  }
  if (raw === null) return []

  let events
  try {
    events = JSON.parse(raw)
  } catch {
    throw new RoleAuditError('Saved administrative history is invalid.')
  }
  if (!Array.isArray(events) || events.some(event => (
    !event
    || typeof event.id !== 'string'
    || typeof event.action !== 'string'
    || typeof event.targetType !== 'string'
    || typeof event.targetId !== 'string'
    || typeof event.targetName !== 'string'
    || typeof event.timestamp !== 'string'
    || (event.actor !== null && typeof event.actor !== 'string')
    || (event.details !== undefined && typeof event.details !== 'string')
    || (event.module !== undefined && typeof event.module !== 'string')
    || (event.status !== undefined && event.status !== null && typeof event.status !== 'string')
  ))) {
    throw new RoleAuditError('Saved administrative history has an invalid format.')
  }
  return events.slice(0, MAX_EVENTS).map(event => ({ ...event }))
}

export function recordRoleAuditEvent({ action, targetType, targetId, targetName, details = '', module, status = null }) {
  if (
    typeof action !== 'string' || !action.trim()
    || typeof targetType !== 'string' || !targetType.trim()
    || typeof targetId !== 'string' || !targetId.trim()
    || typeof targetName !== 'string' || !targetName.trim()
    || typeof details !== 'string'
    || (module !== undefined && (typeof module !== 'string' || !module.trim()))
    || (status !== null && typeof status !== 'string')
  ) {
    throw new RoleAuditError('Administrative history event is invalid.')
  }

  const session = getSession()
  const event = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    action: action.trim(),
    targetType: targetType.trim(),
    targetId: targetId.trim(),
    targetName: targetName.trim(),
    module: typeof module === 'string' ? module.trim() : getEventModule({ action, targetType }),
    status,
    timestamp: new Date().toISOString(),
    actor: typeof session?.email === 'string' ? session.email : null,
    details: details.trim(),
  }
  let events
  try {
    events = getRoleAuditEvents()
    getStorage().setItem(STORAGE_KEY, JSON.stringify([event, ...events].slice(0, MAX_EVENTS)))
  } catch (error) {
    if (error instanceof RoleAuditError) throw error
    throw new RoleAuditError('Unable to record this administrative change.')
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
  return { ...event }
}

export function subscribeToRoleAuditEvents(callback) {
  if (typeof window === 'undefined') return () => {}
  const onChange = () => {
    try {
      callback(getRoleAuditEvents(), null)
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
