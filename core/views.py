from django.shortcuts import render, redirect, get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import TemplateView
from django.utils.timezone import now, timedelta, make_aware
from django.utils import timezone
from django.db.models import Sum, F
from django.db import transaction
from django.http import HttpResponse, JsonResponse, QueryDict
from django.urls import reverse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.contrib import messages
from .models import Vendedor, Producto, Categoria, Venta, VentaDetalle, generar_folio_secuencial, Pago
from django.contrib.auth import login, logout, authenticate, get_user_model
from django.contrib.auth.decorators import login_required, user_passes_test
from .forms import RegistroForm, LoginForm, VendedorForm, ProductoForm, CategoriaForm, RegistroVentasForm
from decimal import Decimal
from datetime import datetime
import json
import pandas as pd



# Roles 
def es_admin(user):
    return user.is_authenticated and user.rol == "ADMIN"

def es_usuario(user):
    return user.is_authenticated and user.rol == "USUARIO"

# Vista Index 
def index(request):
    return render(request, 'core/index.html')

def iniciar_sesion(request):
    if request.method == "POST":
        form = LoginForm(data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)

            # Redirigir según el rol del usuario
            if user.rol == "ADMIN":
                return redirect("home_admin")  # Cambia por la vista de admin
            elif user.rol == "USUARIO":
                return redirect("home_usuario")  # Cambia por la vista de usarios
            else:
                return redirect("index")  # Redirección por defecto
    
    else:
        form = LoginForm()

    return render(request, "core/login.html", {"form": form})

def cerrar_sesion(request):
    logout(request)
    return redirect("index")

#Vistas Administrador
@login_required
@user_passes_test(es_admin)
def home_admin(request):
    # propiedades = Propiedad.objects.all()
    return render(request, 'core/home_admin.html') 


@login_required
@user_passes_test(es_admin)
@csrf_exempt
def registro(request):
    if request.method == "POST":
        form = RegistroForm(request.POST)
        if form.is_valid():
            user = form.save()  # Guarda el usuario creado
             # Realiza el login automáticamente
            return redirect("login")  # Redirige al inicio de sesión
    else:
        form = RegistroForm()
    
    return render(request, "core/registro.html", {"form": form})


@login_required
@user_passes_test(es_admin)
def configuracion(request):
    if request.method == 'POST':
        form_vendedores = VendedorForm(request.POST)
        if form_vendedores.is_valid():
            form_vendedores.save()
            return redirect('configuracion')
    else:
        form_vendedores = VendedorForm()

    vendedores = Vendedor.objects.all()
    return render(request, 'core/configuracion.html', {
        'form_vendedores': form_vendedores,
        'vendedores': vendedores
    })

@login_required
@user_passes_test(es_admin)
def editar_vendedor(request, id):
    vendedor = get_object_or_404(Vendedor, id=id)
    if request.method == 'POST':
        form = VendedorForm(request.POST, instance=vendedor)
        if form.is_valid():
            form.save()
            return redirect('configuracion')
    else:
        form = VendedorForm(instance=vendedor)
    vendedores = Vendedor.objects.all()
    return render(request, 'core/configuracion.html', {
        'form_vendedores': form,
        'vendedores': vendedores,
        'editando': True,
        'vendedor_editando': vendedor
    })

@login_required
@user_passes_test(es_admin)
def eliminar_vendedor(request, id):
    vendedor = get_object_or_404(Vendedor, id=id)
    vendedor.delete()
    return redirect('configuracion')


@login_required
@user_passes_test(es_admin)
def inventario_view(request):
    productos = Producto.objects.all()
    categorias = Categoria.objects.all()

    producto_id = request.GET.get('editar')  # si llega ?editar=5 en la URL
    producto_editando = None

    if producto_id:
        producto_editando = get_object_or_404(Producto, id=producto_id)

    if request.method == 'POST':
        if 'guardar_producto' in request.POST:
            if producto_editando:
                form_producto = ProductoForm(request.POST, instance=producto_editando)
            else:
                form_producto = ProductoForm(request.POST)

            if form_producto.is_valid():
                form_producto.save()
                return redirect('inventario')

        elif 'guardar_categoria' in request.POST:
            form_categoria = CategoriaForm(request.POST)
            if form_categoria.is_valid():
                form_categoria.save()
                return redirect('inventario')
    else:
        form_producto = ProductoForm(instance=producto_editando)
        form_categoria = CategoriaForm()

    return render(request, 'core/inventario.html', {
        'form_producto': form_producto,
        'form_categoria': form_categoria,
        'productos': productos,
        'categorias': categorias,
        'producto_editando': producto_editando,
    })

