import type { DbClient } from '../../integrations/supabase/client';

import { AppointmentsRepository } from '../../repositories/appointments.repository';
import { ClientsRepository } from '../../repositories/clients.repository';
import { ServicesRepository } from '../../repositories/services.repository';
import { BusinessConfigRepository } from '../../repositories/schedules.repository';
import { AppointmentsService } from '../../services/appointments.service';
import { logger } from '../../config/logger';

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class ToolExecutor {
  private appointmentsService: AppointmentsService;
  private clientsRepo: ClientsRepository;
  private servicesRepo: ServicesRepository;
  private configRepo: BusinessConfigRepository;
  private appointmentsRepo: AppointmentsRepository;

  constructor(
    private readonly db: DbClient,
    private readonly shopId: string,
    private readonly conversationId?: string
  ) {
    this.clientsRepo = new ClientsRepository(db);
    this.servicesRepo = new ServicesRepository(db);
    this.configRepo = new BusinessConfigRepository(db);
    this.appointmentsRepo = new AppointmentsRepository(db);
    this.appointmentsService = new AppointmentsService(
      this.appointmentsRepo,
      this.clientsRepo,
      this.servicesRepo
    );
  }

  async execute(toolName: string, toolInput: Record<string, unknown>): Promise<ToolResult> {
    logger.debug({ toolName, toolInput, shopId: this.shopId }, 'Ejecutando tool');

    try {
      switch (toolName) {
        case 'get_services':
          return this.getServices();

        case 'get_availability':
          return this.getAvailability(toolInput);

        case 'book_appointment':
          return this.bookAppointment(toolInput);

        case 'cancel_appointment':
          return this.cancelAppointment(toolInput);

        case 'reschedule_appointment':
          return this.rescheduleAppointment(toolInput);

        case 'find_client_appointments':
          return this.findClientAppointments(toolInput);

        case 'get_business_info':
          return this.getBusinessInfo();

        case 'escalate_to_human':
          return this.escalateToHuman(toolInput);

        default:
          return { success: false, error: `Tool desconocida: ${toolName}` };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      logger.warn({ toolName, error: message }, 'Tool falló');
      return { success: false, error: message };
    }
  }

  // ── Implementaciones ──────────────────────────────────────────

  private async getServices(): Promise<ToolResult> {
    const services = await this.servicesRepo.findAll(this.shopId, true);
    return {
      success: true,
      data: services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        duration_minutes: s.duration_minutes,
        price: s.price,
        price_formatted: `$${s.price.toLocaleString('es-CO')}`,
      })),
    };
  }

  private async getAvailability(input: Record<string, unknown>): Promise<ToolResult> {
    const slots = await this.appointmentsRepo.getAvailableSlots(
      input['barber_id'] as string,
      input['service_id'] as string,
      input['date'] as string
    );

    if (slots.length === 0) {
      return {
        success: true,
        data: {
          available: false,
          message: 'No hay horarios disponibles para esa fecha. Intenta con otra fecha.',
          slots: [],
        },
      };
    }

    return {
      success: true,
      data: {
        available: true,
        date: input['date'],
        slots: slots.map((s) => ({
          start: s.slot_start,
          end: s.slot_end,
          label: new Date(s.slot_start).toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Bogota',
          }),
        })),
      },
    };
  }

  private async bookAppointment(input: Record<string, unknown>): Promise<ToolResult> {
    const appointment = await this.appointmentsService.create(this.shopId, {
      barber_id: input['barber_id'] as string,
      service_id: input['service_id'] as string,
      scheduled_at: input['scheduled_at'] as string,
      source: 'chat',
      notes: (input['notes'] as string) ?? undefined,
      conversation_id: this.conversationId,
      client_data: {
        full_name: input['client_name'] as string,
        phone: input['client_phone'] as string,
        email: (input['client_email'] as string) ?? undefined,
      },
    });

    return {
      success: true,
      data: {
        appointment_id: appointment.id,
        status: appointment.status,
        scheduled_at: appointment.scheduled_at,
        message: `✅ Cita reservada para el ${new Date(appointment.scheduled_at).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'full', timeStyle: 'short' })}`,
      },
    };
  }

  private async cancelAppointment(input: Record<string, unknown>): Promise<ToolResult> {
    const appointment = await this.appointmentsService.cancel(
      input['appointment_id'] as string,
      this.shopId,
      { reason: input['reason'] as string }
    );

    return {
      success: true,
      data: {
        appointment_id: appointment.id,
        status: appointment.status,
        message: '❌ Tu cita ha sido cancelada correctamente.',
      },
    };
  }

  private async rescheduleAppointment(input: Record<string, unknown>): Promise<ToolResult> {
    const appointment = await this.appointmentsService.reschedule(
      input['appointment_id'] as string,
      this.shopId,
      {
        scheduled_at: input['new_scheduled_at'] as string,
        barber_id: (input['barber_id'] as string) ?? undefined,
      }
    );

    return {
      success: true,
      data: {
        appointment_id: appointment.id,
        scheduled_at: appointment.scheduled_at,
        message: `🔄 Cita reagendada para el ${new Date(appointment.scheduled_at).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'full', timeStyle: 'short' })}`,
      },
    };
  }

  private async findClientAppointments(input: Record<string, unknown>): Promise<ToolResult> {
    const client = await this.clientsRepo.findByPhone(
      input['client_phone'] as string,
      this.shopId
    );

    if (!client) {
      return {
        success: true,
        data: { found: false, message: 'No encontré un cliente con ese número de teléfono.' },
      };
    }

    const { data: appointments } = await this.appointmentsRepo.list(this.shopId, {
      page: 1,
      limit: 5,
    });

    const clientAppts = appointments
      .filter((a) => a.client_id === client.id)
      .filter((a) => !['cancelled', 'no_show'].includes(a.status))
      .filter((a) => new Date(a.scheduled_at) >= new Date());

    return {
      success: true,
      data: {
        found: true,
        client_name: client.full_name,
        appointments: clientAppts.map((a) => ({
          id: a.id,
          scheduled_at: a.scheduled_at,
          status: a.status,
          label: new Date(a.scheduled_at).toLocaleString('es-CO', {
            timeZone: 'America/Bogota',
            dateStyle: 'full',
            timeStyle: 'short',
          }),
        })),
      },
    };
  }

  private async getBusinessInfo(): Promise<ToolResult> {
    const { data: shop } = await this.db
      .from('barber_shops')
      .select('name, phone, email, address, city, timezone')
      .eq('id', this.shopId)
      .single();

    const config = await this.configRepo.getMap(this.shopId);

    return {
      success: true,
      data: {
        name: shop?.name,
        phone: shop?.phone,
        email: shop?.email,
        address: shop?.address,
        city: shop?.city,
        greeting: config['ai_agent.greeting'] ?? null,
        slot_duration_minutes: config['booking.slot_duration_minutes'] ?? '30',
        max_advance_days: config['booking.max_advance_days'] ?? '30',
      },
    };
  }

  private async escalateToHuman(input: Record<string, unknown>): Promise<ToolResult> {
    logger.warn(
      { shopId: this.shopId, conversationId: this.conversationId, ...input },
      'Escalando conversación a humano'
    );

    // Marcar la conversación como escalada
    if (this.conversationId) {
      await this.db
        .from('conversations')
        .update({ metadata: { escalated: true, escalation_reason: input['reason'], escalation_summary: input['summary'] } })
        .eq('id', this.conversationId)
        .eq('shop_id', this.shopId);
    }

    return {
      success: true,
      data: {
        escalated: true,
        message:
          'He notificado a nuestro equipo. Un miembro de Zac Barber se pondrá en contacto contigo pronto.',
      },
    };
  }
}
