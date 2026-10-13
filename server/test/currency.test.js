// Regla del dueño: Colombia = COP; EE. UU. y cualquier otro país = USD. La decide el servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, sign, buyerCO } from './helpers.js';
import { currencyForOrder, parseOrderRequest } from '../app.js';

const buyerUS = { name: 'Jane Doe', email: 'jane@example.com', phone: '+1 212 555 0100', address: '350 5th Ave', city: 'New York', state: 'NY', postalCode: '10118', country: 'US' };
const buyerMX = { name: 'Luis Gómez', email: 'luis@example.mx', phone: '+52 55 1234 5678', address: 'Av. Reforma 222', city: 'Ciudad de México', country: 'MX' };
const buyerES = { name: 'Lucía Ruiz', email: 'lucia@example.es', phone: '+34 600 123 456', address: 'Gran Vía 1', city: 'Madrid', country: 'ES' };
const item = [{ productId: 'cherry', qty: 1 }];
const confirmed = (s) => s.calls.emails.filter((e) => e.subject.includes('CONFIRMADO'));

test('currencyForOrder: CO=COP, US/MX/ES/otros=USD; recogida según tienda', () => {
  assert.equal(currencyForOrder({ country: 'CO' }), 'COP');
  for (const c of ['US', 'MX', 'ES', 'CA', 'OTHER', '']) assert.equal(currencyForOrder({ country: c }), 'USD', c);
  assert.equal(currencyForOrder({ isPickup: true, pickupStore: 'CO' }), 'COP');
  assert.equal(currencyForOrder({ isPickup: true, pickupStore: 'US' }), 'USD');
});

test('el cliente no puede forzar la moneda', () => {
  assert.equal(parseOrderRequest({ items: item, shippingZone: 'international', currency: 'COP', buyer: buyerMX }).summary.currency, 'USD');
  assert.equal(parseOrderRequest({ items: item, shippingZone: 'us', currency: 'COP', buyer: buyerUS }).summary.currency, 'USD');
  assert.equal(parseOrderRequest({ items: item, shippingZone: 'bogota', currency: 'USD', buyer: buyerCO }).summary.currency, 'COP');
});

test('Colombia (CO): Mercado Pago en COP; Stripe/PayPal (USD) rechazados', async (t) => {
  const s = await startApp(); t.after(s.close);
  const d = await (await s.post('/api/create-preference', { order: { items: item, shippingZone: 'bogota', currency: 'USD', buyer: buyerCO } })).json();
  assert.equal(d.currency, 'COP'); assert.equal(d.total, 40000 + 9000 + 2000);
  const pref = s.calls.preferences[0];
  assert.ok(pref.items.every((i) => i.currency_id === 'COP')); assert.equal(pref.metadata.currency, 'COP');
  assert.equal((await s.post('/api/create-stripe-checkout-session', { order: { items: item, shippingZone: 'bogota', buyer: buyerCO } })).status, 400);
  assert.equal((await s.post('/api/create-paypal-order', { order: { items: item, shippingZone: 'bogota', buyer: buyerCO } })).status, 400);
  assert.equal(s.calls.stripeSessions.length + s.calls.paypalOrders.length, 0);
  // email al dueño en COP
  s.payments.set('9101', { id: 9101, status: 'approved', transaction_amount: pref.metadata.expected_total, currency_id: 'COP', external_reference: pref.external_reference, metadata: pref.metadata });
  assert.equal((await s.post('/api/mercadopago-webhook?data.id=9101&type=payment', { type: 'payment', data: { id: '9101' } }, sign('9101'))).status, 200);
  const h = confirmed(s)[0].html;
  assert.ok(h.includes('$51.000 COP')); assert.ok(!h.includes('USD'));
});

test('Estados Unidos (US): Stripe y PayPal en USD; Mercado Pago (COP) rechazado', async (t) => {
  const s = await startApp(); t.after(s.close);
  assert.equal((await s.post('/api/create-stripe-checkout-session', { order: { items: item, shippingZone: 'us', currency: 'COP', buyer: buyerUS } })).status, 200);
  assert.ok(s.calls.stripeSessions[0].line_items.every((l) => l.price_data.currency === 'usd'));
  assert.equal(s.calls.stripeSessions[0].line_items[0].price_data.unit_amount, 1999);
  await s.post('/api/create-paypal-order', { order: { items: item, shippingZone: 'us', buyer: buyerUS } });
  assert.equal(s.calls.paypalOrders[0].purchase_units[0].amount.currency_code, 'USD');
  assert.equal(s.calls.paypalOrders[0].purchase_units[0].amount.value, '29.98');
  assert.equal((await s.post('/api/create-preference', { order: { items: item, shippingZone: 'us', buyer: buyerUS } })).status, 400);
  assert.equal(s.calls.preferences.length, 0);
});

for (const [label, buyer] of [['México (MX)', buyerMX], ['España (ES)', buyerES]]) {
  test(`${label}: cobra en USD (Stripe/PayPal), Mercado Pago rechazado, email al dueño en USD`, async (t) => {
    const s = await startApp(); t.after(s.close);
    assert.equal((await s.post('/api/create-preference', { order: { items: item, shippingZone: 'international', buyer } })).status, 400);
    assert.equal(s.calls.preferences.length, 0);
    const r = await s.post('/api/create-stripe-checkout-session', { order: { items: item, shippingZone: 'international', currency: 'COP', buyer } });
    assert.equal(r.status, 200);
    const li = s.calls.stripeSessions[0].line_items;
    assert.ok(li.every((l) => l.price_data.currency === 'usd'));
    assert.equal(li.reduce((a, l) => a + l.price_data.unit_amount * l.quantity, 0), 1999);
    const p = await s.post('/api/create-paypal-order', { order: { items: item, shippingZone: 'international', buyer } });
    assert.equal(p.status, 200);
    assert.equal(s.calls.paypalOrders[0].purchase_units[0].amount.currency_code, 'USD');
    assert.equal(s.calls.paypalOrders[0].purchase_units[0].amount.value, '19.99');
    // webhook Stripe pagado -> email CONFIRMADO en USD
    const ev = { type: 'checkout.session.completed', data: { object: { id: 'cs_test_1234567890', payment_status: 'paid', amount_total: 1999, currency: 'usd', payment_intent: 'pi_1' } } };
    assert.equal((await s.post('/api/stripe-webhook', ev, { 'stripe-signature': 'good-sig' })).status, 200);
    const mail = confirmed(s)[0];
    assert.ok(mail, 'falta email CONFIRMADO');
    assert.ok(mail.html.includes('USD')); assert.ok(!mail.html.includes('COP'));
  });
}
