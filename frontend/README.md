# Frontend - API Estoque

Aplicacao React 19 criada com Vite 7 para consumir a API de estoque e entregar dashboards, cadastros e controles de EPI. O projeto faz parte do monorepo `API Estoque` e herda dependencias via npm workspaces.

## Visao geral
- Navegacao protegida com React Router 7 e `ProtectedRoute`, exibindo layout principal (`MainLayout`) apenas para usuarios autenticados.
- Contexto de autenticacao (`AuthContext`) armazena o usuario logado no `localStorage` e expira a sessao via logout manual.
- Conjunto completo de telas: login, pessoas, materiais, entradas, saidas, estoque atual e dashboard.
- Paginas de materiais e pessoas modularizadas com camadas config/rules/utils e componentes de UI reutilizaveis.
- Graficos interativos com Recharts (linhas, barras, pizza) usando dados agregados do endpoint `/api/estoque/dashboard`.
- Estilos modulares em `src/styles/` com base responsiva e arquivos por pagina/componente.

## Requisitos
- Node.js 20 ou superior.
- Backend rodando em `http://localhost:3000` (ou configure `VITE_API_URL`).

## Instalacao e execucao
1. `npm install`
2. `npm run dev`
3. Abra `http://localhost:5173`
4. Acesse com as credenciais padrao definidas no backend (`admin` / `admin123`).

## Scripts
- `npm run dev`: inicia o servidor Vite com HMR e proxy para `/api`.
- `npm run build`: gera a build de producao na pasta `dist/`.
- `npm run preview`: serve a build gerada localmente (use apos `npm run build`).
- `npm run lint`: executa ESLint com a configuracao padrao do projeto.

## Estrutura principal
````
src/
|- App.jsx              # Define rotas protegidas e layout principal
|- main.jsx             # Ponto de entrada e providers globais
|- context/
|  |- AuthContext.jsx
|- layouts/
|  |- MainLayout.jsx
|- components/
|  |- PageHeader.jsx
|  |- Materiais/        # Componentes especificos da tela de materiais
|     |- MateriaisForm.jsx
|     |- MateriaisFilters.jsx
|     |- MateriaisTable.jsx
|     |- MateriaisActions.jsx
|     |- MateriaisHistoryModal.jsx
|     |- MateriaisHistoricoTimeline.jsx
|  |- Pessoas/          # Componentes especificos da tela de pessoas
|     |- PessoasForm.jsx
|     |- PessoasFilters.jsx
|     |- PessoasTable.jsx
|     |- PessoasActions.jsx
|     |- PessoasHistoryModal.jsx
|     |- PessoasHistoryTimeline.jsx
|  |- charts/
|     |- EntradasSaidasChart.jsx
|     |- ValorMovimentadoChart.jsx
|     |- EstoqueCharts.jsx
|     |- EstoqueCategoriaChart.jsx
|- config/
|  |- MateriaisConfig.js
|  |- PessoasConfig.js
|- rules/
|  |- MateriaisRules.js
|  |- PessoasRules.js
|- utils/
|  |- MateriaisUtils.js
|  |- PessoasUtils.js
|- pages/
|  |- LoginPage.jsx
|  |- Pessoas.jsx
|  |- Materiais.jsx
|  |- EntradasPage.jsx
|  |- SaidasPage.jsx
|  |- EstoquePage.jsx
|  |- DashboardPage.jsx
|- services/
|  |- api.js            # Cliente fetch com headers padrao e helpers
|- styles/
   |- base.css
   |- charts.css
   |- App.css
   |- index.css
   |- MateriaisPage.css # Estilos compartilhados para tabelas, historicos e pagina de materiais
```


## Autenticacao e autorizacao
- O login realiza `POST /api/auth/login` e salva o usuario retornado no contexto global.
- `ProtectedRoute` bloqueia acesso a rotas privadas redirecionando para `/login` quando nao ha usuario ativo.
- O menu lateral inclui opcao de logout que limpa o estado e o `localStorage`.

## Comunicacao com o backend
- `services/api.js` centraliza chamadas via `fetch`, tratando base URL, cabecalhos JSON e helpers para parse de resposta.
- Todos os formularios usam funcoes do service para listar, criar e atualizar dados de materiais, pessoas, entradas e saidas.
- Filtros de dashboard e estoque aceitam periodo (ano/mes ou intervalo) replicando os parametros do backend.

## Estilos e UI
- `src/styles/base.css` define tipografia, reset e tokens de cor.
- Layout responsivo com menu lateral colapsavel e componentes reutilizaveis (`PageHeader`, cards, tabelas).
- Paginas apresentam estados de carregamento, vazios e mensagens de erro basicas.

## Configuracoes
- Crie `frontend/.env.local` com `VITE_API_URL=<url>` quando o backend estiver em outra origem.
- O proxy Vite (`vite.config.js`) encaminha `/api` para `http://localhost:3000` durante o desenvolvimento.

## Qualidade e manutencao
- Utilize `npm run lint` antes de enviar alteracoes para garantir padrao de codigo.
- Recomenda-se adicionar testes de integracao (ex.: React Testing Library) e mocks de API futuros.

## Roadmap sugerido
- Implementar controle de expiracao automatica da sessao (timeout ou refresh).
- Integrar componentes de tabela (ex.: TanStack Table) para melhorar listagens extensas.
- Adicionar feedback visual (toasts, skeletons, loaders) padronizado.
- Criar camada de internacionalizacao para mensagens e labels.


