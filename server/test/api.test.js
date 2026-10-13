import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, sign, buyerCO, SECRET } from './helpers.js';
import { verifyMercadoPagoSignature } from '../app.js';

test('create-preference: ignora precios del cliente y calcula en el servidor', async (t) => {
  const s = await startApp(); t.after(s.close);
  const r = await s.post('/api/create-preference', { order: {
    items: [{ productId: 'cherry', qty: 1, unit_price: 1, price: 1 }, { packType: 'duo', productIds: ['velvet', 'coco'], unit_price: 1 }],
    shippingZone: 'bogota', shippingCost: 0, commission: 0, total: 1, buyer: { ...buyerCO, city: 'Medellín' }
  } });
  assert.equal(r.status, 200);
  const data = await r.json();
  const pref = s.calls.preferences[0];
  const total = pref.items.reduce((a, i) => a + i.unit_price * i.quantity, 0);
  assert.equal(data.subtotal, 109999); assert.equal(data.shipping, 0); assert.equal(data.freeShipping, true); assert.equal(data.commission, 5500);
  assert.equal(total, 109999 + 0 + 5500); assert.equal(data.total, total);
  assert.equal(pref.notification_url, 'https://api.test/api/mercadopago-webhook');
  assert.equal(pref.metadata.expected_total, total);
  assert.ok(pref.items.every((i) => i.currency_id === 'COP'));
  assert.ok(!pref.back_urls.success.includes('status='));
});

test('create-preference: cada zona de envío', async (t) => {
  const s = await startApp(); t.after(s.close);
  for (const [city, ship] of [['Bogotá', 9000], ['Ibagué', 13800], ['San Andrés', 21000]]) {
    const d = await (await s.post('/api/create-preference', { order: { items: [{ productId: 'eclipse', qty: 1 }], shippingZone: 'bogota', buyer: { ...buyerCO, city } } })).json();
    assert.equal(d.shipping, ship); assert.equal(d.total, 40000 + ship + 2000);
  }
  const d = await (await s.post('/api/create-preference', { order: { items: [{ productId: 'eclipse', qty: 1 }], shippingZone: 'pickup', pickupStore: 'CO', buyer: { name: 'Ana', email: 'a@b.co' } } })).json();
  assert.equal(d.shipping, 0); assert.equal(d.total, 42000); assert.equal(d.currency, 'COP');
});

test('create-preference: rechaza formato legado y entradas inválidas', async (t) => {
  const s = await startApp(); t.after(s.close);
  assert.equal((await s.post('/api/create-preference', { preference: { items: [{ title: 'x', unit_price: 1, quantity: 1 }] } })).status, 409);
  const bad = [
    { items: [{ productId: 'cherry', qty: -2 }], shippingZone: 'pickup', pickupStore: 'CO', buyer: buyerCO },
    { items: [{ productId: 'gold', qty: 1 }], shippingZone: 'pickup', pickupStore: 'CO', buyer: buyerCO },
    { items: [{ productId: 'cherry', qty: 1000 }], shippingZone: 'pickup', pickupStore: 'CO', buyer: buyerCO },
    { items: [{ productId: 'cherry', qty: 1 }], shippingZone: 'pickup', pickupStore: 'CO', buyer: { ...buyerCO, email: 'no-email' } },
    { items: [{ productId: 'cherry', qty: 1 }], shippingZone: 'bogota', buyer: { ...buyerCO, address: '' } },
    { items: [{ productId: 'cherry', qty: 1 }], shippingZone: 'pickup', buyer: buyerCO },
    { items: [{ productId: 'cherry', qty: 1 }], shippingZone: 'pickup', pickupStore: 'CO', buyer: { ...buyerCO, name: 'x'.repeat(500) } }
  ];
  for (const order of bad) assert.equal((await s.post('/api/create-preference', { order })).status, 400, JSON.stringify(order).slice(0, 80));
  assert.equal((await s.post('/api/create-preference', '{bad json')).status, 400);
  assert.equal(s.calls.preferences.length, 0);
});

