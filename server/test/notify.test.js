import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, sign, buyerCO } from './helpers.js';
import { parseOwnerEmails } from '../app.js';
import { fromStripeMetadata } from '../orders.js';

const OWNERS = ['fresche@fresche1.com', 'galindo243@live.com'];
const confirmed = (s) => s.calls.emails.filter((e) => e.subject.includes('CONFIRMADO'));

test('OWNER_EMAIL: por defecto ambos correos; lista separada por comas permitida', () => {
  assert.deepEqual(parseOwnerEmails(undefined), OWNERS);
  assert.deepEqual(parseOwnerEmails(''), OWNERS);
  assert.deepEqual(parseOwnerEmails(' a@x.co , b@y.co,a@x.co, basura '), ['a@x.co', 'b@y.co']);
});

test('Mercado Pago: pago verificado -> email CONFIRMADO completo a ambos dueños', async (t) => {
  const s = await startApp(); t.after(s.close);
  const r = await s.post('/api/create-preference', { order: { items: [{ productId: 'cherry', qty: 1 }], shippingZone: 'bogota', buyer: buyerCO } });
  assert.equal(r.status, 200);
  const pref = s.calls.preferences[0];
  s.payments.set('8001', { id: 8001, status: 'approved', transaction_amount: pref.metadata.expected_total, currency_id: 'COP', external_reference: pref.external_reference, metadata: pref.metadata });
  assert.equal((await s.post('/api/mercadopago-webhook?data.id=8001&type=payment', { type: 'payment', data: { id: '8001' } }, sign('8001'))).status, 200);
  const mails = confirmed(s);
  assert.equal(mails.length, 1);
  assert.deepEqual(mails[0].to, OWNERS);
  const h = mails[0].html;
  for (const txt of ['Mercado Pago', '8001', pref.external_reference, 'Ana P', '+57 300 123 4567', 'ana@example.com', 'FRESCHE CherryMood', 'Bogotá y Sabana', 'Calle 1 #2-3', '$9.000 COP', '$2.000 COP', '$51.000 COP']) {
    assert.ok(h.includes(txt), `falta en el email: ${txt}`);
  }
  // también el aviso de "pedido pendiente" va a ambos
  assert.deepEqual(s.calls.emails.find((e) => e.subject.includes('PENDIENTE')).to, OWNERS);
});

test('Mercado Pago: pago NO aprobado o webhook inválido -> no se envía email', async (t) => {
  const s = await startApp(); t.after(s.close);
  s.payments.set('8002', { id: 8002, status: 'pending', transaction_amount: 51000, currency_id: 'COP', metadata: { expected_total: 51000, currency: 'COP' } });
  await s.post('/api/mercadopago-webhook?data.id=8002&type=payment', { type: 'payment', data: { id: '8002' } }, sign('8002'));
  await s.post('/api/mercadopago-webhook?data.id=8002&type=payment', { type: 'payment', data: { id: '8002' } });
  assert.equal(confirmed(s).length, 0);
});

test('Stripe: checkout.session.completed pagado -> email CONFIRMADO a ambos con detalle', async (t) => {
  const s = await startApp(); t.after(s.close);
  const r = await s.post('/api/create-stripe-checkout-session', { order: { items: [{ packType: 'duo', productIds: ['cherry', 'velvet'] }], shippingZone: 'pickup', pickupStore: 'US', buyer: { name: 'Bob Smith', email: 'bob@example.com', phone: '+1 555 123 4567' } } });
  assert.equal(r.status, 200);
  const event = { type: 'checkout.session.completed', data: { object: { id: 'cs_test_1234567890', payment_status: 'paid', payment_intent: 'pi_123', amount_total: 3499, currency: 'usd' } } };
  assert.equal((await s.post('/api/stripe-webhook', JSON.stringify(event), { 'stripe-signature': 'bad' })).status, 400);
  assert.equal((await s.post('/api/stripe-webhook', JSON.stringify(event), { 'stripe-signature': 'good-sig' })).status, 200);
  await s.post('/api/stripe-webhook', JSON.stringify(event), { 'stripe-signature': 'good-sig' }); // reintento: no duplica
  await new Promise((r2) => setTimeout(r2, 20));
  const mails = confirmed(s);
  assert.equal(mails.length, 1);
  assert.deepEqual(mails[0].to, OWNERS);
  for (const txt of ['Stripe', 'pi_123', 'Bob Smith', '+1 555 123 4567', 'bob@example.com', 'Pack Dúo', 'Tienda USA', '$34.99 USD']) assert.ok(mails[0].html.includes(txt), `falta: ${txt}`);
  // metadata de Stripe también lleva el pedido (respaldo si el servidor se reinicia)
  assert.ok(fromStripeMetadata(s.calls.stripeSessions[0].metadata).buyer.phone);
});

