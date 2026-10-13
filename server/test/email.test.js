// El email al dueño debe traer TODOS los datos del pedido, para cada medio de pago.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, sign } from './helpers.js';
import { createApp } from '../app.js';
import { createOrderStore } from '../orders.js';

const buyerCO = { name: 'Ana <b>Pérez</b>', email: 'ana@example.com', phone: '+57 300 123 4567', address: 'Calle 45 #12-34 Apto 501', city: 'Medellín', state: 'Antioquia', notes: 'Barrio Laureles, portería', country: 'CO' };
const buyerUS = { name: 'Jane Doe', email: 'jane@example.com', phone: '+1 212 555 0100', address: '350 5th Ave Apt 7', city: 'New York', state: 'NY', postalCode: '10118', notes: 'Buzz 7B', country: 'US' };
const itemsCO = [{ productId: 'cherry', qty: 1 }, { packType: 'duo', productIds: ['velvet', 'coco'] }];
const itemsUS = [{ productId: 'eclipse', qty: 1 }, { productId: 'tobacco', qty: 1 }];

const COMMON_CO = ['Ana &lt;b&gt;Pérez&lt;/b&gt;', '+57 300 123 4567', 'ana@example.com', 'Colombia', 'Calle 45 #12-34 Apto 501', 'Barrio Laureles, portería', 'Medellín', 'Antioquia', 'FRESCHE CherryMood', 'CherryMood', 'Pack Dúo', 'Velvet, Coco &amp; Vainilla', 'Subtotal', 'Envío', 'Comisión', 'TOTAL', 'COP', 'hora Colombia'];
const COMMON_US = ['Jane Doe', '+1 212 555 0100', 'jane@example.com', 'Estados Unidos', '350 5th Ave Apt 7', 'Buzz 7B', 'New York', 'NY', '10118', 'FRESCHE Eclipse', 'FRESCHE Dulce Tobacco', '$19.99 USD', '$39.98 USD', '$9.99 USD', '$49.97 USD', 'USD', 'hora Colombia'];
const check = (html, list) => { for (const t of list) assert.ok(html.includes(t), `falta en el email: ${t}`); assert.ok(!html.includes('<b>Pérez'), 'HTML sin escapar'); };
const confirmed = (s) => s.calls.emails.filter((e) => e.subject.includes('CONFIRMADO'));

test('MP (CO): email CONFIRMADO con todo, aun tras reinicio (solo metadata de MP)', async (t) => {
  const s = await startApp(); t.after(s.close);
  const r = await s.post('/api/create-preference', { order: { items: itemsCO, shippingZone: 'central', buyer: buyerCO } });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.currency, 'COP');
  const pref = s.calls.preferences[0];
  assert.equal(pref.external_reference, pref.metadata.order_id);
  s.payments.set('9001', { id: 9001, status: 'approved', payment_method_id: 'pse', transaction_amount: pref.metadata.expected_total, currency_id: 'COP', external_reference: pref.external_reference, metadata: JSON.parse(JSON.stringify(pref.metadata)) });
  assert.equal((await s.post('/api/mercadopago-webhook?data.id=9001&type=payment', {}, sign('9001'))).status, 200);
  const h = confirmed(s)[0].html;
  // 40000 + 69999 = 109999; envío regional 13.800 (3 unidades -> gratis); comisión 5% = 5.500
  check(h, [...COMMON_CO, pref.external_reference, 'Mercado Pago', '9001', 'approved (pse)', '$109.999 COP', 'Gratis', '$5.500 COP', '$115.499 COP', '$40.000 COP', '$69.999 COP']);
  // pedido pendiente también completo
  check(s.calls.emails.find((e) => e.subject.includes('PENDIENTE')).html, COMMON_CO);
});

