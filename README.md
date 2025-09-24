# API Estoque

Projeto full stack para controle de EPIs, composto por um backend em Node.js/Express e um frontend React criado com Vite.

## Tecnologias principais
- Node.js 20+
- Express 4
- uuid para identificadores unicos
- Vite 7 + React 19
- ESLint para padronizacao de codigo

## Estrutura de pastas
```
/
+- backend/
¦  +- package.json
¦  +- .env.example
¦  +- src/
¦     +- app.js
¦     +- config/
¦     +- controllers/
¦     +- models/
¦     +- repositories/
¦     +- routes/
¦     +- rules/
¦     +- services/
+- frontend/
¦  +- package.json
¦  +- vite.config.js
¦  +- src/
¦     +- App.jsx
¦     +- App.css
¦     +- index.css
¦     +- main.jsx
+- README.md
```

## Como executar rapidamente

1. `npm install` (raiz). As dependencias de `backend/` e `frontend/` sao instaladas automaticamente via npm workspaces.
2. `npm run dev` para iniciar backend (porta 3000) e frontend (porta 5173) em paralelo.

Scripts uteis:
- `npm run backend:dev` para subir apenas o backend com nodemon.
- `npm run backend:start` para rodar o backend sem nodemon.
- `npm run frontend:dev` para subir apenas o frontend Vite.
- `npm run frontend:build` para gerar a build de producao.
## Backend (Node.js)
- Arquitetura modular separando controllers, services, repositories, models e regras de validacao.
- Persistencia em memoria por meio de repositories baseados em Map (facil de substituir por banco real).
- Regras de negocio centralizadas em `src/rules/` para entrada, saida, estoque, materiais e pessoas.
- Historico de precos por material sem sobrescrita de valores anteriores.
- Calculo de estoque atual, alertas de estoque minimo e dashboard de movimentacoes.
- Endpoints principais expostos em `/api`:
  - `GET /api/health`
  - CRUD de materiais, pessoas, entradas e saidas
  - Relatorios de estoque e dashboard

### Variaveis de ambiente
Copie `backend/.env.example` para `backend/.env` e ajuste conforme necessario:
```
PORT=3000
APP_USERNAME=admin
APP_PASSWORD=admin123
APP_DISPLAY_NAME=Administrador
```
As credenciais padrao sao usadas na tela de login, mas devem ser alteradas para producao.

### Executar o backend
```
cd backend
npm install
npm run dev
```
O servidor inicia em `http://localhost:3000`.

## Frontend (Vite + React)
- Aplicacao criada com Vite, conectada ao backend via proxy de desenvolvimento (`/api`).
- Tela inicial monitora o endpoint de health check e lista proximos passos para evolucao do painel.
- Estilos basicos responsivos em `App.css` e `index.css`.

### Configuracoes uteis
- `frontend/vite.config.js` aceita variaveis `VITE_PORT` e `VITE_API_URL` para ajustar porta e origem do backend.
- Crie `.env.local` dentro de `frontend/` caso precise sobrescrever valores padrao.

### Executar o frontend
```
cd frontend
npm install
npm run dev
```
O Vite sobe em `http://localhost:5173` e encaminha chamadas `/api` para o backend.

### Telas implementadas
- Login validando credenciais via `POST /api/auth/login` e armazenando usuario no `localStorage`.
- Home com atalhos para cadastros, movimentacoes e monitoramento.
- Pessoas: formulario + listagem consumindo `/api/pessoas`.
- Materiais: cadastro completo e historico de precos sob demanda.
- Entradas e Saidas: formularios com selects dinamicos usando dados cadastrados.
- Estoque atual: filtros por periodo, alertas e resumo de valores.
- Dashboard: indicadores de movimentacao, materiais mais movimentados e alertas de estoque.
## Regras de negocio principais
1. Material precisa estar cadastrado para permitir entradas e saidas.
2. Alteracao de valor unitario gera novo registro no historico, sem sobrescrever.
3. Estoque minimo configuravel por material com alerta quando atingido.
4. Validade do EPI (em dias) calcula a data de troca na saida.
5. Saidas bloqueiam estoque negativo; quantidade precisa estar disponivel.
6. Pessoas podem ter nomes duplicados, mas devem ser diferenciadas por ID.
7. Campos como CA, validade e valor sao preenchidos automaticamente a partir do material selecionado.

## Roadmap sugerido
- Integrar banco de dados relacional ou NoSQL para persistencia definitiva.
- Implementar autenticacao e autorizacao nas rotas sensiveis.
- Criar telas completas de cadastro, movimentacao e dashboard no frontend.
- Adicionar testes automatizados (unitarios e integrados) para regras criticas.












## Documentação de Telas
- A pasta `docs/` contém um arquivo `.txt` por tela com o detalhamento completo de fluxos, campos, validações, contratos de API, regras de negócio e referências às entidades persistidas.
- Arquivos disponíveis:
  - `docs/Login.txt`
  - `docs/Dashboard.txt`
  - `docs/Estoque.txt`
  - `docs/Materiais.txt`
  - `docs/Pessoas.txt`
  - `docs/Entradas.txt`
  - `docs/Saidas.txt`

Consulte esses arquivos para alinhar comportamento esperado entre desenvolvimento, QA e análise de requisitos.
