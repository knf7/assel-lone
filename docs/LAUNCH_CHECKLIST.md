# Launch Checklist (Release Gate)

## 1) Environment
- Copy production values into:
  - `backend/.env`
  - `frontend-next/.env.local`
- Validate env values:

```bash
./scripts/verify-env.sh
```

## 2) Full preflight
Run full checks before release:

```bash
./scripts/preflight.sh
```

If you want to skip env validation temporarily:

```bash
./scripts/preflight.sh --skip-env-check
```

## 3) Optional live integration suite
Run only on staging/production-like environment:

```bash
cd backend
npm run test:integration
```

## 4) Deploy
- Deploy backend and frontend.
- Confirm health endpoints and login flow.
- Monitor errors and latency for first 24h.

## 5) Rollback criteria
Rollback immediately if any of the following occur:
- sustained 5xx error rate > 5%
- p95 latency above your threshold for more than 10 minutes
- login/register failures spike
