# Ops Runbook

## 0) Security baseline before launch (RLS + Sentry)

### A) Apply RLS migration on Supabase/Postgres

Execute:

```bash
psql "$DATABASE_URL" -f database/migrations/011_enforce_rls_all_tenant_tables.sql
```

Then verify RLS is enabled:

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname IN ('public', 'audit')
  AND tablename IN (
    'merchants',
    'customers',
    'loans',
    'payment_history',
    'merchant_employees',
    'subscription_requests',
    'audit_logs',
    'loan_audit_log'
  );
```

### B) Configure Sentry env vars

Frontend (`frontend-next`):
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_DSN` (optional server-side override)
- `SENTRY_SEND_DEFAULT_PII=false` (recommended)

Backend:
- `SENTRY_DSN`

## 1) Automated DB backup + restore verification

Run from `backend/`:

```bash
npm run backup:verify
```

This runs:
- `npm run backup:db` to create a DB dump in `../db_backups`
- `npm run restore:check` to restore the latest dump into a temporary DB and verify core tables.

Suggested cron (daily at 02:00):

```bash
0 2 * * * cd /path/to/loan-management-saas/backend && npm run backup:verify >> /var/log/aseel-backup.log 2>&1
```

## 2) Monitoring checks (Sentry + 500 + latency)

Runtime alerts are evaluated in-app from:
- 5xx rate in last alert window
- p95 latency in last alert window

Manual check:

```bash
npm run monitor:check
```

Suggested cron (every 5 minutes):

```bash
*/5 * * * * cd /path/to/loan-management-saas/backend && npm run monitor:check >> /var/log/aseel-monitor.log 2>&1
```

## 3) Sensitive API permission checklist

Run:

```bash
npm run security:permissions
```

It validates access-control behavior for:
- `/api/loans`
- `/api/reports/dashboard`
- `/api/reports/analytics`
- `/api/system-manage-x7/merchants`

and exits non-zero on any mismatch.
