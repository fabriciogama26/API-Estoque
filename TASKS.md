# Tasks

## Concluido
- Removida a reautenticacao obrigatoria nas rotas protegidas do backend/front.
- Fluxo de reset de senha voltou a usar Supabase direto com `token_hash` na tela de reset.
- Configuracoes agora bloqueiam auto-rebaixamento, auto-desativacao e remocao de `rbac.manage`.
- Historico de preco de material passou a usar client autenticado para respeitar RLS.
- Login de dependentes foi habilitado na edge function `auth-login`.
- Toggles de permissao no front passaram a aplicar dependencias de leitura.
- Permissoes efetivas no banco agora expandem dependencias de pagina para atender a RLS dos catalogos.
- Resolucao de owner efetivo passou a priorizar dependentes em `app_users_dependentes` para corrigir catalogos owner-scoped.
- Catalogos owner-scoped passaram a isolar cache por `authUserId` e Pessoas voltou a usar `rpc_catalog_list` nas referencias.
- Cache de catalogos owner-scoped foi removido no service; controladores de Saidas, Entradas, Cadastro Base e Acidentes limpam selects locais ao trocar de usuario.
- Diagnostico SQL confirmou que o vazamento real estava em `public.rpc_catalog_list(text)`, nao no cache do frontend.
- Migration `supabase/migrations/20260308_fix_rpc_catalog_list_owner_scope.sql` criada para impedir fallback global em catalogos owner-scoped.

## Pendente
- Aplicar a migration `supabase/migrations/20260305_expand_permission_dependencies.sql` no projeto Supabase.
- Aplicar a migration `supabase/migrations/20260308_fix_rpc_catalog_list_owner_scope.sql` no projeto Supabase.
- Validar por SQL com `request.jwt.claim.sub` de owner e dependente que `rpc_catalog_list('centros_servico')` e `rpc_catalog_list('centros_estoque')` nao retornam dados de outro `account_owner_id`.
- Validar em producao o carregamento de centros de estoque/servico/custo para dependentes em Entradas, Saidas, Pessoas e cadastros que usam SelectBox owner-scoped.
- Revisar o limite global de emails do Supabase Auth (`Auth -> Rate limits -> Rate limit for sending emails`).

## Observacoes
- `git status` no sandbox exige `safe.directory` por causa do ownership do workspace.
- Existem alteracoes locais previas em `src/pages/Configuracoes.jsx`, `src/config/permissions.js`, `docs/Configuracoes.txt` e `docs/PermissoesToggles.txt` que continuam sendo usadas.
- O item `TESTE` foi reproduzido por SQL em `rpc_catalog_list('centros_estoque')` e `rpc_catalog_list('centros_servico')` com sessao simulada de dependente.
