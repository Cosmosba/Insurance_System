import { getSession } from './mockAuth'
import { getDepartmentById } from './departmentData'
import { recordRoleAuditEvent } from './roleAudit'

const STORAGE_KEY = 'emple_role_permissions_v1'
const CHANGE_EVENT = 'emple:role-permissions-updated'

export const BUILT_IN_ROLES = [
  {
    id: 'superadmin',
    name: 'Superadmin',
    description: 'Organisation-wide administration and access control.',
    type: 'System',
    configurable: false,
  },
  {
    id: 'department_manager',
    name: 'Department Manager',
    description: 'Department-scoped staff and operational access.',
    type: 'System',
    configurable: true,
  },
  {
    id: 'department_staff',
    name: 'Department Staff',
    description: 'Access to assigned department workspace and duties.',
    type: 'System',
    configurable: true,
  },
  {
    id: 'customer',
    name: 'Customer',
    description: 'Access to the customer’s own account and services.',
    type: 'System',
    configurable: true,
  },
]

export const PERMISSION_CATALOG = [
  { id: 'dashboard.admin.view', name: 'View Superadmin dashboard', description: 'Open the organisation-wide administrative dashboard.', category: 'Dashboard', action: 'View', implemented: true },
  { id: 'dashboard.department.view', name: 'View department dashboard', description: 'Open the workspace for an assigned department.', category: 'Dashboard', action: 'View', implemented: false },
  { id: 'dashboard.customer.view', name: 'View customer dashboard', description: 'Open the customer-facing dashboard.', category: 'Dashboard', action: 'View', implemented: true },

  { id: 'users.view', name: 'View staff accounts', description: 'View staff records, restricted to authorised departments where applicable.', category: 'User Management', action: 'View', implemented: true },
  { id: 'users.create', name: 'Create staff accounts', description: 'Add staff account profiles.', category: 'User Management', action: 'Create', implemented: true },
  { id: 'users.edit', name: 'Edit staff accounts', description: 'Update staff profile information.', category: 'User Management', action: 'Edit', implemented: true },
  { id: 'users.activate', name: 'Activate staff accounts', description: 'Activate an inactive staff account.', category: 'User Management', action: 'Activate', implemented: true },
  { id: 'users.deactivate', name: 'Deactivate staff accounts', description: 'Deactivate an active staff account.', category: 'User Management', action: 'Deactivate', implemented: true },
  { id: 'users.assign_roles', name: 'Assign staff roles', description: 'Change staff role assignments.', category: 'User Management', action: 'Assign roles', implemented: true },

  { id: 'departments.workspace.view', name: 'View assigned department', description: 'Open department information within the user’s assigned department only.', category: 'Department Management', action: 'View', implemented: false },
  { id: 'departments.view', name: 'View all departments', description: 'View the organisation-wide department directory.', category: 'Department Management', action: 'View', implemented: true },
  { id: 'departments.create', name: 'Create departments', description: 'Add a department to the organisation.', category: 'Department Management', action: 'Create', implemented: true },
  { id: 'departments.edit', name: 'Edit departments', description: 'Edit department details and status.', category: 'Department Management', action: 'Edit', implemented: true },
  { id: 'departments.deactivate', name: 'Deactivate departments', description: 'Change department availability.', category: 'Department Management', action: 'Deactivate', implemented: true },
  { id: 'departments.assign_managers', name: 'Assign department managers', description: 'Assign or transfer a manager for a department.', category: 'Department Management', action: 'Assign managers', implemented: true },

  { id: 'roles.view', name: 'View roles', description: 'View role definitions and assigned permissions.', category: 'Roles & Permissions', action: 'View', implemented: true },
  { id: 'roles.edit', name: 'Edit role permissions', description: 'Change permissions on configurable built-in roles.', category: 'Roles & Permissions', action: 'Edit', implemented: true },
  { id: 'roles.assign', name: 'Assign roles', description: 'Assign roles to authorised staff accounts.', category: 'Roles & Permissions', action: 'Assign', implemented: true },
  { id: 'permissions.manage', name: 'Manage permissions', description: 'Manage system permission profiles.', category: 'Roles & Permissions', action: 'Manage', implemented: true },

  { id: 'customers.view', name: 'View customer records', description: 'View customer records, subject to assigned access scope.', category: 'Customer Management', action: 'View', implemented: true },
  { id: 'customers.create', name: 'Register customers', description: 'Create customer accounts with a generated first-login password change requirement.', category: 'Customer Management', action: 'Create', implemented: true },
  { id: 'customers.edit', name: 'Edit customer records', description: 'Edit customer contact and profile details.', category: 'Customer Management', action: 'Edit', implemented: true },
  { id: 'customers.activate', name: 'Activate customer accounts', description: 'Activate an inactive customer account.', category: 'Customer Management', action: 'Activate', implemented: true },
  { id: 'customers.deactivate', name: 'Deactivate customer accounts', description: 'Deactivate an active customer account.', category: 'Customer Management', action: 'Deactivate', implemented: true },
  { id: 'customers.manage', name: 'Manage all customer accounts', description: 'Legacy full customer management permission.', category: 'Customer Management', action: 'Manage', implemented: true },
  { id: 'policies.view_own', name: 'View own policies', description: 'View policies belonging to the signed-in customer.', category: 'Policies', action: 'View own', implemented: true },
  { id: 'policies.manage', name: 'Manage policies', description: 'Manage policy records in authorised work areas.', category: 'Policies', action: 'Manage', implemented: false },
  { id: 'payments.view_own', name: 'View own payments', description: 'View payments belonging to the signed-in customer.', category: 'Payments', action: 'View own', implemented: true },
  { id: 'payments.manage', name: 'Manage payments', description: 'Manage payment records in authorised work areas.', category: 'Payments', action: 'Manage', implemented: false },
  { id: 'claims.view_own', name: 'View own claims', description: 'View claims belonging to the signed-in customer.', category: 'Claims', action: 'View own', implemented: true },
  { id: 'claims.submit_own', name: 'Submit own claims', description: 'Submit a claim for the signed-in customer.', category: 'Claims', action: 'Submit own', implemented: true },
  { id: 'claims.manage', name: 'Manage claims', description: 'Review and manage claims in authorised work areas.', category: 'Claims', action: 'Manage', implemented: false },
  { id: 'reports.view', name: 'View organisation reports', description: 'View organisation-wide reports where available.', category: 'Reports', action: 'View', implemented: false },
  { id: 'reports.department.view', name: 'View department reports', description: 'View reports limited to authorised departments.', category: 'Reports', action: 'View department', implemented: false },
  { id: 'profile.view_own', name: 'View own profile', description: 'View the signed-in customer’s profile.', category: 'Customer Profile', action: 'View own', implemented: true },
  { id: 'profile.edit_own', name: 'Edit own profile', description: 'Edit the signed-in customer’s permitted profile fields.', category: 'Customer Profile', action: 'Edit own', implemented: true },
  { id: 'settings.manage', name: 'Manage system settings', description: 'Change organisation-wide settings where available.', category: 'System Settings', action: 'Manage', implemented: false },
  { id: 'activity.view', name: 'View administrative activity', description: 'View recorded administrative activity.', category: 'Audit & Activity Logs', action: 'View', implemented: true },
]

