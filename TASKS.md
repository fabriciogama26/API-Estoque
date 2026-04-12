# Tasks

## Concluido
- Base do dominio de ASO foi criada com migration versionada (`aso_tipos_exame`, `aso_controle`, `aso_historico`), view (`aso_controle_view`) e RPCs de create/update/registrar exame.
- API e services ganharam a base de integracao para ASO (listagem, tipos, cadastro, edicao, registro de exame e historico).
- Tela de reset de senha passou a traduzir o erro de senha repetida para portugues e ganhou exibicao/ocultacao por icone de olho nos campos de senha.
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
- `resolveUsuarioId()` foi corrigido para devolver o ator real da sessao; dependentes deixam de gravar o owner em campos de auditoria/"cadastrado por".

## Pendente
- Implementar a tela de ASO (cadastro, cards, filtros, lista, detalhes, historico e modal "Registrar exame").
- Implementar cadastro em massa de ASO via XLSX com template, validacoes, relatorio de erros e bloqueio de duplicidade.
- Aplicar a migration `supabase/migrations/20260412_create_aso_control.sql` no projeto Supabase.
- Validar no banco o comportamento de `proximo_vencimento`:
  - admissional e periodico somam 1 ano a partir de `data_exame`
  - demissional fica sem renovacao e sem alerta
- Validar por SQL e no app a constraint de duplicidade por tenant em `aso_controle` (`account_owner_id + pessoa_id + tipo_exame_id`).
- Atualizar a documentacao obrigatoria da feature (`docs/ASO.txt`) e o `README.md` se a mudanca impactar uso/configuracao.
- Aplicar a migration `supabase/migrations/20260305_expand_permission_dependencies.sql` no projeto Supabase.
- Aplicar a migration `supabase/migrations/20260308_fix_rpc_catalog_list_owner_scope.sql` no projeto Supabase.
- Validar por SQL com `request.jwt.claim.sub` de owner e dependente que `rpc_catalog_list('centros_servico')` e `rpc_catalog_list('centros_estoque')` nao retornam dados de outro `account_owner_id`.
- Validar em producao o carregamento de centros de estoque/servico/custo para dependentes em Entradas, Saidas, Pessoas e cadastros que usam SelectBox owner-scoped.
- Validar no app que "Cadastrado por"/"Registrado por" mostra o dependente nas telas Pessoas, Materiais, Saidas e Cadastro Base.
- Validar no app que Acidentes continua exibindo o dependente em "Registrado por" e que HHT mensal permanece consistente no historico/listagem.
- Revisar o limite global de emails do Supabase Auth (`Auth -> Rate limits -> Rate limit for sending emails`).

## Observacoes
- `git status` no sandbox exige `safe.directory` por causa do ownership do workspace.
- Existem alteracoes locais previas em `src/pages/Configuracoes.jsx`, `src/config/permissions.js`, `docs/Configuracoes.txt` e `docs/PermissoesToggles.txt` que continuam sendo usadas.
- O item `TESTE` foi reproduzido por SQL em `rpc_catalog_list('centros_estoque')` e `rpc_catalog_list('centros_servico')` com sessao simulada de dependente.
