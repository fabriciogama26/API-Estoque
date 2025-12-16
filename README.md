# API-Estoque

AplicaÇõÇœo React para gestÇœo de EPIs e estoque integrada ao Supabase, com modo local opcional para testes.

## Notas rapidas de uso

- Pessoas, Entradas, Saidas, Estoque e Dashboard de Estoque aplicam filtros somente ao clicar em **Aplicar/Limpar** (sem refiltro automatico em memoria). Cliques em graficos do dashboard aplicam o termo imediatamente.
- Materiais (EPI) carrega a lista e recalcula os filtros apenas ao clicar em **Aplicar**; nao filtra a cada tecla.
- Acidentes: campos de texto/select aplicam apenas com **Aplicar**; checkboxes (Apenas SESMT / eSOCIAL) sao imediatos. Filtros adicionais para Lesoes e Partes lesionadas estao disponiveis.
- Cadastro de Acidentes: campo Matricula agora e autocomplete (busca por matricula ou nome, sugere resultados e preenche nome/cargo/centro/local ao selecionar), igual ao campo Pessoa na tela de Registrar saida.
- Saidas: autocomplete de Material aceita nome/descricao/ID/CA (centro de estoque obrigatório), mostra CA na lista e o campo "Em estoque" ficou destacado (sem linha extra de saldo/min/valor); filtro de Status envia o id do status_saida quando disponível e o backend aceita nome/UUID (evita erro "invalid input syntax for type uuid").
- Ajuda contextual disponivel em cada pagina (botao **Ajuda**) e em `docs/` para fluxos detalhados.
- Campos marcados com `*` sao obrigatorios em todos os formularios.

Para detalhes completos de cada tela, consulte a pasta `docs/` e `src/help/helpContent.json`.

### Migrations recentes (Supabase)
- `0072_add_missing_fk_indexes`: cobre as FKs sinalizadas pelo lint 0001 e evita criação duplicada de _fkcov_.
- `0073_fix_performance_warnings`: remove indices _fkcov_* redundantes, cria o índice faltante `app_users_credential_fkey_idx` e consolida policies de `app_credentials_catalog` (SELECT para authenticated; ALL para service_role).
- `0074_add_auth_target_to_credential_history`: adiciona target_auth_user_id (login titular ou dependente) e campos auxiliares para relacionar históricos de dependentes ao titular.
- Rode `supabase db push` no projeto remoto ou `supabase db reset` no stack local para aplicar.
- Warnings atuais do linter são apenas `unused_index` (INFO). Veja `performance.md` para decidir se dropa.

### MigraÇõÇœo nova (status/entradas)
- Criada a tabela `status_entrada` (ids fixos para `REGISTRADO` e `CANCELADO`) e adicionadas as colunas `status`, `usuario_edicao`, `atualizado_em` em `entradas` com FK/default.
- Rode as migraÇõÇœes do Supabase: `supabase db push` (ou o comando do seu pipeline). Em dev local, `supabase db reset --schema public` também aplica tudo.
- Dados antigos ficam com status `REGISTRADO` (id `82f86834-5b97-4bf0-9801-1372b6d1bd37`).
- A tela de Entradas agora permite filtrar por status e exibe usuário/horário de edição nos detalhes e histórico.
### Captcha (hCaptcha) e redefinição de senha
- Login não usa captcha (Attack Protection do Supabase desativada). O captcha só aparece na página de redefinição de senha.
- Widget usa as envs: `VITE_HCAPTCHA_ENABLED`, `VITE_HCAPTCHA_SITEKEY`, `VITE_HCAPTCHA_VERIFY_URL` (frontend) e a função `verify-captcha` no Supabase (envs `HCAPTCHA_SECRET` e opcional `HCAPTCHA_SITEKEY`).
- Em produção (Vercel), defina as envs acima e cadastre domínios permitidos no painel do hCaptcha (ex.: `proteg.vercel.app`; dev: `localhost`, `127.0.0.1`).
- Se o login exibir captcha, verifique se o painel do Supabase (Authentication → Attack Protection) está desativado ou se o deploy está usando build antiga.

### Tratamento de erros
- Backend: logs vão para `api_errors` via `logApiError` (`api/_shared/logger.js`). `src/app.js` gera `requestId`, registra erros no middleware global e só loga requisições lentas (>= `SLOW_REQUEST_THRESHOLD_MS`, padrão 2000 ms) que não sejam 5xx. `handleError` (`api/_shared/http.js`) envia method/path/status/user/stack/context para o Supabase.
- Frontend: erros vão para `app_errors` via `useErrorLogger`/`logError`/`reportClientError` (contexts, serviços, controllers, SystemStatus). `ErrorBoundaryWithLogger` em `src/App.jsx` captura erros de renderização.
- Variáveis úteis: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENV`/`SERVICE_NAME`, `SLOW_REQUEST_THRESHOLD_MS`. Consulte `docs/error-handling.txt` para detalhes.
### Novo modelo de credenciais/dependentes (Supabase)
- app_credentials_catalog usa id UUID + id_text e agora tem coluna `level` (hierarquia: master>admin>operador>estagiario>visitante); policies de leitura/escrita usam `level <= level_do_usuario` e service_role segue liberado.
- app_users.credential e app_users_dependentes.credential usam o UUID do catalogo; dependentes herdam do titular quando vazio.
- app_users_credential_history registra before/after de credential/pages/action para titulares **e dependentes**; inclui target_auth_user_id (login do alvo) e owner_app_user_id/target_dependent_id para dependentes; RLS apenas para authenticated/service_role.
- Policies de RLS foram simplificadas (sem recursao) e consideram o level da credencial para ocultar master quando o usuario logado nao for master.
- Rode as migrations recentes (0063/0068/0069/0070) no Supabase (supabase db push) antes de usar o frontend.
- Tela de Configuracoes: autocomplete busca titulares e dependentes; master enxerga/edita tudo, admins veem apenas niveis <= admin; botao Restaurar padrao removido; reset de senha continua no bloco admin/master.
