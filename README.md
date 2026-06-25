# Zac Barber — Backend API

Backend completo para el MVP de Zac Barber. Node.js + Express + TypeScript + Supabase + Claude AI.

---

## Instalación rápida

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# → Edita .env con tus credenciales (ver sección "Conexiones requeridas")

# 3. Ejecutar en desarrollo
npm run dev

# 4. Build para producción
npm run build && npm start
```

---

## Conexiones requeridas

### 1. Supabase

Ve a tu proyecto en https://supabase.com → Settings → API:

```env
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_ANON_KEY=eyJ...          # "anon public" key
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # "service_role" key (⚠️ mantener secreta)
SUPABASE_JWT_SECRET=tu-secret     # Settings → API → JWT Secret
```

**Prerequisito**: Las 10 migrations SQL deben estar ejecutadas en Supabase antes de iniciar el backend.

### 2. Anthropic (Agente IA)

Ve a https://console.anthropic.com → API Keys:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

El agente usa `claude-sonnet-4-6` con Prompt Caching activado automáticamente.
El system prompt con el catálogo de servicios se cachea → ahorro estimado del 85% en tokens de entrada.

### 3. CORS (Frontend)

```env
CORS_ORIGINS=http://localhost:5173,https://zacbarber.co
```

---

## Estructura de archivos

```
src/
├── app.ts                      # Express + middlewares
├── server.ts                   # Punto de entrada + graceful shutdown
├── config/
│   ├── env.ts                  # Variables de entorno validadas con Zod
│   └── logger.ts               # Pino (JSON en prod, pretty en dev)
├── integrations/supabase/
│   └── client.ts               # Cliente anon + service role
├── types/
│   ├── database.ts             # Tipos TypeScript del schema SQL
│   └── api.ts                  # ApiResponse, RequestContext
├── shared/
│   ├── errors.ts               # AppError, NotFoundError, ConflictError...
│   └── response.ts             # ok(), created(), fail()
├── middlewares/
│   ├── auth.middleware.ts      # JWT verification + ctx injection
│   ├── error.middleware.ts     # Manejador centralizado de errores
│   └── rateLimit.middleware.ts # Rate limiting general + AI
├── validators/                 # Schemas Zod por dominio
├── repositories/               # Acceso a BD (Supabase queries)
├── services/                   # Lógica de negocio
├── controllers/                # Request/Response handlers
├── routes/index.ts             # Definición de todas las rutas
└── modules/ai/
    ├── tools.ts                # Definición de herramientas para Claude
    ├── tool-executor.ts        # Ejecuta tools contra la BD
    ├── agent.ts                # Bucle agentico con tool use
    └── ai.service.ts           # Orquesta agente + persistencia
```

---

## Endpoints

### Health
```
GET /api/v1/health
```

### Clientes (requieren Authorization: Bearer <jwt>)
```
GET    /api/v1/clients?q=juan&page=1&limit=20
GET    /api/v1/clients/:id
POST   /api/v1/clients
PATCH  /api/v1/clients/:id
```

### Servicios
```
GET    /api/v1/services
POST   /api/v1/services          (owner, admin)
PATCH  /api/v1/services/:id      (owner, admin)
```

### Disponibilidad y citas
```
GET    /api/v1/availability?barber_id=&service_id=&date=YYYY-MM-DD
GET    /api/v1/appointments?date=&barber_id=&status=&page=&limit=
GET    /api/v1/appointments/:id
POST   /api/v1/appointments
PATCH  /api/v1/appointments/:id/cancel
PATCH  /api/v1/appointments/:id/reschedule
PATCH  /api/v1/appointments/:id/complete
PATCH  /api/v1/appointments/:id/no-show
```

### Horarios
```
GET    /api/v1/schedules?barber_id=
PATCH  /api/v1/schedules         (individual o array para bulk)
```

### Configuración
```
GET    /api/v1/business-config
PATCH  /api/v1/business-config   (owner, admin)
```

### Chat IA — Dashboard (requiere JWT)
```
POST   /api/v1/ai/chat
```

### Chat IA — Público (solo requiere header x-shop-id)
```
POST   /api/v1/public/chat
```

---

## Ejemplos de request/response

### POST /api/v1/appointments

```json
// Request
{
  "barber_id": "22222222-0000-0000-0000-000000000002",
  "service_id": "33333333-0000-0000-0000-000000000001",
  "scheduled_at": "2024-03-20T10:00:00-05:00",
  "source": "web",
  "client_data": {
    "full_name": "Carlos Pérez",
    "phone": "+573001234567"
  }
}

