# API-Estoque

Aplicação completa para controle de EPIs, construída com React (Vite) e integrada ao Supabase. O projeto oferece os fluxos de cadastros, movimentação de estoque, dashboards operacionais e geração do termo de responsabilidade. Para desenvolvimento offline há um modo totalmente local que persiste os dados no navegador com os mesmos componentes de interface.

## Visão geral

- **Cadastros principais:** pessoas, materiais, entradas, saídas, acidentes e grupos de apoio usados nos filtros.
- **Dashboards:** indicadores de estoque (movimentação, valor e alertas) e de segurança do trabalho (taxa de frequência/gravidade, distribuições por agente, tipo, parte lesionada e cargo).
- **Documentos:** geração do termo de EPI com visualização imediata e download em PDF renderizado no cliente.
- **Modos de dados:** alternância entre Supabase (remoto) e armazenamento local (`localStorage`) com o mesmo conjunto de páginas.

## Arquitetura

| Camada | Descrição |
| ------ | --------- |
| **Frontend** | React 19 + Vite. O `dataClient` direciona chamadas para `src/services/api.js` (Supabase) ou `src/services/localApi.js` (modo local). |
| **Banco de dados** | Supabase Postgres com migrations versionadas em `supabase/migrations`. O frontend acessa as tabelas diretamente usando `@supabase/supabase-js`. |
| **Auth** | Supabase Auth no modo remoto. Em modo local o login usa credenciais definidas via `.env.local`. |
| **Documentos compartilhados** | Templates de PDF e helpers vivem em `shared/`. |
| **Funções serverless (opcional)** | Pasta `api/` mantém as rotas Vercel caso seja necessário executar regras no backend. Para a maioria dos fluxos o frontend opera de forma stateless. |

## Requisitos

- Node.js 20+
- npm 10+
- Conta Supabase (modo remoto)
- Conta Vercel (deploy opcional do frontend e das funções em `api/`)

## Configuração do ambiente

Clone o repositório e instale as dependências:

```bash
git clone <url-do-repo>
cd API-Estoque
npm install
```

### Variáveis de ambiente (frontend)

Crie um arquivo `.env.local` na raiz com as chaves necessárias:

