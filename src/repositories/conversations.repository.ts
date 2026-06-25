import { SupabaseClient } from '@supabase/supabase-js';
import type { Conversation, ConversationMessage, MessageRole } from '../types/database';
import { DatabaseError } from '../shared/errors';

export class ConversationsRepository {
  constructor(private readonly db: SupabaseClient<any>) {}

  async findById(id: string, shopId?: string): Promise<Conversation | null> {
    let query = this.db
      .from('conversations')
      .select('*')
      .eq('id', id);

    if (shopId) query = query.eq('shop_id', shopId);

    const { data, error } = await query.maybeSingle();

    if (error) throw new DatabaseError(error.message, error);
    return data;
  }

  async create(payload: {
    shopId: string;
    clientId?: string;
    channel: Conversation['channel'];
    externalId?: string;
  }): Promise<Conversation> {
    const { data, error } = await this.db
      .from('conversations')
      .insert({
        shop_id: payload.shopId,
        client_id: payload.clientId ?? null,
        channel: payload.channel,
        external_id: payload.externalId ?? null,
      })
      .select()
      .single();

    if (error) throw new DatabaseError(error.message, error);
    if (!data) throw new DatabaseError('No se pudo crear la conversación');
    return data;
  }

  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    const { data, error } = await this.db
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at');

    if (error) throw new DatabaseError(error.message, error);
    return data ?? [];
  }

  async addMessage(payload: {
    conversationId: string;
    role: MessageRole;
    content: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
    toolResult?: Record<string, unknown>;
    inputTokens?: number;
    outputTokens?: number;
    model?: string;
    latencyMs?: number;
  }): Promise<ConversationMessage> {
    const { data, error } = await this.db
      .from('conversation_messages')
      .insert({
        conversation_id: payload.conversationId,
        role: payload.role,
        content: payload.content,
        tool_name: payload.toolName ?? null,
        tool_input: payload.toolInput ?? null,
        tool_result: payload.toolResult ?? null,
        input_tokens: payload.inputTokens ?? null,
        output_tokens: payload.outputTokens ?? null,
        model: payload.model ?? null,
        latency_ms: payload.latencyMs ?? null,
      })
      .select()
      .single();

    if (error) throw new DatabaseError(error.message, error);
    if (!data) throw new DatabaseError('No se pudo guardar el mensaje');
    return data;
  }

  async resolve(id: string, shopId?: string): Promise<void> {
    let query = this.db
      .from('conversations')
      .update({ is_resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', id);

    if (shopId) query = query.eq('shop_id', shopId);

    const { error } = await query;

    if (error) throw new DatabaseError(error.message, error);
  }
}