const PERMISSION_IDS = new Set(PERMISSION_CATALOG.map(permission => permission.id))
const DEFAULT_ROLE_PERMISSIONS = {
  superadmin: PERMISSION_CATALOG.map(permission => permission.id),
  department_manager: [
    'dashboard.department.view',
    'departments.workspace.view',
    'users.view',
    'reports.department.view',
  ],
  department_staff: [
    'dashboard.department.view',
    'departments.workspace.view',
  ],
  customer: [
    'dashboard.customer.view',
    'policies.view_own',
    'payments.view_own',
    'claims.view_own',
    'claims.submit_own',
    'profile.view_own',
    'profile.edit_own',
  ],
}

export const SUPERADMIN_ONLY_PERMISSIONS = new Set([
  'dashboard.admin.view',
  'users.create',
  'users.edit',
  'users.activate',
  'users.deactivate',
  'users.assign_roles',
  'departments.view',
  'departments.create',
  'departments.edit',
  'departments.deactivate',
  'departments.assign_managers',
  'roles.view',
  'roles.edit',
  'roles.assign',
  'permissions.manage',
  'customers.manage',
  'reports.view',
  'settings.manage',
  'activity.view',
])

const CUSTOMER_ONLY_PERMISSIONS = new Set([
  'dashboard.customer.view',
  'policies.view_own',
  'payments.view_own',
  'claims.view_own',
  'claims.submit_own',
  'profile.view_own',
  'profile.edit_own',
])

