# API-Estoque

Aplicacao React (Vite) para gestao de EPIs e estoque integrada ao Supabase.

---

## Visao geral
- Problema resolvido: controlar cadastro, entradas, saidas e acidentes com dados centralizados.
- Solucao proposta: interface web com operacoes de estoque e integracao com Supabase.
- Contexto de uso: times de seguranca e almoxarifado em operacao multi-tenant.

---

## Tecnologias
- React
- Vite
- Supabase (Auth, Database, Storage)
- Vercel Serverless Functions (pasta `api`)
- Node.js

---

## Requisitos
- Node.js 20+
- Projeto Supabase configurado (Postgres, Auth, Storage)
- Variaveis de ambiente definidas

---

## Como rodar o projeto

### Ambiente de desenvolvimento

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173`.

---

### Build / Producao

```bash
npm run build
npm run preview
```

---

## Variaveis de ambiente

Obrigatorias:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_FUNCTIONS_URL`

Opcionais:
- `VITE_IMPORTS_BUCKET`

---

## Estrutura de pastas
Visao resumida e fiel da organizacao do projeto.

- `api/`: funcoes serverless (Vercel).
- `docs/`: documentacao por tela e guias tecnicos.
- `public/`: assets estaticos.
- `src/`: aplicacao React.
- `src/services/`: services do frontend.
- `src/services/server/`: services do backend usados por controllers.
- `supabase/`: migrations e edge functions.
- `shared/`: recursos compartilhados.
- `dist/`: build de producao.

---

### Estrutura completa
Visao completa de cada arquivo.

- `api/`:
  - `api/_shared/auth.js`: helper compartilhado da API serverless.
  - `api/_shared/environment.js`: helper compartilhado da API serverless.
  - `api/_shared/http.js`: helper compartilhado da API serverless.
  - `api/_shared/localDocumentContext.js`: helper compartilhado da API serverless.
  - `api/_shared/logger.js`: helper compartilhado da API serverless.
  - `api/_shared/operations.js`: helper compartilhado da API serverless.
  - `api/_shared/supabaseClient.js`: helper compartilhado da API serverless.
  - `api/_shared/withAuth.js`: helper compartilhado da API serverless.
  - `api/index.js`: handler principal da API serverless.

- `docs/`:
  - `docs/Acidentes.txt`: documentacao: Acidentes.
  - `docs/AcidentesEmMassa.txt`: documentacao: AcidentesEmMassa.
  - `docs/CadastroEmMassa.txt`: documentacao: CadastroEmMassa.
  - `docs/Configuracoes.txt`: documentacao: Configuracoes.
  - `docs/CredenciaisPermissoes.txt`: documentacao: CredenciaisPermissoes.
  - `docs/DashboardAcidentes.txt`: documentacao: DashboardAcidentes.
  - `docs/DashboardEstoque.txt`: documentacao: DashboardEstoque.
  - `docs/DesligamentoEmMassa.txt`: documentacao: DesligamentoEmMassa.
  - `docs/Entradas.txt`: documentacao: Entradas.
  - `docs/Estoque.txt`: documentacao: Estoque.
  - `docs/HhtMensal.txt`: documentacao: HhtMensal.
  - `docs/Login.txt`: documentacao: Login.
  - `docs/Materiais.txt`: documentacao: Materiais.
  - `docs/PermissoesToggles.txt`: documentacao: PermissoesToggles.
  - `docs/Pessoas.txt`: documentacao: Pessoas.
  - `docs/Saidas.txt`: documentacao: Saidas.
  - `docs/TermosEpi.txt`: documentacao: TermosEpi.
  - `docs/_from_tables.txt`: documentacao: _from_tables.
  - `docs/_public_tables_columns.json`: documentacao: _public_tables_columns.
  - `docs/_rpc_calls.txt`: documentacao: _rpc_calls.
  - `docs/ambiente-termos-epi.txt`: documentacao: ambiente-termos-epi.
  - `docs/captcha.txt`: documentacao: captcha.
  - `docs/data-mode-guide.txt`: documentacao: data-mode-guide.
  - `docs/duplicidade-funcoes.txt`: documentacao: duplicidade-funcoes.
  - `docs/duplicidade-materiais.txt`: documentacao: duplicidade-materiais.
  - `docs/error-handling.txt`: documentacao: error-handling.
  - `docs/estrutura-projeto.txt`: documentacao: estrutura-projeto.
  - `docs/help-usage.txt`: documentacao: help-usage.
  - `docs/materiais-issues.txt`: documentacao: materiais-issues.
  - `docs/materials-button-resets.txt`: documentacao: materials-button-resets.
  - `docs/migrations_rebuild_rename_map.md`: documentacao: migrations_rebuild_rename_map.
  - `docs/migrations_rebuild_report.txt`: documentacao: migrations_rebuild_report.
  - `docs/rls-multi-tenant-map.txt`: documentacao: rls-multi-tenant-map.
  - `docs/rls-policies-guide.txt`: documentacao: rls-policies-guide.
  - `docs/stateless-supabase-notes.txt`: documentacao: stateless-supabase-notes.
  - `docs/supabase-auth-setup.txt`: documentacao: supabase-auth-setup.
  - `docs/supabase-esquema-checklist.txt`: documentacao: supabase-esquema-checklist.
  - `docs/tutorial_remover_migration.txt`: documentacao: tutorial_remover_migration.

