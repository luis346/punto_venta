from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from .models import Usuario, Vendedor, Producto, Categoria, Venta, Stock, Sucursal

class UsuarioSucursalForm(forms.ModelForm):
    class Meta:
        model = Usuario
        fields = ['sucursales']
        widgets = {
            'sucursales': forms.Select(attrs={'class': 'form-select'})
        }

class SucursalForm(forms.ModelForm):
    class Meta:
        model = Sucursal
        fields = ['nombre', 'direccion', 'activa']
        widgets = {
            'nombre': forms.TextInput(attrs={'class': 'form-control'}),
            'direccion': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 2
            }),
            'activa': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }

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
        fields = ['no_folio','nombre', 'descripcion', 'categoria', 'precio', 'precio_mayoreo', 'unidad_medida']
        widgets = {
            'no_folio': forms.TextInput(attrs={'class': 'form-control'}),
            'nombre': forms.TextInput(attrs={'class': 'form-control'}),
            'categoria': forms.Select(attrs={'class': 'form-select'}),
            'descripcion': forms.TextInput(attrs={'class': 'form-control'}),
            'precio': forms.NumberInput(attrs={'class': 'form-control'}),
            'precio_mayoreo':forms.NumberInput(attrs={'class': 'form-control'}),
            'unidad_medida': forms.Select(attrs={'class': 'form-select'}),
        }

class StockForm(forms.ModelForm):
    class Meta:
        model = Stock
        fields = [
            'producto',
            'sucursal',
            'stock_fisico',
            'stock_virtual',
        ]

        
    def clean_no_folio(self):
        no_folio = self.cleaned_data['no_folio']
        qs = Producto.objects.filter(no_folio=no_folio)
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError("Este folio ya está registrado.")
        return no_folio

    def clean_precio(self):
        precio = self.cleaned_data['precio']
        if precio <= 0:
            raise forms.ValidationError("El precio debe ser mayor que cero.")
        return precio
    
    def clean_stock_virtual(self):
        stock = self.cleaned_data['stock_virtual']
        if stock < 0:
            raise forms.ValidationError("El stock virtual no puede ser negativo.")
        return stock

    def clean_stock_fisico(self):
        stock = self.cleaned_data['stock_fisico']
        if stock < 0:
            raise forms.ValidationError("El stock físico no puede ser negativo.")
        return stock

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