test('MP: tras reinicio del servidor (almacén vacío) el email sale de la metadata', async (t) => {
  const s = await startApp(); t.after(s.close);
  await s.post('/api/create-preference', { order: { items: itemsCO, shippingZone: 'central', buyer: buyerCO } });
  const pref = s.calls.preferences[0];
  const s2 = await startApp(); t.after(s2.close); // "reinicio": otra app sin pedidos guardados
  s2.payments.set('9002', { id: 9002, status: 'approved', transaction_amount: pref.metadata.expected_total, currency_id: 'COP', external_reference: pref.external_reference, metadata: JSON.parse(JSON.stringify(pref.metadata)) });
  await s2.post('/api/mercadopago-webhook?data.id=9002&type=payment', {}, sign('9002'));
  check(confirmed(s2)[0].html, [...COMMON_CO, pref.external_reference]);
});

test('Stripe (US): email CONFIRMADO completo, también reconstruido solo desde metadata (<=500 chars)', async (t) => {
  const s = await startApp(); t.after(s.close);
  const r = await s.post('/api/create-stripe-checkout-session', { order: { items: itemsUS, shippingZone: 'us', buyer: buyerUS } });
  assert.equal(r.status, 200);
  const { orderId } = await r.json();
  const sess = s.calls.stripeSessions[0];
  for (const v of Object.values(sess.metadata)) assert.ok(String(v).length <= 500);
  assert.equal(sess.client_reference_id, orderId);
  const event = { type: 'checkout.session.completed', data: { object: { id: 'cs_test_1234567890', payment_status: 'paid', payment_intent: 'pi_777', amount_total: 4997, currency: 'usd', client_reference_id: orderId, metadata: sess.metadata } } };
  await s.post('/api/stripe-webhook', JSON.stringify(event), { 'stripe-signature': 'good-sig' });
  await new Promise((x) => setTimeout(x, 20));
  check(confirmed(s)[0].html, [...COMMON_US, orderId, 'Stripe', 'pi_777']);
  const s2 = await startApp(); t.after(s2.close);
  await s2.post('/api/stripe-webhook', JSON.stringify(event), { 'stripe-signature': 'good-sig' });
  await new Promise((x) => setTimeout(x, 20));
  check(confirmed(s2)[0].html, [...COMMON_US, orderId, 'pi_777']);
});

test('PayPal (US): custom_id <= 127, dirección enviada a PayPal, email CONFIRMADO completo', async (t) => {
  const s = await startApp(); t.after(s.close);
  const r = await s.post('/api/create-paypal-order', { order: { items: itemsUS, shippingZone: 'us', buyer: buyerUS } });
  const { orderId } = await r.json();
  const pu = s.calls.paypalOrders[0].purchase_units[0];
  assert.equal(pu.custom_id, orderId); assert.ok(pu.custom_id.length <= 127);
  assert.equal(pu.amount.value, '49.97'); assert.equal(pu.amount.currency_code, 'USD');
  assert.equal(pu.shipping.address.postal_code, '10118');
  await s.get('/api/paypal/capture-order?token=PAYPALORDER123');
  check(confirmed(s)[0].html, [...COMMON_US, orderId, 'PayPal', 'CAPTURE999']);
});

test('PayPal: tras reinicio se reconstruye desde custom_id, ítems y dirección de PayPal', async (t) => {
  const s = await startApp(); t.after(s.close);
  await s.post('/api/create-paypal-order', { order: { items: itemsUS, shippingZone: 'us', buyer: buyerUS } });
  const pu = s.calls.paypalOrders[0].purchase_units[0];
  const s2 = await startApp(); t.after(s2.close);
  s2.paypal.captureOrder = async (id) => ({ id, status: 'COMPLETED', payer: { email_address: 'jane@example.com' }, purchase_units: [{ ...pu, payments: { captures: [{ id: 'CAP2', status: 'COMPLETED', amount: { value: '49.97', currency_code: 'USD' } }] } }] });
  await s2.get('/api/paypal/capture-order?token=PAYPALORDER123');
  const h = confirmed(s2)[0].html;
  for (const x of [pu.custom_id, 'Jane Doe', 'jane@example.com', '350 5th Ave Apt 7', 'Buzz 7B', 'New York', 'NY', '10118', 'FRESCHE Eclipse', '$49.97 USD']) assert.ok(h.includes(x), `falta ${x}`);
});