export const SENSITIVE_PERMISSIONS = new Set([
  ...SUPERADMIN_ONLY_PERMISSIONS,
  'users.view',
  'departments.workspace.view',
  'policies.manage',
  'payments.manage',
  'claims.manage',
  'reports.department.view',
  'customers.view',
  'customers.create',
  'customers.edit',
  'customers.activate',
  'customers.deactivate',
  'customers.manage',
])

export class RolePermissionError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'RolePermissionError'
    this.details = details
  }
}

function normalizeRole(role) {
  return role === 'staff' ? 'department_staff' : role
}

function readOverrides() {
  let raw
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('Browser storage is unavailable.')
    }
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    throw new RolePermissionError('Role permission storage is unavailable.')
  }
  if (raw === null) return {}

  let overrides
  try {
    overrides = JSON.parse(raw)
  } catch {
    throw new RolePermissionError('Saved role permissions are invalid.')
  }
  if (!overrides || Array.isArray(overrides) || typeof overrides !== 'object') {
    throw new RolePermissionError('Saved role permissions have an invalid format.')
  }

  for (const [roleId, permissionIds] of Object.entries(overrides)) {
    if (
      !BUILT_IN_ROLES.some(role => role.id === roleId && role.configurable)
      || !Array.isArray(permissionIds)
      || permissionIds.some(id => typeof id !== 'string' || !PERMISSION_IDS.has(id))
      || new Set(permissionIds).size !== permissionIds.length
      || !isRolePermissionSetAllowed(roleId, permissionIds)
    ) {
      throw new RolePermissionError('Saved role permissions contain invalid or restricted entries.')
    }
  }
  return overrides
}

export function getRolePermissionIds(roleId) {
  const role = normalizeRole(roleId)
  if (!DEFAULT_ROLE_PERMISSIONS[role]) return []
  if (role === 'superadmin') return [...DEFAULT_ROLE_PERMISSIONS.superadmin]
  const overrides = readOverrides()
  return [...(overrides[role] ?? DEFAULT_ROLE_PERMISSIONS[role])]
}

export function getRoleDefinitions() {
  return BUILT_IN_ROLES.map(role => ({
    ...role,
    permissions: getRolePermissionIds(role.id),
  }))
}

export function canGrantPermissionToRole(roleId, permissionId) {
  const role = normalizeRole(roleId)
  if (!PERMISSION_IDS.has(permissionId) || !BUILT_IN_ROLES.some(item => item.id === role && item.configurable)) {
    return false
  }
  if (role === 'customer') return CUSTOMER_ONLY_PERMISSIONS.has(permissionId)
  if (role === 'department_manager' || role === 'department_staff') {
    return !SUPERADMIN_ONLY_PERMISSIONS.has(permissionId)
      && !CUSTOMER_ONLY_PERMISSIONS.has(permissionId)
      && permissionId !== 'dashboard.admin.view'
  }
  return false
}

function isRolePermissionSetAllowed(roleId, permissionIds) {
  return permissionIds.every(permissionId => canGrantPermissionToRole(roleId, permissionId))
}

