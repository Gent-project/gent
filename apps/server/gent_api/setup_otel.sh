#!/bin/bash
# Setup script for OpenTelemetry integration with Grafana LGTM

echo "==================================="
echo "OpenTelemetry + LGTM Setup Script"
echo "==================================="
echo ""

# Check if virtual environment is activated
if [ -z "$VIRTUAL_ENV" ]; then
    echo "⚠️  WARNING: No virtual environment detected!"
    echo "Please activate your virtual environment first:"
    echo "  source venv/bin/activate"
    echo ""
    exit 1
fi

echo "✓ Virtual environment detected: $VIRTUAL_ENV"
echo ""

# Install OpenTelemetry packages
echo "📦 Installing OpenTelemetry packages..."
pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✓ Packages installed successfully"
else
    echo "❌ Failed to install packages"
    exit 1
fi

echo ""
echo "==================================="
echo "✅ Setup Complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Start Django server:"
echo "   python manage.py runserver"
echo ""
echo "2. Generate some traffic:"
echo "   - Register a user"
echo "   - Login"
echo "   - Make some API calls"
echo ""
echo "3. Access Grafana:"
echo "   http://localhost:3000"
echo "   Username: admin"
echo "   Password: admin"
echo ""
echo "4. View your telemetry data:"
echo "   - Explore → Prometheus (metrics)"
echo "   - Explore → Loki (logs)"
echo "   - Explore → Tempo (traces)"
echo ""
