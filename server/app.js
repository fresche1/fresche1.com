// App Express (sin listen) para poder probarla con dependencias simuladas.
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { computeOrder, legacyCartToItems, OrderError, ZONE_LABELS } from './pricing.js';
import { escapeHtml, fmtMoney, orderSnapshot, ownerEmailHtml, toStripeMetadata, fromStripeMetadata, createOrderStore, PICKUP_LABELS } from './orders.js';

let helmet = null;
try { helmet = (await import('helmet')).default; } catch { /* helmet opcional */ }

export const DEFAULT_ALLOWED_ORIGINS = ['https://fresche1.com', 'https://www.fresche1.com'];

export { escapeHtml };

export const DEFAULT_OWNER_EMAILS = ['fresche@fresche1.com', 'galindo243@live.com'];
export function parseOwnerEmails(raw) {
  const list = (Array.isArray(raw) ? raw : String(raw || '').split(',')).map((e) => String(e).trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  return list.length ? [...new Set(list)] : DEFAULT_OWNER_EMAILS;
}

export function parseAllowedOrigins(raw) {
  const list = String(raw || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean).filter((o) => o !== '*');
  return list.length ? list : DEFAULT_ALLOWED_ORIGINS;
}

/** Verifica x-signature de Mercado Pago. https://www.mercadopago.com.co/developers/es/docs/your-integrations/notifications/webhooks */
export function verifyMercadoPagoSignature({ signatureHeader, requestId, dataId, secret }) {
  if (!secret || !signatureHeader || !dataId) return false;
  const parts = Object.fromEntries(String(signatureHeader).split(',').map((p) => p.split('=').map((s) => s.trim())).filter((kv) => kv.length === 2));
  const ts = parts.ts; const v1 = parts.v1;
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;
  const id = /^[a-z0-9]+$/i.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  let manifest = `id:${id};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1.toLowerCase(), 'hex'));
}

// ---------- Validación de datos del comprador ----------
const CTRL = /[\u0000-\u001f\u007f]/g;
function cleanStr(v, max) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' && typeof v !== 'number') throw new OrderError('Dato inválido');
  const s = String(v).replace(CTRL, ' ').trim();
  if (s.length > max) throw new OrderError('Dato demasiado largo');
  return s;
}
const EMAIL_RE = /^[^\s@<>()[\],;:"]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$/;
const COUNTRIES = ['CO', 'US', 'CA', 'MX', 'ES', 'AR', 'CL', 'PE', 'EC', 'BR', 'OTHER'];

export const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','PR'];

export function validateBuyer(raw, { requireAddress, requireUsAddress = false }) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const buyer = {
    name: cleanStr(b.name, 100), email: cleanStr(b.email, 254), phone: cleanStr(b.phone, 30),
    address: cleanStr(b.address, 200), city: cleanStr(b.city, 100), state: cleanStr(b.state, 100),
    postalCode: cleanStr(b.postalCode, 20), notes: cleanStr(b.notes, 300), country: cleanStr(b.country, 10).toUpperCase()
  };
  if (buyer.name.length < 2) throw new OrderError('Nombre requerido');
  if (!EMAIL_RE.test(buyer.email)) throw new OrderError('Email inválido');
  if (buyer.phone && !/^[0-9+()\-.\s]{5,30}$/.test(buyer.phone)) throw new OrderError('Teléfono inválido');
  if (buyer.country && !COUNTRIES.includes(buyer.country)) throw new OrderError('País inválido');
  if (requireAddress && (!buyer.address || !buyer.city)) throw new OrderError('Dirección y ciudad requeridas');
  if (requireUsAddress) {
    buyer.state = buyer.state.toUpperCase();
    if (!US_STATES.includes(buyer.state)) throw new OrderError('Estado de EE. UU. inválido (usa el código de 2 letras, ej. NY)');
    if (!/^\d{5}(-\d{4})?$/.test(buyer.postalCode)) throw new OrderError('ZIP code inválido (ej. 10001)');
    if (buyer.address.length < 5) throw new OrderError('Dirección inválida');
    if (!buyer.phone) throw new OrderError('Teléfono requerido');
  }
  return buyer;
}

/** Interpreta el pedido del cliente: {items, shippingZone, pickupStore, buyer}. Moneda la decide el servidor. */
// Regla del dueño: Colombia = COP; EE. UU. y cualquier otro país = USD. La decide SOLO el servidor
// (por país del comprador, o por la tienda de recogida); cualquier "currency" enviada por el cliente se ignora.
export function currencyForOrder({ isPickup, pickupStore, country }) {
  if (isPickup) return pickupStore === 'CO' ? 'COP' : 'USD';
  return String(country || '').toUpperCase() === 'CO' ? 'COP' : 'USD';
}

export function parseOrderRequest(order, { requireCurrency, commissionPercent = 0, legacy = false } = {}) {
  if (!order || typeof order !== 'object') throw new OrderError('Pedido inválido');
  const zoneIn = typeof order.shippingZone === 'string' ? order.shippingZone : '';
  const isPickup = zoneIn === 'pickup';
  const pickupStore = isPickup ? (order.pickupStore === 'US' ? 'US' : order.pickupStore === 'CO' ? 'CO' : null) : null;
  if (isPickup && !pickupStore) throw new OrderError('Selecciona la tienda de recogida');
  const isUsDelivery = !isPickup && String(order.buyer?.country || '').toUpperCase() === 'US' && !legacy;
  const buyer = validateBuyer(order.buyer, { requireAddress: !isPickup, requireUsAddress: isUsDelivery });
  if (!isPickup && !buyer.country) throw new OrderError('País requerido');
  const currency = currencyForOrder({ isPickup, pickupStore, country: buyer.country });
  if (requireCurrency && currency !== requireCurrency) {
    throw new OrderError(currency === 'COP'
      ? 'Los pedidos en Colombia se pagan en pesos (COP): usa Mercado Pago o Nequi'
      : 'Los pedidos fuera de Colombia se pagan en dólares (USD): usa PayPal, Stripe o Zelle');
  }
  const summary = computeOrder({ items: order.items, currency, shippingZone: zoneIn, city: buyer.city, country: legacy ? 'LEGACY' : buyer.country, commissionPercent });
  return { buyer, summary, pickupStore };
}

function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    const entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) hits.set(key, { start: now, count: 1 });
    else if (++entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.start + windowMs - now) / 1000)));
      return res.status(429).json({ error: 'Demasiadas solicitudes, intenta de nuevo en unos minutos' });
    }
    if (hits.size > 10000) for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k);
    return next();
  };
}

/**
 * @param {object} deps
 * @param {object} deps.config
 * @param {{createPreference:Function, getPayment:Function}|null} deps.mp
 * @param {object|null} deps.stripe   instancia de Stripe (o mock)
 * @param {{createOrder:Function, captureOrder:Function, getOrder:Function}|null} deps.paypal
 * @param {{send:Function}|null} deps.mailer
 */
export function createApp({ config, mp, stripe = null, paypal = null, mailer = null, logger = console }) {
  const app = express();
  const allowed = parseAllowedOrigins(config.allowedOrigins);
  const isOriginAllowed = (origin) => !origin || allowed.includes(origin);
  const processedPayments = new Map(); // idempotencia del webhook: paymentId -> estado procesado
  const ownerEmails = parseOwnerEmails(config.ownerEmail);
  const orders = config.orderStore || createOrderStore({ file: config.orderStoreFile || '', logger }); // memoria (+ JSON opcional)
  const confirmedOnce = new Set(); // idempotencia emails
  const sendOwner = async (subject, html) => { if (!mailer) return false; await mailer.send({ to: ownerEmails, subject, html }); return true; };
  async function notifyConfirmed({ provider, paymentId, status, order, amount, currency }) {
    const key = `${provider}:${paymentId}`;
    if (confirmedOnce.has(key)) return false;
    confirmedOnce.add(key);
    if (!mailer) return false;
    try {
      return await sendOwner(`✅ Pago CONFIRMADO ${provider} - ${order?.id || ''} - ${order?.buyer?.name || ''}`, ownerEmailHtml({ kind: 'confirmed', provider, paymentId, status, order, amount, currency }));
    } catch (e) { confirmedOnce.delete(key); logger.error('Error email confirmación:', e.message); return false; }
  }
  const commissionPercent = Number(config.mpCommissionPercent ?? 5);

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render está detrás de un proxy
  if (helmet) app.use(helmet());

  app.use(cors({
    origin(origin, cb) { return isOriginAllowed(origin) ? cb(null, true) : cb(null, false); },
    methods: ['GET', 'POST'],
    credentials: false
  }));

  const createLimiter = rateLimiter({ windowMs: config.rateLimitWindowMs || 10 * 60 * 1000, max: config.rateLimitMax || 20 });
  const statusLimiter = rateLimiter({ windowMs: 60 * 1000, max: 60 });

  // ---- Stripe webhook (cuerpo crudo, antes de express.json) ----
  app.post('/api/stripe-webhook', express.raw({ type: 'application/json', limit: '100kb' }), (req, res) => {
    if (!stripe || !config.stripeWebhookSecret) return res.status(500).send('Stripe webhook no configurado');
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).send('Firma de Stripe faltante');
    let event;
    try { event = stripe.webhooks.constructEvent(req.body, signature, config.stripeWebhookSecret); } catch (error) {
      logger.error('❌ Firma Stripe inválida:', error.message);
      return res.status(400).send('Firma inválida');
    }
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      if (session.payment_status === 'paid') {
        logger.log('✅ Pago Stripe completado:', session.id);
        const orderId = session.metadata?.order_id || session.client_reference_id;
        const order = orders.get(orderId) || orders.get(session.id) || fromStripeMetadata(session.metadata) || { id: orderId || session.id, buyer: { email: session.customer_details?.email || session.customer_email } };
        notifyConfirmed({ provider: 'Stripe', paymentId: session.payment_intent || session.id, status: `paid (${session.id})`, order, amount: (session.amount_total || 0) / 100, currency: 'USD' })
          .catch(() => {});
      }
    }
    return res.json({ received: true });
  });

  app.use(express.json({ limit: '50kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Qué medios de pago están activos (el sitio oculta Stripe si no hay STRIPE_SECRET_KEY).
  app.get('/api/config', (_req, res) => res.json({ stripeEnabled: Boolean(stripe), paypalEnabled: Boolean(paypal), mercadopagoEnabled: Boolean(mp) }));

  // Envío de email de prueba: solo con ADMIN_TOKEN (antes era público y permitía spamear la cuenta de Resend).
  app.get('/api/test-email', async (req, res) => {
    const token = req.get('x-admin-token') || '';
    if (!config.adminToken || token.length !== config.adminToken.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(config.adminToken))) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    if (!mailer) return res.status(500).json({ error: 'Email no configurado' });
    try {
      await mailer.send({ to: ownerEmails, subject: '✅ Email de Prueba - FRESCHE', html: '<p>Email de prueba del backend FRESCHE.</p>' });
      return res.json({ success: true });
    } catch (error) {
      logger.error('Error email de prueba:', error.message);
      return res.status(500).json({ error: 'Error al enviar email' });
    }
  });

  // /api/send-email eliminado: era un relay abierto (cualquiera podía enviar HTML arbitrario a cualquier destinatario).
  app.post('/api/send-email', (_req, res) => res.status(410).json({ error: 'Endpoint deshabilitado' }));

  // ---- Mercado Pago: crear preferencia (precios calculados en el servidor) ----
  app.post('/api/create-preference', createLimiter, async (req, res) => {
    if (req.body && req.body.preference && !req.body.order) {
      return res.status(409).json({ error: 'Versión del sitio desactualizada. Recarga la página e intenta de nuevo.' });
    }
    let parsed;
    try { parsed = parseOrderRequest(req.body?.order, { commissionPercent, requireCurrency: 'COP' }); } catch (error) {
      if (error instanceof OrderError) return res.status(400).json({ error: error.message });
      return res.status(500).json({ error: 'Error interno' });
    }
    if (!mp) return res.status(500).json({ error: 'Mercado Pago no configurado' });
    const { buyer, summary } = parsed;
    const snap = orderSnapshot(parsed, { method: 'Mercado Pago' });
    const reference = snap.id;
    const site = config.publicSiteUrl.replace(/\/$/, '');
    const backend = (config.publicBackendUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const items = summary.lines.map((l) => ({ id: l.id, title: l.title, quantity: l.quantity, unit_price: l.unit_price, currency_id: summary.currency }));
    if (summary.shipping > 0) items.push({ id: 'envio', title: summary.zoneLabel, quantity: 1, unit_price: summary.shipping, currency_id: summary.currency });
    if (summary.commission > 0) items.push({ id: 'comision', title: `Comisión Mercado Pago (${summary.commissionPercent}%)`, quantity: 1, unit_price: summary.commission, currency_id: summary.currency });

    const body = {
      items,
      payer: { name: buyer.name, email: buyer.email },
      back_urls: {
        success: `${site}/payment-response.html?provider=mercadopago`,
        failure: `${site}/payment-response.html?provider=mercadopago`,
        pending: `${site}/payment-response.html?provider=mercadopago`
      },
      auto_return: 'approved',
      external_reference: reference,
      notification_url: `${backend}/api/mercadopago-webhook`,
      statement_descriptor: 'FRESCHE',
      metadata: { expected_total: summary.total, currency: summary.currency, zone: summary.zone, order_id: snap.id, order: snap }
    };
    let pref;
    try {
      pref = await mp.createPreference(body);
      orders.set(snap.id, snap);
      res.json({ id: pref.id, init_point: pref.init_point, reference, currency: summary.currency, subtotal: summary.subtotal, shipping: summary.shipping, freeShipping: summary.freeShipping, units: summary.units, commission: summary.commission, total: summary.total });
    } catch (error) {
      logger.error('Error al crear preferencia:', error.message);
      return res.status(502).json({ error: 'Error al crear preferencia' });
    }
    if (mailer) {
      sendOwner(`🛍️ Nuevo pedido (PENDIENTE DE PAGO) - ${snap.id} - ${buyer.name}`, ownerEmailHtml({ kind: 'pending', provider: 'Mercado Pago', paymentId: `preferencia ${pref?.id || ''}`, status: 'esperando pago', order: snap }))
        .catch((e) => logger.error('Error email pedido:', e.message));
    }
    return undefined;
  });

  // ---- Verificación de pago con Mercado Pago ----
  async function verifyMpPayment(paymentId) {
    const p = await mp.getPayment(paymentId);
    if (!p || String(p.id) !== String(paymentId)) return { verified: false };
    const expected = Number(p.metadata?.expected_total);
    const expectedCurrency = p.metadata?.currency;
    const amountOk = Number.isFinite(expected) && Number(p.transaction_amount) + 0.001 >= expected && (!expectedCurrency || p.currency_id === expectedCurrency);
    return {
      verified: true, status: p.status, approved: p.status === 'approved' && amountOk, amountMatches: amountOk,
      amount: p.transaction_amount, currency: p.currency_id, reference: p.external_reference || null, payment: p
    };
  }

  async function handleMpWebhook(req, res) {
    const dataId = req.query['data.id'] ?? req.body?.data?.id;
    const type = req.query.type || req.body?.type || req.query.topic;
    const ok = verifyMercadoPagoSignature({ signatureHeader: req.get('x-signature'), requestId: req.get('x-request-id'), dataId, secret: config.mpWebhookSecret });
    if (!ok) { logger.warn('⚠️ Webhook MP con firma inválida'); return res.sendStatus(401); }
    if (type !== 'payment') return res.sendStatus(200);
    if (!/^\d{1,20}$/.test(String(dataId))) return res.sendStatus(400);
    if (!mp) return res.sendStatus(500);
    try {
      const result = await verifyMpPayment(String(dataId));
      if (!result.verified) return res.sendStatus(200);
      const key = String(dataId);
      if (processedPayments.get(key) === result.status) return res.status(200).json({ duplicate: true });
      processedPayments.set(key, result.status);
      if (processedPayments.size > 5000) processedPayments.delete(processedPayments.keys().next().value);
      if (result.approved) {
        logger.log('✅ Pago MP confirmado', key, result.reference, result.amount, result.currency);
        const md = result.payment?.metadata || {};
        const order = orders.get(result.reference) || orders.get(md.order_id) || md.order || { id: result.reference, buyer: { email: result.payment?.payer?.email } };
        await notifyConfirmed({ provider: 'Mercado Pago', paymentId: key, status: `${result.status}${result.payment?.payment_method_id ? ` (${result.payment.payment_method_id})` : ''}`, order, amount: result.amount, currency: result.currency });
      } else if (result.status === 'approved' && !result.amountMatches) {
        logger.error('🚨 Pago MP aprobado con monto que NO coincide', key, result.amount, result.payment?.metadata);
      }
      return res.sendStatus(200);
    } catch (error) {
      processedPayments.delete(String(dataId));
      logger.error('Error procesando webhook MP:', error.message);
      return res.sendStatus(500); // MP reintentará
    }
  }
  app.post('/api/mercadopago-webhook', handleMpWebhook);
  app.post('/mercadopago-webhook', handleMpWebhook); // alias legado (misma verificación)

  // ---- Estado verificado del pago para payment-response.html ----
  app.get('/api/payment-status', statusLimiter, async (req, res) => {
    const provider = String(req.query.provider || 'mercadopago');
    try {
      if (provider === 'mercadopago') {
        const id = String(req.query.payment_id || '');
        if (!/^\d{1,20}$/.test(id)) return res.status(400).json({ verified: false, error: 'payment_id inválido' });
        if (!mp) return res.status(500).json({ verified: false });
        const r = await verifyMpPayment(id);
        if (!r.verified) return res.status(404).json({ verified: false });
        return res.json({ provider, verified: true, status: r.status, approved: r.approved, amount: r.amount, currency: r.currency, reference: r.reference });
      }
      if (provider === 'stripe') {
        const id = String(req.query.session_id || '');
        if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) return res.status(400).json({ verified: false, error: 'session_id inválido' });
        if (!stripe) return res.status(500).json({ verified: false });
        const s = await stripe.checkout.sessions.retrieve(id);
        return res.json({ provider, verified: true, status: s.payment_status, approved: s.payment_status === 'paid', amount: (s.amount_total || 0) / 100, currency: String(s.currency || '').toUpperCase(), reference: s.id });
      }
      if (provider === 'paypal') {
        const id = String(req.query.orderId || '');
        if (!/^[A-Z0-9]{10,30}$/.test(id)) return res.status(400).json({ verified: false, error: 'orderId inválido' });
        if (!paypal) return res.status(500).json({ verified: false });
        const o = await paypal.getOrder(id);
        const cap = o?.purchase_units?.[0]?.payments?.captures?.[0];
        const approved = o?.status === 'COMPLETED' && (!cap || cap.status === 'COMPLETED');
        return res.json({ provider, verified: true, status: o?.status || 'UNKNOWN', approved, amount: Number(cap?.amount?.value || o?.purchase_units?.[0]?.amount?.value || 0), currency: cap?.amount?.currency_code || 'USD', reference: o?.id || id });
      }
      return res.status(400).json({ verified: false, error: 'Proveedor inválido' });
    } catch (error) {
      logger.error('Error consultando estado de pago:', error.message);
      return res.status(502).json({ verified: false, error: 'No se pudo verificar el pago' });
    }
  });

  // ---- Stripe / PayPal (USD) ----
  function parseUsdOrder(body) {
    if (body?.order) return parseOrderRequest(body.order, { requireCurrency: 'USD' });
    // Compatibilidad con el sitio anterior (orderData.cart). Los precios del cliente se ignoran.
    const od = body?.orderData;
    if (!od || !Array.isArray(od.cart)) throw new OrderError('Pedido inválido');
    const isPickup = od.shippingMethod === 'pickup';
    return parseOrderRequest({
      items: legacyCartToItems(od.cart), shippingZone: isPickup ? 'pickup' : 'international', pickupStore: isPickup ? (od.country === 'CO' ? 'CO' : 'US') : undefined,
      buyer: { name: od.fullName || od.customerName, email: od.email, phone: od.phone, address: od.address || (isPickup ? '' : 'N/A'), city: od.city || (isPickup ? '' : 'N/A'), state: od.state, postalCode: od.zipCode, country: od.country || 'US' }
    }, { requireCurrency: 'USD', legacy: true }); // sitio viejo (sin estado/ZIP): se cobra como antes, sin envío
  }

  app.post('/api/create-stripe-checkout-session', createLimiter, async (req, res) => {
    let parsed;
    try { parsed = parseUsdOrder(req.body); } catch (error) {
      if (error instanceof OrderError) return res.status(400).json({ error: error.message });
      return res.status(500).json({ error: 'Error interno' });
    }
    if (!stripe) return res.status(500).json({ error: 'Stripe no configurado' });
    const { buyer, summary } = parsed;
    const lineItems = summary.lines.map((l) => ({
      price_data: { currency: 'usd', product: config.stripeProductIds[l.kind === 'pack' ? l.id : 'unit'], unit_amount: Math.round(l.unit_price * 100) },
      quantity: l.quantity
    }));
    if (summary.shipping > 0) lineItems.push({ price_data: { currency: 'usd', product_data: { name: 'Shipping' }, unit_amount: Math.round(summary.shipping * 100) }, quantity: 1 });
    const snap = orderSnapshot(parsed, { method: 'Stripe' });
    // Stripe: valores de metadata <= 500 caracteres -> pedido compacto partido en o0, o1, ...
    const metadata = { order_id: snap.id, currency: 'USD', total: summary.total.toFixed(2), ...toStripeMetadata(snap) };
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment', client_reference_id: snap.id, customer_email: buyer.email, line_items: lineItems,
        success_url: config.stripeSuccessUrl, cancel_url: config.stripeCancelUrl,
        billing_address_collection: 'auto', phone_number_collection: { enabled: true },
        payment_intent_data: { receipt_email: buyer.email, metadata }, metadata
      });
      orders.set(snap.id, snap); orders.set(session.id, snap);
      return res.json({ orderId: snap.id, id: session.id, url: session.url, subtotal: summary.subtotal, shippingCost: summary.shipping, total: summary.total });
    } catch (error) {
      logger.error('❌ Error creando sesión Stripe:', error.message);
      return res.status(502).json({ error: 'Error al crear sesión de Stripe' });
    }
  });

  const sanitizeReturnBaseUrl = (candidate) => {
    try { const u = new URL(candidate); if (allowed.includes(u.origin)) return u.origin; } catch { /* default */ }
    return config.paypalReturnBaseUrl;
  };

  app.post('/api/create-paypal-order', createLimiter, async (req, res) => {
    let parsed;
    try { parsed = parseUsdOrder(req.body); } catch (error) {
      if (error instanceof OrderError) return res.status(400).json({ error: error.message });
      return res.status(500).json({ error: 'Error interno' });
    }
    if (!paypal) return res.status(500).json({ error: 'PayPal no configurado' });
    const { summary, buyer } = parsed;
    const snap = orderSnapshot(parsed, { method: 'PayPal' });
    const returnBaseUrl = sanitizeReturnBaseUrl(req.body?.order?.returnBaseUrl || req.body?.orderData?.returnBaseUrl);
    const backend = (config.publicBackendUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const usd = (n) => Number(n).toFixed(2);
    const usShipping = !snap.pickup_store && buyer.country === 'US' && /^\d{5}(-\d{4})?$/.test(buyer.postalCode) && buyer.state.length === 2;
    try {
      const data = await paypal.createOrder({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: snap.id, custom_id: snap.id, invoice_id: snap.id, description: `FRESCHE ${snap.id}`, // custom_id <= 127
          amount: { currency_code: 'USD', value: usd(summary.total), breakdown: { item_total: { currency_code: 'USD', value: usd(summary.subtotal) }, shipping: { currency_code: 'USD', value: usd(summary.shipping) } } },
          items: snap.lines.map((l) => ({ name: l.title.slice(0, 127), description: String(l.variant || '').slice(0, 127), quantity: String(l.quantity), unit_amount: { currency_code: 'USD', value: usd(l.unit_price) } })),
          ...(usShipping ? { shipping: { name: { full_name: buyer.name.slice(0, 300) }, address: { address_line_1: buyer.address.slice(0, 300), address_line_2: buyer.notes.slice(0, 300) || undefined, admin_area_2: buyer.city.slice(0, 120), admin_area_1: buyer.state, postal_code: buyer.postalCode, country_code: 'US' } } } : {})
        }],
        application_context: { brand_name: 'FRESCHE', landing_page: 'LOGIN', user_action: 'PAY_NOW', return_url: `${backend}/api/paypal/capture-order?returnBaseUrl=${encodeURIComponent(returnBaseUrl)}`, cancel_url: `${returnBaseUrl}/payment-response.html?provider=paypal&status=cancel`, shipping_preference: usShipping ? 'SET_PROVIDED_ADDRESS' : 'NO_SHIPPING' }
      });
      const approveUrl = data?.links?.find((l) => l.rel === 'approve')?.href;
      if (!approveUrl) throw new Error('PayPal no devolvió URL de aprobación');
      orders.set(snap.id, snap); orders.set(data.id, snap);
      return res.json({ orderId: snap.id, id: data.id, url: approveUrl, subtotal: summary.subtotal, shippingCost: summary.shipping, total: summary.total });
    } catch (error) {
      logger.error('❌ Error creando orden PayPal:', error.message);
      return res.status(502).json({ error: 'Error al crear orden de PayPal' });
    }
  });

  app.get('/api/paypal/capture-order', async (req, res) => {
    const orderId = String(req.query.token || '');
    const returnBaseUrl = sanitizeReturnBaseUrl(req.query.returnBaseUrl);
    if (!/^[A-Z0-9]{10,30}$/.test(orderId) || !paypal) return res.redirect(`${returnBaseUrl}/payment-response.html?provider=paypal&status=failure`);
    try {
      const data = await paypal.captureOrder(orderId);
      const cap = data?.purchase_units?.[0]?.payments?.captures?.[0];
      if (data?.status === 'COMPLETED' && (!cap || cap.status === 'COMPLETED')) {
        const pu = data?.purchase_units?.[0] || {};
        let order = orders.get(pu.custom_id || cap?.custom_id) || orders.get(orderId);
        if (!order) { // servidor reiniciado: se reconstruye con lo que guarda PayPal (custom_id, ítems, dirección)
          const a = pu.shipping?.address || {};
          order = { id: pu.custom_id || cap?.custom_id || orderId, currency: 'USD', buyer: { name: pu.shipping?.name?.full_name || [data?.payer?.name?.given_name, data?.payer?.name?.surname].filter(Boolean).join(' '), email: data?.payer?.email_address, phone: data?.payer?.phone?.phone_number?.national_number, address: a.address_line_1, notes: a.address_line_2, city: a.admin_area_2, state: a.admin_area_1, postal_code: a.postal_code, country: a.country_code }, lines: (pu.items || []).map((i) => ({ title: i.name, variant: i.description, quantity: i.quantity, unit_price: i.unit_amount?.value })) };
        }
        await notifyConfirmed({ provider: 'PayPal', paymentId: cap?.id || orderId, status: `${cap?.status || data?.status} (orden ${orderId})`, order, amount: Number(cap?.amount?.value || order.total || 0), currency: 'USD' });
      }
      return res.redirect(`${returnBaseUrl}/payment-response.html?${new URLSearchParams({ provider: 'paypal', orderId: data?.id || orderId })}`);
    } catch (error) {
      logger.error('❌ Error capturando orden PayPal:', error.message);
      return res.redirect(`${returnBaseUrl}/payment-response.html?provider=paypal&status=failure`);
    }
  });

  // ---- Cotización (solo lectura): el checkout muestra los totales que calcula el servidor ----
  app.post('/api/quote', statusLimiter, (req, res) => {
    try {
      const o = req.body?.order || {};
      const { summary } = parseOrderRequest({ ...o, buyer: { name: 'Cliente', email: 'quote@fresche1.com', ...(o.buyer || {}), phone: '0000000000', address: 'N/A street', notes: '', city: o.buyer?.city || 'N/A', state: o.buyer?.country === 'US' ? 'NY' : '', postalCode: o.buyer?.country === 'US' ? '10001' : '' } }, { commissionPercent: req.body?.method === 'MERCADOPAGO' ? commissionPercent : 0 });
      return res.json({ currency: summary.currency, zone: summary.zone, zoneLabel: summary.zoneLabel, units: summary.units, freeShipping: summary.freeShipping, lines: summary.lines.map((l) => ({ title: l.title, quantity: l.quantity, unit_price: l.unit_price })), subtotal: summary.subtotal, shipping: summary.shipping, commission: summary.commission, total: summary.total });
    } catch (error) {
      if (error instanceof OrderError) return res.status(400).json({ error: error.message });
      return res.status(500).json({ error: 'Error interno' });
    }
  });

  // ---- Pagos manuales (Nequi / Bancolombia en COP, Zelle en USD): pedido calculado en servidor + email al dueño ----
  const MANUAL = { NEQUI: { name: 'Nequi', currency: 'COP' }, BANCOLOMBIA: { name: 'Transferencia Bancolombia', currency: 'COP' }, ZELLE: { name: 'Zelle', currency: 'USD' } };
  app.post('/api/manual-order', createLimiter, async (req, res) => {
    const m = MANUAL[String(req.body?.method || '')];
    if (!m) return res.status(400).json({ error: 'Método de pago inválido' });
    let parsed;
    try { parsed = parseOrderRequest(req.body?.order, { requireCurrency: m.currency }); } catch (error) {
      if (error instanceof OrderError) return res.status(400).json({ error: error.message });
      return res.status(500).json({ error: 'Error interno' });
    }
    const snap = orderSnapshot(parsed, { method: m.name });
    orders.set(snap.id, snap);
    let emailed = false;
    try { emailed = await sendOwner(`🕒 Pedido nuevo – pago pendiente de verificar (${m.name}) - ${snap.id} - ${snap.buyer.name}`, ownerEmailHtml({ kind: 'manual', provider: m.name, paymentId: 'pendiente (comprobante por WhatsApp)', status: 'pendiente de verificar', order: snap })); } catch (e) { logger.error('Error email pedido manual:', e.message); }
    const s = parsed.summary;
    return res.json({ orderId: snap.id, emailed, currency: s.currency, subtotal: s.subtotal, shipping: s.shipping, commission: s.commission, total: s.total, totalText: fmtMoney(s.total, s.currency) });
  });

  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Solicitud demasiado grande' });
    logger.error('Error no controlado:', err?.message);
    return res.status(500).json({ error: 'Error interno' });
  });

  return app;
}

export { ZONE_LABELS, PICKUP_LABELS };
