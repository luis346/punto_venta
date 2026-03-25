from venv import logger
from django.shortcuts import render, redirect, get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import TemplateView
from django.utils.timezone import now, timedelta, make_aware
from django.utils import timezone
from django.db.models import Q
from django.db.models import Sum, Q, F, ExpressionWrapper, DecimalField
from django.db import transaction, IntegrityError
from decimal import Decimal
from django.core.files.storage import FileSystemStorage
from django.db.models import Sum, F
from django.db import transaction, IntegrityError
from django.http import HttpResponse, JsonResponse
from django.urls import reverse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.contrib import messages
from .models import Vendedor, Producto, Categoria, Venta, VentaDetalle, Pago, Notificacion, Usuario, Stock, Sucursal
from .utils import generar_folio_secuencial
from django.contrib.auth import login, logout, authenticate, get_user_model
from django.contrib.auth.decorators import login_required, user_passes_test
from django.views.decorators.http import require_POST
from .forms import RegistroForm, VendedorForm, ProductoForm, CategoriaForm, RegistroVentasForm, SucursalForm
from decimal import Decimal
from datetime import datetime
import json, unicodedata, openpyxl
from django.template.loader import render_to_string
from django.http import JsonResponse
from django.core.paginator import Paginator
import pandas as pd
from openpyxl import Workbook
from django.contrib.auth.forms import AuthenticationForm
import io
from django.shortcuts import render
from django.db.models import Sum, F
from .models import VentaDetalle
from reportlab.lib.units import cm
from reportlab.graphics.barcode import code128
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from django.core.paginator import Paginator
from core.services.importador_productos import importar_productos_excel





def error_404(request, exception):
    return render(request, 'core/errors/404.html', status=404)

def error_500(request):
    return render(request, 'core/errors/500.html', status=500)

def error_403(request, exception):
    return render(request, 'core/errors/403.html', status=403)

# Roles 
def es_admin(user):
    return user.is_authenticated and user.rol == "ADMIN"

def es_caja(user):
    return user.is_authenticated and user.rol == "CAJA"

# Vista Index 
def index(request): 
    return render(request, 'core/index.html')

def obtener_sucursal_activa(request):
    user = request.user

    if not user.is_authenticated:
        return None

    # CAJA → sucursal fija
    if user.rol == 'CAJA':
        return user.sucursal

    # ADMIN → sesión
    sucursal_id = request.session.get('sucursal_id')
    if sucursal_id:
        return Sucursal.objects.filter(id=sucursal_id).first()

    return None


@login_required
@user_passes_test(es_admin)
def sucursales_view(request):

    if request.method == "POST":
        form = SucursalForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Sucursal registrada correctamente.")
            return redirect("sucursales")
    else:
        form = SucursalForm()

    sucursales = Sucursal.objects.all()

    return render(
        request,
        "core/sucursales.html",
        {
            "form": form,
            "sucursales": sucursales
        }
    )

def sucursal_context(request):
    sucursal_actual = obtener_sucursal_activa(request)

    sucursales_usuario = []

    if request.user.is_authenticated:
        if request.user.rol == 'ADMIN':
            sucursales_usuario = Sucursal.objects.filter(activa=True)
        elif request.user.rol == 'CAJA' and request.user.sucursal:
            sucursales_usuario = [request.user.sucursal]

    return {
        'sucursal_actual': sucursal_actual,
        'sucursales_usuario': sucursales_usuario,
    }

@login_required
def seleccionar_sucursal(request):
    if request.method == 'POST':
        sucursal_id = request.POST.get('sucursal_id')

        if request.user.rol != 'ADMIN':
            messages.error(request, "No tienes permiso.")
            return redirect('index')

        sucursal = get_object_or_404(
            Sucursal,
            id=sucursal_id,
            activa=True
        )

        request.session['sucursal_id'] = sucursal.id
        request.session.modified = True

        return redirect('home_admin')

@login_required
def seleccionar_sucursal(request):
    if request.method == 'POST':
        sucursal_id = request.POST.get('sucursal_id')

        sucursal = get_object_or_404(
            Sucursal,
            id=sucursal_id,
            activa=True
        )

        request.session['sucursal_id'] = sucursal.id
        return redirect('index')


@login_required
def cambiar_sucursal(request):
    request.session.pop('sucursal_id', None)
    return redirect('inventario')

def iniciar_sesion(request):
    if request.method == "POST":
        form = AuthenticationForm(request, data=request.POST)

        if form.is_valid():
            user = form.get_user()

            # 🔴 Usuario inactivo
            if not user.is_active:
                messages.error(request, "Tu cuenta está desactivada.")
                return redirect("login")

            # 🔴 Caja sin sucursal
            if user.rol == "CAJA" and not user.sucursal:
                messages.error(
                    request,
                    "Tu usuario no tiene una sucursal asignada. Contacta al administrador."
                )
                return redirect("login")

            login(request, user)

            messages.success(request, f"Bienvenido {user.username}")

            if user.rol == "ADMIN":
                return redirect("home_admin")
            elif user.rol == "CAJA":
                return redirect("home_usuario")
            else:
                return redirect("index")

        else:
            # 🔴 Errores de autenticación
            messages.error(
                request,
                "Usuario o contraseña incorrectos."
            )

    else:
        form = AuthenticationForm()

    return render(request, "core/login.html", {"form": form})


def cerrar_sesion(request):
    logout(request)
    return redirect("index")

#Vistas Administrador
@login_required
def home_admin(request):
    sucursal_id = request.session.get('sucursal_id')

    if not sucursal_id:
        return redirect('index')  # o donde abras el modal

    sucursal = Sucursal.objects.get(id=sucursal_id)

    stocks = Stock.objects.filter(sucursal=sucursal)

    return render(request, 'core/home_admin.html', {
        'stocks': stocks,
        'sucursal_actual': sucursal
    })


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

    sucursal = obtener_sucursal_activa(request)

    if not sucursal:
        messages.error(request, "No hay sucursal activa.")
        return redirect('index')

    if request.method == 'POST':
        form_vendedores = VendedorForm(request.POST)
        if form_vendedores.is_valid():
            vendedor = form_vendedores.save(commit=False)

            # 🔑 CLAVE: asignar sucursal
            vendedor.sucursal = sucursal
            vendedor.save()

            messages.success(
                request,
                "Vendedor registrado correctamente."
            )
            return redirect('configuracion')
    else:
        form_vendedores = VendedorForm()

    # 🔑 SOLO vendedores de la sucursal activa
    vendedores = Vendedor.objects.filter(
        sucursal=sucursal
    )

    return render(
        request,
        'core/configuracion.html',
        {
            'form_vendedores': form_vendedores,
            'vendedores': vendedores,
            'sucursal_actual': sucursal
        }
    )


