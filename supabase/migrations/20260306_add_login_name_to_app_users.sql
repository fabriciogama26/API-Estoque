-- Adiciona login_name para autenticação por login (case-insensitive).

alter table public.app_users
  add column if not exists login_name text;

update public.app_users
  set login_name = lower(username)
where login_name is null or btrim(login_name) = '';

do $$
begin
  if exists (
    select 1
      from public.app_users
     group by lower(username)
    having count(*) > 1
  ) then
    raise exception 'Conflito de login_name: existem usernames que diferem apenas por maiusculas/minusculas.';
  end if;
end;
$$;

create or replace function public.normalize_login_name()
returns trigger
language plpgsql
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

drop trigger if exists app_users_login_name_trigger on public.app_users;
create trigger app_users_login_name_trigger
before insert or update on public.app_users
for each row
execute function public.normalize_login_name();

alter table public.app_users
  alter column login_name set not null;

create unique index if not exists app_users_login_name_unique
  on public.app_users (lower(login_name));
