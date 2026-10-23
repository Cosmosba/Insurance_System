/**
 * DEMO DATA — fictional sample records only.
 * None of these figures represent real policies, payments, claims, or customers.
 * Replace with real API calls before any production use.
 *
 * emPLE Life Insurance offers Life, Health, and Pensions products.
 * Categories below reflect those service lines for prototype purposes only.
 */

export const policies = [
  {
    id:           'POL-10041',
    product:      'Whole Life Insurance',
    category:     'Life',
    status:       'Active',
    policyholder: 'Demo Customer',
    startDate:    '01 Mar 2023',
    renewalDate:  '01 Mar 2026',
    sumAssured:   'GHS 50,000.00',
    premium:      'GHS 420.00',
    frequency:    'Monthly',
    description:  'Provides lifelong coverage with a guaranteed sum assured payable to beneficiaries. This is a fictional demo record and does not reflect real emPLE product terms.',
  },
  {
    id:           'POL-10038',
    product:      'Critical Illness Cover',
    category:     'Health',
    status:       'Active',
    policyholder: 'Demo Customer',
    startDate:    '15 Jun 2022',
    renewalDate:  '15 Jun 2025',
    sumAssured:   'GHS 20,000.00',
    premium:      'GHS 210.00',
    frequency:    'Monthly',
    description:  'Provides a lump-sum benefit upon diagnosis of a covered critical illness. This is a fictional demo record and does not reflect real emPLE product terms.',
  },
  {
    id:           'POL-10029',
    product:      'Personal Pension Plan',
    category:     'Pensions',
    status:       'Lapsed',
    policyholder: 'Demo Customer',
    startDate:    '10 Jan 2021',
    renewalDate:  '10 Jan 2024',
    sumAssured:   'GHS 30,000.00',
    premium:      'GHS 185.00',
    frequency:    'Monthly',
    description:  'A personal retirement savings plan designed to provide income in retirement. This policy has lapsed. This is a fictional demo record and does not reflect real emPLE product terms.',
  },
]

// amount stored as a number for calculations; display via formatGHS()
export const payments = [
  // ── Upcoming / due ────────────────────────────────────────────────────────
  {
    ref:        'PAY-20881',
    policyId:   'POL-10041',
    policyName: 'Whole Life Insurance',
    amount:     420.00,
    dueDate:    '31 Jul 2025',
    paidDate:   null,
    method:     null,
    period:     'July 2025',
    status:     'Due Soon',
  },
  {
    ref:        'PAY-20874',
    policyId:   'POL-10038',
    policyName: 'Critical Illness Cover',
    amount:     210.00,
    dueDate:    '15 Aug 2025',
    paidDate:   null,
    method:     null,
    period:     'August 2025',
    status:     'Upcoming',
  },
  // ── Paid history ──────────────────────────────────────────────────────────
  {
    ref:        'PAY-20801',
    policyId:   'POL-10041',
    policyName: 'Whole Life Insurance',
    amount:     420.00,
    dueDate:    '30 Jun 2025',
    paidDate:   '28 Jun 2025',
    method:     'Mobile Money',
    period:     'June 2025',
    status:     'Paid',
  },
  {
    ref:        'PAY-20744',
    policyId:   'POL-10038',
    policyName: 'Critical Illness Cover',
    amount:     210.00,
    dueDate:    '15 Jun 2025',
    paidDate:   '14 Jun 2025',
    method:     'Bank Transfer',
    period:     'June 2025',
    status:     'Paid',
  },
  {
    ref:        'PAY-20712',
    policyId:   'POL-10041',
    policyName: 'Whole Life Insurance',
    amount:     420.00,
    dueDate:    '31 May 2025',
    paidDate:   '30 May 2025',
    method:     'Mobile Money',
    period:     'May 2025',
    status:     'Paid',
  },
  {
    ref:        'PAY-20681',
    policyId:   'POL-10038',
    policyName: 'Critical Illness Cover',
    amount:     210.00,
    dueDate:    '15 May 2025',
    paidDate:   '15 May 2025',
    method:     'Bank Transfer',
    period:     'May 2025',
    status:     'Paid',
  },
  {
    ref:        'PAY-20630',
    policyId:   'POL-10041',
    policyName: 'Whole Life Insurance',
    amount:     420.00,
    dueDate:    '30 Apr 2025',
    paidDate:   '29 Apr 2025',
    method:     'Mobile Money',
    period:     'April 2025',
    status:     'Paid',
  },
  {
    ref:        'PAY-20598',
    policyId:   'POL-10038',
    policyName: 'Critical Illness Cover',
    amount:     210.00,
    dueDate:    '15 Apr 2025',
    paidDate:   null,
    method:     null,
    period:     'April 2025',
    status:     'Overdue',
  },
]