@login_required
@user_passes_test(es_admin)
def usuarios_view(request):

    if request.method == "POST":
        usuario_id = request.POST.get("usuario_id")
        sucursal_id = request.POST.get("sucursal")

        usuario = get_object_or_404(Usuario, id=usuario_id)

        usuario.sucursal_id = sucursal_id or None
        usuario.save()

        messages.success(
            request,
            f"Sucursal asignada a {usuario.username} correctamente."
        )
        return redirect("usuarios")

    usuarios = Usuario.objects.select_related('sucursal')
    sucursales = Sucursal.objects.all()

    return render(
        request,
        'core/usuarios.html',
        {
            'usuarios': usuarios,
            'sucursales': sucursales
        }
    )



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
def editar_sucursal(request, id):
    sucursal = get_object_or_404(Sucursal, id=id)
    if request.method == 'POST':
        form = SucursalForm(request.POST, instance=sucursal)
        if form.is_valid():
            form.save()
            messages.success(request, 'Guardado correctamente!')
            return redirect('sucursales')
    else:
        form = SucursalForm(instance=sucursal)
    sucursales = Sucursal.objects.all()
    return render(request, 'core/sucursales.html', {
        'form': form,
        'sucursales': sucursales,
        'editando': True,
        'sucursal_editando': sucursal
    })


@login_required
@user_passes_test(es_admin)
def eliminar_vendedor(request, id):
    vendedor = get_object_or_404(Vendedor, id=id)
    vendedor.delete()
    return redirect('configuracion')


def buscar_productos_ajax(request):
    try:
        # Obtener y validar query
        query = request.GET.get('q', '').strip()
        
        # Base queryset optimizada
        # Usamos select_related para la relación producto
        # Usamos only para cargar SOLO los campos que necesitamos en la tabla
        stocks = Stock.objects.select_related('producto__categoria').only(
            # Campos de Stock
            'id', 'stock_fisico', 'stock_virtual', 'sucursal_id',
            # Campos de Producto (los que se muestran en la tabla)
            'producto__id',
            'producto__no_folio',
            'producto__referencia', 
            'producto__nombre',
            'producto__precio',
            'producto__precio_mayoreo',
            'producto__unidad_medida',
            'producto__umbral_mayoreo',
            # Campos de Categoría (si la muestras)
            'producto__categoria__id',
            'producto__categoria__nombre'
        )
        
        # Aplicar filtros SOLO si hay query
        if query:
            # Optimización: usar Q objects complejos
            stocks = stocks.filter(
                Q(producto__nombre__icontains=query) |
                Q(producto__no_folio__icontains=query) |
                Q(producto__referencia__icontains=query)  # Agregué referencia también
            )
        
        # Paginación con manejo robusto
        try:
            page_number = int(request.GET.get('page', 1))
        except (TypeError, ValueError):
            page_number = 1
        
        paginator = Paginator(stocks, 25)
        
        # Asegurar página válida
        if page_number < 1:
            page_number = 1
        elif page_number > paginator.num_pages and paginator.num_pages > 0:
            page_number = paginator.num_pages
        
        page_obj = paginator.get_page(page_number)
        
        # Preparar datos adicionales para el template
        context = {
            "page_obj": page_obj,
            "query": query,
            "total_resultados": paginator.count,
            "mostrando_desde": (page_number - 1) * 25 + 1 if page_obj else 0,
            "mostrando_hasta": min(page_number * 25, paginator.count),
            "sin_resultados": paginator.count == 0
        }
        
        # Renderizar template
        html = render_to_string(
            "partials/tabla_productos.html",
            context,
            request=request
        )
        
        # Respuesta enriquecida
        return JsonResponse({
            "success": True,
            "tabla": html,
            "total": paginator.count,
            "page": page_number,
            "total_pages": paginator.num_pages,
            "has_next": page_obj.has_next(),
            "has_previous": page_obj.has_previous(),
            "query": query,
            "por_pagina": 25
        })
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error en buscar_productos_ajax: {str(e)}", exc_info=True)
        
        return JsonResponse({
            "success": False,
            "error": "Error al cargar los productos. Por favor, recarga la página."
        }, status=500)

def generar_ean13(base):
    base = str(base).zfill(12)
    suma = 0
    for i, digito in enumerate(base):
        n = int(digito)
        if i % 2 == 0:
            suma += n
        else:
            suma += n * 3

    digito = (10 - (suma % 10)) % 10
    return base + str(digito)

