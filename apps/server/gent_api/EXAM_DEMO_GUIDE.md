# Exam Demo Guide - Complete Observability Stack

This guide will help you demonstrate your complete observability setup using **Grafana LGTM + OpenTelemetry + Sentry + Prometheus** for your exam.

---

## 🚀 Quick Start (5 Minutes Before Exam)

### 1. Start Everything

```bash
# Start Grafana LGTM stack
docker-compose up -d

# Verify LGTM is running
./verify_otel.sh

# Start Django server (in a separate terminal)
source venv/bin/activate
python manage.py runserver
```

### 2. Generate Telemetry Data

```bash
# In another terminal, generate comprehensive telemetry
source venv/bin/activate
python generate_telemetry.py
```

This will create:
- ✅ 20 user registrations
- ✅ 20+ successful logins
- ✅ 10 failed login attempts (for error tracking)
- ✅ 100+ API requests
- ✅ Token refreshes and logouts
- ✅ Comprehensive traces, metrics, and logs

**Wait 30 seconds** for data to be ingested into Grafana.

### 3. Open Grafana

```bash
open http://localhost:3000
```

Login: `admin` / `admin`

---

## 📊 Demo Script (What to Show)

### Part 1: Architecture Overview (2 minutes)

**Explain the Stack:**

```
┌─────────────────┐
│   Django API    │  ← Your application
│  (gent-api)     │
└────────┬────────┘
         │ OTLP (HTTP/gRPC)
         ↓
┌─────────────────────────────────┐
│   Grafana OTEL LGTM Container   │
│  ┌──────────────────────────┐   │
│  │ OpenTelemetry Collector  │   │  ← Receives telemetry
│  └────────┬─────────────────┘   │
│           ↓                      │
│  ┌────────────────────┐         │
│  │ • Prometheus       │         │  ← Stores metrics
│  │ • Loki            │         │  ← Stores logs
│  │ • Tempo           │         │  ← Stores traces
│  │ • Grafana         │         │  ← Visualizes all
│  └────────────────────┘         │
└─────────────────────────────────┘
```

**Key Points:**
- Single all-in-one observability stack
- OpenTelemetry for standardized instrumentation
- Automatic collection of traces, metrics, and logs
- No manual configuration needed

---

### Part 2: Metrics (Prometheus) - 3 minutes

#### Show Built-in Django Metrics

1. Click **Explore** (compass icon)
2. Select **Prometheus** from dropdown
3. Run these queries:

**HTTP Request Rate:**
```promql
rate(django_http_requests_total[5m])
```
Shows requests per second across all endpoints.

**HTTP Request Duration (P95):**
```promql
histogram_quantile(0.95, rate(django_http_request_duration_seconds_bucket[5m]))
```
Shows 95th percentile response time.

**Database Query Count:**
```promql
django_db_query_total
```
Shows total database queries.

#### Show Custom Business Metrics

**User Registrations:**
```promql
gent_user_registrations_total
```

**Login Success vs Failure:**
```promql
gent_user_logins_total{status="success"}
gent_user_logins_total{status="failure"}
```

**Login Success Rate (%):**
```promql
sum(gent_user_logins_total{status="success"})
/
sum(gent_user_logins_total) * 100
```

**Login Rate Over Time:**
```promql
rate(gent_user_logins_total{status="success"}[5m])
```

**Token Refreshes:**
```promql
gent_token_refreshes_total
```

---

### Part 3: Distributed Tracing (Tempo) - 4 minutes

#### Find Traces

1. Click **Explore**
2. Select **Tempo** from dropdown
3. Click **Search**
4. Filter by:
   - **Service Name**: `gent-api`
   - **Status**: Select `error` to see failed requests

#### Analyze a Trace

Click on any trace to see:

**What to Point Out:**
- ✅ **Full request lifecycle** - HTTP request → middleware → view → database → response
- ✅ **Timing breakdown** - Which parts took longest?
- ✅ **Span details** - HTTP method, status code, URL
- ✅ **Database queries** - See exact SQL queries and their duration
- ✅ **Error context** - Stack traces for failed requests

**Example trace analysis:**
```
Trace: POST /api/login/
├─ django.middleware.security (2ms)
├─ django.middleware.csrf (1ms)
├─ api.views.login_view (45ms)
│  ├─ Database query: SELECT * FROM users WHERE email=? (12ms)
│  └─ JWT token generation (28ms)
└─ Response sent (200 OK)

Total: 48ms
```

**What This Shows:**
- Can identify performance bottlenecks
- Database queries that need optimization
- Middleware overhead
- Error propagation

---

### Part 4: Logs (Loki) - 3 minutes

#### View Application Logs

1. Click **Explore**
2. Select **Loki** from dropdown
3. Run these queries:

**All logs from gent-api:**
```logql
{service_name="gent-api"}
```

**Error logs only:**
```logql
{service_name="gent-api"} |= "ERROR"
```

**Login-related logs:**
```logql
{service_name="gent-api"} |= "login"
```

**Filter by HTTP status:**
```logql
{service_name="gent-api"} | json | status_code="401"
```

**What to Point Out:**
- ✅ Centralized log aggregation
- ✅ Structured JSON logs
- ✅ Easy filtering and searching
- ✅ Correlation with traces (via trace_id)

---

### Part 5: Dashboard - 3 minutes

#### Import Pre-built Dashboard

1. Click **Dashboards** → **New** → **Import**
2. Click **Upload JSON file**
3. Select `grafana_dashboard.json`
4. Click **Load**
5. Select **Prometheus** as data source
6. Click **Import**

**The dashboard shows:**
- 📊 Total user registrations (stat panel)
- 📈 Login rate over time (success vs failure)
- 📊 Login attempts by status (stacked bars)
- 🎯 Login success rate gauge
- 📊 Token refreshes and logouts
- 📈 HTTP request duration (P50/P95)

