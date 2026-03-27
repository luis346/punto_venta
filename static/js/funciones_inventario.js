document.addEventListener("DOMContentLoaded", function() {
    let lastKeyTime = 0;
    let timeout = null;
    let searchTimeout = null;

    // Elementos del DOM
    const formProducto = document.getElementById("formProducto");
    const folioInput = document.getElementById("id_no_folio");
    const btnGuardar = document.getElementById("btnGuardarProducto");
    const checkAll = document.getElementById("check-all");
    const buscarInventario = document.getElementById("buscarInventario");
    const tablaInventario = document.getElementById("tabla-inventario");
    const formFiltros = document.getElementById("form-filtros");
    const modalElement = document.getElementById("modalProducto");
    const categoriaFiltro = document.getElementById("categoria-filtro");
    const selectPageSize = document.getElementById("select-page-size");
    const btnImprimir = document.getElementById("btn-imprimir");
    const btnDeseleccionar = document.getElementById("btn-deseleccionar-todo");

    // Verificar que la configuración exista
    const CONFIG = window.INVENTARIO_CONFIG || {
        urls: {
            exportar_excel: '/exportar-excel/',
            inventario: '/inventario/',
            validar_folio: '/validar-folio/',
            eliminar_producto: '/eliminar-producto/'
        }
    };

    /* =========================
       ATALJOS DE TECLADO
    ========================= */
    document.addEventListener('keydown', function(e) {
        // Ctrl + N = Nuevo producto
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            document.querySelector('[data-bs-target="#modalProducto"]')?.click();
        }
        
        // Ctrl + F = Enfocar búsqueda
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            buscarInventario?.focus();
            buscarInventario?.select();
        }
        
        // Ctrl + E = Exportar Excel (USAR CONFIGURACIÓN)
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            window.location.href = CONFIG.urls.exportar_excel;
        }
        
        // Ctrl + L = Limpiar filtros (USAR CONFIGURACIÓN)
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            window.location.href = CONFIG.urls.inventario;
        }
        
        // Ctrl + I = Importar Excel
        if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            document.getElementById('file-input')?.click();
        }
    });

    /* =========================
       BLOQUEAR ENTER ESCÁNER
    ========================= */
    if (formProducto) {
        formProducto.addEventListener("keydown", function(e) {
            if (e.key === "Enter") {
                const now = new Date().getTime();
                const diff = now - lastKeyTime;
                lastKeyTime = now;

                if (diff < 50) {
                    e.preventDefault();
                }
            }
        });
    }

    /* =========================
       CHECKBOX SELECCIONAR TODO MEJORADO
    ========================= */
    function actualizarContadorSeleccionados() {
        const checkboxes = document.querySelectorAll('input[name="productos"]');
        const seleccionados = Array.from(checkboxes).filter(cb => cb.checked).length;
        
        // Actualizar contadores
        const selectedCount = document.getElementById('selected-count');
        const selectedCountBadge = document.getElementById('selected-count-badge');
        if (selectedCount) selectedCount.textContent = seleccionados;
        if (selectedCountBadge) selectedCountBadge.textContent = seleccionados;
        
        // Actualizar estado del check-all
        if (checkAll) {
            if (seleccionados === 0) {
                checkAll.checked = false;
                checkAll.indeterminate = false;
            } else if (seleccionados === checkboxes.length) {
                checkAll.checked = true;
                checkAll.indeterminate = false;
            } else {
                checkAll.indeterminate = true;
            }
        }
        
        // Mostrar/ocultar botón deseleccionar
        if (btnDeseleccionar) {
            btnDeseleccionar.style.display = seleccionados > 0 ? 'inline-block' : 'none';
        }
        
        // Habilitar/deshabilitar botón imprimir
        if (btnImprimir) {
            btnImprimir.disabled = seleccionados === 0;
        }
    }

    if (checkAll) {
        checkAll.addEventListener("change", function() {
            const checkboxes = document.querySelectorAll('input[name="productos"]');
            checkboxes.forEach(cb => cb.checked = this.checked);
            actualizarContadorSeleccionados();
        });
    }

    // Escuchar cambios en checkboxes individuales
    document.addEventListener('change', function(e) {
        if (e.target.matches('input[name="productos"]')) {
            actualizarContadorSeleccionados();
        }
    });

    // Botón deseleccionar todo
    if (btnDeseleccionar) {
        btnDeseleccionar.addEventListener('click', function() {
            document.querySelectorAll('input[name="productos"]').forEach(cb => cb.checked = false);
            if (checkAll) checkAll.checked = false;
            actualizarContadorSeleccionados();
        });
    }

    /* =========================
       AUTO GUARDAR STOCK MEJORADO
    ========================= */
    document.querySelectorAll(".stock-input").forEach(input => {
        let inputTimeout = null;

        input.addEventListener("input", function() {
            clearTimeout(inputTimeout);
            
            // Guardar valor original
            const originalValue = this.defaultValue;
            const newValue = this.value;
            
            inputTimeout = setTimeout(() => {
                const form = this.closest("form");
                if (!form) return;

                const formData = new FormData(form);
                const row = this.closest('tr');

                // Mostrar indicador de guardando
                const spinner = document.createElement('span');
                spinner.className = 'spinner-border spinner-border-sm ms-1';
                spinner.style.width = '12px';
                spinner.style.height = '12px';
                this.parentNode.appendChild(spinner);

                // USAR CONFIGURACIÓN
                fetch(CONFIG.urls.inventario, {
                    method: "POST",
                    headers: {
                        "X-CSRFToken": formData.get("csrfmiddlewaretoken"),
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    body: formData
                })
                .then(resp => resp.json())
                .then(data => {
                    spinner.remove();
                    
                    if (data.success) {
                        // Resaltar fila
                        row.classList.add('highlight');
                        setTimeout(() => row.classList.remove('highlight'), 1000);
                        
                        // Mostrar check de guardado
                        const savedMsg = document.createElement('span');
                        savedMsg.className = 'saved-msg';
                        savedMsg.innerHTML = '✓';
                        this.parentNode.appendChild(savedMsg);
                        setTimeout(() => savedMsg.remove(), 1500);
                        
                        // Actualizar valor por defecto
                        this.defaultValue = this.value;
                    } else {
                        // Restaurar valor original
                        this.value = originalValue;
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: data.error || 'Error al guardar',
                            timer: 2000,
                            showConfirmButton: false
                        });
                    }
                })
                .catch(err => {
                    spinner.remove();
                    console.error("Error:", err);
                    this.value = originalValue;
                });
            }, 500);
        });
    });

    /* =========================
       VALIDAR FOLIO AJAX
    ========================= */
    if (folioInput && btnGuardar) {
        folioInput.addEventListener("keyup", function() {
            clearTimeout(timeout);

            timeout = setTimeout(() => {
                const folio = this.value.trim().toUpperCase();

                if (!folio) {
                    limpiarError();
                    btnGuardar.disabled = false;
                    return;
                }

                // USAR CONFIGURACIÓN
                fetch(`${CONFIG.urls.validar_folio}?folio=${folio}`)
                .then(response => response.json())
                .then(data => {
                    if (data.existe) {
                        mostrarError("⚠ Ya existe un producto con ese folio");
                        btnGuardar.disabled = true;
                    } else {
                        limpiarError();
                        btnGuardar.disabled = false;
                    }
                });
            }, 350);
        });

        function mostrarError(mensaje) {
            let errorDiv = document.getElementById("folio-error");
            if (!errorDiv) {
                errorDiv = document.createElement("div");
                errorDiv.id = "folio-error";
                errorDiv.classList.add("text-danger", "small", "mt-1");
                folioInput.parentNode.appendChild(errorDiv);
            }
            errorDiv.innerText = mensaje;
            errorDiv.style.display = 'block';
        }

        function limpiarError() {
            const errorDiv = document.getElementById("folio-error");
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }
        }
    }

    /* =========================
       FILTROS EN TIEMPO REAL
    ========================= */
    function aplicarFiltros() {
        if (!buscarInventario || !tablaInventario) return;

        const params = new URLSearchParams({
            nombre: buscarInventario.value,
            categoria: categoriaFiltro?.value || ''
        });

        // Mostrar indicador de carga
        tablaInventario.style.opacity = '0.5';
        
        fetch(window.location.pathname + "?" + params.toString(), {
            headers: { "X-Requested-With": "XMLHttpRequest" }
        })
        .then(response => response.text())
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const nuevaTabla = doc.getElementById("tabla-inventario");

            if (nuevaTabla) {
                tablaInventario.innerHTML = nuevaTabla.innerHTML;
                tablaInventario.style.opacity = '1';
                
                // Actualizar totales
                const badge = document.querySelector('.badge.bg-light');
                const nuevoTotal = doc.querySelector('.badge.bg-light');
                if (badge && nuevoTotal) {
                    badge.innerHTML = nuevoTotal.innerHTML;
                }
                
                // Re-inicializar eventos
                inicializarEventosTabla();
            }
        })
        .catch(() => {
            tablaInventario.style.opacity = '1';
        });
    }

    if (buscarInventario) {
        buscarInventario.addEventListener("keyup", function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(aplicarFiltros, 300);
        });
    }

    if (categoriaFiltro) {
        categoriaFiltro.addEventListener("change", aplicarFiltros);
    }

    /* =========================
       SELECTOR DE FILAS POR PÁGINA
    ========================= */
    if (selectPageSize) {
        selectPageSize.addEventListener('change', function() {
            const url = new URL(window.location);
            url.searchParams.set('page_size', this.value);
            url.searchParams.set('page', '1');
            window.location.href = url.toString();
        });
    }

 document.addEventListener('DOMContentLoaded', function() {
        // Manejar los botones de eliminar categoría
        const eliminarButtons = document.querySelectorAll('.btn-eliminar-categoria');
        
        eliminarButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                // Prevenir el envío automático del formulario
                e.preventDefault();
                e.stopPropagation();
                
                // Obtener datos de la categoría
                const form = this.closest('.form-eliminar-categoria');
                const categoriaNombre = this.getAttribute('data-categoria-nombre');
                const productosCount = parseInt(this.getAttribute('data-categoria-productos') || '0');
                
                // Construir mensaje de confirmación
                let mensaje = `¿Estás seguro de eliminar la categoría "${categoriaNombre}"?`;
                if (productosCount > 0) {
                    mensaje = `⚠️ ADVERTENCIA: La categoría "${categoriaNombre}" tiene ${productosCount} producto(s) asociado(s).\n\nSi la eliminas, estos productos quedarán sin categoría.\n\n¿Deseas continuar?`;
                }
                
                // Mostrar confirmación con SweetAlert
                Swal.fire({
                    title: 'Confirmar eliminación',
                    html: `<p>${mensaje.replace(/\n/g, '<br>')}</p>`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc3545',
                    cancelButtonColor: '#6c757d',
                    confirmButtonText: 'Sí, eliminar',
                    cancelButtonText: 'Cancelar',
                    focusConfirm: false
                }).then((result) => {
                    if (result.isConfirmed) {
                        // Mostrar loading
                        Swal.fire({
                            title: 'Eliminando...',
                            text: 'Por favor espera',
                            allowOutsideClick: false,
                            didOpen: () => {
                                Swal.showLoading();
                            }
                        });
                        
                        // Enviar el formulario
                        fetch(form.action, {
                            method: 'POST',
                            headers: {
                                'X-CSRFToken': form.querySelector('[name=csrfmiddlewaretoken]').value,
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            credentials: 'same-origin'
                        })
                        .then(response => {
                            if (response.redirected) {
                                // Si hay redirección, recargar la página
                                window.location.href = response.url;
                            } else {
                                return response.json();
                            }
                        })
                        .then(data => {
                            if (data && data.success === false) {
                                throw new Error(data.error || 'Error al eliminar');
                            }
                        })
                        .catch(error => {
                            console.error('Error:', error);
                            // Si hay error, recargar igualmente (el servidor ya procesó)
                            setTimeout(() => {
                                window.location.reload();
                            }, 1000);
                        });
                    }
                });
            });
        });
        
        // Manejar el cierre del modal para evitar error de aria-hidden
        const modalCategoria = document.getElementById('modalCategoria');
        if (modalCategoria) {
            modalCategoria.addEventListener('hidden.bs.modal', function() {
                // Devolver el foco al botón que abrió el modal
                const btnQueAbrio = document.querySelector('[data-bs-target="#modalCategoria"]');
                if (btnQueAbrio) {
                    setTimeout(() => {
                        btnQueAbrio.focus();
                    }, 50);
                }
            });
        }
    });
    /* =========================
       CONFIRMAR ELIMINACIÓN PRODUCTO
    ========================= */
    window.confirmarEliminacion = function(productoId) {
        Swal.fire({
            title: '¿Eliminar producto?',
            text: 'Esta acción no se puede deshacer',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                // USAR CONFIGURACIÓN
                window.location.href = `${CONFIG.urls.eliminar_producto}${productoId}/`;
            }
        });
    };

    /* =========================
       INICIALIZAR EVENTOS DE TABLA
    ========================= */
    function inicializarEventosTabla() {
        // Re-inicializar auto-save para nuevos inputs
        document.querySelectorAll(".stock-input").forEach(input => {
            if (!input.hasAttribute('data-initialized')) {
                input.setAttribute('data-initialized', 'true');
                
                let inputTimeout;
                input.addEventListener("input", function() {
                    clearTimeout(inputTimeout);
                    inputTimeout = setTimeout(() => {
                        const form = this.closest("form");
                        if (form) {
                            const event = new Event('change');
                            this.dispatchEvent(event);
                        }
                    }, 500);
                });
            }
        });
    }

    inicializarEventosTabla();
    actualizarContadorSeleccionados();


    /* =========================
       TOOLTIPS DE BOOTSTRAP
    ========================= */
    const tooltipTriggerList = document.querySelectorAll('[title]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => {
        return new bootstrap.Tooltip(tooltipTriggerEl, {
            placement: 'top'
        });
    });

 /* =========================
   CONTROL MODAL PRODUCTO
========================= */
if (modalElement) {
    const modal = new bootstrap.Modal(modalElement);

    // NOTA: La condición para mostrar el modal se maneja desde el template HTML
    // usando una variable global

    modalElement.addEventListener("hide.bs.modal", function() {
        if (document.activeElement) {
            document.activeElement.blur();
        }
    });

    modalElement.addEventListener("hidden.bs.modal", function() {
        if (formProducto) formProducto.reset();
        
        // Usar función global si existe
        if (typeof limpiarError === 'function') {
            limpiarError();
        }
        
        if (btnGuardar) btnGuardar.disabled = false;

        const url = new URL(window.location);
        url.searchParams.delete("editar");
        window.history.replaceState({}, document.title, url.pathname);
    });
}
    /* =========================
       IMPORTAR EXCEL - VALIDACIÓN
    ========================= */
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const ext = file.name.split('.').pop().toLowerCase();
                if (!['xlsx', 'xls'].includes(ext)) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Archivo inválido',
                        text: 'Por favor selecciona un archivo Excel (.xlsx o .xls)'
                    });
                    this.value = '';
                }
            }
        });
    }

    const formImportar = document.getElementById('form-importar');
    if (formImportar) {
        formImportar.addEventListener('submit', function(e) {
            const file = fileInput?.files[0];
            if (!file) {
                e.preventDefault();
                Swal.fire({
                    icon: 'warning',
                    title: 'Selecciona un archivo',
                    text: 'Debes seleccionar un archivo Excel para importar'
                });
            }
        });
    }
});



