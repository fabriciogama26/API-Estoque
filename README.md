# API-Estoque



Aplicacao React (Vite) para gestao de EPIs/Estoque integrada ao Supabase.



Documentacao detalhada por pagina em `docs/`.

- HHT Mensal (acidentes): ver `docs/HhtMensal.txt`



## Atalhos a partir do Estoque atual



Na lista de materiais do Estoque atual, os botÃµes de aÃ§Ã£o por material podem abrir Entradas/SaÃ­das jÃ¡ com dados prÃ©-preenchidos via querystring:



- Entradas: `?materialId=<id>&centroCusto=<centro>` (tambÃ©m aceita `centroEstoque`)

- SaÃ­das: `?centroEstoque=<centro>&materialId=<id>`

- HistÃ³rico de saÃ­das (novo): o sino em "AÃ§Ãµes" abre modal com todas as saÃ­das do material, com filtro MÃªs/Ano. O botÃ£o sÃ³ fica ativo se houver movimentaÃ§Ã£o registrada.

- Filtro "Apenas com histÃ³rico de saÃ­das": na tela Estoque, marque para ver somente materiais com movimentaÃ§Ã£o (sino ativo).



## Pessoas (status x demissao)

- Trigger `supabase/migrations/20250114_force_inativo_on_demissao.sql` força `ativo=false` quando `dataDemissao` for preenchida e `ativo=true` quando vazia/nula.
- Cancelar pessoa exige observacao e registra no historico (modal no padrão Materiais).
- Filtros da lista (status, datas de cadastro, etc.) são aplicados no frontend; o backend já filtra por `account_owner_id`.

## Cache leve de catalogos

- Catalogos de centros de servico, almoxarifado, cargos e setores usam cache em memoria (TTL 30s) no service.
- Para atualizar imediatamente apos cadastro/edicao, use `dataClient.catalogCache.clear([...])` e recarregue a lista.

## Historicos (UI)

- Todos os modais de historico (Entradas, Saidas, Materiais, Pessoas, Acidentes e HHT mensal) usam paginacao de 5 registros por pagina via `useHistoryPagination` + `TablePagination`.
- A comparacao com o snapshot anterior permanece correta mesmo ao mudar de pagina.

## Materiais (deduplicacao/CA)

- Preflight (`material_preflight_check`) roda no create/update e compara por base completa (fabricante + grupo + item + numero/tamanho + cores + caracteristicas): CA duplicado (bloqueia), base igual com CA vazio (bloqueia) e base igual com CA diferente (alerta). Master enxerga todos; dependente filtra por `account_owner_id`.
- Base igual + CA diferente abre modal de confirmacao listando IDs conflitantes; so salva se confirmar (envia `forceBaseCaDiff`). Em update, a funcao ignora o proprio `p_material_id`.
- Trigger de INSERT (`evitar_duplicidade_material`, mig. `20250109_adjust_materials_dedup.sql`) bloqueia qualquer CA repetido (mesmo em outra base), alem de base igual com CA vazio e hash completo (cores/caracteristicas/CA).
- Trigger de UPDATE (`evitar_duplicidade_material_update`, mig. `20250112_base_ca_diff_update.sql`) replica as regras de base/hash ignorando o registro editado.
- RPC base: `20250111_material_preflight.sql`.
- Persistencia: RPCs material_create_full (20250129) e material_update_full (20250130) gravam material + vinculos em uma unica transacao; evita 42501 nas tabelas de vinculo.

## Pessoas (deduplicacao)

- Preflight `pessoas_preflight_check` (mig. `20250114_pessoas_preflight.sql`) no create/update, escopo por owner: bloqueia matricula duplicada; alerta quando nome igual e matricula diferente (modal de confirmacao). UPDATE ignora o proprio `p_pessoa_id`.
- Trigger `evitar_duplicidade_pessoa` (mesma mig.) bloqueia matricula repetida no INSERT/UPDATE respeitando owner e desconsiderando o proprio id no update.

## Regras de estoque (banco)




- status_saida: SELECT publico e triggers de validacao rodam como SECURITY DEFINER para evitar 42501 em saidas.
- SaÃ­das jÃ¡ sÃ£o bloqueadas quando excedem o saldo disponÃ­vel (`validar_saldo_saida`).

- Cancelar uma entrada Ã© vetado se o saldo remanescente ficar menor que as saÃ­das ativas (ver `supabase/migrations/0082_prevent_cancel_entrada_negative_stock.sql`).



