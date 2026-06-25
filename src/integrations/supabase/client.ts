import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

// Usamos SupabaseClient<any> para evitar incompatibilidades entre nuestros tipos
// de base de datos y el contrato interno de GenericSchema del SDK.
// Los tipos de retorno se declaran explícitamente en cada repositorio
// usando las interfaces de src/types/database.ts
export type DbClient = SupabaseClient<any>;

/**
 * Cliente público (respeta RLS).
 * Usar en operaciones del dashboard con el JWT del usuario.
 */
export const supabaseAnon: DbClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false },
  }
);

/**
 * Cliente de servicio (bypassa RLS).
 * Usar SOLO en el backend para el agente IA, webhooks y n8n.
 * NUNCA exponer al cliente.
 */
export const supabaseService: DbClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Retorna un cliente autenticado con el JWT del usuario.
 * Úsalo en controllers para respetar el RLS del usuario.
 */
export function getAuthClient(jwt: string): DbClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  });
}
