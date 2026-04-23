// Backend mínimo para Mercado Pago + Resend
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { Resend } from 'resend';
import Stripe from 'stripe';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const RAW_ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';
const ALLOWED_ORIGINS = RAW_ALLOWED_ORIGINS
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes('*')) return true;
  try {
    const originUrl = new URL(origin);
    if (['localhost', '127.0.0.1'].includes(originUrl.hostname)) {
      return true;
    }
  } catch {
    // Ignore invalid origin values and fall through to explicit matching.
  }
  return ALLOWED_ORIGINS.includes(origin);
}

// Configurar Mercado Pago
const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  console.warn('⚠️ MERCADOPAGO_ACCESS_TOKEN no está definido');
}
const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN || '' });

// Configurar Stripe
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.warn('⚠️ STRIPE_SECRET_KEY no está definido');
}
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL || 'https://fresche1.com/payment-response.html?provider=stripe&status=success&session_id={CHECKOUT_SESSION_ID}';
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL || 'https://fresche1.com/checkout.html?provider=stripe&status=cancel';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Configurar PayPal
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
const PAYPAL_RETURN_BASE_URL = process.env.PAYPAL_RETURN_BASE_URL || 'https://fresche1.com';

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.warn('⚠️ PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET no están definidos');
}

const STRIPE_PRICE_TABLE_USD = {
  1: 19.99,
  2: 34.99,
  3: 44.99,
  pack_elella: 69.99
};

const STRIPE_PRODUCT_IDS = {
  unit: 'prod_UNwnncIoeJHyB1',
  duo: 'prod_UNwjRRVqNpodxb',
  trio: 'prod_UNwkHuK7xakaWH',
  elella: 'prod_UNwkUUVV3ijlex'
};

function resolveStripePackType(item) {
  if (item.packType) {
    return item.packType;
  }
  if (Array.isArray(item.products)) {
    if (item.products.length === 2) return 'duo';
    if (item.products.length === 3) return 'trio';
    if (item.products.length === 5) return 'elella';
  }
  return null;
}

function getStripeUnitPriceUsd(item) {
  if (item.type === 'pack') {
    const packType = resolveStripePackType(item);
    if (packType === 'duo') return STRIPE_PRICE_TABLE_USD[2];
    if (packType === 'trio') return STRIPE_PRICE_TABLE_USD[3];
    if (packType === 'elella') return STRIPE_PRICE_TABLE_USD.pack_elella;
  }

  return STRIPE_PRICE_TABLE_USD[item.quantity] || STRIPE_PRICE_TABLE_USD[1];
}

function getStripeProductId(item) {
  if (item.type === 'pack') {
    const packType = resolveStripePackType(item);
    if (packType === 'duo') return STRIPE_PRODUCT_IDS.duo;
    if (packType === 'trio') return STRIPE_PRODUCT_IDS.trio;
    if (packType === 'elella') return STRIPE_PRODUCT_IDS.elella;
  }

  return STRIPE_PRODUCT_IDS.unit;
}

function buildStripeLineItems(cart) {
  return cart.map((item) => {
    const unitPriceUsd = getStripeUnitPriceUsd(item);
    const productId = getStripeProductId(item);

    return {
      price_data: {
        currency: 'usd',
        product: productId,
        unit_amount: Math.round(unitPriceUsd * 100)
      },
      quantity: Number(item.quantity) || 1
    };
  });
}

function calculateStripeShippingUsd(orderData) {
  if (orderData.shippingMethod === 'pickup' || orderData.shippingMethod === 'free') {
    return 0;
  }

  if (orderData.shippingMethod === 'international') {
    return 10;
  }

  return 0;
}

function calculateStripeOrderSummary(orderData) {
  const subtotal = orderData.cart.reduce((sum, item) => {
    const unitPriceUsd = getStripeUnitPriceUsd(item);
    return sum + (unitPriceUsd * (Number(item.quantity) || 1));
  }, 0);

  const shippingCost = calculateStripeShippingUsd(orderData);

  return {
    subtotal,
    shippingCost,
    total: subtotal + shippingCost
  };
}

function formatUsdAmount(amount) {
  return Number(amount || 0).toFixed(2);
}

function getBackendBaseUrl(req) {
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto ? forwardedProto.split(',')[0] : req.protocol;
  return `${protocol}://${req.get('host')}`;
}

function sanitizeReturnBaseUrl(candidate) {
  if (!candidate) {
    return PAYPAL_RETURN_BASE_URL;
  }

  try {
    const parsed = new URL(candidate);
    if (isOriginAllowed(parsed.origin)) {
      return parsed.origin;
    }
  } catch {
    // Ignore invalid return URLs and use the default fallback.
  }

  return PAYPAL_RETURN_BASE_URL;
}

