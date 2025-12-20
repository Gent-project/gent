# Observability Setup - Grafana LGTM + OpenTelemetry

## What Was Fixed

### Problem
The previous setup had:
1. ❌ Standalone Prometheus and Grafana containers (NOT using LGTM image)
2. ❌ No OpenTelemetry instrumentation in Django
3. ❌ No OTLP exporters configured
4. ❌ Only Prometheus metrics scraping, no traces or logs in Grafana
5. ❌ Logs were only written to files, not sent to Loki

### Solution
Replaced the entire observability stack with **Grafana OTEL LGTM** and added **OpenTelemetry instrumentation**:

#### Changes Made

1. **Updated docker-compose.yml**
   - Replaced standalone Prometheus + Grafana with `grafana/otel-lgtm` image
   - This single container includes:
     - OpenTelemetry Collector (receives OTLP data)
     - Prometheus (stores metrics)
     - Loki (stores logs)
     - Tempo (stores traces)
     - Grafana (visualizes everything)

2. **Added OpenTelemetry Packages** (requirements.txt)
   - `opentelemetry-api` - Core OpenTelemetry API
   - `opentelemetry-sdk` - SDK implementation
   - `opentelemetry-instrumentation-django` - Auto-instrument Django
   - `opentelemetry-instrumentation-requests` - Auto-instrument HTTP requests
   - `opentelemetry-instrumentation-logging` - Send logs as traces
   - `opentelemetry-exporter-otlp` - Export to LGTM via OTLP protocol

3. **Configured OpenTelemetry in Django** (gent_api/settings.py)
   - Configured TracerProvider (for traces)
   - Configured MeterProvider (for metrics)
   - Configured LoggingInstrumentor (for logs)
   - Set up OTLP HTTP exporters to send data to localhost:4318
   - Auto-instrumented Django requests, database queries, and HTTP calls

4. **Updated Environment Variables** (.env and .env.example)
   - `OTEL_ENABLED=True` - Enable/disable OpenTelemetry
   - `OTEL_SERVICE_NAME=gent-api` - Service name in traces
   - `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` - LGTM endpoint

---

## How It Works Now

### Data Flow

```
Django App
    ↓ (OTLP HTTP)
OpenTelemetry Collector (in LGTM)
    ↓
    ├→ Prometheus (metrics)
    ├→ Loki (logs)
    └→ Tempo (traces)
           ↓
       Grafana (visualization)
```

### What Gets Collected

1. **Traces** (via Tempo)
   - HTTP request spans
   - Database query spans
   - External API call spans
   - Middleware execution spans
   - Full distributed tracing across services

2. **Metrics** (via Prometheus)
   - Django built-in metrics (from django-prometheus)
   - Custom business metrics (user registrations, logins, etc.)
   - OpenTelemetry metrics (request duration, error rates, etc.)

3. **Logs** (via Loki)
   - Django application logs
   - Request/response logs
   - Error logs with full context
   - Structured JSON logs

---

## Setup Instructions

### 1. Install OpenTelemetry Packages

```bash
# Activate your virtual environment
source venv/bin/activate

# Run the setup script
./setup_otel.sh
```

Or manually:
```bash
pip install -r requirements.txt
```

### 2. Verify the Setup

```bash
./verify_otel.sh
```

This checks that:
- ✓ LGTM container is running
- ✓ Grafana is accessible (port 3000)
- ✓ Prometheus is accessible (port 9090)
- ✓ OTLP endpoints are listening (ports 4317, 4318)

### 3. Start Django Server

```bash
python manage.py runserver
```

Django will now automatically:
- Send traces to Tempo
- Send metrics to Prometheus
- Send logs to Loki

### 4. Generate Traffic

Make some API calls to generate telemetry data:

```bash
# Register a user
curl -X POST http://localhost:8000/api/register/ \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123!@#"}'

# Login
curl -X POST http://localhost:8000/api/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123!@#"}'

# Check metrics endpoint
curl http://localhost:8000/metrics
```

---

## Viewing Data in Grafana

### Access Grafana

1. Open: http://localhost:3000
2. Login: `admin` / `admin`

### Explore Metrics (Prometheus)

1. Click **Explore** (compass icon in sidebar)
2. Select **Prometheus** from the dropdown
3. Query examples:
   ```promql
   # View registration metrics
   gent_user_registrations_total

   # View login metrics
   gent_user_logins_total

   # HTTP request rate
   rate(django_http_requests_total[5m])

   # HTTP request duration
   django_http_request_duration_seconds

   # Database query counts
   django_db_query_total
   ```

### Explore Logs (Loki)

