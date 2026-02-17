-- Add resolution fields for api_errors and rename status to status_code.

-- 1) rename status -> status_code (http status)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_errors'
      AND column_name = 'status'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_errors'
      AND column_name = 'status_code'
  ) THEN
    ALTER TABLE public.api_errors RENAME COLUMN status TO status_code;
  END IF;
END;
$$;

-- rename existing status index to avoid name conflict
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'i'
      AND c.relname = 'api_errors_status_created_idx'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'i'
      AND c.relname = 'api_errors_status_code_created_idx'
  ) THEN
    ALTER INDEX public.api_errors_status_created_idx RENAME TO api_errors_status_code_created_idx;
  END IF;
END;
$$;

-- 2) add new status/resolution columns
ALTER TABLE public.api_errors
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS resolved_by uuid NULL;

-- 3) fk to app_users (resolved_by)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'api_errors_resolved_by_fkey'
  ) THEN
    ALTER TABLE public.api_errors
      ADD CONSTRAINT api_errors_resolved_by_fkey
      FOREIGN KEY (resolved_by) REFERENCES public.app_users(id);
  END IF;
END;
$$;

-- 4) backfill
UPDATE public.api_errors
SET status = 'open'
WHERE status IS NULL;

-- 5) indexes for management screen
CREATE INDEX IF NOT EXISTS api_errors_status_code_created_idx
  ON public.api_errors (status_code, created_at DESC);

CREATE INDEX IF NOT EXISTS api_errors_manage_status_created_idx
  ON public.api_errors (status, created_at DESC);

CREATE INDEX IF NOT EXISTS api_errors_resolved_by_idx
  ON public.api_errors (resolved_by);

-- 6) comments
COMMENT ON COLUMN public.api_errors.status_code IS 'HTTP status code';
COMMENT ON COLUMN public.api_errors.status IS 'Estado do erro: open/closed';
COMMENT ON COLUMN public.api_errors.resolved_at IS 'Data de resolucao do erro';
COMMENT ON COLUMN public.api_errors.resolved_by IS 'Usuario (app_users.id) que resolveu o erro';

-- 7) RLS: master can select/update
-- ensure RLS enabled
ALTER TABLE public.api_errors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- select for master
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'api_errors'
      AND policyname = 'api_errors_select_master'
  ) THEN
    CREATE POLICY api_errors_select_master
      ON public.api_errors
      FOR SELECT
      TO authenticated
      USING (public.is_master());
  END IF;

  -- update for master
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'api_errors'
      AND policyname = 'api_errors_update_master'
  ) THEN
    CREATE POLICY api_errors_update_master
      ON public.api_errors
      FOR UPDATE
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END;
$$;
