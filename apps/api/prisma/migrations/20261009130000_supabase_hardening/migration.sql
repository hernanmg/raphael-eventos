-- Endurecimiento para Supabase (no cambia el schema de Prisma).
--
-- Supabase expone el schema `public` por su Data API (PostgREST) a los roles
-- `anon` y `authenticated`, y por default les otorga privilegios sobre las
-- tablas nuevas. Esta app NO usa la Data API (todo pasa por apps/api con
-- app_user), y hay tablas sin RLS a propósito: `session` (sesiones de login
-- de express-session — legible por anon = robo de sesiones) y `tenants`.
-- Se les quita TODO a esos roles, también para tablas futuras.
--
-- En un Postgres sin esos roles (el Docker de desarrollo) no hace nada.
-- Igual conviene deshabilitar la Data API en el dashboard de Supabase.
DO $$
DECLARE
  r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END
$$;