**Walk through each panel** and explain what it shows.

---

### Part 6: Integration Benefits - 2 minutes

#### Correlation Between Signals

**Show how everything connects:**

1. **From Metric to Trace:**
   - See high error rate in metrics → Click timestamp
   - Jump to Tempo → Find failing traces
   - Identify root cause

2. **From Trace to Logs:**
   - See slow trace in Tempo → Note timestamp
   - Jump to Loki → Filter by time range
   - See application logs during that time

3. **Business Metrics to Technical Metrics:**
   - High failed login rate (`gent_user_logins_total{status="failure"}`)
   - Correlate with HTTP 401 errors (`django_http_responses_total{status="401"}`)
   - Jump to traces to see why authentication is failing

---

## 🎯 Key Points to Emphasize

### 1. **Complete Observability** (The Three Pillars)
- ✅ **Metrics** - What is happening? (rates, durations, counts)
- ✅ **Traces** - Why is it happening? (request flows, bottlenecks)
- ✅ **Logs** - What exactly happened? (details, errors)

### 2. **Automatic Instrumentation**
- No manual logging in every function
- OpenTelemetry auto-instruments Django
- Captures HTTP requests, database queries, middleware automatically

### 3. **Business-Level Observability**
- Not just infrastructure metrics
- Track actual business events (registrations, logins, etc.)
- Understand user behavior and system health

### 4. **Production-Ready**
- Single container (LGTM) includes everything
- Scalable (can run LGTM separately in production)
- Standards-based (OpenTelemetry is vendor-neutral)

### 5. **Developer Experience**
- Easy to debug issues
- Fast to identify bottlenecks
- Rich context for every request

---

## 🔍 Advanced Demo (If Time Permits)

### Create a Custom Dashboard Panel

1. Go to Dashboard
2. Click **Add panel** → **Add a new panel**
3. Select **Prometheus** data source
4. Enter query: `rate(gent_user_logins_total[5m])`
5. Change visualization type to **Time series**
6. Add legend: `{{status}}`
7. Save

### Show Log-Trace Correlation

1. Find a trace ID in Tempo (e.g., `abc123...`)
2. Go to Loki
3. Query: `{service_name="gent-api"} |= "abc123"`
4. Show logs associated with that specific request

### Create an Alert

1. Go to **Alerting** → **Alert rules**
2. Click **New alert rule**
3. Name: "High Login Failure Rate"
4. Query:
   ```promql
   rate(gent_user_logins_total{status="failure"}[5m]) > 0.1
   ```
5. Set threshold and notification channel
6. Save

---

## 📋 Troubleshooting During Demo

### No Data in Grafana?

**Check:**
```bash
# Is LGTM running?
docker ps | grep gent-otel-lgtm

# Is Django sending data?
curl http://localhost:4318/v1/traces

# Generate more data
python generate_telemetry.py
```

### Slow Query Performance?

**This is actually a demo opportunity!**
- Show in Tempo which queries are slow
- Explain how you'd optimize them
- Show metrics before/after optimization

### Dashboard Not Loading?

**Fallback:**
- Use **Explore** mode instead
- Manually run queries
- Still demonstrates full observability

---

## 🎓 Exam Questions You Can Answer

### Q: "How do you monitor application performance?"
**A:** Show Prometheus metrics (request duration, database query time) and Tempo traces for detailed request flows.

### Q: "How do you debug production issues?"
**A:** Show Loki logs filtered by error level, then jump to Tempo to see the full trace, then check metrics for trends.

### Q: "How do you track business metrics?"
**A:** Show custom Prometheus metrics (`gent_user_registrations_total`, etc.) tracked using the `api/metrics.py` module.

### Q: "What's the difference between metrics, traces, and logs?"
**A:** Demonstrate:
- **Metrics**: Show graph of login rates (aggregated, numerical)
- **Traces**: Show individual request spans (detailed, per-request)
- **Logs**: Show text logs for a specific event (detailed, chronological)

### Q: "How does OpenTelemetry work?"
**A:** Explain:
1. Auto-instrumentation wraps Django code
2. Captures spans automatically (HTTP, DB, etc.)
3. Exports via OTLP to collector
4. Collector routes to Prometheus/Loki/Tempo
5. Grafana visualizes everything

---

## 🎬 Demo Checklist

Before your exam, verify:

- [ ] LGTM container is running (`docker ps`)
- [ ] Django server is running (`http://localhost:8000/api/health/`)
- [ ] Telemetry data has been generated (`python generate_telemetry.py`)
- [ ] Grafana is accessible (`http://localhost:3000`)
- [ ] Dashboard is imported
- [ ] Can query Prometheus metrics
- [ ] Can view Tempo traces
- [ ] Can search Loki logs
- [ ] Have this guide open for reference

---

## 📖 Further Reading

If examiner asks for more details:

- **OpenTelemetry**: "Industry standard for observability, supported by all major vendors"
- **LGTM**: "All-in-one stack from Grafana Labs, perfect for development and small deployments"
- **Prometheus**: "Pull-based metrics, CNCF graduated project, industry standard"
- **Tempo**: "Distributed tracing backend, integrates with Grafana"
- **Loki**: "Log aggregation, designed to work seamlessly with Grafana"

---

## 🎉 Summary

You now have:
- ✅ Complete observability stack (LGTM)
- ✅ Automatic instrumentation (OpenTelemetry)
- ✅ Pre-generated telemetry data
- ✅ Pre-built dashboard
- ✅ Comprehensive demo script

**Total setup time**: ~5 minutes
**Demo duration**: ~15-20 minutes
**Complexity**: Production-grade

Good luck with your exam! 🚀
