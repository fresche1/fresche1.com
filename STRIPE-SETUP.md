# 🔧 Configuración de Stripe para FRESCHE

## 💰 **COSTOS DE STRIPE (Actualizado 2025)**

### 📍 **Stripe Colombia:**
- **Tarifa por transacción**: 3.95% + $900 COP
- **Sin costos mensuales ni de configuración**
- **Transferencias a tu cuenta**: Cada 7 días automático
- **Tiempo de depósito**: 2-3 días hábiles

**Ejemplo práctico:**
```
Venta: $25,000 COP
Comisión Stripe: $1,888 COP (3.95% + $900)
TÚ RECIBES: $23,112 COP ✅
```

### 🇺🇸 **Stripe USA:**
- **Tarifa por transacción**: 2.9% + $0.30 USD
- **Sin costos mensuales**
- **Transferencias automáticas**

**Ejemplo práctico:**
```
Venta: $12.00 USD
Comisión Stripe: $0.65 USD (2.9% + $0.30)
TÚ RECIBES: $11.35 USD ✅
```

### 💳 **Métodos de Pago Incluidos:**
✅ Tarjetas de Crédito (Visa, Mastercard, Amex)
✅ Tarjetas de Débito
✅ Apple Pay
✅ Google Pay
✅ PSE (Colombia)
✅ Efecty (Colombia)
✅ Baloto (Colombia)

---

## 🚀 **PASOS PARA CONFIGURAR TUS PAGOS**

### **Paso 1: Crear Cuenta Stripe (5 minutos)**

1. **Ir a**: [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)

2. **Registrarte con**:
   - Email (usa uno que revises frecuentemente)
   - Contraseña segura
   - Nombre de tu negocio: **"FRESCHE"** o **"FRESCHE Colombia"**

3. **Seleccionar país**: Colombia 🇨🇴

4. **Verificar email**: Revisa tu correo y haz clic en el enlace

---

### **Paso 2: Completar Información del Negocio (10 minutos)**

Stripe necesita esta información para transferir el dinero a tu cuenta:

#### **📋 Datos Requeridos:**

1. **Información Personal**:
   - Nombre completo (como aparece en tu cédula)
   - Cédula de Ciudadanía
   - Fecha de nacimiento
   - Dirección completa

2. **Información del Negocio**:
   - Nombre legal del negocio
   - NIT o RUT (si tienes)
   - Tipo de productos: "Cuidado Personal / Cosmética"
   - Sitio web: `https://fresche1.github.io/fresche1.com`

3. **Cuenta Bancaria** (MUY IMPORTANTE):
   - Banco (ej: Bancolombia, Davivienda, etc.)
   - Tipo de cuenta: Ahorros o Corriente
   - Número de cuenta
   - Nombre del titular (debe coincidir con tu identificación)

4. **Documentos** (para verificación):
   - Foto de tu cédula (frontal y reverso)
   - Extracto bancario o certificación (a veces lo piden)

#### **⚠️ IMPORTANTE**:
- La cuenta bancaria **DEBE** estar a tu nombre
- Todos los datos **DEBEN** coincidir con tus documentos
- Stripe verifica todo esto por seguridad

---

### **Paso 3: Obtener tus Claves API**

Una vez tu cuenta esté verificada:

