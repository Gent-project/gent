# 🚀 Quick Demo Cheatsheet

## Pre-Demo Setup (5 min)

```bash
# 1. Start LGTM
docker-compose up -d

# 2. Start Django (separate terminal)
source venv/bin/activate
python manage.py runserver

# 3. Generate data (separate terminal)
source venv/bin/activate
python generate_telemetry.py
```

## Grafana Access

- **URL**: http://localhost:3000
- **Login**: admin / admin

---

## 📊 Part 1: Metrics (Prometheus)

**Explore → Prometheus**

```promql
# HTTP requests per second
rate(django_http_requests_total[5m])

# User registrations
gent_user_registrations_total

# Login success vs failure
gent_user_logins_total{status="success"}
gent_user_logins_total{status="failure"}

# Login success rate
sum(gent_user_logins_total{status="success"}) / sum(gent_user_logins_total) * 100

# Response time P95
histogram_quantile(0.95, rate(django_http_request_duration_seconds_bucket[5m]))
```

**Show**: Graphs, trends, business metrics

---

## 🔍 Part 2: Traces (Tempo)

**Explore → Tempo → Search**

- Filter by: `service_name = gent-api`
- Click on any trace
- Show: Request flow, timing, database queries

**Point out:**
- Full request lifecycle
- Performance bottlenecks
- Database query details
- Error stack traces

---

## 📝 Part 3: Logs (Loki)

**Explore → Loki**

```logql
# All logs
{service_name="gent-api"}

# Errors only
{service_name="gent-api"} |= "ERROR"

# Login events
{service_name="gent-api"} |= "login"
```

**Show**: Centralized logs, easy filtering

---

## 📈 Part 4: Dashboard

**Dashboards → Import → grafana_dashboard.json**

**Show**: Pre-built dashboard with all key metrics

---

## 🎯 Key Messages

1. **Three Pillars**: Metrics (what) + Traces (why) + Logs (details)
2. **Automatic**: OpenTelemetry auto-instruments everything
3. **Business-Level**: Track registrations, logins, not just infra
4. **Production-Ready**: Single LGTM container, scalable
5. **Developer-Friendly**: Easy debugging, rich context

---

## 🔧 Troubleshooting

```bash
# Check LGTM
docker ps | grep gent-otel-lgtm

# Check Django
curl http://localhost:8000/api/health/

# Generate more data
python generate_telemetry.py
```

---

## 📚 If Asked

**"What is OpenTelemetry?"**
→ Industry standard for observability, vendor-neutral

**"How does it work?"**
→ Auto-instruments Django → Captures spans → Exports via OTLP → LGTM stores & visualizes

**"Why LGTM?"**
→ All-in-one stack (Prometheus + Loki + Tempo + Grafana), perfect for dev/small prod

**"Difference between metrics/traces/logs?"**
→ Metrics = aggregated numbers, Traces = per-request details, Logs = event details

---

## ⚡ Quick Win Demos

1. **Show failing login in metrics** → Jump to Tempo → See trace with error
2. **Show slow request in Tempo** → Note time → Find logs in Loki
3. **Create alert** for high error rate (if time permits)

---

## ✅ Pre-Demo Checklist

- [ ] LGTM running
- [ ] Django running
- [ ] Data generated
- [ ] Grafana accessible
- [ ] Dashboard imported
- [ ] Can query all 3 (Prometheus, Tempo, Loki)

---

**Total Demo Time**: 15-20 minutes
**Impression**: Production-grade observability stack 🚀
