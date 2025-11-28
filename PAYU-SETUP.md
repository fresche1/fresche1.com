# 🇨🇴 Configuración de PayU para FRESCHE

## ¿Por qué PayU?

PayU es la mejor opción para tu negocio porque:

✅ **Soporta Colombia y USA** con COP y USD
✅ **Precios dinámicos** según el país del cliente
✅ **Acepta tarjetas internacionales** de cualquier país
✅ **Métodos locales colombianos**: PSE, Efecty, Baloto, Nequi
✅ **Costos competitivos**: 3.49% + $900 COP
✅ **Sin cuota mensual** - solo pagas cuando vendes
✅ **Integración similar a Stripe** pero con soporte latinoamericano

---

## 💰 Costos de PayU en Colombia

### Tarjetas de Crédito/Débito
- **3.49% + $900 COP** por transacción
- Acepta: Visa, Mastercard, American Express, Diners (nacionales e internacionales)

### PSE (Débito a Cuenta)
- **3.49% + $900 COP** por transacción
- Transferencia directa desde cuenta bancaria

### Efectivo (Efecty, Baloto)
- **3.49% + $900 COP** por transacción
- Cliente paga en efectivo en puntos físicos

### Transferencia a tu cuenta
- **Gratis** - PayU transfiere a tu cuenta bancaria sin costo adicional
- Ciclo: 1-3 días hábiles

---

## 📋 Pasos para Configurar PayU

### 1. Crear Cuenta en PayU

1. Ve a: **https://www.payu.com/co/registrate/**
2. Selecciona **"Persona Natural"** o **"Empresa"**
3. Completa el formulario con:
   - Nombre completo / Razón social
   - Cédula / NIT
   - Email
   - Teléfono
   - Dirección

### 2. Documentos Requeridos

**Persona Natural:**
- ✅ Cédula de Ciudadanía (ambos lados)
- ✅ Certificación bancaria (menos de 30 días)
- ✅ RUT (si aplica)

**Empresa:**
- ✅ Cámara de Comercio (menos de 30 días)
- ✅ RUT
- ✅ Cédula del representante legal
- ✅ Certificación bancaria

### 3. Verificación de Cuenta

1. PayU revisará tus documentos (1-3 días hábiles)
2. Recibirás un email de confirmación
3. Podrás acceder al panel de administración

### 4. Obtener Credenciales API

1. Inicia sesión en: **https://merchants.payulatam.com/**
2. Ve a **Configuración → Configuración técnica**
3. Copia estos datos:
   - **Merchant ID** (ej: 508029)
   - **Account ID** (ej: 512321)
   - **API Key** (ej: 4Vj8eK4rloUd272L48hsrarnUA)

### 5. Configurar en tu Sitio Web

Envíame estos datos y yo configuraré el sistema:

```
Merchant ID: ____________
Account ID: ____________
API Key: ____________
```

⚠️ **IMPORTANTE**: Guarda estas credenciales de forma segura. Nunca las compartas públicamente.

---

## 🔧 Configuración Técnica (Backend Requerido)

### ¿Por qué necesitas un servidor backend?

PayU requiere firmar cada pago con tu **API Key** por seguridad. Esto DEBE hacerse en el servidor, no en el navegador del cliente.

### Opciones de Backend:

#### **Opción 1: Netlify Functions** (GRATIS, Recomendado)
- ✅ Gratis hasta 125,000 requests/mes
- ✅ Fácil de configurar
- ✅ Se integra con GitHub Pages
- ✅ Serverless (no mantienes servidor)

#### **Opción 2: Vercel Functions** (GRATIS)
- ✅ Gratis con límites generosos
- ✅ Similar a Netlify
- ✅ Muy rápido

#### **Opción 3: Node.js + Heroku** (GRATIS tier disponible)
- ✅ Más control
- ❌ Requiere más configuración

---

## 🌍 Configuración Multi-Moneda (COP/USD)

Tu sitio ya está preparado para detectar el país del cliente y mostrar precios en:
- 🇨🇴 **COP** (Pesos Colombianos) para clientes de Colombia
- 🇺🇸 **USD** (Dólares) para clientes de USA y otros países

### Definir Precios:

En `index.html` línea ~485, actualiza:

```javascript
const pricing = {
    CO: { currency: 'COP', price: 45000 },    // $45,000 COP para Colombia
    US: { currency: 'USD', price: 12 },       // $12 USD para USA
    DEFAULT: { currency: 'USD', price: 12 }   // $12 USD para otros países
};
```

