import '../styles/NavBar.css'
import { NavLink } from 'react-router-dom'
import {
  DashboardIcon,
  InventoryIcon,
  PeopleIcon,
  MaterialIcon,
  EntryIcon,
  ExitIcon,
} from './icons.jsx'

const navItems = [
  {
    title: 'Visao Geral',
    items: [
      { to: '/', label: 'Dashboard principal', end: true, icon: DashboardIcon },
      { to: '/estoque', label: 'Estoque Atual', icon: InventoryIcon },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      { to: '/cadastros/pessoas', label: 'Pessoas', icon: PeopleIcon },
      { to: '/cadastros/materiais', label: "EPI's", icon: MaterialIcon },
    ],
  },
  {
    title: 'Movimentacoes',
    items: [
      { to: '/movimentacoes/entradas', label: 'Entradas', icon: EntryIcon },
      { to: '/movimentacoes/saidas', label: 'Saidas', icon: ExitIcon },
    ],
  },
]

export function NavBar() {
  return (
    <nav className="sidebar">
      {navItems.map((section) => (
        <div key={section.title} className="sidebar__section">
          <p className="sidebar__section-title">{section.title}</p>
          <ul className="sidebar__list">
            {section.items.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
                    }
                  >
                    {Icon ? (
                      <span className="sidebar__icon" aria-hidden="true">
                        <Icon />
                      </span>
                    ) : null}
                    <span className="sidebar__label">{item.label}</span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
