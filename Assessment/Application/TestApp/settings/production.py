"""
Production settings for testapp.
"""

import os
from .base import *  # Import all common settings

# Override Debug for Production
DEBUG = False

# Allowed Hosts (Use Load Balancer DNS)
ALLOWED_HOSTS = [
    os.getenv("ALLOWED_HOST", "your-load-balancer-dns.sa-east-1.elb.amazonaws.com")
]

# Database Configuration for AWS RDS or other production database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

# Security Best Practices
SECURE_SSL_REDIRECT = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
X_FRAME_OPTIONS = "DENY"

# Logging (Store logs in a file)
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "file": {
            "level": "ERROR",
            "class": "logging.FileHandler",
            "filename": "/var/log/django_error.log",
        },
    },
    "root": {
        "handlers": ["file"],
        "level": "ERROR",
    },
}
