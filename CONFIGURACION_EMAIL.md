# 📧 Configuración del Sistema de Emails

## ✅ Implementado

El sistema ahora envía automáticamente un email a **fresche@fresche1.com** con todos los datos del pedido cuando un cliente hace una compra con MercadoPago.

## 🔧 Configuración Requerida

Para que funcione, necesitas configurar las credenciales SMTP en el servidor Render.

### Opción 1: Usar Gmail (Recomendado)

1. **Crea una contraseña de aplicación de Gmail:**
   - Ve a https://myaccount.google.com/apppasswords
   - Inicia sesión con la cuenta de Gmail que quieres usar para enviar emails
   - En "Seleccionar app", elige "Correo"
   - En "Seleccionar dispositivo", elige "Otro" y escribe "Fresche Backend"
   - Haz clic en "Generar"
   - Copia la contraseña de 16 caracteres que aparece

2. **Configura las variables en Render:**
   - Ve a tu dashboard de Render: https://dashboard.render.com
   - Selecciona tu servicio "fresche1-com"
   - Ve a "Environment" en el menú lateral
   - Añade estas nuevas variables:
     ```
     SMTP_HOST = smtp.gmail.com
     SMTP_PORT = 587
     SMTP_USER = tu-email@gmail.com
     SMTP_PASS = la-contraseña-de-16-caracteres
     ```
   - Haz clic en "Save Changes"
   - El servicio se reiniciará automáticamente

### Opción 2: Usar otro proveedor SMTP

Si tienes un servicio de correo corporativo (Office 365, cPanel, etc.):

```
SMTP_HOST = smtp.tu-proveedor.com
SMTP_PORT = 587
SMTP_USER = fresche@fresche1.com
SMTP_PASS = tu-contraseña
```

## 📬 Qué recibirás por email

Cada vez que un cliente complete un pago, recibirás un email con:

### Información del Cliente
- Nombre completo
- Email
- Teléfono

### Dirección de Envío
- Dirección completa
- Ciudad
- Departamento
- Código postal
- Método de envío

### Productos Ordenados
- Lista de productos con cantidades y precios

### Totales
- Subtotal
- Costo de envío
- Total
- Moneda (COP/USD)

### Información Técnica
- ID de preferencia de MercadoPago
- Fecha y hora del pedido

## 🚀 Próximos Pasos

1. **Instalar dependencias en el servidor:**
   ```bash
   cd server
   npm install
   ```

2. **Configurar variables en Render** (como se explicó arriba)

3. **Hacer commit y push de los cambios:**
   ```bash
   git add .
   git commit -m "Implementar sistema de emails para pedidos"
   git push
   ```

4. **Render detectará el cambio automáticamente** y se volverá a desplegar

5. **Hacer una compra de prueba** para verificar que llegue el email

## ⚠️ Notas Importantes

- Los emails solo se envían cuando se crea la preferencia de pago (antes de que el cliente pague)
- Esto te permite saber qué pedidos están en proceso
- El cliente puede no completar el pago, así que verifica el estado en MercadoPago
- Si no configuras las credenciales SMTP, el sistema seguirá funcionando pero no enviará emails
- Los emails se envían en formato HTML con emojis para mejor visualización

## 🔍 Verificación

Para verificar que todo funciona:

1. Revisa los logs en Render después del despliegue
2. Deberías ver: "✅ Mercado Pago backend escuchando en puerto 3001"
3. Haz una compra de prueba
4. Revisa tu bandeja de entrada en fresche@fresche1.com
5. Deberías recibir un email con el asunto "Nuevo Pedido - [Nombre del Cliente]"

## 🆘 Solución de Problemas

**No llegan los emails:**
- Verifica que las credenciales SMTP estén correctas en Render
- Revisa la carpeta de SPAM en fresche@fresche1.com
- Mira los logs en Render para ver mensajes de error

**Error de autenticación:**
- Asegúrate de usar una "Contraseña de Aplicación" de Gmail, no tu contraseña normal
- Si usas otro proveedor, verifica que SMTP esté habilitado

**Emails se envían pero llegan vacíos:**
- Verifica que checkout.html esté enviando orderData correctamente
- Revisa los logs del servidor para errores