@login_required
@user_passes_test(es_admin)
def inventario_view(request):

    sucursal = obtener_sucursal_activa(request)

    if not sucursal:
        messages.error(request, "No hay sucursal activa.")
        return redirect('index')

    # ==========================
    # OBTENER STOCKS
    # ==========================
    stocks = (
        Stock.objects
        .filter(sucursal=sucursal)
        .select_related('producto', 'producto__categoria')
        .order_by('-id')  # ← nuevos primero
    )

    # ==========================
    # FILTROS
    # ==========================
    categorias = Categoria.objects.all()
    buscar = request.GET.get('nombre', '').strip()
    categoria_id = request.GET.get('categoria', '')

    if buscar:
        stocks = stocks.filter(
            Q(producto__nombre__icontains=buscar) |
            Q(producto__no_folio__icontains=buscar) |
            Q(producto__referencia__icontains=buscar)
        )

    if categoria_id:
        stocks = stocks.filter(producto__categoria_id=categoria_id)

    # ==========================
    # PAGINACIÓN CON PAGE SIZE
    # ==========================
    page_size = request.GET.get('page_size', '25')
    try:
        page_size = int(page_size)
        if page_size not in [10, 25, 50, 100]:
            page_size = 25
    except ValueError:
        page_size = 25

    paginator = Paginator(stocks, page_size)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    # ==========================
    # ESTADÍSTICAS PARA DASHBOARD
    # ==========================
    stocks_query = Stock.objects.filter(sucursal=sucursal)
    
    # Total stock físico
    total_stock_fisico = stocks_query.aggregate(
        total=Sum('stock_fisico')
    )['total'] or 0
    
    # Total stock virtual
    total_stock_virtual = stocks_query.aggregate(
        total=Sum('stock_virtual')
    )['total'] or 0
    
    # Productos con stock bajo (≤ 3)
    productos_bajos = stocks_query.filter(
        stock_fisico__lte=3,
        stock_fisico__gt=0
    ).count()
    
    # Valor total del inventario
    valor_total = stocks_query.annotate(
        valor=ExpressionWrapper(
            F('stock_fisico') * F('producto__precio'),
            output_field=DecimalField()
        )
    ).aggregate(total=Sum('valor'))['total'] or 0
    
    valor_total = round(valor_total, 2)

    # ==========================
    # FORMULARIOS
    # ==========================
    editar_id = request.GET.get('editar')
    producto_editando = None

    if editar_id:
        producto_editando = get_object_or_404(Producto, id=editar_id)
        form_producto = ProductoForm(instance=producto_editando)
    else:
        form_producto = ProductoForm()

    form_categoria = CategoriaForm()

    # ==========================
    # POST
    # ==========================
    if request.method == 'POST':

        # ----------------------------------
        # ACTUALIZAR STOCK (con AJAX)
        # ----------------------------------
        if 'stock_id' in request.POST:
            try:
                stock_id = request.POST.get('stock_id')
                stock_fisico = request.POST.get('stock_fisico', '').strip()
                stock_virtual = request.POST.get('stock_virtual', '').strip()

                if stock_id and stock_id != 'None':
                    stock = get_object_or_404(Stock, id=int(stock_id), sucursal=sucursal)
                else:
                    producto_id = request.POST.get('producto_id')
                    producto = get_object_or_404(Producto, id=int(producto_id))
                    stock, _ = Stock.objects.get_or_create(
                        producto=producto,
                        sucursal=sucursal,
                        defaults={'stock_fisico': 0, 'stock_virtual': 0}
                    )

                cambios = []
                if stock_fisico != '':
                    stock_fisico_int = int(stock_fisico)
                    if stock_fisico_int < 0:
                        raise ValueError("El stock físico no puede ser negativo.")
                    if stock.stock_fisico != stock_fisico_int:
                        stock.stock_fisico = stock_fisico_int
                        cambios.append('físico')

                if stock_virtual != '':
                    stock_virtual_int = int(stock_virtual)
                    if stock_virtual_int < 0:
                        raise ValueError("El stock virtual no puede ser negativo.")
                    if stock.stock_virtual != stock_virtual_int:
                        stock.stock_virtual = stock_virtual_int
                        cambios.append('virtual')

                stock.save()

                # Si es una petición AJAX
                if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                    return JsonResponse({
                        'success': True,
                        'message': 'Stock actualizado',
                        'cambios': cambios
                    })

                messages.success(request, "Stock actualizado correctamente.")
                return redirect(request.META.get('HTTP_REFERER', 'inventario'))

            except ValueError as e:
                if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                    return JsonResponse({
                        'success': False,
                        'error': str(e)
                    }, status=400)
                messages.error(request, str(e))
                return redirect('inventario')
                
            except Exception as e:
                if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                    return JsonResponse({
                        'success': False,
                        'error': 'Error al actualizar stock'
                    }, status=500)
                messages.error(request, "Error al actualizar stock")
                return redirect('inventario')

        # ----------------------------------
        # GUARDAR PRODUCTO
        # ----------------------------------
        elif 'guardar_producto' in request.POST:

            form_producto = ProductoForm(
                request.POST,
                instance=producto_editando if producto_editando else None
            )

            if form_producto.is_valid():
                try:
                    with transaction.atomic():

                        producto = form_producto.save(commit=False)

                        # ----------------------------------
                        # NORMALIZAR DATOS
                        # ----------------------------------
                        producto.nombre = (producto.nombre or "").strip().upper()
                        producto.descripcion = (producto.descripcion or "").strip().upper()

                        if producto.no_folio:
                            producto.no_folio = producto.no_folio.strip().upper()

                        if producto.referencia:
                            producto.referencia = producto.referencia.strip().upper()

                        # ----------------------------------
                        # VALIDAR FOLIO
                        # ----------------------------------
                        if producto.no_folio:
                            existe = Producto.objects.filter(
                                no_folio__iexact=producto.no_folio.strip()
                            )

                            if producto_editando:
                                existe = existe.exclude(id=producto_editando.id)

                            if existe.exists():
                                if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                                    return JsonResponse({
                                        'success': False,
                                        'error': f"El folio '{producto.no_folio}' ya existe."
                                    }, status=400)
                                messages.error(request, f"El folio '{producto.no_folio}' ya existe.")
                                return redirect('inventario')

                        # ----------------------------------
                        # GENERAR REFERENCIA AUTOMÁTICA
                        # ----------------------------------
                        if not producto.referencia and producto.categoria and producto.categoria.prefijo:

                            prefijo = producto.categoria.prefijo.upper()

                            referencias = (
                                Producto.objects
                                .filter(referencia__startswith=f"{prefijo}-")
                                .values_list('referencia', flat=True)
                            )

                            max_numero = 0
                            for ref in referencias:
                                try:
                                    numero = int(ref.split('-')[-1])
                                    if numero > max_numero:
                                        max_numero = numero
                                except:
                                    continue

                            nuevo_numero = max_numero + 1
                            producto.referencia = f"{prefijo}-{nuevo_numero:04d}"

                        # ----------------------------------
                        # VALIDAR REFERENCIA
                        # ----------------------------------
                        if producto.referencia:
                            referencia_existente = Producto.objects.filter(
                                referencia__iexact=producto.referencia.strip()
                            )

                            if producto_editando:
                                referencia_existente = referencia_existente.exclude(
                                    id=producto_editando.id
                                )

                            if referencia_existente.exists():
                                if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                                    return JsonResponse({
                                        'success': False,
                                        'error': f"La referencia '{producto.referencia}' ya existe."
                                    }, status=400)
                                messages.error(request, f"La referencia '{producto.referencia}' ya existe.")
                                return redirect('inventario')

                        # ----------------------------------
                        # VALIDAR PRECIO
                        # ----------------------------------
                        if producto.precio is not None and producto.precio < 0:
                            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                                return JsonResponse({
                                    'success': False,
                                    'error': "El precio no puede ser negativo."
                                }, status=400)
                            messages.error(request, "El precio no puede ser negativo.")
                            return redirect('inventario')

                        # ----------------------------------
                        # GUARDAR PRODUCTO
                        # ----------------------------------
                        producto.save()

                        # ----------------------------------
                        # CREAR STOCK CON STOCK INICIAL
                        # ----------------------------------
                        stock_inicial = request.POST.get('stock_inicial')
                        if stock_inicial and not producto_editando:
                            try:
                                stock_inicial = int(stock_inicial)
                            except ValueError:
                                stock_inicial = 0
                        else:
                            stock_inicial = 0

                        stock, created = Stock.objects.get_or_create(
                            producto=producto,
                            sucursal=sucursal,
                            defaults={
                                'stock_fisico': stock_inicial,
                                'stock_virtual': 0
                            }
                        )

                        # Si ya existía pero no se está editando, actualizar solo si es nuevo producto
                        if not producto_editando and not created:
                            stock.stock_fisico += stock_inicial
                            stock.save()

                    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                        return JsonResponse({
                            'success': True,
                            'message': f"Producto '{producto.nombre}' guardado correctamente.",
                            'producto_id': producto.id
                        })

                    messages.success(
                        request,
                        f"Producto '{producto.nombre}' guardado correctamente."
                    )
                    return redirect('inventario')

                except IntegrityError as e:
                    print("ERROR AL GUARDAR PRODUCTO:", e)
                    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                        return JsonResponse({
                            'success': False,
                            'error': "Error de base de datos al guardar el producto."
                        }, status=500)
                    messages.error(request, "Error de base de datos al guardar el producto.")
                    return redirect('inventario')

            else:
                print("ERRORES FORMULARIO:", form_producto.errors)
                if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                    return JsonResponse({
                        'success': False,
                        'error': "Errores en el formulario",
                        'errors': form_producto.errors
                    }, status=400)
                messages.error(request, "Hay errores en el formulario. Revisa los campos.")
                return redirect('inventario')

        # ----------------------------------
        # GUARDAR CATEGORÍA
        # ----------------------------------
        elif 'guardar_categoria' in request.POST:

            form_categoria = CategoriaForm(request.POST)

            if form_categoria.is_valid():
                try:
                    with transaction.atomic():

                        categoria = form_categoria.save(commit=False)
                        categoria.nombre = categoria.nombre.strip().upper()

                        if Categoria.objects.filter(nombre=categoria.nombre).exists():
                            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                                return JsonResponse({
                                    'success': False,
                                    'error': f"La categoría '{categoria.nombre}' ya existe."
                                }, status=400)
                            messages.error(request, f"La categoría '{categoria.nombre}' ya existe.")
                            return redirect('inventario')

                        if not categoria.prefijo:
                            prefijo_base = categoria.nombre[:3].upper()
                            prefijo = prefijo_base
                            contador = 1
                            while Categoria.objects.filter(prefijo=prefijo).exists():
                                prefijo = f"{prefijo_base}{contador}"
                                contador += 1
                            categoria.prefijo = prefijo

                        categoria.save()

                        if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                            return JsonResponse({
                                'success': True,
                                'message': f"Categoría '{categoria.nombre}' guardada correctamente.",
                                'categoria': {
                                    'id': categoria.id,
                                    'nombre': categoria.nombre,
                                    'prefijo': categoria.prefijo
                                }
                            })

                        messages.success(
                            request,
                            f"Categoría '{categoria.nombre}' guardada correctamente con prefijo '{categoria.prefijo}'."
                        )

                except Exception as e:
                    print("ERROR AL GUARDAR CATEGORÍA:", str(e))
                    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                        return JsonResponse({
                            'success': False,
                            'error': str(e)
                        }, status=500)
                    messages.error(request, f"Ocurrió un error al guardar la categoría: {str(e)}")

                return redirect('inventario')

            else:
                errores_form = form_categoria.errors.as_json()
                print("ERRORES FORMULARIO CATEGORÍA:", errores_form)
                if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                    return JsonResponse({
                        'success': False,
                        'error': "Error en el formulario de categoría",
                        'errors': form_categoria.errors
                    }, status=400)
                messages.error(request, "Error en el formulario de categoría. Revisa los campos.")
                return redirect('inventario')

        # ----------------------------------
        # IMPORTAR EXCEL
        # ----------------------------------
        elif 'subir_excel' in request.POST and request.FILES.get('archivo_excel'):

            archivo_excel = request.FILES['archivo_excel']

            # Validar extensión
            if not archivo_excel.name.endswith(('.xlsx', '.xls')):
                messages.error(request, "El archivo debe ser .xlsx o .xls")
                return redirect('inventario')

            try:
                resultado = importar_productos_excel(archivo_excel, sucursal)

                if resultado.get("errores", 0) == 0:
                    messages.success(
                        request,
                        f"✅ Importación completada exitosamente<br>"
                        f"📦 Creados: {resultado.get('creados', 0)} | "
                        f"🔄 Actualizados: {resultado.get('actualizados', 0)} | "
                        f"📁 Categorías: {resultado.get('categorias', 0)} | "
                        f"⏭️ Ignorados: {resultado.get('ignorados', 0)}"
                    )
                else:
                    messages.warning(
                        request,
                        f"⚠️ Importación con advertencias<br>"
                        f"📦 Creados: {resultado.get('creados', 0)} | "
                        f"🔄 Actualizados: {resultado.get('actualizados', 0)} | "
                        f"❌ Errores: {resultado.get('errores', 0)}"
                    )

            except Exception as e:
                print("ERROR IMPORTACIÓN:", str(e))
                messages.error(request, f"Error al procesar el archivo: {str(e)}")

            return redirect('inventario')

    # ==========================
    # CONTEXTO ENRIQUECIDO
    # ==========================
    context = {
        'form_producto': form_producto,
        'form_categoria': form_categoria,
        'stocks': page_obj,
        'page_obj': page_obj,  # Para paginación
        'categorias': categorias,
        'producto_editando': producto_editando,
        'sucursal_actual': sucursal,
        
        # Estadísticas para dashboard
        'total_stock_fisico': total_stock_fisico,
        'total_stock_virtual': total_stock_virtual,
        'productos_bajos': productos_bajos,
        'valor_total': valor_total,
        
        # Para filtros en tiempo real (AJAX)
        'is_ajax': request.headers.get('x-requested-with') == 'XMLHttpRequest',
    }

    # Si es petición AJAX y solo quiere la tabla
    if request.headers.get('x-requested-with') == 'XMLHttpRequest' and request.GET.get('nombre', '') != '':
        return render(request, 'core/inventario_table.html', {
            'page_obj': page_obj,
            'total_stock_fisico': total_stock_fisico,
            'total_stock_virtual': total_stock_virtual,
        })

    return render(request, 'core/inventario.html', context)

