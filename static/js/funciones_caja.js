/***************************************
 * VARIABLES GLOBALES
 ***************************************/
let usarMayoreo = false;


function aplicarPrecioMayoreo(activar) {
    $('#tabla-productos tbody tr').each(function () {
        const fila = $(this);

        const precio = activar
            ? fila.data('precio-mayoreo')
            : fila.data('precio-normal');

        if (precio !== undefined) {
            fila.find('.precio').text(parseFloat(precio).toFixed(2));
            fila.find('.cantidad').data('precio', precio); // 🔥 IMPORTANTE
        }
    });

    if (typeof actualizarTotales === 'function') {
        actualizarTotales();
    }
}


        function actualizarTotales() {
            let total = 0;
            $('#tabla-productos tbody tr').each(function () {
                const precio = parseFloat($(this).find('.precio').text()) || 0;
                const cantidad = parseInt($(this).find('.cantidad').val()) || 0;
                const totalFila = precio * cantidad;
                $(this).find('.total').text(totalFila.toFixed(2));
                total += totalFila;
            });

            // Mostrar total general en el HTML
            $('#total-general').text(total.toFixed(2));
            return total;
        }

        // Puedes llamarla al cargar o al cambiar cantidad
        actualizarTotales();

/***************************************
 * FUNCIÓN PARA INSERTAR PRODUCTO EN FILA
 ***************************************/
function seleccionarProducto(data, fila) {

    // Llenar datos visibles
    fila.find('td[data-tipo="no_folio"]').text(data.no_folio);
    fila.find('td[data-tipo="nombre"]').text(data.nombre);

    // Guardar datos ocultos en la fila (importante para tu función obtenerProductos)
    fila.data('precio-normal', parseFloat(data.precio));
    fila.data('precio-mayoreo', parseFloat(data.precio_mayoreo) || null);
    fila.data('unidad-medida', data.unidad_medida || '');

    const precioInicial = parseFloat(data.precio);

    fila.find('.precio').text(precioInicial.toFixed(2));

    fila.find('.cantidad')
        .val(1)
        .prop('disabled', false)
        .data('precio', precioInicial)
        .data('stock_fisico', data.stock_fisico);

    fila.find('.total').text(precioInicial.toFixed(2));

    actualizarTotales();

    // Enfocar cantidad automáticamente
    const inputCantidad = fila.find('.cantidad');

    if (inputCantidad.length) {
        inputCantidad.focus().select();

        inputCantidad.off('keydown.enterFila')
            .on('keydown.enterFila', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    agregarFila();

                    setTimeout(function () {
                        const nuevaFila = $('#tabla-productos tbody tr').last();
                        nuevaFila.find('td[data-tipo="no_folio"]').focus();
                    }, 50);
                }
            });
    }
}
    /***************************************
 * FUNCIÓN GLOBAL PARA AGREGAR FILA
 ***************************************/
function agregarFila() {
    const fila = `<tr>
        <td contenteditable="true" class="busqueda" data-tipo="no_folio"></td>
        <td contenteditable="true" class="busqueda" data-tipo="nombre"></td>
        <td class="precio"></td>
        <td><input type="number" class="form-control cantidad" min="1" value="1" disabled></td>
        <td class="total"></td>
    </tr>`;
    $('#tabla-productos tbody').append(fila);
}

        
/***************************************
 * DOCUMENT READY (ÚNICO)
 ***************************************/
