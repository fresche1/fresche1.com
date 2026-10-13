import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOrder, colombiaZoneForCity, legacyCartToItems } from '../pricing.js';

const one = (productId, qty) => ({ productId, qty });

test('individuales: 1-2 unidades a precio base', () => {
  const o = computeOrder({ items: [one('cherry', 2)], currency: 'COP', shippingZone: 'pickup' });
  assert.equal(o.subtotal, 80000); assert.equal(o.shipping, 0); assert.equal(o.total, 80000);
  assert.equal(computeOrder({ items: [one('cherry', 1)], currency: 'USD', shippingZone: 'pickup' }).total, 19.99);
});
test('tier 3+ (mezclando productos)', () => {
  const o = computeOrder({ items: [one('cherry', 2), one('velvet', 1)], currency: 'COP', shippingZone: 'pickup' });
  assert.equal(o.subtotal, 3 * 26999);
  assert.equal(computeOrder({ items: [one('cherry', 4)], currency: 'USD', shippingZone: 'pickup' }).subtotal, 67.96);
});
test('tier 5+', () => {
  assert.equal(computeOrder({ items: [one('coco', 5)], currency: 'COP', shippingZone: 'pickup' }).subtotal, 5 * 25999);
  assert.equal(computeOrder({ items: [one('coco', 3), one('eclipse', 3)], currency: 'USD', shippingZone: 'pickup' }).subtotal, 95.94);
});
test('cada pack', () => {
  const p = (packType, productIds, currency) => computeOrder({ items: [{ packType, productIds }], currency, shippingZone: 'pickup' }).subtotal;
  assert.equal(p('duo', ['cherry', 'velvet'], 'COP'), 69999);
  assert.equal(p('trio', ['cherry', 'velvet', 'coco'], 'COP'), 99999);
  assert.equal(p('elella', ['cherry', 'velvet', 'coco', 'eclipse', 'tobacco'], 'COP'), 159999);
  assert.equal(p('duo', ['cherry', 'cherry'], 'USD'), 34.99);
  assert.equal(p('trio', ['cherry', 'velvet', 'coco'], 'USD'), 44.99);
  assert.equal(p('elella', ['cherry', 'velvet', 'coco', 'eclipse', 'tobacco'], 'USD'), 69.99);
});
test('packs no cuentan para el tier de individuales', () => {
  const o = computeOrder({ items: [{ packType: 'trio', productIds: ['cherry', 'velvet', 'coco'] }, one('tobacco', 1)], currency: 'COP', shippingZone: 'pickup' });
  assert.equal(o.subtotal, 99999 + 40000);
});
test('zonas de envío Colombia (deducidas de la ciudad)', () => {
  const z = (city) => computeOrder({ items: [one('cherry', 1)], currency: 'COP', shippingZone: 'bogota', city });
  assert.deepEqual([z('Bogotá D.C.').shipping, z('Chía').shipping, z('Medellín').shipping, z('Leticia').shipping], [9000, 9000, 13800, 21000]);
  assert.equal(z('Medellín').total, 40000 + 13800);
  assert.equal(colombiaZoneForCity('CALI'), 'central');
});
test('el cliente no puede abaratar el envío eligiendo otra zona', () => {
  assert.equal(computeOrder({ items: [one('cherry', 1)], currency: 'COP', shippingZone: 'bogota', city: 'Leticia' }).shipping, 21000);
});
test('recogida gratis, internacional gratis (actual)', () => {
  assert.equal(computeOrder({ items: [one('cherry', 1)], currency: 'COP', shippingZone: 'pickup', city: 'Leticia' }).shipping, 0);
  assert.equal(computeOrder({ items: [one('cherry', 1)], currency: 'USD', shippingZone: 'international' }).shipping, 0);
});
test('comisión 5% sobre subtotal', () => {
  const o = computeOrder({ items: [one('cherry', 1)], currency: 'COP', shippingZone: 'bogota', city: 'Bogotá', commissionPercent: 5 });
  assert.equal(o.commission, 2000); assert.equal(o.total, 40000 + 9000 + 2000);
});
test('rechaza entradas inválidas', () => {
  const bad = (items, extra = {}) => assert.throws(() => computeOrder({ items, currency: 'COP', shippingZone: 'pickup', ...extra }), /./);
  bad([]); bad([one('nope', 1)]); bad([one('cherry', -1)]); bad([one('cherry', 0)]); bad([one('cherry', 1.5)]); bad([one('cherry', '2')]);
  bad([one('cherry', 51)]); bad([one('cherry', 30), one('cherry', 30)]); bad(Array.from({ length: 21 }, () => one('cherry', 1)));
  bad([{ packType: 'duo', productIds: ['cherry'] }]); bad([{ packType: 'mega', productIds: ['cherry', 'velvet'] }]);
  bad([{ packType: 'duo', productIds: ['cherry', 'xx'] }]); bad([one('__proto__', 1)]); bad([one('constructor', 1)]);
  bad([one('cherry', 1)], { currency: 'EUR' });
  bad([{ packType: 'elella', productIds: ['cherry', 'velvet', 'coco', 'eclipse', 'tobacco'], qty: 50 }]);
});
test('convierte carrito legado ignorando precios', () => {
  const items = legacyCartToItems([{ id: 'cherry', quantity: 2, price: 1 }, { type: 'pack', packType: 'duo', products: [{ id: 'coco' }, { id: 'velvet' }], price: 1, quantity: 1 }]);
  assert.equal(computeOrder({ items, currency: 'USD', shippingZone: 'international' }).subtotal, 2 * 19.99 + 34.99);
});

