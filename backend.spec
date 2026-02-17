# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_all

drf_datas, drf_binaries, drf_hiddenimports = collect_all('rest_framework')

a = Analysis(
    ['manage.py'],
    pathex=[],
    binaries=drf_binaries,
    datas=[
    ('static', 'static'),
    ('core/templates', 'core/templates'),
    ] + drf_datas,
    hiddenimports=drf_hiddenimports + [
        'django.contrib.auth',
        'django.contrib.contenttypes',
        'django.contrib.sessions',
        'django.contrib.messages',
        'django.contrib.staticfiles',
        'whitenoise',
        'whitenoise.middleware',
        'whitenoise.storage',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
)

