# API-Estoque

AplicaÇõÇœo React para gestÇœo de EPIs e estoque integrada ao Supabase, com modo local opcional para testes.

## Notas rapidas de uso

- Pessoas, Entradas, Saidas, Estoque e Dashboard de Estoque aplicam filtros somente ao clicar em **Aplicar/Limpar** (sem refiltro automatico em memoria). Cliques em graficos do dashboard aplicam o termo imediatamente.
- Materiais (EPI) carrega a lista e recalcula os filtros apenas ao clicar em **Aplicar**; nao filtra a cada tecla.
- Acidentes: campos de texto/select aplicam apenas com **Aplicar**; checkboxes (Apenas SESMT / eSOCIAL) sao imediatos. Filtros adicionais para Lesoes e Partes lesionadas estao disponiveis.
- Cadastro de Acidentes: campo Matricula agora e autocomplete (busca por matricula ou nome, sugere resultados e preenche nome/cargo/centro/local ao selecionar), igual ao campo Pessoa na tela de Registrar saida.
- Ajuda contextual disponivel em cada pagina (botao **Ajuda**) e em `docs/` para fluxos detalhados.
- Campos marcados com `*` sao obrigatorios em todos os formularios.

Para detalhes completos de cada tela, consulte a pasta `docs/` e `src/help/helpContent.json`.
### Captcha (hCaptcha) e redefinição de senha
- Login não usa captcha (Attack Protection do Supabase desativada). O captcha só aparece na página de redefinição de senha.
- Widget usa as envs: `VITE_HCAPTCHA_ENABLED`, `VITE_HCAPTCHA_SITEKEY`, `VITE_HCAPTCHA_VERIFY_URL` (frontend) e a função `verify-captcha` no Supabase (envs `HCAPTCHA_SECRET` e opcional `HCAPTCHA_SITEKEY`).
- Em produção (Vercel), defina as envs acima e cadastre domínios permitidos no painel do hCaptcha (ex.: `proteg.vercel.app`; dev: `localhost`, `127.0.0.1`).
- Se o login exibir captcha, verifique se o painel do Supabase (Authentication → Attack Protection) está desativado ou se o deploy está usando build antiga.

### Tratamento de erros
- Backend: logs vão para `api_errors` via `logApiError` (`api/_shared/logger.js`). `src/app.js` gera `requestId`, registra erros no middleware global e só loga requisições lentas (>= `SLOW_REQUEST_THRESHOLD_MS`, padrão 2000 ms) que não sejam 5xx. `handleError` (`api/_shared/http.js`) envia method/path/status/user/stack/context para o Supabase.
- Frontend: erros vão para `app_errors` via `useErrorLogger`/`logError`/`reportClientError` (contexts, serviços, controllers, SystemStatus). `ErrorBoundaryWithLogger` em `src/App.jsx` captura erros de renderização.
- Variáveis úteis: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENV`/`SERVICE_NAME`, `SLOW_REQUEST_THRESHOLD_MS`. Consulte `docs/error-handling.txt` para detalhes.


