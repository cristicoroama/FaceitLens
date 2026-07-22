#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

# Auto-create the admin superuser on deploy (Render free has no shell).
# Set DJANGO_SUPERUSER_USERNAME / DJANGO_SUPERUSER_PASSWORD (and optionally
# DJANGO_SUPERUSER_EMAIL) in the environment; skipped if already exists.
if [[ -n "$DJANGO_SUPERUSER_USERNAME" && -n "$DJANGO_SUPERUSER_PASSWORD" ]]; then
  python manage.py createsuperuser --noinput || true
fi