| Variável | Descrição |
| -------- | --------- |
| `VITE_SUPABASE_URL` | URL do projeto Supabase (ex.: `https://<project-ref>.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | Chave pública (`anon`) usada pelo SDK. |
| `VITE_DATA_MODE` | `remote` (padrão) para Supabase ou `local` para usar o armazenamento em navegador. |
| `VITE_LOCAL_USERNAME` | Usuário aceito no modo local (opcional, padrão `admin`). |
| `VITE_LOCAL_PASSWORD` | Senha do modo local (opcional, padrão `admin123`). |
| `VITE_LOCAL_DISPLAY_NAME` | Nome exibido para o usuário local (opcional). |
| `VITE_TERMO_EPI_EMPRESA_*` | Metadados opcionais do termo de EPI (nome, documento, endereço, contato e URLs de logos). |

### Variáveis de ambiente (funções opcionais)

Caso publique as rotas em `api/` na Vercel, configure também:

| Variável | Descrição |
| -------- | --------- |
| `SUPABASE_URL` | Mesma URL do projeto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave `service_role` utilizada apenas pelas funções serverless (nunca exponha ao frontend). |

> Consulte [`docs/supabase-auth-setup.txt`](docs/supabase-auth-setup.txt) e [`docs/rls-policies-guide.txt`](docs/rls-policies-guide.txt) para detalhes de autenticação e RLS.

## Modos de dados

| Modo | Como ativar | Autenticação | Persistência |
| ---- | ----------- | ------------ | ------------ |
| **Supabase** | `VITE_DATA_MODE=remote` (ou variável ausente) | `supabase.auth.signInWithPassword` | Tabelas `pessoas`, `materiais`, `entradas`, `saidas`, `acidentes`, `material_price_history` etc. |
| **Local** | `VITE_DATA_MODE=local` | Credenciais definidas no `.env.local` | `localStorage` (`api-estoque-local-data-v1`) com seeds de `src/data/local-seed.json`. |

Para alternar entre os modos, ajuste o `.env.local`, limpe o `localStorage` se precisar reiniciar os dados e reinicie o servidor Vite. O componente `SystemStatus` (na barra lateral) indica o modo ativo.

## Execução local

```bash
npm run dev
```

Abra `http://localhost:5173` e autentique-se:

- **Modo Supabase:** usuário criado no dashboard do Supabase.
- **Modo local:** valores configurados nas variáveis `VITE_LOCAL_USERNAME` / `VITE_LOCAL_PASSWORD`.

## Scripts disponíveis

| Script | Descrição |
| ------ | --------- |
| `npm run dev` | Inicia o Vite em modo desenvolvimento. |
| `npm run build` | Gera o bundle de produção. |
| `npm run preview` | Sobe um servidor local para inspecionar a build. |
| `npm run lint` | Executa ESLint nos arquivos do frontend. |

## Estrutura de pastas

```
.
├── api/                     # Funções serverless opcionais (Vercel)
├── docs/                    # Guias funcionais e operacionais
├── public/                  # Assets estáticos
├── shared/                  # Templates de documentos e utilidades compartilhadas
├── src/                     # Aplicação React
│   ├── components/          # Componentes reutilizáveis (tabelas, formulários, dashboards)
│   ├── config/              # Configurações de runtime, constantes e defaults
│   ├── context/             # Contextos globais (autenticação, toasts)
│   ├── data/                # Seeds e catálogos locais
│   ├── layouts/             # Layouts principais (sidebar, cabeçalhos)
│   ├── lib/                 # Regras de negócio compartilhadas (estoque, acidentes)
│   ├── pages/               # Telas (cadastros, dashboards, termo de EPI)
│   ├── services/            # Data clients (Supabase/local) e helpers de persistência
│   ├── styles/              # Estilos globais e específicos das páginas
│   └── utils/               # Funções utilitárias
├── supabase/                # Migrations SQL e guias de setup
└── vercel.json              # Configuração das funções serverless (quando usadas)
```

## Documentação complementar

A pasta [`docs/`](docs) descreve fluxos específicos (cadastros, dashboards, termo de EPI, modos de dados, RLS, checklist de schema etc.). Consulte especialmente:

- [`docs/Estoque.txt`](docs/Estoque.txt) – regras da tela de estoque e edição de mínimos.
- [`docs/Dashboard.txt`](docs/Dashboard.txt) – indicadores e gráficos de movimentação.
- [`docs/DashboardAcidentes.txt`](docs/DashboardAcidentes.txt) – painel de SST (Supabase x modo local).
- [`docs/Acidentes.txt`](docs/Acidentes.txt) – formulário, filtros e histórico de acidentes.
- [`docs/Materiais.txt`](docs/Materiais.txt) — cadastro avançado de EPIs, catálogos e histórico de preços.
- O backend `api.materiais` resolve referências (fabricante/grupo/medidas) antes de persistir e grava diffs JSON no `material_price_history` via `buildHistoryChanges`; o fluxo está descrito com detalhes em `docs/Materiais.txt`.
- [`docs/duplicidade-materiais.txt`](docs/duplicidade-materiais.txt) — detalha a view `materiais_unicos_view`, o hash e os gatilhos (`evitar_duplicidade_material`, `impedir_material_duplicado`) que evitam materiais repetidos mesmo quando só mudam cores/características.
- [`docs/materiais-issues.txt`](docs/materiais-issues.txt) — registro dos erros recorrentes que impactaram o cadastro de materiais (validação de EPI, uuid nos catálogos, vínculo de cores/características e o histórico) e orientações para corrigi-los.
- [`docs/Pessoas.txt`](docs/Pessoas.txt) — gestão de colaboradores, filtros e auditoria.
- [`docs/Entradas.txt`](docs/Entradas.txt) e [`docs/Saidas.txt`](docs/Saidas.txt) – movimentações de estoque com filtros e paginação.
- [`docs/TermosEpi.txt`](docs/TermosEpi.txt) e [`docs/ambiente-termos-epi.txt`](docs/ambiente-termos-epi.txt) – geração do termo e requisitos de infraestrutura.
- [`docs/data-mode-guide.txt`](docs/data-mode-guide.txt) – alternância entre Supabase e modo local.
- [`docs/supabase-auth-setup.txt`](docs/supabase-auth-setup.txt) e [`docs/supabase-esquema-checklist.txt`](docs/supabase-esquema-checklist.txt) – configuração de Auth e verificação do schema.
- [`docs/rls-policies-guide.txt`](docs/rls-policies-guide.txt) e [`docs/stateless-supabase-notes.txt`](docs/stateless-supabase-notes.txt) – segurança, políticas e visão arquitetural.
- [`docs/tutorial_remover_migration.txt`](docs/tutorial_remover_migration.txt) – fluxo para reparar migrations divergentes.

## Próximos passos sugeridos

- Popular dados reais e validar relatórios em ambos os modos.
- Finalizar políticas RLS específicas para cada perfil de usuário.
- Adicionar testes automatizados para fluxos críticos (cadastros e dashboards).
- Monitorar os tempos de resposta do Supabase e considerar caching em visões ou funções se necessário.