function buildPayPalItems(cart) {
  return cart.map((item) => ({
    name: item.name,
    quantity: String(Number(item.quantity) || 1),
    unit_amount: {
      currency_code: 'USD',
      value: formatUsdAmount(getStripeUnitPriceUsd(item))
    }
  }));
}

async function getPayPalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal no configurado');
  }

  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || 'No se pudo autenticar con PayPal');
  }

  return data.access_token;
}

// Configurar Resend para envíos de email
const resend = new Resend(process.env.RESEND_API_KEY);

// Verificar configuración al iniciar
console.log('📧 Configuración de Email:');
console.log(`   Servicio: Resend`);
console.log(`   API Key: ${process.env.RESEND_API_KEY ? '✓' : '✗ FALTA'}`);
console.log(`   Email: ${process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev'}`);

app.use(cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: false
}));

app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send('Stripe webhook no configurado');
  }

  const signature = req.headers['stripe-signature'];

  if (!signature) {
    return res.status(400).send('Firma de Stripe faltante');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('❌ Firma Stripe inválida:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('✅ Pago Stripe completado:', session.id, session.customer_email || 'sin email');
  }

  return res.json({ received: true });
});

app.use(express.json());

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Mercado Pago backend running' });
});

// Test email endpoint
app.get('/api/test-email', async (_req, res) => {
  try {
    console.log('🧪 Test de email iniciado con Resend...');

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ 
        error: 'RESEND_API_KEY no configurado',
        message: 'Agrega RESEND_API_KEY en las variables de entorno de Render'
      });
    }

    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: 'galindo243@live.com', // Test solo a tu email
      subject: '✅ Email de Prueba - FRESCHE',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #d4af37;">✅ Email de Prueba</h2>
          <p>Este es un email de prueba del sistema FRESCHE.</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
          <p><strong>Servicio:</strong> Resend API</p>
          <hr style="border: 1px solid #d4af37;">
          <p style="color: #666;">Si recibiste este email, el sistema de notificaciones está funcionando correctamente. ✓</p>
        </div>
      `
    });

    if (result.error) {
      console.error('❌ Error de Resend:', result.error);
      return res.status(500).json({ 
        error: 'Error al enviar email',
        message: result.error.message,
        timestamp: new Date().toLocaleString('es-CO')
      });
    }

    console.log('✅ Email de prueba enviado:', result.data.id);
    res.json({ 
      success: true, 
      message: 'Email de prueba enviado exitosamente',
      emailId: result.data.id,
      to: 'galindo243@live.com',
      timestamp: new Date().toLocaleString('es-CO')
    });
  } catch (error) {
    console.error('❌ Error al enviar email de prueba:', error.message);
    res.status(500).json({ 
      error: 'Error al enviar email',
      message: error.message,
      timestamp: new Date().toLocaleString('es-CO')
    });
  }
});

// Enviar email simple (para confirmaciones de Mercado Pago)
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ 
        error: 'Faltan parámetros requeridos: to, subject, html' 
      });
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY no está configurado');
      return res.status(500).json({ 
        error: 'Servicio de email no configurado',
        message: 'RESEND_API_KEY falta en variables de entorno'
      });
    }

    console.log(`📧 Enviando email a ${to}...`);

    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: to,
      subject: subject,
      html: html
    });

    if (result.error) {
      console.error('❌ Error de Resend:', result.error);
      return res.status(500).json({ 
        error: 'Error al enviar email',
        details: result.error.message
      });
    }

    console.log('✅ Email enviado exitosamente:', result.data.id);
    res.json({ 
      success: true, 
      messageId: result.data.id,
      to: to,
      timestamp: new Date().toLocaleString('es-CO')
    });
  } catch (error) {
    console.error('❌ Error al enviar email:', error.message);
    res.status(500).json({ 
      error: 'Error al enviar email',
      message: error.message
    });
  }
});

// Crear preferencia de pago
app.post('/api/create-preference', async (req, res) => {
  try {
    const { preference, orderData } = req.body;
    if (!preference || !preference.items || !Array.isArray(preference.items)) {
      return res.status(400).json({ error: 'Preference inválida' });
    }

    const preferenceData = {
      ...preference,
      notification_url: preference.notification_url || `${req.protocol}://${req.get('host')}/mercadopago-webhook`,
      auto_return: preference.auto_return || 'approved'
    };

    const preferenceInstance = new Preference(client);
    const response = await preferenceInstance.create({ body: preferenceData });

    // Responder inmediatamente para no bloquear la redirección
    res.json({ init_point: response.init_point, id: response.id });

    // Enviar email en segundo plano con Resend
    if (orderData && process.env.RESEND_API_KEY) {
      console.log('📧 Intentando enviar email de pedido con Resend...');
      
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
          <div style="background: white; padding: 20px; border-radius: 10px; border-left: 4px solid #d4af37;">
            <h2 style="color: #d4af37; margin-top: 0;">🛍️ Nuevo Pedido Recibido</h2>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
            <p><strong>ID de Preferencia MP:</strong> ${response.id}</p>
            
            <hr style="border: 1px solid #d4af37;">
            
            <h3 style="color: #d4af37;">📦 Datos del Cliente</h3>
            <ul>
              <li><strong>Nombre:</strong> ${orderData.customerName}</li>
              <li><strong>Email:</strong> ${orderData.email}</li>
              <li><strong>Teléfono:</strong> ${orderData.phone}</li>
            </ul>
            
            <h3 style="color: #d4af37;">📍 Dirección de Envío</h3>
            <ul>
              <li><strong>Dirección:</strong> ${orderData.address}</li>
              <li><strong>Ciudad:</strong> ${orderData.city}</li>
              <li><strong>Departamento:</strong> ${orderData.state || 'N/A'}</li>
              <li><strong>Código Postal:</strong> ${orderData.zipCode || 'N/A'}</li>
              <li><strong>Zona de Envío:</strong> ${orderData.shippingMethod || 'N/A'}</li>
            </ul>
            
            <h3 style="color: #d4af37;">🛒 Productos Ordenados</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f0f0f0;">
                  <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Producto</th>
                  <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Cantidad</th>
                  <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Precio Unit.</th>
                  <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${preference.items.map(item => `
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${item.title}</td>
                    <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${item.quantity}</td>
                    <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">$${Number(item.unit_price).toLocaleString('es-CO')}</td>
                    <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">$${Number(item.unit_price * item.quantity).toLocaleString('es-CO')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <h3 style="color: #d4af37;">💰 Resumen de Pago</h3>
            <ul style="font-size: 1.1em;">
              <li><strong>Subtotal:</strong> $${Number(orderData.subtotal || 0).toLocaleString('es-CO')}</li>
              <li><strong>Costo de Envío:</strong> ${orderData.country === 'CO' ? 'Gratis' : `$${Number(orderData.shippingCost || 0).toLocaleString('es-CO')}`}</li>
              <li style="color: #d4af37; font-size: 1.3em; margin-top: 10px;">
                <strong>TOTAL: $${Number(orderData.total || 0).toLocaleString('es-CO')} COP</strong>
              </li>
            </ul>
            
            <hr style="border: 1px solid #d4af37; margin: 20px 0;">
            
            <p style="color: #666; font-size: 0.9em; text-align: center;">
              Pedido realizado a través de <strong>fresche1.com</strong><br>
              Este es un email automático. Por favor no respondas a este correo.
            </p>
          </div>
        </div>
      `;
      
      resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: 'galindo243@live.com', // Enviar a tu email para plan gratuito
        subject: `🛍️ Nuevo Pedido FRESCHE - ${orderData.customerName}`,
        html: emailBody
      }).then((result) => {
        if (result.error) {
          console.error('❌ Error enviando email:', result.error);
        } else {
          console.log('✅ Email enviado exitosamente:', result.data.id);
        }
      }).catch((error) => {
        console.error('❌ ERROR enviando email:', error.message);
      });
    } else {
      console.warn('⚠️ Email NO enviado - Faltan RESEND_API_KEY o datos del pedido');
    }
    
  } catch (error) {
    console.error('Error al crear preferencia:', error);
    return res.status(500).json({ error: 'Error al crear preferencia' });
  }
});

