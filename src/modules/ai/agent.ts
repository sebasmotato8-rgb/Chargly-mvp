import Groq from 'groq-sdk';
import { env } from '../../config/env';
import { BARBER_TOOLS } from './tools';
import { ToolExecutor } from './tool-executor';
import { logger } from '../../config/logger';
import type { DbClient } from '../../integrations/supabase/client';
import type { Service } from '../../types/database';
import { ServicesRepository } from '../../repositories/services.repository';
import { BusinessConfigRepository } from '../../repositories/schedules.repository';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentInput {
  shopId: string;
  userMessage: string;
  conversationId?: string;
  messageHistory: ChatMessage[];
  db: DbClient;
}

export interface AgentOutput {
  reply: string;
  conversationId?: string;
  inputTokens: number;
  outputTokens: number;
  toolsUsed: string[];
  escalated: boolean;
}

async function buildSystemPrompt(
  shopId: string,
  db: DbClient
): Promise<string> {
  const servicesRepo = new ServicesRepository(db);
  const configRepo = new BusinessConfigRepository(db);

  const [services, config, shopRow, barbersRow] = await Promise.all([
    servicesRepo.findAll(shopId, true),
    configRepo.getMap(shopId),
    db.from('barber_shops').select('name, address, city, phone, timezone').eq('id', shopId).single(),
    db.from('users').select('id, full_name, bio').eq('shop_id', shopId).eq('role', 'barber').eq('is_active', true),
  ]);

  const shop = shopRow.data;
  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: shop?.timezone ?? 'America/Bogota',
  });

  const servicesCatalog = (services as Service[])
    .map((s) => `  - ${s.name} [id: ${s.id}]: $${s.price.toLocaleString('es-CO')} — ${s.duration_minutes} min${s.description ? ` (${s.description})` : ''}`)
    .join('\n');

  const barbersList = (barbersRow.data ?? [])
    .map((b) => `  - ${b.full_name} [id: ${b.id}]${b.bio ? ` — ${b.bio}` : ''}`)
    .join('\n');

  return `Eres el asistente virtual de **${shop?.name ?? 'Zac Barber'}**, una barbería premium.
Tu nombre es **BarberBot** y tu objetivo es ayudar a los clientes a reservar, cancelar y reagendar citas de forma rápida y amable.

INFORMACIÓN DEL NEGOCIO
Nombre: ${shop?.name ?? 'Zac Barber'}
Dirección: ${shop?.address ?? ''}, ${shop?.city ?? ''}
Teléfono: ${shop?.phone ?? ''}
Hoy es: ${today}

CATÁLOGO DE SERVICIOS
${servicesCatalog || '  (Sin servicios configurados)'}

BARBEROS DISPONIBLES
${barbersList || '  (Sin barberos configurados)'}

REGLAS DE COMPORTAMIENTO
1. Sé amable, profesional y conciso. Máximo 3 oraciones por respuesta.
2. SIEMPRE llama las tools disponibles cuando tengas la información necesaria. NUNCA pidas permiso para llamar una tool ni le digas al usuario que vas a llamar una función. Simplemente llámala y responde con el resultado.
3. Para reservar una cita necesitas: nombre completo, teléfono, servicio, barbero y fecha/hora. Si falta algún dato, pregúntalo.
4. Antes de crear una cita, SIEMPRE llama get_availability para confirmar que el slot existe.
5. Para cancelar o reagendar, primero llama find_client_appointments con el teléfono del cliente para encontrar la cita. Confirma con el usuario antes de cancelar.
6. Si el cliente no tiene preferencia de barbero, sugiere el primero de la lista.
7. Si no puedes resolver algo en 3 intentos, usa escalate_to_human.
8. NUNCA inventes precios, horarios o información. Usa SOLO datos de este prompt o resultados de las tools.
9. Responde siempre en español colombiano informal pero respetuoso.
10. Usa emojis con moderación (máximo 1-2 por mensaje).
11. Si el usuario pide disponibilidad sin especificar servicio, pregunta qué servicio desea. Los IDs de servicios y barberos están arriba — úsalos directamente.

CONFIGURACIÓN OPERATIVA
Anticipación mínima para reservar: ${config['booking.min_advance_minutes'] ?? '60'} minutos
Máximo días en adelanto: ${config['booking.max_advance_days'] ?? '30'} días
Duración de slots: ${config['booking.slot_duration_minutes'] ?? '30'} minutos`;
}

export async function runBarberAgent(input: AgentInput): Promise<AgentOutput> {
  const { shopId, userMessage, messageHistory, db, conversationId } = input;

  const executor = new ToolExecutor(db, shopId, conversationId);
  const systemPrompt = await buildSystemPrompt(shopId, db);

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messageHistory.map((m): Groq.Chat.ChatCompletionMessageParam => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const toolsUsed: string[] = [];
  let escalated = false;
  let finalReply = '';
  let iterations = 0;

  while (iterations < env.GROQ_MAX_ITERATIONS) {
    iterations++;

    let completion: Groq.Chat.ChatCompletion;
    try {
      completion = await groq.chat.completions.create({
        model: env.GROQ_MODEL,
        messages,
        tools: BARBER_TOOLS,
        tool_choice: 'auto',
        max_tokens: env.GROQ_MAX_TOKENS,
        temperature: 0.3,
      });
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 429) {
        logger.warn({ shopId }, 'Groq rate limit exceeded (429)');
        finalReply = 'Estamos experimentando alta demanda. Por favor intenta de nuevo en unos minutos.';
        break;
      }
      if (status === 400) {
        logger.warn({ shopId, iterations }, 'Groq tool_use_failed (400), retrying without tools');
        messages.push({ role: 'user', content: 'Por favor responde sin usar herramientas por ahora. Usa los datos que ya tienes del prompt del sistema.' });
        continue;
      }
      throw err;
    }

    const usage = completion.usage;
    if (usage) {
      totalInputTokens += usage.prompt_tokens ?? 0;
      totalOutputTokens += usage.completion_tokens ?? 0;
    }

    const choice = completion.choices[0];
    if (!choice) {
      logger.warn({ shopId, iterations }, 'Groq no devolvió opciones');
      break;
    }

    const assistantMsg = choice.message;
    const toolCalls = assistantMsg.tool_calls;

    messages.push({
      role: 'assistant',
      content: assistantMsg.content ?? '',
      ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    });

    if (!toolCalls || toolCalls.length === 0) {
      finalReply = (assistantMsg.content ?? '').trim();
      break;
    }

    logger.debug(
      { iterations, shopId, toolCalls: toolCalls.length },
      'Iteración del agente Groq'
    );

    for (const toolCall of toolCalls) {
      const name = toolCall.function.name;
      toolsUsed.push(name);

      if (name === 'escalate_to_human') escalated = true;

      const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
      const toolResult = await executor.execute(name, args);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }
  }

  if (!finalReply) {
    finalReply = 'Lo siento, tuve un problema procesando tu solicitud. ¿Puedes intentarlo de nuevo?';
  }

  return {
    reply: finalReply,
    conversationId,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    toolsUsed,
    escalated,
  };
}
