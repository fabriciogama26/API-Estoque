# API-Estoque

Aplicacao React (Vite) para gestao de EPIs/Estoque integrada ao Supabase.

Documentacao detalhada por pagina em `docs/`.
- HHT Mensal (acidentes): ver `docs/HhtMensal.txt`

## Atalhos a partir do Estoque atual

Na lista de materiais do Estoque atual, os botões de ação por material podem abrir Entradas/Saídas já com dados pré-preenchidos via querystring:

- Entradas: `?materialId=<id>&centroCusto=<centro>` (também aceita `centroEstoque`)
- Saídas: `?centroEstoque=<centro>&materialId=<id>`
- Histórico de saídas (novo): o sino em "Ações" abre modal com todas as saídas do material, com filtro Mês/Ano. O botão só fica ativo se houver movimentação registrada.
- Filtro "Apenas com histórico de saídas": na tela Estoque, marque para ver somente materiais com movimentação (sino ativo).

## Materiais (deduplicacao/CA)

- Preflight (`material_preflight_check`) roda no create/update e compara por base completa (fabricante + grupo + item + numero/tamanho + cores + caracteristicas): CA duplicado (bloqueia), base igual com CA vazio (bloqueia) e base igual com CA diferente (alerta). Master enxerga todos; dependente filtra por `account_owner_id`.
- Base igual + CA diferente abre modal de confirmacao listando IDs conflitantes; so salva se confirmar (envia `forceBaseCaDiff`). Em update, a funcao ignora o proprio `p_material_id`.
- Trigger de INSERT (`evitar_duplicidade_material`, mig. `20250109_adjust_materials_dedup.sql`) bloqueia base igual com CA vazio e CA repetido na mesma base (inclui cores/caracteristicas).
- Trigger de UPDATE (`evitar_duplicidade_material_update`, mig. `20250112_base_ca_diff_update.sql`) replica as regras acima, sempre desconsiderando o registro editado.
- RPC base: `20250111_material_preflight.sql`.

## Regras de estoque (banco)

- Saídas já são bloqueadas quando excedem o saldo disponível (`validar_saldo_saida`).
- Cancelar uma entrada é vetado se o saldo remanescente ficar menor que as saídas ativas (ver `supabase/migrations/0082_prevent_cancel_entrada_negative_stock.sql`).

## Requisitos

- Node.js 20+
- Projeto Supabase (Postgres + Auth + Storage)
- RBAC/RLS: veja `docs/CredenciaisPermissoes.txt` e `docs/Configuracoes.txt` para detalhes de roles/permissoes e tela de configuracoes (apenas master/admin).

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`.

## Variaveis de ambiente (frontend)

Crie `.env.local`:

- `VITE_SUPABASE_URL` (ex.: `https://<project-ref>.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_FUNCTIONS_URL` (base das Edge Functions, ex.: `https://<project-ref>.supabase.co/functions/v1`)
- `VITE_IMPORTS_BUCKET` (opcional, padrao `imports`)

## Supabase (migrations)

As migrations ficam em `supabase/migrations/`.

Para aplicar no projeto remoto:

```bash
supabase db push
```

## Desligamento em massa (Pessoas)

Fluxo:
1) Usuario seleciona um arquivo XLSX no modal de Pessoas.
2) Front faz upload do XLSX no Storage (bucket `imports`) e chama a Edge Function `desligamento-import` passando `{ path }`.
3) A Edge Function baixa o arquivo, valida linhas, atualiza `public.pessoas`, registra `public.pessoas_historico` e remove o XLSX enviado (best-effort).

Arquivos e docs:
- UI: `src/components/Pessoas/PessoasDesligamentoModal.jsx`
- Service: `src/services/api.js` (`api.pessoas.importDesligamentoPlanilha`)
- Edge Functions: `supabase/functions/desligamento-import` e `supabase/functions/desligamento-template`
- Bucket/policies: `supabase/migrations/0077_fix_imports_bucket.sql`
- Documentacao do fluxo: `docs/DesligamentoEmMassa.txt`

