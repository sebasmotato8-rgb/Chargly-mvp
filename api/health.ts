import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: 'ok',
    service: 'chargly-backend',
    version: '2.0.1',
    ts: new Date().toISOString(),
  });
}
