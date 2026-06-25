-- ============================================================
-- Migration 011 — Grant permissions to Supabase roles
-- Sin estos grants, las tablas existen pero PostgREST no puede
-- acceder a ellas (error 42501: permission denied).
-- service_role bypasa RLS pero aún necesita GRANT de tabla.
-- ============================================================

-- ── Schema ───────────────────────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;

-- ── Tablas ───────────────────────────────────────────────────
grant all on all tables in schema public to anon, authenticated, service_role;

-- ── Secuencias ───────────────────────────────────────────────
grant all on all sequences in schema public to anon, authenticated, service_role;

-- ── Funciones ────────────────────────────────────────────────
grant execute on all functions in schema public to anon, authenticated, service_role;

-- ── Defaults para tablas futuras ─────────────────────────────
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
