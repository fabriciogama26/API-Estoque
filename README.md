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
| Backend           | Chamadas diretas ao Supabase via `@supabase/supabase-js`; backend serverless tornou-se opcional (apenas para recursos como geração de PDF). |

| Banco de Dados    | Supabase Postgres (`pessoas`, `materiais`, `entradas`, `saidas`, `acidentes`, `material_price_history`). Migrations em `supabase/migrations`. |
| Geração de PDFs   | Template compartilhado em `shared/documents/epiTermTemplate.js`; a geração automática de PDF requer uma camada serverless opcional. |

| Autenticação      | Supabase Auth no modo remoto. Em modo local, credenciais definidas via `.env.local`. |
| Regras de negócio | `src/lib/estoque.js` / `src/lib/acidentesDashboard.js` (cálculos compartilhados) aplicados no frontend após carregar dados do Supabase. |


> Estilos dos dashboards: `src/styles/DashboardPage.css` organiza o layout e `src/styles/charts.css` agrupa helpers de graficos compartilhados.

## Requisitos

- Node.js 20+
- npm 10+
- Conta Supabase (para modo remoto)
- Conta Vercel (deploy do frontend e, opcionalmente, de funções serverless)

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
| `VITE_DATA_MODE`             | `remote` (padrão) usa Supabase; `local` persiste no `localStorage`.                        |
| `VITE_LOCAL_USERNAME`        | Usuário padrão do modo local (opcional, default `admin`).                                  |
| `VITE_LOCAL_PASSWORD`        | Senha padrão do modo local (opcional, default `admin123`).                                 |
| `VITE_LOCAL_DISPLAY_NAME`    | Nome exibido para o usuário local.                                                         |

Caso mantenha uma camada serverless (para recursos opcionais como geração de PDF) crie `.env` ou configure no painel da Vercel:

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
3. O deploy padrão executa `npm run build` para o frontend. Se você mantiver funções serverless, arquivos em `api/` continuarão sendo publicados como endpoints.\r\n4. Depois do deploy, valide o fluxo de login `/login` e realize uma consulta simples no Supabase (por exemplo via Supabase Studio).

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

## Operações Remotas

O módulo `src/services/api.js` utiliza `@supabase/supabase-js` para consultar e atualizar diretamente as tabelas (`pessoas`, `materiais`, `entradas`, `saidas`, `acidentes`, `material_price_history`).

- Todas as chamadas dependem de um usuário autenticado (`supabase.auth.signInWithPassword`).
- As policies RLS do Supabase controlam permissões de leitura/escrita.
- Para desenvolvimento offline continua disponível o modo local via `localApi`.

### Termo de EPI

- O contexto (dados do colaborador e entregas) é montado no frontend após consultar Supabase.
- A pré-visualização permanece renderizada com `buildEpiTermHtml`.
- A geração automática de PDF via backend foi desativada; o botão “Baixar PDF” apenas informa que o recurso está indisponível sem uma camada serverless.

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
2. O token de acesso é mantido pelo SDK e utilizado pelo `dataClient` para executar consultas/updates diretamente no Supabase.
3. As policies RLS determinam o que cada usuário pode ler/escrever; funções serverless tornam-se opcionais para cenários específicos.
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