- `public/`:
  - `public/banner.png`: imagem estatica.
  - `public/favicon.png`: imagem estatica.
  - `public/favicon2.png`: imagem estatica.
  - `public/logo2.png`: imagem estatica.
  - `public/logo_FAA.png`: imagem estatica.
  - `public/logo_epicontrol.png`: imagem estatica.
  - `public/logo_segtrab.png`: imagem estatica.
  - `public/parts/body.png`: imagem estatica.
  - `public/parts/head.png`: imagem estatica.
  - `public/parts/left foot.png`: imagem estatica.
  - `public/parts/left leg.png`: imagem estatica.
  - `public/parts/lower limbs.png`: imagem estatica.
  - `public/parts/right foot.png`: imagem estatica.
  - `public/parts/right leg.png`: imagem estatica.
  - `public/proteg.png`: imagem estatica.

- `src/`:
  - `src/App.jsx`: componente raiz do React.
  - `src/app.js`: app Express com middlewares e rotas de API.
  - `src/components/Acidentes/AcidentesImportModal.jsx`: componente React.
  - `src/components/Acidentes/Filters/AcidentesFilters.jsx`: componente React.
  - `src/components/Acidentes/Form/AcidentesForm.jsx`: componente React.
  - `src/components/Acidentes/Form/AcidentesFormAgentes.jsx`: componente React.
  - `src/components/Acidentes/Form/AcidentesFormLesoes.jsx`: componente React.
  - `src/components/Acidentes/Form/AcidentesFormPartes.jsx`: componente React.
  - `src/components/Acidentes/Form/AgenteHelpButton.jsx`: componente React.
  - `src/components/Acidentes/HhtMensal/Filters/HhtMensalFilters.jsx`: componente React.
  - `src/components/Acidentes/HhtMensal/Form/HhtMensalForm.jsx`: componente React.
  - `src/components/Acidentes/HhtMensal/Form/ModoHelpButton.jsx`: componente React.
  - `src/components/Acidentes/HhtMensal/Modal/HhtMensalDeleteModal.jsx`: componente React.
  - `src/components/Acidentes/HhtMensal/Modal/HhtMensalDetailsModal.jsx`: componente React.
  - `src/components/Acidentes/HhtMensal/Modal/HhtMensalHistoryModal.jsx`: componente React.
  - `src/components/Acidentes/HhtMensal/Modal/HhtMensalHistoryTimeline.jsx`: componente React.
  - `src/components/Acidentes/HhtMensal/Table/HhtMensalTable.jsx`: componente React.
  - `src/components/Acidentes/HhtMensal/Table/HhtMensalTableRow.jsx`: componente React.
  - `src/components/Acidentes/Modal/AcidenteCancelModal.jsx`: componente React.
  - `src/components/Acidentes/Modal/AcidenteDetailsModal.jsx`: componente React.
  - `src/components/Acidentes/Modal/AcidentesHistoryModal.jsx`: componente React.
  - `src/components/Acidentes/Modal/AcidentesHistoryTimeline.jsx`: componente React.
  - `src/components/Acidentes/Table/AcidentesTable.jsx`: componente React.
  - `src/components/Acidentes/Table/AcidentesTableRow.jsx`: componente React.
  - `src/components/AutoResizeIframe.jsx`: componente React.
  - `src/components/CaptchaGuard.jsx`: componente React.
  - `src/components/Dashboard/ChartExpandModal.jsx`: componente React.
  - `src/components/DashboardCards.jsx`: componente React.
  - `src/components/Documents/TermoEpiPreviewModal.jsx`: componente React.
  - `src/components/Entradas/EntradasHistoryModal.jsx`: componente React.
  - `src/components/Entradas/Modal/EntradaCancelModal.jsx`: componente React.
  - `src/components/Entradas/Modal/EntradaDetailsModal.jsx`: componente React.
  - `src/components/ErrorBoundary.jsx`: componente React.
  - `src/components/Estoque/Alerts/EstoqueAlerts.jsx`: componente React.
  - `src/components/Estoque/Filters/EstoqueFilters.jsx`: componente React.
  - `src/components/Estoque/List/EstoqueList.jsx`: componente React.
  - `src/components/Estoque/Modal/EstoqueMinStockModal.jsx`: componente React.
  - `src/components/Estoque/Modal/EstoqueSaidaModal.jsx`: componente React.
  - `src/components/Estoque/Summary/EstoqueSummary.jsx`: componente React.
  - `src/components/FiltrosDashboard.jsx`: componente React.
  - `src/components/Help/HelpButton.jsx`: componente React.
  - `src/components/Materiais/GrupoMaterialHelpButton.jsx`: componente React.
  - `src/components/Materiais/MateriaisActions.jsx`: componente React.
  - `src/components/Materiais/MateriaisFilters.jsx`: componente React.
  - `src/components/Materiais/MateriaisForm.jsx`: componente React.
  - `src/components/Materiais/MateriaisHistoricoTimeline.jsx`: componente React.
  - `src/components/Materiais/MateriaisHistoryModal.jsx`: componente React.
  - `src/components/Materiais/MateriaisTable.jsx`: componente React.
  - `src/components/Materiais/Modal/MaterialBaseDiffModal.jsx`: componente React.
  - `src/components/Materiais/Modal/MaterialDetailsModal.jsx`: componente React.
  - `src/components/NavBar.jsx`: componente React.
  - `src/components/PageHeader.jsx`: componente React.
  - `src/components/Pessoas/Modal/PessoaCancelModal.jsx`: componente React.
  - `src/components/Pessoas/Modal/PessoaDetailsModal.jsx`: componente React.
  - `src/components/Pessoas/Modal/PessoaNomeIgualModal.jsx`: componente React.
  - `src/components/Pessoas/PessoasActions.jsx`: componente React.
  - `src/components/Pessoas/PessoasCadastroMassaModal.jsx`: componente React.
  - `src/components/Pessoas/PessoasDesligamentoModal.jsx`: componente React.
  - `src/components/Pessoas/PessoasFilters.jsx`: componente React.
  - `src/components/Pessoas/PessoasForm.jsx`: componente React.
  - `src/components/Pessoas/PessoasHistoryModal.jsx`: componente React.
  - `src/components/Pessoas/PessoasHistoryTimeline.jsx`: componente React.
  - `src/components/Pessoas/PessoasTable.jsx`: componente React.
  - `src/components/PessoasResumoCards.jsx`: componente React.
  - `src/components/ProtectedRoute.jsx`: componente React.
  - `src/components/Saidas/Modal/SaidaCancelModal.jsx`: componente React.
  - `src/components/Saidas/Modal/SaidaDetailsModal.jsx`: componente React.
  - `src/components/Saidas/Modal/SaidaTrocaModal.jsx`: componente React.
  - `src/components/Saidas/SaidasHistoryModal.jsx`: componente React.
  - `src/components/SystemStatus.jsx`: componente React.
  - `src/components/TablePagination.jsx`: componente React.
  - `src/components/charts/ChartAgentes.jsx`: componente React.
  - `src/components/charts/ChartCargos.jsx`: componente React.
  - `src/components/charts/ChartLesoes.jsx`: componente React.
  - `src/components/charts/ChartPartesLesionadas.jsx`: componente React.
  - `src/components/charts/ChartTendencia.jsx`: componente React.
  - `src/components/charts/ChartTipos.jsx`: componente React.
  - `src/components/charts/EntradasSaidasChart.jsx`: componente React.
  - `src/components/charts/EstoqueCategoriaChart.jsx`: componente React.
  - `src/components/charts/EstoqueCharts.jsx`: componente React.
  - `src/components/icons.jsx`: componente React.
  - `src/config/AcidentesConfig.js`: configuracoes.
  - `src/config/HhtMensalConfig.js`: configuracoes.
  - `src/config/MateriaisConfig.js`: configuracoes.
  - `src/config/PessoasConfig.js`: configuracoes.
  - `src/config/env.js`: configuracoes.
  - `src/config/pagination.js`: configuracoes.
  - `src/config/permissions.js`: configuracoes.
  - `src/config/runtime.js`: configuracoes.
  - `src/config/security.js`: configuracoes.
  - `src/context/AcidentesContext.jsx`: contexto React.
  - `src/context/AuthContext.jsx`: contexto React.
  - `src/context/DashboardAcidentesContext.jsx`: contexto React.
  - `src/context/DashboardEstoqueContext.jsx`: contexto React.
  - `src/context/EntradasContext.jsx`: contexto React.
  - `src/context/EstoqueContext.jsx`: contexto React.
  - `src/context/MateriaisContext.jsx`: contexto React.
  - `src/context/PermissionsContext.jsx`: contexto React.
  - `src/context/PessoasContext.jsx`: contexto React.
  - `src/context/SaidasContext.jsx`: contexto React.
  - `src/controllers/acidenteController.js`: controller da API.
  - `src/controllers/authController.js`: controller da API.
  - `src/controllers/entradaController.js`: controller da API.
  - `src/controllers/estoqueController.js`: controller da API.
  - `src/controllers/helpers.js`: controller da API.
  - `src/controllers/materialController.js`: controller da API.
  - `src/controllers/pessoaController.js`: controller da API.
  - `src/controllers/saidaController.js`: controller da API.
  - `src/data/grupos-epi.json`: dados/seed.
  - `src/data/local-seed.json`: dados/seed.
  - `src/help/helpAcidentes.json`: conteudo de ajuda.
  - `src/help/helpAcidentesAgentes.json`: conteudo de ajuda.
  - `src/help/helpConfiguracoes.json`: conteudo de ajuda.
  - `src/help/helpDashboard.json`: conteudo de ajuda.
  - `src/help/helpDashboardAcidentes.json`: conteudo de ajuda.
  - `src/help/helpEntradas.json`: conteudo de ajuda.
  - `src/help/helpEstoque.json`: conteudo de ajuda.
  - `src/help/helpGrupoMaterial.json`: conteudo de ajuda.
  - `src/help/helpHhtMensal.json`: conteudo de ajuda.
  - `src/help/helpMateriais.json`: conteudo de ajuda.
  - `src/help/helpPessoas.json`: conteudo de ajuda.
  - `src/help/helpSaidas.json`: conteudo de ajuda.
  - `src/help/helpTermoEpi.json`: conteudo de ajuda.
  - `src/hooks/useAcidenteFiltro.js`: hook React.
  - `src/hooks/useAcidenteForm.js`: hook React.
  - `src/hooks/useAcidentes.js`: hook React.
  - `src/hooks/useAgentes.js`: hook React.
  - `src/hooks/useChangePassword.js`: hook React.
  - `src/hooks/useDashboardAcidentes.js`: hook React.
  - `src/hooks/useDashboardEstoque.js`: hook React.
  - `src/hooks/useEntradasController.js`: hook React.
  - `src/hooks/useErrorLogger.js`: hook React.
  - `src/hooks/useEstoque.js`: hook React.
  - `src/hooks/useEstoqueFiltro.js`: hook React.
  - `src/hooks/useHistoryPagination.js`: hook React.
  - `src/hooks/useLocais.js`: hook React.
  - `src/hooks/useLoginForm.js`: hook React.
  - `src/hooks/useMateriaisController.js`: hook React.
  - `src/hooks/usePartes.js`: hook React.
  - `src/hooks/usePessoas.js`: hook React.
  - `src/hooks/usePessoasController.js`: hook React.
  - `src/hooks/useResetPassword.js`: hook React.
  - `src/hooks/useSaidasController.js`: hook React.
  - `src/hooks/useTermoEpi.js`: hook React.
  - `src/layouts/MainLayout.jsx`: layout da aplicacao.
  - `src/lib/acidentesDashboard.js`: helpers de negocio.
  - `src/lib/estoque.js`: helpers de negocio.
  - `src/main.jsx`: bootstrap do React/Vite.
  - `src/models/Acidente.js`: modelo de dominio.
  - `src/models/EntradaMaterial.js`: modelo de dominio.
  - `src/models/Material.js`: modelo de dominio.
  - `src/models/Pessoa.js`: modelo de dominio.
  - `src/models/PrecoHistorico.js`: modelo de dominio.
  - `src/models/SaidaMaterial.js`: modelo de dominio.
  - `src/models/index.js`: export de modelos.
  - `src/pages/Acidentes.jsx`: pagina React.
  - `src/pages/Configuracoes.jsx`: pagina React.
  - `src/pages/DashboardAcidentes.jsx`: pagina React.
  - `src/pages/DashboardPage.jsx`: pagina React.
  - `src/pages/EntradasPage.jsx`: pagina React.
  - `src/pages/EstoquePage.jsx`: pagina React.
  - `src/pages/HhtMensalAcidentes.jsx`: pagina React.
  - `src/pages/LoginPage.jsx`: pagina React.
  - `src/pages/Materiais.jsx`: pagina React.
  - `src/pages/NoAccessPage.jsx`: pagina React.
  - `src/pages/Pessoas.jsx`: pagina React.
  - `src/pages/ResetPasswordPage.jsx`: pagina React.
  - `src/pages/SaidasPage.jsx`: pagina React.
  - `src/pages/TermosEpiPage.jsx`: pagina React.
  - `src/repositories/AcidenteRepository.js`: repositorio de dados.
  - `src/repositories/BaseRepository.js`: repositorio de dados.
  - `src/repositories/EntradaRepository.js`: repositorio de dados.
  - `src/repositories/MaterialRepository.js`: repositorio de dados.
  - `src/repositories/PessoaRepository.js`: repositorio de dados.
  - `src/repositories/PrecoHistoricoRepository.js`: repositorio de dados.
  - `src/repositories/SaidaRepository.js`: repositorio de dados.
  - `src/repositories/index.js`: export de repositorios.
  - `src/routes/acidenteRoutes.js`: rotas da API.
  - `src/routes/authRoutes.js`: rotas da API.
  - `src/routes/entradaRoutes.js`: rotas da API.
  - `src/routes/estoqueRoutes.js`: rotas da API.
  - `src/routes/index.js`: agregador de rotas.
  - `src/routes/materialRoutes.js`: rotas da API.
  - `src/routes/pessoaRoutes.js`: rotas da API.
  - `src/routes/saidaRoutes.js`: rotas da API.
  - `src/rules/AcidentesRules.js`: regras e validacoes.
  - `src/rules/MateriaisRules.js`: regras e validacoes.
  - `src/rules/PessoasRules.js`: regras e validacoes.
  - `src/rules/acidenteRules.js`: regras e validacoes.
  - `src/rules/entradaRules.js`: regras e validacoes.
  - `src/rules/estoqueRules.js`: regras e validacoes.
  - `src/rules/index.js`: export de regras.
  - `src/rules/materialRules.js`: regras e validacoes.
  - `src/rules/pessoaFilters.js`: regras e validacoes.
  - `src/rules/pessoaRules.js`: regras e validacoes.
  - `src/rules/saidaRules.js`: regras e validacoes.
  - `src/services/acidentesService.js`: service do frontend.
  - `src/services/api.js`: service do frontend.
  - `src/services/authService.js`: service do frontend.
  - `src/services/captchaService.js`: service do frontend.
  - `src/services/dashboardAcidentesApi.js`: service do frontend.
  - `src/services/dashboardEstoqueApi.js`: service do frontend.
  - `src/services/dataClient.js`: service do frontend.
  - `src/services/effectiveUserService.js`: service do frontend.
  - `src/services/entradasService.js`: service do frontend.
  - `src/services/errorLogService.js`: service do frontend.
  - `src/services/estoqueApi.js`: service do frontend.
  - `src/services/hhtMensalService.js`: service do frontend.
  - `src/services/index.js`: agregador de services backend.
  - `src/services/localApi.js`: service do frontend.
  - `src/services/localDataStore.js`: service do frontend.
  - `src/services/materiaisService.js`: service do frontend.
  - `src/services/passwordPolicyService.js`: service do frontend.
  - `src/services/pessoasService.js`: service do frontend.
  - `src/services/saidasService.js`: service do frontend.
  - `src/services/server/AcidenteService.js`: service de negocio (backend).
  - `src/services/server/EntradaService.js`: service de negocio (backend).
  - `src/services/server/EstoqueService.js`: service de negocio (backend).
  - `src/services/server/MaterialService.js`: service de negocio (backend).
  - `src/services/server/PessoaService.js`: service de negocio (backend).
  - `src/services/server/SaidaService.js`: service de negocio (backend).
  - `src/services/supabaseClient.js`: service do frontend.
  - `src/services/termoEpiService.js`: service do frontend.
  - `src/styles/AcidentesPage.css`: estilos CSS.
  - `src/styles/AcidentesTableStatus.css`: estilos CSS.
  - `src/styles/ConfiguracoesPage.css`: estilos CSS.
  - `src/styles/DashboardPage.css`: estilos CSS.
  - `src/styles/DocumentPreviewModal.css`: estilos CSS.
  - `src/styles/EstoquePage.css`: estilos CSS.
  - `src/styles/LoginPage.css`: estilos CSS.
  - `src/styles/MateriaisPage.css`: estilos CSS.
  - `src/styles/Pagination.css`: estilos CSS.
  - `src/styles/PessoasPage.css`: estilos CSS.
  - `src/styles/ResetPasswordPage.css`: estilos CSS.
  - `src/styles/SystemStatus.css`: estilos CSS.
  - `src/styles/base.css`: estilos CSS.
  - `src/styles/charts.css`: estilos CSS.
  - `src/styles/help.css`: estilos CSS.
  - `src/styles/index.css`: estilos CSS.
  - `src/styles/layout.css`: estilos CSS.
  - `src/styles/variables.css`: estilos CSS.
  - `src/utils/MateriaisUtils.js`: utilitarios.
  - `src/utils/TermoEpiUtils.js`: utilitarios.
  - `src/utils/acidentesUtils.js`: utilitarios.
  - `src/utils/dashboardAcidentesUtils.js`: utilitarios.
  - `src/utils/dashboardEstoqueUtils.js`: utilitarios.
  - `src/utils/entradasUtils.js`: utilitarios.
  - `src/utils/estoqueUtils.js`: utilitarios.
  - `src/utils/hhtMensalUtils.js`: utilitarios.
  - `src/utils/indicadores.js`: utilitarios.
  - `src/utils/passwordPolicy.js`: utilitarios.
  - `src/utils/pessoasUtils.js`: utilitarios.
  - `src/utils/saidasUtils.js`: utilitarios.
  - `src/utils/selectionUtils.js`: utilitarios.