1. Click **Explore**
2. Select **Loki** from the dropdown
3. Query examples:
   ```logql
   # All logs from gent-api
   {service_name="gent-api"}

   # Error logs only
   {service_name="gent-api"} |= "ERROR"

   # Logs from a specific module
   {service_name="gent-api"} |= "api.views"

   # Filter by log level
   {service_name="gent-api"} | json | level="ERROR"
   ```

### Explore Traces (Tempo)

1. Click **Explore**
2. Select **Tempo** from the dropdown
3. Search for traces:
   - By Service Name: `gent-api`
   - By HTTP Status Code
   - By Duration (find slow requests)

4. Click on a trace to see:
   - Full request lifecycle
   - Database query timing
   - Middleware execution order
   - External API calls
   - Error stack traces

---

## Creating Dashboards

### Quick Start Dashboard

1. In Grafana, click **Dashboards** → **New** → **Import**
2. Use dashboard ID: `12544` (Django Prometheus)
3. Select **Prometheus** as the data source
4. Click **Import**

### Custom Dashboard for Business Metrics

Create panels for:
- User registration rate: `rate(gent_user_registrations_total[5m])`
- Login success rate: `rate(gent_user_logins_total{status="success"}[5m])`
- Login failure rate: `rate(gent_user_logins_total{status="failure"}[5m])`
- Token refresh rate: `rate(gent_token_refreshes_total[5m])`

---

## Troubleshooting

### Logs Not Appearing in Loki

**Issue**: Django logs are not showing up in Loki.

**Solution**: OpenTelemetry LoggingInstrumentor sends logs as trace events, not directly to Loki. To see logs:
1. Go to Explore → Tempo
2. Find a trace
3. Click on spans to see associated log events

Alternatively, the logs are still being written to `logs/django.log` as a backup.

### Traces Not Appearing in Tempo

**Check**:
1. Is LGTM container running? `docker ps | grep gent-otel-lgtm`
2. Is Django sending data? Check logs for OTLP errors
3. Is the endpoint correct? Should be `http://localhost:4318`

**Debug**:
```bash
# Check OTLP collector logs
docker logs gent-otel-lgtm

# Test OTLP endpoint
curl -v http://localhost:4318/v1/traces
```

### Metrics Not Appearing in Prometheus

**Check**:
1. Is Prometheus scraping the old /metrics endpoint? (Still works via django-prometheus)
2. Are OpenTelemetry metrics being sent? Check Django startup logs

**View Prometheus targets**:
http://localhost:9090/targets

### No Data in Grafana

**Generate some traffic first!**
- The LGTM stack is working, but you need to make API requests to generate data
- Try the example curl commands above
- Check that Django is running with OpenTelemetry enabled

---

## Key Differences from Before

| Before | After |
|--------|-------|
| Standalone Prometheus + Grafana | All-in-one LGTM container |
| Only metrics scraping | Traces, metrics, AND logs |
| No OpenTelemetry | Full OpenTelemetry instrumentation |
| Logs only to files | Logs sent to Loki (and files) |
| No distributed tracing | Complete request tracing |
| Manual metric instrumentation | Auto-instrumentation + custom metrics |

---

## Configuration Options

### Disable OpenTelemetry

In `.env`:
```bash
OTEL_ENABLED=False
```

This disables OTLP exports but keeps Sentry and Prometheus working.

### Change Service Name

In `.env`:
```bash
OTEL_SERVICE_NAME=my-custom-service-name
```

### Use gRPC Instead of HTTP

In `.env`:
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

And update `gent_api/settings.py` to use:
```python
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
```

---

## Ports Reference

| Port | Service | URL |
|------|---------|-----|
| 3000 | Grafana UI | http://localhost:3000 |
| 4317 | OTLP gRPC | grpc://localhost:4317 |
| 4318 | OTLP HTTP | http://localhost:4318 |
| 9090 | Prometheus UI | http://localhost:9090 |
| 8000 | Django API | http://localhost:8000 |

---

## Next Steps

1. **Create Alerts**
   - Set up Grafana alerts for error rates, slow requests, etc.
   - Configure alert notifications (email, Slack, etc.)

2. **Build Dashboards**
   - Create business metric dashboards
   - Create SLI/SLO dashboards
   - Create debug dashboards for development

3. **Optimize Sampling**
   - Adjust trace sampling rates for production
   - Configure metric export intervals
   - Set log levels appropriately

4. **Production Deployment**
   - Move LGTM to a separate server
   - Configure remote OTLP endpoint
   - Set up authentication for Grafana
   - Configure data retention policies

---

## Resources

- [Grafana LGTM Documentation](https://github.com/grafana/docker-otel-lgtm)
- [OpenTelemetry Python Documentation](https://opentelemetry.io/docs/instrumentation/python/)
- [Django Instrumentation](https://opentelemetry-python-contrib.readthedocs.io/en/latest/instrumentation/django/django.html)
- [Grafana Documentation](https://grafana.com/docs/)
