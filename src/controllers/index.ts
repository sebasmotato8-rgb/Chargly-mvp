import { Request, Response, NextFunction } from 'express';
import { ServicesRepository } from '../repositories/services.repository';
import { SchedulesRepository, BusinessConfigRepository } from '../repositories/schedules.repository';
import { SchedulesService, BusinessConfigService } from '../services/schedules.service';
import { AiService } from '../modules/ai/ai.service';
import { getAuthClient } from '../integrations/supabase/client';
import { createServiceSchema, updateServiceSchema, updateScheduleSchema, bulkUpdateScheduleSchema, bulkUpdateConfigSchema, chatMessageSchema } from '../validators/shared.validators';
import { ok, created } from '../shared/response';
import { ForbiddenError } from '../shared/errors';

// ── Servicios ─────────────────────────────────────────────────

export const servicesController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = getAuthClient(req.ctx.jwt);
      const repo = new ServicesRepository(db);
      const activeOnly = req.query['active'] !== 'false';
      const services = await repo.findAll(req.ctx.shopId, activeOnly);
      ok(res, services);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.ctx.role === 'barber') throw new ForbiddenError();
      const dto = createServiceSchema.parse(req.body);
      const db = getAuthClient(req.ctx.jwt);
      const repo = new ServicesRepository(db);
      const service = await repo.create(req.ctx.shopId, dto);
      created(res, service);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.ctx.role === 'barber') throw new ForbiddenError();
      const dto = updateServiceSchema.parse(req.body);
      const db = getAuthClient(req.ctx.jwt);
      const repo = new ServicesRepository(db);
      const service = await repo.update(req.params['id']!, req.ctx.shopId, dto);
      ok(res, service);
    } catch (err) {
      next(err);
    }
  },
};

// ── Horarios ──────────────────────────────────────────────────

export const schedulesController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = getAuthClient(req.ctx.jwt);
      const svc = new SchedulesService(new SchedulesRepository(db));
      const barberId = req.query['barber_id'] as string | undefined;
      const schedules = await svc.getByShop(req.ctx.shopId, barberId);
      ok(res, schedules);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = getAuthClient(req.ctx.jwt);
      const svc = new SchedulesService(new SchedulesRepository(db));

      // Soporte para actualización individual o en bloque
      const isBulk = Array.isArray(req.body);
      const barberId = req.ctx.role === 'barber' ? req.ctx.userId : (req.body[0]?.barber_id ?? req.ctx.userId);

      if (isBulk) {
        const dtos = bulkUpdateScheduleSchema.parse(req.body);
        const result = await svc.bulkUpdate(req.ctx.shopId, barberId, dtos);
        ok(res, result);
      } else {
        const dto = updateScheduleSchema.parse(req.body);
        const result = await svc.update(req.ctx.shopId, barberId, dto);
        ok(res, result);
      }
    } catch (err) {
      next(err);
    }
  },
};

// ── Configuración ─────────────────────────────────────────────

export const configController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = getAuthClient(req.ctx.jwt);
      const svc = new BusinessConfigService(new BusinessConfigRepository(db));
      const isAdmin = req.ctx.role !== 'barber';
      const configs = await svc.getAll(req.ctx.shopId, isAdmin);
      ok(res, configs);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.ctx.role === 'barber') throw new ForbiddenError();
      const dtos = bulkUpdateConfigSchema.parse(Array.isArray(req.body) ? req.body : [req.body]);
      const db = getAuthClient(req.ctx.jwt);
      const svc = new BusinessConfigService(new BusinessConfigRepository(db));
      const result = await svc.update(req.ctx.shopId, dtos);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },
};

// ── Agente IA ─────────────────────────────────────────────────

const aiService = new AiService();

export const aiController = {
  async chat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = chatMessageSchema.parse(req.body);
      const result = await aiService.chat(req.ctx.shopId, dto);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },
};
