/**
 * Organisation-wide reference data for the Superadmin workspace.
 * Replace with real API calls before any production use.
 *
 * Summaries that can be derived from existing customerData records are
 * calculated via helper functions rather than hardcoded.
 */

import { policies, payments, claims } from './customerData'

// ── Departments ───────────────────────────────────────────────────────────────
// Designed to be loaded from a database in production.
// manager: null until a manager is assigned via the Departments module.
export const departments = [
  { id: 'dept-life',     name: 'Life',     category: 'Product',    staffCount: 0, manager: null, status: 'Active'   },
  { id: 'dept-health',   name: 'Health',   category: 'Product',    staffCount: 0, manager: null, status: 'Active'   },
  { id: 'dept-pensions', name: 'Pensions', category: 'Product',    staffCount: 0, manager: null, status: 'Active'   },
  { id: 'dept-hr',       name: 'HR',       category: 'Operations', staffCount: 0, manager: null, status: 'Active'   },
  { id: 'dept-audit',    name: 'Audit',    category: 'Compliance', staffCount: 0, manager: null, status: 'Active'   },
  { id: 'dept-media',    name: 'Media',    category: 'Operations', staffCount: 0, manager: null, status: 'Active'   },
  { id: 'dept-it',       name: 'IT',       category: 'Operations', staffCount: 0, manager: null, status: 'Active'   },
]

// ── System activity ───────────────────────────────────────────────────────────
// Authoritative audit events will come from the backend.
// This list is intentionally empty until real events are recorded.
export const systemActivity = []

// ── Org-wide summary (derived from available records) ────────────────────────
export function getAdminSummary() {
  const totalDepartments  = departments.length
  const activePolicies    = policies.filter(p => p.status === 'Active').length
  const totalPolicies     = policies.length
  const pendingClaims     = claims.filter(c =>
    c.status === 'Under Review' || c.status === 'Pending'
  ).length
  const totalClaims       = claims.length
  const overduePayments   = payments.filter(p => p.status === 'Overdue').length
  const totalOutstanding  = payments
    .filter(p => p.status === 'Overdue' || p.status === 'Due Soon')
    .reduce((sum, p) => sum + p.amount, 0)

  return {
    totalDepartments,
    // Staff and customer counts require a backend user directory.
    // Returning null signals the UI to show a pending state rather than a wrong figure.
    totalStaff:      null,
    totalCustomers:  null,
    activePolicies,
    totalPolicies,
    pendingClaims,
    totalClaims,
    overduePayments,
    totalOutstanding,
  }
}
