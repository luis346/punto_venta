/***************************************
 * DOCUMENT READY - INICIALIZACIÓN
 ***************************************/
$(document).ready(function () {
    agregarFila();
    setTimeout(() => $('#tabla-productos tbody tr:first input[data-tipo="no_folio"]').focus(), 50);

    // Validar stock al cambiar cantidad (VERSIÓN SIMPLE)
    $('#tabla-productos').on('input', '.cantidad', function () {
        const cantidad = parseInt($(this).val()) || 0;
        const stock_fisico = parseInt($(this).data('stock_fisico')) || 0;

        if (cantidad > stock_fisico) {
            const productoNombre = $(this).closest('tr').find('input[data-tipo="nombre"]').val();
            Swal.fire({
                icon: 'warning',
                title: 'Stock insuficiente',
                html: `<p><strong>${productoNombre}</strong></p><p>Stock disponible: ${stock_fisico}</p><p>Solo se agregarán ${stock_fisico} unidades</p>`,
                confirmButtonText: 'Aceptar'
            });
            $(this).val(stock_fisico);
        }
        
        validarStockGlobal();
        actualizarTotales();
        $('#monto_pagado').trigger('input');
    });

    // Validación de pago
    $('#monto_pagado').on('input', function () {
        const total = actualizarTotales();
        const pagado = parseFloat($(this).val()) || 0;
        const cambio = pagado - total;
        const $cambioInput = $('#cambio');
        const $btnCobrar = $('#btn-registrar-venta');

        if (pagado === 0) {
            $cambioInput.val('');
            $btnCobrar.prop('disabled', true);
        } else if (cambio < 0) {
            $cambioInput.val('Pago insuficiente').addClass('is-invalid').removeClass('is-valid');
            $btnCobrar.prop('disabled', true);
        } else {
            $cambioInput.val(cambio.toFixed(2)).removeClass('is-invalid').addClass('is-valid');
            $btnCobrar.prop('disabled', false);
        }
    });

    // Eventos
    $('#formVentaCompleta').on('submit', function (e) { e.preventDefault(); registrarVenta(); });
    $('#formPagoConPassword').on('submit', function (e) {
        e.preventDefault();
        const inputPassword = $('#password_admin_input').val().trim();
        if (!inputPassword) {
            Swal.fire({ title: "Error!", text: "Ingresa la contraseña del administrador.", icon: "error" });
            return;
        }
        password_admin = inputPassword;
        $('#modalPassword').modal('hide');
        enviarVenta(productos_temporales);
    });
    $('#btnBuscarProducto').on('click', () => $('#modalBuscarProducto').modal('show'));
    $('#btnLimpiarTodo').on('click', () => { if (confirm('¿Limpiar todos los productos?')) limpiarVentaCompleta(); });
    $('#btnVentaRapida').on('click', () => { const total = parseFloat($('#total-general').text()); $('#monto_pagado').val(total.toFixed(2)).trigger('input'); });
    
    // Eventos de tabla
    $('#tabla-productos').on('click', 'tr', function () { if ($(this).attr('id') !== 'fila-vacia') { filaSeleccionada = $(this); $('#tabla-productos tbody tr').removeClass('table-primary'); filaSeleccionada.addClass('table-primary'); } });
    $('#tabla-productos').on('focus', 'input', function () { const fila = $(this).closest('tr'); if (fila.attr('id') !== 'fila-vacia') { filaSeleccionada = fila; $('#tabla-productos tbody tr').removeClass('table-primary'); filaSeleccionada.addClass('table-primary'); } });
    $('#tabla-productos').on('click', '.btn-eliminar-fila', function () { eliminarFila($(this).closest('tr')); });
    
  // Enter en campo código
$('#tabla-productos').on('keypress', 'input[data-tipo="no_folio"]', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const input = $(this);  // <--- Guardar referencia
        const codigo = input.val().trim();
        const fila = input.closest('tr');
        if (!codigo) return;

        $.ajax({
            url: BUSCAR_PRODUCTO_URL,
            data: { q: codigo, tipo: 'no_folio' },
            success: function (data) {
                if (!data || !data.length) {
                    Swal.fire({ title: "No encontrado", text: "Producto no existe", icon: "error", timer: 1000, showConfirmButton: false });
                    input.select();  // <--- Usar input en lugar de $(this)
                    return;
                }
                const producto = data[0];
                if (parseInt(producto.stock_fisico) <= 0) {
                    Swal.fire({ title: "Sin stock", icon: "warning", timer: 1000, showConfirmButton: false });
                    input.select();  // <--- Usar input en lugar de $(this)
                    return;
                }
                seleccionarProducto(producto, fila);
            }
        });
    }
});
    console.log("✅ Sistema de caja inicializado");
});

// Mostrar hora actual
function actualizarHora() {
    const ahora = new Date();
    const hora = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('hora-actual').textContent = `🕐 ${hora}`;
}
setInterval(actualizarHora, 1000);
actualizarHora();

// Cargar últimas ventas
function cargarUltimasVentas() {
    fetch(ULTIMAS_VENTAS_URL)
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('ultimas-ventas');
            if (data.length === 0) {
                container.innerHTML = '<div class="text-center text-muted small py-2">Sin ventas recientes</div>';
                return;
            }
            
            let html = '<div class="list-group list-group-flush">';
            data.forEach(venta => {
                html += `
                    <div class="list-group-item p-2">
                        <div class="d-flex justify-content-between">
                            <small><strong>#${venta.no_venta}</strong></small>
                            <small class="text-success">$${venta.total}</small>
                        </div>
                        <small class="text-muted">${venta.fecha}</small>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        })
        .catch(() => {
            document.getElementById('ultimas-ventas').innerHTML = 
                '<div class="text-center text-muted small py-2">Error al cargar</div>';
        });
}

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
    // Verificar si la URL de últimas ventas existe
    if (typeof ULTIMAS_VENTAS_URL !== 'undefined' && ULTIMAS_VENTAS_URL) {
        cargarUltimasVentas();
        setInterval(cargarUltimasVentas, 30000);
    } else {
        // Ocultar el widget si no hay URL
        const widget = document.querySelector('.card.shadow-sm.mt-3');
        if (widget) widget.style.display = 'none';
    }
    
    // Botón limpiar todo
    document.getElementById('btnLimpiarTodo')?.addEventListener('click', function() {
        if (confirm('¿Limpiar todos los productos?')) {
            if (typeof limpiarVentaCompleta === 'function') {
                limpiarVentaCompleta();
            } else if (typeof limpiarVenta === 'function') {
                limpiarVenta();
            }
        }
    });
    
    // Limpiar búsqueda
    document.getElementById('btnLimpiarBusqueda')?.addEventListener('click', function() {
        document.getElementById('inputBuscarProducto').value = '';
        document.getElementById('listaProductos').innerHTML = '';
    });
});