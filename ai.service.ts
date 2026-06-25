import type { Content } from '@google/generative-ai';
import { runBarberAgent } from './agent';
import { ConversationsRepository } from '../../repositories/conversations.repository';
import { ClientsRepository } from '../../repositories/clients.repository';
import { supabaseService } from '../../integrations/supabase/client';
import type { ChatMessageDto } from '../../validators/shared.validators';
import { logger } from '../../config/logger';

export interface ChatResponse {
  reply: string;
  conversation_id: string;
  escalated: boolean;
  usage: { input_tokens: number; output_tokens: number };
}

export class AiService {
  private convRepo: ConversationsRepository;
  private clientsRepo: ClientsRepository;

  constructor() {
    this.convRepo = new ConversationsRepository(supabaseService);
    this.clientsRepo = new ClientsRepository(supabaseService);
  }

  async chat(shopId: string, dto: ChatMessageDto): Promise<ChatResponse> {
    const startMs = Date.now();

    // 1. Resolver o crear conversación
    let conversation = dto.conversation_id
      ? await this.convRepo.findById(dto.conversation_id, shopId)
      : null;

    // Identificar cliente por teléfono si viene de WhatsApp
    let clientId: string | undefined;
    if (dto.client_phone) {
      const client = await this.clientsRepo.findByPhone(dto.client_phone, shopId);
      if (client) clientId = client.id;
    }

    if (!conversation) {
      conversation = await this.convRepo.create({
        shopId,
        clientId,
        channel: dto.channel,
      });
    }

    // 2. Reconstruir historial en formato Content[] de Gemini
    const rawMessages = await this.convRepo.getMessages(conversation.id);

    const messageHistory: Content[] = rawMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',   // Gemini usa "model" en vez de "assistant"
        parts: [{ text: m.content }],
      }));

    // 3. Guardar mensaje entrante del usuario
    await this.convRepo.addMessage({
      conversationId: conversation.id,
      role: 'user',
      content: dto.message,
    });

    // 4. Ejecutar el agente
    const agentResult = await runBarberAgent({
      shopId,
      userMessage: dto.message,
      conversationId: conversation.id,
      messageHistory,
      db: supabaseService,
    });

    const latencyMs = Date.now() - startMs;

    // 5. Persistir respuesta del modelo
    await this.convRepo.addMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: agentResult.reply,
      inputTokens: agentResult.inputTokens,
      outputTokens: agentResult.outputTokens,
      model: 'gemini-2.5-pro',
      latencyMs,
    });

    logger.info(
      {
        shopId,
        conversationId: conversation.id,
        toolsUsed: agentResult.toolsUsed,
        inputTokens: agentResult.inputTokens,
        outputTokens: agentResult.outputTokens,
        latencyMs,
      },
      'Chat Gemini completado'
    );

    return {
      reply: agentResult.reply,
      conversation_id: conversation.id,
      escalated: agentResult.escalated,
      usage: {
        input_tokens: agentResult.inputTokens,
        output_tokens: agentResult.outputTokens,
      },
    };
  }
}
