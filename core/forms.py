from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from .models import Usuario, Vendedor, Producto, Categoria, Venta


class RegistroForm(UserCreationForm):
    rol = forms.ChoiceField(choices=Usuario.ROLES, required=True)

    class Meta:
        model = Usuario
        fields = ['username', 'email', 'password1', 'password2', 'rol']
        whitgets = {
            'rol': forms.Select(attrs={'class': 'form-select'}),
        }

    def clean_password2(self):
        password1 = self.cleaned_data.get('password1')
        password2 = self.cleaned_data.get('password2')
        if password1 != password2:
            raise forms.ValidationError("Las contraseñas no coinciden.")
        return password2

class LoginForm(AuthenticationForm):
    pass


class VendedorForm(forms.ModelForm):
    class Meta:
        model = Vendedor
        fields = ['nombre', 'direccion', 'telefono']
        widgets = {
            'nombre': forms.TextInput(attrs={'class': 'form-control'}),
            'direccion': forms.TextInput(attrs={'class': 'form-control'}),
            'telefono': forms.TextInput(attrs={'class': 'form-control'}),
        }


class ProductoForm(forms.ModelForm):
    class Meta:
        model = Producto
        fields = ['no_folio','nombre', 'descripcion', 'categoria', 'precio', 'stock']
        widgets = {
            'no_folio': forms.TextInput(attrs={'class': 'form-control'}),
            'nombre': forms.TextInput(attrs={'class': 'form-control'}),
            'categoria': forms.Select(attrs={'class': 'form-select'}),
            'descripcion': forms.TextInput(attrs={'class': 'form-control'}),
            'precio': forms.NumberInput(attrs={'class': 'form-control'}),
            'stock': forms.NumberInput(attrs={'class': 'form-control',}),
        }

class CategoriaForm(forms.ModelForm):
    class Meta:
        model = Categoria
        fields = ['nombre']
        widgets = {
            'nombre': forms.TextInput(attrs={'class': 'form-control'}),
        }

class RegistroVentasForm(forms.ModelForm):
    class Meta:
        model = Venta
        fields = ['tipo_cliente', 'vendedor']
        widgets = {
            'tipo_cliente': forms.Select(attrs={
                'class': 'form-select'
            }),
            'vendedor': forms.Select(attrs={
                'class': 'form-select'
            }),
        }