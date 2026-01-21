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

// Configurar Nodemailer con puerto 465 (SSL) para Render
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: 465, // Puerto 465 con SSL funciona mejor en Render
  secure: true, // Usar SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  logger: true, // Activar logs
  debug: true   // Activar debug
});

// Verificar credenciales al iniciar
console.log('📧 Configuración de Email para Render:');
console.log(`   Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}`);
console.log(`   Port: 465 (SSL)`);
console.log(`   User: ${process.env.SMTP_USER ? '✓' : '✗ FALTA'}`);
console.log(`   Pass: ${process.env.SMTP_PASS ? '✓' : '✗ FALTA'}`);

// Verificar conexión SMTP si hay credenciales
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Error verificando SMTP:', error.message);
    } else {
      console.log('✅ Conexión SMTP verificada exitosamente');
    }
  });
}

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: false }));
app.use(express.json());

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Mercado Pago backend running' });
});

// Test email endpoint
app.get('/api/test-email', async (_req, res) => {
  try {
    console.log('🧪 Test de email iniciado...');

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({ 
        error: 'Credenciales SMTP incompletas',
        details: {
          SMTP_USER: process.env.SMTP_USER ? '✓' : '✗ FALTA',
          SMTP_PASS: process.env.SMTP_PASS ? '✓' : '✗ FALTA'
        }
      });
    }

    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: 'fresche@fresche1.com',
      subject: '✅ Email de Prueba - FRESCHE',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #d4af37;">✅ Email de Prueba</h2>
          <p>Este es un email de prueba del sistema FRESCHE.</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
          <p><strong>Servicio:</strong> Nodemailer + Gmail (Puerto 465 SSL en Render)</p>
          <hr style="border: 1px solid #d4af37;">
          <p style="color: #666;">Si recibiste este email, el sistema de notificaciones está funcionando correctamente. ✓</p>
        </div>
      `
    });
    
    console.log('✅ Email de prueba enviado:', info.messageId);
    res.json({ 
      success: true, 
      message: 'Email de prueba enviado exitosamente',
      messageId: info.messageId,
      to: 'fresche@fresche1.com',
      timestamp: new Date().toLocaleString('es-CO')
    });
  } catch (error) {
    console.error('❌ Error al enviar email de prueba:', error.message);
    res.status(500).json({ 
      error: 'Error al enviar email',
      message: error.message,
      code: error.code,
      timestamp: new Date().toLocaleString('es-CO')
    });
  }
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

    // Responder inmediatamente para no bloquear la redirección
    res.json({ init_point: response.init_point, id: response.id });

    // Enviar email en segundo plano (sin bloquear la respuesta)
    if (orderData && process.env.SMTP_USER && process.env.SMTP_PASS) {
      console.log('📧 Intentando enviar email de pedido...');
      // No usar await - dejar que se envíe en segundo plano
      transporter.sendMail({
        from: process.env.SMTP_USER,
        to: 'fresche@fresche1.com',
        subject: `🛍️ Nuevo Pedido FRESCHE - ${orderData.customerName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d4af37;">🛍️ Nuevo Pedido Recibido</h2>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
            <p><strong>ID de Preferencia MP:</strong> ${response.id}</p>
            
            <hr style="border: 1px solid #d4af37;">
            
            <h3 style="color: #d4af37;">📦 Datos del Cliente</h3>
            <ul>
              <li><strong>Nombre:</strong> ${orderData.customerName}</li>
              <li><strong>Email:</strong> ${orderData.email}</li>
              <li><strong>Teléfono:</strong> ${orderData.phone}</li>
            </ul>
            
            <h3 style="color: #d4af37;">📍 Dirección de Envío</h3>
            <ul>
              <li><strong>Dirección:</strong> ${orderData.address}</li>
              <li><strong>Ciudad:</strong> ${orderData.city}</li>
              <li><strong>Departamento:</strong> ${orderData.state || 'N/A'}</li>
              <li><strong>Código Postal:</strong> ${orderData.zipCode || 'N/A'}</li>
              <li><strong>Método de Envío:</strong> ${orderData.shippingMethod || 'N/A'}</li>
            </ul>
            
            <h3 style="color: #d4af37;">🛒 Productos</h3>
            <pre style="background: #f4f4f4; padding: 10px; border-radius: 5px;">${preference.items.map(item => 
              `- ${item.title} x${item.quantity} - $${item.unit_price.toLocaleString()}`
            ).join('\n')}</pre>
            
            <h3 style="color: #d4af37;">💰 Totales</h3>
            <ul>
              <li><strong>Subtotal:</strong> $${orderData.subtotal || 0}</li>
              <li><strong>Envío:</strong> $${orderData.shippingCost || 0}</li>
              <li><strong>Total:</strong> <span style="color: #d4af37; font-size: 1.2em;">${orderData.total || 0} ${orderData.currency || 'COP'}</span></li>
            </ul>
            
            <hr style="border: 1px solid #d4af37;">
            
            <p style="color: #666; font-size: 0.9em;">Este pedido fue realizado a través de fresche1.com</p>
          </div>
        `
      }).then(() => {
        console.log('✅ Email enviado exitosamente a fresche@fresche1.com');
      }).catch((emailError) => {
        console.error('❌ ERROR al enviar email:', emailError);
        console.error('   Mensaje:', emailError.message);
        console.error('   Código:', emailError.code);
      });
    } else {
      console.warn('⚠️ Email NO enviado - Faltan credenciales SMTP o datos del pedido');
      console.warn(`   orderData: ${orderData ? '✓' : '✗'}`);
      console.warn(`   SMTP_USER: ${process.env.SMTP_USER ? '✓' : '✗'}`);
      console.warn(`   SMTP_PASS: ${process.env.SMTP_PASS ? '✓' : '✗'}`);
    }
    
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
