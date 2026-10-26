import { Link, Navigate } from 'react-router-dom'
import { getRoleHome, getSession } from '../services/mockAuth'
import { hasPermission } from '../services/rolePermissions'

/**
 * Wraps a route so only authenticated users with the required role can access it.
 * Unauthenticated users → /login
 * Wrong role → their own dashboard
 *
 * NOTE: Frontend-only guard for the dev prototype.
 * Replace with server-side auth enforcement before production.
 */

function normalizeRole(role) {
  return role === 'staff' ? 'department_staff' : role
}

function hasRequiredRole(sessionRole, requiredRole) {
  const normalizedSessionRole = normalizeRole(sessionRole)
  const normalizedRequiredRole = normalizeRole(requiredRole)
  if (normalizedRequiredRole === 'department_staff') {
    return ['department_staff', 'department_manager'].includes(normalizedSessionRole)
  }
  return normalizedSessionRole === normalizedRequiredRole
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

  if (session.mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  if (requiredRole && !hasRequiredRole(session.role, requiredRole)) {
    const redirect = getRoleHome(session.role)
    return <Navigate to={redirect} replace />
  }

  if (requiredPermission && !hasPermission(session, requiredPermission)) {
    return <PermissionDenied home={getRoleHome(session.role)} />
  }

  return children
}
