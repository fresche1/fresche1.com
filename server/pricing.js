// Catálogo y reglas de precio del lado del servidor (fuente única de verdad).
// Precios de packs COP decididos por el dueño (2026-10-12): 69.999 / 99.999 / 159.999.
// and checkout pricing logic"). El cliente NUNCA envía precios: solo ids y cantidades.

export const PRODUCTS = Object.freeze({
  cherry: { name: 'FRESCHE CherryMood' },
  velvet: { name: 'FRESCHE Velvet' },
  coco: { name: 'FRESCHE Coco & Vainilla' },
  eclipse: { name: 'FRESCHE Eclipse' },
  tobacco: { name: 'FRESCHE Dulce Tobacco' }
});

// Precio unitario de productos individuales según la cantidad TOTAL de individuales del carrito.
export const INDIVIDUAL_TIERS = Object.freeze([
  { minQty: 5, COP: 25999, USD: 15.99 },
  { minQty: 3, COP: 26999, USD: 16.99 },
  { minQty: 1, COP: 40000, USD: 19.99 }
]);

export const PACKS = Object.freeze({
  duo: { name: 'Pack Dúo', size: 2, COP: 69999, USD: 34.99 },
  trio: { name: 'Pack Trío', size: 3, COP: 99999, USD: 44.99 },
  elella: { name: 'Pack ÉL & ELLA', size: 5, COP: 159999, USD: 69.99 }
});

// Tarifas anunciadas en el sitio (sección "Envíos Nacionales"). Recogida en tienda gratis.
export const SHIPPING_RATES = Object.freeze({
  COP: { pickup: 0, bogota: 9000, central: 13800, longdistance: 21000 },
  // EE. UU.: desde Nueva York por USPS Ground Advantage, tarifa plana (gratis desde 3 unidades).
  // Otros países: sin cambios (gratis).
  USD: { pickup: 0, us: 9.99, international: 0 }
});

export const ZONE_LABELS = Object.freeze({
  pickup: 'Recoger en tienda',
  bogota: 'Envío LOCAL - Bogotá y Sabana',
  central: 'Envío REGIONAL - Colombia Central',
  longdistance: 'Envío NACIONAL - Larga distancia',
  us: 'Envío EE. UU. desde Nueva York (USPS Ground Advantage, con rastreo)',
  international: 'Envío internacional'
});

// Regla decidida por el dueño (2026-10-12): envío GRATIS en Colombia y EE. UU. desde 3 unidades
// (packs cuentan por sus unidades). Con 1-2 unidades se cobra por zona. Recogida siempre gratis.
export const FREE_SHIPPING_MIN_UNITS = 3;

export const LIMITS = Object.freeze({ maxLines: 20, maxQtyPerLine: 50, maxUnits: 100 });

const strip = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const BOGOTA_CITIES = ['bogota', 'soacha', 'chia', 'cajica', 'cota', 'funza', 'mosquera', 'madrid', 'zipaquira',
  'facatativa', 'tocancipa', 'tenjo', 'tabio', 'subachoque', 'el rosal', 'siberia', 'gachancipa', 'sopo',
  'la calera', 'guasca', 'sesquile', 'nemocon', 'bojaca', 'arbelaez', 'fusagasuga', 'girardot'];
const CENTRAL_CITIES = ['medellin', 'envigado', 'bello', 'itagui', 'sabaneta', 'rionegro', 'la estrella', 'caldas',
  'copacabana', 'marinilla', 'cali', 'palmira', 'buenaventura', 'tulua', 'cartago', 'buga', 'jamundi', 'yumbo',
  'barranquilla', 'cartagena', 'santa marta', 'soledad', 'malambo', 'sabanalarga', 'bucaramanga', 'floridablanca',
  'giron', 'piedecuesta', 'cucuta', 'pamplona', 'villa del rosario', 'los patios', 'ocana', 'barrancabermeja',
  'pereira', 'dosquebradas', 'manizales', 'armenia', 'la virginia', 'ibague', 'espinal', 'melgar', 'honda', 'tunja',
  'duitama', 'sogamoso', 'chiquinquira', 'paipa', 'villa de leyva', 'neiva', 'pitalito', 'garzon', 'la plata',
  'villavicencio', 'acacias', 'granada', 'puerto lopez'];

// Misma lógica que el checkout (coincidencia por subcadena, sin tildes).
export function colombiaZoneForCity(city) {
  const c = strip(city || '');
  if (!c) return null;
  if (BOGOTA_CITIES.some((x) => c.includes(x))) return 'bogota';
  if (CENTRAL_CITIES.some((x) => c.includes(x))) return 'central';
  return 'longdistance';
}

export class OrderError extends Error {
  constructor(message) { super(message); this.name = 'OrderError'; this.status = 400; }
}

const isInt = (n) => Number.isInteger(n);
const round = (amount, currency) => (currency === 'COP' ? Math.round(amount) : Math.round(amount * 100) / 100);

