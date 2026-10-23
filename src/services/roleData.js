import { getKnownCustomerAccounts, getSession } from './mockAuth'
import { getStaffUsers } from './userData'
import {
  BUILT_IN_ROLES,
  PERMISSION_CATALOG,
  hasPermission,
  getRolePermissionIds,
  resetRolePermissionOverrides,
  updateRolePermissions,
} from './rolePermissions'
import { getRoleAuditEvents } from './roleAudit'

export {
  PERMISSION_CATALOG,
  getRolePermissionIds,
  resetRolePermissionOverrides,
  updateRolePermissions,
}

function requireRoleAccess() {
  const session = getSession()
  if (!session || session.role !== 'superadmin' || !hasPermission(session, 'roles.view')) {
    throw new Error('Only an authorised Superadmin can view role assignments.')
  }
}

export function getRoleDirectory() {
  requireRoleAccess()
  const staff = getStaffUsers()
  const customers = getKnownCustomerAccounts()
  return BUILT_IN_ROLES.map(role => {
    const members = role.id === 'customer'
      ? customers.map(account => ({
        id: `customer-${account.email}`,
        name: account.name,
        email: account.email,
        role: 'customer',
        status: 'Active',
        departmentId: null,
      }))
      : staff
        .filter(user => user.role === role.id)
        .map(user => ({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`.trim(),
          email: user.email,
          role: user.role,
          status: user.status,
          departmentId: user.departmentId,
        }))
    const permissionIds = getRolePermissionIds(role.id)
    return {
      ...role,
      permissions: permissionIds,
      assignedUsers: members.length,
      permissionCount: permissionIds.length,
      members,
    }
  })
}

export function getRoleSummary(directory = getRoleDirectory()) {
  requireRoleAccess()
  const staff = getStaffUsers()
  return {
    totalRoles: directory.length,
    totalStaffAccounts: staff.length,
    activeStaffAccounts: staff.filter(user => user.status === 'Active').length,
    assignedRoles: directory.filter(role => role.assignedUsers > 0).length,
  }
}

export function getRecentRoleAuditEvents(limit = 8) {
  requireRoleAccess()
  return getRoleAuditEvents().slice(0, limit)
}
