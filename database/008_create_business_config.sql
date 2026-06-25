-- ============================================================
-- Migration 008 — business_config
-- Configuración clave-valor por barbería.
-- Evita agregar columnas a barber_shops por cada setting nuevo.
-- ============================================================

create table business_config (
  id         uuid primary key default uuid_generate_v4(),
  shop_id    uuid not null references barber_shops (id) on delete cascade,
  category   text not null,    -- 'booking' | 'notifications' | 'ai_agent' | 'payments' | 'branding'
  key        text not null,
  value      text not null,
  is_secret  boolean not null default false,  -- si true, no se devuelve en la API pública
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint uq_business_config_key unique (shop_id, key)
);

comment on table business_config is 'Configuración flexible por barbería. Estructura clave-valor para evitar migraciones por cada nuevo setting.';
comment on column business_config.category is 'Agrupación lógica: booking, notifications, ai_agent, payments, branding.';
comment on column business_config.is_secret is 'Si es true, el backend no lo expone en respuestas públicas (API keys, tokens de WhatsApp).';

-- ── Valores predeterminados que se insertan al crear una barbería ──
-- (se usan en el seed / función de onboarding)

-- Categoría: booking
-- booking.slot_duration_minutes = '30'        → granularidad de slots de reserva
-- booking.max_advance_days = '30'             → máximo días de anticipación para reservar
-- booking.min_advance_minutes = '60'          → mínimo minutos de anticipación para reservar
-- booking.allow_same_day = 'true'             → permitir reservas del mismo día
-- booking.require_phone_confirmation = 'true' → confirmar por WhatsApp antes de confirmar

-- Categoría: notifications
-- notifications.reminder_24h = 'true'
-- notifications.reminder_1h = 'true'
-- notifications.send_confirmation = 'true'
-- notifications.review_request = 'true'
-- notifications.review_delay_hours = '2'

-- Categoría: ai_agent
-- ai_agent.enabled = 'true'
-- ai_agent.greeting = 'Hola, soy el asistente de {shop_name}...'
-- ai_agent.language = 'es'
-- ai_agent.max_turns = '10'

-- Categoría: branding
-- branding.primary_color = '#1a1a2e'
-- branding.chat_widget_position = 'bottom-right'

-- ── Índices ──────────────────────────────────────────────────
create index idx_business_config_shop     on business_config (shop_id, category);
create index idx_business_config_key      on business_config (shop_id, key);

-- ── Trigger updated_at ───────────────────────────────────────
create trigger trg_business_config_updated_at
  before update on business_config
  for each row execute function set_updated_at();

-- ── Vista conveniente para el backend ───────────────────────
create view v_shop_config as
select
  shop_id,
  category,
  key,
  case when is_secret then '***' else value end as value,
  is_secret
from business_config;

comment on view v_shop_config is 'Vista que oculta valores secretos. Usada por la API pública.';