@login_required
@user_passes_test(es_admin)
def validar_folio(request):
    folio = request.GET.get('folio', '').strip().upper()
    producto_id = request.GET.get('producto_id')

    existe = Producto.objects.filter(no_folio__iexact=folio)

    if producto_id:
        existe = existe.exclude(id=producto_id)

    return JsonResponse({
        "existe": existe.exists()
    })

@login_required
def eliminar_categoria(request, id):
    categoria = get_object_or_404(Categoria, id=id)
    if request.user.is_superuser:
        categoria.delete()
        messages.success(request, "Categoría eliminada correctamente.")
    return redirect('inventario')

@login_required
@user_passes_test(es_admin)
def exportar_productos_excel(request):

    sucursal = obtener_sucursal_activa(request)

    if not sucursal:
        messages.error(request, "No hay sucursal activa.")
        return redirect('inventario')

    stocks = (
        Stock.objects
        .filter(sucursal=sucursal)
        .select_related('producto', 'producto__categoria')
    )

    data = []

    for stock in stocks:
        data.append({
            'No. Folio': stock.producto.no_folio,
            'Referencia': stock.producto.referencia,
            'Nombre': stock.producto.nombre,
            'Descripción': stock.producto.descripcion,
            'Categoría': stock.producto.categoria.nombre if stock.producto.categoria else '',
            'Precio': stock.producto.precio,
            'Precio Mayoreo': stock.producto.precio_mayoreo,
            'Unidad de Medida': stock.producto.unidad_medida,
            'Stock Físico': stock.stock_fisico,
            'Stock Virtual': stock.stock_virtual,
        })

    df = pd.DataFrame(data)

    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
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
@user_passes_test(es_caja)
def home_usuario(request):
    return render(request, "core/home_usuario.html")

