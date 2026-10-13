"""E2E con Playwright: sitio estático local (8080) + backend local con pagos SIMULADOS (3001).
Todas las peticiones a hosts externos se bloquean. Guarda capturas en /workspace/fresche-final-shots."""
import json, os, sys, urllib.request, urllib.parse
from playwright.sync_api import sync_playwright

SITE = 'http://localhost:8080'
API = 'http://localhost:3001'
SHOTS = os.environ.get('SHOTS_DIR', '/workspace/fresche-final-shots')
os.makedirs(SHOTS, exist_ok=True)
results = []
def check(name, cond, info=''):
    results.append((name, bool(cond), info)); print(('PASS' if cond else 'FAIL'), name, info)
def jget(path): return json.load(urllib.request.urlopen(API + path))

PRICE_KEYS = {'unit_price', 'price', 'priceCOP', 'priceUSD', 'total', 'subtotal', 'shippingCost', 'commission', 'currency'}
def find_price_keys(o, path=''):
    out = []
    if isinstance(o, dict):
        for k, v in o.items():
            if k in PRICE_KEYS: out.append(path + '.' + k)
            out += find_price_keys(v, path + '.' + k)
    elif isinstance(o, list):
        for i, v in enumerate(o): out += find_price_keys(v, f'{path}[{i}]')
    return out

def block_external(ctx):
    ctx.route('**/*', lambda route: route.continue_() if route.request.url.startswith(('http://localhost', 'http://127.0.0.1', 'data:')) else route.abort())

def open_checkout(page, cart, region=None):
    page.goto(SITE + '/index.html')
    page.evaluate("(a) => { localStorage.clear(); localStorage.setItem('freshCart', JSON.stringify(a[0])); if (a[1]) localStorage.setItem('fresche_currency', JSON.stringify({region: a[1]})); }", [cart, region])
    page.goto(SITE + '/checkout.html'); page.wait_for_timeout(300)

def fill_buyer(page, name, phone, email):
    page.fill('#fullName', name); page.fill('#phone', phone); page.fill('#email', email)

def wait_total(page, txt):
    try: page.wait_for_function("t => document.getElementById('tTotal').textContent.includes(t)", arg=txt, timeout=4000)
    except Exception: pass
    return page.inner_text('#tTotal')

CART_CO = [{'id': 'cherry', 'name': '<img src=x onerror=window.__xss=1>', 'quantity': 1, 'price': 1},
           {'id': 'pack-duo-1', 'name': 'Pack Dúo', 'type': 'pack', 'packType': 'duo', 'products': [{'id': 'velvet'}, {'id': 'coco'}], 'quantity': 1, 'price': 1}]

