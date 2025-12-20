#!/bin/bash
# Verification script for OpenTelemetry + Grafana LGTM integration

echo "=================================================="
echo "OpenTelemetry + LGTM Verification"
echo "=================================================="
echo ""

# Check if LGTM container is running
echo "Checking LGTM container..."
if docker ps | grep -q "gent-otel-lgtm"; then
    echo "✓ LGTM container is running"
else
    echo "❌ LGTM container is not running"
    echo "   Start it with: docker-compose up -d"
    exit 1
fi

echo ""

# Check Grafana
echo "Checking Grafana (http://localhost:3000)..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health | grep -q "200"; then
    echo "✓ Grafana is accessible"
else
    echo "⚠️  Grafana may not be ready yet, or is not accessible"
fi

echo ""

# Check Prometheus
echo "Checking Prometheus (http://localhost:9090)..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:9090/-/healthy | grep -q "200"; then
    echo "✓ Prometheus is accessible"
else
    echo "⚠️  Prometheus may not be ready yet, or is not accessible"
fi

echo ""

# Check OTLP HTTP endpoint (port 4318)
echo "Checking OTLP HTTP endpoint (localhost:4318)..."
if nc -z localhost 4318 2>/dev/null; then
    echo "✓ OTLP HTTP endpoint is listening"
else
    echo "❌ OTLP HTTP endpoint is not accessible"
fi

echo ""

# Check OTLP gRPC endpoint (port 4317)
echo "Checking OTLP gRPC endpoint (localhost:4317)..."
if nc -z localhost 4317 2>/dev/null; then
    echo "✓ OTLP gRPC endpoint is listening"
else
    echo "❌ OTLP gRPC endpoint is not accessible"
fi

echo ""
echo "=================================================="
echo "Next Steps:"
echo "=================================================="
echo ""
echo "1. Install OpenTelemetry packages (if not done):"
echo "   source venv/bin/activate"
echo "   ./setup_otel.sh"
echo ""
echo "2. Start Django server:"
echo "   python manage.py runserver"
echo ""
echo "3. Generate traffic:"
echo "   - Register a user: POST http://localhost:8000/api/register/"
echo "   - Login: POST http://localhost:8000/api/login/"
echo "   - Make API calls to create traces and metrics"
echo ""
echo "4. View telemetry in Grafana:"
echo "   http://localhost:3000 (admin/admin)"
echo ""
echo "   In Grafana, click 'Explore' and select:"
echo "   - Prometheus → Query for 'gent_' metrics"
echo "   - Loki → View Django logs"
echo "   - Tempo → View distributed traces"
echo ""
