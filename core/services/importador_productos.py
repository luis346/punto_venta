import pandas as pd
import unicodedata

from django.db import transaction
from core.models import Producto, Categoria, Stock


def norm(t):

    if not t:
        return ""

    t = str(t).strip().upper()

    return unicodedata.normalize(
        "NFKD", t
    ).encode("ASCII", "ignore").decode("utf-8")


def limpiar_codigo(valor):

    if valor is None or valor == "":
        return ""

    valor = str(valor)

    if valor.endswith(".0"):
        valor = valor[:-2]

    return valor.strip()


def importar_productos_excel(archivo_excel, sucursal):

    df = pd.read_excel(archivo_excel)

    df = df.fillna("")

    creados = 0
    actualizados = 0
    categorias_creadas = 0
    filas_ignoradas = 0
    errores = []

    with transaction.atomic():

        categorias_db = {c.nombre: c for c in Categoria.objects.all()}

        productos_folio = {p.no_folio: p for p in Producto.objects.all() if p.no_folio}

        productos_referencia = {p.referencia: p for p in Producto.objects.all() if p.referencia}

        # Solo necesitamos stocks_db para verificar existencia, no para actualizar
        stocks_db = {s.producto_id: s for s in Stock.objects.filter(sucursal=sucursal)}

        nuevos_productos = []
        productos_actualizar = []
        nuevos_stocks = []

        ultimo = Producto.objects.order_by('-id').first()

        if ultimo and ultimo.no_folio and ultimo.no_folio.isdigit():
            folio_base = int(ultimo.no_folio) + 1
        else:
            folio_base = 10100001

        referencias_existentes = set(productos_referencia.keys())
        referencia_contador = {}

        def generar_folio():

            nonlocal folio_base

            while True:

                folio = str(folio_base)
                folio_base += 1

                if folio not in productos_folio:
                    return folio

        def generar_referencia(prefijo):

            contador = referencia_contador.get(prefijo, 1)

            while True:

                ref = f"{prefijo}-{contador:04d}"

                if ref not in referencias_existentes:
                    referencias_existentes.add(ref)
                    referencia_contador[prefijo] = contador + 1
                    return ref

                contador += 1

        for i, row in df.iterrows():

            try:

                no_folio = limpiar_codigo(row.get("no_folio"))
                referencia = limpiar_codigo(row.get("referencia"))

                no_folio = norm(no_folio)
                referencia = norm(referencia)

                nombre = norm(row.get("nombre"))
                descripcion = norm(row.get("descripcion"))
                categoria_nombre = norm(row.get("categoria"))
                unidad_medida = norm(row.get("unidad_medida")) or "PIEZA"

                # -------------------------
                # PRECIOS
                # -------------------------

                precio = row.get("precio", 0)
                precio_mayoreo = row.get("precio_mayoreo", 0)

                if precio == "" or pd.isna(precio):
                    precio = 0

                if precio_mayoreo == "" or pd.isna(precio_mayoreo):
                    precio_mayoreo = 0

                try:
                    precio = float(precio)
                except:
                    precio = 0

                try:
                    precio_mayoreo = float(precio_mayoreo)
                except:
                    precio_mayoreo = 0

                # -------------------------
                # STOCK - SOLO PARA PRODUCTOS NUEVOS
                # -------------------------
                # Leemos el stock solo para productos nuevos, pero NO actualizamos existentes
                stock_fisico = row.get("stock_fisico", 0)
                stock_virtual = row.get("stock_virtual", 0)

                if stock_fisico == "" or pd.isna(stock_fisico):
                    stock_fisico = 0

                if stock_virtual == "" or pd.isna(stock_virtual):
                    stock_virtual = 0

                try:
                    stock_fisico = int(stock_fisico)
                except:
                    stock_fisico = 0

                try:
                    stock_virtual = int(stock_virtual)
                except:
                    stock_virtual = 0

                if not nombre or not categoria_nombre:

                    filas_ignoradas += 1
                    continue

                categoria = categorias_db.get(categoria_nombre)

                if not categoria:

                    prefijo_base = categoria_nombre[:3]
                    prefijo = f"{prefijo_base}{len(categorias_db)+1}"

                    categoria = Categoria.objects.create(
                        nombre=categoria_nombre,
                        prefijo=prefijo
                    )

                    categorias_db[categoria_nombre] = categoria
                    categorias_creadas += 1

                if not referencia:

                    prefijo = categoria.prefijo or categoria.nombre[:3]
                    referencia = generar_referencia(prefijo)

                producto = None

                if referencia and referencia in productos_referencia:

                    producto = productos_referencia[referencia]

                elif no_folio and no_folio in productos_folio:

                    producto = productos_folio[no_folio]

                else:

                    producto = Producto.objects.filter(
                        nombre=nombre,
                        categoria=categoria
                    ).first()

                if producto:

                    # ==========================================
                    # PRODUCTO EXISTENTE - SOLO ACTUALIZAR DATOS
                    # EL STOCK NO SE TOCA
                    # ==========================================
                    
                    producto.nombre = nombre
                    producto.descripcion = descripcion
                    producto.categoria = categoria
                    producto.precio = precio
                    producto.precio_mayoreo = precio_mayoreo
                    
                    # Verificar si la unidad de medida cambió (opcional)
                    if unidad_medida:
                        producto.unidad_medida = unidad_medida
                    
                    productos_actualizar.append(producto)
                    
                    # IMPORTANTE: NO se actualiza el stock
                    # El stock permanece exactamente como está en la base de datos
                    
                    actualizados += 1

                else:

                    # ==========================================
                    # PRODUCTO NUEVO - CREAR CON STOCK
                    # ==========================================
                    
                    if not no_folio or no_folio in productos_folio:
                        no_folio = generar_folio()

                    nuevo = Producto(
                        no_folio=no_folio,
                        referencia=referencia,
                        nombre=nombre,
                        descripcion=descripcion,
                        categoria=categoria,
                        unidad_medida=unidad_medida,
                        precio=precio,
                        precio_mayoreo=precio_mayoreo
                    )

                    nuevos_productos.append(nuevo)

                    productos_folio[no_folio] = nuevo
                    productos_referencia[referencia] = nuevo

                    # Guardar stock solo para productos nuevos
                    nuevo._stock_fisico = stock_fisico
                    nuevo._stock_virtual = stock_virtual

                    creados += 1

            except Exception as e:

                errores.append(f"Fila {i+2}: {str(e)}")

        # -------------------------
        # CREAR PRODUCTOS NUEVOS
        # -------------------------

        if nuevos_productos:

            Producto.objects.bulk_create(nuevos_productos)

        # -------------------------
        # ACTUALIZAR PRODUCTOS EXISTENTES
        # -------------------------

        if productos_actualizar:

            Producto.objects.bulk_update(
                productos_actualizar,
                ["nombre", "descripcion", "categoria", "precio", "precio_mayoreo", "unidad_medida"]
            )

        # -------------------------
        # CREAR STOCK SOLO PARA PRODUCTOS NUEVOS
        # -------------------------

        for producto in nuevos_productos:

            nuevos_stocks.append(
                Stock(
                    producto=producto,
                    sucursal=sucursal,
                    stock_fisico=getattr(producto, "_stock_fisico", 0),
                    stock_virtual=getattr(producto, "_stock_virtual", 0)
                )
            )

        if nuevos_stocks:

            Stock.objects.bulk_create(
                nuevos_stocks,
                ignore_conflicts=True
            )

    return {
        "creados": creados,
        "actualizados": actualizados,
        "categorias": categorias_creadas,
        "ignorados": filas_ignoradas,
        "errores": len(errores),
        "detalle_errores": errores[:10] if errores else [],
        "mensaje": f"{actualizados} productos actualizados (stock preservado), {creados} productos nuevos creados"
    }