// Backend mínimo para Mercado Pago + Resend
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { Resend } from 'resend';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',');

// Configurar Mercado Pago
const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  console.warn('⚠️ MERCADOPAGO_ACCESS_TOKEN no está definido');
}
const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN || '' });

// Configurar Resend para envíos de email
const resend = new Resend(process.env.RESEND_API_KEY);

// Verificar configuración al iniciar
console.log('📧 Configuración de Email:');
console.log(`   Servicio: Resend`);
console.log(`   API Key: ${process.env.RESEND_API_KEY ? '✓' : '✗ FALTA'}`);
console.log(`   Email: ${process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev'}`);

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: false }));
app.use(express.json());

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Mercado Pago backend running' });
});

// Test email endpoint
app.get('/api/test-email', async (_req, res) => {
  try {
    console.log('🧪 Test de email iniciado con Resend...');

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ 
        error: 'RESEND_API_KEY no configurado',
        message: 'Agrega RESEND_API_KEY en las variables de entorno de Render'
      });
    }

    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: 'galindo243@live.com', // Test solo a tu email
      subject: '✅ Email de Prueba - FRESCHE',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #d4af37;">✅ Email de Prueba</h2>
          <p>Este es un email de prueba del sistema FRESCHE.</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
          <p><strong>Servicio:</strong> Resend API</p>
          <hr style="border: 1px solid #d4af37;">
          <p style="color: #666;">Si recibiste este email, el sistema de notificaciones está funcionando correctamente. ✓</p>
        </div>
      `
    });

    if (result.error) {
      console.error('❌ Error de Resend:', result.error);
      return res.status(500).json({ 
        error: 'Error al enviar email',
        message: result.error.message,
        timestamp: new Date().toLocaleString('es-CO')
      });
    }

    console.log('✅ Email de prueba enviado:', result.data.id);
    res.json({ 
      success: true, 
      message: 'Email de prueba enviado exitosamente',
      emailId: result.data.id,
      to: 'galindo243@live.com',
      timestamp: new Date().toLocaleString('es-CO')
    });
  } catch (error) {
    console.error('❌ Error al enviar email de prueba:', error.message);
    res.status(500).json({ 
      error: 'Error al enviar email',
      message: error.message,
      timestamp: new Date().toLocaleString('es-CO')
    });
  }
});

// Enviar email simple (para confirmaciones de Mercado Pago)
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ 
        error: 'Faltan parámetros requeridos: to, subject, html' 
      });
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY no está configurado');
      return res.status(500).json({ 
        error: 'Servicio de email no configurado',
        message: 'RESEND_API_KEY falta en variables de entorno'
      });
    }

    console.log(`📧 Enviando email a ${to}...`);

    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: to,
      subject: subject,
      html: html
    });

    if (result.error) {
      console.error('❌ Error de Resend:', result.error);
      return res.status(500).json({ 
        error: 'Error al enviar email',
        details: result.error.message
      });
    }

    console.log('✅ Email enviado exitosamente:', result.data.id);
    res.json({ 
      success: true, 
      messageId: result.data.id,
      to: to,
      timestamp: new Date().toLocaleString('es-CO')
    });
  } catch (error) {
    console.error('❌ Error al enviar email:', error.message);
    res.status(500).json({ 
      error: 'Error al enviar email',
      message: error.message
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

    // Enviar email en segundo plano con Resend
    if (orderData && process.env.RESEND_API_KEY) {
      console.log('📧 Intentando enviar email de pedido con Resend...');
      
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
          <div style="background: white; padding: 20px; border-radius: 10px; border-left: 4px solid #d4af37;">
            <h2 style="color: #d4af37; margin-top: 0;">🛍️ Nuevo Pedido Recibido</h2>
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
              <li><strong>Zona de Envío:</strong> ${orderData.shippingMethod || 'N/A'}</li>
            </ul>
            
            <h3 style="color: #d4af37;">🛒 Productos Ordenados</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f0f0f0;">
                  <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Producto</th>
                  <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Cantidad</th>
                  <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Precio Unit.</th>
                  <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${preference.items.map(item => `
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${item.title}</td>
                    <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${item.quantity}</td>
                    <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">$${Number(item.unit_price).toLocaleString('es-CO')}</td>
                    <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">$${Number(item.unit_price * item.quantity).toLocaleString('es-CO')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <h3 style="color: #d4af37;">💰 Resumen de Pago</h3>
            <ul style="font-size: 1.1em;">
              <li><strong>Subtotal:</strong> $${Number(orderData.subtotal || 0).toLocaleString('es-CO')}</li>
              <li><strong>Costo de Envío:</strong> ${orderData.country === 'CO' ? 'Gratis' : `$${Number(orderData.shippingCost || 0).toLocaleString('es-CO')}`}</li>
              <li style="color: #d4af37; font-size: 1.3em; margin-top: 10px;">
                <strong>TOTAL: $${Number(orderData.total || 0).toLocaleString('es-CO')} COP</strong>
              </li>
            </ul>
            
            <hr style="border: 1px solid #d4af37; margin: 20px 0;">
            
            <p style="color: #666; font-size: 0.9em; text-align: center;">
              Pedido realizado a través de <strong>fresche1.com</strong><br>
              Este es un email automático. Por favor no respondas a este correo.
            </p>
          </div>
        </div>
      `;
      
      resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: 'galindo243@live.com', // Enviar a tu email para plan gratuito
        subject: `🛍️ Nuevo Pedido FRESCHE - ${orderData.customerName}`,
        html: emailBody
      }).then((result) => {
        if (result.error) {
          console.error('❌ Error enviando email:', result.error);
        } else {
          console.log('✅ Email enviado exitosamente:', result.data.id);
        }
      }).catch((error) => {
        console.error('❌ ERROR enviando email:', error.message);
      });
    } else {
      console.warn('⚠️ Email NO enviado - Faltan RESEND_API_KEY o datos del pedido');
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
