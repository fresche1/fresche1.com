
## Mercado de EE. UU. (nuevo)

**Envíos en EE. UU. desde Nueva York · USPS con rastreo · Gratis desde 3 unidades · $9.99 con 1-2 unidades.**
- El servidor calcula el envío (USPS Ground Advantage): $9.99 USD con 1-2 unidades y gratis desde 3 (los packs cuentan por unidades: Dúo = 2, Trío = 3).
- Recoger en Queens, Manhattan, Long Island, Brooklyn o New Jersey sigue siendo gratis.
- Para envíos a EE. UU. ahora se pide estado (ej. NY) y ZIP code, y el servidor rechaza direcciones incompletas o inválidas. El resto de países internacionales queda como estaba.

Ejemplos de totales (USD):

| Pedido | Total |
|---|---|
| 1 unidad | $29.98 (19.99 + 9.99) |
| 2 unidades | $49.97 |
| 3 unidades | $50.97 (envío gratis) |
| Dúo | $44.98 |
| Trío | $44.99 (envío gratis) |
| Recoger en NY, 1 unidad | $19.99 |

**Pagos para clientes de EE. UU.**
- **PayPal es la opción principal:** "Paga con PayPal o con tarjeta, sin cuenta".
- **Stripe (tarjeta, Apple Pay, Google Pay):** queda programado pero **oculto**. Aparecerá solo el día que se configure una cuenta de Stripe en el servidor (variable STRIPE_SECRET_KEY). Mientras tanto la tienda no dice "procesado por Stripe".
- **Zelle:** sigue disponible, más pequeño, con la nota "Solo para clientes conocidos".
- **Elementos de confianza en el pago:** logos de tarjetas/PayPal, "Pago seguro procesado por PayPal", "Envío desde Nueva York con número de rastreo" y la nota de devoluciones, que enlaza a la nueva página **politicas.html** (envíos, devoluciones y privacidad, en español e inglés).
- **Por favor revise la página de políticas:** los plazos de 30 días para devoluciones sin abrir y de 7 días para avisar daños con foto son una propuesta; confírmelos o cámbielos.

**Pruebas:** 33/33 pruebas del servidor y 28/28 pruebas en navegador superadas. Entre ellas: pedido EE. UU. con PayPal destacado y total correcto ($29.98), Trío con envío gratis, y la vista con y sin Stripe.
