import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const envCheck = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    PAYPAL_CLIENT_ID: !!process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: !!process.env.PAYPAL_CLIENT_SECRET,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    CJ_API_KEY: !!process.env.CJ_API_KEY,
    ADMIN_PASSWORD_IS_SET: !!process.env.ADMIN_PASSWORD,
    ADMIN_PASSWORD_LENGTH: (process.env.ADMIN_PASSWORD || '(default)').length,
    query_password_type: typeof req.query.password,
    query_password_is_array: Array.isArray(req.query.password),
    auth_header: req.headers.authorization ? 'present' : 'missing',
  };

  res.status(200).json(envCheck);
}
