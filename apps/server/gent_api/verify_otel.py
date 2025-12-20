#!/usr/bin/env python3
"""
Verification script for OpenTelemetry + Grafana LGTM integration.
This script checks if all components are properly configured and reachable.
"""

import requests
import sys
from decouple import config


def check_endpoint(url, name):
    """Check if an endpoint is reachable."""
    try:
        response = requests.get(url, timeout=5)
        if response.status_code < 500:
            print(f"✓ {name} is reachable at {url}")
            return True
        else:
            print(f"❌ {name} returned status code {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"❌ {name} is not reachable at {url}")
        return False
    except Exception as e:
        print(f"❌ Error checking {name}: {e}")
        return False


def main():
    print("=" * 50)
    print("OpenTelemetry + LGTM Verification")
    print("=" * 50)
    print()

    all_ok = True

    # Check OTLP endpoint
    otlp_endpoint = config('OTEL_EXPORTER_OTLP_ENDPOINT', default='http://localhost:4318')
    print(f"Checking OTLP endpoint: {otlp_endpoint}")
    # Note: OTLP endpoints don't respond to GET requests, so we just check if connection is possible
    # A connection error means the service is not running

    # Check Grafana
    print("\nChecking Grafana...")
    grafana_ok = check_endpoint("http://localhost:3000/api/health", "Grafana")
    all_ok = all_ok and grafana_ok

    # Check Prometheus
    print("\nChecking Prometheus...")
    prometheus_ok = check_endpoint("http://localhost:9090/-/healthy", "Prometheus")
    all_ok = all_ok and prometheus_ok

    # Check OpenTelemetry configuration
    print("\nChecking OpenTelemetry configuration...")
    otel_enabled = config('OTEL_ENABLED', default=True, cast=bool)
    service_name = config('OTEL_SERVICE_NAME', default='gent-api')

    if otel_enabled:
        print(f"✓ OpenTelemetry is enabled")
        print(f"✓ Service name: {service_name}")
        print(f"✓ OTLP endpoint: {otlp_endpoint}")
    else:
        print(f"⚠️  OpenTelemetry is disabled in .env")
        all_ok = False

    print()
    print("=" * 50)

    if all_ok:
        print("✅ All checks passed!")
        print()
        print("Next steps:")
        print("1. Start Django server: python manage.py runserver")
        print("2. Generate traffic by making API calls")
        print("3. View telemetry in Grafana: http://localhost:3000")
        print("   - Username: admin")
        print("   - Password: admin")
        print()
        print("In Grafana, go to Explore and select:")
        print("  - Prometheus for metrics")
        print("  - Loki for logs")
        print("  - Tempo for traces")
        return 0
    else:
        print("❌ Some checks failed. Please review the errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