export function updateRolePermissions(roleId, permissionIds, { confirmedSensitive = false } = {}) {
  const session = getSession()
  if (!session || session.role !== 'superadmin' || !hasPermission(session, 'permissions.manage')) {
    throw new RolePermissionError('Only a signed-in Superadmin can change role permissions.')
  }
  const role = BUILT_IN_ROLES.find(item => item.id === roleId)
  if (!role || !role.configurable || role.id === 'superadmin') {
    throw new RolePermissionError('This system role is protected and cannot be edited.')
  }
  if (!Array.isArray(permissionIds) || permissionIds.some(id => typeof id !== 'string' || !PERMISSION_IDS.has(id))) {
    throw new RolePermissionError('Select permissions from the available catalogue.')
  }
  const uniquePermissions = [...new Set(permissionIds)]
  if (!isRolePermissionSetAllowed(roleId, uniquePermissions)) {
    throw new RolePermissionError('This role cannot be granted system-wide or out-of-scope permissions.')
  }

  const currentPermissions = getRolePermissionIds(roleId)
  const sensitiveGrant = uniquePermissions.some(id => (
    !currentPermissions.includes(id) && SENSITIVE_PERMISSIONS.has(id)
  ))
  if (sensitiveGrant && !confirmedSensitive) {
    throw new RolePermissionError('Confirm the sensitive permission changes before saving.', { sensitiveGrant: true })
  }

  let overrides
  try {
    overrides = readOverrides()
    const next = { ...overrides, [roleId]: uniquePermissions }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (error) {
    if (error instanceof RolePermissionError) throw error
    throw new RolePermissionError('Unable to save role permissions in this browser.')
  }

  window.dispatchEvent(new Event(CHANGE_EVENT))
  try {
    recordRoleAuditEvent({
      action: 'Permissions updated',
      targetType: 'role',
      targetId: roleId,
      targetName: role.name,
      details: `${uniquePermissions.length} permission${uniquePermissions.length === 1 ? '' : 's'} assigned`,
    })
  } catch {
    throw new RolePermissionError(
      'Permissions were saved, but the administrative history could not be updated.',
      { saved: true },
    )
  }
  return getRolePermissionIds(roleId)
}

export function resetRolePermissionOverrides() {
  const session = getSession()
  if (!session || session.role !== 'superadmin' || !hasPermission(session, 'permissions.manage')) {
    throw new RolePermissionError('Only a signed-in Superadmin can restore default role permissions.')
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    throw new RolePermissionError('Unable to restore default role permissions in this browser.')
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
  try {
    recordRoleAuditEvent({
      action: 'Role permissions restored',
      targetType: 'role configuration',
      targetId: 'built-in-roles',
      targetName: 'Built-in roles',
      details: 'Default permission profiles restored',
    })
  } catch {
    throw new RolePermissionError(
      'Default permissions were restored, but the administrative history could not be updated.',
      { saved: true },
    )
  }
}

export function hasRole(user, roleId) {
  return Boolean(user && normalizeRole(user.role) === normalizeRole(roleId))
}

export function hasPermission(user, permissionId) {
  if (!user || typeof permissionId !== 'string' || !PERMISSION_IDS.has(permissionId)) return false
  if (user.status === 'Inactive') return false
  const roleId = normalizeRole(user.role)
  try {
    return getRolePermissionIds(roleId).includes(permissionId)
  } catch {
    return false
  }
}

export function canAccessDepartment(user, departmentId) {
  if (!user || typeof departmentId !== 'string' || !departmentId) return false
  let department
  try {
    department = getDepartmentById(departmentId)
  } catch {
    return false
  }
  if (!department) return false
  if (hasRole(user, 'superadmin')) return hasPermission(user, 'departments.view')
  if (!['department_manager', 'department_staff', 'staff'].includes(user.role)) return false
  return department.status === 'Active'
    && user.departmentId === departmentId
    && hasPermission(user, 'departments.workspace.view')
}

export function subscribeToRolePermissions(callback) {
  if (typeof window === 'undefined') return () => {}
  const onChange = () => {
    try {
      callback(getRoleDefinitions(), null)
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
