-- ============================================================
-- Migration 004 — services
-- Catálogo de servicios ofrecidos por cada barbería.
-- El agente IA usa esta tabla para responder preguntas de precio y duración.
-- ============================================================

create table services (
  id               uuid primary key default uuid_generate_v4(),
  shop_id          uuid not null references barber_shops (id) on delete cascade,
  name             text not null,
  description      text,                              -- el agente IA usa esto para describir el servicio
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 480),
  price            numeric(10, 2) not null check (price >= 0),
  is_active        boolean not null default true,
  sort_order       integer not null default 0,        -- orden de aparición en el chat y la UI
  color            text,                              -- color hex para el calendario del dashboard
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamp with time zone not null default now(),
  updated_at       timestamp with time zone not null default now(),

  constraint uq_services_name_shop unique (name, shop_id)
);

comment on table services is 'Catálogo de servicios de la barbería. El agente IA carga esta tabla al inicio de cada sesión.';
comment on column services.duration_minutes is 'Duración real del servicio. Usada para calcular el siguiente slot disponible.';
comment on column services.description is 'Texto libre que el agente IA usará al responder "¿qué incluye el corte clásico?".';

-- ── Índices ──────────────────────────────────────────────────
create index idx_services_shop_active on services (shop_id, is_active, sort_order)
  where is_active = true;

-- ── Trigger updated_at ───────────────────────────────────────
create trigger trg_services_updated_at
  before update on services
  for each row execute function set_updated_at();
