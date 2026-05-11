#!/bin/bash

# Exit on error
set -e

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  echo "Ensuring superuser exists..."
  python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gent_api.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
username = os.environ['DJANGO_SUPERUSER_USERNAME']
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', '')
password = os.environ['DJANGO_SUPERUSER_PASSWORD']
user, created = User.objects.get_or_create(username=username, defaults={'email': email, 'is_staff': True, 'is_superuser': True})
if not created:
    user.is_staff = True
    user.is_superuser = True
    if email:
        user.email = email
user.set_password(password)
user.save()
print('Superuser %s %s' % (username, 'created' if created else 'updated'))
"
fi

echo "Starting Gunicorn server..."
exec gunicorn --bind 0.0.0.0:8000 --workers 2 --timeout 120 gent_api.wsgi:application
