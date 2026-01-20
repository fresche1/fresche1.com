// Backend mínimo para Mercado Pago
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',');

// Configurar Mercado Pago con Access Token desde variable de entorno
const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  console.warn('⚠️ MERCADOPAGO_ACCESS_TOKEN no está definido. Añádelo en .env');
}

// Crear cliente de Mercado Pago con la nueva API
const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN || '' });

// Configurar Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: false }));
app.use(express.json());

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Mercado Pago backend running' });
});

// Crear preferencia de pago
app.post('/api/create-preference', async (req, res) => {
  try {
    const { preference, orderData } = req.body;
    if (!preference || !preference.items || !Array.isArray(preference.items)) {
      return res.status(400).json({ error: 'Preference inválida' });
    }

    const preferenceData = {
      ...preference,
      notification_url: preference.notification_url || `${req.protocol}://${req.get('host')}/mercadopago-webhook`,
      auto_return: preference.auto_return || 'approved'
    };

    const preferenceInstance = new Preference(client);
    const response = await preferenceInstance.create({ body: preferenceData });

    // Enviar email con los datos del pedido
    if (orderData && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const itemsList = preference.items.map(item => 
          `- ${item.title} x${item.quantity} - $${item.unit_price.toLocaleString()}`
        ).join('\n');

        const mailOptions = {
          from: process.env.SMTP_USER,
          to: 'fresche@fresche1.com',
          subject: `Nuevo Pedido - ${orderData.customerName}`,
          html: `
            <h2>🛍️ Nuevo Pedido Recibido</h2>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
            
            <h3>📦 Datos del Cliente</h3>
            <ul>
              <li><strong>Nombre:</strong> ${orderData.customerName}</li>
              <li><strong>Email:</strong> ${orderData.email}</li>
              <li><strong>Teléfono:</strong> ${orderData.phone}</li>
            </ul>
            
            <h3>📍 Dirección de Envío</h3>
            <ul>
              <li><strong>Dirección:</strong> ${orderData.address}</li>
              <li><strong>Ciudad:</strong> ${orderData.city}</li>
              <li><strong>Departamento:</strong> ${orderData.state || 'N/A'}</li>
              <li><strong>Código Postal:</strong> ${orderData.zipCode || 'N/A'}</li>
              <li><strong>Método de Envío:</strong> ${orderData.shippingMethod || 'N/A'}</li>
            </ul>
            
            <h3>🛒 Productos</h3>
            <pre>${itemsList}</pre>
            
            <h3>💰 Totales</h3>
            <ul>
              <li><strong>Subtotal:</strong> $${orderData.subtotal || 0}</li>
              <li><strong>Envío:</strong> $${orderData.shippingCost || 0}</li>
              <li><strong>Total:</strong> $${orderData.total || 0}</li>
            </ul>
            
            <p><em>ID de Preferencia MP: ${response.id}</em></p>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log('✅ Email enviado a fresche@fresche1.com');
      } catch (emailError) {
        console.error('⚠️ Error al enviar email:', emailError.message);
        // No fallar la respuesta si el email falla
      }
    }

    return res.json({ init_point: response.init_point, id: response.id });
  } catch (error) {
    console.error('Error al crear preferencia:', error);
    return res.status(500).json({ error: 'Error al crear preferencia' });
  }
});

// Webhook (opcional)
app.post('/mercadopago-webhook', async (req, res) => {
  try {
    const { type, data } = req.body;
    console.log('Webhook recibido:', type, data);
    // Aquí puedes consultar el pago y actualizar tu base de datos
    return res.sendStatus(200);
  } catch (error) {
    console.error('Error en webhook:', error);
    return res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Mercado Pago backend escuchando en puerto ${PORT}`);
});
