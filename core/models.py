from django.conf import settings
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.models import User
from django.utils.crypto import get_random_string
import string


class Usuario(AbstractUser):
    ROLES = (('ADMIN', 'ADMINISTRADOR'), ('USUARIO', 'USUARIO'))
    rol = models.CharField(max_length=10, choices=ROLES, default='ADMIN')  

    groups = models.ManyToManyField(
        'auth.Group',
        related_name='usuario_groups',  # Cambia el related_name para evitar conflictos
        blank=True
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='usuario_permissions',  # Cambia el related_name para evitar conflictos
        blank=True
    )

class Vendedor(models.Model):
    nombre = models.CharField(max_length=100)
    direccion = models.CharField(max_length=100)
    telefono = models.CharField(max_length=15)

    def __str__(self):
        return self.nombre
    

class Categoria(models.Model):
    nombre = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.nombre


class Producto(models.Model):
    no_folio = models.CharField(max_length=10)
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)
    categoria = models.ForeignKey(Categoria, on_delete=models.CASCADE)
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField()

    def __str__(self):
        return self.nombre


def generar_folio_secuencial():
    ultima_venta = Venta.objects.order_by('-id').first()
    if ultima_venta and ultima_venta.no_venta.isdigit():
        nuevo_numero = int(ultima_venta.no_venta) + 1
    else:
        nuevo_numero = 1
    return str(nuevo_numero).zfill(5)  # Resultado: '00001', '00002', ...
        
class Venta(models.Model):
    TIPO_CLIENTE_CHOICES = [
        ('publico', 'Público en general'),
        ('mayorista', 'Mayorista'),
    ]
    no_venta = models.CharField(max_length=5, unique=True, default=generar_folio_secuencial)
    tipo_cliente = models.CharField(max_length=10, choices=TIPO_CLIENTE_CHOICES)
    vendedor = models.ForeignKey('Vendedor', on_delete=models.PROTECT, related_name='ventas')
    fecha = models.DateTimeField(auto_now_add=True)
    pagado = models.BooleanField(default=False)
    cancelada = models.BooleanField(default=False)
    fecha_cancelacion = models.DateTimeField(null=True, blank=True)
    descuento = models.IntegerField(default=0)  # Por defecto 0 si no hay descuento



    def __str__(self):
        return f'{self.no_venta} - {self.vendedor}'

class VentaDetalle(models.Model):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    cantidad = models.PositiveIntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=10, decimal_places=2)

    def save(self, *args, **kwargs):
        self.total = self.precio_unitario * self.cantidad
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.producto.nombre} - {self.cantidad} pcs'
    

class Pago(models.Model):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='pagos')
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2)
    forma_pago = models.CharField(max_length=20)  # efectivo, tarjeta, transferencia...
    fecha_pago = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Pago {self.id} - Venta {self.venta.no_venta} - Monto: {self.monto_pagado}"