test('rate limit de creación de preferencias', async (t) => {
  const s = await startApp({ config: { rateLimitMax: 3 } }); t.after(s.close);
  const order = { items: [{ productId: 'cherry', qty: 1 }], shippingZone: 'pickup', pickupStore: 'CO', buyer: buyerCO };
  const codes = []; for (let i = 0; i < 5; i++) codes.push((await s.post('/api/create-preference', { order })).status);
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
});

test('CORS: solo fresche1.com / www', async (t) => {
  const s = await startApp(); t.after(s.close);
  const ok = await s.get('/health', { Origin: 'https://www.fresche1.com' });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://www.fresche1.com');
  for (const o of ['https://evil.com', 'http://localhost:8080', 'https://fresche1.com.evil.com']) {
    assert.equal((await s.get('/health', { Origin: o })).headers.get('access-control-allow-origin'), null, o);
  }
});

test('send-email deshabilitado, test-email exige token', async (t) => {
  const s = await startApp({ config: { adminToken: 'tok-123' } }); t.after(s.close);
  assert.equal((await s.post('/api/send-email', { to: 'x@y.z', subject: 's', html: '<b>' })).status, 410);
  assert.equal((await s.get('/api/test-email')).status, 404);
  assert.equal((await s.get('/api/test-email', { 'x-admin-token': 'tok-123' })).status, 200);
});

test('webhook: firma inválida rechazada, válida aceptada, idempotente', async (t) => {
  const s = await startApp(); t.after(s.close);
  s.payments.set('123456', { id: 123456, status: 'approved', transaction_amount: 51000, currency_id: 'COP', external_reference: 'FRESCHE-1', metadata: { expected_total: 51000, currency: 'COP' } });
  const body = { type: 'payment', data: { id: '123456' } };
  assert.equal((await s.post('/api/mercadopago-webhook?data.id=123456&type=payment', body)).status, 401);
  assert.equal((await s.post('/api/mercadopago-webhook?data.id=123456&type=payment', body, sign('123456', 'r', '1', 'wrong-secret'))).status, 401);
  assert.equal((await s.post('/api/mercadopago-webhook?data.id=123456&type=payment', body, { 'x-signature': 'ts=1,v1=zz', 'x-request-id': 'r' })).status, 401);
  // firma válida pero para otro id -> rechazada
  assert.equal((await s.post('/api/mercadopago-webhook?data.id=123456&type=payment', body, sign('999'))).status, 401);
  const good = await s.post('/api/mercadopago-webhook?data.id=123456&type=payment', body, sign('123456'));
  assert.equal(good.status, 200);
  assert.deepEqual(s.calls.payments, ['123456']);
  assert.equal(s.calls.emails.filter((e) => e.subject.includes('CONFIRMADO')).length, 1);
  const dup = await s.post('/api/mercadopago-webhook?data.id=123456&type=payment', body, sign('123456', 'req-2'));
  assert.equal(dup.status, 200); assert.equal((await dup.json()).duplicate, true);
  assert.equal(s.calls.emails.filter((e) => e.subject.includes('CONFIRMADO')).length, 1);
});

test('webhook: pago aprobado con monto menor NO se marca como pagado', async (t) => {
  const s = await startApp(); t.after(s.close);
  s.payments.set('777', { id: 777, status: 'approved', transaction_amount: 1000, currency_id: 'COP', metadata: { expected_total: 51000, currency: 'COP' } });
  assert.equal((await s.post('/api/mercadopago-webhook?data.id=777&type=payment', { type: 'payment', data: { id: '777' } }, sign('777'))).status, 200);
  assert.equal(s.calls.emails.length, 0);
  const st = await (await s.get('/api/payment-status?payment_id=777')).json();
  assert.equal(st.approved, false); assert.equal(st.status, 'approved');
});