test('envío gratis en Colombia desde 3 unidades (packs cuentan por sus unidades)', () => {
  const ship = (items, city = 'Bogotá') => computeOrder({ items, currency: 'COP', shippingZone: 'bogota', city });
  assert.equal(ship([one('cherry', 1)]).shipping, 9000);
  assert.equal(ship([one('cherry', 2)]).shipping, 9000);
  assert.equal(ship([one('cherry', 2)], 'Cali').shipping, 13800);
  assert.equal(ship([one('cherry', 1), one('velvet', 1)], 'Leticia').shipping, 21000);
  const three = ship([one('cherry', 1), one('velvet', 1), one('coco', 1)], 'Leticia');
  assert.equal(three.shipping, 0); assert.equal(three.freeShipping, true); assert.equal(three.units, 3);
  const duo = ship([{ packType: 'duo', productIds: ['cherry', 'velvet'] }], 'Medellín');
  assert.equal(duo.shipping, 13800); assert.equal(duo.total, 69999 + 13800);
  const trio = ship([{ packType: 'trio', productIds: ['cherry', 'velvet', 'coco'] }], 'Leticia');
  assert.equal(trio.shipping, 0); assert.equal(trio.total, 99999);
  const duoPlus = ship([{ packType: 'duo', productIds: ['cherry', 'velvet'] }, one('tobacco', 1)], 'Leticia');
  assert.equal(duoPlus.shipping, 0); assert.equal(duoPlus.units, 3); assert.equal(duoPlus.total, 69999 + 40000);
  assert.equal(ship([{ packType: 'elella', productIds: ['cherry', 'velvet', 'coco', 'eclipse', 'tobacco'] }]).shipping, 0);
  // recogida siempre gratis; internacional sin cambios
  assert.equal(computeOrder({ items: [one('cherry', 1)], currency: 'COP', shippingZone: 'pickup' }).shipping, 0);
  assert.equal(computeOrder({ items: [one('cherry', 1)], currency: 'USD', shippingZone: 'international' }).shipping, 0);
});

test('EE. UU.: $9.99 con 1-2 unidades, gratis desde 3; recogida NY gratis; otros países sin cambio', () => {
  const us = (items) => computeOrder({ items, currency: 'USD', shippingZone: 'us', country: 'US' });
  const a = us([one('cherry', 1)]); assert.equal(a.zone, 'us'); assert.equal(a.shipping, 9.99); assert.equal(a.total, 29.98);
  const b = us([one('cherry', 1), one('velvet', 1)]); assert.equal(b.shipping, 9.99); assert.equal(b.total, 49.97);
  const c = us([one('cherry', 3)]); assert.equal(c.shipping, 0); assert.equal(c.total, 50.97);
  const duo = us([{ packType: 'duo', productIds: ['cherry', 'velvet'] }]); assert.equal(duo.shipping, 9.99); assert.equal(duo.total, 44.98);
  const trio = us([{ packType: 'trio', productIds: ['cherry', 'velvet', 'coco'] }]); assert.equal(trio.shipping, 0); assert.equal(trio.total, 44.99);
  assert.equal(computeOrder({ items: [one('cherry', 1)], currency: 'USD', shippingZone: 'pickup', country: 'US' }).shipping, 0);
  assert.equal(computeOrder({ items: [one('cherry', 1)], currency: 'USD', shippingZone: 'international', country: 'MX' }).shipping, 0);
});
