import { Outlet } from 'react-router-dom'
import { NavBar } from '../components/NavBar.jsx'
import { SystemStatus } from '../components/SystemStatus.jsx'
import '../styles/layout.css'

const logoSrc = '/proteg.png'

export function MainLayout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="layout__brand">
          <img src={logoSrc} alt="EpicControl" className="layout__brand-image" />
          <div className="layout__brand-text">
          </div>
        </div>
        <NavBar />
        <SystemStatus className="layout__system-status" />
      </aside>
      <div className="layout__content">
        <main className="layout__main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
