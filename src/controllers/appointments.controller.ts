import { Request, Response, NextFunction } from 'express';
import { AppointmentsService } from '../services/appointments.service';
import { AppointmentsRepository } from '../repositories/appointments.repository';
import { ClientsRepository } from '../repositories/clients.repository';
import { ServicesRepository } from '../repositories/services.repository';
import { getAuthClient, supabaseService } from '../integrations/supabase/client';
import {
  createAppointmentSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
  listAppointmentsSchema,
  availabilitySchema,
} from '../validators/appointments.validators';
import { ok, created } from '../shared/response';

function makeService(req: Request): AppointmentsService {
  const db = getAuthClient(req.ctx.jwt);
  return new AppointmentsService(
    new AppointmentsRepository(db),
    new ClientsRepository(db),
    new ServicesRepository(db)
  );
}

export const appointmentsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = listAppointmentsSchema.parse(req.query);
      const svc = makeService(req);
      // Hoy: retorna la vista enriquecida
      if (params.date === new Date().toISOString().split('T')[0]) {
        const data = await svc.getTodayView(req.ctx.shopId);
        ok(res, data);
        return;
      }
      const result = await svc.list(req.ctx.shopId, params);
      ok(res, result.data, result.meta);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const svc = makeService(req);
      const appt = await svc.getById(req.params['id']!, req.ctx.shopId);
      ok(res, appt);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = createAppointmentSchema.parse(req.body);
      const svc = makeService(req);
      const appt = await svc.create(req.ctx.shopId, dto);
      created(res, appt);
    } catch (err) {
      next(err);
    }
  },

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = cancelAppointmentSchema.parse(req.body);
      const svc = makeService(req);
      const appt = await svc.cancel(req.params['id']!, req.ctx.shopId, dto);
      ok(res, appt);
    } catch (err) {
      next(err);
    }
  },

  async reschedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = rescheduleAppointmentSchema.parse(req.body);
      const svc = makeService(req);
      const appt = await svc.reschedule(req.params['id']!, req.ctx.shopId, dto);
      ok(res, appt);
    } catch (err) {
      next(err);
    }
  },

  async availability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = availabilitySchema.parse(req.query);
      const svc = makeService(req);
      const slots = await svc.getAvailability(req.ctx.shopId, dto);
      ok(res, slots);
    } catch (err) {
      next(err);
    }
  },

  async markCompleted(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const svc = makeService(req);
      const appt = await svc.markCompleted(req.params['id']!, req.ctx.shopId);
      ok(res, appt);
    } catch (err) {
      next(err);
    }
  },

  async markNoShow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const svc = makeService(req);
      const appt = await svc.markNoShow(req.params['id']!, req.ctx.shopId);
      ok(res, appt);
    } catch (err) {
      next(err);
    }
  },

  async dashboardList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const shopId = req.ctx.shopId;
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const { data, error } = await supabaseService
        .from('appointments')
        .select(`
          id, scheduled_at, ends_at, status, notes, source,
          clients(full_name, phone),
          services(name, price, duration_minutes),
          users!appointments_barber_id_fkey(full_name)
        `)
        .eq('shop_id', shopId)
        .gte('scheduled_at', `${today}T00:00:00`)
        .order('scheduled_at', { ascending: true })
        .limit(100);

      if (error) {
        next(error);
        return;
      }
      ok(res, data ?? []);
    } catch (err) {
      next(err);
    }
  },

  async dashboardUpdateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const shopId = req.ctx.shopId;
      const id = req.params['id'];
      const { status, reason } = req.body as { status: string; reason?: string };
      const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (reason) update['cancellation_reason'] = reason;
      const { data, error } = await supabaseService
        .from('appointments')
        .update(update)
        .eq('id', id)
        .eq('shop_id', shopId)
        .select()
        .single();
      if (error) { next(error); return; }
      ok(res, data);
    } catch (err) {
      next(err);
    }
  },

  async dashboardDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const shopId = req.ctx.shopId;
      const id = req.params['id'];
      const { error } = await supabaseService
        .from('appointments')
        .delete()
        .eq('id', id)
        .eq('shop_id', shopId);
      if (error) { next(error); return; }
      ok(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
};
