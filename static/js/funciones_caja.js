/***************************************
 * VARIABLES GLOBALES
 ***************************************/
let usarMayoreo = false;
let filaSeleccionada = null;
let productos_temporales = null;
let password_admin = '';
let borrando = false;

/***************************************
 * APLICAR PRECIO MAYOREO (VERIFICADA)
 ***************************************/
function aplicarPrecioMayoreo(activar) {
    console.log("Aplicar mayoreo:", activar);
    
    $('#tabla-productos tbody tr').each(function () {
        const fila = $(this);
        
        // Saltar fila vacía
        if (fila.attr('id') === 'fila-vacia') return;
        
        const precioNormal = fila.data('precio-normal');
        const precioMayoreo = fila.data('precio-mayoreo');
        
        console.log("Fila - normal:", precioNormal, "mayoreo:", precioMayoreo);
        
        let precio;
        if (activar && precioMayoreo) {
            precio = precioMayoreo;
        } else if (precioNormal) {
            precio = precioNormal;
        } else {
            return; // No hay precio, salir
        }

        fila.find('.precio').text(parseFloat(precio).toFixed(2));
        fila.find('.cantidad').data('precio', precio);
    });

    if (typeof actualizarTotales === 'function') {
        actualizarTotales();
    }
}

/***************************************
 * VALIDAR STOCK GLOBAL POR PRODUCTO
 ***************************************/
function validarStockGlobal() {
    const acumulado = {};

    $('#tabla-productos tbody tr').each(function () {
        const fila = $(this);
        
        // Saltar fila vacía si existe
        if (fila.attr('id') === 'fila-vacia') return;
        
        const inputFolio = fila.find('input[data-tipo="no_folio"]');
        const cantidadInput = fila.find('.cantidad');
        
        if (!inputFolio.length || !cantidadInput.length) return;
        
        const no_folio = inputFolio.val()?.trim().toUpperCase();
        const stockData = cantidadInput.data('stock_fisico');

        if (!no_folio || stockData === undefined) return;

        const cantidad = parseInt(cantidadInput.val()) || 0;
        const stock = parseInt(stockData);

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

            const permitido = cantidad - (acumulado[no_folio].total - acumulado[no_folio].stock);
            cantidadInput.val(Math.max(permitido, 0));
            acumulado[no_folio].total = acumulado[no_folio].stock;
        }
    });
}

/***************************************
 * ACTUALIZAR TOTALES
 ***************************************/
function actualizarTotales() {
    let total = 0;
    let subtotal = 0;

    $('#tabla-productos tbody tr').each(function () {
        const fila = $(this);
        
        // Saltar fila vacía
        if (fila.attr('id') === 'fila-vacia') return;
        
        const precio = parseFloat(fila.find('.precio').text()) || 0;
        const cantidad = parseInt(fila.find('.cantidad').val()) || 0;

        const totalFila = precio * cantidad;
        fila.find('.total').text(totalFila.toFixed(2));
        
        subtotal += totalFila;
        total += totalFila;
    });

    // Actualizar subtotal en el footer
    $('#subtotal').text(subtotal.toFixed(2));
    
    // Aplicar descuento global si existe
    const descuentoGlobal = $('#descuento').val();
    if (descuentoGlobal && descuentoGlobal !== 'producto' && descuentoGlobal !== '') {
        const descuentoMonto = subtotal * (parseFloat(descuentoGlobal) / 100);
        total = subtotal - descuentoMonto;
        $('#descuento-row').removeClass('d-none');
        $('#descuento-monto').text(descuentoMonto.toFixed(2));
    } else {
        $('#descuento-row').addClass('d-none');
    }

    $('#total-general').text(total.toFixed(2));
    
    // Actualizar contador de productos
    actualizarContadorProductos();
    
    return total;
}

/***************************************
 * ACTUALIZAR CONTADOR DE PRODUCTOS
 ***************************************/
function actualizarContadorProductos() {
    const numProductos = $('#tabla-productos tbody tr.fila-producto').filter(function() {
        return $(this).find('input[data-tipo="no_folio"]').val().trim() !== '';
    }).length;
    
    $('#contador-productos').text(numProductos);
}

