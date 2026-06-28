import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    service: 'chargly-backend',
    env: env.NODE_ENV,
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      shop_id: req.headers['x-shop-id'],
    }),
    err: pino.stdSerializers.err,
  },
});

export type Logger = typeof logger;
