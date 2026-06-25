-- ============================================================
-- Migration 010 — Funciones de negocio + Vistas
-- Lógica SQL reutilizable por el backend Node.js.
-- ============================================================

-- ── Vista: agenda del día (usada por el dashboard) ───────────
create view v_today_appointments as
select
  a.id,
  a.shop_id,
  a.scheduled_at,
  a.ends_at,
  a.status,
  a.source,
  a.notes,
  a.price_snapshot,

  -- Cliente
  c.full_name  as client_name,
  c.phone      as client_phone,

  -- Barbero
  u.full_name  as barber_name,

  -- Servicio
  s.name       as service_name,
  s.duration_minutes,
  s.color      as service_color

from appointments a
join clients  c on c.id = a.client_id
join users    u on u.id = a.barber_id
join services s on s.id = a.service_id
where
  a.scheduled_at::date = current_date
  and a.status not in ('cancelled', 'no_show')
order by a.scheduled_at;

comment on view v_today_appointments is 'Vista del dashboard: agenda del día actual con datos desnormalizados.';

-- ── Vista: KPIs del mes (dashboard superior) ─────────────────
create view v_monthly_kpis as
select
  shop_id,
  date_trunc('month', scheduled_at)                           as month,
  count(*)                                                    as total_appointments,
  count(*) filter (where status = 'completed')                as completed,
  count(*) filter (where status = 'cancelled')                as cancelled,
  count(*) filter (where status = 'no_show')                  as no_shows,
  coalesce(sum(price_snapshot) filter (where status = 'completed'), 0) as revenue,
  round(
    100.0 * count(*) filter (where status = 'no_show') /
    nullif(count(*) filter (where status in ('completed', 'no_show')), 0),
    1
  )                                                           as no_show_rate_pct
from appointments
group by shop_id, date_trunc('month', scheduled_at);

comment on view v_monthly_kpis is 'KPIs mensales por barbería para el dashboard. No usa RLS directamente; el backend filtra por shop_id.';

-- ── Función: slots disponibles para un barbero en una fecha ──
-- Retorna tabla de timestamps disponibles dado el horario y las citas ya agendadas.
-- El backend llama: SELECT * FROM get_available_slots(barber_uuid, service_uuid, '2024-03-15');

create or replace function get_available_slots(
  p_barber_id   uuid,
  p_service_id  uuid,
  p_date        date
)
returns table (slot_start timestamp with time zone, slot_end timestamp with time zone)
language plpgsql stable security definer as $$
declare
  v_shop_id         uuid;
  v_day_of_week     smallint;
  v_schedule        record;
  v_duration        integer;
  v_slot_size       integer := 30;    -- granularidad en minutos (leer de business_config en producción)
  v_tz              text;
  v_current_slot    timestamp with time zone;
  v_slot_end        timestamp with time zone;
  v_schedule_start  timestamp with time zone;
  v_schedule_end    timestamp with time zone;
begin
  -- Obtener shop_id y timezone del barbero
  select u.shop_id, bs.timezone
  into v_shop_id, v_tz
  from users u
  join barber_shops bs on bs.id = u.shop_id
  where u.id = p_barber_id;

  -- Duración del servicio
  select duration_minutes into v_duration
  from services where id = p_service_id;

  if v_duration is null then
    return;
  end if;

  -- Día de la semana en el timezone de la barbería
  v_day_of_week := extract(dow from p_date::timestamp at time zone v_tz)::smallint;

  -- Verificar si el día es cierre del negocio
  if exists (
    select 1 from shop_closures
    where shop_id = v_shop_id and closure_date = p_date
  ) then
    return;
  end if;

  -- Horario del barbero ese día
  select * into v_schedule
  from barber_schedules
  where barber_id = p_barber_id
    and day_of_week = v_day_of_week
    and is_active = true;

  if not found then
    return;
  end if;

  -- Convertir horario a timestamps con timezone
  v_schedule_start := (p_date::text || ' ' || v_schedule.start_time::text)::timestamp at time zone v_tz;
  v_schedule_end   := (p_date::text || ' ' || v_schedule.end_time::text)::timestamp at time zone v_tz;

  -- Iterar en slots
  v_current_slot := v_schedule_start;

  while v_current_slot + (v_duration || ' minutes')::interval <= v_schedule_end loop
    v_slot_end := v_current_slot + (v_duration || ' minutes')::interval;

    -- ¿Hay alguna cita que se solape con este slot?
    if not exists (
      select 1 from appointments
      where barber_id   = p_barber_id
        and status not in ('cancelled', 'no_show')
        and scheduled_at < v_slot_end
        and ends_at      > v_current_slot
    )
    -- ¿Hay alguna ausencia que se solape?
    and not exists (
      select 1 from barber_time_off
      where barber_id  = p_barber_id
        and starts_at  < v_slot_end
        and ends_at    > v_current_slot
    )
    -- ¿El slot es en el futuro (con al menos 60 min de anticipación)?
    and v_current_slot > now() + interval '60 minutes'
    then
      slot_start := v_current_slot;
      slot_end   := v_slot_end;
      return next;
    end if;

    v_current_slot := v_current_slot + (v_slot_size || ' minutes')::interval;
  end loop;
end;
$$;

comment on function get_available_slots is
  'Retorna slots libres para un barbero en una fecha. Considera horario, citas existentes, ausencias y cierres.';

-- ── Función: verificar solapamiento de cita (antes de insertar) ──
create or replace function check_appointment_overlap(
  p_barber_id    uuid,
  p_scheduled_at timestamp with time zone,
  p_ends_at      timestamp with time zone,
  p_exclude_id   uuid default null
)
returns boolean language sql stable as $$
  select exists (
    select 1 from appointments
    where barber_id   = p_barber_id
      and status not in ('cancelled', 'no_show')
      and id          <> coalesce(p_exclude_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and scheduled_at < p_ends_at
      and ends_at      > p_scheduled_at
  )
$$;

comment on function check_appointment_overlap is
  'Retorna true si existe una cita que se solapa con el rango dado. Usar antes de insertar una nueva cita.';