test('webhook sin MP_WEBHOOK_SECRET configurado falla cerrado', async (t) => {
  const s = await startApp({ config: { mpWebhookSecret: '' } }); t.after(s.close);
  assert.equal((await s.post('/api/mercadopago-webhook?data.id=1&type=payment', {}, sign('1'))).status, 401);
});

test('verifyMercadoPagoSignature: ejemplo manual', () => {
  const h = sign('abc123', 'rid', '1700000000'); // MP firma el id alfanumérico en minúsculas
  assert.equal(verifyMercadoPagoSignature({ signatureHeader: h['x-signature'], requestId: 'rid', dataId: 'abc123', secret: SECRET }), true);
});

test('payment-status: consulta MP y responde estado verificado', async (t) => {
  const s = await startApp(); t.after(s.close);
  s.payments.set('42', { id: 42, status: 'approved', transaction_amount: 42000, currency_id: 'COP', external_reference: 'FRESCHE-9', metadata: { expected_total: 42000, currency: 'COP' }, payer: { email: 'secret@x.com' } });
  s.payments.set('43', { id: 43, status: 'rejected', transaction_amount: 42000, currency_id: 'COP', metadata: { expected_total: 42000, currency: 'COP' } });
  const ok = await (await s.get('/api/payment-status?payment_id=42')).json();
  assert.deepEqual(ok, { provider: 'mercadopago', verified: true, status: 'approved', approved: true, amount: 42000, currency: 'COP', reference: 'FRESCHE-9' });
  assert.equal((await (await s.get('/api/payment-status?payment_id=43')).json()).approved, false);
  assert.equal((await s.get('/api/payment-status?payment_id=99')).status, 404);
  assert.equal((await s.get('/api/payment-status?payment_id=%3Cscript%3E')).status, 400);
  assert.equal((await (await s.get('/api/payment-status?provider=stripe&session_id=cs_test_paid_123456')).json()).approved, true);
  assert.equal((await (await s.get('/api/payment-status?provider=stripe&session_id=cs_test_open_123456')).json()).approved, false);
  assert.equal((await (await s.get('/api/payment-status?provider=paypal&orderId=DONE1234567')).json()).approved, true);
  assert.equal((await (await s.get('/api/payment-status?provider=paypal&orderId=PEND1234567')).json()).approved, false);
});

test('Stripe y PayPal: precios del servidor, también con carrito legado', async (t) => {
  const s = await startApp(); t.after(s.close);
  const r = await s.post('/api/create-stripe-checkout-session', { orderData: { email: 'a@b.co', fullName: 'Bob', country: 'US', shippingMethod: 'free', cart: [{ id: 'cherry', quantity: 3, price: 0.01 }] } });
  assert.equal(r.status, 200);
  assert.equal(s.calls.stripeSessions[0].line_items[0].price_data.unit_amount, 1699);
  const p = await s.post('/api/create-paypal-order', { order: { items: [{ packType: 'elella', productIds: ['cherry', 'velvet', 'coco', 'eclipse', 'tobacco'] }], shippingZone: 'pickup', pickupStore: 'US', buyer: { name: 'Bob', email: 'b@c.co' } } });
  assert.equal(p.status, 200);
  assert.equal(s.calls.paypalOrders[0].purchase_units[0].amount.value, '69.99');
  assert.equal((await s.post('/api/create-stripe-checkout-session', { orderData: { email: 'a@b.co', fullName: 'Bob', cart: [{ id: 'cherry', quantity: -3 }] } })).status, 400);
});