@login_required
@user_passes_test(es_admin)
def eliminar_categoria(request, id):
    categoria = get_object_or_404(Categoria, id=id)
    categoria.delete()
    return redirect('inventario')  # Usa el nombre correcto de tu URL

@login_required
@user_passes_test(es_admin)
def eliminar_producto(request, id):
    producto = get_object_or_404(Producto, id=id)
    producto.delete()
    return redirect('inventario')  # Usa el nombre correcto de tu URL


@login_required
@user_passes_test(es_admin)
def exportar_productos_excel(request):
    productos = Producto.objects.all().values(
        'no_folio', 'nombre', 'descripcion', 'categoria__nombre', 'precio', 'stock'
    )
    df = pd.DataFrame(productos)
    df.rename(columns={
        'no_folio': 'No. Folio',
        'nombre': 'Nombre',
        'descripcion': 'Descripción',
        'categoria__nombre': 'Categoría',
        'precio': 'Precio',
        'stock': 'Stock'
    }, inplace=True)

    response = HttpResponse(content_type='application/vnd.ms-excel')
    response['Content-Disposition'] = 'attachment; filename=productos.xlsx'
    df.to_excel(response, index=False)
    return response

@login_required
@user_passes_test(es_admin)
def historial_ventas_admin(request):
    ventas = Venta.objects.all()
    total_recaudado = VentaDetalle.objects.filter(
        venta__cancelada=False,
        venta__pagado=True
    ).aggregate(total=Sum('total'))['total'] or 0

    # --- Filtrar por fechas --- 
    fecha_inicio = request.GET.get('fecha_inicio')
    fecha_fin = request.GET.get('fecha_fin')
    vendedor_id = request.GET.get('vendedor')
   
    if fecha_inicio:
        fecha_inicio_dt = make_aware(datetime.strptime(fecha_inicio, '%Y-%m-%d'))
        ventas = ventas.filter(fecha__gte=fecha_inicio_dt)

    if fecha_fin:
        fecha_fin_dt = make_aware(datetime.strptime(fecha_fin, '%Y-%m-%d'))
        # Sumar 1 día para incluir toda la fecha_fin hasta las 23:59
        ventas = ventas.filter(fecha__lt=fecha_fin_dt + timedelta(days=1))

    if vendedor_id:
        ventas = ventas.filter(vendedor__id=vendedor_id)

    vendedores = Vendedor.objects.all()

    return render(request, 'core/historialVentas_admin.html', {
        'ventas': ventas,
        'total_recaudado': total_recaudado,
        'fecha_inicio': fecha_inicio,
        'fecha_fin': fecha_fin,
        'vendedores': vendedores,
    })


@login_required
@user_passes_test(es_admin)
def eliminar_venta_view(request, venta_id):
    venta = get_object_or_404(Venta, id=venta_id)

    if venta.cancelada:
        venta.delete()

    return redirect('historial_ventas_admin')


@login_required
@user_passes_test(es_admin)
def arqueo_caja_view(request):
    ventas = Venta.objects.filter(pagado=True, cancelada=False)

    # --- Filtrar por fechas ---
    fecha_inicio = request.GET.get('fecha_inicio')
    fecha_fin = request.GET.get('fecha_fin')
    vendedor_id = request.GET.get('vendedor')

    if fecha_inicio:
        fecha_inicio_dt = make_aware(datetime.strptime(fecha_inicio, '%Y-%m-%d'))
        ventas = ventas.filter(fecha__gte=fecha_inicio_dt)

    if fecha_fin:
        fecha_fin_dt = make_aware(datetime.strptime(fecha_fin, '%Y-%m-%d'))
        # Sumar 1 día para incluir toda la fecha_fin hasta las 23:59
        ventas = ventas.filter(fecha__lt=fecha_fin_dt + timedelta(days=1))

    if vendedor_id:
        ventas = ventas.filter(vendedor__id=vendedor_id)

    # --- Cálculo de totales ---
    ventas_con_totales = []
    total_arqueo = 0
    total_productos = 0

    for venta in ventas:
        detalles = VentaDetalle.objects.filter(venta=venta)
        total_venta = detalles.aggregate(suma=Sum('total'))['suma'] or 0
        cantidad_total = detalles.aggregate(suma=Sum('cantidad'))['suma'] or 0

        ventas_con_totales.append({
            'no_venta': venta.no_venta,
            'vendedor': venta.vendedor,
            'fecha': venta.fecha,
            'total': total_venta,
            'productos': cantidad_total,
        })

        total_arqueo += total_venta
        total_productos += cantidad_total

    vendedores = Vendedor.objects.all()

    return render(request, 'core/arqueo_caja.html', {
        'ventas': ventas_con_totales,
        'total_arqueo': total_arqueo,
        'total_productos': total_productos,
        'vendedores': vendedores,
    })

