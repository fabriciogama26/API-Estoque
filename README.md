# API-Estoque

AplicaÃ§Ã£o completa para controle de EPIs, construÃ­da com React (Vite) e integrada ao Supabase. O projeto oferece os fluxos de cadastros, movimentaÃ§Ã£o de estoque, dashboards operacionais e geraÃ§Ã£o do termo de responsabilidade. Para desenvolvimento offline hÃ¡ um modo totalmente local que persiste os dados no navegador com os mesmos componentes de interface.

## VisÃ£o geral

- **Cadastros principais:** pessoas, materiais, entradas, saÃ­das, acidentes e grupos de apoio usados nos filtros.
- **Dashboards:** indicadores de estoque (movimentaÃ§Ã£o, valor e alertas) e de seguranÃ§a do trabalho (taxa de frequÃªncia/gravidade, distribuiÃ§Ãµes por agente, tipo, parte lesionada e cargo).
- **Documentos:** geraÃ§Ã£o do termo de EPI com visualizaÃ§Ã£o imediata e download em PDF renderizado no cliente.
- **Modos de dados:** alternÃ¢ncia entre Supabase (remoto) e armazenamento local (`localStorage`) com o mesmo conjunto de pÃ¡ginas.

## Novidades 2025-12

- **Dashboard de estoque modularizado:** `useDashboardEstoque` + `DashboardEstoqueContext` isolam filtros, cacheiam a chave de busca para evitar recargas repetidas e removem flicker nos botoes; utils em `dashboardEstoqueUtils.js` formatam series e rankings.
- **Entradas/Saidas reorganizadas:** logica de formulario/filtros/autocomplete movida para controllers e contextos dedicados, com servicos (`entradasService`/`saidasService`) e logging via `useErrorLogger`.
- **Rotas compativeis:** alem de `/entradas` e `/saidas`, o menu usa `/movimentacoes/entradas|saidas`; ambos caminhos sao aceitos.
- **Materiais/Pessoas:** imports case-sensitive corrigidos (`pessoasUtils`, `authService`), view `pessoas_view` atualizada com `usuarioCadastroUsername` e aliases legados.
- **Termo de EPI:** tela modularizada (`useTermoEpi` + `termoEpiService`), preview/download com estados separados e logging de erros.
- **Auth refatorado:** hooks `useLoginForm` e `useResetPassword` + `authService` e `errorLogService`; erros enviados para `app_errors`.
- **Ajuda contextual:** cada pagina agora tem `HelpButton` que le textos de `src/help/helpContent.json` e exibe passos/notas em modal; guia rapido em `docs/help-usage.txt` mostra como editar conteudo e incluir imagens em `/public/help/<topico>/`.
- **Ajuda de agentes (Acidentes):** o campo "Agente *" ganhou um icone proprio que abre `src/help/helpAcidentesAgentes.json` com resumo, descricao por agente e tipos/lesoes mais comuns.
- **Credenciais e permissoes:** `app_users` agora tem `credential`, `page_permissions` e `ativo`. Perfis `master` (oculto para edicao/reset), `admin`, `estagiario`, `operador` e `visitante` filtram rotas/menu via `PermissionsProvider`/`ProtectedRoute`. Tela de Configuracoes traz toggles para status/paginas (duas colunas), dropdowns com username e oculta master, grava historico em `app_users_credential_history` (credencial, paginas, status e acoes `update`/`password_reset`) e permite reset de senha por admin. Login bloqueia usuarios com `ativo=false` e a tela sincroniza o status com `auth.users.banned_until` via RPC `sync_user_ban_with_status`. Policies RLS limitam insert/update/delete em `app_users` e insert no historico a admin/master (ou service_role). Documentacao em `docs/CredenciaisPermissoes.txt`.
- **UX de edicao em cadastros:** ao clicar em editar nas telas principais o formulario sobe automaticamente para o topo; em Entradas, o botao "Cancelar alteracao" reaparece ao lado do salvar e todos os formularios ganham titulo "Editando..." + borda/sombra amarela para deixar claro o modo de edicao.
- **Acoes padronizadas nas listas:** botoes de editar/historico em Materiais, Pessoas e Acidentes usam os mesmos icones e tooltips da tela de Entradas (caneta azul e relogio).
- **Busca por CA no Estoque:** a busca da tela Estoque atual agora tambem considera o CA (texto ou apenas digitos) ao filtrar materiais.