let scannerActivo = false;
let html5QrCode;

const btnScan = document.getElementById('btnScan');
const scannerContainer = document.getElementById('scannerContainer');
const btnVolverScanner = document.getElementById('btnVolverScanner');
const reader = document.getElementById('reader');
const formFields = document.querySelectorAll('#modalProducto .modal-body > div:not(#scannerContainer)');
const inputFolio = document.getElementById('id_no_folio');

if (btnScan) {
    btnScan.addEventListener('click', () => {
        formFields.forEach(div => div.style.display = 'none');
        scannerContainer.style.display = 'block';
        reader.innerHTML = '<div class="scan-line"></div>';
        iniciarScanner();
    });
}

if (btnVolverScanner) {
    btnVolverScanner.addEventListener('click', cerrarScanner);
}

function iniciarScanner() {
    html5QrCode = new Html5Qrcode("reader");

    Html5Qrcode.getCameras().then(devices => {
        if (!devices.length) {
            Swal.fire({
                icon: 'error',
                title: 'Sin cámara',
                text: 'No se encontró ninguna cámara'
            });
            return;
        }

        // Buscar cámara trasera
        let cameraId = devices.find(d =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment")
        )?.id;

        if (!cameraId) {
            cameraId = devices[devices.length - 1].id;
        }

        html5QrCode.start(
            cameraId,
            {
                fps: 20,
                qrbox: { width: 300, height: 150 },
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39
                ]
            },
            (decodedText) => {
                // Reproducir sonido
                new Audio("https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg").play();
                
                // Vibrar si es compatible
                if (navigator.vibrate) navigator.vibrate(200);

                inputFolio.value = decodedText;
                inputFolio.dispatchEvent(new Event('input'));

                // Mostrar notificación de éxito
                Swal.fire({
                    icon: 'success',
                    title: 'Código escaneado',
                    text: decodedText,
                    timer: 1500,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });

                cerrarScanner();
            },
            (errorMessage) => {
                // Error de escaneo - ignorar
            }
        );

        scannerActivo = true;
    });
}

