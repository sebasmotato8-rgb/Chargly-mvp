import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { OrderRow } from './orders.repository';

function createTransport() {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    logger.warn('SMTP credentials not configured — emails will be skipped');
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

const transporter = createTransport();

export async function sendOrderConfirmation(order: OrderRow): Promise<boolean> {
  if (!transporter) {
    logger.warn({ orderId: order.id }, 'Skipping email — SMTP not configured');
    return false;
  }

  const itemsList = (order.items as Array<{ name?: string; quantity?: number }>)
    .map(i => `  • ${i.quantity || 1}x ${i.name || 'Chargly Power Bank'}`)
    .join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">

    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="font-family:'Bebas Neue',Arial,sans-serif;font-size:32px;color:#0D0D0D;margin:0;">CHARGLY</h1>
    </div>

    <div style="background:#fff;border:1px solid #E8E4DF;border-radius:8px;padding:32px;">
      <h2 style="color:#0D0D0D;font-size:22px;margin:0 0 8px;">¡Pedido Confirmado!</h2>
      <p style="color:#888880;font-size:14px;margin:0 0 24px;">
        Hola <strong style="color:#0D0D0D;">${order.customer_name}</strong>, tu pago ha sido procesado exitosamente.
      </p>

      <div style="background:#F5F2EE;border-radius:6px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#888880;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding:4px 0;">Número de orden</td>
            <td style="color:#0D0D0D;font-size:14px;font-weight:600;text-align:right;padding:4px 0;">#${order.paypal_order_id}</td>
          </tr>
          <tr>
            <td style="color:#888880;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding:4px 0;">Total pagado</td>
            <td style="color:#0D0D0D;font-size:14px;font-weight:600;text-align:right;padding:4px 0;">$${Number(order.amount).toFixed(2)} ${order.currency}</td>
          </tr>
          <tr>
            <td style="color:#888880;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding:4px 0;">Cantidad</td>
            <td style="color:#0D0D0D;font-size:14px;font-weight:600;text-align:right;padding:4px 0;">${order.quantity}</td>
          </tr>
        </table>
      </div>

      <h3 style="color:#0D0D0D;font-size:16px;margin:0 0 12px;">Dirección de envío</h3>
      <p style="color:#888880;font-size:14px;margin:0 0 24px;line-height:1.6;">
        ${order.shipping_address}<br>
        ${order.shipping_city}, ${order.shipping_country}
      </p>

      <h3 style="color:#0D0D0D;font-size:16px;margin:0 0 12px;">Próximos pasos</h3>
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:flex-start;margin-bottom:12px;">
          <span style="background:#D4825A;color:#fff;font-size:12px;font-weight:700;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0;">1</span>
          <span style="color:#555;font-size:14px;">Tu pedido será procesado y enviado en 1-3 días hábiles.</span>
        </div>
        <div style="display:flex;align-items:flex-start;margin-bottom:12px;">
          <span style="background:#D4825A;color:#fff;font-size:12px;font-weight:700;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0;">2</span>
          <span style="color:#555;font-size:14px;">Recibirás un email con tu número de tracking cuando se despache.</span>
        </div>
        <div style="display:flex;align-items:flex-start;">
          <span style="background:#D4825A;color:#fff;font-size:12px;font-weight:700;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0;">3</span>
          <span style="color:#555;font-size:14px;">Entrega estimada: <strong>15-20 días hábiles</strong>.</span>
        </div>
      </div>
    </div>

    <div style="text-align:center;margin-top:32px;">
      <p style="color:#888880;font-size:12px;margin:0 0 4px;">¿Tienes preguntas? Escríbenos a</p>
      <a href="mailto:soporte@chargly.shop" style="color:#D4825A;font-size:14px;font-weight:600;text-decoration:none;">soporte@chargly.shop</a>
      <p style="color:#ccc;font-size:11px;margin:20px 0 0;">© ${new Date().getFullYear()} Chargly. Todos los derechos reservados.</p>
    </div>

  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_USER}>`,
      to: order.customer_email,
      subject: `✓ Pedido confirmado — #${order.paypal_order_id}`,
      html,
      text: `¡Pedido Confirmado!\n\nHola ${order.customer_name},\n\nTu pedido #${order.paypal_order_id} por $${Number(order.amount).toFixed(2)} ${order.currency} ha sido procesado.\n\nProductos:\n${itemsList}\n\nDirección de envío:\n${order.shipping_address}\n${order.shipping_city}, ${order.shipping_country}\n\nEntrega estimada: 15-20 días hábiles.\n\nSoporte: soporte@chargly.shop`,
    });
    logger.info({ orderId: order.id, email: order.customer_email }, 'Confirmation email sent');
    return true;
  } catch (err) {
    logger.error({ err, orderId: order.id }, 'Failed to send confirmation email');
    return false;
  }
}
