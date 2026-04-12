# Tasks

## Concluido
- Tela de ASO foi criada com cadastro manual, cards, filtros, lista, detalhes, historico e modal de registro de exame.
- Navegacao e controle de acesso da tela ASO foram integrados em rota, menu lateral e `permissions.js`.
- `Credenciais e Permissoes` ganhou toggle proprio para `Controle de ASO`, separado de `Pessoas`, com chaves de pagina dedicadas e backfill de roles/overrides.
- Documentacao obrigatoria da tela ASO foi criada em `docs/ASO.txt` e o README foi atualizado com a nova estrutura.
- Base do dominio de ASO foi criada com migration versionada (`aso_tipos_exame`, `aso_controle`, `aso_historico`), view (`aso_controle_view`) e RPCs de create/update/registrar exame.
- API e services ganharam a base de integracao para ASO (listagem, tipos, cadastro, edicao, registro de exame e historico).
- Tela ASO ganhou rota principal `/pcsmo/controledeaso` com alias em `/cadastros/aso`, botao `Ajuda`, legenda visual e exportacao `Excel (CSV)`.
- Datas do ASO foram corrigidas para exibicao no padrao brasileiro sem deslocamento de timezone.
- Regras de ASO foram refinadas:
  - bloqueio duro no banco para `funcionario + tipo de exame + data do exame`
  - admissional e demissional bloqueiam novo cadastro por funcionario
  - periodico alerta sobre possivel duplicidade na janela de 15 dias e pode continuar
  - demissional exige pessoa inativa ou com `dataDemissao`
- Cadastro em massa de ASO foi implementado com template XLSX, upload para Storage, Edge Function de importacao e CSV de erros.
- Fluxo de baixa do ASO passou a fechar o registro atual como `Baixado`, criar um novo ciclo com a data realizada e registrar historico apenas em edicao/baixa.
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
- Aplicar a migration `supabase/migrations/20260412_create_aso_control.sql` no projeto Supabase.
- Aplicar a migration `supabase/migrations/20260412_add_aso_page_permissions.sql` no projeto Supabase.
- Aplicar a migration `supabase/migrations/20260412_aso_baixa_e_historico.sql` no projeto Supabase.
- Revisar a regra de `PermissionsContext` para role `admin`: hoje ela libera todas as rotas, entao os toggles de pagina em `Credenciais e Permissoes` nao restringem navegacao para esse perfil.
- Publicar/deploy das Edge Functions `aso-template` e `aso-import` no projeto Supabase.
- Validar no banco o comportamento de `proximo_vencimento`:
  - admissional e periodico somam 1 ano a partir de `data_exame`
  - demissional fica sem renovacao e sem alerta
- Validar por SQL e no app as regras de duplicidade do ASO:
  - bloqueio exato por `account_owner_id + pessoa_id + tipo_exame_id + data_exame`
  - unicidade de admissional/demissional por funcionario
  - alerta de periodico dentro de 15 dias
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
