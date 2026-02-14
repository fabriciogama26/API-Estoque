# API-Estoque

Aplicacao web para gestao de EPIs e estoque integrada ao Supabase.


## Visao geral
- Problema resolvido: centralizar cadastros, movimentacoes de estoque e historicos.
- Solucao proposta: frontend React com Supabase Auth/Database/Storage e migrations versionadas.
- Contexto de uso: times de seguranca e almoxarifado em ambiente multi-tenant.


## Tecnologias
- React
- Vite
- Supabase (Auth, Database, Storage)
- Node.js
- Vercel Serverless Functions (pasta `api/`)


## Requisitos
- Node.js 20+
- npm 10+
- Projeto Supabase configurado (Auth, Database, Storage)
- Supabase CLI disponivel via `npx` para backup de functions publicadas/configs
- PostgreSQL client (pg_dump) para backup do banco


## Como rodar o projeto

### Ambiente de desenvolvimento
```bash
npm install
npm run dev
```


### Build / Producao (se aplicavel)
```bash
npm run build
npm run preview
```


## Variaveis de ambiente
Obrigatorias (frontend remoto):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_FUNCTIONS_URL`

Obrigatorias (API serverless e relatorios):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_PASSWORD_REDIRECT`
- `ERRORS_BUCKET`
- `ERRORS_RETENTION_DAYS`
- `ERRORS_CLEANUP_PAGE_SIZE`
- `CRON_SECRET`
- `BREVO_API_KEY`
- `ACIDENTES_TZ_OFFSET`
- `ENTRADAS_TZ_OFFSET`
- `PUPPETEER_BROWSERLESS_IO_KEY`
- `HCAPTCHA_SECRET`
- `HCAPTCHA_SITEKEY`

Obrigatorias (backup Supabase via `supabasebackup/backup_supabase.ps1`):
- `PROJECT_REF`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN_BACKUP`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

Opcionais / por feature:
- `VITE_DATA_MODE`
- `VITE_LOCAL_USERNAME`
- `VITE_LOCAL_PASSWORD`
- `VITE_LOCAL_DISPLAY_NAME`
- `VITE_API_URL`
- `VITE_PUBLIC_ASSETS_ORIGIN`
- `VITE_IMPORTS_BUCKET`
- `VITE_IMPORTS_MAX_MB`
- `VITE_TERMO_EPI_EMPRESA_NOME`
- `VITE_TERMO_EPI_EMPRESA_DOCUMENTO`
- `VITE_TERMO_EPI_EMPRESA_ENDERECO`
- `VITE_TERMO_EPI_EMPRESA_CONTATO`
- `VITE_TERMO_EPI_EMPRESA_LOGO_URL`
- `VITE_TERMO_EPI_EMPRESA_LOGO_SECUNDARIO_URL`
- `VITE_PASSWORD_MIN_LENGTH`
- `VITE_PASSWORD_CHECK_PWNED`
- `VITE_HCAPTCHA_ENABLED`
- `VITE_HCAPTCHA_SITEKEY`
- `VITE_HCAPTCHA_VERIFY_URL`
- `VITE_HCAPTCHA_REQUIRED_RECOVERY`
- `DATA_MODE`
- `SERVICE_NAME`
- `APP_ENV`
- `RUNTIME_ENV`
- `NODE_ENV`
- `MATERIAIS_VIEW`
- `TERMO_EPI_EMPRESA_NOME`
- `TERMO_EPI_EMPRESA_DOCUMENTO`
- `TERMO_EPI_EMPRESA_ENDERECO`
- `TERMO_EPI_EMPRESA_CONTATO`
- `TERMO_EPI_EMPRESA_LOGO_URL`
- `TERMO_EPI_EMPRESA_LOGO_SECUNDARIO_URL`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`


## Estrutura de pastas simplificada
- `api/`: funcoes serverless (Vercel).
- `docs/`: documentacao por tela e guias.
- `public/`: assets estaticos.
- `shared/`: templates e utilitarios compartilhados.
- `src/`: aplicacao React.
- `supabase/`: migrations, functions e configuracoes.
- `supabasebackup/`: scripts e artefatos de backup.


## Estrutura completa de pastas
- Excecao explicita: pastas grandes nao listadas nesta secao: `.git/`, `node_modules/`, `dist/`, `supabasebackup/`.

