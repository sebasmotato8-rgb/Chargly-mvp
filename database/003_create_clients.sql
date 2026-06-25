-- ============================================================
-- Migration 003 — clients
-- Clientes de la barbería.
-- No tienen cuenta en Supabase Auth; se identifican por teléfono.
-- ============================================================

create table clients (
  id              uuid primary key default uuid_generate_v4(),
  shop_id         uuid not null references barber_shops (id) on delete cascade,
  full_name       text not null,
  phone           text not null,
  email           text,
  notes           text,                               -- notas del barbero sobre el cliente
  preferred_barber_id uuid references users (id) on delete set null,
  visit_count     integer not null default 0,
  last_visit_at   timestamp with time zone,
  is_blocked      boolean not null default false,     -- cliente problemático / no-show reiterado
  metadata        jsonb not null default '{}'::jsonb, -- ej: whatsapp_id, referral_source
  created_at      timestamp with time zone not null default now(),
  updated_at      timestamp with time zone not null default now(),

  constraint uq_clients_phone_shop unique (phone, shop_id)
);

comment on table clients is 'Clientes que agendan citas. Identificados por (phone, shop_id).';
comment on column clients.phone is 'Número en formato E.164 (+573001234567). Único por barbería.';
comment on column clients.visit_count is 'Actualizado automáticamente por trigger al completar cita.';
comment on column clients.is_blocked is 'Si true, el agente IA rechaza nuevas reservas de este número.';
comment on column clients.metadata is 'whatsapp_id, referral_source, tags del agente IA, etc.';

-- ── Índices ──────────────────────────────────────────────────
create index idx_clients_shop_id      on clients (shop_id);
create index idx_clients_phone        on clients (shop_id, phone);
create index idx_clients_name_trgm    on clients using gin (full_name gin_trgm_ops); -- búsqueda difusa por nombre
create index idx_clients_last_visit   on clients (shop_id, last_visit_at desc nulls last);

-- ── Trigger updated_at ───────────────────────────────────────
create trigger trg_clients_updated_at
  before update on clients
  for each row execute function set_updated_at();
