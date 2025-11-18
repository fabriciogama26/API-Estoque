# Supabase Setup

Este diretório reúne as migrations SQL e orientações para preparar o banco do projeto tanto em ambientes locais (Supabase CLI + Docker) quanto no projeto hospedado no Supabase.

## Pré-requisitos

- Supabase CLI instalada (`npm install -g supabase` ou `brew install supabase/tap/supabase`).
- Docker ativo para executar o stack local (`supabase start`).
- Projeto criado em https://app.supabase.com com as chaves `anon` e `service_role` disponíveis.

## Estrutura

```
supabase/
├── README.md
└── migrations/
    ├── 0001_create_schema.sql                      # Tabelas base (pessoas, materiais, entradas, saídas, acidentes, price history)
    ├── 0002_enable_rls.sql                         # Habilita RLS e aplica políticas mínimas
    ├── 0003_seed_sample_data.sql                   # Seeds para desenvolvimento (não aplicar em produção)
    ├── 0004_update_schema_supabase.sql             # Campos de auditoria e ajustes de nomenclatura
    ├── 0005_add_material_group_fields.sql          # Campos de agrupamento e numeração de EPIs
    ├── 0006_add_missing_person_accident_fields.sql # Campos adicionais em pessoas/acidentes
    ├── 0007_rename_centro_columns.sql              # Padronização `centro_custo`/`centro_servico`
    ├── 0008_update_centros.sql                     # Correções de dados nos centros cadastrados
    ├── 0009_allow_authenticated_writes.sql         # Políticas para permitir escrita autenticada controlada
    ├── 0010_add_setor_to_pessoas.sql               # Inclusão de setor + ajustes de views
    ├── 0011_create_reference_tables.sql            # Tabelas de referência (centros, cargos etc.)
    ├── 0012_create_grupos_material_itens.sql       # Catálogo de grupos de materiais
    ├── 0013_rls_reference_tables.sql               # RLS para as tabelas de referência
    ├── 0014_create_acidente_agentes_tipos.sql      # Catálogo de agentes/tipos de acidente
    ├── 0015_create_acidente_partes.sql             # Catálogo de partes lesionadas
    ├── 0016_create_acidente_lesoes.sql             # Catálogo de lesões
    ├── 0017_alter_acidente_lesoes.sql              # Ajustes de colunas nas lesões
    ├── 0018_create_centro_custo_table.sql          # Tabela dedicada de centro de custo
    ├── 0019_create_reference_tables_people.sql     # Views auxiliares para pessoas
    ├── 0020_link_pessoas_reference_tables.sql      # Relacionamentos de pessoas com as tabelas de referência
    ├── 0021_update_pessoas_reference_links.sql     # Correções de vínculos e FKs
    ├── 0022_drop_tipoExecucao_column.sql           # Substitui colunas simples por tabelas de domínio
    ├── 0023_create_acidente_historico.sql          # Tabela de histórico de acidentes
    ├── 0024_acidente_historico_policies.sql        # Políticas de RLS para o histórico
    ├── 0025_create_pessoas_historico.sql           # Tabela de histórico de pessoas
    ├── 0026_allow_authenticated_materials_write.sql# Ajustes de políticas para materiais
    └── 0027_expand_material_history.sql            # Campos adicionais no histórico de materiais
```

As migrations foram escritas para serem idempotentes sempre que possível. Mesmo assim, mantenha o versionamento da CLI em dia para garantir a execução na ordem correta. A tabela `public.app_users` foi simplificada: o `id` agora coincide com o UUID de `auth.users` (com FKs e RLS ajustados) e campos extras (`email`, `ativo`) foram adicionados para suportar o cartão *Status do sistema*.

## Como aplicar localmente

1. Faça login na CLI: `supabase login` e informe o access token da sua conta.
2. Dentro do diretório `supabase/`, inicialize o projeto local (apenas na primeira vez):
   ```bash
   supabase init
   ```
3. Suba o stack local (Postgres + API + Studio):
   ```bash
   supabase start
   ```
4. Execute as migrations (incluindo seeds de desenvolvimento):
   ```bash
   supabase db reset --db-url postgres://postgres:postgres@localhost:6543/postgres
   ```
5. Acesse o Studio local (URL exibida pelo comando) para conferir tabelas, políticas e dados carregados.

## Como aplicar em produção

1. Gere um access token (Dashboard → Account → Access Tokens) e faça login com `supabase login`.
2. Vincule o projeto remoto dentro do diretório `supabase/`:
   ```bash
   supabase link --project-ref <project-ref>
   ```
3. Suba as migrations:
   ```bash
   supabase db push
   ```
4. **Seeds:** o arquivo `0003_seed_sample_data.sql` é apenas para ambientes de desenvolvimento. Remova-o do fluxo de produção ou mantenha uma ramificação separada.
5. Revise as políticas de RLS após o deploy, garantindo que as permissões atendam aos perfis esperados do aplicativo.

## Integração com o frontend

- As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` alimentam o SDK usado em `src/services/api.js`.
- O frontend consome diretamente as tabelas criadas pelas migrations (`pessoas`, `materiais`, `entradas`, `saidas`, `acidentes`, tabelas de domínio e históricos).
- Para recursos que exigem a chave `service_role` (por exemplo, funções serverless em `api/`), configure `.env`/variáveis da Vercel com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

## Checklist rápido após rodar as migrations

- [ ] Todas as tabelas essenciais existem e possuem RLS habilitado (verifique com `select * from pg_policies where schemaname = 'public';`).
- [ ] Views `vw_indicadores_acidentes` e demais estruturas de suporte estão alinhadas com os dashboards (quando aplicável). A view precisa expor `indice_acidentados`, `indice_avaliacao_gravidade`, `indice_relativo_acidentes`, `dias_debitados` e `total_trabalhadores` além das taxas tradicionais.
- [ ] Tabelas de referência (`centros_servico`, `setores`, `cargos`, `centros_custo`, `tipo_execucao`, `acidente_agentes`, `acidente_tipos`, `acidente_partes`, `acidente_lesoes`) possuem dados mínimos para alimentar os formulários.
- [ ] Usuários de teste foram criados no Supabase Auth e conseguem autenticar no frontend.
- [ ] Seeds locais carregaram corretamente (caso esteja rodando o modo `local`).

## Dicas adicionais

- Reaplique `supabase db reset` em ambientes locais sempre que precisar voltar aos dados de exemplo.
- Gere novas migrations (`supabase migration new <nome>`) sempre que alterar manualmente o schema via Studio.
- Use `supabase functions serve` ou `vercel dev` para testar as rotas em `api/` com o mesmo banco local.
- Documente mudanças relevantes em [`docs/supabase-esquema-checklist.txt`](../docs/supabase-esquema-checklist.txt) para manter o time alinhado.
