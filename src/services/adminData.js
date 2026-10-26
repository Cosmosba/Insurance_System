/**
 * Organisation-wide reference data for the Superadmin workspace.
 * Replace with real API calls before any production use.
 *
 * Summaries that can be derived from existing customerData records are
 * calculated via helper functions rather than hardcoded.
 */

import { policies, payments, claims } from './customerData'
import { getDepartments } from './departmentData'

// ── Org-wide summary (derived from available records) ────────────────────────
export function getAdminSummary(totalDepartments = getDepartments().length, totalStaff = null) {
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
    totalStaff,
    totalCustomers:  null,
    activePolicies,
    totalPolicies,
    pendingClaims,
    totalClaims,
    overduePayments,
    totalOutstanding,
  }
}
