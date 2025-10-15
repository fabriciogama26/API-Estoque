import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import { MainLayout } from './layouts/MainLayout.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { PessoasPage } from './pages/Pessoas.jsx'
import { ConfiguracoesPage } from './pages/Configuracoes.jsx'
import { MateriaisPage } from './pages/Materiais.jsx'
import { EntradasPage } from './pages/EntradasPage.jsx'
import { SaidasPage } from './pages/SaidasPage.jsx'
import { EstoquePage } from './pages/EstoquePage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { AcidentesPage } from './pages/Acidentes.jsx'
import { TermosEpiPage } from './pages/TermosEpiPage.jsx'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="dashboard/acidentes" element={<AcidentesPage />} />
          <Route path="estoque" element={<EstoquePage />} />

          <Route path="cadastros">
            <Route path="pessoas" element={<PessoasPage />} />
            <Route path="materiais" element={<MateriaisPage />} />
          </Route>

          <Route path="acidentes">
            <Route path="cadastro" element={<AcidentesPage />} />
          </Route>

          <Route path="configuracoes" element={<ConfiguracoesPage />} />

          <Route path="movimentacoes">
            <Route path="entradas" element={<EntradasPage />} />
            <Route path="saidas" element={<SaidasPage />} />
          </Route>

          <Route path="termos">
            <Route path="epi" element={<TermosEpiPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
