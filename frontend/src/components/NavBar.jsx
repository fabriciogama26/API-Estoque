import '../styles/NavBar.css'
import { NavLink } from 'react-router-dom'

const navItems = [
  {
    title: 'Visão Geral',
    items: [
      { to: '/', label: 'Dashboard principal', end: true },
      { to: '/estoque', label: 'Estoque Atual' },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      { to: '/cadastros/pessoas', label: 'Pessoas' },
      { to: '/cadastros/materiais', label: "EPI's" },
    ],
  },
  {
    title: 'Movimentações',
    items: [
      { to: '/movimentacoes/entradas', label: 'Entradas' },
      { to: '/movimentacoes/saidas', label: 'Saídas' },
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
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
