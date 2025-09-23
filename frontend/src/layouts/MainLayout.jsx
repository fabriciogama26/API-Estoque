import { Outlet } from 'react-router-dom'
import { NavBar } from '../components/NavBar.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const logoSrc = '/logo_epicontrol.png'

export function MainLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="layout">
      <aside className="layout__sidebar">
        <div className="layout__brand">
          <img src={logoSrc} alt="EpicControl" className="layout__brand-image" />
          <div className="layout__brand-text">
            <span className="layout__brand-subtitle">Controle de EPI</span>
          </div>
        </div>
        <NavBar />
      </aside>
      <div className="layout__content">
        <header className="layout__topbar">
          <div className="layout__topbar-info">
            <p className="layout__topbar-title">Centro de Controle</p>
            <p className="layout__topbar-subtitle">Gerencie cadastros, estoque e movimentacoes.</p>
          </div>
          <div className="layout__topbar-user">
            <span>{user?.name ?? user?.username}</span>
            <button type="button" onClick={logout} className="button button--ghost">
              Sair
            </button>
          </div>
        </header>
        <main className="layout__main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
