# API-Estoque

Aplicação completa para controle de EPIs com frontend em React (Vite) e funções serverless hospedadas na Vercel. Em modo padrão tudo roda sobre Supabase (autenticação, banco e RLS), mas também existe um modo totalmente local que persiste dados no navegador para desenvolvimento offline.

## Sumário

- [Arquitetura](#arquitetura)
- [Requisitos](#requisitos)
- [Configuração do Ambiente](#configuração-do-ambiente)
  - [Variáveis de Ambiente](#variáveis-de-ambiente)
  - [Supabase](#supabase)
  - [Vercel](#vercel)
- [Execução Local](#execução-local)
- [Modos de Dados](#modos-de-dados)
- [Endpoints Principais](#endpoints-principais)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Fluxo de Autenticação e RLS](#fluxo-de-autenticação-e-rls)
- [Referências de Documentação](#referências-de-documentação)
- [Próximos Passos](#próximos-passos)

## Arquitetura

| Camada            | Descrição                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Frontend          | React 19 + Vite. O `dataClient` escolhe entre o Supabase (`src/services/api.js`) ou o armazenamento local (`src/services/localApi.js`). |
| Backend           | Funções serverless na Vercel (`api/index.js` centraliza as rotas `/api/*` e delega para `api/_shared/operations.js`). Cada chamada valida o token Supabase antes de acessar o banco com a chave de serviço. |
| Banco de Dados    | Supabase Postgres (`pessoas`, `materiais`, `entradas`, `saidas`, `acidentes`, `material_price_history`). Migrations em `supabase/migrations`. |
| Geração de PDFs   | Template compartilhado em `shared/documents/epiTermTemplate.js` consumido tanto pela API (Puppeteer) quanto pelo frontend. |
| Autenticação      | Supabase Auth no modo remoto. Em modo local, credenciais definidas via `.env.local`. |
| Regras de negócio | `api/_shared/operations.js` (lado serverless) e `src/lib/estoque.js` / `src/lib/acidentesDashboard.js` (cálculos compartilhados). |

> Estilos dos dashboards: `src/styles/DashboardPage.css` organiza o layout e `src/styles/charts.css` agrupa helpers de graficos compartilhados.

## Requisitos

- Node.js 20+
- npm 10+
- Conta Supabase (para modo remoto)
- Conta Vercel (deploy das funções e do frontend)

## Configuração do Ambiente

Clone o repositório e instale as dependências:

```bash
git clone <url-do-repo>
cd API-Estoque
npm install
```

### Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz com as variáveis públicas usadas pelo Vite:

| Variável                     | Descrição                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `VITE_SUPABASE_URL`          | URL do projeto Supabase.                                                                   |
| `VITE_SUPABASE_ANON_KEY`     | Chave pública (`anon`) do Supabase.                                                        |
| `VITE_API_URL`               | URL base para chamadas às funções serverless (ex.: `http://localhost:5173`).              |
| `VITE_DATA_MODE`             | `remote` (padrão) usa Supabase; `local` persiste no `localStorage`.                        |
| `VITE_LOCAL_USERNAME`        | Usuário padrão do modo local (opcional, default `admin`).                                  |
| `VITE_LOCAL_PASSWORD`        | Senha padrão do modo local (opcional, default `admin123`).                                 |
| `VITE_LOCAL_DISPLAY_NAME`    | Nome exibido para o usuário local.                                                         |

Para as funções serverless (local com `vercel dev` ou produção) crie `.env` ou configure no painel da Vercel:

| Variável                     | Descrição                                      |
| ---------------------------- | ---------------------------------------------- |
| `SUPABASE_URL`               | URL do projeto Supabase.                       |
| `SUPABASE_SERVICE_ROLE_KEY`  | Chave `service_role` utilizada pela API.       |

> **Importante:** a chave de serviço **nunca** deve ser exposta ao frontend.

### Supabase

1. Crie um projeto Supabase.
2. Execute as migrations localmente ou via CI/CD. Consulte [`supabase/README.md`](supabase/README.md) para fluxos de `supabase db reset`/`db push`, detalhes das migrations `0001`–`0005` e políticas RLS recomendadas.
3. Cadastre `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` nos ambientes (local e Vercel).
4. Popule as tabelas iniciais conforme necessidade (usuários, materiais, etc.).

### Vercel

1. Conecte o repositório no dashboard da Vercel.
2. Configure as variáveis mencionadas acima (`vercel env`).
3. O deploy padrão executa `npm run build` (frontend) e expõe qualquer arquivo em `api/` como endpoint.
4. Depois do deploy, valide acessando `/login` e `/api/health` (com token válido).

## Execução Local

1. Defina as variáveis no `.env.local` (Supabase e/ou modo local).
2. Suba o frontend:

   ```bash
   npm run dev
   ```

3. Abra `http://localhost:5173`.
   - **Modo Supabase**: entre com um usuário cadastrado via Supabase Auth.
   - **Modo local**: use as credenciais configuradas (`VITE_LOCAL_USERNAME` / `VITE_LOCAL_PASSWORD`).
4. Para testar as funções serverless com Supabase localmente, utilize `vercel dev` (opcional) apontando para a mesma `.env`.

## Modos de Dados

| Modo    | Como ativar                          | Autenticação                         | Persistência                                                                     |
| ------- | ------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------- |
| Remote  | (padrão) ou `VITE_DATA_MODE=remote`  | Supabase Auth (`supabase.auth.*`)    | Banco Supabase (Postgres + RLS).                                                 |
| Local   | `VITE_DATA_MODE=local`               | Credenciais definidas em `.env.local`| `localStorage` (`api-estoque-local-data-v1`), seeds em `src/data/local-seed.json`. |

- Alternar entre os modos exige reiniciar o Vite.
- Para resetar apenas os dados locais, limpe a chave `api-estoque-local-data-v1` no `localStorage`.
- Guia completo: [`docs/data-mode-guide.txt`](docs/data-mode-guide.txt).

## Endpoints Principais

Todos os endpoints remotos exigem cabeçalho `Authorization: Bearer <token>`.

| Recurso   | Método(s)        | Endpoint(s)                                                                                | Observações                                               |
| --------- | ---------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Pessoas   | GET, POST        | `/api/pessoas`                                                                             | Lista e cria registros.                                   |
| Pessoas   | PUT              | `/api/pessoas/:id`                                                                         | Atualiza dados da pessoa.                                 |
| Pessoas   | GET              | `/api/pessoas/history/:id`                                                                 | Retorna histórico de edições.                             |
| Materiais | GET, POST        | `/api/materiais`                                                                           | Consulta e cria materiais.                                |
| Materiais | PUT              | `/api/materiais/:id`                                                                       | Atualiza material existente.                              |
| Materiais | GET              | `/api/materiais/price-history/:id`                                                         | Histórico de preços.                                      |
| Materiais | GET              | `/api/materiais/groups`                                                                    | Lista grupos cadastrados para vincular aos EPIs.          |
| Entradas  | GET, POST        | `/api/entradas`                                                                            | Movimentações de entrada.                                 |
| Saídas    | GET, POST        | `/api/saidas`                                                                              | Movimentações de saída.                                   |
| Estoque   | GET              | `/api/estoque`                                                                             | Snapshot atual (filtros `periodoInicio`, `periodoFim`, `centroCusto`).     |
| Estoque   | GET              | `/api/estoque?view=dashboard`                                                              | Dashboard consolidado (mesmos filtros via query string).  |
| Acidentes | GET, POST        | `/api/acidentes`                                                                           | Lista e cria acidentes.                                   |
| Acidentes | PUT              | `/api/acidentes/:id`                                                                       | Atualização de acidente.                                  |
| Documentos | GET             | `/api/documentos/termo-epi`                                                                | Retorna PDF (default) ou JSON (`?format=json`).           |
| Health    | GET              | `/api/health`                                                                              | Checagem autenticada de saúde.                            |

> Pessoas: obrigatório informar `nome`, `matricula`, `centroServico`, `cargo` e `tipoExecucao`. Campo opcional `dataAdmissao` aceita ISO completo ou `yyyy-mm-dd`; valores inválidos são ignorados.

### Termo de EPI (Puppeteer)

- Sempre que a página **Termos > Termo de EPI** gera ou baixa o documento, a requisição vai para `/api/documentos/termo-epi`, que usa Puppeteer para produzir o PDF (mesmo resultado local e em produção).
- O comportamento dos dados depende das variáveis `DATA_MODE` (backend) e `VITE_DATA_MODE` (frontend):
  - `local`: usa o seed (`localDataStore`) e dispensa autenticação.
  - `remote` (padrão): depende do Supabase (Postgres + Auth).
- A UI exibe um badge indicando o modo atual e o contexto retornado pela API inclui o campo `origem` (local ou remoto).
- As ações de termo foram removidas da lista de saídas; utilize a página dedicada para pré-visualização e exportação.

## Scripts Disponíveis

| Script            | Descrição                                         |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Inicia o Vite em modo desenvolvimento.           |
| `npm run build`   | Gera build de produção.                          |
| `npm run preview` | Servidor local para inspecionar a build.         |
| `npm run lint`    | Executa ESLint nos arquivos do frontend.         |
| `npm run release:*` | Atalhos para versionamento (`npm version`).     |

## Estrutura de Pastas

```
.
├── api/                     # Funções serverless (Vercel)
│   ├── _shared/             # Autenticação, helpers HTTP e regras de negócio
│   └── documents/           # Renderizadores de PDFs
├── docs/                    # Documentação funcional e guias auxiliares
├── public/                  # Arquivos estáticos servidos pelo Vite
├── shared/                  # Código compartilhado (templates de documentos)
├── src/                     # Aplicação React
│   ├── components/          # Componentes reutilizáveis
│   ├── config/              # Configurações centralizadas
│   ├── context/             # Providers (Auth, Toast, etc.)
│   ├── controllers/         # Funções orquestradoras das páginas
│   ├── data/                # Seeds e dados de apoio (modo local)
│   ├── layouts/             # Layouts principais
│   ├── lib/                 # Utilitários de domínio (estoque, formatação)
│   ├── models/              # Modelagem e tipagem das entidades
│   ├── pages/               # Telas (Dashboard, Estoque, etc.)
│   ├── repositories/        # Acesso a dados (Supabase ou local)
│   ├── routes/              # Definição das rotas da aplicação
│   ├── services/            # Clientes HTTP e selectors de modo
│   ├── styles/              # Estilos globais (DashboardPage.css) e utilidades de graficos (charts.css)
│   └── utils/               # Funções utilitárias compartilhadas
├── supabase/                # Migrations SQL e guia de configuração
└── vercel.json              # Configurações de deploy na Vercel
```

## Fluxo de Autenticação e RLS

1. No modo remoto, o usuário autentica pelo Supabase Auth (`/login`).
2. O token de acesso é mantido pelo SDK e aplicado nas chamadas a `/api/*` via `dataClient`.
3. Cada função serverless valida o token e executa as operações no Supabase (respeitando RLS).
4. Em modo local, `AuthContext` valida apenas as credenciais do `.env.local` e os dados trafegam dentro do navegador.

## Referências de Documentação

- `docs/Login.txt`, `docs/Dashboard.txt` (estoque e acidentes), `docs/Entradas.txt`, `docs/Estoque.txt`, `docs/Materiais.txt`, `docs/Pessoas.txt`, `docs/Saidas.txt`.
- `docs/rls-policies-guide.txt` para as políticas de segurança no Supabase.
- `docs/stateless-supabase-notes.txt` para detalhes do backend stateless.
- `docs/data-mode-guide.txt` para alternar entre modo local e Supabase.

## Próximos Passos

- Finalizar políticas RLS e testar com perfis diferentes.
- Popular dados reais para validar relatórios.
- Adicionar testes automatizados (UI e unitários) para fluxos críticos.
- Monitorar tamanho do bundle e considerar code splitting.
- Avaliar logs/métricas para funções serverless e Supabase.

---

Sugestões e melhorias são bem-vindas. Abra uma issue ou envie um PR!


