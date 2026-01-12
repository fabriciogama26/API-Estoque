-- Forca ativo=false quando dataDemissao (data_demissao) for preenchida, e ativo=true quando for nula/vazia.
create or replace function public.pessoas_force_inativo_on_demissao()
returns trigger as $$
begin
  if new."dataDemissao" is null or trim(coalesce(new."dataDemissao"::text, '')) = '' then
    new.ativo := true;
  else
    new.ativo := false;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_pessoas_force_inativo on public.pessoas;
create trigger trg_pessoas_force_inativo
before insert or update on public.pessoas
for each row execute function public.pessoas_force_inativo_on_demissao();