app.post('/api/create-stripe-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe no configurado' });
    }

    const { orderData } = req.body;

    if (!orderData || !Array.isArray(orderData.cart) || orderData.cart.length === 0) {
      return res.status(400).json({ error: 'Pedido inválido para Stripe' });
    }

    if (!orderData.email) {
      return res.status(400).json({ error: 'Email requerido para Stripe' });
    }

    const lineItems = buildStripeLineItems(orderData.cart);
    const summary = calculateStripeOrderSummary(orderData);

    if (summary.shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Shipping'
          },
          unit_amount: Math.round(summary.shippingCost * 100)
        },
        quantity: 1
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: orderData.email,
      line_items: lineItems,
      success_url: STRIPE_SUCCESS_URL,
      cancel_url: STRIPE_CANCEL_URL,
      billing_address_collection: 'auto',
      phone_number_collection: {
        enabled: true
      },
      payment_intent_data: {
        receipt_email: orderData.email,
        metadata: {
          provider: 'stripe',
          fullName: orderData.fullName || '',
          phone: orderData.phone || '',
          country: orderData.country || '',
          shippingMethod: orderData.shippingMethod || '',
          currency: 'USD',
          subtotal: summary.subtotal.toFixed(2),
          shippingCost: summary.shippingCost.toFixed(2),
          total: summary.total.toFixed(2)
        }
      },
      metadata: {
        provider: 'stripe',
        fullName: orderData.fullName || '',
        phone: orderData.phone || '',
        country: orderData.country || '',
        shippingMethod: orderData.shippingMethod || '',
        currency: 'USD',
        subtotal: summary.subtotal.toFixed(2),
        shippingCost: summary.shippingCost.toFixed(2),
        total: summary.total.toFixed(2)
      }
    });

    return res.json({
      id: session.id,
      url: session.url,
      subtotal: summary.subtotal,
      shippingCost: summary.shippingCost,
      total: summary.total
    });
  } catch (error) {
    console.error('❌ Error creando sesión Stripe:', error);
    return res.status(500).json({ error: 'Error al crear sesión de Stripe' });
  }
});

