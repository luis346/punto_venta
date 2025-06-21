from .models import Venta
from decimal import Decimal

def generar_folio_secuencial(prefijo):
    ultima_venta = Venta.objects.filter(no_venta__startswith=prefijo).order_by('-no_venta').first()
    if ultima_venta:
        ultimo_num = int(ultima_venta.no_venta[1:])  # quitar prefijo
    else:
        ultimo_num = 0
    nuevo_folio = f"{prefijo}{ultimo_num + 1:05d}"
    return nuevo_folio
        