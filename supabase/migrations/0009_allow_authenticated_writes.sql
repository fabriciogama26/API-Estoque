DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'entradas'
      AND policyname = 'entradas insert authenticated'
  ) THEN
    CREATE POLICY "entradas insert authenticated" ON public.entradas
      FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'entradas'
      AND policyname = 'entradas update authenticated'
  ) THEN
    CREATE POLICY "entradas update authenticated" ON public.entradas
      FOR UPDATE
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'saidas'
      AND policyname = 'saidas insert authenticated'
  ) THEN
    CREATE POLICY "saidas insert authenticated" ON public.saidas
      FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'saidas'
      AND policyname = 'saidas update authenticated'
  ) THEN
    CREATE POLICY "saidas update authenticated" ON public.saidas
      FOR UPDATE
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'acidentes'
      AND policyname = 'acidentes insert authenticated'
  ) THEN
    CREATE POLICY "acidentes insert authenticated" ON public.acidentes
      FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'acidentes'
      AND policyname = 'acidentes update authenticated'
  ) THEN
    CREATE POLICY "acidentes update authenticated" ON public.acidentes
      FOR UPDATE
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END
$$;