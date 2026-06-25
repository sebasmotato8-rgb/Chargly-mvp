# BarberIA — Base de datos

Schema completo para Supabase (PostgreSQL 15+). Diseñado para soportar multi-tenant SaaS desde el día 1.

## Orden de ejecución

Ejecuta las migrations en orden numérico desde el SQL Editor de Supabase:

```
001_create_barber_shops.sql   → Tipos globales + tabla raíz
002_create_users.sql          → Barberos y administradores
003_create_clients.sql        → Clientes de la barbería
004_create_services.sql       → Catálogo de servicios
005_create_schedules.sql      → Horarios + días cerrados
006_create_appointments.sql   → Citas + historial de estados
007_create_conversations.sql  → Historial de chat IA
008_create_business_config.sql → Configuración flexible
009_rls_policies.sql          → Row Level Security (multi-tenant)
010_functions_and_views.sql   → Funciones de negocio + vistas
```

Luego, en desarrollo:
```
seeds/001_seed_dev.sql        → Datos de prueba (NO en producción)
```

## Resumen de tablas

| Tabla | Propósito |
|---|---|
| `barber_shops` | Organización raíz. Una fila = una suscripción SaaS |
| `users` | Barberos y admins. Vinculados con `auth.users` de Supabase |
| `clients` | Clientes que agendan citas. Identificados por teléfono |
| `services` | Catálogo de servicios con precio y duración |
| `barber_schedules` | Horario semanal recurrente de cada barbero |
| `barber_time_off` | Ausencias puntuales (vacaciones, enfermedad) |
| `shop_closures` | Días de cierre del local (festivos, vacaciones) |
| `appointments` | Citas. Corazón del sistema |
| `appointment_history` | Audit trail de cada cambio de estado |
| `conversations` | Sesiones de chat con el agente IA |
| `conversation_messages` | Mensajes individuales de cada conversación |
| `business_config` | Configuración clave-valor por barbería |

## Funciones de negocio

### `get_available_slots(barber_id, service_id, date)`

Retorna todos los slots disponibles para un barbero en una fecha. Considera:
- Horario semanal del barbero (`barber_schedules`)
- Citas ya agendadas (`appointments`)
- Ausencias puntuales (`barber_time_off`)
- Cierres del negocio (`shop_closures`)
- Mínimo 60 minutos de anticipación

```sql
SELECT * FROM get_available_slots(
  '22222222-0000-0000-0000-000000000002',  -- barber_id
  '33333333-0000-0000-0000-000000000001',  -- service_id
  '2024-03-20'                              -- fecha
);
```

### `check_appointment_overlap(barber_id, scheduled_at, ends_at, exclude_id?)`

Verifica si un slot está ocupado antes de crear una cita. Retorna `boolean`.

```sql
SELECT check_appointment_overlap(
  barber_id    := '22222222-...',
  p_scheduled_at := '2024-03-20 10:00:00+05',
  p_ends_at      := '2024-03-20 10:30:00+05'
);
-- false = disponible, true = hay solapamiento
```

## Vistas

- `v_today_appointments` → Agenda del día con datos desnormalizados (para el dashboard)
- `v_monthly_kpis` → Métricas mensuales por barbería (citas, ingresos, no-show rate)
- `v_shop_config` → Configuración del negocio ocultando valores secretos

## RLS — Row Level Security

**Principio**: deny by default. Cada usuario del dashboard solo ve los datos de su barbería.

| Rol | Permisos |
|---|---|
| `owner` | Acceso total. Puede borrar usuarios y ver configuración secreta |
| `admin` | Gestión de citas, clientes, servicios y barberos. Sin acceso a facturación |
| `barber` | Solo ve sus propias citas y su horario |

**El agente IA y n8n usan `SUPABASE_SERVICE_ROLE_KEY`** (bypassa RLS). Nunca expongas esa key al cliente.

## Triggers automáticos

| Trigger | Qué hace |
|---|---|
| `trg_appointments_status_history` | Registra en `appointment_history` cada cambio de `status` |
| `trg_appointments_update_client_stats` | Actualiza `visit_count` y `last_visit_at` al completar una cita |
| `trg_appointments_snapshot_service` | Captura precio y duración del servicio al crear la cita |
| `trg_messages_accumulate_tokens` | Suma tokens de cada mensaje a `conversations.total_input_tokens` |
| `set_updated_at` | Actualiza `updated_at` en todas las tablas al modificar un registro |

## Escalabilidad — Decisiones de diseño

### Multi-tenant desde el día 1
Todas las tablas tienen `shop_id`. El RLS garantiza aislamiento. Para escalar a miles de barberías, la siguiente etapa es `PARTITION BY shop_id` en `appointments`.

### Timezone correcta
Las citas se almacenan en UTC (`timestamp with time zone`). La `timezone` de cada barbería se usa solo para mostrar y calcular slots. Nunca guardes horas locales sin zona.

### Snapshots de precio
`price_snapshot` y `duration_snapshot` en `appointments` garantizan que los reportes históricos sean correctos aunque el dueño cambie los precios del catálogo.

### `metadata jsonb` en tablas clave
Permite agregar datos específicos de integraciones (WhatsApp message ID, Stripe payment ID, n8n execution ID) sin hacer migraciones.

## Futuras ampliaciones recomendadas

1. **Pagos**: tabla `payments` con FK a `appointments`. Campos: `amount`, `method`, `stripe_payment_id`, `status`.
2. **Reseñas**: tabla `reviews` con `appointment_id`, `rating` (1-5), `comment`, `platform` (google/whatsapp).
3. **Productos/inventario**: tabla `products` para venta de productos en la barbería.
4. **Notificaciones**: tabla `notification_log` para rastrear cada mensaje enviado (evitar duplicados en n8n).
5. **Particionamiento**: `appointments PARTITION BY RANGE (scheduled_at)` cuando supere 1M de filas.
6. **Read replica**: consultas del dashboard en réplica de lectura, escrituras en primaria.
7. **Multi-sucursal**: añadir `location_id` a `barber_shops` para barberías con varias sedes.
