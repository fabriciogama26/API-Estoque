# API-Estoque

Aplicacao completa para controle de EPIs com frontend React (Vite) e funcoes serverless hospedadas na Vercel. Em modo padrao tudo roda sobre Supabase (autenticacao, banco e RLS), mas agora tambem existe um modo totalmente local que persiste dados no navegador para desenvolvimento offline.

## Sumario

- [Arquitetura](#arquitetura)
- [Requisitos](#requisitos)
- [Configuracao do Ambiente](#configuracao-do-ambiente)
  - [Variaveis de Ambiente](#variaveis-de-ambiente)
  - [Supabase](#supabase)
  - [Vercel](#vercel)
- [Execucao Local](#execucao-local)
- [Modos de Dados](#modos-de-dados)
- [Scripts Disponiveis](#scripts-disponiveis)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Fluxo de Autenticacao e RLS](#fluxo-de-autenticacao-e-rls)
- [Referencias de Documentacao](#referencias-de-documentacao)
- [Proximos Passos](#proximos-passos)

## Arquitetura

| Camada            | Descricao                                                                 |
| ----------------- | -------------------------------------------------------------------------- |
| Frontend          | React 19 + Vite. Consome `dataClient`, que escolhe entre Supabase (`api.js`) ou cache local. |
| Backend           | Funcoes serverless na Vercel (`api/index.js` centraliza as rotas `/api/*` e delega para `operations`). Cada chamada valida o token Supabase antes de acessar o banco com a chave de servico. |
| Banco de Dados    | Supabase Postgres (`pessoas`, `materiais`, `entradas`, `saidas`, `acidentes`, `material_price_history`). |
| Autenticacao      | Supabase Auth no modo remoto. Em modo local, credenciais definidas via `.env.local`. |
| Regras de negocio | `api/_shared/operations.js` (lado serverless) e `src/lib/estoque.js` (calculos compartilhados). |

## Requisitos

- Node.js 20+
- npm 10+
- Conta Supabase (para modo remoto)
- Conta Vercel (deploy das funcoes e do frontend)

## Configuracao do Ambiente

Clone o repositorio e instale as dependencias:

```bash
git clone <url-do-repo>
cd API-Estoque
npm install
```

### Variaveis de Ambiente

Crie um arquivo `.env.local` na raiz com as variaveis publicas usadas pelo Vite:

```bash
VITE_SUPABASE_URL=https://<sua-url>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_API_URL=http://localhost:5173   # o Vite faz proxy das rotas /api
```

Variaveis adicionais para o modo local:

```bash
VITE_DATA_MODE=local                 # use "remote" (padrao) para Supabase
VITE_LOCAL_USERNAME=admin            # opcional (padrao: admin)
VITE_LOCAL_PASSWORD=admin123         # opcional (padrao: admin123)
VITE_LOCAL_DISPLAY_NAME=Administrador Local  # opcional
```

No ambiente das funcoes serverless (local com `vercel dev` ou producao):

```bash
SUPABASE_URL=https://<sua-url>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

> **Importante:** a chave de servico **nunca** deve ser exposta ao frontend.

### Supabase

1. Crie um projeto Supabase.
2. Construa o schema seguindo [`docs/stateless-supabase-notes.txt`](docs/stateless-supabase-notes.txt) e as politicas RLS de [`docs/rls-policies-guide.txt`](docs/rls-policies-guide.txt).
3. Cadastre `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` nos ambientes (local e Vercel).
4. Popular tabelas iniciais conforme necessidade (usuarios, materiais, etc).

### Vercel

1. Conecte o repositorio no dashboard da Vercel.
2. Configure as variaveis mencionadas acima (`vercel env`).
3. Deploy padrao executa `npm run build` (frontend) e expoe qualquer arquivo em `api/` como endpoint.
4. Depois do deploy, valide acessando `/login` e `/api/health` (com token valido).

## Execucao Local

1. Defina as variaveis no `.env.local` (tanto Supabase quanto, se desejar, modo local).
2. Suba o frontend:

```bash
npm run dev
```

3. Abra `http://localhost:5173`.
   - **Modo Supabase**: entre com um usuario cadastrado via Supabase Auth.
   - **Modo local**: use as credenciais configuradas (`VITE_LOCAL_USERNAME` / `VITE_LOCAL_PASSWORD`).
4. Para testar as funcoes serverless com Supabase localmente, use `vercel dev` (opcional).

## Modos de Dados

| Modo    | Como ativar                          | Autenticacao                         | Persistencia                                  |
| ------- | ------------------------------------ | ------------------------------------ | --------------------------------------------- |
| Remote  | (padrao) ou `VITE_DATA_MODE=remote`  | Supabase Auth (`supabase.auth.*`)    | Banco Supabase (Postgres + RLS)               |
| Local   | `VITE_DATA_MODE=local`               | Credenciais definidas em `.env.local`| `localStorage` (`api-estoque-local-data-v1`), seeds em `src/data/local-seed.json` |
|         |                                        |                                      | Entradas/Saídas registram `centroCusto` e `centroServico` em ambos os modos. |

- Alternar entre os modos exige reiniciar o Vite.
- Para resetar apenas os dados locais, limpe a chave `api-estoque-local-data-v1` no `localStorage`.
- Guia completo: [`docs/data-mode-guide.txt`](docs/data-mode-guide.txt).

## Endpoints Principais

Todos os endpoints remotos exigem cabecalho `Authorization: Bearer <token>`.

| Recurso   | Metodo(s)        | Endpoint(s)                                                                                | Observacoes                                               |
| --------- | ---------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Pessoas   | GET, POST        | `/api/pessoas`                                                                             | Lista e cria registros.                                   |
| Pessoas   | PUT              | `/api/pessoas/:id`                                                                         | Atualiza dados da pessoa.                                 |
| Pessoas   | GET              | `/api/pessoas/history/:id`                                                                 | Retorna historico de edicoes.                             |
| Materiais | GET, POST        | `/api/materiais`                                                                           | Consulta e cria materiais.                                |
| Materiais | PUT              | `/api/materiais/:id`                                                                       | Atualiza material existente.                              |
| Materiais | GET              | `/api/materiais/price-history/:id`                                                         | Historico de precos.                                      |
| Materiais | GET              | `/api/materiais/groups`                                                                     | Lista grupos cadastrados para vincular aos EPIs.         |
| Entradas  | GET, POST        | `/api/entradas`                                                                            | Movimentacoes de entrada.                                 |
| Saidas    | GET, POST        | `/api/saidas`                                                                              | Movimentacoes de saida.                                   |
| Estoque   | GET              | `/api/estoque`                                                                             | Snapshot atual (aceita filtros como `periodoInicio`).     |
| Estoque   | GET              | `/api/estoque?view=dashboard`                                                              | Dashboard consolidado (mesmos filtros via query string).  |
| Acidentes | GET, POST        | `/api/acidentes`                                                                           | Lista e cria acidentes.                                   |
| Acidentes | PUT              | `/api/acidentes/:id`                                                                       | Atualizacao de acidente.                                  |
| Health    | GET              | `/api/health`                                                                              | Checagem autenticada de saude.                            |

## Scripts Disponiveis

| Script            | Descricao                                         |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Inicia o Vite em modo desenvolvimento.           |
| `npm run build`   | Gera build de producao.                          |
| `npm run preview` | Servidor local para inspecionar a build.         |
| `npm run lint`    | Executa ESLint nos arquivos do frontend.         |

## Estrutura de Pastas

```
.
api/
  index.js              # roteador principal das rotas /api/*
  pessoas/
    [id].js             # leitura e atualizacao por id
  materiais/
    [id].js
  acidentes/
    [id].js
  _shared/              # autenticacao, http helpers, operations
docs/                   # documentacao funcional e guias
src/
  components/           # componentes reutilizaveis
  pages/                # telas (Dashboard, Estoque, etc.)
  context/              # AuthContext e providers
  services/
    api.js              # cliente HTTP remoto
    localApi.js         # implementacao local
    dataClient.js       # escolhe entre remoto e local
  routes/               # servidor Express opcional (modo legado)
  lib/estoque.js        # calculos compartilhados
package.json
```

## Fluxo de Autenticacao e RLS

1. No modo remoto, o usuario autentica pelo Supabase Auth (`/login`).
2. O token de acesso e mantido pelo SDK e aplicado nas chamadas a `/api/*` via `dataClient`.
3. Cada funcao serverless valida o token e executa as operacoes no Supabase (respeitando RLS).
4. Em modo local, `AuthContext` valida apenas as credenciais do `.env.local` e os dados trafegam dentro do navegador.

## Referencias de Documentacao

- `docs/Login.txt`, `docs/Dashboard.txt`, `docs/Entradas.txt`, `docs/Estoque.txt`, `docs/Materiais.txt`, `docs/Pessoas.txt`, `docs/Saidas.txt`.
- `docs/rls-policies-guide.txt` para as politicas de seguranca no Supabase.
- `docs/stateless-supabase-notes.txt` para detalhes do backend stateless.
- `docs/data-mode-guide.txt` para alternar entre modo local e Supabase.

## Proximos Passos

- Finalizar politicas RLS e testar com perfis diferentes.
- Popular dados reais para validar relatorios.
- Adicionar testes automatizados (UI e unitarios) para fluxos criticos.
- Monitorar tamanho do bundle e considerar code splitting.
- Avaliar logs/metricas para funcoes serverless e Supabase.

---

Sugestoes e melhorias sao bem-vindas. Abra uma issue ou envie um PR!