app.post('/api/create-paypal-order', async (req, res) => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      return res.status(500).json({ error: 'PayPal no configurado' });
    }

    const { orderData } = req.body;

    if (!orderData || !Array.isArray(orderData.cart) || orderData.cart.length === 0) {
      return res.status(400).json({ error: 'Pedido inválido para PayPal' });
    }

    if (!orderData.email) {
      return res.status(400).json({ error: 'Email requerido para PayPal' });
    }

    const summary = calculateStripeOrderSummary(orderData);
    const items = buildPayPalItems(orderData.cart);
    const backendBaseUrl = getBackendBaseUrl(req);
    const returnBaseUrl = sanitizeReturnBaseUrl(orderData.returnBaseUrl);
    const captureReturnUrl = `${backendBaseUrl}/api/paypal/capture-order?returnBaseUrl=${encodeURIComponent(returnBaseUrl)}`;
    const cancelUrl = `${returnBaseUrl}/payment-response.html?provider=paypal&status=cancel`;
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: `FRESCHE-${Date.now()}`,
          description: 'FRESCHE order',
          amount: {
            currency_code: 'USD',
            value: formatUsdAmount(summary.total),
            breakdown: {
              item_total: {
                currency_code: 'USD',
                value: formatUsdAmount(summary.subtotal)
              },
              shipping: {
                currency_code: 'USD',
                value: formatUsdAmount(summary.shippingCost)
              }
            }
          },
          items
        }],
        application_context: {
          brand_name: 'FRESCHE',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: captureReturnUrl,
          cancel_url: cancelUrl,
          shipping_preference: 'NO_SHIPPING'
        }
      })
    });

    const data = await response.json();
    const approveUrl = data.links?.find((link) => link.rel === 'approve')?.href;

    if (!response.ok || !approveUrl) {
      throw new Error(data.message || 'No se pudo crear la orden de PayPal');
    }

    return res.json({
      id: data.id,
      url: approveUrl,
      subtotal: summary.subtotal,
      shippingCost: summary.shippingCost,
      total: summary.total
    });
  } catch (error) {
    console.error('❌ Error creando orden PayPal:', error);
    return res.status(500).json({ error: error.message || 'Error al crear orden de PayPal' });
  }
});

app.get('/api/paypal/capture-order', async (req, res) => {
  const orderId = req.query.token;
  const returnBaseUrl = sanitizeReturnBaseUrl(req.query.returnBaseUrl);

  if (!orderId) {
    return res.redirect(`${returnBaseUrl}/payment-response.html?provider=paypal&status=failure`);
  }

  try {
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    const status = capture?.status === 'COMPLETED' || data.status === 'COMPLETED' ? 'success' : 'pending';
    const params = new URLSearchParams({
      provider: 'paypal',
      status,
      orderId: data.id || orderId,
      captureId: capture?.id || '',
      amount: capture?.amount?.value || data.purchase_units?.[0]?.amount?.value || '',
      currency: capture?.amount?.currency_code || data.purchase_units?.[0]?.amount?.currency_code || 'USD'
    });

    if (!response.ok) {
      throw new Error(data.message || 'No se pudo capturar el pago de PayPal');
    }

    return res.redirect(`${returnBaseUrl}/payment-response.html?${params.toString()}`);
  } catch (error) {
    console.error('❌ Error capturando orden PayPal:', error);
    return res.redirect(`${returnBaseUrl}/payment-response.html?provider=paypal&status=failure`);
  }
});

// Webhook (opcional)
app.post('/mercadopago-webhook', async (req, res) => {
  try {
    const { type, data } = req.body;
    console.log('Webhook recibido:', type, data);
    // Aquí puedes consultar el pago y actualizar tu base de datos
    return res.sendStatus(200);
  } catch (error) {
    console.error('Error en webhook:', error);
    return res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Mercado Pago backend escuchando en puerto ${PORT}`);
});
