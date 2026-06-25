-- ============================================================
-- Migration 007 — conversations + conversation_messages
-- Historial de conversaciones del agente IA.
-- Permite auditoría, mejora del agente y contexto entre sesiones.
-- ============================================================

create type conversation_channel as enum (
  'web_chat',
  'whatsapp',
  'api'
);

create type message_role as enum (
  'user',
  'assistant',
  'tool_result'
);

create table conversations (
  id              uuid primary key default uuid_generate_v4(),
  shop_id         uuid not null references barber_shops (id) on delete cascade,
  client_id       uuid references clients (id) on delete set null,
  channel         conversation_channel not null default 'web_chat',
  external_id     text,                              -- whatsapp thread id, widget session id, etc.
  is_resolved     boolean not null default false,
  resolved_at     timestamp with time zone,
  escalated_to    uuid references users (id) on delete set null, -- si se escaló a un humano
  -- Métricas de coste IA (para monitorizar gasto por conversación)
  total_input_tokens  integer not null default 0,
  total_output_tokens integer not null default 0,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamp with time zone not null default now(),
  updated_at      timestamp with time zone not null default now()
);

comment on table conversations is 'Sesión de conversación con el agente IA. Una cita puede tener una conversación vinculada.';
comment on column conversations.external_id is 'ID externo de la plataforma de mensajería (WhatsApp thread, socket session, etc.).';
comment on column conversations.total_input_tokens is 'Tokens acumulados de entrada. Para control de coste y Prompt Caching analytics.';

-- ── Mensajes individuales ────────────────────────────────────
create table conversation_messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  role            message_role not null,
  content         text not null,
  -- Tool use (cuando el agente llama una herramienta)
  tool_name       text,
  tool_input      jsonb,
  tool_result     jsonb,
  -- Métricas por mensaje
  input_tokens    integer,
  output_tokens   integer,
  model           text,                              -- qué modelo respondió este mensaje
  latency_ms      integer,
  -- Feedback del usuario (thumbs up/down en el widget)
  user_feedback   smallint check (user_feedback in (-1, 1)),
  created_at      timestamp with time zone not null default now()
);

comment on table conversation_messages is 'Cada turno de la conversación. Incluye tool calls del agente para auditoría completa.';
comment on column conversation_messages.tool_name is 'Nombre de la tool llamada: book_appointment, get_availability, cancel_appointment, etc.';
comment on column conversation_messages.user_feedback is '1=útil, -1=no útil. Alimenta el dataset de evaluación del agente.';

-- ── FK circular diferida: appointments.conversation_id ───────
-- (appointments ya existe, solo añadimos la FK aquí)
alter table appointments
  add constraint fk_appointments_conversation
  foreign key (conversation_id)
  references conversations (id)
  on delete set null
  deferrable initially deferred;

-- ── Índices ──────────────────────────────────────────────────
create index idx_conversations_shop       on conversations (shop_id, created_at desc);
create index idx_conversations_client     on conversations (client_id, created_at desc);
create index idx_conversations_external   on conversations (shop_id, external_id) where external_id is not null;
create index idx_conversation_messages    on conversation_messages (conversation_id, created_at);
create index idx_conv_messages_feedback   on conversation_messages (conversation_id) where user_feedback is not null;

-- ── Trigger updated_at ───────────────────────────────────────
create trigger trg_conversations_updated_at
  before update on conversations
  for each row execute function set_updated_at();

-- ── Trigger: acumular tokens en la conversación ──────────────
create or replace function accumulate_conversation_tokens()
returns trigger language plpgsql as $$
begin
  update conversations
  set
    total_input_tokens  = total_input_tokens  + coalesce(new.input_tokens, 0),
    total_output_tokens = total_output_tokens + coalesce(new.output_tokens, 0),
    updated_at          = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger trg_messages_accumulate_tokens
  after insert on conversation_messages
  for each row execute function accumulate_conversation_tokens();
