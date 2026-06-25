import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors';
import { fail } from '../shared/response';
import { logger } from '../config/logger';

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Error de validación Zod
  if (err instanceof ZodError) {
    fail(res, 'VALIDATION_ERROR', 'Datos de entrada inválidos', 422, err.flatten().fieldErrors);
    return;
  }

  // Error de aplicación conocido
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, url: req.url, method: req.method }, err.message);
    } else {
      logger.warn({ code: err.code, url: req.url }, err.message);
    }
    fail(res, err.code, err.message, err.statusCode, err.details);
    return;
  }

  // Error de Supabase (PostgreSQL)
  if (err instanceof Error && 'code' in err) {
    const pgErr = err as Error & { code: string; details?: string };
    logger.error({ pgCode: pgErr.code, err }, 'Error de base de datos');

    if (pgErr.code === '23505') {
      fail(res, 'CONFLICT', 'Ya existe un registro con esos datos', 409, pgErr.details);
      return;
    }
    if (pgErr.code === '23503') {
      fail(res, 'REFERENCE_ERROR', 'Referencia a un registro que no existe', 422);
      return;
    }
  }

  // Error desconocido
  logger.error({ err, url: req.url, method: req.method }, 'Error no manejado');
  fail(res, 'INTERNAL_ERROR', 'Error interno del servidor', 500);
}

export function notFoundMiddleware(req: Request, res: Response): void {
  fail(res, 'NOT_FOUND', `Ruta ${req.method} ${req.url} no encontrada`, 404);
}