with sync_playwright() as p:
    browser = p.chromium.launch()
    mobile = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id='America/Bogota', locale='es-CO')
    ctx = browser.new_context(**mobile); block_external(ctx)
    page = ctx.new_page()
    sent = {}
    def capture(route):
        sent.setdefault(route.request.url.split('/api/')[1], []).append(json.loads(route.request.post_data)); route.continue_()
    for ep in ['create-preference', 'create-paypal-order', 'create-stripe-checkout-session', 'manual-order']:
        page.route('**/api/' + ep, capture)

    # ---------- Flujo 0: index real -> checkout ----------
    page.goto(SITE + '/index.html'); page.evaluate('localStorage.clear()'); page.reload()
    page.locator('#ella .card', has_text='CherryMood').get_by_role('button').click()
    page.wait_for_url('**/checkout.html')
    check('index -> checkout con el producto en el resumen', 'CherryMood' in page.inner_text('#lines'))

    # ---------- Flujo 1: Colombia (móvil) Medellín, 3 unidades -> Mercado Pago ----------
    open_checkout(page, CART_CO, 'CO')
    check('CO: país Colombia preseleccionado y Mercado Pago principal', page.locator('#countrySeg button[data-c=CO].on').count() == 1 and page.locator('.pm.on[data-m=MERCADOPAGO]').is_visible())
    check('CO: texto MP "Tarjeta, PSE, Nequi"', 'Tarjeta, PSE, Nequi' in page.inner_text('[data-m=MERCADOPAGO]'))
    page.locator('#payBtn').click()
    check('CO: validación en español al enviar vacío', page.locator('.f.bad').count() >= 5 and 'Escribe tu nombre completo.' in page.inner_text('[data-f=fullName]') and page.locator('[data-f=fullName] .msg').is_visible())
    fill_buyer(page, 'Ana Prueba', '+57 300 000 0000', 'ana@example.com')
    page.select_option('#department', 'Antioquia'); page.fill('#cityCO', 'Medellín'); page.fill('#addressCO', 'Cra 10 # 20-30'); page.fill('#notesCO', 'Laureles, portería')
    page.check('#terms')
    shown = wait_total(page, '115.499')
    check('CO: total mostrado = 40.000 + 69.999 + envío gratis (3 u.) + 5% = $115.499 COP', '$115.499 COP' == shown, shown)
    check('CO: envío "Gratis" y comisión 5.500', page.inner_text('#tShip') == 'Gratis' and '5.500' in page.inner_text('#tFee'))
    check('CO: XSS en nombre de carrito no se ejecuta', page.evaluate('window.__xss') is None)
    page.screenshot(path=f'{SHOTS}/checkout-simple-mobile-CO.png', full_page=True)
    page.locator('#payBtn').click()
    try: page.wait_for_url('**#mp-mock', timeout=8000)
    except Exception: print('DEBUG', page.inner_text('#errBox'), [e for e in page.locator('.f.bad').all_inner_texts()])
    body = sent['create-preference'][-1]
    check('CO: request sin precios ni moneda del cliente', not find_price_keys(body), find_price_keys(body))
    b = body['order']['buyer']
    check('CO: dirección completa llega al servidor', b['state'] == 'Antioquia' and b['city'] == 'Medellín' and b['notes'] == 'Laureles, portería' and b['country'] == 'CO', b)
    pref = jget('/__test/preferences')[-1]
    t = sum(i['unit_price'] * i['quantity'] for i in pref['items'])
    check('CO: preferencia MP en COP por 115.499', t == 115499 and all(i['currency_id'] == 'COP' for i in pref['items']), t)
    check('CO: metadata MP lleva pedido completo', pref['metadata']['order']['buyer']['notes'] == 'Laureles, portería' and pref['external_reference'] == pref['metadata']['order_id'])
    stored = page.evaluate('JSON.stringify(localStorage)')
    check('CO: sin PII en localStorage', 'ana@example.com' not in stored and 'Cra 10' not in stored)

    # ---------- Flujo 2: Colombia 1 unidad Bogotá -> 9.000 envío; Nequi manual ----------
    open_checkout(page, [{'id': 'velvet', 'quantity': 1}], 'CO')
    fill_buyer(page, 'Uno Prueba', '3100000000', 'uno@example.com')
    page.select_option('#department', 'Bogotá D.C.'); page.fill('#cityCO', 'Bogotá'); page.fill('#addressCO', 'Cra 7 # 1-1')
    page.locator('[data-m=NEQUI]').click(); page.check('#terms')
    shown = wait_total(page, '49.000')
    check('CO Bogotá 1 u. Nequi: envío 9.000, total $49.000 COP sin comisión', page.inner_text('#tShip') == '$9.000 COP' and shown == '$49.000 COP' and page.locator('#rowFee').is_hidden(), shown)
    page.locator('#payBtn').click(); page.wait_for_selector('#done', state='visible')
    check('CO Nequi: pedido creado en servidor con id y total', page.inner_text('#doneId').startswith('FR-') and '$49.000 COP' in page.inner_text('#doneBody'))
    check('CO Nequi: enlace WhatsApp con id de pedido', page.inner_text('#doneId') in urllib.parse.unquote(page.get_attribute('#doneWa', 'href')))

    # ---------- Flujo 3: Estados Unidos (móvil) 1 unidad -> PayPal, $29.98 USD ----------
    urllib.request.urlopen(API + '/__test/stripe?on=0').read()
    open_checkout(page, [{'id': 'cherry', 'quantity': 1}], None)
    page.locator('#countrySeg button[data-c=US]').click()
    check('US: PayPal principal "con PayPal o tarjeta sin cuenta", Zelle pequeño debajo', page.locator('.pm.on[data-m=PAYPAL]').is_visible() and 'tarjeta sin cuenta' in page.inner_text('[data-m=PAYPAL]').lower() and page.locator('[data-m=ZELLE]').bounding_box()['y'] > page.locator('[data-m=PAYPAL]').bounding_box()['y'])
    check('US sin Stripe: opción Stripe oculta', page.locator('#pmStripe').is_hidden())
    check('US: Mercado Pago no se ofrece', page.locator('[data-m=MERCADOPAGO]').is_hidden())
    fill_buyer(page, 'John Test', '+1 212 555 0100', 'john@example.com')
    page.fill('#addressUS', '350 5th Ave'); page.fill('#notesUS', 'Apt 7B'); page.fill('#cityUS', 'New York'); page.fill('#stateUS', 'ny'); page.fill('#zipUS', '123')
    page.check('#terms'); page.locator('#payBtn').click()
    check('US: ZIP inválido -> mensaje en español', page.locator('[data-f=zipUS] .msg').is_visible() and 'ZIP de 5' in page.inner_text('[data-f=zipUS]'))
    page.fill('#zipUS', '10118')
    shown = wait_total(page, '29.98')
    check('US: total $29.98 USD (19.99 + envío 9.99)', shown == '$29.98 USD' and page.inner_text('#tShip') == '$9.99 USD', shown)
    page.screenshot(path=f'{SHOTS}/checkout-simple-mobile-US.png', full_page=True)
    page.locator('#payBtn').click(); page.wait_for_url('**#paypal-mock')
    body = sent['create-paypal-order'][-1]['order']
    check('US: estado en mayúsculas, ZIP y notas llegan al servidor', body['buyer']['state'] == 'NY' and body['buyer']['postalCode'] == '10118' and body['buyer']['notes'] == 'Apt 7B')
    pu = jget('/__test/paypal')[-1]['purchase_units'][0]
    check('US: PayPal USD 29.98 con custom_id del pedido y dirección', pu['amount'] == {'currency_code': 'USD', 'value': '29.98', 'breakdown': {'item_total': {'currency_code': 'USD', 'value': '19.99'}, 'shipping': {'currency_code': 'USD', 'value': '9.99'}}} and pu['custom_id'].startswith('FR-') and pu['shipping']['address']['postal_code'] == '10118', pu.get('custom_id'))

    # US Trío -> envío gratis; Stripe activo
    urllib.request.urlopen(API + '/__test/stripe?on=1').read()
    open_checkout(page, [{'id': 'pack-trio-1', 'type': 'pack', 'packType': 'trio', 'products': [{'id': 'cherry'}, {'id': 'velvet'}, {'id': 'tobacco'}], 'quantity': 1}], 'US')
    page.wait_for_timeout(400)
    check('US con Stripe activo: opción tarjeta Stripe visible', page.locator('#pmStripe').is_visible())
    fill_buyer(page, 'John Test', '+1 212 555 0100', 'john@example.com')
    page.fill('#addressUS', '350 5th Ave'); page.fill('#cityUS', 'New York'); page.fill('#stateUS', 'NY'); page.fill('#zipUS', '10118')
    page.locator('#pmStripe').click(); page.check('#terms')
    shown = wait_total(page, '44.99')
    check('US Trío: envío gratis, $44.99 USD', shown == '$44.99 USD' and page.inner_text('#tShip') == 'Gratis', shown)
    page.locator('#payBtn').click(); page.wait_for_url('**#stripe-mock')
    check('US Stripe: pedido enviado sin precios', not find_price_keys(sent['create-stripe-checkout-session'][-1]))
    urllib.request.urlopen(API + '/__test/stripe?on=0').read()

    # Otro país (México) -> USD; recogida NY/NJ
    open_checkout(page, [{'id': 'cherry', 'quantity': 1}], 'CO')
    page.locator('#countrySeg button[data-c=OTHER]').click(); page.select_option('#otherCountry', 'MX')
    shown = wait_total(page, 'USD')
    check('México: moneda USD y PayPal (no Mercado Pago)', 'USD' in shown and page.locator('[data-m=PAYPAL]').is_visible() and page.locator('[data-m=MERCADOPAGO]').is_hidden(), shown)
    page.locator('#countrySeg button[data-c=US]').click(); page.locator('#modeOpts [data-mode=pickup]').click()
    check('US recogida gratis NY/NJ: sin dirección y envío Gratis', page.locator('#usFields').is_hidden() and 'New Jersey' in page.inner_text('#pickupDesc') and wait_total(page, '19.99') == '$19.99 USD')

    # ---------- payment-response.html (seguridad) ----------
    xss = []
    page.on('dialog', lambda d: (xss.append(d.message), d.accept()))
    page.goto(SITE + '/payment-response.html?status=success&orderId=<script>alert(1)</script>'); page.wait_for_timeout(800)
    txt = page.inner_text('#response-content')
    check('response: no ejecuta <script> de la URL ni muestra éxito falso', not xss and '¡Pago Exitoso!' not in txt)
    page.goto(SITE + '/payment-response.html?provider=mercadopago&status=approved&payment_id=556'); page.wait_for_timeout(800)
    check('response: pago con monto menor -> NO éxito', '¡Pago Exitoso!' not in page.inner_text('#response-content'))
    page.goto(SITE + '/payment-response.html?provider=mercadopago&status=failure&payment_id=555'); page.wait_for_timeout(800)
    check('response: éxito solo si backend verifica', '¡Pago Exitoso!' in page.inner_text('#response-content'))

    # ---------- Escritorio ----------
    d = browser.new_context(viewport={'width': 1366, 'height': 900}, timezone_id='America/Bogota', locale='es-CO'); block_external(d)
    dp = d.new_page()
    open_checkout(dp, CART_CO, 'CO')
    fill_buyer(dp, 'Ana Prueba', '+57 300 000 0000', 'ana@example.com')
    dp.select_option('#department', 'Antioquia'); dp.fill('#cityCO', 'Medellín'); dp.fill('#addressCO', 'Cra 10 # 20-30')
    wait_total(dp, '115.499')
    dp.screenshot(path=f'{SHOTS}/checkout-simple-desktop.png', full_page=True)
    check('escritorio: resumen a la derecha', dp.locator('#summary').bounding_box()['x'] > 600)
    browser.close()

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)}/{len(results)} E2E checks passed')
sys.exit(1 if failed else 0)
