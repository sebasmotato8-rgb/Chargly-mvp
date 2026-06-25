-- ============================================================
-- Migration 001 — barber_shops
-- Tabla raíz del sistema multi-tenant SaaS.
-- Cada barbería es una organización independiente.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- búsqueda por texto difuso (nombres de clientes)

-- ── Tipos enumerados globales ─────────────────────────────────
create type user_role as enum ('owner', 'admin', 'barber');

create type appointment_status as enum (
  'pending',      -- creada, sin confirmar
  'confirmed',    -- confirmada por el barbero o el sistema
  'in_progress',  -- el cliente está siendo atendido
  'completed',    -- servicio finalizado
  'cancelled',    -- cancelada por cliente o barbero
  'no_show'       -- el cliente no se presentó
);

create type appointment_source as enum (
  'web',          -- reserva desde la web
  'whatsapp',     -- reserva vía agente IA en WhatsApp
  'chat',         -- reserva vía chat widget embebido
  'manual',       -- creada manualmente por el admin/barbero
  'n8n'           -- creada por una automatización n8n
);

-- ── barber_shops ──────────────────────────────────────────────
create table barber_shops (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  slug         text not null unique,                  -- identificador URL: mi-barberia
  phone        text,
  email        text,
  address      text,
  city         text,
  country      text not null default 'CO',
  timezone     text not null default 'America/Bogota',
  logo_url     text,
  website_url  text,
  is_active    boolean not null default true,
  trial_ends_at timestamp with time zone,             -- para futura lógica de cobro SaaS
  plan         text not null default 'free',          -- free | pro | enterprise
  metadata     jsonb not null default '{}'::jsonb,    -- datos extra sin romper schema
  created_at   timestamp with time zone not null default now(),
  updated_at   timestamp with time zone not null default now()
);

comment on table barber_shops is 'Organización raíz. Un registro = una barbería suscrita al SaaS.';
comment on column barber_shops.slug is 'Usado para URLs amigables. Único en el sistema.';
comment on column barber_shops.timezone is 'Zona horaria IANA. Todas las horas de citas se almacenan en UTC y se muestran en esta zona.';
comment on column barber_shops.metadata is 'Bag de propiedades flexible para integraciones futuras (ej: whatsapp_phone_id, stripe_customer_id).';

-- ── Índices ──────────────────────────────────────────────────
create index idx_barber_shops_slug     on barber_shops (slug);
create index idx_barber_shops_active   on barber_shops (is_active) where is_active = true;

-- ── updated_at automático ────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_barber_shops_updated_at
  before update on barber_shops
  for each row execute function set_updated_at();
