import { z } from 'zod';

export const createAppointmentSchema = z.object({
  barber_id: z.string().uuid(),
  client_id: z.string().uuid().optional(),
  // Si no hay client_id, se puede crear el cliente al vuelo
  client_data: z
    .object({
      full_name: z.string().min(2),
      phone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
      email: z.string().email().optional(),
    })
    .optional(),
  service_id: z.string().uuid(),
  scheduled_at: z.string().datetime({ offset: true, message: 'Debe ser ISO 8601 con timezone' }),
  notes: z.string().max(500).optional(),
  source: z.enum(['web', 'whatsapp', 'chat', 'manual', 'n8n']).default('web'),
  conversation_id: z.string().uuid().optional(),
}).refine(
  (data) => data.client_id || data.client_data,
  { message: 'Se requiere client_id o client_data para crear la cita' }
);

export const cancelAppointmentSchema = z.object({
  reason: z.string().min(3, 'Por favor indique el motivo de cancelación').max(500),
});

export const rescheduleAppointmentSchema = z.object({
  scheduled_at: z.string().datetime({ offset: true }),
  barber_id: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
});

export const listAppointmentsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  barber_id: z.string().uuid().optional(),
  status: z
    .enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
    .optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const availabilitySchema = z.object({
  barber_id: z.string().uuid(),
  service_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
});

export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
export type CancelAppointmentDto = z.infer<typeof cancelAppointmentSchema>;
export type RescheduleAppointmentDto = z.infer<typeof rescheduleAppointmentSchema>;
export type ListAppointmentsDto = z.infer<typeof listAppointmentsSchema>;
export type AvailabilityDto = z.infer<typeof availabilitySchema>;
