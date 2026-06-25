import { SupabaseClient } from '@supabase/supabase-js';
import type { Appointment, AvailableSlot, TodayAppointment } from '../types/database';
import type { ListAppointmentsDto } from '../validators/appointments.validators';
import { DatabaseError, NotFoundError, ConflictError } from '../shared/errors';

export class AppointmentsRepository {
  constructor(private readonly db: SupabaseClient<any>) {}

  async findById(id: string, shopId: string): Promise<Appointment> {
    const { data, error } = await this.db
      .from('appointments')
      .select('*')
      .eq('id', id)
      .eq('shop_id', shopId)
      .single();

    if (error) throw new DatabaseError(error.message, error);
    if (!data) throw new NotFoundError('Cita', id);
    return data;
  }

  async list(shopId: string, params: ListAppointmentsDto): Promise<{ data: Appointment[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    let query = this.db
      .from('appointments')
      .select('*', { count: 'exact' })
      .eq('shop_id', shopId)
      .order('scheduled_at', { ascending: false });

    if (params.date) {
      const start = `${params.date}T00:00:00`;
      const end = `${params.date}T23:59:59`;
      query = query.gte('scheduled_at', start).lte('scheduled_at', end);
    }
    if (params.barber_id) query = query.eq('barber_id', params.barber_id);
    if (params.status) query = query.eq('status', params.status);

    const { data, error, count } = await query.range(offset, offset + params.limit - 1);
    if (error) throw new DatabaseError(error.message, error);
    return { data: data ?? [], total: count ?? 0 };
  }

  async todayView(shopId: string): Promise<TodayAppointment[]> {
    const { data, error } = await this.db
      .from('v_today_appointments')
      .select('*')
      .eq('shop_id', shopId);

    if (error) throw new DatabaseError(error.message, error);
    return data ?? [];
  }

  async getAvailableSlots(barberId: string, serviceId: string, date: string): Promise<AvailableSlot[]> {
    const { data, error } = await this.db.rpc('get_available_slots', {
      p_barber_id: barberId,
      p_service_id: serviceId,
      p_date: date,
    });

    if (error) throw new DatabaseError(error.message, error);
    return data ?? [];
  }

  async checkOverlap(
    barberId: string,
    scheduledAt: string,
    endsAt: string,
    excludeId?: string
  ): Promise<boolean> {
    const { data, error } = await this.db.rpc('check_appointment_overlap', {
      p_barber_id: barberId,
      p_scheduled_at: scheduledAt,
      p_ends_at: endsAt,
      ...(excludeId ? { p_exclude_id: excludeId } : {}),
    });

    if (error) throw new DatabaseError(error.message, error);
    return data as boolean;
  }

  async create(payload: Partial<Appointment>): Promise<Appointment> {
    // Verificar solapamiento antes de insertar
    if (payload.barber_id && payload.scheduled_at && payload.ends_at) {
      const hasOverlap = await this.checkOverlap(
        payload.barber_id,
        payload.scheduled_at,
        payload.ends_at
      );
      if (hasOverlap) {
        throw new ConflictError('El horario seleccionado ya está ocupado. Por favor elige otro slot.');
      }
    }

    const { data, error } = await this.db
      .from('appointments')
      .insert(payload)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message, error);
    if (!data) throw new DatabaseError('No se pudo crear la cita');
    return data;
  }

  async updateStatus(
    id: string,
    shopId: string,
    status: Appointment['status'],
    extra?: Partial<Appointment>
  ): Promise<Appointment> {
    const { data, error } = await this.db
      .from('appointments')
      .update({ status, ...extra, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('shop_id', shopId)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message, error);
    if (!data) throw new NotFoundError('Cita', id);
    return data;
  }

  async reschedule(
    id: string,
    shopId: string,
    scheduledAt: string,
    endsAt: string,
    barberId?: string
  ): Promise<Appointment> {
    const current = await this.findById(id, shopId);
    const targetBarber = barberId ?? current.barber_id;

    const hasOverlap = await this.checkOverlap(targetBarber, scheduledAt, endsAt, id);
    if (hasOverlap) {
      throw new ConflictError('El nuevo horario ya está ocupado.');
    }

    return this.updateStatus(id, shopId, 'confirmed', {
      scheduled_at: scheduledAt,
      ends_at: endsAt,
      barber_id: targetBarber,
    });
  }
}
