-- ============================================================
-- Migration 002 — users
-- Barberos y administradores de cada barbería.
-- Vinculado con Supabase Auth (auth.users) mediante el mismo UUID.
-- ============================================================

create table users (
  id           uuid primary key references auth.users (id) on delete cascade,
  shop_id      uuid not null references barber_shops (id) on delete cascade,
  email        text not null,
  full_name    text not null,
  phone        text,
  avatar_url   text,
  role         user_role not null default 'barber',
  bio          text,                                  -- descripción del barbero para el chat IA
  is_active    boolean not null default true,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamp with time zone not null default now(),
  updated_at   timestamp with time zone not null default now(),

  constraint uq_users_email_shop unique (email, shop_id)
);

comment on table users is 'Barberos y admins. El id es el mismo UUID de auth.users de Supabase.';
comment on column users.bio is 'Texto libre que el agente IA puede usar para presentar al barbero a los clientes.';
comment on column users.role is 'owner: dueño con acceso total. admin: gestión sin facturación. barber: solo ve su agenda.';

-- ── Índices ──────────────────────────────────────────────────
create index idx_users_shop_id    on users (shop_id);
create index idx_users_role       on users (shop_id, role);
create index idx_users_active     on users (shop_id, is_active) where is_active = true;

-- ── Trigger updated_at ───────────────────────────────────────
create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();
