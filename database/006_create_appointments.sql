-- ============================================================
-- Migration 006 — appointments + appointment_history
-- Corazón del sistema. Cada cita es un registro aquí.
-- appointment_history guarda cada cambio de estado (audit trail).
-- ============================================================

create table appointments (
  id                   uuid primary key default uuid_generate_v4(),
  shop_id              uuid not null references barber_shops (id) on delete cascade,
  barber_id            uuid not null references users (id) on delete restrict,
  client_id            uuid not null references clients (id) on delete restrict,
  service_id           uuid not null references services (id) on delete restrict,

  -- Tiempo: siempre UTC en BD, mostrar en timezone de la barbería
  scheduled_at         timestamp with time zone not null,
  ends_at              timestamp with time zone not null,         -- scheduled_at + service.duration_minutes

  status               appointment_status not null default 'pending',
  source               appointment_source not null default 'web',

  notes                text,                                      -- notas del cliente al reservar
  barber_notes         text,                                      -- notas internas del barbero
  cancellation_reason  text,

  -- Precios al momento de la reserva (snapshot; el precio del servicio puede cambiar)
  price_snapshot       numeric(10, 2),
  duration_snapshot    integer,

  -- Conversación IA vinculada
  conversation_id      uuid,                                      -- FK a conversations (tabla 007)

  -- Recordatorios enviados (para no duplicar)
  reminder_24h_sent_at timestamp with time zone,
  reminder_1h_sent_at  timestamp with time zone,
  review_sent_at       timestamp with time zone,

  metadata             jsonb not null default '{}'::jsonb,        -- ej: n8n_execution_id, whatsapp_msg_id
  created_at           timestamp with time zone not null default now(),
  updated_at           timestamp with time zone not null default now(),

  constraint chk_appointment_ends check (ends_at > scheduled_at),
  constraint chk_appointment_price check (price_snapshot is null or price_snapshot >= 0)
);

comment on table appointments is 'Tabla central. Una fila = una cita. Estado evoluciona mediante appointment_history.';
comment on column appointments.ends_at is 'Calculado al insertar: scheduled_at + service.duration_minutes. Usado para detectar solapamientos.';
comment on column appointments.price_snapshot is 'Precio capturado al momento de reservar. Independiente de cambios futuros en services.price.';
comment on column appointments.conversation_id is 'Referencia a la conversación del agente IA que generó esta cita.';

-- ── Historial de cambios de estado (audit trail) ─────────────
create table appointment_history (
  id               uuid primary key default uuid_generate_v4(),
  appointment_id   uuid not null references appointments (id) on delete cascade,
  previous_status  appointment_status,
  new_status       appointment_status not null,
  changed_by       text not null,   -- 'system' | 'ai_agent' | 'n8n' | user UUID como texto
  notes            text,
  changed_at       timestamp with time zone not null default now()
);

comment on table appointment_history is 'Audit trail inmutable de cada transición de estado de una cita.';
comment on column appointment_history.changed_by is 'Quién hizo el cambio: "system", "ai_agent", "n8n", o el UUID del usuario admin.';

-- ── Trigger: registrar cambio de estado automáticamente ──────
create or replace function log_appointment_status_change()
returns trigger language plpgsql as $$
begin
  if old.status is distinct from new.status then
    insert into appointment_history (
      appointment_id, previous_status, new_status, changed_by
    ) values (
      new.id,
      old.status,
      new.status,
      coalesce(current_setting('app.current_user', true), 'system')
    );
  end if;
  return new;
end;
$$;

create trigger trg_appointments_status_history
  after update of status on appointments
  for each row execute function log_appointment_status_change();

-- ── Trigger: actualizar visit_count y last_visit_at en clients ──
create or replace function update_client_visit_stats()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and (old.status is null or old.status <> 'completed') then
    update clients
    set
      visit_count   = visit_count + 1,
      last_visit_at = new.scheduled_at,
      updated_at    = now()
    where id = new.client_id;
  end if;
  return new;
end;
$$;

create trigger trg_appointments_update_client_stats
  after update of status on appointments
  for each row execute function update_client_visit_stats();

-- ── Trigger: capturar snapshots de precio y duración ─────────
create or replace function snapshot_service_data()
returns trigger language plpgsql as $$
declare
  svc record;
begin
  if new.price_snapshot is null or new.duration_snapshot is null then
    select price, duration_minutes into svc
    from services where id = new.service_id;

    new.price_snapshot    := coalesce(new.price_snapshot,    svc.price);
    new.duration_snapshot := coalesce(new.duration_snapshot, svc.duration_minutes);
    new.ends_at           := new.scheduled_at + (new.duration_snapshot || ' minutes')::interval;
  end if;
  return new;
end;
$$;

create trigger trg_appointments_snapshot_service
  before insert on appointments
  for each row execute function snapshot_service_data();

-- ── Trigger updated_at ───────────────────────────────────────
create trigger trg_appointments_updated_at
  before update on appointments
  for each row execute function set_updated_at();

-- ── Índices críticos ─────────────────────────────────────────
-- Consulta de disponibilidad: ¿hay citas en este rango para este barbero?
create index idx_appointments_barber_time
  on appointments (barber_id, scheduled_at, ends_at)
  where status not in ('cancelled', 'no_show');

-- Dashboard del día
create index idx_appointments_shop_day
  on appointments (shop_id, scheduled_at)
  where status not in ('cancelled', 'no_show');

-- Listado por cliente
create index idx_appointments_client
  on appointments (client_id, scheduled_at desc);

-- Filtrado por estado (cola de confirmación, etc.)
create index idx_appointments_status
  on appointments (shop_id, status);

-- Recordatorios pendientes (n8n o cron job consulta esto)
create index idx_appointments_reminders
  on appointments (shop_id, scheduled_at)
  where
    status = 'confirmed'
    and reminder_24h_sent_at is null;

-- Historial
create index idx_appointment_history_appt
  on appointment_history (appointment_id, changed_at desc);