/***************************************
 * BUSCAR PRODUCTO EXISTENTE
 ***************************************/
function buscarProductoExistente(no_folio) {
    if (!no_folio) return null;
    
    let filaEncontrada = null;
    const no_folio_normalizado = no_folio.trim().toUpperCase();

    $('#tabla-productos tbody tr').each(function() {
        const fila = $(this);
        
        // Saltar fila vacía
        if (fila.attr('id') === 'fila-vacia') return;
        
        const input = fila.find('input[data-tipo="no_folio"]');
        if (input.length) {
            const folio = input.val()?.trim().toUpperCase();
            if (folio === no_folio_normalizado) {
                filaEncontrada = fila;
                return false;
            }
        }
    });

    return filaEncontrada;
}

/***************************************
 * RESALTAR FILA
 ***************************************/
function resaltarFila(fila) {
    if (!fila || !fila.length) return;
    
    fila.addClass('table-warning');
    setTimeout(function() {
        fila.removeClass('table-warning');
    }, 600);
}

/***************************************
 * LIMPIAR FILA
 ***************************************/
function limpiarFila(fila) {
    if (!fila || !fila.length) return;
    
    fila.find('input[data-tipo="no_folio"]').val('');
    fila.find('input[data-tipo="nombre"]').val('');
    fila.find('.precio, .total').text('');
    fila.find('.cantidad')
        .val(1)
        .prop('disabled', true)
        .removeData('precio')
        .removeData('stock_fisico');
}

/***************************************
 * ELIMINAR FILA
 ***************************************/
function eliminarFila(fila) {
    if (!fila || !fila.length) return;
    
    const filasRestantes = $('#tabla-productos tbody tr.fila-producto').length;

    if (filasRestantes === 1) {
        limpiarFila(fila);
    } else {
        const siguiente = fila.next().length ? fila.next() : fila.prev();
        fila.remove();
        filaSeleccionada = siguiente.length ? siguiente : null;
    }

    // Mostrar fila vacía si no hay productos
    if ($('#tabla-productos tbody tr.fila-producto').length === 0) {
        $('#fila-vacia').show();
    } else {
        $('#fila-vacia').hide();
    }

    actualizarTotales();
}

/***************************************
 * LIMPIAR VENTA COMPLETA
 ***************************************/
function limpiarVentaCompleta() {
    $('#tabla-productos tbody').empty();
    $('#fila-vacia').show();
    agregarFila();
    
    $('#total-general').text('0.00');
    $('#subtotal').text('0.00');
    $('#contador-productos').text('0');
    $('#monto_pagado').val('');
    $('#cambio').val('0.00');
    $('#descuento-row').addClass('d-none');
    
    setTimeout(() => {
        $('#tabla-productos tbody tr:first input[data-tipo="no_folio"]').focus();
    }, 50);
}

/***************************************
 * INSERTAR PRODUCTO EN FILA (CORREGIDA)
 ***************************************/