1. **Ir a**: [https://dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)

2. **Verás dos tipos de claves**:

#### **🔑 Claves de PRUEBA (Test Keys)**
Estas son para probar el sistema SIN dinero real:

```
Publishable key (pk_test_...): 
- Esta va en tu página web ✅
- Es PÚBLICA, se puede compartir
- Ejemplo: pk_test_51Abc123XYZ...

Secret key (sk_test_...):
- Esta NO va en tu página web ❌
- Es SECRETA, nunca la compartas
- Se usa en el servidor
- Ejemplo: sk_test_51Abc123XYZ...
```

#### **🔑 Claves EN VIVO (Live Keys)**  
Estas son para recibir dinero REAL (después de activar la cuenta):

```
Publishable key (pk_live_...):
- Esta va en tu página web cuando estés listo ✅
- Es PÚBLICA

Secret key (sk_live_...):
- Esta NO va en tu página web ❌
- Es SECRETA
```

---

### **Paso 4: Darte las Credenciales a Mí**

**🎯 LO QUE NECESITO DE TI:**

1. **Solo tu Publishable Key (pk_test_...)** para empezar a probar

**Envíame por aquí:**
```
pk_test_TU_CLAVE_AQUI
```

**❌ NO me envíes**:
- Secret Key (sk_test_... o sk_live_...)
- Contraseñas
- Datos bancarios

---

### **Paso 5: Yo Configuro Todo (5 minutos)**

Cuando me des tu `pk_test_...`, yo:

1. ✅ Actualizo `index.html` con tu clave
2. ✅ Configuro los precios ($25,000 COP / $12 USD)
3. ✅ Activo el botón de pago
4. ✅ Hago commit y push
5. ✅ Te confirmo que está listo

**Podrás probar pagos** con tarjetas de prueba:
```
Tarjeta de prueba exitosa:
4242 4242 4242 4242
MM/AA: Cualquier fecha futura
CVC: Cualquier 3 dígitos
```

---

### **Paso 6: Activar Modo LIVE (cuando estés listo)**

Una vez hayas probado y todo funcione:

1. **En Stripe Dashboard**, cambiar a "Live mode"
2. **Obtener tus claves LIVE** (pk_live_... y sk_live_...)
3. **Enviarmelas claves live**
4. **Yo actualizo el código**
5. **¡Listo para recibir dinero real!** 💰

---

## 📱 **Cómo Funciona para tus Clientes**

### 🇨🇴 **Cliente en Colombia:**
1. Ve tu página → Productos a **$25,000 COP**
2. Agrega al carrito
3. Click "Pagar con Stripe"
4. Paga con tarjeta/PSE/Efecty en **COP**
5. ✅ Tú recibes **$23,112 COP** (después de comisión)
6. Dinero llega a tu cuenta en **2-3 días**

### 🇺🇸 **Cliente en USA:**
1. Ve tu página → Productos a **$12 USD**
2. Agrega al carrito
3. Click "Pagar con Stripe"
4. Paga con tarjeta/Apple Pay en **USD**
5. ✅ Tú recibes **$11.35 USD** (después de comisión)
6. Dinero llega a tu cuenta en **2-3 días**

---

## 🛡️ **Seguridad y Ventajas**

✅ **PCI Compliant**: Los datos de tarjetas nunca tocan tu servidor
✅ **3D Secure**: Protección automática contra fraude
✅ **Radar**: Sistema anti-fraude de Stripe (incluido gratis)
✅ **Disputas**: Stripe te ayuda con contracargos
✅ **Soporte 24/7**: Chat en vivo en español

---

## 📞 **Soporte Stripe**

- **Dashboard**: [https://dashboard.stripe.com](https://dashboard.stripe.com)
- **Soporte**: Chat en vivo 24/7 desde el dashboard
- **Documentación**: [https://stripe.com/docs](https://stripe.com/docs)
- **Teléfono Colombia**: +57 1 5803557

---

## ✅ **RESUMEN RÁPIDO - QUÉ HACER**

```
1. ✅ Crear cuenta en stripe.com
2. ✅ Completar información del negocio
3. ✅ Agregar tu cuenta bancaria
4. ✅ Verificar identidad (subir cédula)
5. ✅ Copiar tu Publishable Key (pk_test_...)
6. ✅ Enviármela por aquí
7. ✅ Yo configuro todo
8. ✅ Probar con tarjeta de prueba
9. ✅ Cuando estés listo → Activar modo LIVE
10. 🎉 ¡A recibir pagos!
```

---

## 💡 **PREGUNTAS FRECUENTES**

**¿Cuánto tarda la verificación?**
- Instant
