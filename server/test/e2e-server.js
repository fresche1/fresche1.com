// Backend local para pruebas E2E: app real con Mercado Pago SIMULADO (no llama a la API real).
import express from 'express';
import { createApp } from '../app.js';

const preferences = [];
const payments = new Map([
  ['555', { id: 555, status: 'approved', transaction_amount: 51000, currency_id: 'COP', external_reference: 'FRESCHE-E2E', metadata: { expected_total: 51000, currency: 'COP' } }],
  ['556', { id: 556, status: 'approved', transaction_amount: 10, currency_id: 'COP', external_reference: 'FRESCHE-E2E-LOW', metadata: { expected_total: 51000, currency: 'COP' } }]
]);
const paypalOrders = [];
const paypal = {
  async createOrder(body) { paypalOrders.push(body); return { id: `PPE2E${String(paypalOrders.length).padStart(8, '0')}`, links: [{ rel: 'approve', href: 'http://localhost:8080/index.html#paypal-mock' }] }; },
  async captureOrder() { return { status: 'COMPLETED' }; },
  async getOrder() { return null; }
};
// Stripe simulado solo para comprobar la vista "Stripe activo" (no se usa ninguna cuenta real)
const stripeMock = { checkout: { sessions: { async create() { return { id: 'cs_e2e', url: 'http://localhost:8080/index.html#stripe-mock' }; }, async retrieve() { return null; } } }, webhooks: { constructEvent() { throw new Error('no'); } } };
let stripeOn = false;
const makeApp = (stripe) => createApp({
  config: {
    allowedOrigins: process.env.ALLOWED_ORIGINS, publicSiteUrl: 'http://localhost:8080', publicBackendUrl: 'http://localhost:3001',
    mpWebhookSecret: process.env.MP_WEBHOOK_SECRET, mpCommissionPercent: 5, ownerEmail: 'owner@test.local',
    stripeProductIds: {}, paypalReturnBaseUrl: 'http://localhost:8080', rateLimitMax: 1000
  },
  mp: {
    async createPreference(body) { preferences.push(body); return { id: `pref-${preferences.length}`, init_point: 'http://localhost:8080/index.html#mp-mock' }; },
    async getPayment(id) { return payments.get(String(id)) || null; }
  },
  paypal, stripe,
  mailer: null
});
const appNoStripe = makeApp(null);
const appStripe = makeApp(stripeMock);
const outer = express();
outer.get('/__test/preferences', (_req, res) => res.json(preferences));
outer.get('/__test/paypal', (_req, res) => res.json(paypalOrders));
outer.get('/__test/stripe', (req, res) => { stripeOn = req.query.on === '1'; res.json({ stripeOn }); });
outer.use((req, res, next) => (stripeOn ? appStripe : appNoStripe)(req, res, next));
outer.listen(3001, () => console.log('E2E backend on 3001'));
