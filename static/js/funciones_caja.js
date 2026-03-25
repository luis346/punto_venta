/***************************************
 * VARIABLES GLOBALES
 ***************************************/
let usarMayoreo = false;
let filaSeleccionada = null;
let productos_temporales = null;
let password_admin = '';

/***************************************
 * APLICAR PRECIO MAYOREO
 ***************************************/
function aplicarPrecioMayoreo(activar) {
    $('#tabla-productos tbody tr').each(function () {
        const fila = $(this);
        if (fila.attr('id') === 'fila-vacia') return;
        
        const precioNormal = fila.data('precio-normal');
        const precioMayoreo = fila.data('precio-mayoreo');
        
        let precio;
        if (activar && precioMayoreo) {
            precio = precioMayoreo;
        } else if (precioNormal) {
            precio = precioNormal;
        } else {
            return;
        }

        fila.find('.precio').text(parseFloat(precio).toFixed(2));
        fila.find('.cantidad').data('precio', precio);
    });

    if (typeof actualizarTotales === 'function') actualizarTotales();
}

/***************************************
 * VALIDAR STOCK GLOBAL
 ***************************************/
function validarStockGlobal() {
    const acumulado = {};

    $('#tabla-productos tbody tr').each(function () {
        const fila = $(this);
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
            acumulado[no_folio] = { total: 0, stock: stock };
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
        if (fila.attr('id') === 'fila-vacia') return;
        
        const precio = parseFloat(fila.find('.precio').text()) || 0;
        const cantidad = parseInt(fila.find('.cantidad').val()) || 0;

        const totalFila = precio * cantidad;
        fila.find('.total').text(totalFila.toFixed(2));
        
        subtotal += totalFila;
        total += totalFila;
    });

    $('#subtotal').text(subtotal.toFixed(2));
    
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
    setTimeout(() => fila.removeClass('table-warning'), 600);
}

/***************************************
 * LIMPIAR FILA
 ***************************************/
function limpiarFila(fila) {
    if (!fila || !fila.length) return;
    
    fila.find('input[data-tipo="no_folio"]').val('');
    fila.find('input[data-tipo="nombre"]').val('');
    fila.find('.precio, .total').text('');
    fila.find('.cantidad').val(1).prop('disabled', true).removeData('precio').removeData('stock_fisico');
    
    const btnActualizar = fila.find('.btn-actualizar-producto');
    if (btnActualizar.length) {
        btnActualizar.prop('disabled', true).attr('data-producto-id', '').attr('data-producto-nombre', '').attr('data-precio', '0').attr('data-precio-mayoreo', '0');
    }
    
    fila.removeData('precio-normal').removeData('precio-mayoreo').removeAttr('data-producto-id');
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
    
    $('#total-general, #subtotal').text('0.00');
    $('#contador-productos').text('0');
    $('#monto_pagado, #cambio').val('');
    $('#descuento-row').addClass('d-none');
    
    setTimeout(() => $('#tabla-productos tbody tr:first input[data-tipo="no_folio"]').focus(), 50);
}

/***************************************
 * INSERTAR PRODUCTO EN FILA
 ***************************************/
