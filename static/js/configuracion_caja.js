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