@login_required
@user_passes_test(es_caja)
def registro_ventas(request):
    no_venta = generar_folio_secuencial('V')
    form = RegistroVentasForm()

    if request.method == 'POST':
        
        # Saber si el usuario quiere solo registrar o registrar+ cobrar
        cobrar = request.POST.get("cobrar") == "1"

        # AJAX
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
                    return JsonResponse({"error": "Descuento inválido"}, status=400)

                with transaction.atomic():

                    # Crear cabecera de venta
                    venta = Venta.objects.create(
                        tipo_cliente=tipo_cliente,
                        vendedor_id=vendedor_id,
                        no_venta=no_venta,
                        descuento=descuento
                    )

                    # Crear detalle por cada producto
                    for p in productos:
                        producto = Producto.objects.get(no_folio=p["no_folio"])
                        cantidad = int(p["cantidad"])

                        if producto.stock_fisico < cantidad:
                            raise ValueError(f"Stock insuficiente para {producto.nombre}")

                        precio_unitario = producto.precio

                        # Precio mayoreo
                        if cantidad >= 6:
                            precio_unitario = producto.precio_mayoreo if hasattr(producto,"precio_mayoreo") else producto.precio * Decimal("0.85")

                        # Descuento mayorista
                        if tipo_cliente == "mayorista" and descuento > 0:
                            precio_unitario = precio_unitario * (Decimal('1') - Decimal(descuento)/Decimal('100'))

                        VentaDetalle.objects.create(
                            venta=venta,
                            producto=producto,
                            cantidad=cantidad,
                            precio_unitario=precio_unitario
                        )

                        producto.stock_fisico -= cantidad
                        producto.save()

                # ============================
                # 🔥 SI EL USUARIO QUIERE COBRAR DESDE AQUÍ
                # ============================
                if cobrar:
                    detalles = venta.detalles.all()
                    total_sin_desc = sum([d.precio_unitario * d.cantidad for d in detalles])
                    desc = Decimal(venta.descuento or 0)
                    total_final = total_sin_desc - (total_sin_desc * desc / 100)

                    Pago.objects.create(
                        venta=venta,
                        monto_pagado=total_final,
                        forma_pago="efectivo"
                    )

                    venta.pagado = True
                    venta.save()

                    # Activar impresión de ticket con tus scripts actuales
                    messages.success(request, "Pago realizado.", extra_tags="success pago")

                    return JsonResponse({
                        "success": True,
                        "pago": True,
                        "folio_venta": venta.no_venta,
                        "total": float(total_final)
                    })

                # ============================
                # 🔥 SI SOLO SE REGISTRA
                # ============================
                messages.success(request, "Venta registrada", extra_tags="success registrar")
                return JsonResponse({
                    "success": True,
                    "pago": False,
                    "folio_venta": venta.no_venta
                })

            except Exception as e:
                return JsonResponse({"error": str(e)}, status=400)

    return render(request, 'core/registro_ventas.html', {
        'form': form,
        'no_venta': no_venta
    })

@login_required
@user_passes_test(es_admin)
def entrada_inventario(request):
    if request.method == 'POST':
        producto_id = request.POST.get('producto_id')
        cantidad = int(request.POST.get('cantidad'))

        sucursal = request.user.sucursal
        producto = get_object_or_404(Producto, id=producto_id)

        stock, _ = Stock.objects.get_or_create(
            producto=producto,
            sucursal=sucursal
        )

        stock.stock_fisico += cantidad
        stock.save()

        messages.success(request, "Stock agregado correctamente")
        return redirect('inventario')
    

def productos_vendidos(request):

        productos = (
            VentaDetalle.objects
            .filter(venta__cancelada=False)
            .values(nombre_producto=F('producto__nombre'))
            .annotate(
                cantidad_total=Sum('cantidad'),
                dinero_total=Sum('total')
            )
            .order_by('-cantidad_total')
        )

        total_productos = sum(p['cantidad_total'] for p in productos)
        total_dinero = sum(p['dinero_total'] for p in productos)

        context = {
            'productos': productos,
            'total_productos': total_productos,
            'total_dinero': total_dinero
        }

        return render(request, 'core/productos_vendidos.html', context)

@login_required
@user_passes_test(es_caja)
def buscar_producto(request):

    q = request.GET.get('q', '').strip().upper()
    sucursal = request.user.sucursal

    if not q:
        return JsonResponse([], safe=False)

    filtros = (
        Q(referencia__icontains=q) |
        Q(nombre__icontains=q) |
        Q(no_folio__icontains=q)
    )

    if q.isdigit() and len(q) >= 4:
        filtros |= (
            Q(no_folio__endswith=q) |
            Q(referencia__endswith=q)
        )

    productos = (
        Producto.objects
        .filter(filtros)
        .only(
            "id",
            "no_folio",
            "nombre",
            "descripcion",
            "precio",
            "precio_mayoreo",
            "umbral_mayoreo",
            "referencia"
        )
        [:30]
    )

    # 🔥 traer stocks en una sola consulta
    stocks = Stock.objects.filter(
        producto__in=productos,
        sucursal=sucursal
    )

    stock_map = {s.producto_id: s for s in stocks}

    resultados = []

    for p in productos:

        stock = stock_map.get(p.id)

        resultados.append({
            'id': p.id,
            'no_folio': p.no_folio,
            'nombre': p.nombre,
            'descripcion': p.descripcion,
            'precio': float(p.precio),
            'precio_mayoreo': float(p.precio_mayoreo) if p.precio_mayoreo else None,
            'umbral_mayoreo': p.umbral_mayoreo,
            'referencia': p.referencia,
            'stock_fisico': stock.stock_fisico if stock else 0,
            'stock_virtual': stock.stock_virtual if stock else 0,
        })

    return JsonResponse(resultados, safe=False)

@login_required
@user_passes_test(es_caja)
def historial_ventas(request):
    ventas = Venta.objects.all()
    return render(request, 'core/historial_ventas.html', {'ventas': ventas})

@login_required
@user_passes_test(es_caja)
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
    cambio = None
    ultimo_pago = None

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
                    messages.add_message(request, messages.SUCCESS, "Pago registrado exitosamente.", extra_tags="success pago")
                    return redirect(f'{reverse("caja")}?folio={folio}')
                else:
                    messages.error(request, "El monto pagado es menor al total.")
            
            venta_bloqueada = venta.pagado or venta.cancelada
                
            if venta.pagado:
                     ultimo_pago = venta.pagos.last()
            if ultimo_pago:
                    cambio = (ultimo_pago.monto_pagado - total).quantize(Decimal('0.01'))

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
        'cambio': cambio,
        'ultimo_pago': ultimo_pago,
    }

    return render(request, 'core/caja.html', context)


@require_POST
@login_required
@user_passes_test(es_caja)
def actualizar_cantidad_producto(request):
    detalle_id = request.POST.get("detalle_id")
    nueva_cantidad = int(request.POST.get("cantidad", 0))

    try:
        detalle = VentaDetalle.objects.select_related("producto").get(id=detalle_id)
    except VentaDetalle.DoesNotExist:
        return JsonResponse({"success": False, "error": "Producto no encontrado."})

    producto = detalle.producto

    if nueva_cantidad > producto.stock_fisico:
        return JsonResponse({
            "success": False,
            "error": f"Stock insuficiente. Solo hay {producto.stock_fisico} disponibles."
        })

    detalle.cantidad = nueva_cantidad
    detalle.save()

    return JsonResponse({"success": True, "message": "Cantidad actualizada correctamente."})


@login_required
@user_passes_test(es_caja)
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
            producto.stock_fisico += detalle.cantidad
            producto.save()

            # Eliminar el detalle
            detalle.delete()

        messages.success(request, "Producto eliminado correctamente y stock actualizado.")
    except Exception as e:
        messages.error(request, f"Error al eliminar el producto: {str(e)}")

    return redirect(f'/caja/?folio={venta.no_venta}')

User = get_user_model()