function seleccionarProducto(data, fila) {
    if (!fila || !fila.length) return;

    const filaExistente = buscarProductoExistente(data.no_folio);

    // Si el producto ya existe en otra fila
    if (filaExistente && filaExistente.length && filaExistente[0] !== fila[0]) {
        const inputCantidad = filaExistente.find('.cantidad');
        if (inputCantidad.length) {
            let nuevaCantidad = (parseInt(inputCantidad.val()) || 0) + 1;
            inputCantidad.val(nuevaCantidad);
            
            validarStockGlobal();
            actualizarTotales();
            $('#monto_pagado').trigger('input');
            resaltarFila(filaExistente);
            setTimeout(() => limpiarFila(fila), 10);
        }
        return;
    }

    // Llenar datos
    fila.find('input[data-tipo="no_folio"]').val(data.no_folio);
    fila.find('input[data-tipo="nombre"]').val(data.nombre);
    fila.attr('data-producto-id', data.id);
    fila.data('precio-normal', parseFloat(data.precio));
    
    const precioMayoreo = data.precio_mayoreo ? parseFloat(data.precio_mayoreo) : parseFloat(data.precio);
    fila.data('precio-mayoreo', precioMayoreo);
    fila.data('unidad-medida', data.unidad_medida || '');

    const precioInicial = (usarMayoreo && precioMayoreo) ? precioMayoreo : parseFloat(data.precio);
    fila.find('.precio').text(precioInicial.toFixed(2));

    fila.find('.cantidad')
        .val(1)
        .prop('disabled', false)
        .data('precio', precioInicial)
        .data('stock_fisico', parseInt(data.stock_fisico) || 0);
    fila.find('.total').text(precioInicial.toFixed(2));
    
    // Habilitar botón de actualizar
    const btnActualizar = fila.find('.btn-actualizar-producto');
    if (btnActualizar.length) {
        btnActualizar.prop('disabled', false)
            .attr('data-producto-id', data.id)
            .attr('data-producto-nombre', data.nombre)
            .attr('data-precio', data.precio)
            .attr('data-precio-mayoreo', data.precio_mayoreo || 0);
    }

    actualizarTotales();
    validarStockGlobal();

    // Crear nueva fila para siguiente producto
    agregarFila();
    setTimeout(() => {
        $('#tabla-productos tbody tr:last input[data-tipo="no_folio"]').focus();
    }, 50);
}

/***************************************
 * AGREGAR NUEVA FILA
 ***************************************/
function agregarFila() {
    $('#fila-vacia').hide();
    
    const puedeVerBoton = window.USER_ROL === 'ADMIN' || window.USER_ROL === 'CAJA' || window.USER_IS_SUPERUSER === true;
    
    const botonActualizar = puedeVerBoton ? `
        <button type="button" class="btn btn-sm btn-info btn-actualizar-producto" style="margin-right: 5px;" disabled>
            <i class="bi bi-pencil-square"></i>
        </button>
    ` : '';
    
    const fila = `
    <tr class="fila-producto">
        <td style="width: 120px;">
            <input type="text" class="form-control busqueda" data-tipo="no_folio" autocomplete="off" placeholder="Código">
        </td>
        <td>
            <input type="text" class="form-control busqueda" data-tipo="nombre" autocomplete="off" placeholder="Nombre" readonly>
        </td>
        <td class="precio text-end align-middle">0.00</td>
        <td style="width: 100px;">
            <input type="number" class="form-control cantidad text-center" min="1" value="1" disabled>
        </td>
        <td class="total text-end align-middle">0.00</td>
        <td class="text-center" style="width: 90px;">
            <div class="btn-group btn-group-sm">
                ${botonActualizar}
                <button type="button" class="btn btn-sm btn-outline-danger btn-eliminar-fila" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </td>
    </tr>`;

    $('#tabla-productos tbody').append(fila);
}

/***************************************
 * OBTENER PRODUCTOS
 ***************************************/
function obtenerProductos() {
    const productos = [];

    $('#tabla-productos tbody tr').each(function () {
        const fila = $(this);
        if (fila.attr('id') === 'fila-vacia') return;
        
        const inputFolio = fila.find('input[data-tipo="no_folio"]');
        const inputNombre = fila.find('input[data-tipo="nombre"]');
        const cantidadInput = fila.find('.cantidad');
        const precioSpan = fila.find('.precio');
        
        if (!inputFolio.length || !inputNombre.length || !cantidadInput.length || !precioSpan.length) return;
        
        const no_folio = inputFolio.val()?.trim();
        const cantidad = parseInt(cantidadInput.val()) || 0;

        if (no_folio && cantidad > 0) {
            productos.push({
                no_folio: no_folio,
                nombre: inputNombre.val()?.trim(),
                cantidad: cantidad,
                precio_unitario: parseFloat(precioSpan.text()) || 0,
                precio_normal: parseFloat(fila.data('precio-normal')) || 0,
                precio_mayoreo: parseFloat(fila.data('precio-mayoreo')) || null,
                unidad_medida: fila.data('unidad-medida') || ''
            });
        }
    });

    return productos;
}

/***************************************
 * ENVÍO DE VENTA
 ***************************************/
