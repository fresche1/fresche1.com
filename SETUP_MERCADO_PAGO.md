# 🛍️ Setup Mercado Pago - Guía de Configuración

## Resumen de los cambios implementados

Se ha implementado un nuevo flujo de pago para Mercado Pago que incluye:

1. ✅ **Captura de datos del cliente**: Nombre y correo antes de redirigir a pago
2. ✅ **Envío de email de confirmación**: Vía Resend API con resumen del pedido
3. ✅ **Integración con servidor**: Endpoint `/api/send-email` en el backend

## Qué necesitas configurar

### 1️⃣ Resend API Key

Resend es el servicio que envía emails de confirmación. Necesitas:

1. Ir a [resend.com](https://resend.com)
2. Crear una cuenta (o iniciar sesión)
3. Generar una **API Key** en el panel de control
4. Copiar la clave (empieza con `re_`)

Luego, actualizar la variable en `server/.env`:

```env
RESEND_API_KEY=re_tu_clave_aqui
```

### 2️⃣ Link Personalizado de Mercado Pago

La aplicación necesita tu link de pago personal de Mercado Pago. Tienes dos opciones:

#### **Opción A: Link de Cobrador de Mercado Pago** (Recomendado)
Si tienes un link de cobrador en MP:
- URL: `https://www.mercadopago.com.co/checkout/V2/Redirect/preference/YOUR_ID`

#### **Opción B: Link de Tienda/Catálogo**
Si tienes una tienda personal en MP:
- URL: `https://www.mercadopago.com.co/sellers/...`

### 3️⃣ Configurar el Link en el Código

Una vez tengas el link de MP, busca en `index.html` la línea con:

```javascript
const MERCADOPAGO_PAYMENT_LINK = 'https://www.mercadopago.com.co/';
```

Y reemplázala con tu link:

```javascript
const MERCADOPAGO_PAYMENT_LINK = 'https://tu-link-personal-mp.com/';
```

**Busca exactamente esta línea** (alrededor de **línea 2430**):
```javascript
// ⚠️ IMPORTANTE: Reemplaza este URL con tu link personalizado de Mercado Pago
const MERCADOPAGO_PAYMENT_LINK = 'https://www.mercadopago.com.co/';
```

## 🔄 Flujo de Pago Completo

1. **Cliente elige "💳 Comprar en Línea"**
   - Se abre modal con opciones de pago

2. **Cliente selecciona "Mercado Pago"**
   - Debe ingresar: Nombre y Email

3. **Cliente hace click en "Continuar"**
   - Se envía email de confirmación vía Resend (con resumen del pedido)
   - Se abre enlace de pago de Mercado Pago en nueva pestaña
   - Se cierra el modal de carrito

4. **Cliente completa pago en MP**
   - Mercado Pago maneja el pago de forma segura

## 📧 Email de Confirmación

El email incluye:
- ✓ Nombre del cliente
- ✓ Resumen de productos ordenados
- ✓ Total de la compra
- ✓ Instrucciones de pago
- ✓ Teléfono de soporte (WhatsApp)

## 🧪 Testing

Para probar el sistema:

1. **Abre el sitio web**
2. **Agrega productos al carrito**
3. **Abre el carrito** (botón con 🛒)
4. **Haz click en "💳 Comprar en Línea"**
5. **Selecciona "Mercado Pago"**
6. **Ingresa tu nombre y email de prueba**
7. **Haz click en "Continuar"**

Deberías recibir un email con la confirmación.

## ⚠️ Problemas Comunes

### "Email no configurado"
**Problema**: El formulario muestra un mensaje de alerta
**Solución**: Verifica que:
- [ ] `RESEND_API_KEY` esté en `server/.env`
- [ ] El servidor se reinició después de cambiar `.env`
- [ ] La API key sea correcta (empieza con `re_`)

### "Mercado Pago payment link not configured"
**Problema**: Se abre la página de MP general en lugar de tu link
**Solución**: Actualiza el link en HTML:
```javascript
const MERCADOPAGO_PAYMENT_LINK = 'tu-link-aqui';
```

### "El email no llega"
**Problema**: Email no recibido
**Solución**:
1. Verifica el email ingresado (correo válido)
2. Revisa spam/correos no deseados
3. Comprueba logs del servidor (si está en depuración)
4. En Resend tienes plan gratuito limitado: solo 100 emails/día

## 📝 Archivos Modificados

- `index.html` - Nuevo formulario con captura de datos, función de envío de email
- `server/server.js` - Nuevo endpoint `/api/send-email`
- `server/.env` - Nueva variable `RESEND_API_KEY`

## 🚀 Despliegue

Cuando despliegues en producción (Render, Vercel, etc.):

1. **Agregar variables de entorno** en la plataforma:
   - `RESEND_API_KEY`
   - `ALLOWED_ORIGINS` (actualiza con tu dominio)

2. **Actualizar `index.html`** con:
   - Tu link personal de Mercado Pago
   - Email correcto para confirmaciones (si aplica)

## 💡 Próximos Pasos

- [ ] Obtener y configurar Resend API Key
- [ ] Obtener link personalizado de Mercado Pago
- [ ] Actualizar link en `index.html`
- [ ] Probar flujo completo
- [ ] Desplegar en producción

## 📞 Soporte

Si tienes preguntas sobre:
- **Resend**: [docs.resend.com](https://docs.resend.com)
- **Mercado Pago**: [mercadopago.com.co/developers](https://www.mercadopago.com.co/developers)
- **Este código**: Revisa los comentarios en `index.html` alrededor de la función `enviarConfirmacionMercadoPago()`

---

**Última actualización**: Commit 7496dca
**Estado**: ✅ Código listo - Esperando configuración de usuario