Melhoria possivel (Estoque atual)
- Criar um RPC no Supabase para calcular o saldo por material (com corte por data fim), reduzindo trafego e CPU no frontend; deve respeitar account_owner_id/RLS.

## Requisitos



- Node.js 20+
- Projeto Supabase (Postgres + Auth + Storage)
- RBAC/RLS: veja `docs/CredenciaisPermissoes.txt` e `docs/Configuracoes.txt` para detalhes de roles/permissoes e tela de configuracoes (apenas master/admin).
- Toggles de permissao (Configuracoes): veja `docs/PermissoesToggles.txt` para o motivo dos switches em grupo e o plano de correcao.
- RLS/RPC (multi-tenant): guia consolidado em `docs/rls-multi-tenant-map.txt` e `docs/rls-policies-guide.txt`.


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

## Supabase (migrations rebuild)

Migrations de rebuild (snake_case em ingles) ficam em `supabase/migrations_rebuild/`.
Resumo e mapa de renome: `docs/migrations_rebuild_report.txt` e `docs/migrations_rebuild_rename_map.md`.
Use este conjunto somente para recriar o projeto do zero.




## Desligamento em massa (Pessoas)

Fluxo:

1) Usuario seleciona um arquivo XLSX no modal de Pessoas.

2) Front faz upload do XLSX no Storage (bucket `imports`) e chama a Edge Function `desligamento-import` passando `{ path }`.

3) A Edge Function baixa o arquivo, valida linhas, atualiza `public.pessoas`, registra `public.pessoas_historico` e remove o XLSX enviado (best-effort).

Regras:

- A planilha exige `matricula` e `data_demissao` (dd/MM/yyyy).
- `ativo` e automatico (sempre false) no desligamento em massa.
- Se a pessoa ja estiver inativa, a linha nao atualiza e entra na lista de "ja inativos".



Arquivos e docs:

- UI: `src/components/Pessoas/PessoasDesligamentoModal.jsx`

- Service: `src/services/api.js` (`api.pessoas.importDesligamentoPlanilha`)

- Edge Functions: `supabase/functions/desligamento-import` e `supabase/functions/desligamento-template`

- Bucket/policies: `supabase/migrations/0077_fix_imports_bucket.sql`

- Documentacao do fluxo: `docs/DesligamentoEmMassa.txt`

## Cadastro em massa (Pessoas)

Fluxo:

1) Usuario seleciona um arquivo XLSX no modal de Pessoas.

2) Front faz upload do XLSX no Storage (bucket `imports`) e chama a Edge Function `cadastro-import` passando `{ path, mode }` (`mode=insert` para importar ou `mode=update` para atualizar).

3) A Edge Function baixa o arquivo, valida linhas, insere/atualiza em `public.pessoas` e remove o XLSX enviado (best-effort).

Regras:

- A planilha exige `matricula`, `nome`, `centro_servico`, `setor`, `cargo`, `tipo_execucao` e `data_admissao`.
- Campos de texto sao convertidos para MAIUSCULO.
- `centro_custo` e preenchido via `centro_servico`.
- Importar: matricula ja existente (mesma familia) gera erro.
- Atualizar: matricula nao encontrada gera erro.

Arquivos e docs:

- UI: `src/components/Pessoas/PessoasCadastroMassaModal.jsx`

- Service: `src/services/api.js` (`api.pessoas.importCadastroPlanilha`)

- Edge Functions: `supabase/functions/cadastro-import` e `supabase/functions/cadastro-template`

- Bucket/policies: `supabase/migrations/0077_fix_imports_bucket.sql`

- Documentacao do fluxo: `docs/CadastroEmMassa.txt`

## Limpeza automatica de arquivos de erro (imports)

- Edge Function: `cleanup-import-errors`
- Remove arquivos `*_erros_*.csv` mais antigos que `ERRORS_RETENTION_DAYS` (padrao 7).
- Agenda via pg_cron chamando HTTP com `x-cron-secret`.
- Cron para domingo 03:00 (Brasilia) => `0 6 * * 0` (UTC).





## Modais (UI)

- Modais de confirmacao/detalhes foram separados em src/components/*/Modal (Materiais, Pessoas, Saidas, Entradas, Estoque).
- Modal de expansao de graficos: src/components/Dashboard/ChartExpandModal.jsx.
- Ajuda por pagina: src/help/help<Pagina>.json (helpContent.json removido).
