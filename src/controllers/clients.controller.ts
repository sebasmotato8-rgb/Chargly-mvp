import { Request, Response, NextFunction } from 'express';
import { ClientsService } from '../services/clients.service';
import { ClientsRepository } from '../repositories/clients.repository';
import { getAuthClient } from '../integrations/supabase/client';
import { createClientSchema, updateClientSchema, searchClientsSchema } from '../validators/clients.validators';
import { ok, created } from '../shared/response';

function makeService(req: Request): ClientsService {
  const db = getAuthClient(req.ctx.jwt);
  return new ClientsService(new ClientsRepository(db));
}

export const clientsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = searchClientsSchema.parse(req.query);
      const svc = makeService(req);
      const result = await svc.search(req.ctx.shopId, params);
      ok(res, result.data, result.meta);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const svc = makeService(req);
      const client = await svc.getById(req.params['id']!, req.ctx.shopId);
      ok(res, client);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = createClientSchema.parse(req.body);
      const svc = makeService(req);
      const client = await svc.create(req.ctx.shopId, dto);
      created(res, client);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = updateClientSchema.parse(req.body);
      const svc = makeService(req);
      const client = await svc.update(req.params['id']!, req.ctx.shopId, dto);
      ok(res, client);
    } catch (err) {
      next(err);
    }
  },
};
