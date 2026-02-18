from pathlib import Path
import os
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# ======================================================
# 🔐 SEGURIDAD
# ======================================================

SECRET_KEY = os.environ.get(
    "SECRET_KEY",
    "clave-insegura-solo-para-desarrollo"
)

DEBUG = True
ALLOWED_HOSTS = []


#DEBUG = os.environ.get("DEBUG", "False") == "False"

#ALLOWED_HOSTS = os.environ.get(
    #"ALLOWED_HOSTS",
    #"127.0.0.1,localhost"
#).split(",")

LOGIN_URL = '/login/'

# ======================================================
# 📦 APLICACIONES
# ======================================================

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'core.apps.CoreConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'punto_venta.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'core.context_processors.notificaciones_context',
                'core.context_processors.sucursal_context',
            ],
        },
    },
]

WSGI_APPLICATION = 'punto_venta.wsgi.application'

# ======================================================
# 🗄 BASE DE DATOS
# ======================================================

DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    # 🔴 PRODUCCIÓN (Render - PostgreSQL)
    DATABASES = {
        'default': dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            ssl_require=True
        )
    }
else:
    # 🟢 DESARROLLO (SQLite local)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# ======================================================
# 🌍 INTERNACIONALIZACIÓN
# ======================================================

LANGUAGE_CODE = 'es-mx'
TIME_ZONE = 'America/Mexico_City'
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'core.Usuario'

# ======================================================
# 📂 STATIC Y MEDIA
# ======================================================

STATIC_URL = '/static/'
STATICFILES_DIRS = [os.path.join(BASE_DIR, "static")]
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# ======================================================
# 🔒 SEGURIDAD EN PRODUCCIÓN
# ======================================================

#if not DEBUG:
    #CSRF_COOKIE_SECURE = True
    #SESSION_COOKIE_SECURE = True
    #SECURE_SSL_REDIRECT = True
    #SECURE_BROWSER_XSS_FILTER = True
    #SECURE_CONTENT_TYPE_NOSNIFF = True
