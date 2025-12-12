# API-Estoque

AplicaÇõÇœo React para gestÇœo de EPIs e estoque integrada ao Supabase, com modo local opcional para testes.

## Notas rápidas de uso

- Pessoas, Entradas, Saídas e Estoque aplicam filtros somente ao clicar em **Aplicar/Limpar** (sem refiltro automático em memória).
- Materiais (EPI) carrega a lista e recalcula os filtros apenas ao clicar em **Aplicar**; não filtra a cada tecla.
- Ajuda contextual disponível em cada página (botão **Ajuda**) e em `docs/` para fluxos detalhados.
- Campos marcados com `*` sao obrigatorios em todos os formularios.

Para detalhes completos de cada tela, consulte a pasta `docs/` e `src/help/helpContent.json`.

### Tratamento de erros
- Backend: logs vão para `api_errors` via `logApiError` (`api/_shared/logger.js`). `src/app.js` gera `requestId`, registra erros no middleware global e só loga requisições lentas (>= `SLOW_REQUEST_THRESHOLD_MS`, padrão 2000 ms) que não sejam 5xx. `handleError` (`api/_shared/http.js`) envia method/path/status/user/stack/context para o Supabase.
- Frontend: erros vão para `app_errors` via `useErrorLogger`/`logError`/`reportClientError` (contexts, serviços, controllers, SystemStatus). `ErrorBoundaryWithLogger` em `src/App.jsx` captura erros de renderização.
- Variáveis úteis: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENV`/`SERVICE_NAME`, `SLOW_REQUEST_THRESHOLD_MS`. Consulte `docs/error-handling.txt` para detalhes.
