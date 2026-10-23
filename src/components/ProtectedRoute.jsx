import { Navigate } from 'react-router-dom'
import { getSession } from '../services/mockAuth'

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
  customer:   '/customer/dashboard',
  superadmin: '/admin/dashboard',
}

export default function ProtectedRoute({ children, requiredRole }) {
  const session = getSession()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && session.role !== requiredRole) {
    const redirect = ROLE_HOME[session.role] ?? '/login'
    return <Navigate to={redirect} replace />
  }

  return children
}
