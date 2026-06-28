-- ══════════════════════════════════════════════════════════════
-- Chargly — Tabla de pedidos
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS orders (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- PayPal
  paypal_order_id TEXT NOT NULL UNIQUE,
  paypal_status   TEXT NOT NULL DEFAULT 'COMPLETED',

  -- Cliente
  customer_name   TEXT NOT NULL,
  customer_email  TEXT NOT NULL,
  customer_phone  TEXT DEFAULT '',

  -- Dirección de envío
  shipping_address TEXT NOT NULL,
  shipping_city    TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'US',

  -- Pedido
  items           JSONB NOT NULL DEFAULT '[]',
  quantity        INTEGER NOT NULL DEFAULT 1,
  amount          NUMERIC(10,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USD',

  -- CJDropshipping
  cj_order_id     TEXT,
  cj_status       TEXT DEFAULT 'pending',

  -- Tracking
  tracking_number TEXT,
  tracking_url    TEXT,

  -- Estado general
  status          TEXT NOT NULL DEFAULT 'paid'
                  CHECK (status IN ('paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),

  -- Email
  confirmation_sent BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders (customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_paypal ON orders (paypal_order_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();

-- Desactivar RLS para esta tabla (acceso solo desde service role en backend)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on orders"
  ON orders
  FOR ALL
  USING (true)
  WITH CHECK (true);
