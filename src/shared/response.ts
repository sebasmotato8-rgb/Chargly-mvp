import { Response } from 'express';
import type { ApiResponse, ApiError, PaginationMeta } from '../types/api';

export function ok<T>(res: Response, data: T, meta?: PaginationMeta): Response {
  const body: ApiResponse<T> = { success: true, data, ...(meta ? { meta } : {}) };
  return res.status(200).json(body);
}

export function created<T>(res: Response, data: T): Response {
  const body: ApiResponse<T> = { success: true, data };
  return res.status(201).json(body);
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function fail(res: Response, code: string, message: string, statusCode = 500, details?: unknown): Response {
  const body: ApiError = { success: false, error: { code, message, ...(details ? { details } : {}) } };
  return res.status(statusCode).json(body);
}
