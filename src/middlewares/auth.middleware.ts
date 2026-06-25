import { Request, Response, NextFunction } from 'express';
import { supabaseService } from '../integrations/supabase/client';
import { UnauthorizedError } from '../shared/errors';
import { logger } from '../config/logger';

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token no proporcionado');
    }

    const token = authHeader.slice(7);

    // El SDK valida la firma y expiración del JWT contra Supabase Auth.
    // No necesitamos SUPABASE_JWT_SECRET ni jsonwebtoken.
    const { data: authData, error: authError } = await supabaseService.auth.getUser(token);
    if (authError || !authData.user) {
      throw new UnauthorizedError('Token inválido o expirado');
    }

    // Cargar datos del usuario desde la BD (para obtener shop_id y role)
    const { data: user, error } = await supabaseService
      .from('users')
      .select('id, shop_id, role, is_active')
      .eq('id', authData.user.id)
      .single();

    if (error || !user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    if (!user.is_active) {
      throw new UnauthorizedError('Usuario inactivo');
    }

    req.ctx = {
      userId: user.id,
      shopId: user.shop_id,
      role: user.role as 'owner' | 'admin' | 'barber',
      jwt: token,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/** Middleware de autorización por rol */
export function requireRole(...roles: Array<'owner' | 'admin' | 'barber'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!roles.includes(req.ctx.role)) {
      next(new UnauthorizedError(`Se requiere rol: ${roles.join(' o ')}`));
      return;
    }
    next();
  };
}

/** Middleware liviano para el chat (no requiere usuario registrado, usa shop_id del header) */
export async function chatAuthMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const shopId = req.headers['x-shop-id'] as string;
    if (!shopId) {
      throw new UnauthorizedError('x-shop-id header requerido');
    }

    // Verificar que la barbería existe y está activa
    const { data: shop } = await supabaseService
      .from('barber_shops')
      .select('id')
      .eq('id', shopId)
      .eq('is_active', true)
      .single();

    if (!shop) {
      throw new UnauthorizedError('Barbería no encontrada');
    }

    // Para el chat, el ctx tiene shop_id pero no userId (cliente anónimo)
    req.ctx = {
      userId: 'anonymous',
      shopId,
      role: 'barber', // mínimo permiso
      jwt: '',
    };

    logger.debug({ shopId }, 'Chat auth OK');
    next();
  } catch (err) {
    next(err);
  }
}
