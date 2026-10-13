// Genera los emails reales al dueño (flujo completo con proveedores simulados) para revisión visual.
// Uso: node test/render-owner-emails.js [carpeta]   (por defecto /workspace/fresche-final-shots)
import fs from 'node:fs';
import { startApp, sign } from './helpers.js';

const out = process.argv[2] || '/workspace/fresche-final-shots';
fs.mkdirSync(out, { recursive: true });

const co = await startApp();
await co.post('/api/create-preference', { order: { items: [{ productId: 'cherry', qty: 1 }, { packType: 'duo', productIds: ['velvet', 'coco'] }], shippingZone: 'central', buyer: { name: 'Ana Pérez', email: 'ana@example.com', phone: '+57 300 123 4567', address: 'Calle 45 #12-34 Apto 501', city: 'Medellín', state: 'Antioquia', notes: 'Barrio Laureles, portería', country: 'CO' } } });
const pref = co.calls.preferences[0];
co.payments.set('123456789', { id: 123456789, status: 'approved', payment_method_id: 'pse', transaction_amount: pref.metadata.expected_total, currency_id: 'COP', external_reference: pref.external_reference, metadata: pref.metadata });
await co.post('/api/mercadopago-webhook?data.id=123456789&type=payment', {}, sign('123456789'));
fs.writeFileSync(`${out}/email-owner-CO.html`, co.calls.emails.find((e) => e.subject.includes('CONFIRMADO')).html);
await co.close();

const us = await startApp();
await us.post('/api/create-paypal-order', { order: { items: [{ productId: 'eclipse', qty: 1 }, { productId: 'tobacco', qty: 1 }], shippingZone: 'us', buyer: { name: 'Jane Doe', email: 'jane@example.com', phone: '+1 212 555 0100', address: '350 5th Ave', city: 'New York', state: 'NY', postalCode: '10118', notes: 'Apt 7B', country: 'US' } } });
us.paypal.captureOrder = async (id) => ({ id, status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: '8AB12345CD678901E', status: 'COMPLETED', amount: { value: '49.97', currency_code: 'USD' } }] } }] });
await us.get('/api/paypal/capture-order?token=PAYPALORDER123');
fs.writeFileSync(`${out}/email-owner-US.html`, us.calls.emails.find((e) => e.subject.includes('CONFIRMADO')).html);
await us.close();
console.log('ok', out);