/** Normaliza y valida las líneas. Acepta {productId, qty} o {packType, productIds, qty?}. */
export function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new OrderError('El carrito está vacío');
  if (items.length > LIMITS.maxLines) throw new OrderError('Carrito demasiado grande');
  let units = 0;
  const singles = new Map();
  const packs = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') throw new OrderError('Ítem inválido');
    const qty = raw.qty === undefined && raw.packType ? 1 : raw.qty;
    if (!isInt(qty) || qty < 1 || qty > LIMITS.maxQtyPerLine) throw new OrderError('Cantidad inválida');
    if (raw.packType !== undefined) {
      const pack = Object.prototype.hasOwnProperty.call(PACKS, raw.packType) ? PACKS[raw.packType] : null;
      if (!pack) throw new OrderError('Pack desconocido');
      const ids = raw.productIds;
      if (!Array.isArray(ids) || ids.length !== pack.size) throw new OrderError(`El ${pack.name} requiere ${pack.size} productos`);
      for (const id of ids) {
        if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(PRODUCTS, id)) throw new OrderError('Producto desconocido');
      }
      packs.push({ packType: raw.packType, productIds: [...ids], qty });
      units += pack.size * qty;
    } else {
      const id = raw.productId;
      if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(PRODUCTS, id)) throw new OrderError('Producto desconocido');
      singles.set(id, (singles.get(id) || 0) + qty);
      units += qty;
    }
  }
  if (units > LIMITS.maxUnits) throw new OrderError('Carrito demasiado grande');
  for (const q of singles.values()) if (q > LIMITS.maxQtyPerLine) throw new OrderError('Cantidad inválida');
  return { singles: [...singles.entries()].map(([productId, qty]) => ({ productId, qty })), packs, units };
}

/** Convierte el carrito "legado" (localStorage freshCart) al formato nuevo, ignorando precios. */
export function legacyCartToItems(cart) {
  if (!Array.isArray(cart)) throw new OrderError('Carrito inválido');
  return cart.map((it) => {
    const qty = Number(it?.quantity);
    if (it?.type === 'pack') {
      let packType = it.packType;
      const ids = Array.isArray(it.products) ? it.products.map((p) => (typeof p === 'string' ? p : p?.id)) : [];
      if (!packType) packType = ids.length === 2 ? 'duo' : ids.length === 3 ? 'trio' : ids.length === 5 ? 'elella' : 'desconocido';
      return { packType, productIds: ids, qty };
    }
    return { productId: it?.id, qty };
  });
}

export function individualUnitPrice(totalQty, currency) {
  const tier = INDIVIDUAL_TIERS.find((t) => totalQty >= t.minQty) || INDIVIDUAL_TIERS[INDIVIDUAL_TIERS.length - 1];
  return tier[currency];
}

/**
 * Calcula el pedido completo en el servidor.
 * @param {object} p
 * @param {Array} p.items
 * @param {'COP'|'USD'} p.currency
 * @param {string} p.shippingZone  pickup | bogota | central | longdistance | international
 * @param {string} [p.city]        si es Colombia (no pickup) la zona se deduce de la ciudad
 * @param {number} [p.commissionPercent]
 */
export function computeOrder({ items, currency, shippingZone, city, country, commissionPercent = 0 }) {
  if (currency !== 'COP' && currency !== 'USD') throw new OrderError('Moneda inválida');
  const { singles, packs, units } = normalizeItems(items);

  let zone;
  if (shippingZone === 'pickup') zone = 'pickup';
  else if (currency === 'COP') {
    zone = colombiaZoneForCity(city);
    if (!zone) {
      if (!['bogota', 'central', 'longdistance'].includes(shippingZone)) throw new OrderError('Zona de envío inválida');
      zone = shippingZone;
    }
  } else {
    if (shippingZone && !['international', 'free', 'us'].includes(shippingZone)) throw new OrderError('Zona de envío inválida');
    zone = country === 'US' ? 'us' : 'international';
  }

  const totalSingles = singles.reduce((s, l) => s + l.qty, 0);
  const unit = individualUnitPrice(totalSingles, currency);
  const lines = [];
  for (const l of singles) {
    lines.push({ kind: 'product', id: l.productId, title: PRODUCTS[l.productId].name, quantity: l.qty, unit_price: unit });
  }
  for (const p of packs) {
    const pack = PACKS[p.packType];
    const names = p.productIds.map((id) => PRODUCTS[id].name.replace('FRESCHE ', '')).join(', ');
    lines.push({ kind: 'pack', id: p.packType, title: `${pack.name} (${names})`, quantity: p.qty, unit_price: pack[currency], productIds: p.productIds });
  }
  const subtotal = round(lines.reduce((s, l) => s + l.unit_price * l.quantity, 0), currency);
  const freeShipping = (zone === 'us' || (currency === 'COP' && zone !== 'pickup')) && units >= FREE_SHIPPING_MIN_UNITS;
  const shipping = freeShipping ? 0 : SHIPPING_RATES[currency][zone];
  const commission = round(subtotal * (Number(commissionPercent) || 0) / 100, currency);
  const total = round(subtotal + shipping + commission, currency);
  return { currency, zone, zoneLabel: ZONE_LABELS[zone], units, freeShipping, lines, subtotal, shipping, commission, commissionPercent: Number(commissionPercent) || 0, total };
}
