import { AppointmentsRepository } from '../repositories/appointments.repository';
import { ClientsRepository } from '../repositories/clients.repository';
import { ServicesRepository } from '../repositories/services.repository';
import type {
  CreateAppointmentDto,
  CancelAppointmentDto,
  RescheduleAppointmentDto,
  ListAppointmentsDto,
  AvailabilityDto,
} from '../validators/appointments.validators';
import type { Appointment, AvailableSlot, TodayAppointment } from '../types/database';
import type { PaginationMeta } from '../types/api';
import { ValidationError } from '../shared/errors';
import { logger } from '../config/logger';

export class AppointmentsService {
  constructor(
    private readonly appointmentsRepo: AppointmentsRepository,
    private readonly clientsRepo: ClientsRepository,
    private readonly servicesRepo: ServicesRepository
  ) {}

  async getAvailability(shopId: string, dto: AvailabilityDto): Promise<AvailableSlot[]> {
    // Validar que el servicio pertenece al shop
    await this.servicesRepo.findById(dto.service_id, shopId);
    return this.appointmentsRepo.getAvailableSlots(dto.barber_id, dto.service_id, dto.date);
  }

  async list(
    shopId: string,
    params: ListAppointmentsDto
  ): Promise<{ data: Appointment[]; meta: PaginationMeta }> {
    const { data, total } = await this.appointmentsRepo.list(shopId, params);
    return {
      data,
      meta: {
        total,
        page: params.page,
        limit: params.limit,
        hasMore: params.page * params.limit < total,
      },
    };
  }

  async getById(id: string, shopId: string): Promise<Appointment> {
    return this.appointmentsRepo.findById(id, shopId);
  }

  async getTodayView(shopId: string): Promise<TodayAppointment[]> {
    return this.appointmentsRepo.todayView(shopId);
  }

  async create(shopId: string, dto: CreateAppointmentDto): Promise<Appointment> {
    // 1. Resolver client_id
    let clientId = dto.client_id;

    if (!clientId && dto.client_data) {
      const client = await this.clientsRepo.upsertByPhone(shopId, dto.client_data);
      clientId = client.id;
    }

    if (!clientId) {
      throw new ValidationError('Se requiere client_id o client_data');
    }

    // 2. Obtener duración del servicio para calcular ends_at
    const service = await this.servicesRepo.findById(dto.service_id, shopId);
    const scheduledAt = new Date(dto.scheduled_at);
    const endsAt = new Date(scheduledAt.getTime() + service.duration_minutes * 60_000);

    // 3. Validar que el slot está disponible (doble check con la función SQL)
    const slots = await this.appointmentsRepo.getAvailableSlots(
      dto.barber_id,
      dto.service_id,
      scheduledAt.toISOString().split('T')[0]
    );

    const slotAvailable = slots.some(
      (s) => new Date(s.slot_start).getTime() === scheduledAt.getTime()
    );

    if (!slotAvailable) {
      throw new ValidationError(
        'El horario seleccionado no está disponible. Por favor elige otro slot.',
        { available_slots: slots }
      );
    }

    logger.info(
      { shopId, clientId, barberId: dto.barber_id, scheduledAt: dto.scheduled_at },
      'Creando cita'
    );

    // 4. Crear la cita (el trigger SQL captura snapshots de precio/duración)
    return this.appointmentsRepo.create({
      shop_id: shopId,
      barber_id: dto.barber_id,
      client_id: clientId,
      service_id: dto.service_id,
      scheduled_at: dto.scheduled_at,
      ends_at: endsAt.toISOString(),
      status: 'pending',
      source: dto.source,
      notes: dto.notes ?? null,
      conversation_id: dto.conversation_id ?? null,
    });
  }

  async cancel(id: string, shopId: string, dto: CancelAppointmentDto): Promise<Appointment> {
    const appointment = await this.appointmentsRepo.findById(id, shopId);

    if (['completed', 'cancelled', 'no_show'].includes(appointment.status)) {
      throw new ValidationError(`No se puede cancelar una cita en estado "${appointment.status}"`);
    }

    logger.info({ appointmentId: id, reason: dto.reason }, 'Cancelando cita');

    return this.appointmentsRepo.updateStatus(id, shopId, 'cancelled', {
      cancellation_reason: dto.reason,
    });
  }

  async reschedule(
    id: string,
    shopId: string,
    dto: RescheduleAppointmentDto
  ): Promise<Appointment> {
    const appointment = await this.appointmentsRepo.findById(id, shopId);

    if (['completed', 'cancelled', 'no_show'].includes(appointment.status)) {
      throw new ValidationError(`No se puede reagendar una cita en estado "${appointment.status}"`);
    }

    const barberId = dto.barber_id ?? appointment.barber_id;
    const service = await this.servicesRepo.findById(appointment.service_id, shopId);
    const scheduledAt = new Date(dto.scheduled_at);
    const endsAt = new Date(scheduledAt.getTime() + service.duration_minutes * 60_000);

    logger.info({ appointmentId: id, newTime: dto.scheduled_at }, 'Reagendando cita');

    return this.appointmentsRepo.reschedule(
      id,
      shopId,
      dto.scheduled_at,
      endsAt.toISOString(),
      barberId
    );
  }

  async markNoShow(id: string, shopId: string): Promise<Appointment> {
    return this.appointmentsRepo.updateStatus(id, shopId, 'no_show');
  }

  async markCompleted(id: string, shopId: string): Promise<Appointment> {
    return this.appointmentsRepo.updateStatus(id, shopId, 'completed');
  }
}
