import { SupabaseClient } from '@supabase/supabase-js';
import type { Client } from '../types/database';
import type { CreateClientDto, UpdateClientDto, SearchClientsDto } from '../validators/clients.validators';
import { DatabaseError, NotFoundError } from '../shared/errors';

export class ClientsRepository {
  constructor(private readonly db: SupabaseClient<any>) {}

  async findById(id: string, shopId: string): Promise<Client> {
    const { data, error } = await this.db
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('shop_id', shopId)
      .single();

    if (error) throw new DatabaseError(error.message, error);
    if (!data) throw new NotFoundError('Cliente', id);
    return data;
  }

  async findByPhone(phone: string, shopId: string): Promise<Client | null> {
    const { data, error } = await this.db
      .from('clients')
      .select('*')
      .eq('phone', phone)
      .eq('shop_id', shopId)
      .maybeSingle();

    if (error) throw new DatabaseError(error.message, error);
    return data;
  }

  async search(shopId: string, params: SearchClientsDto): Promise<{ data: Client[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    let query = this.db
      .from('clients')
      .select('*', { count: 'exact' })
      .eq('shop_id', shopId)
      .order('full_name');

    if (params.phone) {
      query = query.ilike('phone', `%${params.phone}%`);
    } else if (params.q) {
      // Búsqueda por nombre usando ilike (pg_trgm está disponible para ordenación avanzada)
      query = query.ilike('full_name', `%${params.q}%`);
    }

    const { data, error, count } = await query.range(offset, offset + params.limit - 1);

    if (error) throw new DatabaseError(error.message, error);
    return { data: data ?? [], total: count ?? 0 };
  }

  async create(shopId: string, dto: CreateClientDto): Promise<Client> {
    const { data, error } = await this.db
      .from('clients')
      .insert({ ...dto, shop_id: shopId })
      .select()
      .single();

    if (error) throw new DatabaseError(error.message, error);
    if (!data) throw new DatabaseError('No se pudo crear el cliente');
    return data;
  }

  async upsertByPhone(shopId: string, dto: CreateClientDto): Promise<Client> {
    const existing = await this.findByPhone(dto.phone, shopId);
    if (existing) return existing;
    return this.create(shopId, dto);
  }

  async update(id: string, shopId: string, dto: UpdateClientDto): Promise<Client> {
    const { data, error } = await this.db
      .from('clients')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('shop_id', shopId)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message, error);
    if (!data) throw new NotFoundError('Cliente', id);
    return data;
  }
}
