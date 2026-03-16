/***************************************
 * VARIABLES GLOBALES
 ***************************************/
let usarMayoreo = false;


/***************************************
 * APLICAR PRECIO MAYOREO
 ***************************************/
function aplicarPrecioMayoreo(activar) {

    $('#tabla-productos tbody tr').each(function () {

        const fila = $(this);

        const precio = activar
            ? fila.data('precio-mayoreo')
            : fila.data('precio-normal');

        if (precio !== undefined) {
            fila.find('.precio').text(parseFloat(precio).toFixed(2));
            fila.find('.cantidad').data('precio', precio);
        }

    });

    if (typeof actualizarTotales === 'function') {
        actualizarTotales();
    }
}


/***************************************
 * ACTUALIZAR TOTALES
 ***************************************/
function actualizarTotales() {

    let total = 0;

    $('#tabla-productos tbody tr').each(function () {

        const precio = parseFloat($(this).find('.precio').text()) || 0;
        const cantidad = parseInt($(this).find('.cantidad').val()) || 0;

        const totalFila = precio * cantidad;

        $(this).find('.total').text(totalFila.toFixed(2));

        total += totalFila;

    });

    $('#total-general').text(total.toFixed(2));

    return total;

}

// Ejecutar al cargar
actualizarTotales();


/***************************************
 * BUSCAR PRODUCTO EXISTENTE
 ***************************************/
function buscarProductoExistente(no_folio){

    

    let filaEncontrada = null;

    $('#tabla-productos tbody tr').each(function(){

        const folio = $(this)
            .find('td[data-tipo="no_folio"]')
            .text()
            .trim();

        if(folio === no_folio){
            filaEncontrada = $(this);
            return false;
        }

    });

    return filaEncontrada;

}

/***************************************
 * RESALTAR FILA CUANDO SE REPITE PRODUCTO
 ***************************************/
function resaltarFila(fila){

    fila.addClass('table-warning');

    setTimeout(function(){
        fila.removeClass('table-warning');
    }, 600);

}


/***************************************
 * INSERTAR PRODUCTO EN FILA
 ***************************************/
function seleccionarProducto(data, fila) {

    const filaExistente = buscarProductoExistente(data.no_folio);

    // 🔥 Si el producto ya existe
    if (filaExistente) {

        const inputCantidad = filaExistente.find('.cantidad');
        let cantidadActual = parseInt(inputCantidad.val()) || 0;

        inputCantidad.val(cantidadActual + 1);
        inputCantidad.trigger('input');

        resaltarFila(filaExistente);

        // 🔥 limpiar la fila actual donde se escaneó
        fila.find('td[data-tipo="no_folio"]').text('');
        fila.find('td[data-tipo="nombre"]').text('');
        fila.find('.precio').text('');
        fila.find('.total').text('');
        fila.find('.cantidad')
            .val(1)
            .prop('disabled', true)
            .removeData('precio')
            .removeData('stock_fisico');

        setTimeout(function(){
            fila.find('td[data-tipo="no_folio"]').focus();
        },50);

        return;
    }

    // Llenar datos
    fila.find('td[data-tipo="no_folio"]').text(data.no_folio);
    fila.find('td[data-tipo="nombre"]').text(data.nombre);

    fila.data('precio-normal', parseFloat(data.precio));
    fila.data('precio-mayoreo', parseFloat(data.precio_mayoreo) || null);
    fila.data('unidad-medida', data.unidad_medida || '');

    const precioInicial = parseFloat(data.precio);

    fila.find('.precio').text(precioInicial.toFixed(2));

    fila.find('.cantidad')
        .val(1)
        .prop('disabled', false)
        .data('precio', precioInicial)
        .data('stock_fisico', parseInt(data.stock_fisico) || 0);

    fila.find('.total').text(precioInicial.toFixed(2));

    actualizarTotales();

    // 🔥 crear nueva fila
    agregarFila();

    // 🔥 mover foco inmediatamente
    const nuevaFila = $('#tabla-productos tbody tr:last');
    nuevaFila.find('td[data-tipo="no_folio"]').focus();
}

/***************************************
 * AGREGAR NUEVA FILA
 ***************************************/
