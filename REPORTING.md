# Report & Analytics

The Superadmin company report is available at `/admin/reports`. The
`src/services/reportAnalytics.js` service owns reporting-scope authorization,
data access, calculations, subscriptions, and CSV generation. Company scope
requires both the Superadmin role and `reports.view`. The service also accepts
a department scope only for a Department Manager whose verified active account,
department assignment, and `reports.department.view` permission match that
scope. The Department Manager reporting interface is not implemented.

Reports use the existing customer directory, staff records, department
directory, and administrative activity service. Customer records currently
have no department assignment, and activity events are not consistently linked
to departments. Accordingly, the department filter narrows department
comparisons only; it does not narrow company-wide totals, customer totals, or
system activity. The current audit store retains up to 100 events, so the
activity metrics describe available retained records rather than lifetime
company history.

Date filters use customer registration dates, staff creation timestamps, and
activity timestamps. Staff records without creation timestamps remain in
unbounded totals but are excluded from date-bounded results. The status filter
applies to customer, staff, and department records, not activity events.
Policy, premium, revenue, claims, and payment reports are omitted because
reliable reporting sources for those metrics are not established here.

The data and permissions are currently browser-local. The report service checks
the existing application role and permission helpers and department access
rules, but frontend checks and localStorage are not server-side security and
cannot prevent a user with browser-level access from altering local data.
Subscriptions react to same-tab service events and browser storage events.
Shared cross-user real-time reporting requires trusted backend infrastructure.