class DashboardView(TemplateView):
    template_name = "core/dashboard.html"

@login_required
@user_passes_test(es_admin)
@api_view(['GET'])
def dashboard_data(request):
    ventas_dias_et, ventas_dias_dat = ventas_por_dia()
    prod_et, prod_dat = producto_mas_vendido_semana()
    cat_et, cat_dat = ventas_por_categoria()
    vend_et, vend_dat = ingresos_por_vendedor()

    return Response({
        'ventas_por_dia': {'etiquetas': ventas_dias_et, 'datos': ventas_dias_dat},
        'productos_mas_vendidos': {'etiquetas': prod_et, 'datos': prod_dat},
        'ventas_por_categoria': {'etiquetas': cat_et, 'datos': cat_dat},
        'ingresos_por_vendedor': {'etiquetas': vend_et, 'datos': vend_dat},
    })

def ventas_por_dia():
    hoy = now()
    hace_7_dias = hoy - timedelta(days=6)
    # Agregamos filtro para solo ventas pagadas y no canceladas
    ventas = (
        Venta.objects.filter(fecha__date__range=[hace_7_dias.date(), hoy.date()], pagado=True, cancelada=False)
        .annotate(dia=F('fecha__date'))
        .values('dia')
        .annotate(total_ventas=Sum('detalles__total'))
        .order_by('dia')
    )
    
    # Formatear para el frontend (lista de fechas y totales)
    resultados = {str(v['dia']): float(v['total_ventas'] or 0) for v in ventas}
    
    # Asegurar que cada día tenga valor (incluso 0)
    fechas = [(hace_7_dias + timedelta(days=i)).date() for i in range(7)]
    datos = [resultados.get(str(d), 0) for d in fechas]
    etiquetas = [d.strftime('%Y-%m-%d') for d in fechas]
    
    return etiquetas, datos


def producto_mas_vendido_semana():
    hoy = now()
    hace_7_dias = hoy - timedelta(days=6)
    detalles = (
        VentaDetalle.objects.filter(
            venta__fecha__date__range=[hace_7_dias.date(), hoy.date()],
            venta__pagado=True,
            venta__cancelada=False,
        )
        .values('producto__nombre')
        .annotate(total_cantidad=Sum('cantidad'))
        .order_by('-total_cantidad')[:5]  # top 5 productos
    )
    etiquetas = [d['producto__nombre'] for d in detalles]
    cantidades = [d['total_cantidad'] for d in detalles]
    return etiquetas, cantidades

def ventas_por_categoria():
    hoy = now()
    hace_7_dias = hoy - timedelta(days=6)
    ventas_categoria = (
        VentaDetalle.objects.filter(
            venta__fecha__date__range=[hace_7_dias.date(), hoy.date()],
            venta__pagado=True,
            venta__cancelada=False
        )
        .values('producto__categoria__nombre')
        .annotate(total_ventas=Sum('total'))
        .order_by('-total_ventas')
    )
    etiquetas = [v['producto__categoria__nombre'] for v in ventas_categoria]
    datos = [float(v['total_ventas']) for v in ventas_categoria]
    return etiquetas, datos


