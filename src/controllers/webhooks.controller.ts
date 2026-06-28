import { Request, Response } from 'express';
import { logger } from '../config/logger';
import { ordersRepository } from '../modules/orders/orders.repository';
import { verifyWebhookSignature } from '../modules/orders/paypal.service';
import { sendOrderConfirmation } from '../modules/orders/email.service';
import { createCjOrder } from '../modules/orders/cj.service';

export const webhooksController = {
  async paypal(req: Request, res: Response): Promise<void> {
    const rawBody = JSON.stringify(req.body);
    const event = req.body;

    logger.info({ eventType: event.event_type, id: event.id }, 'PayPal webhook received');

    // Verify signature
    const valid = await verifyWebhookSignature(req.headers as Record<string, string>, rawBody);
    if (!valid) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    // Only process completed payments
    if (event.event_type !== 'CHECKOUT.ORDER.APPROVED' && event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      logger.info({ eventType: event.event_type }, 'Ignoring non-payment webhook event');
      res.status(200).json({ status: 'ignored' });
      return;
    }

    try {
      const resource = event.resource;
      let paypalOrderId: string;
      let amount: number;
      let currency: string;
      let customerName: string;
      let customerEmail: string;
      let customerPhone = '';
      let shippingAddress = '';
      let shippingCity = '';
      let shippingCountry = 'US';
      let items: unknown[] = [];
      let quantity = 1;

      if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        // PAYMENT.CAPTURE.COMPLETED has capture details
        paypalOrderId = resource.supplementary_data?.related_ids?.order_id || resource.id;
        amount = parseFloat(resource.amount?.value || '0');
        currency = resource.amount?.currency_code || 'USD';
        customerName = resource.shipping?.name?.full_name || 'Cliente';
        customerEmail = resource.payer?.email_address || '';
        customerPhone = resource.payer?.phone?.phone_number?.national_number || '';

        const shipping = resource.shipping?.address || {};
        shippingAddress = shipping.address_line_1 || '';
        shippingCity = shipping.admin_area_2 || shipping.admin_area_1 || '';
        shippingCountry = shipping.country_code || 'US';
      } else {
        // CHECKOUT.ORDER.APPROVED
        paypalOrderId = resource.id;
        const unit = resource.purchase_units?.[0] || {};
        amount = parseFloat(unit.amount?.value || '0');
        currency = unit.amount?.currency_code || 'USD';
        customerName = unit.shipping?.name?.full_name || resource.payer?.name?.given_name || 'Cliente';
        customerEmail = resource.payer?.email_address || '';
        customerPhone = resource.payer?.phone?.phone_number?.national_number || '';

        const shipping = unit.shipping?.address || {};
        shippingAddress = shipping.address_line_1 || '';
        shippingCity = shipping.admin_area_2 || shipping.admin_area_1 || '';
        shippingCountry = shipping.country_code || 'US';

        if (unit.description) {
          const match = unit.description.match(/^(\d+)x\s/);
          if (match) quantity = parseInt(match[1], 10);
        }
        if (unit.items) {
          items = unit.items.map((i: any) => ({
            name: i.name,
            quantity: parseInt(i.quantity || '1', 10),
            price: i.unit_amount?.value,
          }));
          quantity = items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
        }
      }

      if (items.length === 0) {
        items = [{ name: 'Chargly Mini Magnetic Power Bank 10000mAh', quantity, price: amount }];
      }

      // Check for duplicate
      const existing = await ordersRepository.findByPaypalId(paypalOrderId);
      if (existing) {
        logger.info({ paypalOrderId }, 'Duplicate webhook — order already exists');
        res.status(200).json({ status: 'duplicate' });
        return;
      }

      // Create order in database
      const order = await ordersRepository.create({
        paypal_order_id: paypalOrderId,
        paypal_status: event.event_type === 'PAYMENT.CAPTURE.COMPLETED' ? 'COMPLETED' : 'APPROVED',
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        shipping_address: shippingAddress,
        shipping_city: shippingCity,
        shipping_country: shippingCountry,
        items,
        quantity,
        amount,
        currency,
      });

      logger.info({ orderId: order.id, paypalOrderId, amount }, 'Order created from PayPal webhook');

      // Send confirmation email (non-blocking)
      sendOrderConfirmation(order).then(sent => {
        if (sent) ordersRepository.markConfirmationSent(order.id);
      });

      // Create CJ order (non-blocking)
      createCjOrder(order).then(result => {
        if (result) {
          ordersRepository.updateCjOrder(order.id, result.orderId, 'created');
        }
      });

      res.status(200).json({ status: 'ok', orderId: order.id });
    } catch (err) {
      logger.error({ err }, 'Error processing PayPal webhook');
      res.status(500).json({ error: 'Internal error processing webhook' });
    }
  },
};
