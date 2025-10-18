# Supabase Setup

Este diretório contém as migrations e instruções para replicar o banco do projeto no Supabase, tanto em ambientes locais (CLI + Docker) quanto remotos.

## Pré-requisitos

- Supabase CLI instalada (`npm install -g supabase` ou `brew install supabase/tap/supabase`).
- Projeto Supabase criado (via [https://app.supabase.com](https://app.supabase.com)) com as chaves `anon` e `service_role` em mãos.
- Docker instalado para executar o stack local (`supabase start`).

## Estrutura

```
supabase/
├── README.md
└── migrations/
    ├── 0001_create_schema.sql           # Cria tabelas principais (pessoas, materiais, entradas, saídas, acidentes, price history)
    ├── 0002_enable_rls.sql              # Habilita RLS e define policies básicas
    ├── 0003_seed_sample_data.sql        # Seeds de desenvolvimento (usuários, materiais, grupos)
    ├── 0004_update_schema_supabase.sql  # Ajustes de nomenclatura camelCase, índices e colunas de auditoria
    └── 0005_add_material_group_fields.sql # Campos adicionais para agrupamento de materiais
```

As migrations foram desenhadas para serem idempotentes (verificam `if not exists`) e podem ser reaplicadas com segurança.

## Como aplicar localmente

1. Faça login na CLI: `supabase login` e informe o access token da sua conta.
2. Inicie o projeto local (se ainda não existir) com `supabase init` e escolha este diretório (`supabase`) como destino.
3. Suba o stack local (Postgres + API): `supabase start`.
4. Execute as migrations: `supabase db reset --db-url postgres://postgres:postgres@localhost:6543/postgres`.
   - Este comando aplicará os arquivos `0001` a `0005` na ordem e carregará o seed de desenvolvimento.
5. Acesse o [Supabase Studio](http://localhost:54323) (a URL exata aparece em `supabase status`) ou use `psql` para validar as tabelas, policies e dados gerados.

## Como aplicar em produção

1. Gere um access token (Dashboard → Account → Access Tokens).
2. Faça login na CLI na máquina de deploy: `supabase login`.
3. Vincule o projeto remoto: `supabase link --project-ref <project-ref>`.
4. Rode `supabase db push` para aplicar as migrations. O seed `0003_seed_sample_data.sql` foi pensado para desenvolvimento; remova-o do fluxo ou adapte para rodar apenas fora de produção.
5. Confirme no dashboard que as policies RLS (`0002_enable_rls.sql`) e os índices/constraints adicionais (`0004`, `0005`) estão habilitados.

## Integração com o backend

- Crie um arquivo `.env` para as funções serverless com as chaves:
  ```
  SUPABASE_URL=https://<project-ref>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
  SUPABASE_ANON_KEY=<anon-key>
  ```
- O frontend consome `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` via `.env.local`.
- As operações da API utilizam o client oficial (`@supabase/supabase-js`) configurado em `api/_shared/supabaseClient.js`.
- Policies e perfis de acesso extras podem ser baseados no guia [`docs/rls-policies-guide.txt`](../docs/rls-policies-guide.txt).

## Dicas

- **Reaplicar seeds**: execute novamente `supabase db reset` no ambiente local sempre que precisar dos dados iniciais.
- **Sincronizar schema**: após ajustes manuais no dashboard, gere uma nova migration com `supabase migration new <nome>` e salve no diretório `migrations/` para manter o versionamento.
- **Testes automatizados**: valide endpoints com o comando `supabase functions serve` ou executando `vercel dev` apontando para o Postgres local.
- **Auditoria**: os campos adicionados em `0004_update_schema_supabase.sql` (`usuarioCadastro`, `usuarioAtualizacao`, `historicoEdicao`, etc.) são usados pelo frontend para exibir logs e devem ser mantidos em updates.

Com isso o Supabase ficará alinhado com as expectativas das funções serverless e do frontend.