- `shared/`:
  - `shared/documents/epiTermTemplate.js`: arquivo compartilhado.
  - `shared/documents/index.js`: arquivo compartilhado.

- `supabase/`:
  - `supabase/.gitignore`: ignore do ambiente Supabase local.
  - `supabase/.temp/cli-latest`: cache local do Supabase CLI.
  - `supabase/.temp/gotrue-version`: cache local do Supabase CLI.
  - `supabase/.temp/pooler-url`: cache local do Supabase CLI.
  - `supabase/.temp/postgres-version`: cache local do Supabase CLI.
  - `supabase/.temp/project-ref`: cache local do Supabase CLI.
  - `supabase/.temp/rest-version`: cache local do Supabase CLI.
  - `supabase/.temp/storage-migration`: cache local do Supabase CLI.
  - `supabase/.temp/storage-version`: cache local do Supabase CLI.
  - `supabase/README.md`: guia do projeto Supabase.
  - `supabase/Scheme.sql`: snapshot do schema do banco.
  - `supabase/config.toml`: configuracao do Supabase CLI.
  - `supabase/functions/acidente-import/index.ts`: Edge Function.
  - `supabase/functions/acidente-template/index.ts`: Edge Function.
  - `supabase/functions/cadastro-import/index.ts`: Edge Function.
  - `supabase/functions/cadastro-template/index.ts`: Edge Function.
  - `supabase/functions/cleanup-import-errors/index.ts`: Edge Function.
  - `supabase/functions/desligamento-import/index.ts`: Edge Function.
  - `supabase/functions/desligamento-template/index.ts`: Edge Function.
  - `supabase/functions/import_map.json`: import map das Edge Functions.
  - `supabase/functions/request-password-reset/index.ts`: Edge Function.
  - `supabase/functions/termo-epi/index.ts`: Edge Function.
  - `supabase/functions/verify-captcha/index.ts`: Edge Function.
  - `supabase/migrations/0001_create_schema.sql`: migration SQL.
  - `supabase/migrations/0002_enable_rls.sql`: migration SQL.
  - `supabase/migrations/0003_seed_sample_data.sql`: migration SQL.
  - `supabase/migrations/0004_update_schema_supabase.sql`: migration SQL.
  - `supabase/migrations/0005_add_material_group_fields.sql`: migration SQL.
  - `supabase/migrations/0006_add_missing_person_accident_fields.sql`: migration SQL.
  - `supabase/migrations/0007_rename_centro_columns.sql`: migration SQL.
  - `supabase/migrations/0008_update_centros.sql`: migration SQL.
  - `supabase/migrations/0009_allow_authenticated_writes.sql`: migration SQL.
  - `supabase/migrations/0010_add_setor_to_pessoas.sql`: migration SQL.
  - `supabase/migrations/0011_create_reference_tables.sql`: migration SQL.
  - `supabase/migrations/0012_create_grupos_material_itens.sql`: migration SQL.
  - `supabase/migrations/0013_rls_reference_tables.sql`: migration SQL.
  - `supabase/migrations/0014_create_acidente_agentes_tipos.sql`: migration SQL.
  - `supabase/migrations/0015_create_acidente_partes.sql`: migration SQL.
  - `supabase/migrations/0016_create_acidente_lesoes.sql`: migration SQL.
  - `supabase/migrations/0017_alter_acidente_lesoes.sql`: migration SQL.
  - `supabase/migrations/0018_create_centro_custo_table.sql`: migration SQL.
  - `supabase/migrations/0019_create_reference_tables_people.sql`: migration SQL.
  - `supabase/migrations/0020_link_pessoas_reference_tables.sql`: migration SQL.
  - `supabase/migrations/0021_update_pessoas_reference_links.sql`: migration SQL.
  - `supabase/migrations/0022_drop_tipoExecucao_column.sql`: migration SQL.
  - `supabase/migrations/0023_create_acidente_historico.sql`: migration SQL.
  - `supabase/migrations/0024_acidente_historico_policies.sql`: migration SQL.
  - `supabase/migrations/0025_create_pessoas_historico.sql`: migration SQL.
  - `supabase/migrations/0026_allow_authenticated_materials_write.sql`: migration SQL.
  - `supabase/migrations/0027_expand_material_history.sql`: migration SQL.
  - `supabase/migrations/0028_create_materiais_view.sql`: migration SQL.
  - `supabase/migrations/0029_drop_chaveunica_from_materiais.sql`: migration SQL.
  - `supabase/migrations/0030_update_entrada_historico.sql`: migration SQL.
  - `supabase/migrations/0031_create_materials_uniqueness.sql`: migration SQL.
  - `supabase/migrations/0032_create_entradas_material_view.sql`: migration SQL.
  - `supabase/migrations/0033_update_pessoas_view.sql`: migration SQL.
  - `supabase/migrations/0034_add_acidente_esocial_sesmt.sql`: migration SQL.
  - `supabase/migrations/0035_set_data_troca_trigger.sql`: migration SQL.
  - `supabase/migrations/0036_add_data_sesmt.sql`: migration SQL.
  - `supabase/migrations/0037_update_acidentes_esocial_sesmt.sql`: migration SQL.
  - `supabase/migrations/0038_fix_data_troca_trigger.sql`: migration SQL.
  - `supabase/migrations/0039_prevent_saida_negative_stock.sql`: migration SQL.
  - `supabase/migrations/0040_fix_validar_saldo_saida.sql`: migration SQL.
  - `supabase/migrations/0041_create_rpc_saida_historico.sql`: migration SQL.
  - `supabase/migrations/0042_restore_data_sesmt.sql`: migration SQL.
  - `supabase/migrations/0043_create_rpc_pessoas_completa.sql`: migration SQL.
  - `supabase/migrations/0044_rpc_completa.sql`: migration SQL.
  - `supabase/migrations/0045_create_vw_indicadores_acidentes.sql`: migration SQL.
  - `supabase/migrations/0046_create_acidentes_filters_rpc.sql`: migration SQL.
  - `supabase/migrations/0047_add_ativo_to_pessoas.sql`: migration SQL.
  - `supabase/migrations/0048_pessoas_users_uuid.sql`: migration SQL.
  - `supabase/migrations/0049_update_rpc_pessoas_completa.sql`: migration SQL.
  - `supabase/migrations/0050_create_pessoas_resumo_rpc.sql`: migration SQL.
  - `supabase/migrations/0051_fix_vw_indicadores_acidentes_tendencia.sql`: migration SQL.
  - `supabase/migrations/0052_create_app_errors.sql`: migration SQL.
  - `supabase/migrations/0053_update_materiais_view_add_username.sql`: migration SQL.
  - `supabase/migrations/0054_recreate_entradas_material_view.sql`: migration SQL.
  - `supabase/migrations/0055_fix_materiais_view_username_priority.sql`: migration SQL.
  - `supabase/migrations/0056_refresh_entradas_material_view.sql`: migration SQL.
  - `supabase/migrations/0057_update_materiais_dedup_layers.sql`: migration SQL.
  - `supabase/migrations/0058_update_pessoas_view_add_username.sql`: migration SQL.
  - `supabase/migrations/0059_add_centro_estoque_to_entradas_material_view.sql`: migration SQL.
  - `supabase/migrations/0060_fix_saida_historico.sql`: migration SQL.
  - `supabase/migrations/0061_update_saida_historico_rpc.sql`: migration SQL.
  - `supabase/migrations/0062_add_app_users_credentials.sql`: migration SQL.
  - `supabase/migrations/0063_create_app_users_credential_history.sql`: migration SQL.
  - `supabase/migrations/0064_add_active_history_columns.sql`: migration SQL.
  - `supabase/migrations/0065_add_action_column_history.sql`: migration SQL.
  - `supabase/migrations/0066_create_planos_users.sql`: migration SQL.
  - `supabase/migrations/0067_update_app_users_with_plans.sql`: migration SQL.
  - `supabase/migrations/0068_create_api_errors.sql`: migration SQL.
  - `supabase/migrations/0068_create_app_users_dependentes.sql`: migration SQL.
  - `supabase/migrations/0069_add_status_columns_entradas.sql`: migration SQL.
  - `supabase/migrations/0069_fix_admin_policies_app_users.sql`: migration SQL.
  - `supabase/migrations/0070_add_action_to_credential_history.sql`: migration SQL.
  - `supabase/migrations/0071_fix_rls_performance.sql`: migration SQL.
  - `supabase/migrations/0072_add_missing_fk_indexes.sql`: migration SQL.
  - `supabase/migrations/0073_fix_performance_warnings.sql`: migration SQL.
  - `supabase/migrations/0074_add_auth_target_to_credential_history.sql`: migration SQL.
  - `supabase/migrations/0075_add_data_demissao_to_pessoas.sql`: migration SQL.
  - `supabase/migrations/0076_create_imports_bucket.sql`: migration SQL.
  - `supabase/migrations/0077_fix_imports_bucket.sql`: migration SQL.
  - `supabase/migrations/0078_create_hht_mensal.sql`: migration SQL.
  - `supabase/migrations/0079_create_rpc_pessoas_count_centro.sql`: migration SQL.
  - `supabase/migrations/0080_create_status_hht.sql`: migration SQL.
  - `supabase/migrations/0081_migrate_hht_status_fk.sql`: migration SQL.
  - `supabase/migrations/0082_prevent_cancel_entrada_negative_stock.sql`: migration SQL.
  - `supabase/migrations/0091_user_roles_manage_policy.sql`: migration SQL.
  - `supabase/migrations/0092_rbac_manage_and_master_clean.sql`: migration SQL.
  - `supabase/migrations/0093_rbac_manage_master_scope.sql`: migration SQL.
  - `supabase/migrations/0094_rbac_manage_guard_owner.sql`: migration SQL.
  - `supabase/migrations/0095_app_users_select_policy.sql`: migration SQL.
  - `supabase/migrations/20250101_security_rpc_rls.sql`: migration SQL.
  - `supabase/migrations/20250102_owner_scope.sql`: migration SQL.
  - `supabase/migrations/20250103_account_owner_policies.sql`: migration SQL.
  - `supabase/migrations/20250104_logs_catalogs_rls.sql`: migration SQL.
  - `supabase/migrations/20250105_revert_catalog_owner_cols.sql`: migration SQL.
  - `supabase/migrations/20250106_backfill_account_owner.sql`: migration SQL.
  - `supabase/migrations/20250107_owner_fk_and_public_tables.sql`: migration SQL.
  - `supabase/migrations/20250108_enforce_material_ca_unique.sql`: migration SQL.
  - `supabase/migrations/20250109_adjust_materials_dedup.sql`: migration SQL.
  - `supabase/migrations/20250110_required_fields.sql`: migration SQL.
  - `supabase/migrations/20250111_material_preflight.sql`: migration SQL.
  - `supabase/migrations/20250112_base_ca_diff_update.sql`: migration SQL.
  - `supabase/migrations/20250113_add_cancel_to_acidentes.sql`: migration SQL.
  - `supabase/migrations/20250113_make_acidentes_hht_nullable.sql`: migration SQL.
  - `supabase/migrations/20250113_update_vw_indicadores_acidentes_hht_join.sql`: migration SQL.
  - `supabase/migrations/20250113_use_ativo_flag_acidentes.sql`: migration SQL.
  - `supabase/migrations/20250114_force_inativo_on_demissao.sql`: migration SQL.
  - `supabase/migrations/20250114_pessoas_preflight.sql`: migration SQL.
  - `supabase/migrations/20250127_rls_owner_master_core.sql`: migration SQL.
  - `supabase/migrations/20250127_rls_owner_master_materiais_saidas.sql`: migration SQL.
  - `supabase/migrations/20250128_material_relations_owner.sql`: migration SQL.
  - `supabase/migrations/20250129_material_create_full_rpc.sql`: migration SQL.
  - `supabase/migrations/20250130_material_update_full_rpc.sql`: migration SQL.
  - `supabase/migrations/20250131_saidas_status_rls.sql`: migration SQL.
  - `supabase/migrations/20250201_rpc_saida_verificar_troca.sql`: migration SQL.
  - `supabase/migrations/20250202_fix_rpc_saida_verificar_troca_overload.sql`: migration SQL.
  - `supabase/migrations/20250202_fix_saidas_rls_permissions.sql`: migration SQL.
  - `supabase/migrations/20250202_sync_master_user_roles.sql`: migration SQL.
  - `supabase/migrations/20250203_cleanup_tenant_rls_policies.sql`: migration SQL.
  - `supabase/migrations/20250203_pessoas_ensure_item_owner.sql`: migration SQL.
  - `supabase/migrations/20250203_tenant_owner_strict.sql`: migration SQL.
  - `supabase/migrations/20250204_tenant_rls_hard_reset.sql`: migration SQL.
  - `supabase/migrations/20250205_catalog_public_select_only.sql`: migration SQL.
  - `supabase/migrations/20250206_catalog_select_no_ativo.sql`: migration SQL.
  - `supabase/migrations/20250207_secure_internal_tables.sql`: migration SQL.
  - `supabase/migrations/20250208_add_current_actor_is_master.sql`: migration SQL.
  - `supabase/migrations/20250209_fix_catalog_select_owner.sql`: migration SQL.
  - `supabase/migrations/20250210_fix_my_owner_id.sql`: migration SQL.
  - `supabase/migrations/20250211_catalog_rpc.sql`: migration SQL.
  - `supabase/migrations/20250212_pessoas_rpc_full.sql`: migration SQL.
  - `supabase/migrations/20250212_saidas_rpc_full.sql`: migration SQL.
  - `supabase/migrations/20250213_acidentes_rpc_full.sql`: migration SQL.
  - `supabase/migrations/20250213_entradas_rpc_full.sql`: migration SQL.
  - `supabase/migrations/20250215_rls_internal_tables_reset.sql`: migration SQL.
  - `supabase/migrations/20250216_tenant_rls_solid.sql`: migration SQL.
  - `supabase/migrations/20250217_hht_mensal_rpc_full.sql`: migration SQL.
  - `supabase/migrations/20250218_configuracoes_rbac_policies.sql`: migration SQL.
  - `supabase/migrations/20250218_fix_acidentes_registrado_por.sql`: migration SQL.
  - `supabase/migrations/20250218_fix_entradas_remove_valor_unitario.sql`: migration SQL.
  - `supabase/migrations/20250218_fix_material_ca_rules.sql`: migration SQL.
  - `supabase/migrations/20250218_fix_material_update_full_rpc.sql`: migration SQL.
  - `supabase/migrations/20250218_fix_rpc_saida_verificar_troca_owner.sql`: migration SQL.
  - `supabase/migrations/20250218_fix_saidas_troca_sequencia.sql`: migration SQL.
  - `supabase/migrations/20250218_update_rpc_admin_write_credential_history.sql`: migration SQL.
  - `supabase/migrations/20260219_refactor_acidentes_to_accidents.sql`: migration SQL.
  - `supabase/migrations/20260220_update_vw_indicadores_acidentes_accidents.sql`: migration SQL.
  - `supabase/migrations/20260221_fix_accident_group_and_pessoas_view.sql`: migration SQL.
  - `supabase/migrations/20260222_relax_tipos_lesoes_accidents.sql`: migration SQL.
  - `supabase/migrations/20260223_fix_trigger_set_owner_accident_relacionado.sql`: migration SQL.
  - `supabase/migrations/20260224_update_vw_acidentes_users.sql`: migration SQL.
  - `supabase/migrations/20260225_update_rpc_acidentes_mult_agents.sql`: migration SQL.
  - `supabase/migrations/20260225_update_vw_acidentes_mult_agents.sql`: migration SQL.
  - `supabase/migrations/20260226_fix_trigger_set_owner_accident_relacionado_safe.sql`: migration SQL.
  - `supabase/migrations/20260227_accidents_unique_cat_cid.sql`: migration SQL.
  - `supabase/migrations_rebuild/0001_extensions.sql`: migration rebuild SQL.
  - `supabase/migrations_rebuild/0002_tables.sql`: migration rebuild SQL.
  - `supabase/migrations_rebuild/0003_constraints.sql`: migration rebuild SQL.
  - `supabase/migrations_rebuild/0004_indexes.sql`: migration rebuild SQL.
  - `supabase/migrations_rebuild/0005_functions.sql`: migration rebuild SQL.
  - `supabase/migrations_rebuild/0006_triggers.sql`: migration rebuild SQL.
  - `supabase/migrations_rebuild/0007_views.sql`: migration rebuild SQL.
  - `supabase/migrations_rebuild/0008_rls.sql`: migration rebuild SQL.
  - `supabase/migrations_rebuild/0009_storage.sql`: migration rebuild SQL.
  - `supabase/migrations_rebuild/0010_seed_core.sql`: migration rebuild SQL.