@login_required
@user_passes_test(es_caja)
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
                        producto.stock_fisico += detalle.cantidad
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
@user_passes_test(es_caja)
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
                    if producto.stock_fisico >= diferencia:
                        producto.stock_fisico -= diferencia
                    else:
                        messages.error(request, "No hay suficiente stock disponible.")
                        return redirect(f'{reverse("caja")}?folio={folio}')
                elif diferencia < 0:
                    # Se quiere reducir cantidad → se regresa al stock
                    producto.stock_fisico += abs(diferencia)

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
@user_passes_test(es_caja)
def buscar_productos(request):
    q = request.GET.get('q', '')
    sucursal = request.user.sucursal  # 🔑 clave

    productos = Producto.objects.filter(
        nombre__icontains=q
    )[:10]

    data = []

    for p in productos:
        stock = Stock.objects.filter(
            producto=p,
            sucursal=sucursal
        ).first()

        data.append({
            'id': p.id,
            'no_folio': p.no_folio,
            'nombre': p.nombre,
            'descripcion': p.descripcion,
            'precio': float(p.precio),
            'stock_fisico': stock.stock_fisico if stock else 0
        })

    return JsonResponse({'results': data})

@login_required
@user_passes_test(es_caja)
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

            if producto.stock_fisico < cantidad:
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
            producto.stock_fisico -= cantidad
            producto.save()

            return JsonResponse({'success': True})
        except Producto.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Producto no encontrado.'})
        except Venta.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Venta no encontrada.'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})


@login_required
@user_passes_test(es_caja)
def inventario_usuario_view(request):
    productos = Producto.objects.all()
    notificaciones = Notificacion.objects.filter(usuario=request.user, leido=False)

    hay_stock_virtual = productos.filter(stock_virtual__gt=0).exists()
    tiene_notificaciones = notificaciones.exists()

    context = {
        'productos': productos,
        'notificaciones': notificaciones,
        'tiene_notificaciones': tiene_notificaciones,
    }
    return render(request, 'core/inventario_usuario.html', context)


@login_required
@user_passes_test(es_caja)
def transferir_stock(request, producto_id):
    producto = get_object_or_404(Producto, id=producto_id)

    if request.user.rol == 'USUARIO':
        if producto.stock_virtual > 0:
            producto.stock_fisico += producto.stock_virtual
            producto.stock_virtual = 0
            producto.save()

            # Marcar notificaciones como leídas
            Notificacion.objects.filter(usuario=request.user, producto=producto).update(leido=True)

            messages.success(request, "Stock transferido al físico correctamente.")
        else:
            messages.warning(request, "No hay stock virtual disponible.")
    else:
        messages.error(request, "No tienes permiso para hacer esta acción.")

    return redirect('inventario_usuario')

@login_required
@user_passes_test(es_caja)
def caja_completa(request):
    no_venta = generar_folio_secuencial('C') 
    form = RegistroVentasForm()
    venta = None
    folio = request.GET.get('folio')
    sucursal = request.user.sucursal  # 🔹 Obtener la sucursal del usuario
    print("POST DATA:", request.POST)

    if not sucursal:
        messages.error(request, "No tienes una sucursal asignada.")
        return redirect('index')

    # CASO 1: Creación de venta y registro inmediato de pago por AJAX
    if request.method == 'POST' and request.headers.get('x-requested-with') == 'XMLHttpRequest':
        try:
            productos = json.loads(request.POST.get("productos", "[]"))
            tipo_cliente = request.POST.get("tipo_cliente")
            vendedor_id = request.POST.get("vendedor")
            forma_pago = request.POST.get("forma_pago", "")
            monto_pagado_raw = request.POST.get("monto_pagado")

            # 🔒 Validar monto pagado
            try:
                monto_pagado = Decimal(monto_pagado_raw) if monto_pagado_raw else Decimal('0.00')
            except:
                return JsonResponse({"error": "Monto pagado inválido"}, status=400)

            if not productos:
                return JsonResponse({"error": "No se recibieron productos"}, status=400)

            if not tipo_cliente or not vendedor_id:
                return JsonResponse({"error": "Faltan datos del formulario"}, status=400)

            descuento_raw = request.POST.get("descuento", "")
            descuento = 0
            usar_precio_mayoreo = False

            if tipo_cliente == "mayorista":
                if descuento_raw == "producto":
                    usar_precio_mayoreo = True
                elif descuento_raw.isdigit():
                    descuento = int(descuento_raw)

            if tipo_cliente != "mayorista" and (descuento > 0 or usar_precio_mayoreo):
                return JsonResponse({"error": "Solo los mayoristas pueden tener descuento"}, status=400)

            if descuento not in [0, 10, 30, 50]:
                return JsonResponse({"error": "El descuento debe ser 10, 30 o 50%"}, status=400)

            # 🔒 Validar contraseña admin si es mayorista
            if tipo_cliente == 'mayorista':
                password_admin = request.POST.get("password_admin", "").strip()
                if not password_admin:
                    return JsonResponse({"error": "Debes ingresar la contraseña del administrador."}, status=400)

                admins = User.objects.filter(rol='ADMIN')
                if not any(admin.check_password(password_admin) for admin in admins):
                    return JsonResponse({"error": "Contraseña de administrador incorrecta."}, status=400)

            with transaction.atomic():

                venta = Venta.objects.create(
                    tipo_cliente=tipo_cliente,
                    vendedor_id=vendedor_id,
                    usuario=request.user,
                    sucursal=sucursal,
                    no_venta=no_venta,
                    descuento=descuento
                )

                total_calculado = Decimal('0.00')

                for p in productos:

                    try:
                        producto = Producto.objects.get(no_folio=p["no_folio"])
                    except Producto.DoesNotExist:
                        raise ValueError(f"El producto con folio {p['no_folio']} no existe.")

                    cantidad = int(p["cantidad"])

                    try:
                        stock = Stock.objects.get(producto=producto, sucursal=sucursal)
                    except Stock.DoesNotExist:
                        raise ValueError(f"No hay stock registrado para {producto.nombre} en esta sucursal.")

                    if stock.stock_fisico < cantidad:
                        raise ValueError(
                            f"Stock insuficiente para {producto.nombre}. Solo hay {stock.stock_fisico}."
                        )

                    if usar_precio_mayoreo and cantidad < 6:
                        raise ValueError(
                            f"El producto {producto.nombre} debe venderse mínimo en 6 piezas para mayoreo."
                        )

                    # 🔒 Determinar precio en backend
                    if usar_precio_mayoreo:
                        precio_unitario = producto.precio_mayoreo
                    elif descuento > 0:
                        precio_unitario = producto.precio * (
                            Decimal('1') - Decimal(descuento) / Decimal('100')
                        )
                    else:
                        precio_unitario = producto.precio

                    subtotal = precio_unitario * cantidad
                    total_calculado += subtotal

                    VentaDetalle.objects.create(
                        venta=venta,
                        producto=producto,
                        cantidad=cantidad,
                        precio_unitario=precio_unitario
                    )

                    stock.stock_fisico -= cantidad
                    stock.save()

                # 🔒 VALIDACIÓN REAL DEL TOTAL
                if monto_pagado < total_calculado:
                    raise ValueError("El monto pagado es menor al total.")

                Pago.objects.create(
                    venta=venta,
                    monto_pagado=monto_pagado,
                    forma_pago=forma_pago
                )

                venta.pagado = True
                venta.total = total_calculado  # 👈 si tienes campo total en modelo
                venta.save()

            return JsonResponse({
                "success": True,
                "no_venta": venta.no_venta,
                "sucursal_nombre": venta.sucursal.nombre,
                "sucursal_direccion": venta.sucursal.direccion,
                "total": str(total_calculado)
            })

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    # CASO 2: Visualizar y pagar venta existente por folio
    if folio:
        try:
            venta = Venta.objects.prefetch_related('detalles__producto').get(no_venta=folio)
            detalles = venta.detalles.all()

            total_sin_descuento = sum([d.precio_unitario * d.cantidad for d in detalles])
            descuento_porcentaje = Decimal(venta.descuento or 0)
            descuento_monetario = (total_sin_descuento * descuento_porcentaje) / Decimal('100.00')
            total = total_sin_descuento - descuento_monetario

            if request.method == 'POST' and not venta.pagado:
                monto_pagado = Decimal(request.POST.get('monto_pagado', '0.00'))
                forma_pago = request.POST.get('forma_pago', '')

                if venta.tipo_cliente == 'mayorista':
                    password_admin = request.POST.get('password_admin', '').strip()
                    if not password_admin:
                        messages.error(request, "Debes ingresar la contraseña del administrador.")
                        return redirect(f'{reverse("caja-completa")}?folio={folio}')
                    
                    admins = User.objects.filter(rol='ADMIN')
                    admin_validado = None
                    for admin in admins:
                        if admin.check_password(password_admin):
                            admin_validado = admin
                            break

                    if not admin_validado:
                        messages.error(request, "Contraseña incorrecta o sin permisos de administrador.")
                        return redirect(f'{reverse("caja-completa")}?folio={folio}')

                if monto_pagado >= total:
                    Pago.objects.create(venta=venta, monto_pagado=monto_pagado, forma_pago=forma_pago)
                    venta.pagado = True
                    venta.save()
                    messages.success(request, "Pago registrado exitosamente.", extra_tags="pago")
                    return redirect(f'{reverse("caja-completa")}?folio={folio}')
                else:
                    messages.error(request, "El monto pagado es menor al total.")

            context = {
                'venta': venta,
                'total': total.quantize(Decimal('0.01')),
                'total_sin_descuento': total_sin_descuento.quantize(Decimal('0.01')),
                'descuento_porcentaje': descuento_porcentaje,
                'descuento_monetario': descuento_monetario.quantize(Decimal('0.01')),
            }
            return render(request, 'core/caja_completa.html', context | {'form': form, 'no_venta': no_venta})

        except Venta.DoesNotExist:
            messages.error(request, "No se encontró la venta con ese folio.")

    return render(request, 'core/caja_completa.html', {'form': form, 'no_venta': no_venta})



