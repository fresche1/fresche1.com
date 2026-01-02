# 🚀 Configuración Mercado Pago - FRESCHE

## ✅ Sistema Actualizado

Se ha reemplazado **PayU** por **Mercado Pago** como pasarela de pagos.

## 📋 Paso 1: Crear Cuenta Mercado Pago

### Para Colombia:
**https://www.mercadopago.com.co/hub/registration/landing**

### Para otros países:
- 🇦🇷 Argentina: https://www.mercadopago.com.ar
- 🇧🇷 Brasil: https://www.mercadopago.com.br
- 🇨🇱 Chile: https://www.mercadopago.cl
- 🇲🇽 México: https://www.mercadopago.com.mx
- 🇺🇾 Uruguay: https://www.mercadopago.com.uy
- 🇵🇪 Perú: https://www.mercadopago.com.pe

## 🔑 Paso 2: Obtener Credenciales

1. **Inicia sesión** en tu cuenta de Mercado Pago
2. Ve a **"Tu negocio" → "Configuración" → "Credenciales"**
3. O accede directamente: https://www.mercadopago.com.co/developers/panel/credentials

### Tipos de Credenciales:

#### 🧪 Modo Prueba (para testing)
- **Public Key**: TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
- **Access Token**: TEST-xxxxxxxxxxxx-xxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx

#### 🔐 Modo Producción (para pagos reales)
- **Public Key**: APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
- **Access Token**: APP_USR-xxxxxxxxxxxx-xxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx

## ⚙️ Paso 3: Configurar Backend

**IMPORTANTE:** Por seguridad, Mercado Pago requiere crear las preferencias de pago desde el servidor, NO desde el navegador.

### Opción A: Backend con Node.js/Express

#### 1. Instalar SDK:
```bash
npm install mercadopago
```

#### 2. Crear endpoint (server.js):
```javascript
const express = require('express');
const mercadopago = require('mercadopago');
const app = express();

// Configurar Mercado Pago
mercadopago.configure({
    access_token: 'TU_ACCESS_TOKEN_AQUI'
});

app.use(express.json());

// Endpoint para crear preferencia
app.post('/api/create-preference', async (req, res) => {
    try {
        const { items, payer, back_urls, external_reference } = req.body.preference;
        
        const preference = {
            items: items,
            payer: payer,
            back_urls: back_urls,
            auto_return: 'approved',
            external_reference: external_reference,
            statement_descriptor: 'FRESCHE',
            notification_url: 'https://tudominio.com/mercadopago-webhook'
        };

        const response = await mercadopago.preferences.create(preference);
        res.json({ init_point: response.body.init_point, id: response.body.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear preferencia' });
    }
});

app.listen(3000, () => console.log('Servidor en puerto 3000'));
```

#### 3. Actualizar checkout.html:
```javascript
// Reemplazar la función createMercadoPagoCheckout con:
async function createMercadoPagoCheckout(formData, total, subtotal) {
    try {
        // Preparar items
        const items = cart.map(item => {
            const prices = item.type === 'pack' 
                ? getPricePerUnit(1, 'pack') 
                : getPricePerUnit(item.quantity, 'product');
            return {
                title: item.type === 'pack' 
                    ? `${item.name} (${item.products.map(p => p.id).join(', ')})` 
                    : item.name,
                quantity: item.quantity,
                unit_price: prices[currentCurrency],
                currency_id: currentCurrency
            };
        });

        // Agregar envío
        items.push({
            title: 'Envío',
            quantity: 1,
            unit_price: shippingCost,
            currency_id: currentCurrency
        });

        // Llamar al backend
        const response = await fetch('https://tudominio.com/api/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                preference: {
                    items: items,
                    payer: {
                        name: formData.fullName,
                        email: formData.email,
                        phone: { number: formData.phone }
                    },
                    back_urls: {
                        success: window.location.origin + '/payment-response.html?status=success',
                        failure: window.location.origin + '/payment-response.html?status=failure',
                        pending: window.location.origin + '/payment-response.html?status=pending'
                    },
                    external_reference: 'FRESCHE-' + Date.now()
                },
                formData
            })
        });

        const data = await response.json();
        
        // Redirigir al checkout de Mercado Pago
        window.location.href = data.init_point;
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al procesar el pago. Inténtalo nuevamente.');
    }
}
```

### Opción B: Backend con PHP

