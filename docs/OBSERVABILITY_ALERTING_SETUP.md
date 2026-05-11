# Centralized Logging + Alerting (Phase 1)

## Stack

- Loki (log store)
- Promtail (Docker log shipping)
- Alertmanager (alert routing)
- Grafana (dashboards)

Compose file: `ops/observability/docker-compose.observability.yml`

## Start / Stop

```bash
npm run ops:obs:up
npm run ops:obs:down
```

Endpoints:

- Loki: `http://localhost:3100`
- Alertmanager: `http://localhost:9093`
- Grafana: `http://localhost:3001` (`admin` / `admin`)

## Alerts configured

Rules file: `ops/observability/loki/rules/publication-alerts.yml`

1. `ApiRequestErrorsDetected`
   - Trigger: `api.request.error` events in API logs
2. `WorkerJobFailuresDetected`
   - Trigger: `worker.job.failed` events in worker logs
3. `ApiReadinessEndpointDegraded`
   - Trigger: 5xx responses for `/api/v1/health/ready` in API logs

## Alert routing

Alertmanager config: `ops/observability/alertmanager/alertmanager.yml`

Default receiver is a webhook placeholder:

- `http://127.0.0.1:5001/alerts`

Replace with your real webhook/PagerDuty/Slack integration endpoint.

## Validation checklist

1. Generate a controlled API error and confirm `ApiRequestErrorsDetected`.
2. Force a worker job failure and confirm `WorkerJobFailuresDetected`.
3. Simulate readiness failure and confirm `ApiReadinessEndpointDegraded`.
