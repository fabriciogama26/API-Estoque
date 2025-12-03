import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import { MainLayout } from './layouts/MainLayout.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { ResetPasswordPage } from './pages/ResetPasswordPage.jsx'
import { PessoasPage } from './pages/Pessoas.jsx'
import { ConfiguracoesPage } from './pages/Configuracoes.jsx'
import { MateriaisPage } from './pages/Materiais.jsx'
import { EntradasPage } from './pages/EntradasPage.jsx'
import { SaidasPage } from './pages/SaidasPage.jsx'
import { EstoquePage } from './pages/EstoquePage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { DashboardAcidentes } from './pages/DashboardAcidentes.jsx'
import { AcidentesPage } from './pages/Acidentes.jsx'
import { TermosEpiPage } from './pages/TermosEpiPage.jsx'
import { ErrorBoundaryWithLogger } from './components/ErrorBoundary.jsx'

function App() {
  return (
    <ErrorBoundaryWithLogger page="app-root">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="dashboard/acidentes" element={<DashboardAcidentes />} />
            <Route path="estoque" element={<EstoquePage />} />

            <Route path="cadastros">
              <Route path="pessoas" element={<PessoasPage />} />
              <Route path="materiais" element={<MateriaisPage />} />
            </Route>

            <Route path="acidentes">
              <Route path="cadastro" element={<AcidentesPage />} />
            </Route>

            <Route path="configuracoes" element={<ConfiguracoesPage />} />

            {/* Movimenta��es de estoque (alias para manter rotas antigas e menu novo) */}
            <Route path="entradas" element={<EntradasPage />} />
            <Route path="saidas" element={<SaidasPage />} />
            <Route path="movimentacoes">
              <Route path="entradas" element={<EntradasPage />} />
              <Route path="saidas" element={<SaidasPage />} />
            </Route>

            {/* Documentos */}
            <Route path="documentos/termo-epi" element={<TermosEpiPage />} />
            <Route path="termos/epi" element={<Navigate to="/documentos/termo-epi" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundaryWithLogger>
  )
}

export default App