```php
<?php
require_once 'vendor/autoload.php';

MercadoPago\SDK::setAccessToken("TU_ACCESS_TOKEN");

$preference = new MercadoPago\Preference();

// Items del carrito
$item = new MercadoPago\Item();
$item->title = 'Producto FRESCHE';
$item->quantity = 1;
$item->unit_price = 29900;
$preference->items = array($item);

// URLs de retorno
$preference->back_urls = array(
    "success" => "https://tudominio.com/payment-response.html?status=success",
    "failure" => "https://tudominio.com/payment-response.html?status=failure",
    "pending" => "https://tudominio.com/payment-response.html?status=pending"
);

$preference->auto_return = "approved";
$preference->save();

echo json_encode(['init_point' => $preference->init_point]);
?>
```

### Opción C: Plataformas sin código

Si no tienes servidor, puedes usar:
- **Vercel**: Para desplegar funciones serverless
- **Netlify Functions**: Para crear endpoints
- **Railway**: Hosting con backend incluido
- **Heroku**: Para aplicaciones completas

## 🔔 Paso 4: Configurar Webhooks (Opcional pero Recomendado)

Los webhooks te notifican cuando hay cambios en el estado del pago.

1. Ve a **Configuración → Webhooks** en tu panel de Mercado Pago
2. Agrega tu URL: `https://tudominio.com/mercadopago-webhook`
3. Selecciona eventos: `payment`, `merchant_order`

### Ejemplo de Webhook (Node.js):
```javascript
app.post('/mercadopago-webhook', async (req, res) => {
    const { type, data } = req.body;

    if (type === 'payment') {
        const paymentId = data.id;
        // Consultar el pago
        const payment = await mercadopago.payment.findById(paymentId);
        
        // Actualizar estado en tu base de datos
        console.log('Pago actualizado:', payment.body);
    }

    res.sendStatus(200);
});
```

## 💳 Métodos de Pago Disponibles

Mercado Pago acepta:
- ✅ **Tarjetas de crédito/débito** (Visa, Mastercard, Amex)
- ✅ **PSE** (Colombia)
- ✅ **Efecty** (Colombia)
- ✅ **Transferencia bancaria**
- ✅ **Pago en efectivo** (puntos de pago)
- ✅ **Mercado Pago Wallet**

## 🧪 Tarjetas de Prueba

Para probar en modo test:

### Colombia:
- **Mastercard Aprobada**: 5474 9254 3267 0366
- **Visa Aprobada**: 4013 5406 8274 6260
- **CVV**: 123
- **Fecha**: Cualquier fecha futura
- **Nombre**: APRO (para aprobar)

**Más tarjetas de prueba**: https://www.mercadopago.com.co/developers/es/docs/shopify/additional-content/your-integrations/test/cards

## 📊 Ventajas de Mercado Pago

✅ Líder en América Latina  
✅ Múltiples métodos de pago  
✅ Protección al comprador y vendedor  
✅ Dashboard completo  
✅ API bien documentada  
✅ SDKs en varios lenguajes  
✅ Menor comisión que competidores  
✅ Pagos en cuotas sin interés  

## 💰 Comisiones

**Colombia:**
- Tarjetas nacionales: ~3.99% + IVA
- Tarjetas internacionales: ~4.99% + IVA
- PSE: 2.49% + IVA

*Comisiones pueden variar, revisa tu cuenta*

## 📞 Soporte

- **Email**: developers@mercadopago.com
- **Documentación**: https://www.mercadopago.com.co/developers
- **Foro**: https://www.mercadopago.com.co/developers/es/support

## 🔐 Seguridad

### Mejores Prácticas:
1. ✅ Nunca expongas tu Access Token en el frontend
2. ✅ Usa HTTPS siempre
3. ✅ Valida webhooks con la firma
4. ✅ Usa modo prueba hasta estar seguro
5. ✅ Implementa rate limiting en tu API

## ✅ Checklist de Implementación

- [ ] Cuenta Mercado Pago creada y verificada
- [ ] Credenciales obtenidas (prueba y producción)
- [ ] Backend configurado para crear preferencias
- [ ] Endpoint de creación de preferencias funcionando
- [ ] checkout.html actualizado con llamada al backend
- [ ] Webhooks configurados
- [ ] Pruebas con tarjetas de prueba completadas
- [ ] URLs de retorno configuradas correctamente
- [ ] Certificado SSL activo (HTTPS)
- [ ] Cambio a credenciales de producción

## 🎉 ¡Listo!

Una vez completados todos los pasos, tu tienda FRESCHE estará procesando pagos reales con Mercado Pago.

---

**Última actualización:** 2 de Enero, 2026  
**Versión:** 1.0 - Mercado Pago Integration
