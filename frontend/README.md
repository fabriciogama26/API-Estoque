# Frontend - API Estoque

Frontend React criado com Vite para consumir a API de estoque. Agora inclui Recharts para visualizacao dos indicadores. O projeto possui roteamento completo, autenticacao basica (via endpoint dedicado) e todas as telas principais do fluxo descrito no README raiz.

## Scripts uteis
- `npm run dev`: inicia o servidor de desenvolvimento em `http://localhost:5173` com proxy para `/api`.
- `npm run build`: gera a build de producao na pasta `dist/`.
- `npm run preview`: serve a build gerada.
- `npm run lint`: executa as verificacoes de lint padrao.

## Estrutura principal
```
src/
+- App.jsx (definicao de rotas)
+- App.css / index.css (estilos globais)
+- context/AuthContext.jsx (estado de autenticacao)
+- layouts/MainLayout.jsx (shell com menu lateral)
+- components/ProtectedRoute.jsx, NavBar.jsx, PageHeader.jsx, charts/* (Recharts)
+- pages/
   +- LoginPage.jsx
   +- HomePage.jsx
   +- PessoasPage.jsx
   +- MateriaisPage.jsx
   +- EntradasPage.jsx
   +- SaidasPage.jsx
   +- EstoquePage.jsx
   +- DashboardPage.jsx
+- services/api.js (cliente fetch para a API)
```

## Telas disponiveis
- **Login:** valida credenciais via `POST /api/auth/login` e salva o usuario no `localStorage`.
- **Pessoas:** formulario + listagem consumindo `/api/pessoas`.
- **Materiais:** cadastro completo e historico de precos on-demand.
- **Entradas/Saidas:** registram movimentacoes com selects dinamicos.
- **Estoque Atual:** filtros por ano/mes e alertas de minimo.
- **Dashboard:** metricas de entradas/saidas, top materiais e alertas de estoque com graficos (linhas, barras, pizza).

## Configuracao
- Ajuste `VITE_API_URL` em `.env.local` caso o backend rode em outra origem.
- Credenciais padrao (definidas no backend): `admin` / `admin123`.

## Proximos passos sugeridos
- Substituir a autenticacao basica por um fluxo com tokens (ex.: JWT) e expirar sessao automaticamente.
- Adicionar componentes de tabela/visualizacao (ex.: TanStack Table) para complementar os graficos ja implementados.
- Evoluir feedback visual (toasts, skeletons) e tratar estados de erro/carregamento por pagina.


