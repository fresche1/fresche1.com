// Pedido "snapshot" calculado en el servidor, almacén de pedidos y email al dueño.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PRODUCTS } from './pricing.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
}

export const fmtMoney = (amount, currency) => (currency === 'COP' ? `$${Math.round(Number(amount) || 0).toLocaleString('es-CO')} COP` : `$${(Number(amount) || 0).toFixed(2)} USD`);

export const PICKUP_LABELS = {
  US: 'Tienda USA – punto de recogida gratis (Queens, Manhattan, Long Island, Brooklyn, New Jersey)',
  CO: 'Tienda Colombia – punto de recogida gratis (Bogotá, Fusagasugá, Madrid Cundinamarca, Medellín)'
};
const COUNTRY_NAMES = { CO: 'Colombia', US: 'Estados Unidos', CA: 'Canadá', MX: 'México', ES: 'España', AR: 'Argentina', CL: 'Chile', PE: 'Perú', EC: 'Ecuador', BR: 'Brasil', OTHER: 'Otro' };

export function newOrderId() {
  return `FR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/** Snapshot compacto del pedido (claves snake_case: Mercado Pago convierte metadata a snake_case). */
export function orderSnapshot({ buyer, summary, pickupStore }, { id = newOrderId(), createdAt = new Date().toISOString(), method = '' } = {}) {
  return {
    id, created_at: createdAt, method,
    buyer: { name: buyer.name, email: buyer.email, phone: buyer.phone, address: buyer.address, city: buyer.city, state: buyer.state, postal_code: buyer.postalCode, notes: buyer.notes || '', country: buyer.country },
    pickup_store: pickupStore || null, zone: summary.zone, zone_label: summary.zoneLabel, currency: summary.currency,
    lines: summary.lines.map((l) => ({
      title: l.kind === 'pack' ? l.title.replace(/\s*\(.*\)$/, '') : l.title,
      variant: l.kind === 'pack' ? (l.productIds || []).map((p) => PRODUCTS[p].name.replace('FRESCHE ', '')).join(', ') : PRODUCTS[l.id]?.name.replace('FRESCHE ', '') || '',
      quantity: l.quantity, unit_price: l.unit_price
    })),
    subtotal: summary.subtotal, shipping: summary.shipping, commission: summary.commission, commission_percent: summary.commissionPercent || 0, total: summary.total
  };
}

// ---- Compactación para metadata de proveedores ----
const KEYS = [['id', 'i'], ['created_at', 'd'], ['method', 'm'], ['pickup_store', 'k'], ['zone', 'z'], ['currency', 'c'], ['subtotal', 's'], ['shipping', 'h'], ['commission', 'f'], ['commission_percent', 'fp'], ['total', 't']];
const BKEYS = [['name', 'n'], ['email', 'e'], ['phone', 'p'], ['address', 'a'], ['city', 'ci'], ['state', 'st'], ['postal_code', 'zp'], ['notes', 'no'], ['country', 'co']];
export function packOrder(o) {
  const p = {};
  for (const [k, s] of KEYS) if (o[k] !== undefined && o[k] !== null && o[k] !== '') p[s] = o[k];
  p.b = {}; for (const [k, s] of BKEYS) if (o.buyer?.[k]) p.b[s] = o.buyer[k];
  p.l = (o.lines || []).map((l) => [l.title, l.variant, l.quantity, l.unit_price]);
  return JSON.stringify(p);
}
export function unpackOrder(json) {
  try {
    const p = JSON.parse(json); const o = {};
    for (const [k, s] of KEYS) if (p[s] !== undefined) o[k] = p[s];
    o.buyer = {}; for (const [k, s] of BKEYS) if (p.b?.[s] !== undefined) o.buyer[k] = p.b[s];
    o.lines = (p.l || []).map(([title, variant, quantity, unit_price]) => ({ title, variant, quantity, unit_price }));
    return o;
  } catch { return null; }
}
/** Stripe: máx. 50 claves y 500 caracteres por valor -> se parte en trozos o0, o1, ... */
export function toStripeMetadata(o) {
  const json = packOrder(o); const md = {};
  for (let i = 0, n = 0; i < json.length && n < 40; i += 490, n += 1) md[`o${n}`] = json.slice(i, i + 490);
  return md;
}
export function fromStripeMetadata(md) {
  if (!md) return null;
  let json = ''; for (let n = 0; md[`o${n}`] !== undefined; n += 1) json += md[`o${n}`];
  return json ? unpackOrder(json) : null;
}

// ---- Almacén: memoria + archivo JSON opcional (ORDER_STORE_FILE). En Render el disco es efímero. ----
export function createOrderStore({ file = '', max = 2000, logger = console } = {}) {
  const map = new Map();
  if (file) {
    try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(file, 'utf8')))) map.set(k, v); } catch { /* vacío */ }
  }
  let timer = null;
  const flush = () => {
    timer = null;
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(map)), { mode: 0o600 }); fs.renameSync(tmp, file); } catch (e) { logger.error('No se pudo guardar pedidos:', e.message); }
  };
  return {
    get: (k) => map.get(String(k)) || null,
    set(k, v) {
      map.set(String(k), v);
      while (map.size > max) map.delete(map.keys().next().value);
      if (file && !timer) timer = setTimeout(flush, 50);
    },
    get size() { return map.size; }
  };
}

export function formatBogota(iso) {
  const d = iso ? new Date(iso) : new Date();
  const s = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(Number.isNaN(d.getTime()) ? new Date() : d);
  return `${s} (hora Colombia)`;
}

/**
 * Email al dueño. kind: 'confirmed' (pago verificado) | 'manual' (pago pendiente de verificar) | 'pending' (MP creado, sin pagar).
 */
export function ownerEmailHtml({ kind = 'confirmed', provider, paymentId, status, order, amount, currency }) {
  const e = escapeHtml; const o = order || {}; const b = o.buyer || {};
  const cur = currency || o.currency || 'USD';
  const money = (v) => (v === undefined || v === null || v === '' ? 'N/A' : e(fmtMoney(v, cur)));
  const td = 'padding:6px 8px;border:1px solid #ddd';
  const row = (k, v) => `<tr><td style="${td};background:#f7f3ee;width:38%"><strong>${e(k)}</strong></td><td style="${td}">${v}</td></tr>`;
  const title = kind === 'confirmed' ? `✅ Pago CONFIRMADO – ${e(provider)}` : kind === 'manual' ? `🕒 Pedido nuevo – pago pendiente de verificar (${e(provider)})` : `🛍️ Pedido nuevo – PENDIENTE DE PAGO (${e(provider)})`;
  const color = kind === 'confirmed' ? '#2e7d32' : '#b26a00';
  const note = kind === 'confirmed' ? 'Pago verificado con el proveedor. Despachar / entregar este pedido.'
    : kind === 'manual' ? 'Verifica el comprobante (WhatsApp) y que el dinero haya llegado ANTES de despachar.'
      : 'NO despachar hasta recibir el email “Pago CONFIRMADO”.';
  const entrega = o.pickup_store
    ? row('Entrega', `Recoger en tienda: ${e(PICKUP_LABELS[o.pickup_store] || o.pickup_store)}`)
    : [row('Tipo de envío', e(o.zone_label || o.zone || 'N/A')), row('Dirección', e(b.address || 'N/A')), row('Barrio / indicaciones', e(b.notes || '—')),
      row('Ciudad', e(b.city || 'N/A')), row(b.country === 'CO' ? 'Departamento' : 'Estado / región', e(b.state || '—')), row('Código postal / ZIP', e(b.postal_code || '—'))].join('');
  const lines = Array.isArray(o.lines) ? o.lines : [];
  const items = lines.map((l) => `<tr><td style="${td}">${e(l.title)}</td><td style="${td}">${e(l.variant || '—')}</td><td style="${td};text-align:center">${e(l.quantity)}</td><td style="${td};text-align:right">${money(l.unit_price)}</td><td style="${td};text-align:right">${money(Number(l.unit_price) * Number(l.quantity))}</td></tr>`).join('');
  const shipping = Number(o.shipping) === 0 && o.shipping !== undefined && o.shipping !== null ? 'Gratis ($0)' : money(o.shipping);
  const total = o.total ?? amount;
  return `<!doctype html><html><head><meta charset="utf-8"><title>FRESCHE ${e(o.id || '')}</title></head><body style="margin:0;background:#fff">
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#222">
<h2 style="color:${color};margin:0 0 6px">${title}</h2>
<p style="margin:0 0 14px;color:#555">${e(note)}</p>
<h3>Pedido</h3><table style="width:100%;border-collapse:collapse">
${row('Pedido', `<strong>${e(o.id || 'N/A')}</strong>`)}${row('Fecha / hora', e(formatBogota(o.created_at)))}
${row('Método de pago', e(provider))}${row('ID de pago del proveedor', e(paymentId || 'N/A'))}${row('Estado', e(status || (kind === 'confirmed' ? 'aprobado' : 'pendiente')))}
${amount !== undefined && amount !== null ? row('Monto cobrado (verificado)', money(amount)) : ''}${row('Moneda', e(cur))}
</table>
<h3>Cliente</h3><table style="width:100%;border-collapse:collapse">
${row('Nombre', e(b.name || 'N/A'))}${row('Celular / WhatsApp', e(b.phone || 'N/A'))}${row('Email', e(b.email || 'N/A'))}${row('País', e(COUNTRY_NAMES[b.country] || b.country || 'N/A'))}
</table>
<h3>Entrega</h3><table style="width:100%;border-collapse:collapse">${entrega}</table>
<h3>Productos</h3>${items ? `<table style="width:100%;border-collapse:collapse"><tr><th style="${td}">Producto</th><th style="${td}">Aromas / variante</th><th style="${td}">Cant.</th><th style="${td}">Precio unit.</th><th style="${td}">Total</th></tr>${items}</table>` : '<p>(detalle no disponible)</p>'}
<table style="width:100%;border-collapse:collapse;margin-top:12px">
${row('Subtotal', money(o.subtotal))}${row('Envío', shipping)}${row(`Comisión${o.commission_percent ? ` (${e(o.commission_percent)}%)` : ''}`, money(o.commission ?? 0))}
${row('TOTAL', `<strong style="font-size:18px">${money(total)}</strong>`)}${row('Moneda', e(cur))}
</table></div></body></html>`;
}