function cerrarScanner() {
    if (scannerActivo && html5QrCode) {
        html5QrCode.stop().then(() => {
            reader.innerHTML = "";
        });
        scannerActivo = false;
    }

    scannerContainer.style.display = 'none';
    formFields.forEach(div => div.style.display = '');
}


// Script para configuración de impresión
document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const tamanoEtiqueta = document.getElementById('tamano_etiqueta');
    const anchoPersonalizado = document.getElementById('ancho_personalizado');
    const altoPersonalizado = document.getElementById('alto_personalizado');
    const customAnchoContainer = document.getElementById('custom-ancho-container');
    const customAltoContainer = document.getElementById('custom-alto-container');
    
    // Mostrar/ocultar campos personalizados
    tamanoEtiqueta.addEventListener('change', function() {
        const isCustom = this.value === 'custom';
        customAnchoContainer.style.display = isCustom ? 'block' : 'none';
        customAltoContainer.style.display = isCustom ? 'block' : 'none';
        actualizarVistaPrevia();
    });
    
    // Actualizar vista previa cuando cambie cualquier opción
    const elementosActualizar = [
        'tamano_etiqueta', 'ancho_personalizado', 'alto_personalizado',
        'mostrar_nombre', 'mostrar_folio', 'mostrar_referencia', 
        'mostrar_precio', 'mostrar_numero_codigo', 'altura_codigo', 
        'ancho_barra', 'fuente_numero'
    ];
    
    elementosActualizar.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.addEventListener('change', actualizarVistaPrevia);
            if (elemento.type === 'checkbox') {
                elemento.addEventListener('click', actualizarVistaPrevia);
            }
        }
    });
    
    // Función para actualizar vista previa
    function actualizarVistaPrevia() {
        // Obtener configuración
        let anchoCm = 4, altoCm = 2.5;
        
        if (tamanoEtiqueta.value === 'custom') {
            anchoCm = parseFloat(anchoPersonalizado.value) || 4;
            altoCm = parseFloat(altoPersonalizado.value) || 2.5;
        } else {
            const tamaños = {
                '3x2': [3, 2],
                '4x2.5': [4, 2.5],
                '5x3': [5, 3],
                '6x4': [6, 4]
            };
            [anchoCm, altoCm] = tamaños[tamanoEtiqueta.value] || [4, 2.5];
        }
        
        // Escalar para vista previa (1cm = 20px)
        const anchoPx = anchoCm * 20;
        const altoPx = altoCm * 20;
        
        // Actualizar tamaño del contenedor de vista previa
        const previewDiv = document.getElementById('preview-etiqueta');
        previewDiv.style.width = `${anchoPx}px`;
        previewDiv.style.height = `${altoPx}px`;
        
        // Obtener opciones
        const mostrarNombre = document.getElementById('mostrar_nombre').checked;
        const mostrarFolio = document.getElementById('mostrar_folio').checked;
        const mostrarReferencia = document.getElementById('mostrar_referencia').checked;
        const mostrarPrecio = document.getElementById('mostrar_precio').checked;
        const mostrarNumeroCodigo = document.getElementById('mostrar_numero_codigo').checked;
        const alturaCodigo = parseFloat(document.getElementById('altura_codigo').value);
        const fuenteNumero = document.getElementById('fuente_numero').value;
        
        // Datos de ejemplo para vista previa
        const productoEjemplo = {
            nombre: 'Producto Ejemplo',
            folio: '750123456789',
            referencia: 'REF-001',
            precio: '99.99'
        };
        
        // Generar HTML de vista previa
        let previewHtml = `<div style="width:100%; height:100%; position:relative; font-family: monospace; font-size: 10px; padding: 2px;">`;
        
        let posY = 5;
        
        if (mostrarNombre) {
            previewHtml += `<div style="text-align:center; font-weight:bold; font-size: 8px; margin-bottom: 2px;">${productoEjemplo.nombre}</div>`;
            posY += 10;
        }
        
        if (mostrarFolio) {
            previewHtml += `<div style="text-align:center; font-size: 6px;">FOLIO: ${productoEjemplo.folio}</div>`;
            posY += 8;
        }
        
        if (mostrarReferencia) {
            previewHtml += `<div style="text-align:center; font-size: 6px;">REF: ${productoEjemplo.referencia}</div>`;
            posY += 8;
        }
        
        if (mostrarPrecio) {
            previewHtml += `<div style="text-align:center; font-weight:bold; font-size: 10px; color: #2c3e50;">$${productoEjemplo.precio}</div>`;
            posY += 12;
        }
        
        // Simular código de barras
        const alturaBarraPx = alturaCodigo * 20;
        previewHtml += `
            <div style="position: absolute; bottom: ${mostrarNumeroCodigo ? 15 : 5}px; left: 10%; width: 80%;">
                <div style="background: repeating-linear-gradient(90deg, #000, #000 2px, #fff 2px, #fff 4px); height: ${alturaBarraPx}px;"></div>
        `;
        
        if (mostrarNumeroCodigo) {
            previewHtml += `<div style="text-align:center; font-size: ${fuenteNumero}px; margin-top: 2px;">${productoEjemplo.folio}</div>`;
        }
        
        previewHtml += `</div>`;
        previewHtml += `</div>`;
        
        previewDiv.innerHTML = previewHtml;
    }
    
    // Manejar envío del formulario
    document.getElementById('formConfigurarImpresion').addEventListener('submit', function(e) {
        // Los productos ya deberían estar seleccionados
        const productosSeleccionados = [];
        document.querySelectorAll('input[name="productos"]:checked').forEach(cb => {
            productosSeleccionados.push(cb.value);
        });
        
        if (productosSeleccionados.length === 0) {
            e.preventDefault();
            Swal.fire({
                icon: 'warning',
                title: 'Sin selección',
                text: 'Selecciona al menos un producto para imprimir'
            });
            return;
        }
        
        document.getElementById('productos_para_imprimir').value = JSON.stringify(productosSeleccionados);
    });
    
    // Botón para abrir modal de configuración
    const btnImprimirOriginal = document.getElementById('btn-imprimir');
    if (btnImprimirOriginal) {
        btnImprimirOriginal.addEventListener('click', function(e) {
            e.preventDefault();
            // Recoger productos seleccionados
            const productosSeleccionados = [];
            document.querySelectorAll('input[name="productos"]:checked').forEach(cb => {
                productosSeleccionados.push(cb.value);
            });
            
            if (productosSeleccionados.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Sin selección',
                    text: 'Selecciona al menos un producto para imprimir'
                });
                return;
            }
            
            // Mostrar modal de configuración
            const modal = new bootstrap.Modal(document.getElementById('modalConfigurarImpresion'));
            modal.show();
            
            // Actualizar vista previa con el primer producto seleccionado
            actualizarVistaPrevia();
        });
    }
});
