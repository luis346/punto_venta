
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