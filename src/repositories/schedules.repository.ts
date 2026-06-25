import { SupabaseClient } from '@supabase/supabase-js';
import type { BarberSchedule, BusinessConfig } from '../types/database';
import type { UpdateScheduleDto, BulkUpdateConfigDto } from '../validators/shared.validators';
import { DatabaseError } from '../shared/errors';

// ── Schedules ─────────────────────────────────────────────────

export class SchedulesRepository {
  constructor(private readonly db: SupabaseClient<any>) {}

  async findByShop(shopId: string, barberId?: string): Promise<BarberSchedule[]> {
    let query = this.db
      .from('barber_schedules')
      .select('*')
      .eq('shop_id', shopId)
      .order('barber_id')
      .order('day_of_week');

    if (barberId) query = query.eq('barber_id', barberId);

    const { data, error } = await query;
    if (error) throw new DatabaseError(error.message, error);
    return data ?? [];
  }

  async upsert(shopId: string, barberId: string, dto: UpdateScheduleDto): Promise<BarberSchedule> {
    const { data, error } = await this.db
      .from('barber_schedules')
      .upsert(
        {
          shop_id: shopId,
          barber_id: dto.barber_id ?? barberId,
          day_of_week: dto.day_of_week,
          start_time: dto.start_time,
          end_time: dto.end_time,
          is_active: dto.is_active ?? true,
        },
        { onConflict: 'barber_id,day_of_week' }
      )
      .select()
      .single();

    if (error) throw new DatabaseError(error.message, error);
    if (!data) throw new DatabaseError('No se pudo actualizar el horario');
    return data;
  }

  async bulkUpsert(shopId: string, barberId: string, dtos: UpdateScheduleDto[]): Promise<BarberSchedule[]> {
    const rows = dtos.map((dto) => ({
      shop_id: shopId,
      barber_id: dto.barber_id ?? barberId,
      day_of_week: dto.day_of_week,
      start_time: dto.start_time,
      end_time: dto.end_time,
      is_active: dto.is_active ?? true,
    }));

    const { data, error } = await this.db
      .from('barber_schedules')
      .upsert(rows, { onConflict: 'barber_id,day_of_week' })
      .select();

    if (error) throw new DatabaseError(error.message, error);
    return data ?? [];
  }
}

// ── Business Config ───────────────────────────────────────────

export class BusinessConfigRepository {
  constructor(private readonly db: SupabaseClient<any>) {}

  async findAll(shopId: string, includeSecrets = false): Promise<BusinessConfig[]> {
    let query = this.db
      .from('business_config')
      .select('*')
      .eq('shop_id', shopId)
      .order('category')
      .order('key');

    if (!includeSecrets) query = query.eq('is_secret', false);

    const { data, error } = await query;
    if (error) throw new DatabaseError(error.message, error);
    return data ?? [];
  }

  async findByKey(shopId: string, key: string): Promise<string | null> {
    const { data } = await this.db
      .from('business_config')
      .select('value')
      .eq('shop_id', shopId)
      .eq('key', key)
      .single();

    return data?.value ?? null;
  }

  async getMap(shopId: string): Promise<Record<string, string>> {
    const configs = await this.findAll(shopId, true);
    return Object.fromEntries(configs.map((c) => [c.key, c.value]));
  }

  async upsert(shopId: string, dtos: BulkUpdateConfigDto): Promise<BusinessConfig[]> {
    const rows = dtos.map((dto) => ({
      shop_id: shopId,
      key: dto.key,
      value: dto.value,
      category: dto.category ?? 'general',
      is_secret: dto.is_secret ?? false,
    }));

    const { data, error } = await this.db
      .from('business_config')
      .upsert(rows, { onConflict: 'shop_id,key' })
      .select();

    if (error) throw new DatabaseError(error.message, error);
    return data ?? [];
  }
}