- `dist/`:
  - `dist/assets/index-D1_whnZC.css`: bundle CSS do build.
  - `dist/assets/index-DiEA8phu.js`: bundle JS do build.
  - `dist/banner.png`: imagem gerada no build.
  - `dist/favicon.png`: imagem gerada no build.
  - `dist/favicon2.png`: imagem gerada no build.
  - `dist/index.html`: HTML gerado pelo build.
  - `dist/logo2.png`: imagem gerada no build.
  - `dist/logo_FAA.png`: imagem gerada no build.
  - `dist/logo_epicontrol.png`: imagem gerada no build.
  - `dist/logo_segtrab.png`: imagem gerada no build.
  - `dist/proteg.png`: imagem gerada no build.


---

## Fluxo principal
- Usuario acessa e autentica no sistema.
- Consulta o estoque atual e dashboards.
- Registra entradas e saidas.
- Registra acidentes e consulta historicos.

---

## Testes
- Nao existem testes automatizados no projeto.

---

## Troubleshooting
- Erro: "Supabase nao configurado". Causa: variaveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ausentes. Solucao: definir no `.env.local` e reiniciar o dev server.
- Erro: "require is not defined" no ESLint. Causa: lint configurado para browser/ESM. Solucao: ajustar o ESLint para ignorar `src/services/server` ou criar configuracao Node separada.

---

## Status do projeto
- 🟡 Em desenvolvimento

---

## Licenca
- Sem licenca definida

---
