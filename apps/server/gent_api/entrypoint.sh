#!/bin/bash

# Exit on error
set -e

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  echo "Creating superuser..."
  python manage.py createsuperuser --noinput --username "$DJANGO_SUPERUSER_USERNAME" --email "$DJANGO_SUPERUSER_EMAIL" 2>/dev/null || echo "Superuser already exists or missing email."
fi

echo "Starting Gunicorn server..."
exec gunicorn --bind 0.0.0.0:8000 --workers 2 --timeout 120 gent_api.wsgi:application
