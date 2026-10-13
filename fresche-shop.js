// FRESCHE tienda: carrito (localStorage 'freshCart', mismo formato que el index original) -> checkout.html.
// Los precios aquí son solo informativos; el servidor (server/pricing.js) recalcula todo.
(function () {
  var PRODUCTS = {
    cherry: { name: 'FRESCHE CherryMood', image: 'images/cherry.jpg', thumb: 'img/cherrymood.jpg' },
    velvet: { name: 'FRESCHE Velvet', image: 'images/velvet.jpg', thumb: 'img/velvet.jpg' },
    coco: { name: 'FRESCHE Coco & Vainilla', image: 'images/coco.jpg', thumb: 'img/coco-vainilla.jpg' },
    eclipse: { name: 'FRESCHE Eclipse', image: 'images/eclipse.jpg', thumb: 'img/eclipse.jpg' },
    tobacco: { name: 'FRESCHE Dulce Tobacco', image: 'images/tobacco.jpg', thumb: 'img/dulce-tobacco.jpg' }
  };
  var PACKS = {
    duo: { quantity: 2, priceCOP: 69999, priceUSD: 34.99, name: 'Pack Dúo' },
    trio: { quantity: 3, priceCOP: 99999, priceUSD: 44.99, name: 'Pack Trío' },
    elella: { quantity: 5, priceCOP: 159999, priceUSD: 69.99, name: 'Pack ÉL & ELLA' }
  };
  var UNIT = { COP: 40000, USD: 19.99 };

  function lang() { return document.documentElement.getAttribute('data-lang') || 'es'; }
  function getCart() { try { var c = JSON.parse(localStorage.getItem('freshCart')); return Array.isArray(c) ? c : []; } catch (e) { return []; } }
  function saveCart(c) { localStorage.setItem('freshCart', JSON.stringify(c)); updateCount(); }
  function units(c) { return c.reduce(function (s, i) { var q = Number(i.quantity) || 0; return s + (i.type === 'pack' ? q * ((PACKS[i.packType] || {}).quantity || (i.products || []).length) : q); }, 0); }
  function updateCount() { var el = document.getElementById('cartCount'); if (el) { var n = units(getCart()); el.textContent = n; el.parentNode.classList.toggle('has', n > 0); } }

  // Región/moneda: misma clave que el index original ('fresche_currency').
  var region = 'CO';
  // Regla del dueño: Colombia = COP; EE. UU. y cualquier otro país = USD (solo visual; el servidor decide el cobro).
  function detectRegion() {
    try { var s = JSON.parse(localStorage.getItem('fresche_currency') || 'null'); if (s && s.region) return s.region === 'CO' ? 'CO' : 'US'; } catch (e) {}
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    var lng = (navigator.language || '').toLowerCase();
    return (tz === 'America/Bogota' || lng.indexOf('es-co') === 0) ? 'CO' : 'US';
  }
  function fmtCOP(n) { return '$' + n.toLocaleString('es-CO') + ' COP'; }
  window.setRegion = function (r) {
    region = r === 'CO' ? 'CO' : 'US';
    var stored = { region: region === 'CO' ? 'CO' : 'US', source: 'user' };
    try { localStorage.setItem('fresche_currency', JSON.stringify(stored)); } catch (e) {}
    applyPrices();
  };
  function applyPrices() {
    var co = region === 'CO';
    document.querySelectorAll('.cur button').forEach(function (b) { b.classList.toggle('on', b.dataset.r === region); });
    document.querySelectorAll('.p-unit').forEach(function (e) { e.textContent = co ? '$40.000 COP' : '$19.99 USD'; });
    document.querySelectorAll('.p-alt').forEach(function (e) { e.textContent = co ? '$19.99 USD' : '$40.000 COP'; });
    document.querySelectorAll('.p-from').forEach(function (e) { e.textContent = co ? '$40.000 COP' : '$19.99 USD'; });
    document.querySelectorAll('.np[data-cop],.old[data-cop],.save[data-cop]').forEach(function (e) {
      if (co) e.textContent = lang() === 'en' ? e.dataset.cop.replace('Antes', 'Before').replace('Ahorras', 'You save') : e.dataset.cop;
      else e.textContent = lang() === 'en' ? e.dataset.usd : e.dataset.usd.replace('Before', 'Antes').replace('You save', 'Ahorras');
    });
  }

  window.setLang = function (l) {
    l = l === 'en' ? 'en' : 'es';
    document.documentElement.setAttribute('data-lang', l);
    document.documentElement.lang = l;
    try { localStorage.setItem('fresche_lang', l); } catch (e) {}
    document.querySelectorAll('[data-es][data-en]').forEach(function (e) { e.innerHTML = e.getAttribute('data-' + l); });
    document.querySelectorAll('.lang button').forEach(function (b) { b.classList.toggle('on', b.dataset.l === l); });
    applyPrices();
  };

  function toast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(function () { t.hidden = true; }, 2200); }
  function goCheckout() { setTimeout(function () { window.location.href = 'checkout.html'; }, 350); }

  window.buyProduct = function (id) {
    var p = PRODUCTS[id]; if (!p) return;
    var cur = region === 'CO' ? 'COP' : 'USD';
    var cart = getCart();
    var ex = cart.find(function (i) { return i.id === id && i.type !== 'pack'; });
    if (ex) ex.quantity = (Number(ex.quantity) || 0) + 1;
    else cart.push({ id: id, name: p.name, image: p.image, price: UNIT[cur], currency: cur, quantity: 1, type: 'product' });
    saveCart(cart);
    toast(lang() === 'en' ? p.name + ' added to cart' : p.name + ' agregado al carrito');
    goCheckout();
  };

  var curPack = null, sel = [];
  window.openPack = function (type) {
    var cfg = PACKS[type]; if (!cfg) return;
    curPack = type; sel = [];
    var en = lang() === 'en';
    document.getElementById('ptitle').textContent = cfg.name;
    document.getElementById('psub').textContent = en ? 'Choose ' + cfg.quantity + ' scents (you can repeat).' : 'Elige ' + cfg.quantity + ' aromas (puedes repetir).';
    var box = document.getElementById('pchoices'); box.innerHTML = '';
    Object.keys(PRODUCTS).forEach(function (id) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'pchoice'; b.dataset.id = id;
      b.innerHTML = '<img src="' + PRODUCTS[id].thumb + '" alt=""><span>' + PRODUCTS[id].name.replace('FRESCHE ', '') + '</span><em>+</em>';
      b.onclick = function () { if (sel.length < cfg.quantity) { sel.push(id); renderSel(); } };
      box.appendChild(b);
    });
    renderSel();
    document.getElementById('pmodal').hidden = false;
  };
  function renderSel() {
    var cfg = PACKS[curPack];
    document.getElementById('pcount').textContent = sel.length + '/' + cfg.quantity;
    var pl = document.getElementById('plist'); pl.innerHTML = '';
    sel.forEach(function (id, idx) {
      var c = document.createElement('button'); c.type = 'button'; c.className = 'chip';
      c.textContent = PRODUCTS[id].name.replace('FRESCHE ', '') + ' ×'; c.onclick = function () { sel.splice(idx, 1); renderSel(); };
      pl.appendChild(c);
    });
    document.getElementById('padd').disabled = sel.length !== cfg.quantity;
  }
  window.closePack = function () { document.getElementById('pmodal').hidden = true; };
  window.addPack = function () {
    var cfg = PACKS[curPack]; if (!cfg || sel.length !== cfg.quantity) return;
    var co = region === 'CO';
    var cart = getCart();
    cart.push({
      id: 'pack-' + curPack + '-' + Date.now(), name: cfg.name, type: 'pack', packType: curPack,
      products: sel.map(function (id) { return { id: id, name: PRODUCTS[id].name }; }),
      price: co ? cfg.priceCOP : cfg.priceUSD, currency: co ? 'COP' : 'USD', quantity: 1, image: 'images/pack.jpg'
    });
    saveCart(cart);
    closePack();
    toast(lang() === 'en' ? cfg.name + ' added to cart' : cfg.name + ' agregado al carrito');
    goCheckout();
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') window.closePack(); });
  document.getElementById('pmodal').addEventListener('click', function (e) { if (e.target.id === 'pmodal') window.closePack(); });

  region = detectRegion();
  var l = 'es'; try { l = localStorage.getItem('fresche_lang') || ((navigator.language || '').toLowerCase().indexOf('en') === 0 ? 'en' : 'es'); } catch (e) {}
  window.setLang(l);
  updateCount();
  window.addEventListener('storage', updateCount);
})();
