-- ============================================================
-- Seed — Datos de ejemplo para BarberIA
-- ⚠️  SOLO para entornos de desarrollo/staging. NO ejecutar en producción.
-- Ejecutar DESPUÉS de todas las migrations.
-- ============================================================

-- ── NOTA: Los usuarios de auth.users deben crearse desde el panel
-- de Supabase o la API de Auth antes de insertar en public.users.
-- Aquí usamos UUIDs fijos para facilitar el desarrollo local.

-- ── 1. Barbería de ejemplo ────────────────────────────────────
insert into barber_shops (id, name, slug, phone, email, address, city, timezone) values
  ('11111111-0000-0000-0000-000000000001',
   'Barbería El Maestro',
   'el-maestro',
   '+573001234567',
   'hola@elmaestro.co',
   'Calle 5 # 12-34, Centro',
   'Cali',
   'America/Bogota');

-- ── 2. Usuarios (presuponer que existen en auth.users) ────────
insert into users (id, shop_id, email, full_name, phone, role) values
  ('22222222-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000001',
   'owner@elmaestro.co',
   'Carlos Mendoza',
   '+573001111111',
   'owner'),

  ('22222222-0000-0000-0000-000000000002',
   '11111111-0000-0000-0000-000000000001',
   'andres@elmaestro.co',
   'Andrés Torres',
   '+573002222222',
   'barber'),

  ('22222222-0000-0000-0000-000000000003',
   '11111111-0000-0000-0000-000000000001',
   'julian@elmaestro.co',
   'Julián Ríos',
   '+573003333333',
   'barber');

-- ── 3. Servicios ──────────────────────────────────────────────
insert into services (id, shop_id, name, description, duration_minutes, price, sort_order, color) values
  ('33333333-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000001',
   'Corte clásico',
   'Corte de cabello con tijera y máquina. Incluye lavado y secado.',
   30, 25000, 1, '#7F77DD'),

  ('33333333-0000-0000-0000-000000000002',
   '11111111-0000-0000-0000-000000000001',
   'Corte + barba',
   'Corte de cabello más arreglo completo de barba con navaja y perfilado.',
   45, 38000, 2, '#1D9E75'),

  ('33333333-0000-0000-0000-000000000003',
   '11111111-0000-0000-0000-000000000001',
   'Afeitado clásico',
   'Afeitado con toalla caliente, crema de afeitado artesanal y navaja de barbero.',
   30, 20000, 3, '#D85A30'),

  ('33333333-0000-0000-0000-000000000004',
   '11111111-0000-0000-0000-000000000001',
   'Corte niño',
   'Corte para niños menores de 12 años.',
   20, 18000, 4, '#D4537E'),

  ('33333333-0000-0000-0000-000000000005',
   '11111111-0000-0000-0000-000000000001',
   'Tinte + corte',
   'Coloración completa de cabello más corte a elección. Tiempo adicional para proceso del tinte.',
   90, 75000, 5, '#BA7517');

-- ── 4. Horarios de los barberos ───────────────────────────────
-- Andrés: lunes a sábado, 8am-6pm
insert into barber_schedules (shop_id, barber_id, day_of_week, start_time, end_time) values
  ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 1, '08:00', '18:00'),
  ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 2, '08:00', '18:00'),
  ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 3, '08:00', '18:00'),
  ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 4, '08:00', '18:00'),
  ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 5, '08:00', '18:00'),
  ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 6, '09:00', '15:00');

-- Julián: martes a viernes 10am-8pm, sábado 10am-4pm
insert into barber_schedules (shop_id, barber_id, day_of_week, start_time, end_time) values
  ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003', 2, '10:00', '20:00'),
  ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003', 3, '10:00', '20:00'),
  ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003', 4, '10:00', '20:00'),
  ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003', 5, '10:00', '20:00'),
  ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003', 6, '10:00', '16:00');