### Actualizar Productos:

```javascript
const products = {
    cherry: {
        name: 'CHERRY',
        // ... otros datos
        // Los precios se toman automáticamente del objeto pricing
    },
    // ...
};
```

---

## 🔐 Seguridad

### Certificación PCI DSS
PayU está certificado PCI DSS Level 1 (máximo nivel de seguridad para pagos con tarjeta).

### Datos Sensibles
- ❌ **NUNCA** guardes números de tarjeta en tu código
- ❌ **NUNCA** expongas tu API Key en el frontend
- ✅ Todos los pagos se procesan en servidores seguros de PayU

---

## 📊 Panel de Administración

### Acceder al Panel
https://merchants.payulatam.com/

### Funciones Disponibles:
- 📈 Ver todas las transacciones
- 💵 Consultar saldo disponible
- 🔄 Solicitar transferencias a tu banco
- 📧 Descargar reportes
- ⚙️ Configurar notificaciones

---

## 🧪 Modo de Pruebas

PayU ofrece un ambiente de pruebas ANTES de activar pagos reales:

### Credenciales de Prueba:
```
API Login: pRRXKOl8ikMmt9u
API Key: 4Vj8eK4rloUd272L48hsrarnUA
Merchant ID: 508029
Account ID: 512321
```

### Tarjetas de Prueba:

**VISA Aprobada:**
```
Número: 4097440000000004
CVV: 123
Fecha: 12/25
Nombre: APPROVED
```

**Mastercard Aprobada:**
```
Número: 5254133324245830
CVV: 123
Fecha: 12/25
Nombre: APPROVED
```

**Tarjeta Rechazada:**
```
Número: 4097440000000012
CVV: 123
Fecha: 12/25
Nombre: DECLINED
```

---

## 🚀 Activación (Cuando Tengas Inventario)

### Checklist de Activación:

- [ ] Crear cuenta PayU
- [ ] Verificar identidad con documentos
- [ ] Obtener credenciales API (Merchant ID, Account ID, API Key)
- [ ] Configurar servidor backend (Netlify/Vercel)
- [ ] Probar pagos en modo TEST
- [ ] Definir precios en COP y USD
- [ ] Cambiar a credenciales de PRODUCCIÓN
- [ ] Hacer compra de prueba real
- [ ] ¡Lanzar! 🎉

---

## ❓ Preguntas Frecuentes

### ¿Cuánto tarda en llegar el dinero a mi cuenta?
1-3 días hábiles después de la venta.

### ¿Qué pasa si un cliente hace devolución?
PayU procesa el reembolso y te notifica. El monto se resta de tu siguiente pago.

### ¿Puedo vender a cualquier país?
Sí, PayU acepta tarjetas de todo el mundo. Puedes cobrar en COP o USD.

### ¿Qué banco necesito?
Cualquier banco colombiano. PayU hace transferencias ACH/SPEI a tu cuenta.

### ¿Hay límite de ventas?
No hay límite. Entre más vendas, mejor.

### ¿Funciona con WhatsApp?
Sí, puedes generar links de pago de PayU y enviarlos por WhatsApp.

---

## 📞 Soporte de PayU

- **Email**: comercios@payulatam.com
- **Teléfono Colombia**: 01 8000 127 888
- **WhatsApp**: +57 321 909 3000
- **Chat**: https://www.payu.com/co/soporte/
- **Documentación Técnica**: https://developers.payulatam.com/

---

## 🎯 Próximos Pasos

1. **Crea tu cuenta**: https://www.payu.com/co/registrate/
2. **Obtén tus credenciales** (Merchant ID, Account ID, API Key)
3. **Envíamelas** y yo configuro el backend
4. **Define tus precios** en COP y USD
5. **¡Empieza a vender!** 🚀

---

## 📝 Notas Adicionales

### Ventajas sobre Stripe:
- ✅ Disponible en Colombia (Stripe NO)
- ✅ PSE y pagos en efectivo (Stripe NO)
- ✅ Costos similares
- ✅ Soporte en español
- ✅ Enfoque latinoamericano

### Ventajas sobre Wompi:
- ✅ Soporta USD directamente (Wompi solo COP)
- ✅ Precios dinámicos COP/USD (Wompi NO)
- ✅ Mayor presencia internacional
- ✅ Más opciones de integración

---

**¿Listo para comenzar?** Crea tu cuenta en PayU y envíame tus credenciales. En 30 minutos tendrás todo funcionando. 🚀