def ingresos_por_vendedor():
    hoy = now()
    hace_7_dias = hoy - timedelta(days=6)
    ingresos = (
        Venta.objects.filter(
            fecha__date__range=[hace_7_dias.date(), hoy.date()],
            pagado=True,
            cancelada=False
        )
        .values('vendedor__nombre')  # Asegúrate que tu modelo Vendedor tiene campo nombre
        .annotate(total_ingresos=Sum('detalles__total'))
        .order_by('-total_ingresos')
    )
    etiquetas = [i['vendedor__nombre'] for i in ingresos]
    datos = [float(i['total_ingresos'] or 0) for i in ingresos]
    return etiquetas, datos



# Vista para usuarios
@login_required
@user_passes_test(es_usuario)
def home_usuario(request):
    return render(request, "core/home_usuario.html")

@login_required
@user_passes_test(es_usuario)
def registro_ventas(request):
    no_venta = generar_folio_secuencial() 
    form = RegistroVentasForm()
    print("POST DATA:", request.POST)

    if request.method == 'POST':
        if request.headers.get('x-requested-with') == 'XMLHttpRequest':
            try:
                productos = json.loads(request.POST.get("productos", "[]"))
                tipo_cliente = request.POST.get("tipo_cliente")
                vendedor_id = request.POST.get("vendedor")
                descuento = int(request.POST.get("descuento", 0)) if tipo_cliente == "mayorista" else 0


                if not productos:
                    return JsonResponse({"error": "No se recibieron productos"}, status=400)
                if not tipo_cliente or not vendedor_id:
                    return JsonResponse({"error": "Faltan datos del formulario"}, status=400)
                if tipo_cliente != "mayorista" and descuento > 0:
                    return JsonResponse({"error": "Solo los mayoristas pueden tener descuento"}, status=400)

                if descuento not in [0, 10, 30, 50]:
                    return JsonResponse({"error": "El descuento debe ser 10, 30 o 50%"}, status=400)

                with transaction.atomic():
                    # Crear la venta (cabecera)
                    venta = Venta.objects.create(
                        tipo_cliente=tipo_cliente,
                        vendedor_id=vendedor_id,
                        no_venta=no_venta,
                        descuento=descuento
                    )

                    # Recorrer productos y crear detalles con descuento aplicado
                    for p in productos:
                        try:
                            producto = Producto.objects.get(no_folio=p["no_folio"])
                        except Producto.DoesNotExist:
                            raise ValueError(f"El producto con folio {p['no_folio']} no existe.")
                        cantidad = int(p["cantidad"])

                        if producto.stock < cantidad:
                            raise ValueError(f"Stock insuficiente para {producto.nombre}. Solo hay {producto.stock}.")

                        precio_unitario = producto.precio

                        # Aplicar descuento si es mayorista
                        if tipo_cliente == "mayorista" and descuento > 0:
                            precio_unitario = precio_unitario * (Decimal('1') - Decimal(descuento) / Decimal('100'))

                        # Crear detalle de venta
                        VentaDetalle.objects.create(
                            venta=venta,
                            producto=producto,
                            cantidad=cantidad,
                            precio_unitario=producto.precio  
                        )

                        # Descontar del inventario
                        producto.stock -= cantidad
                        producto.save()

                return JsonResponse({"success": True, "folio_venta": venta.no_venta})

            except Exception as e:
                return JsonResponse({"error": str(e)}, status=400)

        else:
            form = RegistroVentasForm(request.POST)
            if form.is_valid():
                pass

    return render(request, 'core/registro_ventas.html', {'form': form, 'no_venta': no_venta})

@login_required
@user_passes_test(es_usuario)
def buscar_producto(request):
    q = request.GET.get('q', '')
    tipo = request.GET.get('tipo', 'nombre')

    if tipo == 'no_folio':
        productos = Producto.objects.filter(no_folio__icontains=q)[:10]
    else:  # Por defecto busca por nombre
        productos = Producto.objects.filter(nombre__icontains=q)[:10]

    resultados = []
    for p in productos:
        resultados.append({
            'id': p.id,
            'no_folio': p.no_folio,
            'nombre': p.nombre,
            'descripcion': p.descripcion,
            'precio': float(p.precio),
            'stock': p.stock,
        })
    return JsonResponse(resultados, safe=False)


@login_required
@user_passes_test(es_usuario)
def historial_ventas(request):
    ventas = Venta.objects.all()
    return render(request, 'core/historial_ventas.html', {'ventas': ventas})