test('PayPal: captura completada -> email CONFIRMADO a ambos con detalle', async (t) => {
  const s = await startApp(); t.after(s.close);
  await s.post('/api/create-paypal-order', { order: { items: [{ packType: 'elella', productIds: ['cherry', 'velvet', 'coco', 'eclipse', 'tobacco'] }], shippingZone: 'international', buyer: { name: 'Carla Díaz', email: 'carla@example.com', phone: '+1 555 000 1111', address: '1 Main St', city: 'Miami', state: 'FL', postalCode: '33101', country: 'US' } } });
  const r = await fetch(`${s.base}/api/paypal/capture-order?token=PAYPALORDER123&returnBaseUrl=https://fresche1.com`, { redirect: 'manual' });
  assert.equal(r.status, 302);
  assert.ok(!r.headers.get('location').includes('status=success'));
  const mails = confirmed(s);
  assert.equal(mails.length, 1);
  assert.deepEqual(mails[0].to, OWNERS);
  for (const txt of ['PayPal', 'CAPTURE999', 'PAYPALORDER123', 'Carla D', '+1 555 000 1111', 'carla@example.com', 'Pack ÉL &amp; ELLA', '1 Main St', 'Miami', '33101', 'Envío EE. UU. desde Nueva York', 'Gratis', '$69.99 USD']) assert.ok(mails[0].html.includes(txt), `falta: ${txt}`);
});

test('PayPal: monto capturado menor al total del pedido -> email marcado NO VERIFICADO', async (t) => {
  const s = await startApp(); t.after(s.close);
  await s.post('/api/create-paypal-order', { order: { items: [{ packType: 'elella', productIds: ['cherry', 'velvet', 'coco', 'eclipse', 'tobacco'] }], shippingZone: 'international', buyer: { name: 'Carla Díaz', email: 'carla@example.com', phone: '+1 555 000 1111', address: '1 Main St', city: 'Miami', state: 'FL', postalCode: '33101', country: 'US' } } });
  s.paypal.captureOrder = async (id) => ({ id, status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAPTURE1', status: 'COMPLETED', amount: { value: '1.00', currency_code: 'USD' } }] } }] });
  await fetch(`${s.base}/api/paypal/capture-order?token=PAYPALORDER123`, { redirect: 'manual' });
  const mails = confirmed(s);
  assert.equal(mails.length, 1);
  assert.ok(mails[0].html.includes('NO VERIFICADO'));
});

test('OWNER_EMAIL personalizado (env) se respeta', async (t) => {
  const s = await startApp({ config: { ownerEmail: 'solo@fresche1.com' } }); t.after(s.close);
  await s.post('/api/create-preference', { order: { items: [{ productId: 'cherry', qty: 1 }], shippingZone: 'pickup', pickupStore: 'CO', buyer: buyerCO } });
  const pref = s.calls.preferences[0];
  s.payments.set('9001', { id: 9001, status: 'approved', transaction_amount: pref.metadata.expected_total, currency_id: 'COP', external_reference: pref.external_reference, metadata: pref.metadata });
  await s.post('/api/mercadopago-webhook?data.id=9001&type=payment', { type: 'payment', data: { id: '9001' } }, sign('9001'));
  assert.deepEqual(confirmed(s)[0].to, ['solo@fresche1.com']);
  assert.ok(confirmed(s)[0].html.includes('Tienda Colombia'));
});
