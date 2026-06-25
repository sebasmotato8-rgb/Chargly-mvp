import { z } from 'zod';

// ── Servicios ─────────────────────────────────────────────────

export const createServiceSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).nullable().optional(),
  duration_minutes: z.number().int().min(5).max(480),
  price: z.number().min(0),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color en formato hex #RRGGBB')
    .nullable()
    .optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

// ── Horarios ──────────────────────────────────────────────────

export const updateScheduleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  is_active: z.boolean().optional(),
  barber_id: z.string().uuid().optional(),
});

export const bulkUpdateScheduleSchema = z.array(updateScheduleSchema);

// ── Configuración del negocio ─────────────────────────────────

export const updateConfigSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  category: z.string().min(1).optional(),
  is_secret: z.boolean().optional(),
});

export const bulkUpdateConfigSchema = z.array(updateConfigSchema);

// ── Chat IA ───────────────────────────────────────────────────

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  conversation_id: z.string().uuid().nullable().optional(),
  client_phone: z.string().optional(), // para identificar al cliente en WhatsApp
  channel: z.enum(['web_chat', 'whatsapp', 'api']).default('web_chat'),
});

export type CreateServiceDto = z.infer<typeof createServiceSchema>;
export type UpdateServiceDto = z.infer<typeof updateServiceSchema>;
export type UpdateScheduleDto = z.infer<typeof updateScheduleSchema>;
export type BulkUpdateScheduleDto = z.infer<typeof bulkUpdateScheduleSchema>;
export type UpdateConfigDto = z.infer<typeof updateConfigSchema>;
export type BulkUpdateConfigDto = z.infer<typeof bulkUpdateConfigSchema>;
export type ChatMessageDto = z.infer<typeof chatMessageSchema>;