@login_required
@user_passes_test(es_usuario)
def caja(request):
    productos_disponibles = Producto.objects.all()
    folio = request.GET.get('folio')
    venta = None
    total_sin_descuento = Decimal('0.00')
    descuento_porcentaje = Decimal('0.00')
    descuento_monetario = Decimal('0.00')
    total = Decimal('0.00')
    busqueda_realizada = False
    venta_bloqueada = False

    if folio:
        try:
            venta = Venta.objects.prefetch_related('detalles__producto').get(no_venta=folio)
            detalles = venta.detalles.all()

            # Calcular total sin descuento
            total_sin_descuento = sum([detalle.precio_unitario * detalle.cantidad for detalle in detalles])
            descuento_porcentaje = Decimal(venta.descuento or 0)
            descuento_monetario = (total_sin_descuento * descuento_porcentaje) / Decimal('100.00')
            total = total_sin_descuento - descuento_monetario

            busqueda_realizada = True

            # Procesar el pago
            if request.method == 'POST' and not venta.pagado:
                monto_pagado = Decimal(request.POST.get('monto_pagado', '0.00'))
                forma_pago = request.POST.get('forma_pago', '')

                if venta.tipo_cliente == 'mayorista':
                    password_admin = request.POST.get('password_admin', '')

                    try:
                        admin_user = User.objects.get(rol='ADMIN')
                    except User.DoesNotExist:
                        messages.error(request, "No existe un usuario administrador registrado.")
                        return redirect(f'{reverse("caja")}?folio={folio}')

                    user = authenticate(username=admin_user.username, password=password_admin)

                    if not user:
                        messages.error(request, "Contraseña incorrecta o sin permisos.")
                        return redirect(f'{reverse("caja")}?folio={folio}')

                # Validar monto pagado
                if monto_pagado >= total:
                    Pago.objects.create(venta=venta, monto_pagado=monto_pagado, forma_pago=forma_pago)
                    venta.pagado = True
                    venta.save()
                    messages.success(request, "Pago registrado exitosamente.", extra_tags="pago")

                    return redirect(f'{reverse("caja")}?folio={folio}')
                else:
                    messages.error(request, "El monto pagado es menor al total.")
            
            venta_bloqueada = venta.pagado or venta.cancelada

        except Venta.DoesNotExist:
            venta = None
            busqueda_realizada = True

    context = {
        'venta': venta,
        'total': total.quantize(Decimal('0.01')),
        'total_sin_descuento': total_sin_descuento.quantize(Decimal('0.01')),
        'descuento_porcentaje': descuento_porcentaje,
        'descuento_monetario': descuento_monetario.quantize(Decimal('0.01')),
        'busqueda_realizada': busqueda_realizada,
        'venta_bloqueada': venta_bloqueada,
        'productos_disponibles': productos_disponibles,
    }

    return render(request, 'core/caja.html', context)


@login_required
@user_passes_test(es_usuario)
def eliminar_detalle(request, detalle_id):
    detalle = get_object_or_404(VentaDetalle, id=detalle_id)
    venta = detalle.venta

    # Evita eliminar si la venta ya está pagada o cancelada
    if venta.pagado or venta.cancelada:
        messages.error(request, "No se puede eliminar productos de una venta pagada o cancelada.")
        return redirect(f'/caja/?folio={venta.no_venta}')

    try:
        with transaction.atomic():
            # Regresar al stock la cantidad del producto
            producto = detalle.producto
            producto.stock += detalle.cantidad
            producto.save()

            # Eliminar el detalle
            detalle.delete()

        messages.success(request, "Producto eliminado correctamente y stock actualizado.")
    except Exception as e:
        messages.error(request, f"Error al eliminar el producto: {str(e)}")

    return redirect(f'/caja/?folio={venta.no_venta}')

User = get_user_model()

