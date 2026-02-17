-- Corrige lints de seguranca: search_path da function e policy de app_errors.

-- normalize_login_name com search_path fixo.
create or replace function public.normalize_login_name() returns trigger
  language plpgsql
  set search_path to 'public'
  as $$
begin
  if new.login_name is null or btrim(new.login_name) = '' then
    new.login_name := lower(btrim(coalesce(new.username, '')));
  else
    new.login_name := lower(btrim(new.login_name));
  end if;

  if new.login_name is null or new.login_name = '' then
    raise exception 'login_name nao pode ser vazio';
  end if;

  return new;
end;
$$;

-- app_errors: restringe insert ao proprio usuario (ou null)
drop policy if exists app_errors_insert_authenticated on public.app_errors;
create policy app_errors_insert_authenticated
  on public.app_errors
  for insert
  to authenticated
  with check (user_id is null or user_id::text = (select auth.uid())::text);
