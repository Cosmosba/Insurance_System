import { getSession } from './mockAuth'
import { getCustomerDirectory, subscribeToCustomerDirectory } from './customerDirectoryData'
import { getDepartments, subscribeToDepartments } from './departmentData'
import { getSystemActivity } from './systemActivity'
import { subscribeToRoleAuditEvents } from './roleAudit'
import { canAccessDepartment, hasPermission, subscribeToRolePermissions } from './rolePermissions'
import { getStaffUsers, subscribeToStaffUsers } from './userData'

export const COMPANY_REPORT_SCOPE = Object.freeze({ type: 'company' })

const VALID_STATUSES = new Set(['all', 'Active', 'Inactive'])
const STAFF_ROLE_LABELS = {
  superadmin: 'Superadmin',
  department_manager: 'Department Manager',
  department_staff: 'Department Staff',
}

export class ReportAnalyticsError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ReportAnalyticsError'
  }
}

function requireCompanyScope(session) {
  if (
    !session
    || session.role !== 'superadmin'
    || !hasPermission(session, 'reports.view')
  ) {
    throw new ReportAnalyticsError('Only an authorised Superadmin can view company-wide reports.')
  }
  return { type: 'company' }
}

function requireDepartmentScope(session, departmentId) {
  if (
    !session
    || session.role !== 'department_manager'
    || session.mustChangePassword
    || !hasPermission(session, 'reports.department.view')
    || typeof departmentId !== 'string'
    || !departmentId.trim()
  ) {
    throw new ReportAnalyticsError('Only an authorised Department Manager can view department reports.')
  }

  let currentUser
  try {
    currentUser = getStaffUsers().find(user => user.email.toLocaleLowerCase() === session.email.toLocaleLowerCase())
  } catch {
    throw new ReportAnalyticsError('The signed-in Department Manager account could not be verified.')
  }

  if (
    !currentUser
    || currentUser.role !== 'department_manager'
    || currentUser.departmentId !== departmentId
    || !canAccessDepartment(currentUser, departmentId)
  ) {
    throw new ReportAnalyticsError('Department reports are limited to the signed-in manager’s assigned department.')
  }
  return { type: 'department', departmentId }
}

function authorizeScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new ReportAnalyticsError('Choose a valid reporting scope.')
  }
  const session = getSession()
  if (scope.type === 'company') return requireCompanyScope(session)
  if (scope.type === 'department') {
    return requireDepartmentScope(session, scope.departmentId)
  }
  throw new ReportAnalyticsError('Choose a supported reporting scope.')
}

