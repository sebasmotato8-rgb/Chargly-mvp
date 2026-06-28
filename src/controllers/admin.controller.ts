import { Request, Response } from 'express';
import { env } from '../config/env';
import { ordersRepository } from '../modules/orders/orders.repository';
import { ok, fail } from '../shared/response';
import { logger } from '../config/logger';

function renderAdminPage(orders: any[], total: number, page: number, error?: string): string {
  const totalPages = Math.ceil(total / 50);

  const statusColors: Record<string, string> = {
    paid: '#D4825A',
    processing: '#3B82F6',
    shipped: '#8B5CF6',
    delivered: '#10B981',
    cancelled: '#EF4444',
    refunded: '#6B7280',
  };

  const rows = orders.map(o => `
    <tr>
      <td>${new Date(o.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
      <td><strong>${o.customer_name}</strong><br><span style="color:#888;font-size:12px;">${o.customer_email}</span></td>
      <td>#${o.paypal_order_id.slice(0, 12)}...</td>
      <td>$${Number(o.amount).toFixed(2)} ${o.currency}</td>
      <td>${o.quantity}</td>
      <td><span style="background:${statusColors[o.status] || '#888'};color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">${o.status.toUpperCase()}</span></td>
      <td>${o.tracking_number || '<span style="color:#ccc;">—</span>'}</td>
      <td style="font-size:12px;color:#888;">${o.shipping_city}, ${o.shipping_country}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chargly Admin — Pedidos</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Inter, -apple-system, sans-serif; background:#FAFAF8; color:#1a1a1a; }
    .header { background:#0D0D0D; color:#fff; padding:20px 32px; display:flex; justify-content:space-between; align-items:center; }
    .header h1 { font-family:'Bebas Neue',sans-serif; font-size:28px; letter-spacing:2px; }
    .header .stats { display:flex; gap:24px; font-size:13px; color:#888; }
    .header .stats strong { color:#D4825A; font-size:18px; display:block; }
    .container { max-width:1200px; margin:0 auto; padding:24px; }
    table { width:100%; border-collapse:collapse; background:#fff; border:1px solid #E8E4DF; border-radius:8px; overflow:hidden; }
    th { background:#F5F2EE; color:#888; font-size:11px; text-transform:uppercase; letter-spacing:1px; padding:12px 16px; text-align:left; font-weight:600; }
    td { padding:12px 16px; border-top:1px solid #F0EDE8; font-size:14px; vertical-align:top; }
    tr:hover { background:#FAFAF8; }
    .pagination { display:flex; justify-content:center; gap:8px; margin-top:20px; }
    .pagination a { padding:8px 16px; border:1px solid #E8E4DF; border-radius:4px; text-decoration:none; color:#1a1a1a; font-size:13px; }
    .pagination a.active { background:#D4825A; color:#fff; border-color:#D4825A; }
    .error { background:#FEE2E2; color:#DC2626; padding:12px 20px; border-radius:6px; margin-bottom:16px; font-size:14px; }
    .empty { text-align:center; padding:60px; color:#888; }
    @media(max-width:768px) {
      table, thead, tbody, th, td, tr { display:block; }
      thead { display:none; }
      td { padding:6px 16px; border:none; }
      td:first-child { padding-top:16px; font-weight:600; color:#D4825A; }
      td:last-child { padding-bottom:16px; border-bottom:1px solid #F0EDE8; }
      tr { margin-bottom:8px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>CHARGLY ADMIN</h1>
    <div class="stats">
      <div><strong>${total}</strong>Pedidos totales</div>
      <div><strong>$${orders.reduce((s, o) => s + Number(o.amount), 0).toFixed(2)}</strong>Ingresos (página)</div>
    </div>
  </div>

  <div class="container">
    ${error ? `<div class="error">${error}</div>` : ''}
    ${orders.length === 0
      ? '<div class="empty"><p>No hay pedidos todavía.</p><p style="margin-top:8px;font-size:13px;">Los pedidos aparecerán aquí cuando los clientes compren.</p></div>'
      : `
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Cliente</th>
          <th>Orden PayPal</th>
          <th>Monto</th>
          <th>Cant.</th>
          <th>Estado</th>
          <th>Tracking</th>
          <th>Destino</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${totalPages > 1 ? `
    <div class="pagination">
      ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p =>
        `<a href="?page=${p}" class="${p === page ? 'active' : ''}">${p}</a>`
      ).join('')}
    </div>` : ''}
    `}
  </div>
</body>
</html>`;
}

export const adminController = {
  // GET /admin/orders — HTML panel
  async ordersPage(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const { orders, total } = await ordersRepository.list(page, 50);
      res.type('html').send(renderAdminPage(orders, total, page));
    } catch (err) {
      logger.error({ err }, 'Admin orders page error');
      res.type('html').send(renderAdminPage([], 0, 1, 'Error cargando pedidos'));
    }
  },

  // GET /admin/orders/api — JSON API
  async ordersList(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const { orders, total } = await ordersRepository.list(page, 50);
      ok(res, orders, { total, page, limit: 50, hasMore: page * 50 < total });
    } catch (err) {
      logger.error({ err }, 'Admin orders list error');
      fail(res, 'DATABASE_ERROR', 'Error cargando pedidos', 500);
    }
  },

  // PATCH /admin/orders/:id/status
  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
      if (!validStatuses.includes(status)) {
        fail(res, 'VALIDATION_ERROR', `Estado inválido. Válidos: ${validStatuses.join(', ')}`, 422);
        return;
      }

      const order = await ordersRepository.updateStatus(id, status);
      ok(res, order);
    } catch (err) {
      logger.error({ err }, 'Admin update status error');
      fail(res, 'DATABASE_ERROR', 'Error actualizando estado', 500);
    }
  },

  // PATCH /admin/orders/:id/tracking
  async updateTracking(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { tracking_number, tracking_url } = req.body;

      if (!tracking_number) {
        fail(res, 'VALIDATION_ERROR', 'tracking_number es requerido', 422);
        return;
      }

      await ordersRepository.updateTracking(
        id,
        tracking_number,
        tracking_url || `https://t.17track.net/en#nums=${tracking_number}`,
      );
      ok(res, { message: 'Tracking actualizado' });
    } catch (err) {
      logger.error({ err }, 'Admin update tracking error');
      fail(res, 'DATABASE_ERROR', 'Error actualizando tracking', 500);
    }
  },

  // Simple auth middleware for admin routes
  authMiddleware(req: Request, res: Response, next: Function): void {
    // Check Authorization header (Basic auth) or query param
    const authHeader = req.headers.authorization;
    const queryPass = req.query.password as string;

    let authenticated = false;

    if (authHeader?.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
      const [, password] = decoded.split(':');
      authenticated = password === env.ADMIN_PASSWORD;
    } else if (authHeader?.startsWith('Bearer ')) {
      authenticated = authHeader.slice(7) === env.ADMIN_PASSWORD;
    } else if (queryPass) {
      authenticated = queryPass === env.ADMIN_PASSWORD;
    }

    if (!authenticated) {
      // For HTML requests, show a login prompt
      if (req.headers.accept?.includes('text/html') && !queryPass) {
        res.set('WWW-Authenticate', 'Basic realm="Chargly Admin"');
        res.status(401).send('<!DOCTYPE html><html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0D0D0D;color:#fff;"><div style="text-align:center;"><h1 style="font-size:32px;letter-spacing:3px;">CHARGLY</h1><p style="color:#888;margin-top:8px;">Ingresa tus credenciales de administrador</p></div></body></html>');
        return;
      }
      fail(res, 'UNAUTHORIZED', 'Contraseña de admin incorrecta', 401);
      return;
    }

    next();
  },
};