## Novidades 2025-11

- **GrÃ¡ficos interativos:** cada widget do dashboard ganhou botÃ£o de expandir (`ExpandIcon`) e modal fullscreen com clique fora/`Esc` para fechar.
- **Filtros contextuais:** cliques nos grÃ¡ficos de material, categoria, fabricante e centro de serviÃ§os preenchem automaticamente o campo de busca (`chartFilter` + badge visual), afetando todas as demais telas.
- **Legibilidade aprimorada:** labels utilizam `formatEstoqueMaterialLabel`, tooltips exibem a descriÃ§Ã£o completa e a tipografia dos eixos Y foi reduzida para evitar sobreposiÃ§Ã£o.
- **Indicadores SST atualizados:** o dashboard de acidentes agora traz as referÃªncias da OIT em badges (TF/TG) e uma segunda fileira com IA, IAG e IRA â€“ os valores chegam da view `vw_indicadores_acidentes`.
- **Status do sistema refinado:** o cartÃ£o do usuÃ¡rio passa a mostrar o `display_name` sincronizado com `app_users`, evitando exibir o e-mail truncado quando o perfil jÃ¡ estÃ¡ cadastrado no banco.

## Arquitetura

| Camada | DescriÃ§Ã£o |
| ------ | --------- |
| **Frontend** | React 19 + Vite. O `dataClient` direciona chamadas para `src/services/api.js` (Supabase) ou `src/services/localApi.js` (modo local). |
| **Banco de dados** | Supabase Postgres com migrations versionadas em `supabase/migrations`. O frontend acessa as tabelas diretamente usando `@supabase/supabase-js`. |
| **Auth** | Supabase Auth no modo remoto. Em modo local o login usa credenciais definidas via `.env.local`. |
| **Documentos compartilhados** | Templates de PDF e helpers vivem em `shared/`. |
| **FunÃ§Ãµes serverless (opcional)** | Pasta `api/` mantÃ©m as rotas Vercel caso seja necessÃ¡rio executar regras no backend. Para a maioria dos fluxos o frontend opera de forma stateless. |

## Requisitos

- Node.js 20+
- npm 10+
- Conta Supabase (modo remoto)
- Conta Vercel (deploy opcional do frontend e das funÃ§Ãµes em `api/`)

## ConfiguraÃ§Ã£o do ambiente

Clone o repositÃ³rio e instale as dependÃªncias:

```bash
git clone <url-do-repo>
cd API-Estoque
npm install
```

### VariÃ¡veis de ambiente (frontend)

Crie um arquivo `.env.local` na raiz com as chaves necessÃ¡rias:

| VariÃ¡vel | DescriÃ§Ã£o |
| -------- | --------- |
| `VITE_SUPABASE_URL` | URL do projeto Supabase (ex.: `https://<project-ref>.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | Chave pÃºblica (`anon`) usada pelo SDK. |
| `VITE_DATA_MODE` | `remote` (padrÃ£o) para Supabase ou `local` para usar o armazenamento em navegador. |
| `VITE_LOCAL_USERNAME` | UsuÃ¡rio aceito no modo local (opcional, padrÃ£o `admin`). |
| `VITE_LOCAL_PASSWORD` | Senha do modo local (opcional, padrÃ£o `admin123`). |
| `VITE_LOCAL_DISPLAY_NAME` | Nome exibido para o usuÃ¡rio local (opcional). |
| `VITE_TERMO_EPI_EMPRESA_*` | Metadados opcionais do termo de EPI (nome, documento, endereÃ§o, contato e URLs de logos). |

> Para exibir corretamente o nome no cartÃ£o *Status do sistema*, mantenha a tabela `public.app_users` sincronizada com o Supabase Auth: crie um registro usando o mesmo UUID (`id`) retornado para o usuÃ¡rio e preencha `username`, `display_name` (e opcionalmente `email`). O componente busca esse dado automaticamente.

### Sincronizacao de status (ativo/inativo)

Crie a funcao RPC para manter `auth.users.banned_until` alinhado ao campo `ativo` do `app_users` quando a tela de Configuracoes salvar alteracoes:

```sql
create or replace function public.sync_user_ban_with_status(p_user_id uuid, p_active boolean)
returns void language plpgsql security definer as $$
begin
  update auth.users
     set banned_until = case when coalesce(p_active, true) = false then 'infinity'::timestamptz else null end
   where id = p_user_id;
end;
$$;
revoke all on function public.sync_user_ban_with_status(uuid, boolean) from public;
grant execute on function public.sync_user_ban_with_status(uuid, boolean) to anon, authenticated;
```

A chamada ocorre no front (PermissionsSection) e falhas sao apenas logadas para nao travar a edicao.

### VariÃ¡veis de ambiente (funÃ§Ãµes opcionais)

Caso publique as rotas em `api/` na Vercel, configure tambÃ©m:

| VariÃ¡vel | DescriÃ§Ã£o |
| -------- | --------- |
| `SUPABASE_URL` | Mesma URL do projeto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave `service_role` utilizada apenas pelas funÃ§Ãµes serverless (nunca exponha ao frontend). |

> Consulte [`docs/supabase-auth-setup.txt`](docs/supabase-auth-setup.txt) e [`docs/rls-policies-guide.txt`](docs/rls-policies-guide.txt) para detalhes de autenticaÃ§Ã£o e RLS.

## Modos de dados

| Modo | Como ativar | AutenticaÃ§Ã£o | PersistÃªncia |
| ---- | ----------- | ------------ | ------------ |
| **Supabase** | `VITE_DATA_MODE=remote` (ou variÃ¡vel ausente) | `supabase.auth.signInWithPassword` | Tabelas `pessoas`, `materiais`, `entradas`, `saidas`, `acidentes`, `material_price_history` etc. |
| **Local** | `VITE_DATA_MODE=local` | Credenciais definidas no `.env.local` | `localStorage` (`api-estoque-local-data-v1`) com seeds de `src/data/local-seed.json`. |

Para alternar entre os modos, ajuste o `.env.local`, limpe o `localStorage` se precisar reiniciar os dados e reinicie o servidor Vite. O componente `SystemStatus` (na barra lateral) indica o modo ativo.

## ExecuÃ§Ã£o local

```bash
npm run dev
```

Abra `http://localhost:5173` e autentique-se:

- **Modo Supabase:** usuÃ¡rio criado no dashboard do Supabase.
- **Modo local:** valores configurados nas variÃ¡veis `VITE_LOCAL_USERNAME` / `VITE_LOCAL_PASSWORD`.

## Scripts disponÃ­veis

| Script | DescriÃ§Ã£o |
| ------ | --------- |
| `npm run dev` | Inicia o Vite em modo desenvolvimento. |
| `npm run build` | Gera o bundle de produÃ§Ã£o. |
| `npm run preview` | Sobe um servidor local para inspecionar a build. |
| `npm run lint` | Executa ESLint nos arquivos do frontend. |

## Estrutura de pastas

```
.
â”œâ”€â”€ api/                     # FunÃ§Ãµes serverless opcionais (Vercel)
â”œâ”€â”€ docs/                    # Guias funcionais e operacionais
â”œâ”€â”€ public/                  # Assets estÃ¡ticos
â”œâ”€â”€ shared/                  # Templates de documentos e utilidades compartilhadas
â”œâ”€â”€ src/                     # AplicaÃ§Ã£o React
â”‚   â”œâ”€â”€ components/          # Componentes reutilizÃ¡veis (tabelas, formulÃ¡rios, dashboards)
â”‚   â”œâ”€â”€ config/              # ConfiguraÃ§Ãµes de runtime, constantes e defaults
â”‚   â”œâ”€â”€ context/             # Contextos globais (autenticaÃ§Ã£o, toasts)
â”‚   â”œâ”€â”€ data/                # Seeds e catÃ¡logos locais
â”‚   â”œâ”€â”€ layouts/             # Layouts principais (sidebar, cabeÃ§alhos)
â”‚   â”œâ”€â”€ lib/                 # Regras de negÃ³cio compartilhadas (estoque, acidentes)
â”‚   â”œâ”€â”€ pages/               # Telas (cadastros, dashboards, termo de EPI)
â”‚   â”œâ”€â”€ services/            # Data clients (Supabase/local) e helpers de persistÃªncia
â”‚   â”œâ”€â”€ styles/              # Estilos globais e especÃ­ficos das pÃ¡ginas
â”‚   â””â”€â”€ utils/               # FunÃ§Ãµes utilitÃ¡rias
â”œâ”€â”€ supabase/                # Migrations SQL e guias de setup
â””â”€â”€ vercel.json              # ConfiguraÃ§Ã£o das funÃ§Ãµes serverless (quando usadas)
```

## DocumentaÃ§Ã£o complementar

A pasta [`docs/`](docs) descreve fluxos especÃ­ficos (cadastros, dashboards, termo de EPI, modos de dados, RLS, checklist de schema etc.). Consulte especialmente:

- [`docs/Estoque.txt`](docs/Estoque.txt) â€“ regras da tela de estoque e ediÃ§Ã£o de mÃ­nimos.
- [`docs/Dashboard.txt`](docs/Dashboard.txt) â€“ indicadores e grÃ¡ficos de movimentaÃ§Ã£o.
- [`docs/DashboardAcidentes.txt`](docs/DashboardAcidentes.txt) â€“ painel de SST (Supabase x modo local).
- [`docs/Acidentes.txt`](docs/Acidentes.txt) â€“ formulÃ¡rio, filtros e histÃ³rico de acidentes.
- [`docs/Materiais.txt`](docs/Materiais.txt) â€” cadastro avanÃ§ado de EPIs, catÃ¡logos e histÃ³rico de preÃ§os.
- O backend `api.materiais` resolve referÃªncias (fabricante/grupo/medidas) antes de persistir e grava diffs JSON no `material_price_history` via `buildHistoryChanges`; o fluxo estÃ¡ descrito com detalhes em `docs/Materiais.txt`.
- [`docs/duplicidade-materiais.txt`](docs/duplicidade-materiais.txt) â€” detalha a view `materiais_unicos_view`, o hash e os gatilhos (`evitar_duplicidade_material`, `impedir_material_duplicado`) que evitam materiais repetidos mesmo quando sÃ³ mudam cores/caracterÃ­sticas.
- [`docs/materiais-issues.txt`](docs/materiais-issues.txt) â€” registro dos erros recorrentes que impactaram o cadastro de materiais (validaÃ§Ã£o de EPI, uuid nos catÃ¡logos, vÃ­nculo de cores/caracterÃ­sticas e o histÃ³rico) e orientaÃ§Ãµes para corrigi-los.
- [`docs/Pessoas.txt`](docs/Pessoas.txt) â€” gestÃ£o de colaboradores, filtros e auditoria.
- [`docs/Entradas.txt`](docs/Entradas.txt) e [`docs/Saidas.txt`](docs/Saidas.txt) â€“ movimentaÃ§Ãµes de estoque com filtros e paginaÃ§Ã£o.
- [`docs/TermosEpi.txt`](docs/TermosEpi.txt) e [`docs/ambiente-termos-epi.txt`](docs/ambiente-termos-epi.txt) â€“ geraÃ§Ã£o do termo e requisitos de infraestrutura.
- [`docs/data-mode-guide.txt`](docs/data-mode-guide.txt) â€“ alternÃ¢ncia entre Supabase e modo local.
- [`docs/supabase-auth-setup.txt`](docs/supabase-auth-setup.txt) e [`docs/supabase-esquema-checklist.txt`](docs/supabase-esquema-checklist.txt) â€“ configuraÃ§Ã£o de Auth e verificaÃ§Ã£o do schema.
- [`docs/rls-policies-guide.txt`](docs/rls-policies-guide.txt) e [`docs/stateless-supabase-notes.txt`](docs/stateless-supabase-notes.txt) â€“ seguranÃ§a, polÃ­ticas e visÃ£o arquitetural.
- [`docs/tutorial_remover_migration.txt`](docs/tutorial_remover_migration.txt) â€“ fluxo para reparar migrations divergentes.
- [`docs/help-usage.txt`](docs/help-usage.txt) - como editar os textos da ajuda contextual e referenciar imagens em `/public`.

## PrÃ³ximos passos sugeridos

- Popular dados reais e validar relatÃ³rios em ambos os modos.
- Finalizar polÃ­ticas RLS especÃ­ficas para cada perfil de usuÃ¡rio.
- Adicionar testes automatizados para fluxos crÃ­ticos (cadastros e dashboards).
- Monitorar os tempos de resposta do Supabase e considerar caching em visÃµes ou funÃ§Ãµes se necessÃ¡rio.