function enviarVenta(productos) {
    const data = {
        no_venta: $('input[name="no_venta"]').val(),
        tipo_cliente: $('select[name="tipo_cliente"]').val(),
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
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        success: function (response) {
            if (response.success) {
                data.sucursal_nombre = response.sucursal_nombre || '';
                data.sucursal_direccion = response.sucursal_direccion || '';
                
                const total = parseFloat($('#total-general').text());
                const pagado = parseFloat($('#monto_pagado').val()) || 0;
                const cambio = pagado - total;
                
                Swal.fire({
                    title: "¡Venta registrada!",
                    html: `¿Deseas imprimir el ticket?<br><strong>Total:</strong> $${total.toFixed(2)}<br><strong>Cambio:</strong> $${cambio.toFixed(2)}`,
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
                Swal.fire({ title: "Error!", text: response.error, icon: "error" });
            }
        },
        error: function (xhr) {
            let mensajeError = "Error al registrar la venta.";
            try {
                const responseJson = JSON.parse(xhr.responseText);
                if (responseJson.error) mensajeError = responseJson.error;
            } catch (e) {}
            Swal.fire({ title: "Error!", text: mensajeError, icon: "error" });
        }
    });
}

/***************************************
 * REGISTRAR VENTA
 ***************************************/
function registrarVenta() {
    const productos = obtenerProductos();

    if (productos.length === 0) {
        Swal.fire({ title: "Ups!", text: "Agrega al menos un producto.", icon: "error", timer: 2000, showConfirmButton: false });
        return;
    }

    const tipo_cliente = $('select[name="tipo_cliente"]').val();

    if (tipo_cliente === 'mayorista') {
        productos_temporales = productos;
        $('#modalPassword').modal('show');
        setTimeout(() => $('#password_admin_input').focus(), 300);
    } else {
        enviarVenta(productos);
    }
}
/***************************************
 * IMPRIMIR TICKET - VERSIÓN PROFESIONAL
 ***************************************/

function redondearTotal(total) {
    const centavos = total - Math.floor(total);
    return centavos > 0.60 ? Math.ceil(total) : Math.floor(total);
}

function formatearNumero(numero) {
    return new Intl.NumberFormat('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numero);
}

function formatearFecha(fecha) {
    return new Intl.DateTimeFormat('es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(fecha);
}

function armarYImprimirTicket(data) {
    const productos = typeof data.productos === "string" ? JSON.parse(data.productos) : data.productos;
    const totalOriginal = productos.reduce((acc, p) => acc + (parseFloat(p.precio_unitario) * parseInt(p.cantidad)), 0);
    const totalRedondeado = redondearTotal(totalOriginal);
    const fechaActual = new Date();
    const folioTicket = `${data.no_venta}-${fechaActual.getTime().toString().slice(-6)}`;
    
    // Calcular IVA (16% sobre el total)
    const iva = totalOriginal * 0.16;
    const subtotal = totalOriginal - iva;
    
    // Calcular cambio si existe
    const cambio = data.cambio ? parseFloat(data.cambio) : 0;
    
    const ticketHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Ticket de venta - ${data.no_venta}</title>
        <style>
            @page {
                size: 80mm 297mm;
                margin: 0;
            }
            body {
                font-family: 'Courier New', monospace;
                font-size: 11px;
                width: 80mm;
                margin: 0 auto;
                padding: 8px 4px;
                background: white;
                color: #000;
            }
            * {
                box-sizing: border-box;
            }
            .ticket {
                width: 100%;
                max-width: 80mm;
                margin: 0 auto;
            }
            .text-center {
                text-align: center;
            }
            .text-right {
                text-align: right;
            }
            .text-left {
                text-align: left;
            }
            .bold {
                font-weight: bold;
            }
            .dashed-line {
                border-top: 1px dashed #000;
                margin: 6px 0;
            }
            .double-line {
                border-top: 2px solid #000;
                margin: 8px 0;
            }
            .logo {
                max-width: 120px;
                margin: 0 auto;
            }
            .empresa-nombre {
                font-size: 14px;
                font-weight: bold;
                margin: 5px 0 2px;
            }
            .empresa-info {
                font-size: 9px;
                color: #666;
                margin: 2px 0;
            }
            .folio {
                font-size: 10px;
                background: #f5f5f5;
                padding: 4px;
                margin: 6px 0;
                text-align: center;
            }
            .producto-item {
                margin: 4px 0;
            }
            .producto-nombre {
                font-size: 10px;
                font-weight: 500;
            }
            .producto-detalle {
                font-size: 9px;
                color: #666;
                margin-left: 5px;
            }
            .totales {
                margin: 8px 0;
            }
            .total-final {
                font-size: 14px;
                font-weight: bold;
                color: #2c3e50;
                margin: 8px 0;
            }
            .leyenda {
                font-size: 8px;
                color: #888;
                text-align: center;
                margin-top: 12px;
                padding-top: 8px;
                border-top: 1px dotted #ccc;
            }
            .footer {
                font-size: 9px;
                text-align: center;
                margin-top: 10px;
                padding-top: 5px;
            }
            .qr-code {
                text-align: center;
                margin: 8px 0;
                font-family: monospace;
                font-size: 8px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
            }
            td {
                padding: 2px 0;
            }
            .producto-cantidad {
                width: 15%;
                text-align: center;
            }
            .producto-precio {
                width: 20%;
                text-align: right;
            }
            .producto-total {
                width: 20%;
                text-align: right;
            }
        </style>
    </head>
    <body>
        <div class="ticket">
            <!-- ENCABEZADO -->
            <div class="text-center">
                <div class="logo">
                    <img src="${LOGO_URL}" style="max-width: 100px; height: auto;" onerror="this.style.display='none'">
                </div>
                <div class="empresa-nombre">${data.sucursal_nombre || 'EL OFERTÓN'}</div>
                <div class="empresa-info">${data.sucursal_direccion || 'Dirección no registrada'}</div>
                <div class="empresa-info">Tel: ${data.telefono || 'Sin teléfono'}</div>
            </div>
            
            <div class="dashed-line"></div>
            
            <!-- INFORMACIÓN DEL TICKET -->
            <div>
                <div><strong>FOLIO:</strong> ${data.no_venta}</div>
                <div><strong>TICKET:</strong> ${folioTicket}</div>
                <div><strong>FECHA:</strong> ${formatearFecha(fechaActual)}</div>
                <div><strong>CAJERO(A):</strong> ${data.vendedor_nombre}</div>
                <div><strong>TIPO CLIENTE:</strong> ${data.tipo_cliente === 'mayorista' ? 'MAYORISTA' : 'PÚBLICO GENERAL'}</div>
                ${data.tipo_cliente === 'mayorista' ? `<div><strong>DESCUENTO:</strong> ${data.descuento || 0}%</div>` : ''}
            </div>
            
            <div class="dashed-line"></div>
            
            <!-- PRODUCTOS -->
            <div class="bold text-center">PRODUCTOS</div>
            <div class="dashed-line"></div>
            
            <table>
                <thead>
                    <tr style="font-size: 9px; border-bottom: 1px solid #ccc;">
                        <th class="text-left">PRODUCTO</th>
                        <th class="producto-cantidad">CANT</th>
                        <th class="producto-precio">P.UNIT</th>
                        <th class="producto-total">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${productos.map(p => {
                        const precioUnitario = parseFloat(p.precio_unitario);
                        const cantidad = parseInt(p.cantidad);
                        const totalProducto = precioUnitario * cantidad;
                        const esMayoreo = p.precio_mayoreo && p.precio_mayoreo < p.precio_normal;
                        const precioOriginal = p.precio_normal ? parseFloat(p.precio_normal) : precioUnitario;
                        
                        return `
                            <tr>
                                <td colspan="4" class="producto-nombre">
                                    ${p.nombre.substring(0, 35)}${p.nombre.length > 35 ? '...' : ''}
                                    ${esMayoreo ? '<br><span style="font-size: 8px; color: #27ae60;">(Precio mayoreo)</span>' : ''}
                                </td>
                            </tr>
                            <tr style="font-size: 9px;">
                                <td class="text-left"></td>
                                <td class="producto-cantidad">${cantidad}</td>
                                <td class="producto-precio">
                                    ${esMayoreo ? `<span style="text-decoration: line-through; font-size: 8px;">$${formatearNumero(precioOriginal)}</span><br>$${formatearNumero(precioUnitario)}` : `$${formatearNumero(precioUnitario)}`}
                                </td>
                                <td class="producto-total">$${formatearNumero(totalProducto)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            
            <div class="dashed-line"></div>
            
            <!-- TOTALES -->
            <div class="totales">
                <table>
                    <tr>
                        <td class="text-left">SUBTOTAL:</td>
                        <td class="text-right">$${formatearNumero(subtotal)}</td>
                    </tr>
                    ${data.descuento && data.descuento > 0 ? `
                    <tr>
                        <td class="text-left">DESCUENTO (${data.descuento}%):</td>
                        <td class="text-right">-$${formatearNumero(totalOriginal * (data.descuento / 100))}</td>
                    </tr>
                    ` : ''}
                    <tr class="bold">
                        <td class="text-left">TOTAL:</td>
                        <td class="text-right">$${formatearNumero(totalOriginal)}</td>
                    </tr>
                    ${totalRedondeado !== totalOriginal ? `
                    <tr style="font-size: 9px; color: #666;">
                        <td class="text-left">REDONDEO:</td>
                        <td class="text-right">${totalRedondeado > totalOriginal ? '+' : ''}$${formatearNumero(totalRedondeado - totalOriginal)}</td>
                    </tr>
                    <tr class="bold total-final">
                        <td class="text-left">TOTAL A PAGAR:</td>
                        <td class="text-right">$${formatearNumero(totalRedondeado)}</td>
                    </tr>
                    ` : `
                    <tr class="bold total-final">
                        <td class="text-left">TOTAL A PAGAR:</td>
                        <td class="text-right">$${formatearNumero(totalOriginal)}</td>
                    </tr>
                    `}
                </table>
            </div>
            
            <div class="dashed-line"></div>
            
            <!-- DATOS DE PAGO -->
            <div>
                <div><strong>FORMA DE PAGO:</strong> 
                    ${data.forma_pago === 'efectivo' ? 'EFECTIVO' : 
                      data.forma_pago === 'tarjeta' ? 'TARJETA DE CRÉDITO/DÉBITO' : 
                      data.forma_pago === 'transferencia' ? 'TRANSFERENCIA BANCARIA' : 
                      data.forma_pago === 'mixto' ? 'PAGO MIXTO' : data.forma_pago.toUpperCase()}
                </div>
                <div><strong>MONTO PAGADO:</strong> $${formatearNumero(parseFloat(data.monto_pagado))}</div>
                ${cambio > 0 ? `<div><strong>CAMBIO:</strong> $${formatearNumero(cambio)}</div>` : ''}
            </div>
    
            <div class="double-line"></div>
            
            <!-- LEYENDAS FISCALES Y LEGALES -->
            <div class="leyenda">
                <div>Este comprobante no tiene validez fiscal</div>
                <div>www.el-oferton.mx | Atención: ventas@el-oferton.mx</div>
            </div>
            
            <!-- POLÍTICAS DE DEVOLUCIÓN -->
            <div class="leyenda" style="border-top: none; margin-top: 5px;">
                <div><strong>POLÍTICAS DE DEVOLUCIÓN</strong></div>
                <div>• Cambios hasta 3 días después de la compra</div>
                <div>• Productos en empaque original y sin usar</div>
                <div>• Presentar este ticket para cualquier aclaración</div>
            </div>
            
            <!-- FOOTER -->
            <div class="footer">
                <div>¡Gracias por su compra!</div>
                <div>¡Vuelva pronto!</div>
                <div style="font-size: 8px; margin-top: 5px;">
                    Ticket generado por SISTEMA PUNTO DE VENTA v2.0<br>
                    ${formatearFecha(fechaActual)} | Caja #${data.caja_id || '01'}
                </div>
                <div style="font-size: 7px; margin-top: 5px;">
                    Este ticket es tu comprobante de compra<br>
                    Consérvalo para futuras referencias
                </div>
            </div>
        </div>
        
        <script>
            // Auto-impresión al cargar
            window.onload = function() {
                setTimeout(function() {
                    window.print();
                    setTimeout(function() {
                        window.close();
                    }, 500);
                }, 100);
            };
        </script>
    </body>
    </html>`;
    
    // Abrir ventana de impresión
    const ventana = window.open('', '_blank', 'width=400,height=600,toolbar=no,menubar=no,scrollbars=yes,resizable=yes');
    if (ventana) {
        ventana.document.write(ticketHtml);
        ventana.document.close();
    } else {
        // Si el popup es bloqueado, mostrar mensaje
        Swal.fire({
            icon: 'warning',
            title: 'Ventana bloqueada',
            text: 'Permite las ventanas emergentes para imprimir el ticket',
            confirmButtonText: 'Entendido'
        });
    }
    
    // No recargar inmediatamente para permitir impresión
    setTimeout(() => {
        if (confirm('¿Venta completada correctamente. ¿Desea continuar?')) {
            location.reload();
        }
    }, 3000);
}
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

// Navegación con teclado
$(document).on('keydown', function (e) {
    if ($('.ui-autocomplete').is(':visible')) return;
    if (e.key === 'F2') { e.preventDefault(); $('#btnBuscarProducto').click(); }
    if (e.key === 'F4') { e.preventDefault(); if (confirm('¿Limpiar todos los productos?')) limpiarVentaCompleta(); }
    if (e.key === 'F5') { e.preventDefault(); $('#btnVentaRapida').click(); }
    if (e.key === 'F10') { e.preventDefault(); registrarVenta(); }

    const filas = $('#tabla-productos tbody tr.fila-producto');
    if (!filas.length || !filaSeleccionada) return;
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        const siguiente = filaSeleccionada.next('.fila-producto');
        if (siguiente.length) { filaSeleccionada = siguiente; $('#tabla-productos tbody tr').removeClass('table-primary'); filaSeleccionada.addClass('table-primary'); filaSeleccionada.find('input[data-tipo="no_folio"]').focus(); }
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        const anterior = filaSeleccionada.prev('.fila-producto');
        if (anterior.length) { filaSeleccionada = anterior; $('#tabla-productos tbody tr').removeClass('table-primary'); filaSeleccionada.addClass('table-primary'); filaSeleccionada.find('input[data-tipo="no_folio"]').focus(); }
    }
    if (e.key === 'Delete' && filaSeleccionada) { e.preventDefault(); eliminarFila(filaSeleccionada); }
});

// Modal de búsqueda
$('#inputBuscarProducto').on('input', function () {
    const texto = $(this).val().trim();
    if (texto.length < 2) { $('#listaProductos').empty(); return; }
    $.ajax({
        url: BUSCAR_PRODUCTO_URL,
        data: { q: texto, tipo: 'nombre' },
        success: function (data) {
            let html = '';
            data.forEach(p => {
                html += `<button class="list-group-item list-group-item-action item-producto" data-producto='${JSON.stringify(p)}'>
                    <div><strong>${p.nombre}</strong></div>
                    <small>$${parseFloat(p.precio).toFixed(2)} | Stock: ${p.stock_fisico}</small>
                </button>`;
            });
            $('#listaProductos').html(html || '<div class="text-muted p-2">Sin resultados</div>');
        }
    });
});

$(document).on('click', '.item-producto', function () {
    const producto = $(this).data('producto');
    const fila = $('#tabla-productos tbody tr:last');
    seleccionarProducto(producto, fila);
    $('#modalBuscarProducto').modal('hide');
    setTimeout(() => $('#tabla-productos tbody tr:last input[data-tipo="no_folio"]').focus(), 300);
});

// Configuración de tipo de cliente
document.addEventListener('DOMContentLoaded', function () {
    const tipoCliente = document.getElementById("id_tipo_cliente");
    const descuentoContainer = document.getElementById("descuento_container");
    const descuento = document.getElementById("descuento");
    const permisoPiezaContainer = document.getElementById("permiso_pieza_container");
    if (!tipoCliente) return;

    tipoCliente.value = 'publico';
    const vendedor = document.getElementById('id_vendedor');
    if (vendedor && vendedor.options.length > 0) vendedor.selectedIndex = 1;

    tipoCliente.addEventListener("change", function () {
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

    $('#descuento').on('change', function () {
        usarMayoreo = $(this).val() === 'producto';
        aplicarPrecioMayoreo(usarMayoreo);
        actualizarTotales();
    });

    $('#descuento_container, #permiso_pieza_container').addClass('d-none');
    $('#permitir_pieza').prop('checked', false);
});
// ================= ACTUALIZAR PRODUCTO =================
let productoIdActualizar = null;

document.addEventListener('click', function(e) {
    const btnActualizar = e.target.closest('.btn-actualizar-producto');
    if (btnActualizar && !btnActualizar.disabled) {
        e.preventDefault();
        e.stopPropagation();
        
        productoIdActualizar = btnActualizar.dataset.productoId;
        document.getElementById('producto_id_actualizar').value = productoIdActualizar;
        document.getElementById('producto_nombre_actualizar').innerHTML = `<i class="bi bi-box"></i> ${btnActualizar.dataset.productoNombre}`;
        document.getElementById('precio_actual').textContent = `$${parseFloat(btnActualizar.dataset.precio).toFixed(2)}`;
        document.getElementById('precio_mayoreo_actual').textContent = `$${parseFloat(btnActualizar.dataset.precioMayoreo).toFixed(2)}`;
        
        document.getElementById('nuevo_precio').value = '';
        document.getElementById('nuevo_precio_mayoreo').value = '';
        document.getElementById('nuevo_stock_fisico').value = '';
        document.getElementById('nuevo_stock_virtual').value = '';
        document.getElementById('password_admin_actualizar').value = '';
        
        document.getElementById('password-error-actualizar')?.classList.add('d-none');
        
        fetch(`/api/obtener-stock-producto/?producto_id=${productoIdActualizar}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('stock_fisico_actual').textContent = data.stock_fisico;
                    document.getElementById('stock_virtual_actual').textContent = data.stock_virtual;
                }
            })
            .catch(err => console.error('Error al obtener stock:', err));
        
        new bootstrap.Modal(document.getElementById('modalActualizarProducto')).show();
    }
});

document.getElementById('formActualizarProducto')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const btnSubmit = document.getElementById('btnActualizarProducto');
    const originalHtml = btnSubmit.innerHTML;
    const formData = new FormData(this);
    const productoId = formData.get('producto_id');
    
    // Deshabilitar botón y mostrar loading
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Actualizando...';
    
    fetch(this.action, {
        method: 'POST',
        body: formData,
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(response => response.json())
    .then(data => {
        // IMPORTANTE: Siempre restaurar el botón primero
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalHtml;
        
        if (data.success) {
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalActualizarProducto'));
            if (modal) modal.hide();
            
            // Actualizar la fila en la tabla
            const fila = document.querySelector(`tr[data-producto-id="${productoId}"]`);
            if (fila) {
                if (data.precio_actualizado && data.nuevo_precio) {
                    const precioCell = fila.querySelector('.precio');
                    if (precioCell) {
                        precioCell.textContent = data.nuevo_precio.toFixed(2);
                    }
                    const cantidadInput = fila.querySelector('.cantidad');
                    const cantidad = cantidadInput ? parseInt(cantidadInput.value) || 0 : 0;
                    const totalCell = fila.querySelector('.total');
                    if (totalCell) {
                        totalCell.textContent = (cantidad * data.nuevo_precio).toFixed(2);
                    }
                    // Actualizar el dataset del botón
                    const btnActualizar = fila.querySelector('.btn-actualizar-producto');
                    if (btnActualizar) {
                        btnActualizar.dataset.precio = data.nuevo_precio;
                    }
                }
                
                // Actualizar stock si se modificó
                const nuevoStockFisico = formData.get('nuevo_stock_fisico');
                if (nuevoStockFisico) {
                    const cantidadInput = fila.querySelector('.cantidad');
                    if (cantidadInput) {
                        cantidadInput.dataset.stock_fisico = nuevoStockFisico;
                    }
                }
            }
            
            // Recalcular totales
            actualizarTotales();
            $('#monto_pagado').trigger('input');
            
            // Mostrar mensaje de éxito
            Swal.fire({ 
                icon: 'success', 
                title: 'Éxito', 
                text: data.message, 
                timer: 2000, 
                showConfirmButton: false 
            });
            
        } else {
            // Error en la respuesta
            if (data.error === 'password') {
                const errorDiv = document.getElementById('password-error-actualizar');
                if (errorDiv) {
                    errorDiv.classList.remove('d-none');
                    errorDiv.innerHTML = `<i class="bi bi-exclamation-triangle"></i> ${data.message}`;
                }
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: data.message });
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        // Restaurar botón en caso de error
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalHtml;
        Swal.fire({ 
            icon: 'error', 
            title: 'Error', 
            text: 'Error al conectar con el servidor' 
        });
    });
});