from .models import Notificacion

def notificaciones_context(request):
    if request.user.is_authenticated:
        notificaciones = Notificacion.objects.filter(usuario=request.user, leido=False)
        return {'num_notificaciones': notificaciones.count()}
    return {'num_notificaciones': 0}
