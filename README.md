# API-Estoque

Aplicação completa para controle de EPIs com frontend React (Vite) e backend serverless hospedado na Vercel, utilizando Supabase como provedor de autenticação e banco de dados. A plataforma contempla cadastro de pessoas e materiais, registros de entradas/saídas, acompanhamento do estoque em tempo real e gerenciamento de acidentes de trabalho.

## Sumário

- [Arquitetura](#arquitetura)
- [Requisitos](#requisitos)
- [Configuração do Ambiente](#configuração-do-ambiente)
  - [Variáveis de Ambiente](#variáveis-de-ambiente)
  - [Supabase](#supabase)
  - [Vercel](#vercel)
- [Execução Local](#execução-local)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Fluxo de Autenticação e RLS](#fluxo-de-autenticação-e-rls)
- [Referências de Documentação](#referências-de-documentação)
- [Próximos Passos](#próximos-passos)

## Arquitetura

| Camada            | Descrição                                                                 |
| ----------------- | -------------------------------------------------------------------------- |
| Frontend          | React 19 + Vite. Consome as rotas serverless via `src/services/api.js`.    |
| Backend           | Funções serverless na Vercel (pasta `api/`). Cada handler valida o token Supabase e acessa o banco com a chave de serviço. |
| Banco de Dados    | Supabase Postgres. Tabelas principais: `pessoas`, `materiais`, `entradas`, `saidas`, `acidentes`, `material_price_history`. |
| Autenticação      | Supabase Auth (e-mail/senha). O token é usado em todas as chamadas para `/api`. |
| Regras de Negócio | Helpers em `api/_shared/operations.js` e `src/lib/estoque.js` centralizam validações e cálculos. |

## Requisitos

- Node.js 20+
- npm 10+
- Conta Supabase (projeto com Postgres e Auth)
- Conta Vercel (para deploy das funções e frontend estático)

## Configuração do Ambiente

Clone o repositório e instale dependências:

```bash
git clone <url-do-repo>
cd API-Estoque
npm install
```

### Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz com as variáveis públicas usadas pelo Vite:

```bash
VITE_SUPABASE_URL=https://<sua-url>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_API_URL=http://localhost:5173  # em desenvolvimento o Vite fará proxy das rotas /api
```

No ambiente das funções serverless (local com `vercel dev` ou produção na Vercel) configure também:

```bash
SUPABASE_URL=https://<sua-url>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

> **Atenção:** a chave de serviço **não** deve ser exposta ao frontend.

### Supabase

1. Crie um novo projeto Supabase.
2. Construa o schema seguindo o guia em [`docs/stateless-supabase-notes.txt`](docs/stateless-supabase-notes.txt) e políticas RLS conforme [`docs/rls-policies-guide.txt`](docs/rls-policies-guide.txt).
3. Cadastre as variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` na Vercel (`vercel env`) e localmente.
4. Opcional: execute migrations/TODOs extras para usuários padrão e seeds iniciais.

### Vercel

1. Conecte o repositório no dashboard da Vercel.
2. Ajuste os envs conforme seção anterior.
3. A Vercel detectará automaticamente o build do Vite (`npm run build`) e criará endpoints a partir da pasta `api/`.
4. Depois do primeiro deploy, confirme o funcionamento acessando `/login` e `/api/health` (com token válido).

## Execução Local

1. Garanta que as variáveis estejam definidas em `.env.local`.
2. Rode o servidor de desenvolvimento do Vite (inclui proxy para `/api`):

```bash
npm run dev
```

3. Abra `http://localhost:5173` e faça login com o usuário criado no Supabase Auth.
4. Para testar funções serverless localmente com as variáveis de produção, utilize `vercel dev` (opcional) após configurar o CLI.

## Scripts Disponíveis

| Script          | Descrição                                           |
| --------------- | --------------------------------------------------- |
| `npm run dev`   | Inicia o Vite em modo desenvolvimento.              |
| `npm run build` | Gera a build de produção (Vite).                    |
| `npm run preview` | Pré-visualiza a build de produção localmente.     |
| `npm run lint`  | Executa ESLint para checagem de código.             |

## Estrutura de Pastas

```
.
├── api/                     # Funções serverless (rotas protegidas)
│   ├── _shared/             # Autenticação, Supabase client e operações reutilizáveis
│   ├── pessoas/…            # CRUD de pessoas
│   ├── materiais/…          # CRUD de materiais e histórico de preços
│   ├── entradas/             # Registro de entradas de estoque
│   ├── saidas/               # Registro de saídas de estoque
│   ├── estoque/…             # Estoque atual e dashboard
│   ├── acidentes/…           # Registro e atualização de acidentes
│   └── health.js             # Checagem autenticada de status
├── docs/                    # Documentação funcional e técnica (telas, notas Supabase, RLS)
├── src/
│   ├── components/          # Componentes reutilizáveis
│   ├── pages/               # Páginas (Dashboard, Estoque, Materiais, etc.)
│   ├── context/             # Contexto de autenticação Supabase
│   ├── lib/estoque.js       # Regras de agregação/alertas reutilizadas no backend
│   ├── services/api.js      # Client HTTP que injeta token Bearer
│   └── services/supabaseClient.js # Cliente Supabase usado pelo frontend
└── package.json
```

## Fluxo de Autenticação e RLS

1. Usuário faz login pelo Supabase Auth (formulário em `/login`).
2. Access token é mantido pelo SDK e usado por `src/services/api.js` para chamar qualquer `/api` com o header `Authorization: Bearer <token>`.
3. Cada função serverless utiliza `requireAuth` para validar o token e injeta o usuário nas regras de negócio.
4. Rotas que manipulam dados sensíveis dependem das políticas RLS configuradas no Supabase. Consulte [`docs/rls-policies-guide.txt`](docs/rls-policies-guide.txt) para exemplos de políticas, testes e checklist de implantação.

## Referências de Documentação

- Telas e fluxos específicos estão descritos em `docs/` (Dashboard, Entradas, Estoque, Materiais, Pessoas, Saídas).
- Notas da migração stateless e configuração de ambiente: [`docs/stateless-supabase-notes.txt`](docs/stateless-supabase-notes.txt).
- Guia completo de políticas RLS: [`docs/rls-policies-guide.txt`](docs/rls-policies-guide.txt).

## Próximos Passos

- Finalizar políticas RLS conforme guia e testar com usuários de diferentes perfis.
- Popular dados iniciais (pessoas, materiais) para validar dashboards e relatórios.
- Considerar testes automatizados (UI e unit) para os principais fluxos.
- Avaliar code splitting para reduzir o bundle inicial apontado pelo Vite (`>500 kB`).
- Planejar monitoramento (logs, métricas) para funções serverless e Supabase.

---

Qualquer dúvida ou sugestão de melhoria, abra uma issue ou envie um PR! 😄
