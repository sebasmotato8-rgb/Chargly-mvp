import { supabaseService } from '../../integrations/supabase/client';
import { logger } from '../../config/logger';

export interface OrderRow {
  id: string;
  paypal_order_id: string;
  paypal_status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_country: string;
  items: unknown[];
  quantity: number;
  amount: number;
  currency: string;
  cj_order_id: string | null;
  cj_status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  status: string;
  confirmation_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderInput {
  paypal_order_id: string;
  paypal_status: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  shipping_address: string;
  shipping_city: string;
  shipping_country: string;
  items: unknown[];
  quantity: number;
  amount: number;
  currency: string;
}

export const ordersRepository = {
  async create(input: CreateOrderInput): Promise<OrderRow> {
    const { data, error } = await supabaseService
      .from('orders')
      .insert(input)
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Failed to create order');
      throw error;
    }
    return data as OrderRow;
  },

  async findByPaypalId(paypalOrderId: string): Promise<OrderRow | null> {
    const { data, error } = await supabaseService
      .from('orders')
      .select()
      .eq('paypal_order_id', paypalOrderId)
      .maybeSingle();

    if (error) {
      logger.error({ error }, 'Failed to find order by PayPal ID');
      throw error;
    }
    return data as OrderRow | null;
  },

  async list(page = 1, limit = 50): Promise<{ orders: OrderRow[]; total: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseService
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error({ error }, 'Failed to list orders');
      throw error;
    }
    return { orders: (data ?? []) as OrderRow[], total: count ?? 0 };
  },

  async updateStatus(id: string, status: string): Promise<OrderRow> {
    const { data, error } = await supabaseService
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Failed to update order status');
      throw error;
    }
    return data as OrderRow;
  },

  async updateCjOrder(id: string, cjOrderId: string, cjStatus: string): Promise<void> {
    const { error } = await supabaseService
      .from('orders')
      .update({ cj_order_id: cjOrderId, cj_status: cjStatus, status: 'processing' })
      .eq('id', id);

    if (error) {
      logger.error({ error }, 'Failed to update CJ order');
      throw error;
    }
  },

  async updateTracking(id: string, trackingNumber: string, trackingUrl?: string): Promise<void> {
    const { error } = await supabaseService
      .from('orders')
      .update({ tracking_number: trackingNumber, tracking_url: trackingUrl, status: 'shipped' })
      .eq('id', id);

    if (error) {
      logger.error({ error }, 'Failed to update tracking');
      throw error;
    }
  },

  async markConfirmationSent(id: string): Promise<void> {
    const { error } = await supabaseService
      .from('orders')
      .update({ confirmation_sent: true })
      .eq('id', id);

    if (error) {
      logger.error({ error }, 'Failed to mark confirmation sent');
    }
  },
};