function seleccionarProducto(data, fila) {
    if (!fila || !fila.length) return;

    console.log("Datos del producto:", {
        nombre: data.nombre,
        precio_normal: data.precio,
        precio_mayoreo: data.precio_mayoreo,
        usarMayoreo: usarMayoreo
    });

    const filaExistente = buscarProductoExistente(data.no_folio);

    // Si el producto ya existe
    if (filaExistente && filaExistente.length && filaExistente[0] !== fila[0]) {
        const inputCantidad = filaExistente.find('.cantidad');
        
        if (inputCantidad.length) {
            let cantidadActual = parseInt(inputCantidad.val()) || 0;
            let nuevaCantidad = Math.max(1, cantidadActual + 1);
            
            inputCantidad.val(nuevaCantidad);
            
            validarStockGlobal();
            actualizarTotales();
            $('#monto_pagado').trigger('input');
            
            resaltarFila(filaExistente);
            
            setTimeout(() => {
                limpiarFila(fila);
            }, 10);
        }
        return;
    }

    // Llenar datos - CORREGIDO: Guardar ambos precios
    fila.find('input[data-tipo="no_folio"]').val(data.no_folio);
    fila.find('input[data-tipo="nombre"]').val(data.nombre);

    // Guardar precios en la fila
    fila.data('precio-normal', parseFloat(data.precio));
    
    // Si viene precio_mayoreo, guardarlo, si no, usar el precio normal
    const precioMayoreo = data.precio_mayoreo ? parseFloat(data.precio_mayoreo) : parseFloat(data.precio);
    fila.data('precio-mayoreo', precioMayoreo);
    
    fila.data('unidad-medida', data.unidad_medida || '');

    // Determinar qué precio mostrar inicialmente
    const precioInicial = (usarMayoreo && precioMayoreo) ? precioMayoreo : parseFloat(data.precio);

    fila.find('.precio').text(precioInicial.toFixed(2));

    fila.find('.cantidad')
        .val(1)
        .prop('disabled', false)
        .data('precio', precioInicial)
        .data('stock_fisico', parseInt(data.stock_fisico) || 0);

    fila.find('.total').text(precioInicial.toFixed(2));

    actualizarTotales();
    validarStockGlobal();

    // Crear nueva fila
    agregarFila();

    // Mover foco inmediatamente
    setTimeout(() => {
        const nuevaFila = $('#tabla-productos tbody tr:last');
        nuevaFila.find('input[data-tipo="no_folio"]').focus();
    }, 50);
}

/***************************************
 * AGREGAR NUEVA FILA
 ***************************************/
function agregarFila() {
    // Ocultar fila vacía
    $('#fila-vacia').hide();
    
    const fila = `
    <tr class="fila-producto">
        <td>
            <input type="text"
                   class="form-control busqueda"
                   data-tipo="no_folio"
                   autocomplete="off"
                   placeholder="Código">
        </td>
        <td>
            <input type="text"
                   class="form-control busqueda"
                   data-tipo="nombre"
                   autocomplete="off"
                   placeholder="Nombre"
                   readonly>
        </td>
        <td class="precio text-end align-middle"></td>
        <td>
            <input type="number"
                   class="form-control cantidad text-center"
                   min="1"
                   value="1"
                   disabled>
        </td>
        <td class="total text-end align-middle"></td>
        <td class="text-center">
            <button type="button" class="btn btn-sm btn-outline-danger btn-eliminar-fila" title="Eliminar">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    </tr>
    `;

    $('#tabla-productos tbody').append(fila);
}

/***************************************
 * OBTENER PRODUCTOS
 ***************************************/
