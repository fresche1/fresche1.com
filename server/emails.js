// Emails al dueño (HTML escapado). Todos los datos vienen del pedido calculado en el servidor.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
}
export const fmtMoney = (amount, currency) => (amount === undefined || amount === null || amount === '' || !Number.isFinite(Number(amount))
  ? 'N/A'
  : currency === 'COP' ? `$${Math.round(Number(amount)).toLocaleString('es-CO')} COP` : `$${Number(amount).toFixed(2)} USD`);

export function formatBogota(date) {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return 'N/A';
  return `${new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short' }).format(d)} (hora Colombia)`;
}

const COUNTRY_NAMES = { CO: 'Colombia', US: 'Estados Unidos', MX: 'México', ES: 'España', CA: 'Canadá', AR: 'Argentina', CL: 'Chile', PE: 'Perú', EC: 'Ecuador', BR: 'Brasil', OTHER: 'Otro' };
export const PICKUP_LABELS = {
  US: 'Recoger GRATIS – Tienda USA (Queens, Manhattan, Long Island, Brooklyn, New Jersey)',
  CO: 'Recoger GRATIS – Tienda Colombia (Bogotá, Fusagasugá, Madrid Cundinamarca, Medellín)'
};

const td = 'padding:6px 8px;border:1px solid #ddd;vertical-align:top';
const row = (k, v) => `<tr><th style="${td};text-align:left;background:#f7f3ea;width:38%">${escapeHtml(k)}</th><td style="${td}">${escapeHtml(v === undefined || v === null || v === '' ? '—' : v)}</td></tr>`;

/**
 * @param {object} p
 * @param {'confirmed'|'manual'|'awaiting'} p.kind
 * @param {object} p.order   snapshot del pedido (orderSnapshot)
 * @param {object} p.payment {method, paymentId, status, reference, amount, currency, confirmedAt}
 */
export function ownerEmailHtml({ kind, order, payment = {} }) {
  const e = escapeHtml; const o = order || {}; const b = o.buyer || {};
  const cur = o.currency || payment.currency || 'COP';
  const title = kind === 'confirmed' ? `✅ Pago CONFIRMADO – ${payment.method || ''}`
    : kind === 'manual' ? `🕒 Pedido nuevo – pago pendiente de verificar (${payment.method || ''})`
      : `🛍️ Nuevo pedido – pendiente de pago (${payment.method || ''})`;
  const color = kind === 'confirmed' ? '#2e7d32' : '#b8860b';
  const note = kind === 'confirmed' ? 'Pago verificado con el proveedor. Despachar / entregar este pedido.'
    : kind === 'manual' ? 'El cliente eligió un pago manual. Verifica el comprobante (WhatsApp) ANTES de despachar.'
      : 'NO despachar hasta recibir el email “Pago CONFIRMADO”.';
  const lines = Array.isArray(o.lines) ? o.lines : [];
  const items = lines.map((l) => `<tr><td style="${td}">${e(l.name || l.title)}</td><td style="${td}">${e(l.variant || '—')}</td><td style="${td};text-align:center">${e(l.quantity)}</td><td style="${td};text-align:right">${e(fmtMoney(l.unit_price, cur))}</td><td style="${td};text-align:right">${e(fmtMoney(Number(l.unit_price) * Number(l.quantity), cur))}</td></tr>`).join('');
  const delivery = o.pickup_store
    ? row('Entrega', PICKUP_LABELS[o.pickup_store] || `Recoger en tienda (${o.pickup_store})`)
    : [row('Entrega', o.zone_label || o.zone), row('Dirección', b.address), row('Barrio / indicaciones', b.notes), row('Ciudad', b.city),
      row(b.country === 'US' ? 'Estado' : 'Departamento / estado', b.state), row('Código postal / ZIP', b.postal_code), row('País', COUNTRY_NAMES[b.country] ? `${COUNTRY_NAMES[b.country]} (${b.country})` : b.country)].join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${e(title)}</title></head><body style="margin:0;background:#faf8f3">
<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#222;background:#fff">
<h2 style="color:${color};margin:0 0 6px">${e(title)}</h2>
<p style="margin:0 0 14px;color:#555">${e(note)}</p>
<h3 style="margin:16px 0 6px">Pedido</h3><table style="width:100%;border-collapse:collapse">
${row('ID del pedido', o.id || payment.reference)}${row('Fecha del pedido', formatBogota(o.created_at))}${kind === 'confirmed' ? row('Pago confirmado', formatBogota(payment.confirmedAt)) : ''}
${row('Método de pago', payment.method)}${row('ID de pago del proveedor', payment.paymentId)}${row('Estado del pago', payment.status)}${payment.amount !== undefined ? row('Monto cobrado (verificado)', fmtMoney(payment.amount, payment.currency || cur)) : ''}${row('Moneda', cur)}</table>
<h3 style="margin:16px 0 6px">Cliente</h3><table style="width:100%;border-collapse:collapse">
${row('Nombre', b.name)}${row('Celular / WhatsApp', b.phone)}${row('Email', b.email)}${row('País', COUNTRY_NAMES[b.country] || b.country)}</table>
<h3 style="margin:16px 0 6px">Envío</h3><table style="width:100%;border-collapse:collapse">${delivery}</table>
<h3 style="margin:16px 0 6px">Productos</h3>
${items ? `<table style="width:100%;border-collapse:collapse"><tr><th style="${td}">Producto</th><th style="${td}">Variante / aromas</th><th style="${td}">Cant.</th><th style="${td}">Precio unit.</th><th style="${td}">Total</th></tr>${items}</table>` : '<p>(detalle no disponible)</p>'}
<table style="width:100%;border-collapse:collapse;margin-top:10px">
${row('Subtotal', fmtMoney(o.subtotal, cur))}${row('Envío', Number(o.shipping) === 0 ? `Gratis (${fmtMoney(0, cur)})` : fmtMoney(o.shipping, cur))}${row('Comisión / fee', fmtMoney(o.commission ?? 0, cur))}
<tr><th style="${td};text-align:left;background:#efe6cf">TOTAL</th><td style="${td};font-weight:bold;font-size:1.15em">${e(fmtMoney(o.total, cur))}</td></tr></table>
</div></body></html>`;
}