$(document).ready(function () {

    // Agregar fila inicial
    agregarFila();

    /***************************************
     * ACTUALIZAR TOTALES AL CAMBIAR CANTIDAD
     ***************************************/
    $(document).on('input', '.cantidad', function () {
        actualizarTotales();
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
    
                        // 🚨 Si no encontró nada
                        if (data.length === 0) {
                            Swal.fire({
                                title: "Producto no encontrado",
                                text: "No existe un producto con ese código o referencia.",
                                icon: "error",
                                timer: 1500,
                                showConfirmButton: false
                            });

                            return;
                        }

                        // 🔥 Inserción automática por folio o referencia exacta
                        if (
                            tipo === "no_folio" &&
                            data.length === 1 &&
                            (data[0].no_folio == request.term ||
                            data[0].referencia == request.term)
                        ) {
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

                            // 🔥 Inserción automática por folio exacto o referencia exacta
                            if (
                                tipo === "no_folio" &&
                                data.length === 1 &&
                                (data[0].no_folio == request.term ||
                                 data[0].referencia == request.term)
                            ) {
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

                    const fila = celda.closest('tr');
                    const data = ui.item.item;

                    fila.find('td[data-tipo="no_folio"]').text(data.no_folio);
                    fila.find('td[data-tipo="nombre"]').text(data.nombre);

                    const precioInicial = parseFloat(data.precio);

                    fila.find('.precio').text(precioInicial.toFixed(2));

                    fila.find('.cantidad')
                        .val(1)
                        .prop('disabled', false)
                        .data('precio', precioInicial)
                        .data('stock_fisico', data.stock_fisico);

                    fila.find('.total').text(precioInicial.toFixed(2));

                    actualizarTotales();

                    const inputCantidad = fila.find('.cantidad');
                    if (inputCantidad.length) {
                        inputCantidad.focus().select();

                        inputCantidad.off('keydown.enterFila')
                            .on('keydown.enterFila', function (e2) {
                                if (e2.key === 'Enter') {
                                    e2.preventDefault();
                                    agregarFila();

                                    setTimeout(function () {
                                        const nuevaFila = $('#tabla-productos tbody tr').last();
                                        nuevaFila.find('td[data-tipo="no_folio"]').focus();
                                    }, 50);
                                }
                            });
                    }

                    return false;
                }
            });

            celda.data('autocomplete', true);
        }
    });
        $('#tabla-productos').on('input', '.cantidad', function () {
            actualizarTotales();
            $('#monto_pagado').trigger('input');
        });

        let filaSeleccionada = null;

        // Navegación con flechas arriba y abajo
        $(document).on('keydown', function (e) {
            // Si un menú de autocomplete está visible, no hacer nada
            if ($('.ui-autocomplete').is(':visible')) {
                return;
            }
            const filas = $('#tabla-productos tbody tr');
            if (filas.length === 0) return;

            // Selección de fila con ↑ ↓
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!filaSeleccionada) {
                    filaSeleccionada = filas.first();
                } else {
                    filaSeleccionada.removeClass('table-primary');
                    if (e.key === 'ArrowDown' && !filaSeleccionada.is(':last-child')) {
                        filaSeleccionada = filaSeleccionada.next();
                    } else if (e.key === 'ArrowUp' && !filaSeleccionada.is(':first-child')) {
                        filaSeleccionada = filaSeleccionada.prev();
                    }
                }
                resaltarFila(filaSeleccionada);

                // Enfocar la primera celda editable de la fila
                filaSeleccionada.find('td[contenteditable="true"]').first().focus();
            }

            // Eliminar fila con Delete
            if (e.key === 'Delete' && filaSeleccionada) {
                e.preventDefault();
                const esPrimeraFila = filaSeleccionada.is(':first-child');

                if (esPrimeraFila) {
                    filaSeleccionada.find('[contenteditable="true"]').text('');
                    filaSeleccionada.find('.precio, .total').text('');
                    filaSeleccionada.find('.cantidad').val(1).prop('disabled', true).removeData('precio');
                } else {
                    const siguiente = filaSeleccionada.next().length ? filaSeleccionada.next() : filaSeleccionada.prev();
                    filaSeleccionada.remove();
                    filaSeleccionada = siguiente.length ? siguiente : null;
                }

                resaltarFila(filaSeleccionada);
                if (filaSeleccionada) {
                    filaSeleccionada.find('td[contenteditable="true"]').first().focus();
                }
                actualizarTotales();
            }
        });

        $('#tabla-productos').on('keydown', 'td[contenteditable="true"]', function (e) {
            const td = $(this)[0]; // elemento DOM
            const tr = $(this).closest('tr');
            const celdaIndex = $(this).index();

            // Función para obtener posición del cursor dentro del contenteditable
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

            // Función para obtener longitud del texto dentro del contenteditable
            function getTextLength(editableDiv) {
                return $(editableDiv).text().length;
            }

            if (e.key === 'ArrowRight') {
                const caretPos = getCaretPosition(td);
                const textLen = getTextLength(td);
                const inputCantidad = tr.find('.cantidad');

                if (caretPos === textLen) {
                    // Cursor al final, moverse a la siguiente celda
                    e.preventDefault();
                    const target = tr.children().eq(celdaIndex + 1);
                    if (target.length && target.is('[contenteditable="true"]')) {
                        target.focus();
                        // Poner cursor al inicio en la nueva celda
                        placeCaretAtStart(target[0]);
                    }
                }
                // else: dejar que la flecha derecha mueva el cursor normalmente
            } else if (e.key === 'ArrowLeft') {
                const caretPos = getCaretPosition(td);
                if (caretPos === 0) {
                    // Cursor al inicio, moverse a la celda anterior
                    e.preventDefault();
                    const target = tr.children().eq(celdaIndex - 1);
                    if (target.length && target.is('[contenteditable="true"]')) {
                        target.focus();
                        // Poner cursor al final en la nueva celda
                        placeCaretAtEnd(target[0]);
                    }
                }
                // else: dejar que la flecha izquierda mueva el cursor normalmente
            }
        });

        // Funciones para posicionar cursor en contenteditable
        function placeCaretAtStart(el) {
            el.focus();
            if (typeof window.getSelection != "undefined"
                && typeof document.createRange != "undefined") {
                const range = document.createRange();
                range.selectNodeContents(el);
                range.collapse(true);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }

        function placeCaretAtEnd(el) {
            el.focus();
            if (typeof window.getSelection != "undefined"
                && typeof document.createRange != "undefined") {
                const range = document.createRange();
                range.selectNodeContents(el);
                range.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }


        // Función para resaltar fila
        function resaltarFila(fila) {
            $('#tabla-productos tbody tr').removeClass('table-primary');
            if (fila) {
                fila.addClass('table-primary');
            }
        }
        
    let productos_temporales = null;
    let password_admin = '';

    /* =========================
       FUNCIÓN: obtener productos
       ========================= */
    function obtenerProductos() {
    const productos = [];

    $('#tabla-productos tbody tr').each(function () {
        const fila = $(this);

        const no_folio = fila.find('td[data-tipo="no_folio"]').text().trim();
        const nombre = fila.find('td[data-tipo="nombre"]').text().trim();
        const cantidad = parseInt(fila.find('.cantidad').val()) || 0;

        const precio_unitario = parseFloat(fila.find('.precio').text()) || 0;

        // 🔥 ESTOS SON LOS IMPORTANTES
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

    // 🔥 CALCULAR TOTAL REAL
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
    <div style="width: 200px; font-family: monospace; font-size: 13px;">

        <div style="text-align:center; margin:0; padding:0; line-height:0;">
            <img src="${LOGO_URL}"
            style="width:180px; display:block; margin:0 auto; padding:0;" />
        </div>

        <h3 style="text-align:center; margin: 0;">El Ofertón</h3>
        <p style="text-align:center; margin: 0;">
        <strong>${data.sucursal_nombre || ''}</strong>
        </p>
        <p style="text-align:center; margin: 0;">
            ${data.sucursal_direccion || ''}
        </p>


        <hr>

        <p><strong>Folio:</strong> ${data.no_venta}</p>
        <p><strong>Cliente:</strong> ${data.tipo_cliente}</p>
        <p><strong>Vendedor:</strong> ${data.vendedor_nombre}</p>
        <p><strong>Fecha y hora:</strong> ${fechaHoraPago}</p>
        <hr>

        <table style="width: 100%; font-size: 12px;">
            <thead>
                <tr>
                    <th style="text-align:left;">Producto</th>
                    <th style="text-align:center;">Cant</th>
                    <th style="text-align:center;">Precio/uni</th>
                    <th style="text-align:right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${productos.map(p => {

                    // 🔥 NORMALIZACIÓN CLAVE (ESTO ARREGLA TODO)
                    const precioNormal = p.precio_normal
                        ? parseFloat(p.precio_normal)
                        : parseFloat(p.precio_unitario);

                    const precioUnitario = parseFloat(p.precio_unitario);

                    const esMayoreoProducto = precioUnitario < precioNormal;

                    return `
                        <tr>
                            <td>${p.nombre.substring(0, 15)}</td>
                            <td style="text-align:center;">${p.cantidad}</td>
                            <td style="text-align:center;">
                                ${
                                    esMayoreoProducto
                                    ? `<span style="text-decoration: line-through; font-size:11px;">
                                            $${precioNormal.toFixed(2)}
                                       </span><br>
                                       <strong>$${precioUnitario.toFixed(2)}</strong>`
                                    : `$${precioUnitario.toFixed(2)}`
                                }
                            </td>
                            <td style="text-align:right;">
                                $${(precioUnitario * p.cantidad).toFixed(2)}
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>

        <hr>

        <p><strong>Total:</strong> $${totalCalculado.toFixed(2)}</p>

        ${data.descuento > 0 ? `<p><strong>Descuento:</strong> ${data.descuento}%</p>` : ''}
        <p><strong>Forma de pago:</strong> ${data.forma_pago}</p>
        <p><strong>Monto pagado:</strong> $${parseFloat(data.monto_pagado).toFixed(2)}</p>
        ${data.cambio !== undefined ? `<p><strong>Cambio:</strong> $${parseFloat(data.cambio).toFixed(2)}</p>` : ''}
        <p style="text-align:center;">¡Gracias por su compra!</p>
    </div>
    `;

    const ventana = window.open('', '', 'width=400,height=600');
    ventana.document.write(`
    <html>
        <head>
            <title>Ticket</title>
            <style>
                body { font-family: monospace; font-size: 13px; padding: 5px; }
                hr { border-top: 1px dashed #000; }
                table { border-collapse: collapse; width: 100%; }
                th, td { padding: 2px 0; }
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
    }, 2000);
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
