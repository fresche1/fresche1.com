// Arranque del backend FRESCHE (Mercado Pago + Stripe + PayPal + Resend).
import dotenv from 'dotenv';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { Resend } from 'resend';
import Stripe from 'stripe';
import { createApp } from './app.js';

dotenv.config();
const env = process.env;

const MP_ACCESS_TOKEN = env.MP_ACCESS_TOKEN || env.MERCADOPAGO_ACCESS_TOKEN;
const PAYPAL_BASE_URL = env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

const missing = ['MP_WEBHOOK_SECRET', 'ALLOWED_ORIGINS'].filter((k) => !env[k]);
if (!MP_ACCESS_TOKEN) missing.push('MP_ACCESS_TOKEN (o MERCADOPAGO_ACCESS_TOKEN)');
if (missing.length) console.warn('⚠️ Variables faltantes:', missing.join(', '));

let mp = null;
if (MP_ACCESS_TOKEN) {
  const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
  mp = {
    async createPreference(body) { return new Preference(client).create({ body }); },
    async getPayment(id) {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`MP API ${r.status}`);
      return r.json();
    }
  };
}

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

let paypal = null;
if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) {
  const token = async () => {
    const credentials = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64');
    const r = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
    const d = await r.json();
    if (!r.ok || !d.access_token) throw new Error('No se pudo autenticar con PayPal');
    return d.access_token;
  };
  const call = async (method, path, body) => {
    const r = await fetch(`${PAYPAL_BASE_URL}${path}`, { method, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || `PayPal ${r.status}`);
    return d;
  };
  paypal = {
    createOrder: (body) => call('POST', '/v2/checkout/orders', body),
    captureOrder: (id) => call('POST', `/v2/checkout/orders/${encodeURIComponent(id)}/capture`),
    getOrder: (id) => call('GET', `/v2/checkout/orders/${encodeURIComponent(id)}`)
  };
}

let mailer = null;
if (env.RESEND_API_KEY) {
  const resend = new Resend(env.RESEND_API_KEY);
  mailer = {
    async send({ to, subject, html }) {
      const r = await resend.emails.send({ from: env.RESEND_FROM_EMAIL || 'onboarding@resend.dev', to, subject, html });
      if (r.error) throw new Error(r.error.message);
      return r.data;
    }
  };
}

const app = createApp({
  config: {
    allowedOrigins: env.ALLOWED_ORIGINS,
    publicSiteUrl: env.PUBLIC_SITE_URL || 'https://fresche1.com',
    publicBackendUrl: env.PUBLIC_BACKEND_URL || 'https://fresche1-payments-api.onrender.com',
    mpWebhookSecret: env.MP_WEBHOOK_SECRET,
    mpCommissionPercent: env.MP_COMMISSION_PERCENT ?? 5,
    ownerEmail: env.OWNER_EMAIL || 'fresche@fresche1.com,galindo243@live.com',
    adminToken: env.ADMIN_TOKEN || '',
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    stripeSuccessUrl: env.STRIPE_SUCCESS_URL || 'https://fresche1.com/payment-response.html?provider=stripe&session_id={CHECKOUT_SESSION_ID}',
    stripeCancelUrl: env.STRIPE_CANCEL_URL || 'https://fresche1.com/checkout.html?provider=stripe&status=cancel',
    stripeProductIds: { unit: 'prod_UNwnncIoeJHyB1', duo: 'prod_UNwjRRVqNpodxb', trio: 'prod_UNwkHuK7xakaWH', elella: 'prod_UNwkUUVV3ijlex' },
    paypalReturnBaseUrl: env.PAYPAL_RETURN_BASE_URL || 'https://fresche1.com',
    rateLimitMax: Number(env.RATE_LIMIT_MAX) || 20,
    orderStoreFile: env.ORDER_STORE_FILE || '' // opcional; en Render sin disco persistente se pierde al reiniciar
  },
  mp, stripe, paypal, mailer
});

const PORT = env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Backend FRESCHE escuchando en puerto ${PORT}`));
