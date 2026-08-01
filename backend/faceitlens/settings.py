import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")
DEBUG = os.environ.get("DEBUG", "True") == "True"

# Safety net: never run in production with the public dev key from the repo.
if not DEBUG and SECRET_KEY == "dev-only-change-me":
    raise RuntimeError("SECRET_KEY must be set in production (env var).")

# Comma-separated list in production, e.g. "faceitlens.onrender.com"
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "tracker",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Last, so it only counts requests that made it through everything else.
    "tracker.analytics.TrafficMiddleware",
]

ROOT_URLCONF = "faceitlens.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "faceitlens.wsgi.application"

# Use Postgres if DATABASE_URL is set (Render), else local SQLite.
DATABASE_URL = os.environ.get("DATABASE_URL", "")
if DATABASE_URL:
    import dj_database_url
    DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600)}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# Cache: Redis in production so every gunicorn worker shares one cache and it
# survives redeploys. Without REDIS_URL Django falls back to per-process local
# memory, which is fine for dev but means near-zero hit rate under gunicorn.
REDIS_URL = os.environ.get("REDIS_URL", "")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
        }
    }

# CORS: set CORS_ORIGINS env to your frontend URL in production.
# If unset, allow all (fine for a public read-only API).
_cors = os.environ.get("CORS_ORIGINS", "")
if _cors:
    CORS_ALLOWED_ORIGINS = _cors.split(",")
else:
    CORS_ALLOW_ALL_ORIGINS = True

# Sessions must ride along on fetch() calls from the frontend (Sign in with
# Steam).
CORS_ALLOW_CREDENTIALS = True

# BEST: put the backend on a subdomain of the site (api.faceit-lens.com) and set
# COOKIE_DOMAIN=.faceit-lens.com — then the session cookie is first-party for
# BOTH the site and the API, so it works in Brave / Safari / everywhere.
COOKIE_DOMAIN = os.environ.get("COOKIE_DOMAIN", "")

if not DEBUG:
    if COOKIE_DOMAIN:
        # Same-site setup (shared parent domain): Lax is enough and robust.
        SESSION_COOKIE_DOMAIN = COOKIE_DOMAIN
        CSRF_COOKIE_DOMAIN = COOKIE_DOMAIN
        SESSION_COOKIE_SAMESITE = "Lax"
        CSRF_COOKIE_SAMESITE = "Lax"
    else:
        # Cross-domain fallback (onrender.com): needs SameSite=None, but modern
        # browsers block these third-party cookies (Brave/Safari).
        SESSION_COOKIE_SAMESITE = "None"
        CSRF_COOKIE_SAMESITE = "None"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# Trust the Render proxy for HTTPS / CSRF
CSRF_TRUSTED_ORIGINS = [
    o for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if o
]
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# FACEIT key - read from the environment
FACEIT_API_KEY = os.environ.get("FACEIT_API_KEY", "")