// Response 201
{
  "success": true,
  "data": {
    "id": "uuid-de-la-cita",
    "status": "pending",
    "scheduled_at": "2024-03-20T15:00:00.000Z",
    "ends_at": "2024-03-20T15:30:00.000Z",
    "price_snapshot": 25000,
    "duration_snapshot": 30
  }
}
```

### GET /api/v1/availability?barber_id=...&service_id=...&date=2024-03-20

```json
// Response 200
{
  "success": true,
  "data": [
    { "slot_start": "2024-03-20T13:00:00+00:00", "slot_end": "2024-03-20T13:30:00+00:00" },
    { "slot_start": "2024-03-20T13:30:00+00:00", "slot_end": "2024-03-20T14:00:00+00:00" }
  ]
}
```

### POST /api/v1/public/chat
Headers: `x-shop-id: 11111111-0000-0000-0000-000000000001`

```json
// Request
{
  "message": "Hola! ¿Cuánto cuesta un corte con barba?",
  "channel": "web_chat"
}

// Response 200
{
  "success": true,
  "data": {
    "reply": "¡Hola! 💈 El corte + barba tiene un costo de $38.000 y dura 45 minutos. ¿Te gustaría agendar una cita?",
    "conversation_id": "uuid-de-la-conversacion",
    "escalated": false,
    "usage": { "input_tokens": 847, "output_tokens": 62 }
  }
}
```

### PATCH /api/v1/appointments/:id/cancel

```json
// Request
{ "reason": "Tengo un imprevisto, no puedo ir" }

// Response 200
{
  "success": true,
  "data": { "id": "...", "status": "cancelled", "cancellation_reason": "Tengo un imprevisto..." }
}
```

### Error response (ejemplo)

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "El horario seleccionado ya está ocupado. Por favor elige otro slot."
  }
}
```

---

## Integración n8n (futura)

El backend está preparado para recibir y emitir webhooks a n8n.

### Webhooks que el backend puede disparar (implementar en services):
- `appointment.created` → n8n envía confirmación por WhatsApp
- `appointment.cancelled` → n8n notifica al barbero
- `appointment.completed` → n8n solicita reseña tras 2h
- `appointment.no_show` → n8n ofrece reagendamiento

### Endpoint para que n8n dispare acciones:
```
POST /api/v1/appointments  (usando SUPABASE_SERVICE_ROLE_KEY en header)
```

Para proteger endpoints de n8n, agrega un header `x-n8n-secret` y valídalo en un middleware dedicado.

---

## Variables de entorno: resumen completo

| Variable | Dónde obtenerla | Requerida |
|---|---|---|
| `SUPABASE_URL` | Supabase → Settings → API | ✅ |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | ✅ |
| `SUPABASE_JWT_SECRET` | Supabase → Settings → API → JWT | ✅ |
| `ANTHROPIC_API_KEY` | console.anthropic.com | ✅ |
| `CORS_ORIGINS` | URLs del frontend | ✅ |
| `PORT` | — | ❌ (default 3000) |
| `NODE_ENV` | — | ❌ (default development) |
| `LOG_LEVEL` | — | ❌ (default info) |

---

## Notas de producción

- Usa **Railway**, **Render** o **Fly.io** para el deploy. El backend es stateless.
- Configura todas las variables de entorno en la plataforma de deploy (nunca en el repo).
- El `SUPABASE_SERVICE_ROLE_KEY` solo vive en el backend. Nunca lo expongas al frontend.
- Activa **Prompt Caching** en Anthropic (es automático con `cache_control: ephemeral` en el system prompt).
- Configura el rate limit de producción más bajo que en dev (ej: 50 requests/15min para `/public/chat`).
