#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'punto_venta.settings')

    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable?"
        ) from exc

    # 🔥 FIX PARA PYINSTALLER
    if getattr(sys, 'frozen', False):
        # Ejecutable .exe
        execute_from_command_line([sys.argv[0], 'runserver', '--noreload'])
    else:
        # Desarrollo normal
        execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
