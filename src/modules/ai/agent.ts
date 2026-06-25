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

const promptCache = new Map<string, { prompt: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getDateContext(tz: string): string {
  const now = new Date();
  const fmt = (d: Date) => d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });
  const iso = (d: Date) => {
    const parts = d.toLocaleDateString('en-CA', { timeZone: tz }).split('/');
    return parts.join('-');
  };
  const tomorrow = new Date(now.getTime() + 86400000);
  const dayAfter = new Date(now.getTime() + 2 * 86400000);

  const daysUntilSat = (6 - now.getDay() + 7) % 7 || 7;
  const saturday = new Date(now.getTime() + daysUntilSat * 86400000);

  return `Hoy: ${fmt(now)} (${iso(now)})
Mañana: ${fmt(tomorrow)} (${iso(tomorrow)})
Pasado mañana: ${fmt(dayAfter)} (${iso(dayAfter)})
Este sábado: ${iso(saturday)}
Zona horaria: ${tz} (offset -05:00)`;
}

async function buildSystemPrompt(
  shopId: string,
  db: DbClient
): Promise<string> {
  const cached = promptCache.get(shopId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.prompt;
  }

  const servicesRepo = new ServicesRepository(db);
  const configRepo = new BusinessConfigRepository(db);

  const [services, config, shopRow, barbersRow] = await Promise.all([
    servicesRepo.findAll(shopId, true),
    configRepo.getMap(shopId),
    db.from('barber_shops').select('name, address, city, phone, timezone').eq('id', shopId).single(),
    db.from('users').select('id, full_name, bio').eq('shop_id', shopId).eq('role', 'barber').eq('is_active', true),
  ]);

  const shop = shopRow.data;
  const tz = shop?.timezone ?? 'America/Bogota';
  const dateCtx = getDateContext(tz);

  const servicesCatalog = (services as Service[])
    .map((s) => `- ${s.name} [${s.id}]: $${s.price.toLocaleString('es-CO')} ${s.duration_minutes}min`)
    .join('\n');

  const barbers = barbersRow.data ?? [];
  const barbersList = barbers
    .map((b) => `- ${b.full_name} [${b.id}]`)
    .join('\n');

  const firstBarberId = barbers[0]?.id ?? '';
  const firstBarberName = barbers[0]?.full_name ?? '';

  const prompt = `Eres el asistente virtual de Zac Barber. Tu nombre es Zac Barber.
Ayudas a reservar, cancelar y reagendar citas de barbería.

NEGOCIO
Nombre: Zac Barber
Dirección: ${shop?.address ?? ''}, ${shop?.city ?? ''}
Teléfono: ${shop?.phone ?? ''}

FECHA Y HORA ACTUAL
${dateCtx}

SERVICIOS DISPONIBLES
${servicesCatalog || '(Sin servicios configurados)'}

BARBEROS DISPONIBLES
${barbersList || '(Sin barberos configurados)'}
Barbero por defecto (cuando digan "cualquiera", "el que esté", "el primero"): ${firstBarberName} [${firstBarberId}]

INSTRUCCIONES PARA INTERPRETAR FECHAS Y HORAS
- "mañana" = usa la fecha de mañana indicada arriba
- "hoy" = usa la fecha de hoy indicada arriba
- "este sábado" = usa la fecha del sábado indicada arriba
- "a las 8", "8am", "8 de la mañana" = 08:00
- "a las 2", "2pm", "2 de la tarde" = 14:00
- "a primera hora", "temprano" = 09:00
- "después de las 5" = busca disponibilidad desde las 17:00
- Formato ISO para scheduled_at: YYYY-MM-DDThh:mm:00-05:00

INTERPRETACIÓN DE HORARIOS DEL USUARIO (MUY IMPORTANTE)
Cuando el usuario responde con un horario, interpreta así:
- "930", "9 30", "9:30", "09:30", "930am" → 09:30
- "1030", "10 30", "10:30" → 10:30
- "2pm", "200", "2:00" → 14:00
- "130", "1:30", "130pm" → 13:30
Si ya ofreciste horarios disponibles y el usuario elige uno, NO vuelvas a llamar get_availability. Usa directamente el slot que el usuario eligió para llamar book_appointment.
Solo vuelve a verificar disponibilidad si el usuario pide un horario DIFERENTE a los que ofreciste.

INSTRUCCIONES PARA BARBEROS
- "cualquier barbero", "el que esté", "con cualquiera", "no importa", "el primero disponible" → usa ${firstBarberName} [${firstBarberId}]
- Si el cliente nombra un barbero específico, usa ese

REGLAS
1. Responde siempre en español, amable y conciso. Máximo 3 oraciones.
2. Llama las tools directamente sin pedir permiso. No menciones las tools al usuario.
3. Para reservar necesitas: nombre completo, teléfono, servicio, barbero, fecha/hora. Pregunta lo que falte.
4. Antes de crear cita SIEMPRE llama get_availability para verificar el slot.
5. Si el cliente dice "cualquier barbero", usa el barbero por defecto sin preguntar.
6. Si el cliente no dice servicio, pregúntale cuál quiere mostrándole las opciones.
7. NUNCA muestres IDs, nombres de funciones, errores técnicos ni JSON al usuario.
8. Si una tool falla, responde con un mensaje amigable pidiendo que reformule.
9. NUNCA inventes horarios ni precios. Solo usa datos de tools o de este prompt.
10. Usa emojis con moderación (1-2 por mensaje máximo).

PREVENCIÓN DE DUPLICADOS (MUY IMPORTANTE)
Antes de crear una cita, SIEMPRE llama check_existing_appointment con el teléfono del cliente.
Si has_active es true, responde: "Ya tienes una cita para [fecha y hora]. ¿Deseas reagendarla?"
NO crees una segunda cita. Ofrece reagendar con reschedule_appointment.

REAGENDAMIENTO
Cuando el cliente diga "quiero cambiar mi cita", "reagendar", "mover mi cita", "cambiar horario":
1. Pide su teléfono si no lo tienes.
2. Llama find_client_appointments para buscar su cita.
3. Muestra la cita encontrada y pregunta nueva fecha/hora.
4. Llama get_availability para verificar el nuevo slot.
5. Llama reschedule_appointment con el appointment_id y la nueva fecha.

RESERVAS PARA MÚLTIPLES PERSONAS
Si el cliente dice "somos dos", "vamos dos", "dos cortes", "para mi hijo y para mí":
1. Pregunta nombre y teléfono de CADA persona.
2. Crea cada cita por separado con horarios CONSECUTIVOS (ej: 10:00 y 10:30).
3. Verifica disponibilidad para ambos slots.
4. Confirma ambas reservas al final.

CONFIG: Min anticipación ${config['booking.min_advance_minutes'] ?? '60'}min | Max ${config['booking.max_advance_days'] ?? '30'} días | Slots ${config['booking.slot_duration_minutes'] ?? '30'}min`;

  promptCache.set(shopId, { prompt, expiresAt: Date.now() + CACHE_TTL_MS });
  return prompt;
}

