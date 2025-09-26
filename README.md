# API Estoque

Projeto full stack para controle de estoque de EPIs (Equipamentos de Protecao Individual). O repositorio usa npm workspaces para agrupar um backend em Node.js/Express e um frontend em React 19 + Vite, compartilhando scripts e dependencias.

## Visao geral
- Backend em Node.js 20 com Express, validacoes em camadas (controllers, services, rules) e persistencia em memoria via repositories baseados em Map.
- Frontend em React 19 criado com Vite 7, React Router 7 e context de autenticacao, focado em dashboards e cadastros de estoque.
- Comunicacao via API REST em `/api`, com endpoints para materiais, pessoas, entradas, saidas, consulta de estoque e painel de dashboard.
- Documentos funcionais em `docs/` detalham fluxos, campos e regras para cada tela.

## Requisitos
- Node.js 20 ou superior
- npm 10 ou superior

## Configuracao rapida
1. Instale as dependencias na raiz: `npm install`.
2. Copie `backend/.env.example` para `backend/.env` e ajuste as variaveis conforme necessario.
3. Inicie backend e frontend em paralelo: 
pm run dev.
4. Configure as variáveis Supabase (opcionais) em rontend/.env.local e ackend/.env.supabase conforme necessidade.
5. Acesse o frontend em http://localhost:5173 (proxy para http://localhost:3000/api).

## Scripts npm
- `npm run dev`: inicia backend (porta 3000) e frontend (porta 5173) em paralelo.
- `npm run backend:dev`: sobe apenas o backend com nodemon.
- `npm run backend:start`: executa o backend em modo producao.
- `npm run backend:lint`: roda ESLint no backend.
- `npm run frontend:dev`: inicia apenas o frontend Vite.
- `npm run frontend:build`: gera build de producao do frontend.
- `npm run frontend:lint`: roda ESLint no frontend.
- `npm run preview -w frontend`: serve a build gerada (executar apos `frontend:build`).

## Estrutura principal
```
.
|- backend/
|  |- src/
|  |- package.json
|  |- .env.example
|- frontend/
|  |- src/
|  |- package.json
|  |- vite.config.js
|- docs/
|  |- Login.txt
|  |- ...
|- README.md
```

## Backend
### Principais recursos
- Organizacao em camadas: controllers -> services -> repositories -> rules, facilitando manutencao e evolucao.
- Persistencia em memoria com objetos Map, permitindo troca posterior por banco relacional ou NoSQL.
- Historico de precos para cada material, evitando sobrescrita de valores.
- Regras de negocio centralizadas em `src/rules/` para validar cadastros, movimentacoes e alertas de estoque minimo.
- Calculo de saldo atual de estoque, agregacao historica de movimentacoes e lista de materiais mais movimentados para o dashboard.
- Autenticacao basica baseada em credenciais configuradas via variaveis de ambiente.

### Endpoints principais (`/api`)
- `GET /health` — status da API.
- `POST /auth/login` — autentica usuario (credenciais definidas nas variaveis).
- `GET /materiais` — lista materiais cadastrados.
- `POST /materiais` — cadastra material (valida CA, validade, estoque minimo e duplicidade por fabricante).
- `GET /materiais/:id` — consulta material pelo identificador.
- `PUT /materiais/:id` — atualiza dados e registra historico de preco quando o valor muda.
- `GET /materiais/:id/historico-precos` — retorna historico de alteracoes de preco.
- `GET /pessoas` / `POST /pessoas` / `GET /pessoas/:id` — gerenciamento de pessoas.
- `GET /entradas` / `POST /entradas` — movimentacoes de entrada (valida material, datas e quantidade).
- `GET /saidas` / `POST /saidas` — movimentacoes de saida com bloqueio de estoque negativo e calculo de validade do EPI.
- `GET /estoque` — resumo de estoque atual com alertas de minimo (aceita filtros de periodo).
- `GET /estoque/dashboard` — indicadores consolidados para graficos (movimentacao, valores e alertas).

### Variaveis de ambiente
Arquivo `backend/.env`:
```
PORT=3000
APP_USERNAME=admin
APP_PASSWORD=admin123
APP_DISPLAY_NAME=Administrador
```
Adapte as credenciais e a porta conforme ambiente.

### Testes e validacoes
Ainda nao ha testes automatizados, mas a camada `rules/` concentra validacoes obrigatorias. Sugestao: adicionar testes unitarios para regras criticas e integracao dos endpoints.

## Frontend
### Principais recursos
- React 19 com Vite 7, React Router 7 e Context API para controle de autenticacao.
- Layout responsivo com menu lateral (`MainLayout`), cabecalho de pagina e navegacao protegida por `ProtectedRoute`.
- Telas para login, cadastros (pessoas e materiais), entradas, saidas, estoque atual e dashboard.
- Integracao com backend via `services/api.js`, incluindo armazenamento de token basico no `localStorage`.
- Graficos com Recharts (linhas, barras e pizza) para exibir movimentacao, valores e alertas do estoque.

### Configuracoes
- Ajuste `VITE_API_URL` em `frontend/.env.local` para apontar para outro backend.
- O proxy de desenvolvimento (`vite.config.js`) encaminha chamadas `/api` para `http://localhost:3000`.
- Credenciais padrao: `admin` / `admin123`.

### Estilos
- Estilos globais em `src/styles/base.css` e `index.css`.
- Cada pagina possui CSS dedicado em `src/styles/*Page.css`.
- Componentes de graficos usam `src/styles/charts.css` para manter padronizacao visual.

## Documentacao complementar
- A pasta `docs/` traz um arquivo `.txt` por tela (Login, Dashboard, Estoque, Materiais, Pessoas, Entradas, Saidas) com fluxos esperados, contratos de API e regras de negocio detalhadas.
- Planilhas (`Estoque.xlsx`, `Pessoas.xlsx`) podem ser usadas como referencia de dados de exemplo e relatorios.

## Roadmap sugerido
- Substituir armazenamento em memoria por banco de dados e camada de persistencia dedicada.
- Evoluir autenticacao para fluxo com tokens (ex.: JWT) e controle de expiracao.
- Implementar suite de testes automatizados (unitarios, integracao e e2e).
- Adicionar migracoes de dados ou seed inicial para ambientes de teste.
- Melhorar feedback visual no frontend (toasts, skeletons, estados de erro) e adicionar componentes de tabela.