@login_required
@user_passes_test(es_usuario)
def cancelar_venta(request, venta_id):
    venta = get_object_or_404(Venta, pk=venta_id)

    if venta.pagado:
        messages.error(request, "No se puede cancelar una venta que ya fue pagada.")
        return redirect('historial_ventas')

    if venta.cancelada:
        messages.info(request, "Esta venta ya fue cancelada anteriormente.")
        return redirect('caja')

    if request.method == 'POST':
        password_admin = request.POST.get('password_admin')

        try:
            admin_user = User.objects.get(rol='ADMIN')
        except User.DoesNotExist:
            messages.error(request, "No existe un usuario administrador registrado.")
            return redirect(f'/caja/?folio={venta_id}')

        user = authenticate(username=admin_user.username, password=password_admin)

        if user:
            try:
                with transaction.atomic():
                    # Reposición de stock
                    detalles = VentaDetalle.objects.filter(venta=venta)
                    for detalle in detalles:
                        producto = detalle.producto
                        producto.stock += detalle.cantidad
                        producto.save()

                    # Marcar la venta como cancelada
                    venta.cancelada = True
                    venta.fecha_cancelacion = timezone.now()
                    venta.usuario_cancelacion = request.user
                    venta.save()

                messages.success(request, "Venta cancelada y stock devuelto correctamente.", extra_tags="cancelar")
                return redirect('caja')

            except Exception as e:
                messages.error(request, f"Ocurrió un error al cancelar la venta: {str(e)}")
                return redirect(f'/caja/?folio={venta_id}')

        else:
            messages.error(request, "Contraseña incorrecta o sin permisos.")
            return redirect(f'/caja/?folio={venta_id}')

    return redirect('caja')

@login_required
@user_passes_test(es_usuario)
def editar_detalle(request, id):
    
    folio = request.GET.get('folio') or request.POST.get('folio')

    if not folio:
        messages.error(request, "No se especificó un folio válido.")
        return redirect('caja')

    detalle = get_object_or_404(VentaDetalle, id=id)

    if detalle.venta.no_venta != folio:
        messages.error(request, "Este detalle no pertenece a la venta seleccionada.")
        return redirect(f'{reverse("caja")}?folio={folio}')

    if request.method == 'POST':
        try:
            nueva_cantidad = int(request.POST.get('cantidad'))
            producto = detalle.producto
            cantidad_anterior = detalle.cantidad
            diferencia = nueva_cantidad - cantidad_anterior

            if nueva_cantidad > 0:
                if diferencia > 0:
                    # Se quiere aumentar cantidad → se requiere más stock
                    if producto.stock >= diferencia:
                        producto.stock -= diferencia
                    else:
                        messages.error(request, "No hay suficiente stock disponible.")
                        return redirect(f'{reverse("caja")}?folio={folio}')
                elif diferencia < 0:
                    # Se quiere reducir cantidad → se regresa al stock
                    producto.stock += abs(diferencia)

                # Guardar cambios
                producto.save()
                detalle.cantidad = nueva_cantidad
                detalle.total = detalle.precio_unitario * nueva_cantidad
                detalle.save()
                messages.success(request, "Cantidad actualizada correctamente.", extra_tags="actualizar")
            else:
                messages.warning(request, "La cantidad debe ser mayor a cero.")
        except (ValueError, TypeError):
            messages.error(request, "Cantidad inválida.")

    return redirect(f'{reverse("caja")}?folio={folio}')

@login_required
@user_passes_test(es_usuario)
def buscar_productos(request):
    q = request.GET.get('q', '')
    productos = Producto.objects.filter(nombre__icontains=q)[:10]
    
    data = [{
        'id': p.id,
        'no_folio': p.no_folio,
        'nombre': p.nombre,
        'descripcion': p.descripcion,
        'precio': float(p.precio)
    } for p in productos]
    
    # Para Select2, devuelve un objeto con la clave 'results' conteniendo la lista
    return JsonResponse({'results': data})

@login_required
@user_passes_test(es_usuario)
@csrf_exempt
def agregar_detalle(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        producto_id = data.get('producto_id')
        cantidad = int(data.get('cantidad'))
        venta_id = data.get('venta_id')

        try:
            producto = Producto.objects.get(id=producto_id)
            venta = Venta.objects.get(id=venta_id)

            if producto.stock < cantidad:
                return JsonResponse({'success': False, 'error': 'No hay suficiente stock disponible.'})

            # Crear el detalle de venta
            VentaDetalle.objects.create(
                venta=venta,
                producto=producto,
                cantidad=cantidad,
                precio_unitario=producto.precio,
                total=cantidad * producto.precio
            )

            # Actualizar stock
            producto.stock -= cantidad
            producto.save()

            return JsonResponse({'success': True})
        except Producto.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Producto no encontrado.'})
        except Venta.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Venta no encontrada.'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
