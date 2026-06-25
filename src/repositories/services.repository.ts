import { SupabaseClient } from '@supabase/supabase-js';
import type { Service } from '../types/database';
import type { CreateServiceDto, UpdateServiceDto } from '../validators/shared.validators';
import { DatabaseError, NotFoundError } from '../shared/errors';

export class ServicesRepository {
  constructor(private readonly db: SupabaseClient<any>) {}

  async findAll(shopId: string, activeOnly = true): Promise<Service[]> {
    let query = this.db
      .from('services')
      .select('*')
      .eq('shop_id', shopId)
      .order('sort_order');

    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw new DatabaseError(error.message, error);
    return data ?? [];
  }

  async findById(id: string, shopId: string): Promise<Service> {
    const { data, error } = await this.db
      .from('services')
      .select('*')
      .eq('id', id)
      .eq('shop_id', shopId)
      .single();

    if (error) throw new DatabaseError(error.message, error);
    if (!data) throw new NotFoundError('Servicio', id);
    return data;
  }

  async create(shopId: string, dto: CreateServiceDto): Promise<Service> {
    const { data, error } = await this.db
      .from('services')
      .insert({ ...dto, shop_id: shopId })
      .select()
      .single();

    if (error) throw new DatabaseError(error.message, error);
    if (!data) throw new DatabaseError('No se pudo crear el servicio');
    return data;
  }

  async update(id: string, shopId: string, dto: UpdateServiceDto): Promise<Service> {
    const { data, error } = await this.db
      .from('services')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('shop_id', shopId)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message, error);
    if (!data) throw new NotFoundError('Servicio', id);
    return data;
  }
}
