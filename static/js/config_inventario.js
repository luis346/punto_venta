// ============================================
// CONFIGURACIÓN DEL MÓDULO DE INVENTARIO
// ============================================
// Este archivo debe cargarse ANTES que funciones_inventario.js

window.INVENTARIO_CONFIG = {
    urls: {
        exportar_excel: "{% url 'exportar_excel' %}",
        inventario: "{% url 'inventario' %}",
        validar_folio: "{% url 'validar_folio' %}",
        eliminar_producto: "/eliminar-producto/"
    },
    messages: {
        confirmar_eliminar: "¿Eliminar producto?",
        sin_seleccion: "Selecciona al menos un producto para imprimir"
    }
};