function obtenerProductos() {
    const productos = [];

    $('#tabla-productos tbody tr').each(function () {
        const fila = $(this);
        
        // Saltar fila vacía
        if (fila.attr('id') === 'fila-vacia') return;
        
        const inputFolio = fila.find('input[data-tipo="no_folio"]');
        const inputNombre = fila.find('input[data-tipo="nombre"]');
        const cantidadInput = fila.find('.cantidad');
        const precioSpan = fila.find('.precio');
        
        if (!inputFolio.length || !inputNombre.length || !cantidadInput.length || !precioSpan.length) {
            return;
        }
        
        const no_folio = inputFolio.val()?.trim();
        const nombre = inputNombre.val()?.trim();
        const cantidad = parseInt(cantidadInput.val()) || 0;
        const precio_unitario = parseFloat(precioSpan.text()) || 0;
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

/***************************************
 * VALIDACIÓN MAYOREO
 ***************************************/
function validarMinimoMayoreo(productos) {
    if (!usarMayoreo) return true;

    let totalPiezas = 0;
    productos.forEach(p => {
        totalPiezas += p.cantidad;
    });

    if (totalPiezas >= 6) return true;
    if ($('#permitir_pieza').is(':checked')) return true;

    Swal.fire({
        title: "Venta mayorista inválida",
        text: "El mayoreo requiere mínimo 6 piezas.",
        icon: "warning"
    });

    return false;
}

/***************************************
 * ENVÍO DE VENTA
 ***************************************/
function enviarVenta(productos) {
    const tipo_cliente = $('select[name="tipo_cliente"]').val();

    const data = {
        no_venta: $('input[name="no_venta"]').val(),
        tipo_cliente: tipo_cliente,
        vendedor: $('select[name="vendedor"]').val(),
        vendedor_nombre: $('select[name="vendedor"] option:selected').text(),
        productos: JSON.stringify(productos),
        csrfmiddlewaretoken: $('input[name="csrfmiddlewaretoken"]').val(),
        descuento: $('#descuento').val(),
        monto_pagado: $('#monto_pagado').val(),
        forma_pago: $('#forma_pago').val(),
        total: $('#total-general').text(),
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
                
                const total = parseFloat($('#total-general').text());
                const pagado = parseFloat($('#monto_pagado').val()) || 0;
                const cambio = pagado - total;
                
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
        error: function (xhr) {
            let mensajeError = "Error al registrar la venta.";
            try {
                const responseJson = JSON.parse(xhr.responseText);
                if (responseJson.error) {
                    mensajeError = responseJson.error;
                }
            } catch (e) {
                mensajeError = xhr.statusText || mensajeError;
            }
            Swal.fire({
                title: "Error!",
                text: mensajeError,
                icon: "error"
            });
        }
    });
}

/***************************************
 * REGISTRAR VENTA
 ***************************************/
function registrarVenta() {
    const productos = obtenerProductos();

    if (productos.length === 0) {
        Swal.fire({
            title: "Ups!",
            text: "Agrega al menos un producto con cantidad mayor a 0.",
            icon: "error",
            timer: 2000,
            showConfirmButton: false
        });
        return;
    }

    if (!validarMinimoMayoreo(productos)) {
        return;
    }

    const tipo_cliente = $('select[name="tipo_cliente"]').val();

    if (tipo_cliente === 'mayorista') {
        productos_temporales = productos;
        if ($('.ui-autocomplete').is(':visible')) {
            $('.busqueda').autocomplete('close');
        }
        document.activeElement?.blur();
        $('#modalPassword').modal('show');
        setTimeout(() => $('#password_admin_input').focus(), 300);
    } else {
        enviarVenta(productos);
    }
}

/***************************************
 * IMPRIMIR TICKET
 ***************************************/
function armarYImprimirTicket(data) {
    const productos = typeof data.productos === "string"
        ? JSON.parse(data.productos)
        : data.productos;

    const totalCalculado = productos.reduce(
        (acc, p) => acc + (parseFloat(p.precio_unitario) * parseInt(p.cantidad)),
        0
    );

    const fechaHoraPago = new Date().toLocaleString('es-MX', {
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
            ${data.descuento && data.descuento > 0 ? `
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

/***************************************
 * DOCUMENT READY - INICIALIZACIÓN
 ***************************************/
$(document).ready(function () {
    // Inicializar primera fila
    agregarFila();
    
    setTimeout(function () {
        $('#tabla-productos tbody tr:first input[data-tipo="no_folio"]').focus();
    }, 50);

    // Validar stock al cambiar cantidad
    $('#tabla-productos').on('input', '.cantidad', function () {
        const cantidad = parseInt($(this).val()) || 0;
        const stock_fisico = parseInt($(this).data('stock_fisico')) || 0;

        if (cantidad > stock_fisico) {
            Swal.fire({
                title: "Stock insuficiente",
                text: "Solo hay " + stock_fisico + " unidades disponibles.",
                icon: "warning",
                timer: 1500,
                showConfirmButton: false
            });
            $(this).val(stock_fisico);
        }
        
        validarStockGlobal();
        actualizarTotales();
        $('#monto_pagado').trigger('input');
    });

    // Seleccionar fila al hacer click
    $('#tabla-productos').on('click', 'tr', function () {
        if ($(this).attr('id') === 'fila-vacia') return;
        
        filaSeleccionada = $(this);
        $('#tabla-productos tbody tr').removeClass('table-primary');
        filaSeleccionada.addClass('table-primary');
    });

    // Seleccionar fila al enfocar input
    $('#tabla-productos').on('focus', 'input', function () {
        const fila = $(this).closest('tr');
        if (fila.attr('id') === 'fila-vacia') return;
        
        filaSeleccionada = fila;
        $('#tabla-productos tbody tr').removeClass('table-primary');
        filaSeleccionada.addClass('table-primary');
    });

    // Botón eliminar fila
    $('#tabla-productos').on('click', '.btn-eliminar-fila', function () {
        const fila = $(this).closest('tr');
        eliminarFila(fila);
    });

    // Enter en campo código
    $('#tabla-productos').on('keypress', 'input[data-tipo="no_folio"]', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();

            const input = $(this);
            const codigo = input.val().trim();
            const fila = input.closest('tr');

            if (!codigo) return;

            $.ajax({
                url: BUSCAR_PRODUCTO_URL,
                data: { q: codigo, tipo: 'no_folio' },
                success: function (data) {
                    if (!data || !data.length) {
                        Swal.fire({
                            title: "No encontrado",
                            text: "Producto no existe",
                            icon: "error",
                            timer: 1000,
                            showConfirmButton: false
                        });
                        input.select();
                        return;
                    }

                    const producto = data[0];

                    if (parseInt(producto.stock_fisico) <= 0) {
                        Swal.fire({
                            title: "Sin stock",
                            icon: "warning",
                            timer: 1000,
                            showConfirmButton: false
                        });
                        input.select();
                        return;
                    }

                    seleccionarProducto(producto, fila);
                }
            });
        }
    });

    // Validación de pago y cambio
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

    // Submit del form
    $('form').on('submit', function (e) {
        e.preventDefault();
        registrarVenta();
    });

    // Confirmar password admin
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

    // Botón buscar producto
    $('#btnBuscarProducto').on('click', function () {
        $('#modalBuscarProducto').modal('show');
        setTimeout(() => $('#inputBuscarProducto').focus(), 200);
    });

    // Botón limpiar todo
    $('#btnLimpiarTodo').on('click', function () {
        if (confirm('¿Limpiar todos los productos?')) {
            limpiarVentaCompleta();
        }
    });

    // Botón venta rápida
    $('#btnVentaRapida').on('click', function () {
        const total = parseFloat($('#total-general').text());
        $('#monto_pagado').val(total.toFixed(2)).trigger('input');
    });

    console.log("✅ Sistema de caja inicializado");
});

/***************************************
 * EVENTOS GLOBALES (fuera de document.ready)
 ***************************************/

// Navegación con teclado
$(document).on('keydown', function (e) {
    if ($('.ui-autocomplete').is(':visible')) return;

    // F2 - Abrir modal de búsqueda
    if (e.key === 'F2') {
        e.preventDefault();
        $('#btnBuscarProducto').click();
        return;
    }

    // F4 - Limpiar todo
    if (e.key === 'F4') {
        e.preventDefault();
        if (confirm('¿Limpiar todos los productos?')) {
            limpiarVentaCompleta();
        }
        return;
    }

    // F5 - Venta rápida
    if (e.key === 'F5') {
        e.preventDefault();
        $('#btnVentaRapida').click();
        return;
    }

    // F10 - Registrar venta
    if (e.key === 'F10') {
        e.preventDefault();
        registrarVenta();
        return;
    }

    const filas = $('#tabla-productos tbody tr.fila-producto');
    if (!filas.length || !filaSeleccionada) return;

    // Flecha Abajo
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        const siguiente = filaSeleccionada.next('.fila-producto');
        if (siguiente.length) {
            filaSeleccionada = siguiente;
            $('#tabla-productos tbody tr').removeClass('table-primary');
            filaSeleccionada.addClass('table-primary');
            filaSeleccionada.find('input[data-tipo="no_folio"]').focus();
        }
    }

    // Flecha Arriba
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        const anterior = filaSeleccionada.prev('.fila-producto');
        if (anterior.length) {
            filaSeleccionada = anterior;
            $('#tabla-productos tbody tr').removeClass('table-primary');
            filaSeleccionada.addClass('table-primary');
            filaSeleccionada.find('input[data-tipo="no_folio"]').focus();
        }
    }

    // Delete - Eliminar fila
    if (e.key === 'Delete' && filaSeleccionada) {
        e.preventDefault();
        eliminarFila(filaSeleccionada);
    }
});

/***************************************
 * EVENTOS PARA MODAL DE BÚSQUEDA
 ***************************************/

// Búsqueda en modal
$('#inputBuscarProducto').on('input', function () {
    const texto = $(this).val().trim();

    if (texto.length < 2) {
        $('#listaProductos').empty();
        return;
    }

    $.ajax({
        url: BUSCAR_PRODUCTO_URL,
        data: { q: texto, tipo: 'nombre' },
        success: function (data) {
            let html = '';
            data.forEach(p => {
                html += `
                <button class="list-group-item list-group-item-action item-producto"
                    data-producto='${JSON.stringify(p)}'>
                    <div><strong>${p.nombre}</strong></div>
                    <small>
                        ${p.descripcion || ''} |
                        $${parseFloat(p.precio).toFixed(2)} |
                        Stock: ${p.stock_fisico}
                    </small>
                </button>
                `;
            });
            $('#listaProductos').html(html || '<div class="text-muted p-2">Sin resultados</div>');
        }
    });
});

// Click en producto del modal
$(document).on('click', '.item-producto', function () {
    const producto = $(this).data('producto');
    const fila = $('#tabla-productos tbody tr:last');
    
    seleccionarProducto(producto, fila);
    $('#modalBuscarProducto').modal('hide');
    
    setTimeout(() => {
        const nuevaFila = $('#tabla-productos tbody tr:last');
        nuevaFila.find('input[data-tipo="no_folio"]').focus();
    }, 300);
});

// Enter en búsqueda modal
$('#inputBuscarProducto').on('keydown', function (e) {
    if (e.key === 'Enter') {
        const primer = $('#listaProductos .item-producto').first();
        if (primer.length) {
            primer.click();
        }
    }
});

// Limpiar búsqueda
$('#btnLimpiarBusqueda').on('click', function () {
    $('#inputBuscarProducto').val('');
    $('#listaProductos').empty();
});

/***************************************
 * CONFIGURACIÓN INICIAL
 ***************************************/

// Configuración de tipo de cliente
document.addEventListener('DOMContentLoaded', function () {
    const tipoCliente = document.getElementById("id_tipo_cliente");
    const descuentoContainer = document.getElementById("descuento_container");
    const descuento = document.getElementById("descuento");
    const permisoPiezaContainer = document.getElementById("permiso_pieza_container");

    if (!tipoCliente) return;

    // Establecer valores por defecto
    tipoCliente.value = 'publico';
    
    const vendedor = document.getElementById('id_vendedor');
    if (vendedor && vendedor.options.length > 0) {
        vendedor.selectedIndex = 1;
    }

    // Evento change en tipo de cliente
    tipoCliente.addEventListener("change", function () {
        console.log("Tipo cliente cambiado a:", this.value);
        
        if (this.value === "mayorista") {
            descuentoContainer?.classList.remove("d-none");
            permisoPiezaContainer?.classList.remove("d-none");
        } else {
            descuentoContainer?.classList.add("d-none");
            permisoPiezaContainer?.classList.add("d-none");
            $('#permitir_pieza').prop('checked', false);
            usarMayoreo = false;
            if (descuento) descuento.value = "";
            aplicarPrecioMayoreo(false);
        }
    });

    // Evento change en descuento
    $('#descuento').on('change', function () {
        console.log("Descuento cambiado a:", $(this).val());
        
        if ($(this).val() === 'producto') {
            usarMayoreo = true;
            console.log("Activando mayoreo");
            aplicarPrecioMayoreo(true);
        } else {
            usarMayoreo = false;
            console.log("Desactivando mayoreo");
            aplicarPrecioMayoreo(false);
        }
        actualizarTotales();
    });

    // Estado inicial
    usarMayoreo = false;
    $('#descuento_container').addClass('d-none');
    $('#permiso_pieza_container').addClass('d-none');
    $('#permitir_pieza').prop('checked', false);
});