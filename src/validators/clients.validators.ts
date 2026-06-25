import { z } from 'zod';

export const createClientSchema = z.object({
  full_name: z.string().min(2, 'Nombre mínimo 2 caracteres').max(100),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{7,14}$/, 'Teléfono en formato E.164 (ej: +573001234567)'),
  email: z.string().email().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  preferred_barber_id: z.string().uuid().nullable().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export const searchClientsSchema = z.object({
  q: z.string().min(2).optional(),
  phone: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateClientDto = z.infer<typeof createClientSchema>;
export type UpdateClientDto = z.infer<typeof updateClientSchema>;
export type SearchClientsDto = z.infer<typeof searchClientsSchema>;
