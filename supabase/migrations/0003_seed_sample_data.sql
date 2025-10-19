-- supabase/migrations/0003_seed_sample_data.sql
-- Dados de exemplo opcionais para desenvolvimento local.

insert into public.app_users (username, display_name)
values
  ('admin', 'Administrador')
on conflict (username) do nothing;

insert into public.materiais (id, nome, fabricante, validade_dias, ca, valor_unitario, estoque_minimo, usuario_cadastro)
values
  (gen_random_uuid(), 'Capacete Classe B', '3M', 730, '12345', 89.90, 5, 'seed'),
  (gen_random_uuid(), 'Luva Nitrilica', 'Ansell', 365, '67890', 24.50, 20, 'seed')
on conflict (id) do nothing;

insert into public.pessoas (id, nome, matricula, local, cargo, usuario_cadastro)
values
  (gen_random_uuid(), 'Joao Silva', '0001', 'Manutencao', 'Tecnico', 'seed'),
  (gen_random_uuid(), 'Maria Oliveira', '0002', 'Seguranca', 'Coordenadora', 'seed')
on conflict (id) do nothing;