```text
.env.backup_supabase  # variaveis do backup Supabase (nao versionar)
.env.local  # variaveis locais do frontend (nao versionar)
.env.supabase  # variaveis locais do Supabase (nao versionar)
.gitignore  # regras de ignore do Git
AGENTS.md  # regras do Codex no repositorio
README.md  # documentacao do projeto
api/
  _shared/
    auth.js  # helper compartilhado da API serverless
    environment.js  # helper compartilhado da API serverless
    http.js  # helper compartilhado da API serverless
    localDocumentContext.js  # helper compartilhado da API serverless
    logger.js  # helper compartilhado da API serverless
    operations.js  # helper compartilhado da API serverless
    sessionActivity.js  # helper compartilhado da API serverless
    supabaseClient.js  # helper compartilhado da API serverless
    withAuth.js  # helper compartilhado da API serverless
  index.js  # handler da API serverless
docs/
  Acidentes.txt  # documentacao: Acidentes.txt
  AcidentesEmMassa.txt  # documentacao: AcidentesEmMassa.txt
  AnaliseEstoque.txt  # documentacao: AnaliseEstoque.txt
  CadastroBase.txt  # documentacao: CadastroBase.txt
  CadastroBaseEmMassa.txt  # documentacao: CadastroBaseEmMassa.txt
  CadastroEmMassa.txt  # documentacao: CadastroEmMassa.txt
  Configuracoes.txt  # documentacao: Configuracoes.txt
  CredenciaisPermissoes.txt  # documentacao: CredenciaisPermissoes.txt
  DashboardAcidentes.txt  # documentacao: DashboardAcidentes.txt
  DashboardEstoque.txt  # documentacao: DashboardEstoque.txt
  DesligamentoEmMassa.txt  # documentacao: DesligamentoEmMassa.txt
  Entradas.txt  # documentacao: Entradas.txt
  EntradasEmMassa.txt  # documentacao: EntradasEmMassa.txt
  Estoque.txt  # documentacao: Estoque.txt
  HhtMensal.txt  # documentacao: HhtMensal.txt
  Login.txt  # documentacao: Login.txt
  Materiais.txt  # documentacao: Materiais.txt
  PermissoesToggles.txt  # documentacao: PermissoesToggles.txt
  Pessoas.txt  # documentacao: Pessoas.txt
  RelatorioEstoque.txt  # documentacao: RelatorioEstoque.txt
  Saidas.txt  # documentacao: Saidas.txt
  TermosEpi.txt  # documentacao: TermosEpi.txt
  _from_tables.txt  # documentacao: _from_tables.txt
  _public_tables_columns.json  # documentacao: _public_tables_columns.json
  _rpc_calls.txt  # documentacao: _rpc_calls.txt
  ambiente-termos-epi.txt  # documentacao: ambiente-termos-epi.txt
  captcha.txt  # documentacao: captcha.txt
  data-mode-guide.txt  # documentacao: data-mode-guide.txt
  duplicidade-funcoes.txt  # documentacao: duplicidade-funcoes.txt
  duplicidade-materiais.txt  # documentacao: duplicidade-materiais.txt
  error-handling.txt  # documentacao: error-handling.txt
  estrutura-projeto.txt  # documentacao: estrutura-projeto.txt
  help-usage.txt  # documentacao: help-usage.txt
  materiais-issues.txt  # documentacao: materiais-issues.txt
  materials-button-resets.txt  # documentacao: materials-button-resets.txt
  migrations_rebuild_rename_map.md  # documentacao: migrations_rebuild_rename_map.md
  migrations_rebuild_report.txt  # documentacao: migrations_rebuild_report.txt
  rls-multi-tenant-map.txt  # documentacao: rls-multi-tenant-map.txt
  rls-policies-guide.txt  # documentacao: rls-policies-guide.txt
  stateless-supabase-notes.txt  # documentacao: stateless-supabase-notes.txt
  supabase-auth-setup.txt  # documentacao: supabase-auth-setup.txt
  supabase-esquema-checklist.txt  # documentacao: supabase-esquema-checklist.txt
  tutorial_remover_migration.txt  # documentacao: tutorial_remover_migration.txt
eslint.config.js  # configuracao do ESLint
generate_partes.jsn  # arquivo de dados do projeto
index.html  # template HTML do Vite
package-lock.json  # lockfile npm
package.json  # manifesto npm
public/
  banner.png  # asset estatico
  favicon.png  # asset estatico
  favicon2.png  # asset estatico
  logo2.png  # asset estatico
  logo_FAA.png  # asset estatico
  logo_epicontrol.png  # asset estatico
  logo_segtrab.png  # asset estatico
  parts/
    body.png  # asset estatico (partes do corpo)
    head.png  # asset estatico (partes do corpo)
    left foot.png  # asset estatico (partes do corpo)
    left leg.png  # asset estatico (partes do corpo)
    lower limbs.png  # asset estatico (partes do corpo)
    right foot.png  # asset estatico (partes do corpo)
    right leg.png  # asset estatico (partes do corpo)
  proteg.png  # asset estatico
security_front_review.txt  # documento de suporte
shared/
  documents/
    RELATÓRIO MENSAL DE ESTOQUE.txt  # template de documento
    RELATÓRIO TRIMESTRAL DE ESTOQUE (COMPARATIVO).txt  # template de documento
    epiTermTemplate.js  # template de documento compartilhado
    index.js  # template de documento compartilhado
src/
  App.jsx  # entrada da aplicacao
  app.js  # entrada da aplicacao
  components/
    Acidentes/
      AcidentesImportModal.jsx  # componente React
      Filters/
        AcidentesFilters.jsx  # componente React
      Form/
        AcidentesForm.jsx  # componente React
        AcidentesFormAgentes.jsx  # componente React
        AcidentesFormLesoes.jsx  # componente React
        AcidentesFormPartes.jsx  # componente React
        AgenteHelpButton.jsx  # componente React
      HhtMensal/
        Filters/
          HhtMensalFilters.jsx  # componente React
        Form/
          HhtMensalForm.jsx  # componente React
          ModoHelpButton.jsx  # componente React
        Modal/
          HhtMensalDeleteModal.jsx  # componente React
          HhtMensalDetailsModal.jsx  # componente React
          HhtMensalHistoryModal.jsx  # componente React
          HhtMensalHistoryTimeline.jsx  # componente React
        Table/
          HhtMensalTable.jsx  # componente React
          HhtMensalTableRow.jsx  # componente React
      Modal/
        AcidenteCancelModal.jsx  # componente React
        AcidenteDetailsModal.jsx  # componente React
        AcidenteDuplicateModal.jsx  # componente React
        AcidentesHistoryModal.jsx  # componente React
        AcidentesHistoryTimeline.jsx  # componente React
      Table/
        AcidentesTable.jsx  # componente React
        AcidentesTableRow.jsx  # componente React
    AutoResizeIframe.jsx  # componente React
    CadastroBase/
      CadastroBaseFilters.jsx  # componente React
      CadastroBaseForm.jsx  # componente React
      CadastroBaseHistoryModal.jsx  # componente React
      CadastroBaseHistoryTimeline.jsx  # componente React
      CadastroBaseImportModal.jsx  # componente React
      CadastroBaseTable.jsx  # componente React
    CaptchaGuard.jsx  # componente React
    Dashboard/
      ChartExpandModal.jsx  # componente React
    DashboardCards.jsx  # componente React
    Documents/
      TermoEpiPreviewModal.jsx  # componente React
    Entradas/
      EntradasHistoryModal.jsx  # componente React
      EntradasImportModal.jsx  # componente React
      Modal/
        EntradaCancelModal.jsx  # componente React
        EntradaDetailsModal.jsx  # componente React
    ErrorBoundary.jsx  # componente React
    Estoque/
      Alerts/
        EstoqueAlerts.jsx  # componente React
      Filters/
        EstoqueFilters.jsx  # componente React
        EstoqueMovimentacaoHelpButton.jsx  # componente React
      List/
        EstoqueList.jsx  # componente React
      Modal/
        EstoqueMinStockModal.jsx  # componente React
        EstoqueSaidaModal.jsx  # componente React
      Summary/
        EstoqueSummary.jsx  # componente React
    FiltrosDashboard.jsx  # componente React
    Help/
      HelpButton.jsx  # componente React
    Materiais/
      GrupoMaterialHelpButton.jsx  # componente React
      MateriaisActions.jsx  # componente React
      MateriaisFilters.jsx  # componente React
      MateriaisForm.jsx  # componente React
      MateriaisHistoricoTimeline.jsx  # componente React
      MateriaisHistoryModal.jsx  # componente React
      MateriaisTable.jsx  # componente React
      Modal/
        MaterialBaseDiffModal.jsx  # componente React
        MaterialDetailsModal.jsx  # componente React
    NavBar.jsx  # componente React
    PageHeader.jsx  # componente React
    Pessoas/
      Modal/
        PessoaCancelModal.jsx  # componente React
        PessoaDetailsModal.jsx  # componente React
        PessoaNomeIgualModal.jsx  # componente React
      PessoasActions.jsx  # componente React
      PessoasCadastroMassaModal.jsx  # componente React
      PessoasDesligamentoModal.jsx  # componente React
      PessoasFilters.jsx  # componente React
      PessoasForm.jsx  # componente React
      PessoasHistoryModal.jsx  # componente React
      PessoasHistoryTimeline.jsx  # componente React
      PessoasTable.jsx  # componente React
    PessoasResumoCards.jsx  # componente React
    ProtectedRoute.jsx  # componente React
    Saidas/
      Modal/
        SaidaCancelModal.jsx  # componente React
        SaidaDetailsModal.jsx  # componente React
        SaidaTrocaModal.jsx  # componente React
      SaidasHistoryModal.jsx  # componente React
    SessionReauthModal.jsx  # componente React
    SystemStatus.jsx  # componente React
    TablePagination.jsx  # componente React
    charts/
      ChartAgentes.jsx  # componente React
      ChartCargos.jsx  # componente React
      ChartLesoes.jsx  # componente React
      ChartPartesLesionadas.jsx  # componente React
      ChartTendencia.jsx  # componente React
      ChartTipos.jsx  # componente React
      EntradasSaidasChart.jsx  # componente React
      EstoqueCategoriaChart.jsx  # componente React
      EstoqueCharts.jsx  # componente React
      ForecastGastoChart.jsx  # componente React
      ParetoChart.jsx  # componente React
    icons.jsx  # componente React
  config/
    AcidentesConfig.js  # configuracoes/constantes
    HhtMensalConfig.js  # configuracoes/constantes
    MateriaisConfig.js  # configuracoes/constantes
    PessoasConfig.js  # configuracoes/constantes
    RelatorioEstoqueConfig.js  # configuracoes/constantes
    env.js  # configuracoes/constantes
    pagination.js  # configuracoes/constantes
    permissions.js  # configuracoes/constantes
    runtime.js  # configuracoes/constantes
    security.js  # configuracoes/constantes
  context/
    AcidentesContext.jsx  # contexto React
    AuthContext.jsx  # contexto React
    CadastroBaseContext.jsx  # contexto React
    DashboardAcidentesContext.jsx  # contexto React
    DashboardEstoqueContext.jsx  # contexto React
    EntradasContext.jsx  # contexto React
    EstoqueContext.jsx  # contexto React
    MateriaisContext.jsx  # contexto React
    PermissionsContext.jsx  # contexto React
    PessoasContext.jsx  # contexto React
    SaidasContext.jsx  # contexto React
  controllers/
    acidenteController.js  # controller de pagina
    authController.js  # controller de pagina
    entradaController.js  # controller de pagina
    estoqueController.js  # controller de pagina
    helpers.js  # controller de pagina
    materialController.js  # controller de pagina
    pessoaController.js  # controller de pagina
    saidaController.js  # controller de pagina
  data/
    grupos-epi.json  # dados locais/seed
    local-seed.json  # dados locais/seed
  help/
    helpAcidentes.json  # conteudo de ajuda
    helpAcidentesAgentes.json  # conteudo de ajuda
    helpAnaliseEstoque.json  # conteudo de ajuda
    helpConfiguracoes.json  # conteudo de ajuda
    helpDashboard.json  # conteudo de ajuda
    helpDashboardAcidentes.json  # conteudo de ajuda
    helpEntradas.json  # conteudo de ajuda
    helpEstoque.json  # conteudo de ajuda
    helpGrupoMaterial.json  # conteudo de ajuda
    helpHhtMensal.json  # conteudo de ajuda
    helpMateriais.json  # conteudo de ajuda
    helpPessoas.json  # conteudo de ajuda
    helpRelatorioEstoque.json  # conteudo de ajuda
    helpSaidas.json  # conteudo de ajuda
    helpTermoEpi.json  # conteudo de ajuda
  hooks/
    useAcidenteFiltro.js  # hook de estado/efeitos
    useAcidenteForm.js  # hook de estado/efeitos
    useAcidentes.js  # hook de estado/efeitos
    useAgentes.js  # hook de estado/efeitos
    useCadastroBaseController.js  # hook de estado/efeitos
    useChangePassword.js  # hook de estado/efeitos
    useDashboardAcidentes.js  # hook de estado/efeitos
    useDashboardEstoque.js  # hook de estado/efeitos
    useEntradasController.js  # hook de estado/efeitos
    useErrorLogger.js  # hook de estado/efeitos
    useEstoque.js  # hook de estado/efeitos
    useEstoqueFiltro.js  # hook de estado/efeitos
    useHistoryPagination.js  # hook de estado/efeitos
    useLocais.js  # hook de estado/efeitos
    useLoginForm.js  # hook de estado/efeitos
    useMateriaisController.js  # hook de estado/efeitos
    usePartes.js  # hook de estado/efeitos
    usePessoas.js  # hook de estado/efeitos
    usePessoasController.js  # hook de estado/efeitos
    useRelatorioEstoque.js  # hook de estado/efeitos
    useResetPassword.js  # hook de estado/efeitos
    useSaidasController.js  # hook de estado/efeitos
    useTermoEpi.js  # hook de estado/efeitos
  layouts/
    MainLayout.jsx  # layout React
  lib/
    acidentesDashboard.js  # biblioteca de regras de negocio
    estoque.js  # biblioteca de regras de negocio
  main.jsx  # entrada da aplicacao
  models/
    Acidente.js  # modelos/DTOs
    EntradaMaterial.js  # modelos/DTOs
    Material.js  # modelos/DTOs
    Pessoa.js  # modelos/DTOs
    PrecoHistorico.js  # modelos/DTOs
    SaidaMaterial.js  # modelos/DTOs
    index.js  # modelos/DTOs
  pages/
    Acidentes.jsx  # pagina React
    AnaliseEstoquePage.jsx  # pagina React
    CadastroBase.jsx  # pagina React
    Configuracoes.jsx  # pagina React
    DashboardAcidentes.jsx  # pagina React
    DashboardPage.jsx  # pagina React
    EntradasPage.jsx  # pagina React
    EstoquePage.jsx  # pagina React
    HhtMensalAcidentes.jsx  # pagina React
    LoginPage.jsx  # pagina React
    Materiais.jsx  # pagina React
    NoAccessPage.jsx  # pagina React
    Pessoas.jsx  # pagina React
    RelatorioEstoque.jsx  # pagina React
    ResetPasswordPage.jsx  # pagina React
    SaidasPage.jsx  # pagina React
    TermosEpiPage.jsx  # pagina React
  repositories/
    AcidenteRepository.js  # arquivo do projeto
    BaseRepository.js  # arquivo do projeto
    EntradaRepository.js  # arquivo do projeto
    MaterialRepository.js  # arquivo do projeto
    PessoaRepository.js  # arquivo do projeto
    PrecoHistoricoRepository.js  # arquivo do projeto
    SaidaRepository.js  # arquivo do projeto
    index.js  # arquivo do projeto
  routes/
    acidenteRoutes.js  # definicao de rotas
    authRoutes.js  # definicao de rotas
    entradaRoutes.js  # definicao de rotas
    estoqueRoutes.js  # definicao de rotas
    index.js  # definicao de rotas
    materialRoutes.js  # definicao de rotas
    pessoaRoutes.js  # definicao de rotas
    rules/
      AcidentesRules.js  # regras/validacoes
      MateriaisRules.js  # regras/validacoes
      PessoasRules.js  # regras/validacoes
      acidenteRules.js  # regras/validacoes
      entradaRules.js  # regras/validacoes
      estoqueRules.js  # regras/validacoes
      index.js  # regras/validacoes
      materialRules.js  # regras/validacoes
      pessoaFilters.js  # regras/validacoes
      pessoaRules.js  # regras/validacoes
      saidaRules.js  # regras/validacoes
    saidaRoutes.js  # definicao de rotas
  services/
    acidentesService.js  # service frontend (API/data client)
    api.js  # service frontend (API/data client)
    authService.js  # service frontend (API/data client)
    basicRegistrationService.js  # service frontend (API/data client)
    captchaService.js  # service frontend (API/data client)
    dashboardAcidentesApi.js  # service frontend (API/data client)
    dashboardEstoqueApi.js  # service frontend (API/data client)
    dataClient.js  # service frontend (API/data client)
    effectiveUserService.js  # service frontend (API/data client)
    entradasService.js  # service frontend (API/data client)
    errorLogService.js  # service frontend (API/data client)
    estoqueApi.js  # service frontend (API/data client)
    hhtMensalService.js  # service frontend (API/data client)
    index.js  # service frontend (API/data client)
    localApi.js  # service frontend (API/data client)
    localDataStore.js  # service frontend (API/data client)
    materiaisService.js  # service frontend (API/data client)
    passwordPolicyService.js  # service frontend (API/data client)
    pessoasService.js  # service frontend (API/data client)
    relatorioEstoqueApi.js  # service frontend (API/data client)
    saidasService.js  # service frontend (API/data client)
    server/
      AcidenteService.js  # service backend (Node)
      EntradaService.js  # service backend (Node)
      EstoqueService.js  # service backend (Node)
      MaterialService.js  # service backend (Node)
      PessoaService.js  # service backend (Node)
      SaidaService.js  # service backend (Node)
    sessionService.js  # service frontend (API/data client)
    supabaseClient.js  # service frontend (API/data client)
    termoEpiService.js  # service frontend (API/data client)
  styles/
    AcidentesPage.css  # estilos
    AcidentesTableStatus.css  # estilos
    CadastroBasePage.css  # estilos
    ConfiguracoesPage.css  # estilos
    DashboardPage.css  # estilos
    DocumentPreviewModal.css  # estilos
    EstoquePage.css  # estilos
    LoginPage.css  # estilos
    MateriaisPage.css  # estilos
    Pagination.css  # estilos
    PessoasPage.css  # estilos
    ResetPasswordPage.css  # estilos
    SessionReauthModal.css  # estilos
    SystemStatus.css  # estilos
    base.css  # estilos
    charts.css  # estilos
    help.css  # estilos
    index.css  # estilos
    layout.css  # estilos
    variables.css  # estilos
  utils/
    MateriaisUtils.js  # utilitario
    RelatorioEstoquePdfUtils.js  # utilitario
    TermoEpiUtils.js  # utilitario
    acidentesExport.js  # utilitario
    acidentesUtils.js  # utilitario
    clipboard.js  # utilitario
    dashboardAcidentesUtils.js  # utilitario
    dashboardEstoqueUtils.js  # utilitario
    entradasExport.js  # utilitario
    entradasUtils.js  # utilitario
    estoqueUtils.js  # utilitario
    hhtMensalUtils.js  # utilitario
    indicadores.js  # utilitario
    inventoryReportUtils.js  # utilitario
    passwordPolicy.js  # utilitario
    pessoasUtils.js  # utilitario
    saidasExport.js  # utilitario
    saidasUtils.js  # utilitario
    selectionUtils.js  # utilitario
supabase/
  .gitignore  # regras de ignore do Supabase
  .temp/
    cli-latest  # metadados locais da CLI
    gotrue-version  # metadados locais da CLI
    pooler-url  # metadados locais da CLI
    postgres-version  # metadados locais da CLI
    project-ref  # metadados locais da CLI
    rest-version  # metadados locais da CLI
    storage-migration  # metadados locais da CLI
    storage-version  # metadados locais da CLI
  README.md  # documentacao do Supabase
  Scheme.sql  # snapshot de schema (referencia)
  config.toml  # configuracao do Supabase CLI
  functions/
    acidente-import/
      index.ts  # edge function (Supabase)
    acidente-template/
      index.ts  # edge function (Supabase)
    cadastro-base-import/
      index.ts  # edge function (Supabase)
    cadastro-base-template/
      index.ts  # edge function (Supabase)
    cadastro-import/
      index.ts  # edge function (Supabase)
    cadastro-template/
      index.ts  # edge function (Supabase)
    cleanup-import-errors/
      index.ts  # edge function (Supabase)
      para_test.txt  # arquivo da edge function
    desligamento-import/
      index.ts  # edge function (Supabase)
    desligamento-template/
      index.ts  # edge function (Supabase)
    entrada-import/
      index.ts  # edge function (Supabase)
    entrada-template/
      index.ts  # edge function (Supabase)
    forecast-gasto-mensal/
      index.ts  # edge function (Supabase)
    import_map.json  # import map das edge functions
    request-password-reset/
      index.ts  # edge function (Supabase)
    termo-epi/
      index.ts  # edge function (Supabase)
    verify-captcha/
      index.ts  # edge function (Supabase)
  migrations/
    0001_create_schema.sql  # migration SQL
    0002_enable_rls.sql  # migration SQL
    0003_seed_sample_data.sql  # migration SQL
    0004_update_schema_supabase.sql  # migration SQL
    0005_add_material_group_fields.sql  # migration SQL
    0006_add_missing_person_accident_fields.sql  # migration SQL
    0007_rename_centro_columns.sql  # migration SQL
    0008_update_centros.sql  # migration SQL
    0009_allow_authenticated_writes.sql  # migration SQL
    0010_add_setor_to_pessoas.sql  # migration SQL
    0011_create_reference_tables.sql  # migration SQL
    0012_create_grupos_material_itens.sql  # migration SQL
    0013_rls_reference_tables.sql  # migration SQL
    0014_create_acidente_agentes_tipos.sql  # migration SQL
    0015_create_acidente_partes.sql  # migration SQL
    0016_create_acidente_lesoes.sql  # migration SQL
    0017_alter_acidente_lesoes.sql  # migration SQL
    0018_create_centro_custo_table.sql  # migration SQL
    0019_create_reference_tables_people.sql  # migration SQL
    0020_link_pessoas_reference_tables.sql  # migration SQL
    0021_update_pessoas_reference_links.sql  # migration SQL
    0022_drop_tipoExecucao_column.sql  # migration SQL
    0023_create_acidente_historico.sql  # migration SQL
    0024_acidente_historico_policies.sql  # migration SQL
    0025_create_pessoas_historico.sql  # migration SQL
    0026_allow_authenticated_materials_write.sql  # migration SQL
    0027_expand_material_history.sql  # migration SQL
    0028_create_materiais_view.sql  # migration SQL
    0029_drop_chaveunica_from_materiais.sql  # migration SQL
    0030_update_entrada_historico.sql  # migration SQL
    0031_create_materials_uniqueness.sql  # migration SQL
    0032_create_entradas_material_view.sql  # migration SQL
    0033_update_pessoas_view.sql  # migration SQL
    0034_add_acidente_esocial_sesmt.sql  # migration SQL
    0035_set_data_troca_trigger.sql  # migration SQL
    0036_add_data_sesmt.sql  # migration SQL
    0037_update_acidentes_esocial_sesmt.sql  # migration SQL
    0038_fix_data_troca_trigger.sql  # migration SQL
    0039_prevent_saida_negative_stock.sql  # migration SQL
    0040_fix_validar_saldo_saida.sql  # migration SQL
    0041_create_rpc_saida_historico.sql  # migration SQL
    0042_restore_data_sesmt.sql  # migration SQL
    0043_create_rpc_pessoas_completa.sql  # migration SQL
    0044_rpc_completa.sql  # migration SQL
    0045_create_vw_indicadores_acidentes.sql  # migration SQL
    0046_create_acidentes_filters_rpc.sql  # migration SQL
    0047_add_ativo_to_pessoas.sql  # migration SQL
    0048_pessoas_users_uuid.sql  # migration SQL
    0049_update_rpc_pessoas_completa.sql  # migration SQL
    0050_create_pessoas_resumo_rpc.sql  # migration SQL
    0051_fix_vw_indicadores_acidentes_tendencia.sql  # migration SQL
    0052_create_app_errors.sql  # migration SQL
    0053_update_materiais_view_add_username.sql  # migration SQL
    0054_recreate_entradas_material_view.sql  # migration SQL
    0055_fix_materiais_view_username_priority.sql  # migration SQL
    0056_refresh_entradas_material_view.sql  # migration SQL
    0057_update_materiais_dedup_layers.sql  # migration SQL
    0058_update_pessoas_view_add_username.sql  # migration SQL
    0059_add_centro_estoque_to_entradas_material_view.sql  # migration SQL
    0060_fix_saida_historico.sql  # migration SQL
    0061_update_saida_historico_rpc.sql  # migration SQL
    0062_add_app_users_credentials.sql  # migration SQL
    0063_create_app_users_credential_history.sql  # migration SQL
    0064_add_active_history_columns.sql  # migration SQL
    0065_add_action_column_history.sql  # migration SQL
    0066_create_planos_users.sql  # migration SQL
    0067_update_app_users_with_plans.sql  # migration SQL
    0068_create_api_errors.sql  # migration SQL
    0068_create_app_users_dependentes.sql  # migration SQL
    0069_add_status_columns_entradas.sql  # migration SQL
    0069_fix_admin_policies_app_users.sql  # migration SQL
    0070_add_action_to_credential_history.sql  # migration SQL
    0071_fix_rls_performance.sql  # migration SQL
    0072_add_missing_fk_indexes.sql  # migration SQL
    0073_fix_performance_warnings.sql  # migration SQL
    0074_add_auth_target_to_credential_history.sql  # migration SQL
    0075_add_data_demissao_to_pessoas.sql  # migration SQL
    0076_create_imports_bucket.sql  # migration SQL
    0077_fix_imports_bucket.sql  # migration SQL
    0078_create_hht_mensal.sql  # migration SQL
    0079_create_rpc_pessoas_count_centro.sql  # migration SQL
    0080_create_status_hht.sql  # migration SQL
    0081_migrate_hht_status_fk.sql  # migration SQL
    0082_prevent_cancel_entrada_negative_stock.sql  # migration SQL
    0091_user_roles_manage_policy.sql  # migration SQL
    0092_rbac_manage_and_master_clean.sql  # migration SQL
    0093_rbac_manage_master_scope.sql  # migration SQL
    0094_rbac_manage_guard_owner.sql  # migration SQL
    0095_app_users_select_policy.sql  # migration SQL
    20250101_security_rpc_rls.sql  # migration SQL
    20250102_owner_scope.sql  # migration SQL
    20250103_account_owner_policies.sql  # migration SQL
    20250104_logs_catalogs_rls.sql  # migration SQL
    20250105_revert_catalog_owner_cols.sql  # migration SQL
    20250106_backfill_account_owner.sql  # migration SQL
    20250107_owner_fk_and_public_tables.sql  # migration SQL
    20250108_enforce_material_ca_unique.sql  # migration SQL
    20250109_adjust_materials_dedup.sql  # migration SQL
    20250110_required_fields.sql  # migration SQL
    20250111_material_preflight.sql  # migration SQL
    20250112_base_ca_diff_update.sql  # migration SQL
    20250113_add_cancel_to_acidentes.sql  # migration SQL
    20250113_make_acidentes_hht_nullable.sql  # migration SQL
    20250113_update_vw_indicadores_acidentes_hht_join.sql  # migration SQL
    20250113_use_ativo_flag_acidentes.sql  # migration SQL
    20250114_force_inativo_on_demissao.sql  # migration SQL
    20250114_pessoas_preflight.sql  # migration SQL
    20250127_rls_owner_master_core.sql  # migration SQL
    20250127_rls_owner_master_materiais_saidas.sql  # migration SQL
    20250128_material_relations_owner.sql  # migration SQL
    20250129_material_create_full_rpc.sql  # migration SQL
    20250130_material_update_full_rpc.sql  # migration SQL
    20250131_saidas_status_rls.sql  # migration SQL
    20250201_rpc_saida_verificar_troca.sql  # migration SQL
    20250202_fix_rpc_saida_verificar_troca_overload.sql  # migration SQL
    20250202_fix_saidas_rls_permissions.sql  # migration SQL
    20250202_sync_master_user_roles.sql  # migration SQL
    20250203_cleanup_tenant_rls_policies.sql  # migration SQL
    20250203_pessoas_ensure_item_owner.sql  # migration SQL
    20250203_tenant_owner_strict.sql  # migration SQL
    20250204_tenant_rls_hard_reset.sql  # migration SQL
    20250205_catalog_public_select_only.sql  # migration SQL
    20250206_catalog_select_no_ativo.sql  # migration SQL
    20250207_secure_internal_tables.sql  # migration SQL
    20250208_add_current_actor_is_master.sql  # migration SQL
    20250209_fix_catalog_select_owner.sql  # migration SQL
    20250210_fix_my_owner_id.sql  # migration SQL
    20250211_catalog_rpc.sql  # migration SQL
    20250212_pessoas_rpc_full.sql  # migration SQL
    20250212_saidas_rpc_full.sql  # migration SQL
    20250213_acidentes_rpc_full.sql  # migration SQL
    20250213_entradas_rpc_full.sql  # migration SQL
    20250215_rls_internal_tables_reset.sql  # migration SQL
    20250216_tenant_rls_solid.sql  # migration SQL
    20250217_hht_mensal_rpc_full.sql  # migration SQL
    20250218_configuracoes_rbac_policies.sql  # migration SQL
    20250218_fix_acidentes_registrado_por.sql  # migration SQL
    20250218_fix_entradas_remove_valor_unitario.sql  # migration SQL
    20250218_fix_material_ca_rules.sql  # migration SQL
    20250218_fix_material_update_full_rpc.sql  # migration SQL
    20250218_fix_rpc_saida_verificar_troca_owner.sql  # migration SQL
    20250218_fix_saidas_troca_sequencia.sql  # migration SQL
    20250218_update_rpc_admin_write_credential_history.sql  # migration SQL
    20260131_backfill_basic_registration_user_ids.sql  # migration SQL
    20260131_basic_registration_base.sql  # migration SQL
    20260131_basic_registration_history_ignore_insert.sql  # migration SQL
    20260131_basic_registration_user_names.sql  # migration SQL
    20260131_drop_ordem_basic_registration.sql  # migration SQL
    20260131_fix_basic_registration_history_definer.sql  # migration SQL
    20260131_fix_basic_registration_history_owner.sql  # migration SQL
    20260131_fix_basic_registration_history_rls.sql  # migration SQL
    20260201_allow_ca_repeat_diff_base.sql  # migration SQL
    20260201_create_inventory_report.sql  # migration SQL
    20260202_add_inventory_report_pdf_fields.sql  # migration SQL
    20260202_create_inventory_report_full.sql  # migration SQL
    20260203_create_inventory_forecast.sql  # migration SQL
    20260204_add_rpc_previsao_gasto_periodo.sql  # migration SQL
    20260204_add_updated_at_forecast.sql  # migration SQL
    20260204_basic_registration_history_definer.sql  # migration SQL
    20260204_create_gasto_forecast_tables.sql  # migration SQL
    20260204_fix_basic_registration_history_policy.sql  # migration SQL
    20260204_fix_rpc_previsao_gasto_base_fim.sql  # migration SQL
    20260204_fix_rpc_refresh_gasto_mensal.sql  # migration SQL
    20260206_add_diagnostico_estatisticas_mensais.sql  # migration SQL
    20260206_add_forecast_id_to_previsao.sql  # migration SQL
    20260206_add_previsao_entrada.sql  # migration SQL
    20260206_add_stats_previsao_mensal.sql  # migration SQL
    20260206_remove_fator_tendencia_previsao.sql  # migration SQL
    20260211_accidents_import_hash.sql  # migration SQL
    20260211_allow_duplicate_cid_accidents.sql  # migration SQL
    20260211_auth_session_activity.sql  # migration SQL
    20260211_fix_accidents_import_hash_rpc.sql  # migration SQL
    20260213_add_auth_session_activity_columns.sql  # migration SQL
    20260213_auth_session_activity_active_index.sql  # migration SQL
    20260219_refactor_acidentes_to_accidents.sql  # migration SQL
    20260220_update_vw_indicadores_acidentes_accidents.sql  # migration SQL
    20260221_fix_accident_group_and_pessoas_view.sql  # migration SQL
    20260222_relax_tipos_lesoes_accidents.sql  # migration SQL
    20260223_fix_trigger_set_owner_accident_relacionado.sql  # migration SQL
    20260224_update_vw_acidentes_users.sql  # migration SQL
    20260225_update_rpc_acidentes_mult_agents.sql  # migration SQL
    20260225_update_vw_acidentes_mult_agents.sql  # migration SQL
    20260226_fix_trigger_set_owner_accident_relacionado_safe.sql  # migration SQL
    20260227_accidents_unique_cat_cid.sql  # migration SQL
    20260228_register_missing_tables.sql  # migration SQL
    20260301_fix_rpc_acidentes_import_hash.sql  # migration SQL
    20260302_fix_acidentes_cid_update_hash.sql  # migration SQL
    20260303_fix_acidentes_rehash_digest.sql  # migration SQL
    20260304_fix_acidentes_rehash_search_path.sql  # migration SQL
  migrations_rebuild/
    0001_extensions.sql  # migration rebuild SQL
    0002_tables.sql  # migration rebuild SQL
    0003_constraints.sql  # migration rebuild SQL
    0004_indexes.sql  # migration rebuild SQL
    0005_functions.sql  # migration rebuild SQL
    0006_triggers.sql  # migration rebuild SQL
    0007_views.sql  # migration rebuild SQL
    0008_rls.sql  # migration rebuild SQL
    0009_storage.sql  # migration rebuild SQL
    0010_seed_core.sql  # migration rebuild SQL
temp_readme.txt  # documento de suporte
vercel.json  # configuracao de deploy (Vercel)
vite.config.js  # configuracao do Vite
```


## Fluxo principal (happy path)
- Autenticar no Supabase e carregar contexto do usuario.
- Cadastrar catalogos base (grupos, fabricantes, cores, caracteristicas, medidas).
- Cadastrar materiais e pessoas.
- Registrar entradas para compor saldo.
- Registrar saidas e acompanhar historico.
- Exportar lista de materiais em CSV quando necessario.
- Consultar dashboards e gerar relatorios mensais/trimestrais quando necessario.
- Gerar termo de EPI quando aplicavel.


## Testes
- Nao existem testes automatizados.


## Troubleshooting
- Erro de RLS (42501): conferir `account_owner_id`, roles/permissions e policies do schema.
- Erro de auth/URL: validar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Edge function nao encontrada: validar `VITE_SUPABASE_FUNCTIONS_URL` e deploy das functions.
- Relatorio nao enviado: validar `BREVO_API_KEY` e destinatarios admin/master.
- Relatorio automatico nao executa: validar `CRON_SECRET` e a rota `/api/estoque/relatorio/auto`.
- Nenhuma movimentacao encontrada: revisar filtros e periodo do relatorio.


## Status do projeto
🟡 Em desenvolvimento


## Licenca
- Nao definida no repositorio.
