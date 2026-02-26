"""
URL configuration for punto_venta project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
import os
from django.contrib import admin
from django.urls import path
from core import views


# 👇 Handlers personalizados
handler404 = 'core.views.error_404'
handler500 = 'core.views.error_500'
handler403 = 'core.views.error_403'

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.index, name='index'),
    path("register/", views.registro, name="register"),
    path("login/", views.iniciar_sesion, name="login"),
    path("logout/", views.cerrar_sesion, name="logout"),
    path('home_admin/', views.home_admin, name='home_admin'),
    path('home_usuario/', views.home_usuario, name='home_usuario'),
    path('configuracion/', views.configuracion, name='configuracion'),
    path('registro_ventas/', views.registro_ventas, name='registro_ventas'),
    path('vendedor/<int:id>/editar/', views.editar_vendedor, name='editar_vendedor'),
    path('vendedor/<int:id>/eliminar/', views.eliminar_vendedor, name='eliminar_vendedor'),
    path('inventario/', views.inventario_view, name='inventario'),
    path('inventario/eliminar_categoria/<int:id>/', views.eliminar_categoria, name='eliminar_categoria'),
    #path('inventario/eliminar_producto/<int:id>/', views.eliminar_producto, name='eliminar_producto'),
    path('editar-detalle/<int:id>/', views.editar_detalle, name='editar_detalle'),
    path("api/productos/", views.buscar_productos, name="buscar_productos"),
    path('caja/', views.caja, name='caja'),
    path('historial_ventas/', views.historial_ventas, name='historial_ventas'),
    path('buscar-producto/', views.buscar_producto, name='buscar_producto'),
    path('detalle/eliminar/<int:detalle_id>/', views.eliminar_detalle, name='eliminar_detalle'),
    path('venta/cancelar/<int:venta_id>/', views.cancelar_venta, name='cancelar_venta'),
    path('api/dashboard_data/', views.dashboard_data, name='dashboard_data'),
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),
    path('exportar_excel/', views.exportar_productos_excel, name='exportar_excel'),
    path('historial/', views.historial_ventas_admin, name='historial_ventas_admin'),
    path('eliminar-venta/<int:venta_id>/', views.eliminar_venta_view, name='eliminar_venta'),
    path('arqueo-caja/', views.arqueo_caja_view, name='arqueo_caja'),
    path('agregar-detalle/', views.agregar_detalle, name='agregar_detalle'),
    path('transferir-stock/<int:producto_id>/', views.transferir_stock, name='transferir_stock'),
    path('inventario-usuario/', views.inventario_usuario_view, name='inventario_usuario'),
    path('usuarios/', views.usuarios_view, name='usuarios'),
    path('caja-completa/', views.caja_completa, name='caja_completa'),
    path("caja/actualizar-cantidad/", views.actualizar_cantidad_producto, name="actualizar_cantidad_producto"),
    path('exportar_excel_bajo/', views.exportar_excel_bajo, name='exportar_excel_bajo'),
    path('sucursales/', views.sucursales_view, name='sucursales'),
    path('seleccionar-sucursal/', views.seleccionar_sucursal, name='seleccionar_sucursal'),
    path('checador/<int:sucursal_id>/', views.checador_publico, name='checador_publico'),
    path('etiquetas/masivo/', views.imprimir_etiquetas_masivo, name='imprimir_etiquetas_masivo'),
    path('sucursal/<int:id>/editar/', views.editar_sucursal, name='editar_sucursal'),
    path('validar-folio/', views.validar_folio, name='validar_folio'),





    
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

