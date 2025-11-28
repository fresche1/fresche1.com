# 🔧 Configuración de Stripe para FRESCHE

## ✅ ¿Qué se ha implementado?

Tu página ahora tiene:

1. **Detección automática de país** - Identifica si el cliente está en Colombia, USA u otro país
2. **Precios dinámicos**:
   - 🇨🇴 Colombia: **$25,000 COP** por producto
   - 🇺🇸 USA/Internacional: **$12 USD** por producto
3. **Carrito inteligente** - Muestra precios en la moneda correcta según la región
4. **Stripe Checkout preparado** - Listo para pagos con tarjeta, Apple Pay, Google Pay
5. **WhatsApp como backup** - Los clientes pueden ordenar por WhatsApp con precios incluidos

---

## 🚀 Próximos Pasos para Activar Pagos con Tarjeta

### Paso 1: Crear Cuenta en Stripe (5 minutos)

1. Ve a [https://stripe.com](https://stripe.com)
2. Haz clic en **"Empezar ahora"** o **"Sign up"**
3. Ingresa tu email, contraseña y datos básicos
4. Selecciona **Colombia** como país de tu negocio
5. Verifica tu email

### Paso 2: Obtener tus Claves API (2 minutos)

1. Inicia sesión en [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. En el menú izquierdo, busca **"Developers"** → **"API keys"**
3. Verás dos claves:
   - **Publishable key** (comienza con `pk_test_...`) ← Esta va en tu página web
   - **Secret key** (comienza con `sk_test_...`) ← Esta va en tu servidor (NO la compartas)

4. **Copia la Publishable key** (pk_test_...)

### Paso 3: Agregar tu Clave a la Página

Abre el archivo `index.html` y busca esta línea (aproximadamente línea 1275):

```javascript
const stripe = Stripe('pk_test_51YOUR_STRIPE_KEY_HERE'); // TODO: Replace with actual key
```

**Reemplázala con:**

```javascript
const stripe = Stripe('pk_test_TU_CLAVE_AQUI'); // Pega tu publishable key
```

### Paso 4: Activar Cuenta de Stripe (10 minutos)

Para recibir pagos reales, Stripe necesita verificar tu negocio:

1. En el Dashboard de Stripe, completa:
   - ✅ Información del negocio (nombre, dirección, RUT/NIT)
   - ✅ Datos bancarios para recibir transferencias
   - ✅ Documentos de identidad (cédula/pasaporte)

2. Una vez aprobado, cambia de **"Test mode"** a **"Live mode"**
3. Obtén las claves **LIVE** (empiezan con `pk_live_...` y `sk_live_...`)
4. Reemplaza la clave de prueba por la clave live en tu página

---

## 💰 Costos y Comisiones

### Stripe Colombia:
- **3.95% + $900 COP** por transacción exitosa
- Sin tarifas mensuales
- Transferencias a tu cuenta bancaria cada 7 días

### Stripe USA:
- **2.9% + $0.30 USD** por transacción exitosa
- Sin tarifas mensuales
- Transferencias automáticas

### Ejemplo práctico:
- **Venta en Colombia**: Producto $25,000 COP
  - Comisión Stripe: $1,888 COP
  - Tú recibes: **$23,112 COP**

- **Venta en USA**: Producto $12 USD
  - Comisión Stripe: $0.65 USD
  - Tú recibes: **$11.35 USD**

---

## 🎯 Estado Actual de la Implementación

### ✅ Funcionando ahora:
- Detección automática de país
- Precios dinámicos COP/USD
- Carrito de compras con totales
- Pedidos por WhatsApp con precios

### ⏳ Requiere configuración (Paso 3):
- Pagos con tarjeta de crédito/débito
- Apple Pay / Google Pay
- Confirmación automática de pedidos

### 🔮 Futuro (requiere servidor backend):
- Emails de confirmación automáticos
- Panel de administración de pedidos
- Tracking de envíos
- Gestión de inventario

---

## 📱 Cómo Funciona para tus Clientes

### Para clientes en Colombia:
1. Navegan tu página, ven precios en **$25,000 COP**
2. Agregan productos al carrito
3. Hacen checkout con tarjeta → Pagan en **COP**
4. O consultan por WhatsApp (alternativa)

### Para clientes en USA:
1. Navegan tu página, ven precios en **$12 USD**
2. Agregan productos al carrito
3. Hacen checkout con tarjeta → Pagan en **USD**
4. O consultan por WhatsApp (alternativa)

---

## 🛡️ Seguridad

- ✅ Los datos de tarjetas **nunca** tocan tu servidor
- ✅ Stripe maneja todo el procesamiento seguro (PCI compliant)
- ✅ Protección contra fraude incluida
- ✅ 3D Secure automático para transacciones sospechosas

---

## 🆘 Soporte

- **Stripe Support**: [https://support.stripe.com](https://support.stripe.com)
- **Documentación**: [https://stripe.com/docs](https://stripe.com/docs)
- **Chat en vivo** disponible 24/7 en el Dashboard

---

## 📋 Resumen Rápido

```
1. ✅ Código implementado en tu página
2. 🔜 Crear cuenta en stripe.com
3. 🔜 Copiar publishable key a index.html línea ~1275
4. 🔜 Completar verificación del negocio
5. 🔜 Cambiar a modo LIVE
6. 🎉 ¡Listo para recibir pagos!
```

---

**Nota**: Por ahora, el sistema usa WhatsApp como método de pago. Una vez configures Stripe (Pasos 1-4), los pagos con tarjeta funcionarán automáticamente. ✨
