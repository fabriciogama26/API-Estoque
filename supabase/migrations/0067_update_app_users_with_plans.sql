-- Atualiza app_users para registrar plano/assinatura e estados de pagamento.

alter table if exists public.app_users
  add column if not exists plan_id uuid,
  add column if not exists start_date timestamptz,
  add column if not exists end_date timestamptz,
  add column if not exists status_plan uuid,
  add column if not exists payment_status uuid;

alter table if exists public.app_users
  drop constraint if exists app_users_plan_id_fkey;

alter table if exists public.app_users
  add constraint app_users_plan_id_fkey foreign key (plan_id) references public.planos_users (id);
