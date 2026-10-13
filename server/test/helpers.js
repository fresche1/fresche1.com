import crypto from 'node:crypto';
import { createApp } from '../app.js';

export const SECRET = 'test-webhook-secret';
const silent = { log() {}, warn() {}, error() {} };

export function makeMocks() {
  const calls = { preferences: [], payments: [], emails: [], stripeSessions: [], paypalOrders: [] };
  const payments = new Map();
  const mp = {
    async createPreference(body) { calls.preferences.push(body); return { id: `pref-${calls.preferences.length}`, init_point: 'https://mp.example/checkout' }; },
    async getPayment(id) { calls.payments.push(id); return payments.get(String(id)) || null; }
  };
  const stripe = {
    checkout: { sessions: {
      async create(b) { calls.stripeSessions.push(b); return { id: 'cs_test_1234567890', url: 'https://stripe.example/s' }; },
      async retrieve(id) { return { id, payment_status: id.includes('paid') ? 'paid' : 'unpaid', amount_total: 3499, currency: 'usd' }; }
    } },
    webhooks: { constructEvent(body, sig) { if (sig !== 'good-sig') throw new Error('bad'); return JSON.parse(body.toString()); } }
  };
  const paypal = {
    async createOrder(b) { calls.paypalOrders.push(b); return { id: 'PAYPALORDER123', links: [{ rel: 'approve', href: 'https://paypal.example/a' }] }; },
    async captureOrder(id) { return { id, status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAPTURE999', status: 'COMPLETED', amount: { value: '69.99', currency_code: 'USD' } }] } }] }; },
    async getOrder(id) { return { id, status: id.startsWith('DONE') ? 'COMPLETED' : 'APPROVED', purchase_units: [{ amount: { value: '19.99', currency_code: 'USD' } }] }; }
  };
  const mailer = { async send(m) { calls.emails.push(m); } };
  return { mp, stripe, paypal, mailer, calls, payments };
}

export async function startApp(overrides = {}) {
  const mocks = makeMocks();
  const app = createApp({
    config: {
      allowedOrigins: 'https://fresche1.com,https://www.fresche1.com', publicSiteUrl: 'https://fresche1.com',
      publicBackendUrl: 'https://api.test', mpWebhookSecret: SECRET, mpCommissionPercent: 5, stripeWebhookSecret: 'whsec_test',
      stripeProductIds: { unit: 'p_u', duo: 'p_d', trio: 'p_t', elella: 'p_e' }, stripeSuccessUrl: 'https://s', stripeCancelUrl: 'https://c',
      paypalReturnBaseUrl: 'https://fresche1.com', rateLimitMax: 1000, ...overrides.config
    },
    mp: mocks.mp, stripe: mocks.stripe, paypal: mocks.paypal, mailer: mocks.mailer, logger: silent
  });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { ...mocks, base, post, get: (p, h) => fetch(base + p, { headers: h }), close: () => new Promise((r) => server.close(r)) };
}

export function sign(dataId, requestId = 'req-1', ts = String(Date.now()), secret = SECRET) {
  const v1 = crypto.createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId };
}

export const buyerCO = { name: 'Ana Pérez', email: 'ana@example.com', phone: '+57 300 123 4567', address: 'Calle 1 #2-3', city: 'Bogotá', state: 'Cundinamarca', country: 'CO' };
