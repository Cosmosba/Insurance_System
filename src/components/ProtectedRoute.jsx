import { Link, Navigate } from 'react-router-dom'
import { getSession } from '../services/mockAuth'
import { hasPermission } from '../services/rolePermissions'

/**
 * Wraps a route so only authenticated users with the required role can access it.
 * Unauthenticated users → /login
 * Wrong role → their own dashboard
 *
 * NOTE: Frontend-only guard for the dev prototype.
 * Replace with server-side auth enforcement before production.
 */

const ROLE_HOME = {
  staff:      '/staff/dashboard',
  department_staff: '/staff/dashboard',
  department_manager: '/staff/dashboard',
  customer:   '/customer/dashboard',
  superadmin: '/admin/dashboard',
}

function normalizeRole(role) {
  return role === 'staff' ? 'department_staff' : role
}

function PermissionDenied({ home }) {
  return (
    <main role="alert" style={{ padding: 32, color: '#263126' }}>
      <h1>Access restricted</h1>
      <p>Your role does not have permission to open this area.</p>
      <Link to={home}>Return to your dashboard</Link>
    </main>
  )
}

export default function ProtectedRoute({ children, requiredRole, requiredPermission }) {
  const session = getSession()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && normalizeRole(session.role) !== normalizeRole(requiredRole)) {
    const redirect = ROLE_HOME[session.role] ?? '/login'
    return <Navigate to={redirect} replace />
  }

  if (requiredPermission && !hasPermission(session, requiredPermission)) {
    return <PermissionDenied home={ROLE_HOME[session.role] ?? '/login'} />
  }

  return children
}
