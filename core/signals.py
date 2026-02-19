from django.db.models.signals import post_migrate
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from core.models import Sucursal

User = get_user_model()


@receiver(post_migrate)
def inicializar_sistema(sender, **kwargs):

    # =========================
    # 1️⃣ Crear sucursal si no existe
    # =========================
    if not Sucursal.objects.exists():
        sucursal = Sucursal.objects.create(
            nombre="Sucursal Principal",
            activa=True
        )
        print("Sucursal Principal creada ✅")
    else:
        sucursal = Sucursal.objects.first()

    # =========================
    # 2️⃣ Crear admin si no existe
    # =========================

def inicializar_sistema(sender, **kwargs):
    if not User.objects.filter(username="admin").exists():
        User.objects.create_superuser(
            username="admin",
            email="admin@admin.com",
            password="Admin1234"
        )
        print("Usuario admin creado ✅")
    else:
        print("Usuario admin ya existe ⚠️")
