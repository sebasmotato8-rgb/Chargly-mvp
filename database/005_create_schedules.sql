-- ============================================================
-- Migration 005 — barber_schedules + shop_closures
-- Horarios recurrentes de cada barbero y días de cierre.
-- La disponibilidad real = schedule - appointments - closures.
-- ============================================================

-- ── Horarios semanales ───────────────────────────────────────
-- day_of_week: 0=domingo, 1=lunes ... 6=sábado (estándar ISO)
create table barber_schedules (
  id           uuid primary key default uuid_generate_v4(),
  shop_id      uuid not null references barber_shops (id) on delete cascade,
  barber_id    uuid not null references users (id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  is_active    boolean not null default true,
  created_at   timestamp with time zone not null default now(),
  updated_at   timestamp with time zone not null default now(),

  constraint chk_schedule_times check (end_time > start_time),
  constraint uq_barber_schedule_day unique (barber_id, day_of_week)
);

comment on table barber_schedules is 'Horario semanal recurrente de cada barbero. La lógica de disponibilidad resta las citas ya agendadas.';
comment on column barber_schedules.day_of_week is '0=domingo, 1=lunes, ..., 6=sábado.';
comment on column barber_schedules.start_time is 'Hora de inicio sin zona horaria. Se interpreta en el timezone de la barbería.';

-- ── Bloques de tiempo no disponible (vacaciones, ausencias puntuales) ──
create table barber_time_off (
  id           uuid primary key default uuid_generate_v4(),
  shop_id      uuid not null references barber_shops (id) on delete cascade,
  barber_id    uuid not null references users (id) on delete cascade,
  starts_at    timestamp with time zone not null,
  ends_at      timestamp with time zone not null,
  reason       text,
  created_at   timestamp with time zone not null default now(),

  constraint chk_time_off_range check (ends_at > starts_at)
);

comment on table barber_time_off is 'Ausencias puntuales o vacaciones de un barbero. Bloquea disponibilidad en el rango indicado.';

-- ── Cierres del negocio (festivos, vacaciones del local) ─────
create table shop_closures (
  id           uuid primary key default uuid_generate_v4(),
  shop_id      uuid not null references barber_shops (id) on delete cascade,
  closure_date date not null,
  reason       text,
  created_at   timestamp with time zone not null default now(),

  constraint uq_shop_closure_date unique (shop_id, closure_date)
);

comment on table shop_closures is 'Días en que la barbería no abre (festivos, vacaciones). Bloquea todos los barberos.';

-- ── Índices ──────────────────────────────────────────────────
create index idx_barber_schedules_barber   on barber_schedules (barber_id, day_of_week);
create index idx_barber_schedules_shop     on barber_schedules (shop_id);
create index idx_barber_time_off_barber    on barber_time_off (barber_id, starts_at, ends_at);
create index idx_shop_closures_date        on shop_closures (shop_id, closure_date);

-- ── Trigger updated_at ───────────────────────────────────────
create trigger trg_barber_schedules_updated_at
  before update on barber_schedules
  for each row execute function set_updated_at();
