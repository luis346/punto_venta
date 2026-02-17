from django.conf import settings
from django.db import models, transaction
from django.db.models import Max
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.models import User
from django.utils.crypto import get_random_string
import string

class Usuario(AbstractUser):
    ROLES = (
        ('ADMIN', 'ADMINISTRADOR'),
        ('CAJA', 'CAJA'),
    )

    rol = models.CharField(max_length=10, choices=ROLES)

    # SOLO PARA CAJA
    sucursal = models.ForeignKey(
        'Sucursal',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='usuarios'
    )

    # SOLO PARA ADMIN
    sucursales = models.ManyToManyField(
        'Sucursal',
        blank=True,
        related_name='administradores'
    )


class Sucursal(models.Model):
    nombre = models.CharField(max_length=100)
    direccion = models.CharField(max_length=150)
    telefono = models.CharField(max_length=15, blank=True)
    activa = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre
    

class Vendedor(models.Model):
    sucursal = models.ForeignKey(Sucursal, on_delete=models.PROTECT)
    nombre = models.CharField(max_length=100)
    direccion = models.CharField(max_length=100)
    telefono = models.CharField(max_length=15)

    def __str__(self):
        return f"{self.nombre} ({self.sucursal})"


class Categoria(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    prefijo = models.CharField(max_length=5, unique=True)

    def __str__(self):
        return self.nombre

class Producto(models.Model):
    UNIDAD_MEDIDA = [
        ('pieza', 'PIEZA'),
        ('paquete', 'PAQUETE'),
        ('caja', 'CAJA'),
        ('granel', 'GRANEL')
    ]
    no_folio = models.CharField(
    max_length=20,
    unique=True,
    blank=True,
    null=True
    )
    referencia = models.CharField(max_length=50, blank=True, null=True, unique=True)
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)
    categoria = models.ForeignKey(Categoria, on_delete=models.CASCADE)
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    precio_mayoreo = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    unidad_medida = models.CharField(max_length=20, choices=UNIDAD_MEDIDA)
    umbral_mayoreo = models.IntegerField(default=6)

    def __str__(self):
        return self.nombre
        
    def save(self, *args, **kwargs):

        if not self.referencia and self.categoria:

            with transaction.atomic():

                secuencia, created = SecuenciaCategoria.objects.get_or_create(
                    categoria=self.categoria
                )

                secuencia.ultimo_numero += 1
                secuencia.save()

                self.referencia = f"{self.categoria.prefijo}-{secuencia.ultimo_numero:04d}"

        if not self.no_folio:
            ultimo = Producto.objects.order_by('-id').first()
            if ultimo and ultimo.no_folio and ultimo.no_folio.isdigit():
                nuevo = int(ultimo.no_folio) + 1
            else:
                nuevo = 10100001

            self.no_folio = str(nuevo).zfill(8)

        super().save(*args, **kwargs)
        
class SecuenciaCategoria(models.Model):
    categoria = models.OneToOneField(Categoria, on_delete=models.CASCADE)
    ultimo_numero = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.categoria.nombre} - {self.ultimo_numero}"
    
class Stock(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    sucursal = models.ForeignKey(Sucursal, on_delete=models.CASCADE)
    stock_fisico = models.IntegerField(default=0)
    stock_virtual = models.IntegerField(default=0)

    class Meta:
        unique_together = ('producto', 'sucursal')

    def __str__(self):
        return f"{self.producto} - {self.sucursal}"
    



class Notificacion(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    mensaje = models.TextField()
    leido = models.BooleanField(default=False)
    fecha = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Notificación para {self.usuario.username}"


        
class Venta(models.Model):
    TIPO_CLIENTE_CHOICES = [
        ('publico', 'Público en general'),
        ('mayorista', 'Mayorista'),
    ]

    no_venta = models.CharField(max_length=10, unique=True)
    sucursal = models.ForeignKey(Sucursal, on_delete=models.PROTECT)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    tipo_cliente = models.CharField(max_length=10, choices=TIPO_CLIENTE_CHOICES)
    vendedor = models.ForeignKey(Vendedor, on_delete=models.PROTECT, related_name='ventas')
    fecha = models.DateTimeField(auto_now_add=True)
    pagado = models.BooleanField(default=False)
    cancelada = models.BooleanField(default=False)
    fecha_cancelacion = models.DateTimeField(null=True, blank=True)
    descuento = models.IntegerField(default=0)

    def __str__(self):
        return f'{self.no_venta} - {self.sucursal}'


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
