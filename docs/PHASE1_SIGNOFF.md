# Phase 1 Sign-off (Production Reliability)

Date: 2026-05-09

## Exit criteria checklist

- [x] Health probes implemented (`/api/v1/health`, `/api/v1/health/ready`)
- [x] Structured API/worker logging with correlation IDs
- [x] Centralized log shipping stack + alert rules in repo
- [x] Automated backup script (Postgres + Redis + checksums)
- [x] Restore drill verification script
- [x] Backup retention support (14/30-day configurable)
- [x] Optional backup encryption support (GPG)
- [x] Off-host copy hook support (`OFFSITE_COPY_CMD`)
- [x] Nightly backup cron installer
- [x] Production rolling restart automation
- [x] Production deploy wrapper (backup → pull/build → migrate → rolling restart → smoke)
- [x] Runbooks documented

## Evidence

- Backup success:
  - Path: `backups/20260509-101407`
  - Result: `Backup completed`
- Restore drill success:
  - Command: `npm run ops:restore-drill -- backups/20260509-101407`
  - Result: `Restore drill passed`
  - Integrity sample: `Journal rows: 18`, `Submission rows: 24`, `Redis backup bytes: 297`
- E2E reliability gate:
  - `npm run test:e2e:ci` passed (4/4)
- Deployment automation dry run:
  - Command: `COMPOSE_FILE=docker-compose.prod.yml DRY_RUN=true npm run ops:deploy-prod`
  - Result: all 6 deployment steps printed successfully

## Production follow-through required by ops

- [ ] Set real prod image tags/digests in `.env.prod`
- [ ] Create `.env.prod` and `.env.prod.secrets` from examples
- [ ] Configure Alertmanager receiver endpoint (Slack/PagerDuty/webhook)
- [ ] Configure off-host backup target command (`OFFSITE_COPY_CMD`)
- [ ] Run first production deploy with `npm run ops:deploy-prod`

## Conclusion

Phase 1 reliability implementation is complete in-repo for the single-server Docker Compose architecture, with operational activation steps listed above for the live production environment.