def exportar_excel_bajo(request):
    # SOLO productos con stock físico bajo (1 o 2 piezas)
    sucursal = obtener_sucursal_activa(request)

    if not sucursal:
        messages.error(request, "No hay sucursal activa.")
        return redirect('inventario')

    stocks_bajos = Stock.objects.filter(
    sucursal=sucursal,
    stock_fisico__lte=2
    ).select_related('producto', 'producto__categoria')

    if not stocks_bajos.exists():
        messages.warning(request, "No hay productos con stock bajo.")
        return redirect('inventario')
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Stock Físico Bajo"

    
    # Encabezados
    ws.append([
        'No. Folio',
        'Nombre',
        'Descripción',
        'Categoría',
        'Precio',
        'Precio Mayoreo',
        'Unidad de Medida',
        'stock_virtual',
        'stock_fisico'
    ])

    # Registros
    for stock in stocks_bajos:
        ws.append([
            stock.producto.no_folio,
            stock.producto.nombre,
            stock.producto.descripcion,
            str(stock.producto.categoria),
            stock.producto.precio,
            stock.producto.precio_mayoreo,
            stock.producto.unidad_medida,
            stock.stock_fisico,
            stock.stock_virtual
        ])

    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = (
        'attachment; filename=productos_stock_fisico_bajo.xlsx'
    )

    wb.save(response)
    return response


def checador_publico(request, sucursal_id):
    sucursal = get_object_or_404(Sucursal, id=sucursal_id)

    query = request.GET.get('q', '').strip()
    producto = None

    if query:
        # Buscar primero por código exacto
        producto = Producto.objects.filter(no_folio=query).first()

        # Si no encuentra, buscar por nombre
        if not producto:
            producto = Producto.objects.filter(
                nombre__icontains=query
            ).first()

    return render(request, 'publico/checador.html', {
        'producto': producto,
        'sucursal': sucursal
    })


def imprimir_etiquetas_masivo(request):
    if request.method == "POST":
        # Recibir productos seleccionados
        productos_json = request.POST.get('productos', '[]')
        try:
            ids = json.loads(productos_json)
        except:
            ids = request.POST.getlist('productos')
        
        if not ids:
            messages.warning(request, 'No existen productos en la lista')
            return redirect('inventario')
        
        productos = Producto.objects.filter(id__in=ids)
        
        # ========== RECIBIR CONFIGURACIÓN DEL FRONTEND ==========
        # Tamaño de etiqueta
        tamano = request.POST.get('tamano_etiqueta', '4x2.5')
        if tamano == 'custom':
            ancho_cm = float(request.POST.get('ancho_personalizado', 4))
            alto_cm = float(request.POST.get('alto_personalizado', 2.5))
        else:
            tamaños = {
                '3x2': (3, 2),
                '4x2.5': (4, 2.5),
                '5x3': (5, 3),
                '6x4': (6, 4),
            }
            ancho_cm, alto_cm = tamaños.get(tamano, (4, 2.5))
        
        # Qué mostrar
        mostrar_nombre = request.POST.get('mostrar_nombre') == 'on'
        mostrar_folio = request.POST.get('mostrar_folio') == 'on'
        mostrar_referencia = request.POST.get('mostrar_referencia') == 'on'
        mostrar_precio = request.POST.get('mostrar_precio') == 'on'
        mostrar_numero_codigo = request.POST.get('mostrar_numero_codigo') == 'on'
        
        # Configuración del código de barras
        altura_codigo = float(request.POST.get('altura_codigo', 0.8))
        ancho_barra = float(request.POST.get('ancho_barra', 0.03))
        fuente_numero = int(request.POST.get('fuente_numero', 8))
        
        # =======================================================
        
        buffer = io.BytesIO()
        ancho = ancho_cm * cm
        alto = alto_cm * cm
        
        c = canvas.Canvas(buffer, pagesize=(ancho, alto))
        
        # Calcular espaciado según altura
        espaciado = 0.3 * cm
        
        for producto in productos:
            codigo = str(producto.no_folio).strip() if producto.no_folio else str(producto.id)
            pos_y = alto - 0.2 * cm
            
            # Nombre
            if mostrar_nombre and producto.nombre:
                c.setFont("Helvetica-Bold", 8)
                nombre = producto.nombre[:25]
                c.drawCentredString(ancho / 2, pos_y, nombre)
                pos_y -= 0.35 * cm
            
            # Folio
            if mostrar_folio:
                c.setFont("Helvetica", 6)
                c.drawCentredString(ancho / 2, pos_y, f"FOLIO: {codigo}")
                pos_y -= 0.3 * cm
            
            # Referencia
            if mostrar_referencia and hasattr(producto, 'referencia') and producto.referencia:
                c.setFont("Helvetica", 6)
                c.drawCentredString(ancho / 2, pos_y, f"REF: {producto.referencia}")
                pos_y -= 0.3 * cm
            
            # Precio
            if mostrar_precio:
                c.setFont("Helvetica-Bold", 10)
                c.drawCentredString(ancho / 2, pos_y, f"${producto.precio:.2f}")
                pos_y -= 0.4 * cm
            
            # Código de barras
            try:
                barcode = code128.Code128(
                    codigo,
                    barHeight=altura_codigo * cm,
                    barWidth=ancho_barra * cm
                )
                
                barcode_width = barcode.width
                barcode_x = (ancho - barcode_width) / 2
                barcode_y = 0.2 * cm + (0.25 * cm if mostrar_numero_codigo else 0.1 * cm)
                
                barcode.drawOn(c, barcode_x, barcode_y)
                
                if mostrar_numero_codigo:
                    c.setFont("Helvetica", fuente_numero)
                    c.drawCentredString(ancho / 2, barcode_y - 0.2 * cm, codigo)
                    
            except Exception as e:
                c.setFont("Helvetica", 8)
                c.drawCentredString(ancho / 2, alto / 2, codigo)
            
            c.showPage()
        
        c.save()
        
        pdf = buffer.getvalue()
        buffer.close()
        
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'inline; filename="etiquetas_impresion.pdf"'
        response.write(pdf)
        
        return response
    
    return redirect('inventario')

