# 🚀 Despliegue a Producción - Backend Mercado Pago

Tu backend está corriendo en local (`http://localhost:3001`). Para producción (cobrar de verdad), necesitas desplegarlo en internet con HTTPS.

## Opción 1: Render (Recomendado - Gratis)

### Pasos:
1. Ve a https://render.com y crea cuenta.
2. Conecta tu GitHub (autoriza).
3. Click en **"New"** → **"Web Service"**.
4. Selecciona tu repo `fresche1.com`.
5. Configura:
   - **Name**: `fresche1-backend`
   - **Root Directory**: `server`
   - **Build command**: `npm install`
   - **Start command**: `npm run dev`
6. En **Environment**, agrega:
   ```
   MERCADOPAGO_ACCESS_TOKEN = APP_USR_7014466574855375-010210-a209f4cd8d8718ed8ef5607ee48e724e-3107280610
   ALLOWED_ORIGINS = https://tu-dominio.com,https://www.tu-dominio.com,http://localhost:5500
   ```
7. Click en **Deploy**.
8. Una vez desplegado, obtén la URL pública (algo como `https://fresche1-backend.onrender.com`).

### Actualizar frontend:
En `checkout.html`, cambia:
```javascript
const BACKEND_URL = 'https://fresche1-backend.onrender.com';
```

---

## Opción 2: Railway (Fácil - Gratis con límite)

### Pasos:
1. Ve a https://railway.app y crea cuenta con GitHub.
2. Click en **"New Project"** → **"Deploy from GitHub repo"**.
3. Selecciona `fresche1.com`.
4. Railway detecta `package.json` automáticamente.
5. En **Variables**, agrega:
   ```
   MERCADOPAGO_ACCESS_TOKEN=APP_USR_...
   ALLOWED_ORIGINS=https://tu-dominio.com,http://localhost:5500
   PORT=3000
   ```
6. Espera a que despliegue (verás el status en el dashboard).
7. Obtén la URL pública desde el panel.

---

## Opción 3: Vercel (Funciones Serverless)

Para esto necesitarías restructurar el backend en funciones. **No recomendado para este caso.**

---

## Opción 4: Tu propio servidor/VPS

Si tienes un servidor (Digital Ocean, AWS, Linode, etc.):

### En el servidor (Ubuntu/Linux):
```bash
# Instala Node
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install nodejs

# Clona repo
git clone https://github.com/fresche1/fresche1.com.git
cd fresche1.com/server

# Instala dependencias
npm install

# Crea .env
cat > .env << EOF
MERCADOPAGO_ACCESS_TOKEN=APP_USR_...
PORT=3000
ALLOWED_ORIGINS=https://tu-dominio.com,https://www.tu-dominio.com
EOF

# Instala PM2 (para mantener el proceso corriendo)
npm install -g pm2
pm2 start server.js --name "fresche1-backend"
pm2 save

# Configura Nginx como proxy (opcional pero recomendado)
sudo apt install nginx
```

Crea `/etc/nginx/sites-available/fresche1-backend`:
```nginx
server {
    listen 443 ssl http2;
    server_name api.tu-dominio.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Después del Despliegue

### 1. Configurar webhook en Mercado Pago
- Ve a https://www.mercadopago.com/developers/panel
- **Tu negocio** → **Configuración** → **Webhooks**
- Agrega URL: `https://tu-url-publica.com/mercadopago-webhook`
- Eventos: `payment`, `merchant_order`

### 2. Actualizar ALLOWED_ORIGINS
En tu hosting, asegúrate de que `ALLOWED_ORIGINS` incluya:
- Tu dominio (ej: `https://fresche1.com`)
- Tu dominio www (ej: `https://www.fresche1.com`)
- Localhost si quieres seguir testing en local

### 3. Actualizar checkout.html
```javascript
const BACKEND_URL = 'https://tu-url-publica.com';
```

### 4. Prueba en producción
- Abre tu sitio (con el backend público).
- Completa checkout, paga con tarjeta real.
- Verifica que el pago aparece en tu dashboard de Mercado Pago.

---

## URLs Importantes

- **Dashboard Mercado Pago**: https://www.mercadopago.com.co/admin/home
- **Webhook settings**: https://www.mercadopago.com/developers/panel
- **Test cards**: https://www.mercadopago.com.co/developers/es/docs/checkout-api/additional-content/your-integrations/test/cards

---

## Resumen Rápido: Render + GitHub

```bash
# En tu repo
git add .
git commit -m "Listo para producción"
git push

# En render.com:
# 1. New Web Service
# 2. Conectar GitHub
# 3. Root Directory = "server"
# 4. Build = "npm install"
# 5. Start = "npm run dev"
# 6. Env vars: MERCADOPAGO_ACCESS_TOKEN + ALLOWED_ORIGINS
# 7. Deploy
# 8. Copiar URL pública
# 9. Actualizar BACKEND_URL en checkout.html
```

---

**Después de desplegar, tu tienda estará en producción con pagos reales. 🎉**