test('EE. UU.: Stripe/PayPal cobran envío como línea; dirección US inválida rechazada', async (t) => {
  const s = await startApp(); t.after(s.close);
  const buyerUS = { name: 'Jane Doe', email: 'jane@example.com', phone: '+1 212 555 0100', address: '350 5th Ave', city: 'New York', state: 'NY', postalCode: '10118', country: 'US' };
  const r = await s.post('/api/create-stripe-checkout-session', { order: { items: [{ productId: 'cherry', qty: 1, unit_price: 0.01 }], shippingZone: 'us', buyer: buyerUS } });
  assert.equal(r.status, 200);
  const d = await r.json(); assert.equal(d.total, 29.98); assert.equal(d.shippingCost, 9.99);
  const li = s.calls.stripeSessions[0].line_items;
  assert.deepEqual(li.map((l) => l.price_data.unit_amount * l.quantity), [1999, 999]);
  assert.equal(li[1].price_data.product_data.name, 'Shipping');
  const p = await s.post('/api/create-paypal-order', { order: { items: [{ packType: 'duo', productIds: ['cherry', 'velvet'] }], shippingZone: 'us', buyer: buyerUS } });
  assert.equal(p.status, 200);
  assert.deepEqual(s.calls.paypalOrders[0].purchase_units[0].amount, { currency_code: 'USD', value: '44.98', breakdown: { item_total: { currency_code: 'USD', value: '34.99' }, shipping: { currency_code: 'USD', value: '9.99' } } });
  const free = await (await s.post('/api/create-stripe-checkout-session', { order: { items: [{ packType: 'trio', productIds: ['cherry', 'velvet', 'coco'] }], shippingZone: 'us', buyer: buyerUS } })).json();
  assert.equal(free.shippingCost, 0); assert.equal(free.total, 44.99);
  const pick = await (await s.post('/api/create-stripe-checkout-session', { order: { items: [{ productId: 'cherry', qty: 1 }], shippingZone: 'pickup', pickupStore: 'US', buyer: { name: 'Jane', email: 'jane@example.com' } } })).json();
  assert.equal(pick.shippingCost, 0); assert.equal(pick.total, 19.99);
  for (const bad of [{ state: 'XX' }, { state: '' }, { postalCode: '1234' }, { postalCode: 'ABCDE' }, { postalCode: '' }, { address: '' }, { phone: '' }]) {
    const res = await s.post('/api/create-stripe-checkout-session', { order: { items: [{ productId: 'cherry', qty: 1 }], shippingZone: 'us', buyer: { ...buyerUS, ...bad } } });
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
  // estado en minúsculas se normaliza; ZIP+4 válido
  assert.equal((await s.post('/api/create-paypal-order', { order: { items: [{ productId: 'cherry', qty: 1 }], shippingZone: 'us', buyer: { ...buyerUS, state: 'nj', postalCode: '07030-1234' } } })).status, 200);
});

test('/api/config: stripeEnabled según configuración', async (t) => {
  const s = await startApp(); t.after(s.close);
  assert.deepEqual(await (await s.get('/api/config')).json(), { stripeEnabled: true, paypalEnabled: true, mercadopagoEnabled: true });
  const { createApp } = await import('../app.js');
  const app = createApp({ config: { allowedOrigins: '', publicSiteUrl: 'https://fresche1.com', stripeProductIds: {} }, mp: null, stripe: null, paypal: { getOrder() {} }, mailer: null, logger: { log() {}, warn() {}, error() {} } });
  const srv = await new Promise((r) => { const x = app.listen(0, () => r(x)); }); t.after(() => srv.close());
  const cfg = await (await fetch(`http://127.0.0.1:${srv.address().port}/api/config`)).json();
  assert.equal(cfg.stripeEnabled, false); assert.equal(cfg.paypalEnabled, true);
  const r = await fetch(`http://127.0.0.1:${srv.address().port}/api/create-stripe-checkout-session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: { items: [{ productId: 'cherry', qty: 1 }], shippingZone: 'pickup', pickupStore: 'US', buyer: { name: 'Jane', email: 'j@x.co' } } }) });
  assert.equal(r.status, 500); // sin Stripe configurado no se crea sesión
});