test('Manual (Nequi CO y Zelle US): "Pedido nuevo – pago pendiente de verificar" completo; moneda forzada', async (t) => {
  const s = await startApp(); t.after(s.close);
  const r1 = await s.post('/api/manual-order', { method: 'NEQUI', order: { items: itemsCO, shippingZone: 'central', buyer: buyerCO } });
  assert.equal(r1.status, 200);
  const d1 = await r1.json();
  assert.equal(d1.currency, 'COP'); assert.equal(d1.total, 109999);
  const m1 = s.calls.emails.at(-1);
  assert.ok(m1.subject.includes('Pedido nuevo – pago pendiente de verificar'));
  check(m1.html, [...COMMON_CO.filter((x) => x !== 'Comisión'), d1.orderId, 'Nequi', '$109.999 COP']);
  const r2 = await s.post('/api/manual-order', { method: 'ZELLE', order: { items: itemsUS, shippingZone: 'us', buyer: buyerUS } });
  const d2 = await r2.json();
  assert.equal(d2.currency, 'USD');
  check(s.calls.emails.at(-1).html, [...COMMON_US, d2.orderId, 'Zelle']);
  // Zelle con dirección en Colombia -> rechazado (CO = COP); método desconocido -> 400
  assert.equal((await s.post('/api/manual-order', { method: 'ZELLE', order: { items: itemsCO, shippingZone: 'central', buyer: buyerCO } })).status, 400);
  assert.equal((await s.post('/api/manual-order', { method: 'NEQUI', order: { items: itemsUS, shippingZone: 'us', buyer: buyerUS } })).status, 400);
  assert.equal((await s.post('/api/manual-order', { method: 'BTC', order: { items: itemsUS, shippingZone: 'us', buyer: buyerUS } })).status, 400);
});

test('Recogida gratis NY/NJ: el email trae el punto de recogida', async (t) => {
  const s = await startApp(); t.after(s.close);
  await s.post('/api/manual-order', { method: 'ZELLE', order: { items: itemsUS, shippingZone: 'pickup', pickupStore: 'US', buyer: { name: 'Bob', email: 'bob@example.com', phone: '+1 555 222 3333' } } });
  const h = s.calls.emails.at(-1).html;
  for (const x of ['Recoger en tienda', 'New Jersey', 'Bob', '$39.98 USD']) assert.ok(h.includes(x), x);
});

test('Almacén JSON: persiste y se recarga', async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fr-')), 'orders.json');
  const st = createOrderStore({ file }); st.set('A', { id: 'A' });
  await new Promise((x) => setTimeout(x, 100));
  assert.equal(createOrderStore({ file }).get('A').id, 'A');
  assert.ok(createApp);
});

test('/api/quote: CO=COP, US=USD; totales del servidor', async (t) => {
  const s = await startApp(); t.after(s.close);
  const q = async (o, method) => (await s.post('/api/quote', { order: o, method })).json();
  const co = await q({ items: [{ productId: 'cherry', qty: 1 }], shippingZone: 'bogota', buyer: { country: 'CO', city: 'Bogotá' } }, 'MERCADOPAGO');
  assert.deepEqual([co.currency, co.subtotal, co.shipping, co.commission, co.total], ['COP', 40000, 9000, 2000, 51000]);
  const us = await q({ items: [{ productId: 'cherry', qty: 1 }], shippingZone: 'us', buyer: { country: 'US', currency: 'COP' } });
  assert.deepEqual([us.currency, us.shipping, us.total], ['USD', 9.99, 29.98]);
  const mx = await q({ items: [{ productId: 'cherry', qty: 1 }], shippingZone: 'international', buyer: { country: 'MX' }, currency: 'COP' });
  assert.equal(mx.currency, 'USD');
});
