// ── Respuesta API estándar ────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ── Context del request (inyectado por middleware de auth) ────

export interface RequestContext {
  userId: string;
  shopId: string;
  role: 'owner' | 'admin' | 'barber';
  jwt: string;
}

// ── Extensión de Express ──────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      ctx: RequestContext;
    }
  }
}