-- ── 5. Configuración del negocio ──────────────────────────────
insert into business_config (shop_id, category, key, value) values
  ('11111111-0000-0000-0000-000000000001', 'booking',       'slot_duration_minutes',      '30'),
  ('11111111-0000-0000-0000-000000000001', 'booking',       'max_advance_days',           '30'),
  ('11111111-0000-0000-0000-000000000001', 'booking',       'min_advance_minutes',        '60'),
  ('11111111-0000-0000-0000-000000000001', 'booking',       'allow_same_day',             'true'),
  ('11111111-0000-0000-0000-000000000001', 'notifications', 'reminder_24h',               'true'),
  ('11111111-0000-0000-0000-000000000001', 'notifications', 'reminder_1h',                'true'),
  ('11111111-0000-0000-0000-000000000001', 'notifications', 'send_confirmation',          'true'),
  ('11111111-0000-0000-0000-000000000001', 'notifications', 'review_request',             'true'),
  ('11111111-0000-0000-0000-000000000001', 'notifications', 'review_delay_hours',         '2'),
  ('11111111-0000-0000-0000-000000000001', 'ai_agent',      'enabled',                    'true'),
  ('11111111-0000-0000-0000-000000000001', 'ai_agent',      'greeting',                   'Hola, soy el asistente de Barbería El Maestro 💈 ¿En qué te puedo ayudar hoy?'),
  ('11111111-0000-0000-0000-000000000001', 'ai_agent',      'language',                   'es'),
  ('11111111-0000-0000-0000-000000000001', 'branding',      'primary_color',              '#7F77DD'),
  ('11111111-0000-0000-0000-000000000001', 'branding',      'chat_widget_position',       'bottom-right');

-- Secrets (is_secret=true, no se devuelven en la API pública)
insert into business_config (shop_id, category, key, value, is_secret) values
  ('11111111-0000-0000-0000-000000000001', 'notifications', 'whatsapp_phone_number_id',   'PLACEHOLDER_PHONE_ID', true),
  ('11111111-0000-0000-0000-000000000001', 'notifications', 'whatsapp_access_token',      'PLACEHOLDER_TOKEN',    true),
  ('11111111-0000-0000-0000-000000000001', 'notifications', 'resend_api_key',             'PLACEHOLDER_KEY',      true);

-- ── 6. Clientes de ejemplo ────────────────────────────────────
insert into clients (id, shop_id, full_name, phone, email, visit_count) values
  ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Juan Pérez',     '+573004444441', 'juan@gmail.com',   5),
  ('44444444-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'Miguel García',  '+573004444442', null,               2),
  ('44444444-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'Luis Rodríguez', '+573004444443', 'luis@hotmail.com', 8),
  ('44444444-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 'Sebastián López','+573004444444', null,               1),
  ('44444444-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', 'Camilo Vargas',  '+573004444445', null,               0);

-- ── 7. Citas de ejemplo (hoy y mañana) ───────────────────────
-- Usando now() para que siempre sean válidas al ejecutar el seed
insert into appointments (
  shop_id, barber_id, client_id, service_id,
  scheduled_at, ends_at, status, source, price_snapshot, duration_snapshot
) values
  -- Hoy, cita 1: Andrés / Juan / Corte clásico 10:00
  ('11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000002',
   '44444444-0000-0000-0000-000000000001',
   '33333333-0000-0000-0000-000000000001',
   date_trunc('day', now()) + interval '10 hours',
   date_trunc('day', now()) + interval '10 hours 30 minutes',
   'confirmed', 'whatsapp', 25000, 30),

  -- Hoy, cita 2: Andrés / Miguel / Corte + barba 11:00
  ('11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000002',
   '44444444-0000-0000-0000-000000000002',
   '33333333-0000-0000-0000-000000000002',
   date_trunc('day', now()) + interval '11 hours',
   date_trunc('day', now()) + interval '11 hours 45 minutes',
   'confirmed', 'web', 38000, 45),

  -- Hoy, cita 3: Julián / Luis / Afeitado 14:00
  ('11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000003',
   '44444444-0000-0000-0000-000000000003',
   '33333333-0000-0000-0000-000000000003',
   date_trunc('day', now()) + interval '14 hours',
   date_trunc('day', now()) + interval '14 hours 30 minutes',
   'pending', 'chat', 20000, 30),

  -- Mañana: Andrés / Sebastián / Corte 9:00
  ('11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000002',
   '44444444-0000-0000-0000-000000000004',
   '33333333-0000-0000-0000-000000000001',
   date_trunc('day', now()) + interval '1 day 9 hours',
   date_trunc('day', now()) + interval '1 day 9 hours 30 minutes',
   'confirmed', 'whatsapp', 25000, 30),

  -- Cita histórica completada (ayer)
  ('11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000002',
   '44444444-0000-0000-0000-000000000001',
   '33333333-0000-0000-0000-000000000002',
   date_trunc('day', now()) - interval '1 day' + interval '10 hours',
   date_trunc('day', now()) - interval '1 day' + interval '10 hours 45 minutes',
   'completed', 'web', 38000, 45);

-- ── 8. Cerrar un día ──────────────────────────────────────────
-- El próximo domingo la barbería cierra
insert into shop_closures (shop_id, closure_date, reason) values
  ('11111111-0000-0000-0000-000000000001',
   date_trunc('week', now() + interval '7 days')::date,
   'Domingo - día de descanso');