@login_required
def detalle_venta(request, venta_id):
    venta = get_object_or_404(Venta, id=venta_id)
    detalles = venta.detalles.all()
    pagos = venta.pagos.all()
    
    total_pagado = sum(pago.monto_pagado for pago in pagos)
    
    # Calcular subtotal de productos
    subtotal = sum(detalle.total for detalle in detalles)
    
    # Aplicar descuento si existe
    if venta.descuento > 0:
        descuento_aplicado = subtotal * (venta.descuento / 100)
        venta_total = subtotal - descuento_aplicado
    else:
        descuento_aplicado = 0
        venta_total = subtotal
    
    context = {
        'venta': venta,
        'detalles': detalles,
        'pagos': pagos,
        'total_pagado': total_pagado,
        'subtotal': subtotal,
        'descuento_aplicado': descuento_aplicado,
        'venta_total': venta_total,
    }
    return render(request, 'core/detalle_venta.html', context)


@login_required
def ultimas_ventas(request):
    """API para obtener las últimas 5 ventas en formato JSON"""
    ventas = Venta.objects.select_related('vendedor').order_by('-fecha')[:5]
    
    data = []
    for venta in ventas:
        # Calcular total de la venta
        total = venta.detalles.aggregate(total=Sum('total'))['total'] or 0
        
        data.append({
            'id': venta.id,
            'no_venta': venta.no_venta,
            'vendedor': venta.vendedor.nombre if venta.vendedor else 'N/A',
            'fecha': venta.fecha.strftime('%d/%m/%Y %H:%M'),
            'total': float(total),
            'estado': 'cancelada' if venta.cancelada else 'pagada' if venta.pagado else 'pendiente'
        })
    
    return JsonResponse(data, safe=False)
@login_required
def actualizar_producto_desde_venta(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Método no permitido'})
    
    try:
        producto_id = request.POST.get('producto_id')
        nuevo_precio = request.POST.get('nuevo_precio', '').strip()
        nuevo_precio_mayoreo = request.POST.get('nuevo_precio_mayoreo', '').strip()
        nuevo_stock_fisico = request.POST.get('nuevo_stock_fisico', '').strip()
        nuevo_stock_virtual = request.POST.get('nuevo_stock_virtual', '').strip()
        password_admin = request.POST.get('password_admin', '').strip()
        
        ADMIN_MASTER_PASSWORD = "admin123"
        
        if not producto_id:
            return JsonResponse({'success': False, 'message': 'ID de producto no proporcionado'})
        
        if not password_admin:
            return JsonResponse({'success': False, 'message': 'Se requiere contraseña', 'error': 'password'})
        
        if password_admin != ADMIN_MASTER_PASSWORD:
            return JsonResponse({'success': False, 'message': 'Contraseña incorrecta', 'error': 'password'})
        
        with transaction.atomic():
            producto = get_object_or_404(Producto, id=producto_id)
            precio_actualizado = False
            
            if nuevo_precio:
                try:
                    nuevo_precio_val = float(nuevo_precio)
                    if nuevo_precio_val > 0:
                        producto.precio = nuevo_precio_val
                        precio_actualizado = True
                except ValueError:
                    pass
            
            if nuevo_precio_mayoreo:
                try:
                    nuevo_precio_mayoreo_val = float(nuevo_precio_mayoreo)
                    if nuevo_precio_mayoreo_val > 0:
                        producto.precio_mayoreo = nuevo_precio_mayoreo_val
                except ValueError:
                    pass
            
            producto.save()
            
            if hasattr(request.user, 'sucursal') and request.user.sucursal:
                stock = Stock.objects.filter(producto=producto, sucursal=request.user.sucursal).first()
                if stock:
                    if nuevo_stock_fisico:
                        try:
                            stock.stock_fisico = int(nuevo_stock_fisico)
                        except ValueError:
                            pass
                    if nuevo_stock_virtual:
                        try:
                            stock.stock_virtual = int(nuevo_stock_virtual)
                        except ValueError:
                            pass
                    stock.save()
        
        mensajes = []
        if precio_actualizado:
            mensajes.append(f'Precio actualizado a ${producto.precio:.2f}')
        if nuevo_stock_fisico:
            mensajes.append(f'Stock actualizado a {nuevo_stock_fisico}')
        
        return JsonResponse({
            'success': True,
            'message': ' / '.join(mensajes) if mensajes else 'Producto actualizado',
            'precio_actualizado': precio_actualizado,
            'nuevo_precio': float(producto.precio) if precio_actualizado else None
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Error: {str(e)}'
        }, status=500)
    
def obtener_stock_producto_api(request):
    """API para obtener stock actual de un producto"""
    producto_id = request.GET.get('producto_id')
    if not producto_id:
        return JsonResponse({'success': False, 'error': 'Producto no especificado'})
    
    try:
        from core.models import Producto, Stock
        
        producto = get_object_or_404(Producto, id=producto_id)
        
        # Obtener la sucursal del usuario
        sucursal = None
        if hasattr(request.user, 'sucursal'):
            sucursal = request.user.sucursal
        
        if sucursal:
            stock = Stock.objects.filter(producto=producto, sucursal=sucursal).first()
            
            return JsonResponse({
                'success': True,
                'stock_fisico': stock.stock_fisico if stock else 0,
                'stock_virtual': stock.stock_virtual if stock else 0,
                'precio': float(producto.precio),
                'precio_mayoreo': float(producto.precio_mayoreo) if producto.precio_mayoreo else 0
            })
        else:
            return JsonResponse({
                'success': True,
                'stock_fisico': 0,
                'stock_virtual': 0,
                'precio': float(producto.precio),
                'precio_mayoreo': float(producto.precio_mayoreo) if producto.precio_mayoreo else 0
            })
            
    except Exception as e:
        return JsonResponse({
            'success': False, 
            'error': str(e)
        }, status=500)