export const claims = [
  {
    ref:         'CLM-00821',
    type:        'Medical Expense',
    policyId:    'POL-10038',
    policyName:  'Critical Illness Cover',
    submitted:   '05 Jul 2025',
    lastUpdated: '10 Jul 2025',
    amount:      1800.00,
    description: 'Claim for medical expenses incurred following a covered diagnosis. Supporting documents submitted with this claim.',
    status:      'Under Review',
    statusHistory: [
      { stage: 'Submitted',   date: '05 Jul 2025', done: true  },
      { stage: 'Under Review',date: '07 Jul 2025', done: true  },
      { stage: 'Decision',    date: null,          done: false },
      { stage: 'Settlement',  date: null,          done: false },
    ],
  },
  {
    ref:         'CLM-00794',
    type:        'Hospitalisation',
    policyId:    'POL-10038',
    policyName:  'Critical Illness Cover',
    submitted:   '18 Jun 2025',
    lastUpdated: '25 Jun 2025',
    amount:      3200.00,
    description: 'Claim for hospitalisation costs following an in-patient admission. All required documentation has been reviewed.',
    status:      'Approved',
    statusHistory: [
      { stage: 'Submitted',   date: '18 Jun 2025', done: true },
      { stage: 'Under Review',date: '20 Jun 2025', done: true },
      { stage: 'Decision',    date: '25 Jun 2025', done: true },
      { stage: 'Settlement',  date: null,          done: false },
    ],
  },
  {
    ref:         'CLM-00761',
    type:        'Accidental Injury',
    policyId:    'POL-10038',
    policyName:  'Critical Illness Cover',
    submitted:   '02 May 2025',
    lastUpdated: '28 May 2025',
    amount:      950.00,
    description: 'Claim for treatment costs arising from an accidental injury. Claim has been fully processed and settled.',
    status:      'Completed',
    statusHistory: [
      { stage: 'Submitted',   date: '02 May 2025', done: true },
      { stage: 'Under Review',date: '05 May 2025', done: true },
      { stage: 'Decision',    date: '14 May 2025', done: true },
      { stage: 'Settlement',  date: '28 May 2025', done: true },
    ],
  },
]

export const recentActivity = [
  { id: 1, event: 'Premium payment recorded',    ref: 'PAY-20801', date: '30 Jun 2025', type: 'payment'  },
  { id: 2, event: 'Claim submitted',             ref: 'CLM-00821', date: '05 Jul 2025', type: 'claim'    },
  { id: 3, event: 'Claim status updated',        ref: 'CLM-00794', date: '25 Jun 2025', type: 'claim'    },
  { id: 4, event: 'Policy document downloaded',  ref: 'POL-10041', date: '12 Jun 2025', type: 'policy'   },
  { id: 5, event: 'Profile details updated',     ref: 'CUST-00412',date: '01 Jun 2025', type: 'profile'  },
]

// ── Currency formatter ────────────────────────────────────────────────────────
export function formatGHS(amount) {
  return `GH₵ ${Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

// ── Derived summary values (calculated from records above) ────────────────────
export function getPaymentSummary() {
  const paid       = payments.filter(p => p.status === 'Paid')
  const upcoming   = payments.filter(p => p.status === 'Upcoming' || p.status === 'Due Soon')
  const overdue    = payments.filter(p => p.status === 'Overdue' || p.status === 'Failed')
  const totalPaid  = paid.reduce((sum, p) => sum + p.amount, 0)
  const totalDue   = upcoming.reduce((sum, p) => sum + p.amount, 0)
  const totalOverdue = overdue.reduce((sum, p) => sum + p.amount, 0)
  return {
    totalPaid,
    upcomingCount: upcoming.length,
    totalDue,
    overdueCount:  overdue.length,
    totalOverdue,
  }
}

export function getClaimSummary() {
  const total      = claims.length
  const underReview = claims.filter(c => c.status === 'Under Review' || c.status === 'Pending').length
  const approved   = claims.filter(c => c.status === 'Approved').length
  const settled    = claims.filter(c => c.status === 'Completed' || c.status === 'Settled').length
  const rejected   = claims.filter(c => c.status === 'Rejected').length
  return { total, underReview, approved, settled, rejected }
}

export function getSummary() {
  const totalPolicies    = policies.length
  const activePolicies   = policies.filter(p => p.status === 'Active').length
  const upcomingPayments = payments.filter(p => p.status !== 'Paid').length
  const claimsInProgress = claims.filter(c => c.status === 'Under Review' || c.status === 'Pending').length
  return { totalPolicies, activePolicies, upcomingPayments, claimsInProgress }
}

export function getPolicySummary() {
  const total   = policies.length
  const active  = policies.filter(p => p.status === 'Active').length
  const pending = policies.filter(p => p.status === 'Pending').length
  const expired = policies.filter(p => p.status === 'Lapsed' || p.status === 'Expired').length
  return { total, active, pending, expired }
}