function parseDateKey(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const candidate = value.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null
  const parsed = new Date(`${candidate}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate) return null
  return candidate
}

function normalizeFilters(filters, scope, departments) {
  const input = filters && typeof filters === 'object' && !Array.isArray(filters) ? filters : {}
  const rawStartDate = input.startDate ?? ''
  const rawEndDate = input.endDate ?? ''
  const startDate = rawStartDate === '' ? '' : parseDateKey(String(rawStartDate))
  const endDate = rawEndDate === '' ? '' : parseDateKey(String(rawEndDate))
  if ((rawStartDate !== '' && !startDate) || (rawEndDate !== '' && !endDate)) {
    throw new ReportAnalyticsError('Enter valid start and end dates.')
  }
  if (startDate && endDate && startDate > endDate) {
    throw new ReportAnalyticsError('The start date must be on or before the end date.')
  }

  const status = input.status ?? 'all'
  if (typeof status !== 'string' || !VALID_STATUSES.has(status)) {
    throw new ReportAnalyticsError('Choose a valid account or department status.')
  }

  let departmentId = input.departmentId ?? 'all'
  if (typeof departmentId !== 'string') {
    throw new ReportAnalyticsError('Choose a valid department filter.')
  }
  if (scope.type === 'department') {
    if (departmentId !== 'all' && departmentId !== scope.departmentId) {
      throw new ReportAnalyticsError('Department reports cannot include another department.')
    }
    departmentId = scope.departmentId
  } else if (
    departmentId !== 'all'
    && !departments.some(department => department.id === departmentId)
  ) {
    throw new ReportAnalyticsError('Choose a registered department.')
  }

  return { startDate, endDate, status, departmentId }
}

function getRecordDate(record, dateField) {
  const value = record?.[dateField]
  if (typeof value !== 'string' || !value) return null
  return parseDateKey(value)
}

function matchesDateAndStatus(record, dateField, filters) {
  const dateKey = getRecordDate(record, dateField)
  if (filters.startDate || filters.endDate) {
    if (!dateKey || (filters.startDate && dateKey < filters.startDate) || (filters.endDate && dateKey > filters.endDate)) {
      return false
    }
  }
  return filters.status === 'all' || record.status === filters.status
}

function monthKey(dateKey) {
  return dateKey?.slice(0, 7) ?? ''
}

function addMonths(month, count) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + count, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function getMonthKeys(dateSets, filters) {
  let first = filters.startDate ? monthKey(filters.startDate) : ''
  let last = filters.endDate ? monthKey(filters.endDate) : ''
  const available = dateSets.flat().filter(Boolean).map(monthKey).sort()
  if (!first) first = available[0] ?? ''
  if (!last) last = available[available.length - 1] ?? ''
  if (!first || !last || first > last) return []

  const months = []
  for (let month = first; month <= last; month = addMonths(month, 1)) {
    months.push(month)
  }
  return months
}

function countBy(values, getKey) {
  const counts = new Map()
  for (const value of values) {
    const key = getKey(value)
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label))
}

function countByMonth(records, dateField, monthKeys) {
  const counts = new Map(monthKeys.map(month => [month, 0]))
  for (const record of records) {
    const date = getRecordDate(record, dateField)
    const month = monthKey(date)
    if (counts.has(month)) counts.set(month, counts.get(month) + 1)
  }
  return counts
}

function getStatusCounts(records) {
  return ['Active', 'Inactive'].map(status => ({
    label: status,
    value: records.filter(record => record.status === status).length,
  }))
}

function getDepartmentRows(departments, staff, assignmentStaff, selectedDepartmentId) {
  return departments
    .filter(department => selectedDepartmentId === 'all' || department.id === selectedDepartmentId)
    .map(department => {
      const departmentStaff = staff.filter(user => user.departmentId === department.id)
      return {
        id: department.id,
        name: department.name,
        code: department.code ?? '',
        status: department.status,
        staffCount: departmentStaff.length,
        managerCount: departmentStaff.filter(user => user.role === 'department_manager').length,
        assignedManager: Boolean(department.managerId) || assignmentStaff.some(user => (
          user.departmentId === department.id && user.role === 'department_manager'
        )),
      }
    })
    .sort((first, second) => first.name.localeCompare(second.name))
}

function createTrend(monthKeys, customers, staff, activities, isDepartmentScope) {
  const customerCounts = countByMonth(customers, 'registrationDate', monthKeys)
  const staffCounts = countByMonth(staff, 'createdAt', monthKeys)
  const activityCounts = countByMonth(activities, 'timestamp', monthKeys)
  return monthKeys.map(month => ({
    month,
    customers: isDepartmentScope ? null : customerCounts.get(month),
    staff: staffCounts.get(month),
    activities: isDepartmentScope ? null : activityCounts.get(month),
  }))
}

export function calculateReportAnalytics(source, scope, inputFilters = {}) {
  if (
    !scope
    || typeof scope !== 'object'
    || !['company', 'department'].includes(scope.type)
    || (scope.type === 'department' && typeof scope.departmentId !== 'string')
  ) {
    throw new ReportAnalyticsError('Choose a valid reporting scope.')
  }
  const departments = Array.isArray(source?.departments) ? source.departments : []
  const filters = normalizeFilters(inputFilters, scope, departments)
  const isDepartmentScope = scope.type === 'department'
  const staffSource = Array.isArray(source?.staff) ? source.staff : []
  const customerSource = Array.isArray(source?.customers) ? source.customers : []
  const activitySource = Array.isArray(source?.activities) ? source.activities : []

  const inScopeStaff = isDepartmentScope
    ? staffSource.filter(user => user.departmentId === scope.departmentId)
    : staffSource
  const inScopeDepartments = isDepartmentScope
    ? departments.filter(department => department.id === scope.departmentId)
    : departments
  const filteredStaff = inScopeStaff.filter(user => matchesDateAndStatus(user, 'createdAt', filters))
  const filteredCustomers = isDepartmentScope
    ? []
    : customerSource.filter(customer => matchesDateAndStatus(customer, 'registrationDate', filters))
  const filteredActivities = isDepartmentScope
    ? []
    : activitySource.filter(event => {
      const eventDate = parseDateKey(event.timestamp)
      if (filters.startDate || filters.endDate) {
        if (!eventDate || (filters.startDate && eventDate < filters.startDate) || (filters.endDate && eventDate > filters.endDate)) {
          return false
        }
      }
      return true
    })
  const filteredDepartments = inScopeDepartments.filter(department => (
    filters.status === 'all' || department.status === filters.status
  ))
  const selectedDepartments = isDepartmentScope
    ? filteredDepartments
    : filteredDepartments.filter(department => (
      filters.departmentId === 'all' || department.id === filters.departmentId
    ))

  const dateSets = [
    filteredCustomers.map(record => getRecordDate(record, 'registrationDate')),
    filteredStaff.map(record => getRecordDate(record, 'createdAt')),
    filteredActivities.map(record => parseDateKey(record.timestamp)),
  ]
  const monthKeys = getMonthKeys(dateSets, filters)
  const customersByStatus = getStatusCounts(filteredCustomers)
  const staffByStatus = getStatusCounts(filteredStaff)
  const staffByRole = countBy(filteredStaff, user => (
    STAFF_ROLE_LABELS[user.role] ?? 'Other staff'
  ))
  const departmentRows = getDepartmentRows(
    selectedDepartments,
    filteredStaff,
    inScopeStaff,
    filters.departmentId,
  )
  const departmentStaffIds = new Set(inScopeDepartments.map(department => department.id))
  const unassignedStaff = filteredStaff.filter(user => !departmentStaffIds.has(user.departmentId))

  return {
    scope: { ...scope },
    filters,
    departmentOptions: (isDepartmentScope
      ? inScopeDepartments
      : departments
    ).map(({ id, name, code, status }) => ({ id, name, code, status })),
    limitations: {
      customersHaveNoDepartmentAssignment: isDepartmentScope,
      activityIsCompanyWideOnly: isDepartmentScope,
      undatedStaffAreExcludedFromDatedViews: Boolean(filters.startDate || filters.endDate),
    },
    kpis: {
      customers: isDepartmentScope ? null : filteredCustomers.length,
      activeCustomers: isDepartmentScope
        ? null
        : filteredCustomers.filter(customer => customer.status === 'Active').length,
      staff: filteredStaff.length,
      activeStaff: filteredStaff.filter(user => user.status === 'Active').length,
      departments: filteredDepartments.length,
    },
    customerAnalytics: isDepartmentScope ? null : {
      total: filteredCustomers.length,
      byStatus: customersByStatus,
      registrationsByMonth: countBy(
        filteredCustomers,
        customer => monthKey(getRecordDate(customer, 'registrationDate')),
      ),
    },
    workforceAnalytics: {
      total: filteredStaff.length,
      byStatus: staffByStatus,
      byRole: staffByRole,
      unassigned: unassignedStaff.length,
    },
    departmentComparisons: departmentRows,
    activityAnalytics: isDepartmentScope ? null : {
      total: filteredActivities.length,
      byModule: countBy(filteredActivities, event => event.module || 'Other'),
      byAction: countBy(filteredActivities, event => event.action || 'Other'),
    },
    trends: createTrend(monthKeys, filteredCustomers, filteredStaff, filteredActivities, isDepartmentScope),
    dataNotes: {
      customerDepartment: 'Customer records do not contain a department assignment. Department filters apply to the comparison table and do not change company-wide customer totals.',
      activityDepartment: 'Existing activity records are not consistently linked to a department, so department filters do not scope activity totals.',
      staffDates: 'Staff records without a recorded creation date remain in current totals but cannot be included in a date-filtered report or dated trend.',
    },
  }
}

export function getReportAnalytics(scope = COMPANY_REPORT_SCOPE, filters = {}) {
  const authorizedScope = authorizeScope(scope)
  try {
    const departments = getDepartments()
    const staff = getStaffUsers()
    if (authorizedScope.type === 'department') {
      return calculateReportAnalytics({ departments, staff }, authorizedScope, filters)
    }
    const customers = getCustomerDirectory()
    const activities = getSystemActivity()
    return calculateReportAnalytics({ customers, staff, departments, activities }, authorizedScope, filters)
  } catch (error) {
    if (error instanceof ReportAnalyticsError) throw error
    throw new ReportAnalyticsError(error.message || 'Report data could not be loaded.')
  }
}

export function subscribeToReportAnalytics(scope, filters, callback) {
  if (typeof callback !== 'function') return () => {}
  const refresh = () => {
    try {
      callback(getReportAnalytics(scope, filters), null)
    } catch (error) {
      callback(null, error)
    }
  }
  const refreshAfterSourceChange = (...args) => {
    const sourceError = args.length > 1 ? args[1] : null
    if (sourceError) {
      callback(null, sourceError)
      return
    }
    refresh()
  }
  const subscriptions = [
    subscribeToCustomerDirectory(refresh),
    subscribeToStaffUsers(refreshAfterSourceChange),
    subscribeToDepartments(refreshAfterSourceChange),
    subscribeToRoleAuditEvents(refreshAfterSourceChange),
    subscribeToRolePermissions(refreshAfterSourceChange),
  ]
  return () => subscriptions.forEach(unsubscribe => unsubscribe())
}

function escapeCsvValue(value) {
  let text = String(value ?? '')
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function exportReportAnalyticsCsv(report) {
  authorizeScope(report?.scope)
  if (!report || typeof report !== 'object') {
    throw new ReportAnalyticsError('There is no report available to export.')
  }
  const rows = [
    ['Executive overview', 'Customers', report.kpis.customers],
    ['Executive overview', 'Active customers', report.kpis.activeCustomers],
    ['Executive overview', 'Staff', report.kpis.staff],
    ['Executive overview', 'Active staff', report.kpis.activeStaff],
    ['Executive overview', 'Departments', report.kpis.departments],
    ...(report.customerAnalytics?.byStatus ?? []).map(row => ['Customer status', row.label, row.value]),
    ...report.workforceAnalytics.byStatus.map(row => ['Staff status', row.label, row.value]),
    ...report.workforceAnalytics.byRole.map(row => ['Staff role', row.label, row.value]),
    ...report.departmentComparisons.map(row => [
      'Department comparison',
      row.name,
      `Status: ${row.status}; Staff: ${row.staffCount}; Managers: ${row.managerCount}; Manager assigned: ${row.assignedManager ? 'Yes' : 'No'}`,
    ]),
    ...report.trends.map(row => [
      'Monthly trend',
      row.month,
      `Customers: ${row.customers ?? 'Not available'}; Staff: ${row.staff}; Activities: ${row.activities ?? 'Not available'}`,
    ]),
    ...(report.activityAnalytics?.byModule ?? []).map(row => ['Activity by module', row.label, row.value]),
    ...(report.activityAnalytics?.byAction ?? []).map(row => ['Activity by action', row.label, row.value]),
  ]
  return [
    ['Report section', 'Metric', 'Value'].map(escapeCsvValue).join(','),
    ...rows.map(row => row.map(escapeCsvValue).join(',')),
  ].join('\r\n')
}
