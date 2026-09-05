"""Isolated local/test database; never connect tests to a configured remote DB."""
import os
from .settings import *  # noqa: F403

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': os.environ.get('GENT_TEST_DATABASE', ':memory:')}}
DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']
SECURE_SSL_REDIRECT = False
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
