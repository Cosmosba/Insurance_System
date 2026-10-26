import { getSession } from './mockAuth'
import { hasPermission } from './rolePermissions'
import { getRoleAuditEvents } from './roleAudit'

const SENSITIVE_DETAIL_PATTERN = /\b(password|passphrase|token|secret|credential|authorization)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi

function requireActivityAccess() {
  const session = getSession()
  if (
    !session
    || session.role !== 'superadmin'
    || !hasPermission(session, 'activity.view')
  ) {
    throw new Error('Only an authorised Superadmin can view system activity.')
  }
}

function getActivityModule(event) {
  const action = event.action.toLocaleLowerCase()
  const targetType = event.targetType.toLocaleLowerCase()

  if (targetType.includes('role') || targetType.includes('permission')) {
    return 'Security & Permissions'
  }
  if (action.includes('role') || action.includes('permission') || action.includes('security')) {
    return 'Security & Permissions'
  }
  if (action.includes('department access')) return 'Security & Permissions'
  if (targetType === 'department' || action.includes('department')) {
    return 'Departments'
  }
  if (targetType === 'customer') return 'Customer Management'
  if (targetType === 'user') return 'User Management'
  return targetType ? targetType.replace(/(^\w|\s\w)/g, value => value.toLocaleUpperCase()) : 'Other'
}

function getActivityCategory(event, module) {
  if (module === 'Security & Permissions') return module
  if (module === 'User Management') return module
  if (module === 'Customer Management') return module
  if (module === 'Departments') return module
  return 'Other'
}

function getSafeDetails(details) {
  return typeof details === 'string'
    ? details.replace(SENSITIVE_DETAIL_PATTERN, '$1: [redacted]')
    : ''
}

function toActivityRecord(event) {
  const module = typeof event.module === 'string' && event.module.trim()
    ? event.module
    : getActivityModule(event)
  const timestamp = Number.isNaN(Date.parse(event.timestamp)) ? null : event.timestamp

  return {
    id: event.id,
    timestamp,
    actor: typeof event.actor === 'string' && event.actor.trim() ? event.actor : null,
    action: event.action,
    module,
    category: getActivityCategory(event, module),
    targetType: event.targetType,
    targetId: event.targetId,
    targetName: event.targetName,
    status: typeof event.status === 'string' && event.status.trim() ? event.status : null,
    details: getSafeDetails(event.details),
  }
}

export function getSystemActivity() {
  requireActivityAccess()
  return getRoleAuditEvents().map(toActivityRecord)
}

function getLocalDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function filterSystemActivity(events, filters = {}) {
  const query = String(filters.query ?? '').trim().toLocaleLowerCase()
  const startDate = String(filters.startDate ?? '')
  const endDate = String(filters.endDate ?? '')
  const status = filters.status ?? 'all'

  return events.filter(event => {
    const searchable = [
      event.actor,
      event.action,
      event.module,
      event.category,
      event.targetType,
      event.targetId,
      event.targetName,
      event.details,
    ].filter(Boolean).join(' ').toLocaleLowerCase()
    if (query && !searchable.includes(query)) return false
    if (filters.module && filters.module !== 'all' && event.module !== filters.module) return false
    if (filters.category && filters.category !== 'all' && event.category !== filters.category) return false
    if (status !== 'all' && (event.status ?? 'not-recorded') !== status) return false
    if (startDate || endDate) {
      const eventDate = event.timestamp ? getLocalDateKey(event.timestamp) : ''
      if (!eventDate || (startDate && eventDate < startDate) || (endDate && eventDate > endDate)) {
        return false
      }
    }
    return true
  })
}

export function sortSystemActivity(events, direction = 'desc') {
  const factor = direction === 'asc' ? 1 : -1
  return [...events].sort((first, second) => {
    const firstTime = first.timestamp ? Date.parse(first.timestamp) : 0
    const secondTime = second.timestamp ? Date.parse(second.timestamp) : 0
    return (firstTime - secondTime) * factor
  })
}

export function getSystemActivitySummary(events, now = new Date()) {
  const today = getLocalDateKey(now)
  return {
    total: events.length,
    today: events.filter(event => event.timestamp && getLocalDateKey(event.timestamp) === today).length,
    userManagement: events.filter(event => event.category === 'User Management').length,
    security: events.filter(event => event.category === 'Security & Permissions').length,
  }
}

function escapeCsvValue(value) {
  let text = String(value ?? '')
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function exportSystemActivityCsv(events) {
  const columns = [
    ['Event ID', event => event.id],
    ['Timestamp', event => event.timestamp ?? ''],
    ['Actor', event => event.actor ?? 'Not recorded'],
    ['Action', event => event.action],
    ['Module', event => event.module],
    ['Target type', event => event.targetType],
    ['Target ID', event => event.targetId],
    ['Target name', event => event.targetName],
    ['Status', event => event.status ?? 'Not recorded'],
    ['Details', event => event.details],
  ]
  return [
    columns.map(([header]) => escapeCsvValue(header)).join(','),
    ...events.map(event => columns.map(([, value]) => escapeCsvValue(value(event))).join(',')),
  ].join('\r\n')
}
