"""Explicit disposable local PostgreSQL database for locking/durability tests."""
from .test_settings import *  # noqa: F403
import os

DATABASES = {'default': {
    'ENGINE': 'django.db.backends.postgresql',
    'NAME': os.environ.get('GENT_TEST_POSTGRES_DATABASE', 'postgres'), 'USER': 'gent_test', 'PASSWORD': '',
    'HOST': '127.0.0.1', 'PORT': os.environ.get('GENT_TEST_POSTGRES_PORT', '55439'),
    'TEST': {'NAME': 'test_gent_compat'},
}}
