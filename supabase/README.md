# Supabase Setup

Este diret�rio contem as migrations base para recriar a estrutura do projeto no Supabase.

## Pr�-requisitos
- Supabase CLI instalada (`npm install -g supabase` ou `brew install supabase/tap/supabase`).
- Projeto Supabase criado (via https://app.supabase.com) e chave `anon`/`service_role` anotadas.
- Docker instalado caso use Supabase CLI em modo local (`supabase start`).

## Como aplicar localmente
1. Execute `supabase login` e informe o access token da sua conta.
2. Configure um novo projeto local com `supabase init` (caso ainda n�o exista). Voc� pode reutilizar este diret�rio como base, apontando `supabase` nas perguntas do assistente.
3. Rode `supabase start` para subir Postgres + API local.
4. Aplique as migrations: `supabase db reset --db-url postgres://postgres:postgres@localhost:6543/postgres`. Isso executa `0001_create_schema.sql`, `0002_enable_rls.sql` e `0003_seed_sample_data.sql` em sequ�ncia.
5. Verifique as tabelas via `supabase studio` (`supabase status` mostra a URL) ou via `psql`.

## Como aplicar em produ��o
1. Gere um access token do Supabase (Dashboard > Account > Access Tokens).
2. Rode `supabase login` com esse token na m�quina CI/local.
3. Configure uma conex�o remota: `supabase link --project-ref <project-ref>`.
4. Execute `supabase db push` para subir as migrations.
5. Opcional: remova `0003_seed_sample_data.sql` do fluxo de produ��o ou adapte para rodar apenas em ambientes de desenvolvimento.

## Integra��o com o backend
- Crie um arquivo `backend/.env.supabase` (copiando de `.env.example`) com:
  ```
  SUPABASE_URL=https://<project-ref>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
  SUPABASE_ANON_KEY=<anon-key>
  ```
- Atualize os repositories para usarem o client oficial (`@supabase/supabase-js`) ou a conex�o Postgres. Sugest�o: crie uma camada `backend/src/infra/supabase` com helpers para queries parametrizadas.
- Substitua a autentica��o baseada em vari�veis (`APP_USERNAME`/`APP_PASSWORD`) por Supabase Auth ou por registros na tabela `app_users`.

## Pr�ximos passos recomendados
- Criar migrations adicionais para auditoria/logs, caso necess�rio.
- Definir policies espec�ficas para leituras separadas por role (ex.: usu�rios do frontend apenas `select`).
- Implementar seeds consistentes com ambientes (desenvolvimento x produ��o).
