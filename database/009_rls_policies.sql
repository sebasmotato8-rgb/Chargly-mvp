-- ============================================================
-- Migration 009 — Row Level Security (RLS)
-- Multi-tenant: cada usuario solo ve los datos de su barbería.
-- Principio: deny by default, grant explícitamente.
-- ============================================================

-- ── Activar RLS en todas las tablas ──────────────────────────
alter table barber_shops        enable row level security;
alter table users               enable row level security;
alter table clients             enable row level security;
alter table services            enable row level security;
alter table barber_schedules    enable row level security;
alter table barber_time_off     enable row level security;
alter table shop_closures       enable row level security;
alter table appointments        enable row level security;
alter table appointment_history enable row level security;
alter table conversations       enable row level security;
alter table conversation_messages enable row level security;
alter table business_config     enable row level security;

-- ── Función auxiliar: shop_id del usuario autenticado ────────
create or replace function auth_shop_id()
returns uuid language sql stable security definer as $$
  select shop_id from users where id = auth.uid()
$$;

-- ── Función auxiliar: rol del usuario autenticado ────────────
create or replace function auth_user_role()
returns user_role language sql stable security definer as $$
  select role from users where id = auth.uid()
$$;

-- ── Función auxiliar: es owner o admin ───────────────────────
create or replace function is_admin_or_owner()
returns boolean language sql stable security definer as $$
  select role in ('owner', 'admin') from users where id = auth.uid()
$$;

-- ════════════════════════════════════════════════════════════
-- barber_shops: solo el owner/admin ve su propia barbería
-- ════════════════════════════════════════════════════════════
create policy "shop_select_own"
  on barber_shops for select
  using (id = auth_shop_id());

create policy "shop_update_owner"
  on barber_shops for update
  using (id = auth_shop_id() and auth_user_role() = 'owner');

-- ════════════════════════════════════════════════════════════
-- users: cada usuario ve los de su barbería; solo admins modifican
-- ════════════════════════════════════════════════════════════
create policy "users_select_same_shop"
  on users for select
  using (shop_id = auth_shop_id());

create policy "users_insert_admin"
  on users for insert
  with check (shop_id = auth_shop_id() and is_admin_or_owner());

create policy "users_update_admin"
  on users for update
  using (shop_id = auth_shop_id() and is_admin_or_owner());

create policy "users_delete_owner"
  on users for delete
  using (shop_id = auth_shop_id() and auth_user_role() = 'owner');

-- ════════════════════════════════════════════════════════════
-- clients: todos los users de la barbería pueden leer; solo admins crean/modifican
-- ════════════════════════════════════════════════════════════
create policy "clients_select_shop"
  on clients for select
  using (shop_id = auth_shop_id());

create policy "clients_insert"
  on clients for insert
  with check (shop_id = auth_shop_id());

create policy "clients_update_admin"
  on clients for update
  using (shop_id = auth_shop_id());  -- cualquier usuario del shop puede editar

create policy "clients_delete_admin"
  on clients for delete
  using (shop_id = auth_shop_id() and is_admin_or_owner());

-- ════════════════════════════════════════════════════════════
-- services
-- ════════════════════════════════════════════════════════════
create policy "services_select_shop"
  on services for select
  using (shop_id = auth_shop_id());

create policy "services_write_admin"
  on services for all
  using (shop_id = auth_shop_id() and is_admin_or_owner());

-- ════════════════════════════════════════════════════════════
-- barber_schedules
-- ════════════════════════════════════════════════════════════
create policy "schedules_select_shop"
  on barber_schedules for select
  using (shop_id = auth_shop_id());

create policy "schedules_write"
  on barber_schedules for all
  using (
    shop_id = auth_shop_id() and (
      is_admin_or_owner() or barber_id = auth.uid()  -- barbero gestiona su propio horario
    )
  );

-- ════════════════════════════════════════════════════════════
-- barber_time_off
-- ════════════════════════════════════════════════════════════
create policy "time_off_select_shop"
  on barber_time_off for select
  using (shop_id = auth_shop_id());

create policy "time_off_write"
  on barber_time_off for all
  using (
    shop_id = auth_shop_id() and (
      is_admin_or_owner() or barber_id = auth.uid()
    )
  );

-- ════════════════════════════════════════════════════════════
-- shop_closures
-- ════════════════════════════════════════════════════════════
create policy "closures_select_shop"
  on shop_closures for select
  using (shop_id = auth_shop_id());

create policy "closures_write_admin"
  on shop_closures for all
  using (shop_id = auth_shop_id() and is_admin_or_owner());

-- ════════════════════════════════════════════════════════════
-- appointments: barbero ve solo las suyas; admin ve todas
-- ════════════════════════════════════════════════════════════
create policy "appointments_select"
  on appointments for select
  using (
    shop_id = auth_shop_id() and (
      is_admin_or_owner() or barber_id = auth.uid()
    )
  );

create policy "appointments_insert"
  on appointments for insert
  with check (shop_id = auth_shop_id());

create policy "appointments_update"
  on appointments for update
  using (
    shop_id = auth_shop_id() and (
      is_admin_or_owner() or barber_id = auth.uid()
    )
  );

create policy "appointments_delete_admin"
  on appointments for delete
  using (shop_id = auth_shop_id() and is_admin_or_owner());

-- ════════════════════════════════════════════════════════════
-- appointment_history: solo lectura para usuarios del shop
-- ════════════════════════════════════════════════════════════
create policy "history_select"
  on appointment_history for select
  using (
    exists (
      select 1 from appointments a
      where a.id = appointment_history.appointment_id
        and a.shop_id = auth_shop_id()
    )
  );

-- Insert lo hace solo el trigger (service role), no los usuarios directamente
create policy "history_insert_system"
  on appointment_history for insert
  with check (false);  -- bloqueado para usuarios; el trigger usa security definer

-- ════════════════════════════════════════════════════════════
-- conversations
-- ════════════════════════════════════════════════════════════
create policy "conversations_select"
  on conversations for select
  using (shop_id = auth_shop_id());

create policy "conversations_insert"
  on conversations for insert
  with check (shop_id = auth_shop_id());

create policy "conversations_update_admin"
  on conversations for update
  using (shop_id = auth_shop_id() and is_admin_or_owner());

-- ════════════════════════════════════════════════════════════
-- conversation_messages: acceso por conversación del shop
-- ════════════════════════════════════════════════════════════
create policy "conv_messages_select"
  on conversation_messages for select
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_messages.conversation_id
        and c.shop_id = auth_shop_id()
    )
  );

-- Insert lo hace el backend con service role (API key), no usuarios directamente
create policy "conv_messages_insert_service"
  on conversation_messages for insert
  with check (false);

-- ════════════════════════════════════════════════════════════
-- business_config
-- ════════════════════════════════════════════════════════════
create policy "config_select_admin"
  on business_config for select
  using (shop_id = auth_shop_id() and (not is_secret or is_admin_or_owner()));

create policy "config_write_owner"
  on business_config for all
  using (shop_id = auth_shop_id() and is_admin_or_owner());

-- ════════════════════════════════════════════════════════════
-- NOTA IMPORTANTE para el backend
-- ════════════════════════════════════════════════════════════
-- El agente IA y n8n deben usar la SUPABASE_SERVICE_ROLE_KEY
-- (bypassa RLS). Nunca expongas esa key al cliente.
-- Para operaciones del agente (crear cita, consultar slots),
-- usa el service role key en el backend Node.js.
