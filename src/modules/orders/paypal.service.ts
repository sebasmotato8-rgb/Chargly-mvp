import { env } from '../../config/env';
import { logger } from '../../config/logger';

const PAYPAL_BASE = env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64');

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const json = await res.json() as any;
  if (!res.ok) {
    logger.error({ status: res.status, body: json }, 'PayPal auth failed');
    throw new Error('PayPal authentication failed');
  }
  return json.access_token;
}

export async function verifyWebhookSignature(
  headers: Record<string, string | string[] | undefined>,
  body: string,
): Promise<boolean> {
  if (!env.PAYPAL_WEBHOOK_ID || env.PAYPAL_WEBHOOK_ID === 'PAYPAL_WEBHOOK_ID_AQUI') {
    logger.warn('PayPal Webhook ID not configured — skipping verification');
    return true;
  }

  try {
    const token = await getAccessToken();
    const res = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: env.PAYPAL_WEBHOOK_ID,
        webhook_event: JSON.parse(body),
      }),
    });

    const json = await res.json() as any;
    const valid = json.verification_status === 'SUCCESS';
    if (!valid) {
      logger.warn({ status: json.verification_status }, 'PayPal webhook signature invalid');
    }
    return valid;
  } catch (err) {
    logger.error({ err }, 'PayPal webhook verification error');
    return false;
  }
}

export async function getOrderDetails(orderId: string): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    logger.error({ status: res.status, orderId }, 'Failed to get PayPal order details');
    throw new Error(`PayPal order fetch failed: ${res.status}`);
  }
  return res.json();
}
