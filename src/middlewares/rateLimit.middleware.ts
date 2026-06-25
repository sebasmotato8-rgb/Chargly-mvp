import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { fail } from '../shared/response';

export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    fail(res, 'RATE_LIMIT', 'Demasiadas solicitudes. Intenta más tarde.', 429);
  },
});

export const aiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AI_RATE_LIMIT_MAX,
  keyGenerator: (req) => req.headers['x-shop-id'] as string ?? req.ip ?? 'unknown',
  handler: (_req, res) => {
    fail(res, 'RATE_LIMIT', 'Límite de mensajes del chat alcanzado. Intenta en 15 minutos.', 429);
  },
});
