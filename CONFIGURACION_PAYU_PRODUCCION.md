# Configuración PayU Producción - FRESCHE

## 🚀 Pasos para Activar Pagos Reales

### 1. Obtener Credenciales de Producción

Para activar los pagos reales, necesitas obtener tus credenciales de producción de PayU:

1. Ve a [https://www.payulatam.com](https://www.payulatam.com)
2. Crea una cuenta comercial o inicia sesión
3. Completa el proceso de verificación (puede tomar 2-5 días hábiles)
4. Una vez aprobado, ve a **"Configuración Técnica"** en tu panel
5. Anota tus credenciales:
   - **Merchant ID** (ID del comercio)
   - **Account ID** (ID de la cuenta)
   - **API Key** (Llave de integración)

### 2. Actualizar checkout.html

Abre el archivo `checkout.html` y busca la función `createPayUForm`, específicamente estas líneas:

```javascript
// PayU Production Credentials - CAMBIAR POR TUS CREDENCIALES REALES
const merchantId = '508029'; // Reemplazar con tu merchantId real
const accountId = '512321'; // Reemplazar con tu accountId real
const apiKey = '4Vj8eK4rloUd272L48hsrarnUA'; // Reemplazar con tu apiKey real
```

**Reemplaza estos valores con tus credenciales reales:**

```javascript
const merchantId = 'TU_MERCHANT_ID_REAL';
const accountId = 'TU_ACCOUNT_ID_REAL';
const apiKey = 'TU_API_KEY_REAL';
```

### 3. Verificar URL de Producción

Asegúrate de que la URL del formulario sea la de producción:

```javascript
form.action = 'https://checkout.payulatam.com/ppp-web-gateway-payu/';
```

### 4. Verificar Modo de Producción

Confirma que el parámetro `test` esté en `'0'`:

```javascript
test: '0', // 0 = Modo producción, 1 = Modo prueba
```

### 5. Configurar URLs de Respuesta

Actualiza las URLs de respuesta y confirmación con tu dominio real:

```javascript
responseUrl: 'https://tudominio.com/payment-response.html',
confirmationUrl: 'https://tudominio.com/payment-confirmation.html'
```

## 📋 Tarifas de Envío Configuradas

### Nacional (Colombia) 🇨🇴
- **Estándar**: $15,000 COP (5-7 días hábiles)
- **Express**: $25,000 COP (2-3 días hábiles)
- **Prioritario**: $35,000 COP (1 día hábil)

### Internacional 🌎

#### América del Norte
- **Estados Unidos 🇺🇸**
  - Estándar: $45,000 COP (10-15 días)
  - Express: $85,000 COP (5-7 días)
  - Prioritario: $120,000 COP (3-5 días)

- **Canadá 🇨🇦**
  - Estándar: $48,000 COP (10-15 días)
  - Express: $90,000 COP (5-7 días)

- **México 🇲🇽**
  - Estándar: $35,000 COP (8-12 días)
  - Express: $65,000 COP (4-6 días)

#### América del Sur
- **Argentina 🇦🇷 / Chile 🇨🇱**
  - Estándar: $40,000 COP (10-15 días)
  - Express: $75,000 COP (5-7 días)

- **Perú 🇵🇪 / Ecuador 🇪🇨**
  - Estándar: $35,000 COP (8-12 días)
  - Express: $65,000 COP (4-6 días)

- **Brasil 🇧🇷**
  - Estándar: $55,000 COP (12-18 días)
  - Express: $95,000 COP (6-8 días)

#### Europa
- **España 🇪🇸**
  - Estándar: $55,000 COP (12-18 días)
  - Express: $95,000 COP (6-8 días)

#### Otros Países 🌐
- **Estándar**: $65,000 COP (15-25 días)
- **Express**: $110,000 COP (7-10 días)

## ⚠️ Importante Antes de Producción

### Pruebas Requeridas
1. ✅ Probar checkout con cada método de envío
2. ✅ Verificar cálculos de precios
3. ✅ Probar con diferentes países
4. ✅ Verificar emails de confirmación
5. ✅ Probar page de respuesta de pago

### Documentos Legales
- [ ] Términos y Condiciones actualizados
- [ ] Política de Envíos y Devoluciones
- [ ] Política de Privacidad
- [ ] Información de contacto de soporte

### Configuración del Servidor
- [ ] Certificado SSL activo (HTTPS)
- [ ] URLs de confirmación configuradas en PayU
- [ ] Webhook de confirmación implementado (opcional pero recomendado)

## 🔐 Seguridad

### Proteger API Key
⚠️ **NUNCA** expongas tu API Key en repositorios públicos:
- Si usas Git, considera mover las credenciales a variables de entorno
- Usa un archivo de configuración separado que no se suba al repositorio
- Agrega `config.js` o similar a `.gitignore`

### Ejemplo con Variables de Entorno (Recomendado)

Crea un archivo `config.js`:
```javascript
const PAYU_CONFIG = {
    merchantId: 'TU_MERCHANT_ID',
    accountId: 'TU_ACCOUNT_ID',
    apiKey: 'TU_API_KEY'
};
```

Y agrégalo a `.gitignore`:
```
config.js
*.env
```

## 📞 Soporte PayU

- **Teléfono Colombia**: +57 (1) 654-0721
- **Email**: soporte@payulatam.com
- **Documentación**: https://developers.payulatam.com

## ✅ Checklist Final

Antes de lanzar a producción:

- [ ] Credenciales de producción configuradas
- [ ] URL de producción activa
- [ ] Modo test = '0'
- [ ] URLs de respuesta actualizadas
- [ ] Certificado SSL instalado
- [ ] Pruebas de pago completadas
- [ ] Políticas legales publicadas
- [ ] Email de confirmación configurado
- [ ] Sistema de seguimiento de pedidos listo
- [ ] Soporte al cliente disponible

## 🎉 ¡Listo para Vender!

Una vez completados todos los pasos, tu tienda estará lista para recibir pagos reales y enviar productos a nivel nacional e internacional.
