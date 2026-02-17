from .models import Notificacion, Sucursal

def notificaciones_context(request):
    if request.user.is_authenticated:
        notificaciones = Notificacion.objects.filter(usuario=request.user, leido=False)
        return {'num_notificaciones': notificaciones.count()}
    return {'num_notificaciones': 0}

def sucursal_context(request):
    sucursal_actual = None
    sucursales_usuario = []

    if request.user.is_authenticated:

        # ADMIN
        if request.user.rol == 'ADMIN':
            sucursal_id = request.session.get('sucursal_id')

            if sucursal_id:
                sucursal_actual = Sucursal.objects.filter(
                    id=sucursal_id,
                    activa=True
                ).first()

            # ADMIN puede ver TODAS las sucursales activas
            sucursales_usuario = Sucursal.objects.filter(activa=True)

        # CAJA
        elif request.user.rol == 'CAJA' and request.user.sucursal:
            sucursal_actual = request.user.sucursal
            sucursales_usuario = [request.user.sucursal]

    return {
        'sucursal_actual': sucursal_actual,
        'sucursales_usuario': sucursales_usuario
    }


