import { Outlet } from 'react-router-dom'
import { NavBar } from '../components/NavBar.jsx'
import { SystemStatus } from '../components/SystemStatus.jsx'
import '../styles/layout.css'

const logoSrc = '/proteg.png'

export function MainLayout() {
  return (
    <div className="layout">
      <aside className="sidebar sidebar--expanded">
        <div className="sidebar__brand">
          <img src={logoSrc} alt="EpicControl" className="sidebar__brand-image" />
          <div className="sidebar__brand-text">
          </div>
        </div>
        <NavBar />
        <SystemStatus className="sidebar__system-status" />
      </aside>
      <div className="layout-content">
        <main className="layout-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