async function callGroqWithRetry(
  params: Parameters<typeof groq.chat.completions.create>[0],
  maxRetries: number = 2
): Promise<Groq.Chat.ChatCompletion> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await groq.chat.completions.create(params) as Groq.Chat.ChatCompletion;
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 429 && attempt < maxRetries) {
        const delayMs = (attempt + 1) * 2000;
        logger.warn({ attempt, delayMs }, 'Groq 429, retrying after delay');
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
}

const FRIENDLY_ERRORS = [
  'Disculpa, no pude procesar tu solicitud. ¿Podrías intentarlo de nuevo? 🙏',
  'Ups, algo salió mal. ¿Puedes repetir lo que necesitas?',
  'Tuve un inconveniente. ¿Me lo dices de otra forma?',
];

function friendlyError(): string {
  return FRIENDLY_ERRORS[Math.floor(Math.random() * FRIENDLY_ERRORS.length)];
}

export async function runBarberAgent(input: AgentInput): Promise<AgentOutput> {
  const { shopId, userMessage, messageHistory, db, conversationId } = input;

  const executor = new ToolExecutor(db, shopId, conversationId);

  let systemPrompt: string;
  try {
    systemPrompt = await buildSystemPrompt(shopId, db);
  } catch (err) {
    logger.error({ err, shopId }, 'Failed to build system prompt');
    return {
      reply: friendlyError(),
      conversationId,
      inputTokens: 0, outputTokens: 0,
      toolsUsed: [], escalated: false,
    };
  }

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
  let lastPartialContent = '';
  let iterations = 0;

  try {
    while (iterations < env.GROQ_MAX_ITERATIONS) {
      iterations++;

      let completion: Groq.Chat.ChatCompletion;
      try {
        completion = await callGroqWithRetry({
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
          logger.warn({ shopId }, 'Groq rate limit after retries');
          finalReply = lastPartialContent || 'Tenemos mucha demanda en este momento. Intenta de nuevo en un minuto. 🙏';
          break;
        }
        if (status === 400) {
          logger.warn({ shopId, iterations }, 'Groq 400, retrying without tools');
          try {
            const fallback = await callGroqWithRetry({
              model: env.GROQ_MODEL,
              messages,
              max_tokens: env.GROQ_MAX_TOKENS,
              temperature: 0.3,
            });
            finalReply = (fallback.choices[0]?.message?.content ?? '').trim();
            const u = fallback.usage;
            if (u) { totalInputTokens += u.prompt_tokens ?? 0; totalOutputTokens += u.completion_tokens ?? 0; }
          } catch {
            finalReply = lastPartialContent || friendlyError();
          }
          break;
        }
        throw err;
      }

      const usage = completion.usage;
      if (usage) {
        totalInputTokens += usage.prompt_tokens ?? 0;
        totalOutputTokens += usage.completion_tokens ?? 0;
      }

      const choice = completion.choices[0];
      if (!choice) { break; }

      const assistantMsg = choice.message;
      const toolCalls = assistantMsg.tool_calls;

      if (assistantMsg.content) {
        lastPartialContent = assistantMsg.content.trim();
      }

      messages.push({
        role: 'assistant',
        content: assistantMsg.content ?? '',
        ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });

      if (!toolCalls || toolCalls.length === 0) {
        finalReply = (assistantMsg.content ?? '').trim();
        break;
      }

      for (const toolCall of toolCalls) {
        const name = toolCall.function.name;
        toolsUsed.push(name);
        if (name === 'escalate_to_human') escalated = true;

        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
        } catch {
          args = {};
          logger.warn({ toolName: name, raw: toolCall.function.arguments }, 'Bad tool args');
        }

        let toolResult;
        try {
          toolResult = await executor.execute(name, args);
        } catch (toolErr) {
          logger.warn({ toolName: name, err: toolErr }, 'Tool execution failed');
          toolResult = { success: false, error: 'No se pudo completar la operación. Intenta con otros datos.' };
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }
    }
  } catch (err) {
    logger.error({ err, shopId, iterations }, 'Agent loop failed');
    finalReply = lastPartialContent || friendlyError();
  }

  if (!finalReply) {
    finalReply = lastPartialContent || friendlyError();
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