function agregarFila() {

    const fila = `
        <tr>
            <td contenteditable="true" class="busqueda" data-tipo="no_folio"></td>
            <td contenteditable="true" class="busqueda" data-tipo="nombre"></td>
            <td class="precio"></td>
            <td>
                <input type="number" class="form-control cantidad" min="1" value="1" disabled>
            </td>
            <td class="total"></td>
        </tr>
    `;

    $('#tabla-productos tbody').append(fila);

}


/***************************************
 * FOCO INICIAL
 ***************************************/
$(document).ready(function(){

    setTimeout(function () {
        $('#tabla-productos tbody tr:first td[data-tipo="no_folio"]').focus();
    }, 100);

});

/***************************************
 * DOCUMENT READY (ÚNICO)
 ***************************************/
$(document).ready(function () {

    agregarFila();

    /***************************************
     * ACTUALIZAR TOTALES
     ***************************************/
    $(document).on('input', '.cantidad', function () {
        actualizarTotales();
        $('#monto_pagado').trigger('input');
    });

    /***************************************
     * VALIDAR STOCK
     ***************************************/
    $('#tabla-productos').on('input', '.cantidad', function () {
        const cantidad = parseInt($(this).val()) || 0;
        const stock_fisico = parseInt($(this).data('stock_fisico')) || 0;

        if (cantidad > stock_fisico) {
            Swal.fire({
                title: "Stock insuficiente",
                text: "Solo hay " + stock_fisico + " unidades disponibles.",
                icon: "warning"
            });

            $(this).val(stock_fisico);
        }
    });

    /***************************************
     * VALIDACIÓN DE PAGO Y CAMBIO
     ***************************************/
    $('#monto_pagado').on('input', function () {

        const total = actualizarTotales();
        const pagado = parseFloat($(this).val()) || 0;
        const cambio = pagado - total;

        const $cambioInput = $('#cambio');
        const $btnCobrar = $('#btn-registrar-venta');

        if (pagado === 0) {
            $cambioInput.val('');
            $btnCobrar.prop('disabled', true);
            return;
        }

        if (cambio < 0) {
            $cambioInput
                .val('Pago insuficiente')
                .addClass('is-invalid')
                .removeClass('is-valid');

            $btnCobrar.prop('disabled', true);
        } else {
            $cambioInput
                .val(cambio.toFixed(2))
                .removeClass('is-invalid')
                .addClass('is-valid');

            $btnCobrar.prop('disabled', false);
        }
    });

    /***************************************
 * VALIDAR STOCK GLOBAL POR PRODUCTO
 ***************************************/
function validarStockGlobal() {

    const acumulado = {};

    $('#tabla-productos tbody tr').each(function () {

        const fila = $(this);
        const no_folio = fila.find('td[data-tipo="no_folio"]').text().trim();
        const cantidadInput = fila.find('.cantidad');

        const cantidad = parseInt(cantidadInput.val()) || 0;
        const stock = parseInt(cantidadInput.data('stock_fisico')) || 0;

        // 🔥 ignorar filas vacías o sin producto cargado
        if (!no_folio || !cantidadInput.data('stock_fisico')) return;

        if (!acumulado[no_folio]) {
            acumulado[no_folio] = {
                total: 0,
                stock: stock
            };
        }

        acumulado[no_folio].total += cantidad;

        if (acumulado[no_folio].total > acumulado[no_folio].stock) {

            Swal.fire({
                icon: "warning",
                title: "Stock excedido",
                text: "No hay suficiente inventario para este producto.",
                timer: 1500,
                showConfirmButton: false
            });

            const permitido =
                cantidad - (acumulado[no_folio].total - acumulado[no_folio].stock);

            cantidadInput.val(Math.max(permitido, 0));

            acumulado[no_folio].total = acumulado[no_folio].stock;
        }

    });

}

/***************************************
 * AUTOCOMPLETE DINÁMICO
 ***************************************/
$('#tabla-productos').on('focus', '.busqueda', function () {

    const celda = $(this);
    const tipo = celda.data('tipo');

    if (!celda.data('autocomplete')) {

        celda.autocomplete({
            minLength: 1,
            delay: 300,

            source: function (request, response) {

                $.ajax({
                    url: BUSCAR_PRODUCTO_URL,
                    data: {
                        q: request.term,
                        tipo: tipo
                    },
                    success: function (data) {

                        if (data.length === 0) {

                            const fila = celda.closest('tr');

                            // Limpiar celda
                            celda.text('');

                            // Limpiar datos de la fila
                            fila.find('.precio').text('');
                            fila.find('.total').text('');
                            fila.find('.cantidad')
                                .val(1)
                                .prop('disabled', true)
                                .removeData('precio')
                                .removeData('stock_fisico');

                            fila.removeData('precio-normal');
                            fila.removeData('precio-mayoreo');
                            fila.removeData('unidad-medida');

                            Swal.fire({
                                title: "Producto no encontrado",
                                text: "No existe un producto con ese código o referencia.",
                                icon: "error",
                                timer: 1200,
                                showConfirmButton: false
                            });

                            setTimeout(function () {
                                celda.focus();
                            }, 100);

                            return;
                        }

                        // 🔥 Inserción automática si coincide exacto
                        if (
                            tipo === "no_folio" &&
                            data.length === 1 &&
                            (data[0].no_folio == request.term ||
                             data[0].referencia == request.term)
                        ) {

                            // 🔥 VALIDACIÓN DE STOCK
                          if (parseInt(data[0].stock_fisico) <= 0) {

                                celda.text('');

                                const fila = celda.closest('tr');

                                fila.find('.precio').text('');
                                fila.find('.total').text('');
                                fila.find('.cantidad')
                                    .val(1)
                                    .prop('disabled', true)
                                    .removeData('precio')
                                    .removeData('stock_fisico');

                                Swal.fire({
                                    title: "Sin stock",
                                    text: "Este producto no tiene existencias.",
                                    icon: "warning",
                                    timer: 1200,
                                    showConfirmButton: false
                                });

                                setTimeout(function(){
                                    celda.focus();
                                },100);

                                return;
                            }

                            seleccionarProducto(data[0], celda.closest('tr'));
                            return;
                        }

                        response($.map(data, function (item) {
                            return {
                                label:
                                    item.nombre + ' - ' +
                                    item.descripcion +
                                    ' ($' + parseFloat(item.precio).toFixed(2) + ')' +
                                    ' / Stock: ' + item.stock_fisico,
                                value: item[tipo],
                                item: item
                            };
                        }));
                    }
                });
            },

            select: function (event, ui) {

                const producto = ui.item.item;
                const fila = celda.closest('tr');

                // 🔥 VALIDACIÓN DE STOCK
               if (parseInt(producto.stock_fisico) <= 0) {

                    celda.text('');

                    const fila = celda.closest('tr');

                    fila.find('.precio').text('');
                    fila.find('.total').text('');
                    fila.find('.cantidad')
                        .val(1)
                        .prop('disabled', true)
                        .removeData('precio')
                        .removeData('stock_fisico');

                    Swal.fire({
                        title: "Sin stock",
                        text: "Este producto no tiene existencias.",
                        icon: "warning",
                        timer: 1200,
                        showConfirmButton: false
                    });

                    setTimeout(function(){
                        celda.focus();
                    },100);

                    return false;
                }

                seleccionarProducto(producto, fila);
                return false;
            }
        });

        celda.data('autocomplete', true);
    }
});

/***************************************
 * CONTROL DE CANTIDAD
 ***************************************/
$('#tabla-productos').on('input', '.cantidad', function () {

    validarStockGlobal();
    actualizarTotales();
    $('#monto_pagado').trigger('input');

});


let filaSeleccionada = null;
let borrando = false;


/***************************************
 * DETECTAR CUANDO SE ESTA BORRANDO
 ***************************************/
$('#tabla-productos').on('keydown', 'td[contenteditable="true"]', function(e){

    if(e.key === 'Backspace' || e.key === 'Delete'){
        borrando = true;
    } else {
        borrando = false;
    }

});


/***************************************
 * CONTROL GLOBAL DE TAB
 ***************************************/
$(document).on('keydown', function (e) {

    if (e.key !== 'Tab') return;

    const elementos = $(
        'input:visible, button:visible, select:visible, textarea:visible, ' +
        'td[contenteditable="true"]:visible'
    ).filter(':not([disabled])');

    if (!elementos.length) return;

    const actual = document.activeElement;
    let index = elementos.index(actual);

    if (index === -1) {
        e.preventDefault();
        elementos.first().focus();
        return;
    }

    e.preventDefault();

    let siguiente;

    if (e.shiftKey) {

        siguiente = index - 1;

        if (siguiente < 0) {
            siguiente = elementos.length - 1;
        }

    } else {

        siguiente = index + 1;

        if (siguiente >= elementos.length) {
            siguiente = 0;
        }

    }

    elementos.eq(siguiente).focus();

});


/***************************************
 * NAVEGACIÓN ↑ ↓
 ***************************************/
$(document).on('keydown', function (e) {

    if ($('.ui-autocomplete').is(':visible')) return;

    const filas = $('#tabla-productos tbody tr');

    if (!filas.length) return;


    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {

        e.preventDefault();

        if (!filaSeleccionada) {
            filaSeleccionada = filas.first();
        } else {

            filaSeleccionada.removeClass('table-primary');

            if (e.key === 'ArrowDown' && !filaSeleccionada.is(':last-child')) {
                filaSeleccionada = filaSeleccionada.next();
            }

            if (e.key === 'ArrowUp' && !filaSeleccionada.is(':first-child')) {
                filaSeleccionada = filaSeleccionada.prev();
            }

        }

        resaltarFila(filaSeleccionada);

        filaSeleccionada
            .find('td[contenteditable="true"]')
            .first()
            .focus();

    }


    /***************************************
     * LIMPIAR FILA CON ESC
     ***************************************/
    if (e.key === 'Escape' && filaSeleccionada) {

        e.preventDefault();

        filaSeleccionada.find('[contenteditable="true"]').text('');
        filaSeleccionada.find('.precio, .total').text('');
        filaSeleccionada.find('.cantidad').val(1).prop('disabled', true);

        filaSeleccionada
            .find('td[data-tipo="no_folio"]')
            .focus();

    }


    /***************************************
     * ELIMINAR FILA CON DELETE
     ***************************************/
    if (e.key === 'Delete' && filaSeleccionada) {

        e.preventDefault();

        const esPrimeraFila = filaSeleccionada.is(':first-child');

        if (esPrimeraFila) {

            filaSeleccionada.find('[contenteditable="true"]').text('');
            filaSeleccionada.find('.precio, .total').text('');
            filaSeleccionada.find('.cantidad')
                .val(1)
                .prop('disabled', true)
                .removeData('precio');

        } else {

            const siguiente = filaSeleccionada.next().length
                ? filaSeleccionada.next()
                : filaSeleccionada.prev();

            filaSeleccionada.remove();

            filaSeleccionada = siguiente.length ? siguiente : null;

        }

        resaltarFila(filaSeleccionada);

        if (filaSeleccionada) {

            filaSeleccionada
                .find('td[contenteditable="true"]')
                .first()
                .focus();

        }

        actualizarTotales();

    }

});


/***************************************
 * NAVEGACIÓN ENTRE CELDAS ← →
 ***************************************/
$('#tabla-productos').on('keydown', 'td[contenteditable="true"]', function (e) {

    const td = $(this)[0];
    const tr = $(this).closest('tr');
    const celdaIndex = $(this).index();

    function getCaretPosition(editableDiv) {

        let caretPos = 0, sel, range;

        if (window.getSelection) {

            sel = window.getSelection();

            if (sel.rangeCount) {

                range = sel.getRangeAt(0);

                const preRange = range.cloneRange();

                preRange.selectNodeContents(editableDiv);

                preRange.setEnd(range.endContainer, range.endOffset);

                caretPos = preRange.toString().length;

            }

        }

        return caretPos;

    }


    function getTextLength(editableDiv) {
        return $(editableDiv).text().length;
    }


    if (e.key === 'ArrowRight') {

        const caretPos = getCaretPosition(td);
        const textLen = getTextLength(td);

        if (caretPos === textLen) {

            e.preventDefault();

            const target = tr.children().eq(celdaIndex + 1);

            if (target.length && target.is('[contenteditable="true"]')) {

                target.focus();

                placeCaretAtStart(target[0]);

            }

        }

    }


    else if (e.key === 'ArrowLeft') {

        const caretPos = getCaretPosition(td);

        if (caretPos === 0) {

            e.preventDefault();

            const target = tr.children().eq(celdaIndex - 1);

            if (target.length && target.is('[contenteditable="true"]')) {

                target.focus();

                placeCaretAtEnd(target[0]);

            }

        }

    }

});


/***************************************
 * POSICIONAR CURSOR
 ***************************************/
function placeCaretAtStart(el) {

    el.focus();

    const range = document.createRange();
    const sel = window.getSelection();

    range.selectNodeContents(el);
    range.collapse(true);

    sel.removeAllRanges();
    sel.addRange(range);

}


function placeCaretAtEnd(el) {

    el.focus();

    const range = document.createRange();
    const sel = window.getSelection();

    range.selectNodeContents(el);
    range.collapse(false);

    sel.removeAllRanges();
    sel.addRange(range);

}


/***************************************
 * RESALTAR FILA
 ***************************************/
function resaltarFila(fila) {

    $('#tabla-productos tbody tr').removeClass('table-primary');

    if (fila) {
        fila.addClass('table-primary');
    }

}


let productos_temporales = null;
let password_admin = '';


/***************************************
 * OBTENER PRODUCTOS
 ***************************************/
function obtenerProductos() {

    const productos = [];

    $('#tabla-productos tbody tr').each(function () {

        const fila = $(this);

        const no_folio = fila.find('td[data-tipo="no_folio"]').text().trim();
        const nombre = fila.find('td[data-tipo="nombre"]').text().trim();
        const cantidad = parseInt(fila.find('.cantidad').val()) || 0;

        const precio_unitario = parseFloat(fila.find('.precio').text()) || 0;

        const precio_normal = parseFloat(fila.data('precio-normal')) || precio_unitario;
        const precio_mayoreo = parseFloat(fila.data('precio-mayoreo')) || null;
        const unidad_medida = fila.data('unidad-medida') || '';

        if (no_folio && cantidad > 0) {

            productos.push({
                no_folio,
                nombre,
                cantidad,
                precio_unitario,
                precio_normal,
                precio_mayoreo,
                unidad_medida
            });

        }

    });

    return productos;

}


    /* =========================
       🔥 VALIDACIÓN MAYOREO
       ========================= */
    function validarMinimoMayoreo(productos) {
        if (!usarMayoreo) return true;

        let totalPiezas = 0;
        productos.forEach(p => {
            totalPiezas += p.cantidad;
        });

        // Regla principal: mínimo 6
        if (totalPiezas >= 6) return true;

        // Excepción: permitir por pieza
        if ($('#permitir_pieza').is(':checked')) return true;

        Swal.fire({
            title: "Venta mayorista inválida",
            text: "El mayoreo requiere mínimo 6 piezas.",
            icon: "warning"
        });

        return false;
    }

    /* =========================
       ENVÍO DE VENTA
       ========================= */
    function enviarVenta(productos) {
        const tipo_cliente = $('select[name="tipo_cliente"]').val();

        const data = {
            no_venta: $('input[name="no_venta"]').val(),
            tipo_cliente: tipo_cliente,
            vendedor: $('select[name="vendedor"]').val(),
            vendedor_nombre: $('select[name="vendedor"] option:selected').text(),
            productos: JSON.stringify(productos),
            csrfmiddlewaretoken: $('input[name="csrfmiddlewaretoken"]').val(),
            descuento: $('select[name="descuento"]').val(),
            monto_pagado: $('#monto_pagado').val(),
            forma_pago: $('#forma_pago').val(),
            total: $('#total').text(),
            password_admin: password_admin
        };

        $.ajax({
            url: '',
            method: 'POST',
            data: data,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            success: function (response) {
                if (response.success) {

                    data.sucursal_nombre = response.sucursal_nombre || '';
                    data.sucursal_direccion = response.sucursal_direccion || '';
                    const total = actualizarTotales();
                    const pagado = parseFloat($('#monto_pagado').val()) || 0;
                    const cambio = pagado - total;
                    console.log(data);
                    Swal.fire({
                        title: "¡Venta registrada!",
                        html: `
                            ¿Deseas imprimir el ticket?<br>
                            <strong>Total:</strong> $${total.toFixed(2)}<br>
                            <strong>Pagado:</strong> $${pagado.toFixed(2)}<br>
                            <strong>Cambio:</strong> 
                            <span style="color:red; font-size:18px;">
                                $${cambio.toFixed(2)}
                            </span>
                        `,
                        icon: "success",
                        showCancelButton: true,
                        confirmButtonText: "Imprimir",
                        cancelButtonText: "No"
                    }).then((result) => {
                        if (result.isConfirmed) {
                            data.cambio = parseFloat($('#cambio').val()) || 0;
                            armarYImprimirTicket(data);
                        } else {
                            location.reload();
                        }
                    });

                } else if (response.error) {
                    Swal.fire({
                        title: "Error!",
                        text: response.error,
                        icon: "error"
                    });
                }
            },
            error: function (xhr, status, error) {
                let mensajeError = "Error al registrar la venta.";
                try {
                    const responseJson = JSON.parse(xhr.responseText);
                    if (responseJson.error) {
                        mensajeError = responseJson.error;
                    }
                } catch (e) {
                    mensajeError = error;
                }

                Swal.fire({
                    title: "Error!",
                    text: mensajeError,
                    icon: "error"
                });
            }
        });
    }

    /* =========================
       REGISTRAR VENTA
       ========================= */
    function registrarVenta() {
        const productos = obtenerProductos();

        if (productos.length === 0) {
            Swal.fire({
                title: "Ups!",
                text: "Agrega al menos un producto con cantidad mayor a 0.",
                icon: "error"
            });
            return;
        }

        // 🔥 VALIDACIÓN CLAVE AQUÍ
        if (!validarMinimoMayoreo(productos)) {
            return;
        }

        const tipo_cliente = $('select[name="tipo_cliente"]').val();

        if (tipo_cliente === 'mayorista') {
            productos_temporales = productos;
            $('#modalPassword').modal('show');
        } else {
            enviarVenta(productos);
        }
    }

    /* =========================
       SUBMIT FORM
       ========================= */
    $('form').on('submit', function (e) {
        e.preventDefault();
        registrarVenta();
    });

    /* =========================
       CONFIRMAR PASSWORD ADMIN
       ========================= */
    $('#formPagoConPassword').on('submit', function (e) {
        e.preventDefault();
        const inputPassword = $('#password_admin_input').val().trim();

        if (!inputPassword) {
            Swal.fire({
                title: "Error!",
                text: "Debes ingresar la contraseña del administrador.",
                icon: "error"
            });
            return;
        }

        password_admin = inputPassword;
        $('#modalPassword').modal('hide');
        enviarVenta(productos_temporales);
    });

    /* =========================
       TECLA F10
       ========================= */
    $(document).on('keydown', function (e) {
        if (e.key === 'F10') {
            e.preventDefault();
            registrarVenta();
        }
    });

        document.addEventListener('DOMContentLoaded', function () {
            const modalPasswordElement = document.getElementById('modalPassword');
            if (!modalPasswordElement) return; // ← clave

            const formPrincipal = document.getElementById('formPagoPrincipal');
            const formModal = document.getElementById('formPagoConPassword');

            const modalPassword = new bootstrap.Modal(modalPasswordElement);

            formPrincipal.addEventListener('submit', function (e) {
                e.preventDefault();
                modalPassword.show();
            });
        });

    });
    function armarYImprimirTicket(data) {

    const productos = typeof data.productos === "string"
        ? JSON.parse(data.productos)
        : data.productos;

    const totalCalculado = productos.reduce(
        (acc, p) => acc + (parseFloat(p.precio_unitario) * parseInt(p.cantidad)),
        0
    );

    const fechaHoraPago = data.fecha_pago
        ? new Date(data.fecha_pago).toLocaleString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })
        : new Date().toLocaleString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

    const ticketHtml = `
    <div style="width: 220px; font-family: monospace; font-size: 12px;">

        <div style="text-align:center;">
            <img src="${LOGO_URL}" style="width:160px; margin-bottom:5px;" />
            <div style="font-weight:bold; font-size:14px;">EL OFERTÓN</div>
            <div>${data.sucursal_nombre || ''}</div>
            <div>${data.sucursal_direccion || ''}</div>
        </div>

        <div style="border-top:1px dashed #000; margin:8px 0;"></div>

        <div>
            <div><strong>Folio:</strong> ${data.no_venta}</div>
            <div><strong>Fecha:</strong> ${fechaHoraPago}</div>
            <div><strong>Cliente:</strong> ${data.tipo_cliente}</div>
            <div><strong>Vendedor:</strong> ${data.vendedor_nombre}</div>
        </div>

        <div style="border-top:1px dashed #000; margin:8px 0;"></div>

        <table style="width:100%; font-size:11px;">
            <thead>
                <tr>
                    <th style="text-align:left;">Prod</th>
                    <th style="text-align:center;">Cant</th>
                    <th style="text-align:right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${productos.map(p => {

                    const precioNormal = p.precio_normal
                        ? parseFloat(p.precio_normal)
                        : parseFloat(p.precio_unitario);

                    const precioUnitario = parseFloat(p.precio_unitario);
                    const subtotal = precioUnitario * p.cantidad;
                    const esMayoreoProducto = precioUnitario < precioNormal;

                    return `
                        <tr>
                            <td colspan="3" style="padding-top:4px;">
                                ${p.nombre}
                            </td>
                        </tr>
                        <tr>
                            <td style="font-size:10px;">
                                ${esMayoreoProducto
                                    ? `<span style="text-decoration:line-through;">
                                          $${precioNormal.toFixed(2)}
                                       </span>
                                       $${precioUnitario.toFixed(2)}`
                                    : `$${precioUnitario.toFixed(2)}`
                                }
                            </td>
                            <td style="text-align:center;">
                                x${p.cantidad}
                            </td>
                            <td style="text-align:right;">
                                $${subtotal.toFixed(2)}
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>

        <div style="border-top:1px dashed #000; margin:8px 0;"></div>

        <div style="font-size:12px;">
            <div style="display:flex; justify-content:space-between;">
                <span>Subtotal:</span>
                <span>$${totalCalculado.toFixed(2)}</span>
            </div>

            ${data.descuento > 0 ? `
                <div style="display:flex; justify-content:space-between;">
                    <span>Descuento (${data.descuento}%):</span>
                    <span>-</span>
                </div>
            ` : ''}

            <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:13px; margin-top:4px;">
                <span>TOTAL:</span>
                <span>$${totalCalculado.toFixed(2)}</span>
            </div>

            <div style="margin-top:6px;">
                <div><strong>Pago:</strong> ${data.forma_pago}</div>
                <div><strong>Recibido:</strong> $${parseFloat(data.monto_pagado).toFixed(2)}</div>
                ${data.cambio !== undefined
                    ? `<div><strong>Cambio:</strong> $${parseFloat(data.cambio).toFixed(2)}</div>`
                    : ''
                }
            </div>
        </div>

        <div style="border-top:1px dashed #000; margin:8px 0;"></div>

        <div style="text-align:center; font-size:11px;">
            Gracias por su compra<br>
            Conserve su ticket
        </div>

    </div>
    `;

    const ventana = window.open('', '', 'width=400,height=600');

    ventana.document.write(`
    <html>
        <head>
            <title>Ticket</title>
            <style>
                body {
                    font-family: monospace;
                    font-size: 12px;
                    padding: 10px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th {
                    font-weight: bold;
                }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            ${ticketHtml}
        </body>
    </html>
    `);

    ventana.document.close();

    setTimeout(() => {
        location.reload();
    }, 1500);
}
document.addEventListener('DOMContentLoaded', function () {
    const tipoCliente = document.getElementById("id_tipo_cliente");
    const descuentoContainer = document.getElementById("descuento_container");
    const descuento = document.getElementById("descuento");

    if (!tipoCliente) return; // ← 🔥 CLAVE

    tipoCliente.addEventListener("change", function () {
        if (this.value === "mayorista") {
            descuentoContainer?.classList.remove("d-none");
        } else {
            descuentoContainer?.classList.add("d-none");
            $('#permiso_pieza_container').addClass('d-none');
            $('#permitir_pieza').prop('checked', false);
            usarMayoreo = false;
            if (descuento) descuento.value = "";
        }
    });

    $('#descuento').on('change', function () {
        if ($(this).val() === 'producto') {
            usarMayoreo = true;
            aplicarPrecioMayoreo(true);
        } else {
            usarMayoreo = false;
            aplicarPrecioMayoreo(false);
        }
    });
});

document.addEventListener('DOMContentLoaded', function () {

    // ✅ Tipo de cliente por defecto
    const tipoCliente = document.getElementById('id_tipo_cliente');
    if (tipoCliente) {
        tipoCliente.value = 'publico'; // 👈 ajusta al value real
    }

    // ✅ Vendedor por defecto (primer elemento)
    const vendedor = document.getElementById('id_vendedor');
    if (vendedor && vendedor.options.length > 0) {
        vendedor.selectedIndex = 1;
    }

    // ✅ Asegurar estado limpio
    usarMayoreo = false;
    $('#descuento_container').addClass('d-none');
    $('#permiso_pieza_container').addClass('d-none');
    $('#permitir_pieza').prop('checked', false);

});
