import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  BarsIcon,
  DashboardIcon,
  InventoryIcon,
  AlertIcon,
  PeopleIcon,
  MaterialIcon,
  EntryIcon,
  ExitIcon,
  ChecklistIcon,
  ChevronIcon,
} from './icons.jsx'

const navSections = [
  {
    id: 'overview',
    title: 'Visao Geral',
    icon: BarsIcon,
    collapsible: false,
    items: [
      { to: '/', label: 'Dashboard Estoque', icon: DashboardIcon },
      { to: '/dashboard/acidentes', label: 'Dashboard Acidentes', icon: AlertIcon },
    ],
  },
  {
    id: 'estoque',
    title: 'Estoque',
    icon: InventoryIcon,
    items: [
      { to: '/estoque', label: 'Estoque Atual', icon: ChecklistIcon },
      { to: '/movimentacoes/entradas', label: 'Entradas', icon: EntryIcon },
      { to: '/movimentacoes/saidas', label: 'Saidas', icon: ExitIcon },
    ],
  },
  {
    id: 'acidentes',
    title: 'Acidentes',
    icon: AlertIcon,
    items: [
      { to: '/acidentes/cadastro', label: 'Cadastro de Acidentes', icon: ChecklistIcon },
    ],
  },
  {
    id: 'cadastros',
    title: 'Cadastros',
    icon: PeopleIcon,
    items: [
      { to: '/cadastros/pessoas', label: 'Pessoas', icon: PeopleIcon },
      { to: '/cadastros/materiais', label: "EPI's", icon: MaterialIcon },
    ],
  },
]

const shouldOpenSection = (pathname, section) =>
  section.items?.some((item) => pathname.startsWith(item.to))

export function NavBar() {
  const location = useLocation()

  const [openSections, setOpenSections] = useState(() =>
    navSections.reduce((acc, section) => {
      acc[section.id] = !section.collapsible || shouldOpenSection(location.pathname, section)
      return acc
    }, {}),
  )

  useEffect(() => {
    setOpenSections((prev) => {
      const next = { ...prev }
      navSections.forEach((section) => {
        if (section.collapsible === false) {
          next[section.id] = true
          return
        }
        if (shouldOpenSection(location.pathname, section)) {
          next[section.id] = true
        }
      })
      return next
    })
  }, [location.pathname])

  const handleToggle = (sectionId, collapsible) => {
    if (collapsible === false) {
      return
    }
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }

  return (
    <nav className="sidebar__nav">
      {navSections.map((section) => {
        const SectionIcon = section.icon
        const isOpen = openSections[section.id]
        const collapsible = section.collapsible !== false

        return (
          <div key={section.id} className="sidebar__section">
            <button
              type="button"
              className="sidebar__section-header"
              onClick={() => handleToggle(section.id, collapsible)}
              aria-expanded={collapsible ? isOpen : true}
              aria-controls={`section-${section.id}`}
            >
              <span className="sidebar__section-info">
                {SectionIcon ? (
                  <span className="sidebar__section-icon" aria-hidden="true">
                    <SectionIcon size={16} />
                  </span>
                ) : null}
                <span>{section.title}</span>
              </span>
              {collapsible ? (
                <span className={`sidebar__chevron ${isOpen ? 'sidebar__chevron--open' : ''}`} aria-hidden="true">
                  <ChevronIcon size={14} />
                </span>
              ) : null}
            </button>

            {(!collapsible || isOpen) && (
              <ul className="sidebar__list" id={`section-${section.id}`}>
                {section.items?.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
                      >
                        {Icon ? (
                          <span className="sidebar__icon" aria-hidden="true">
                            <Icon size={16} />
                          </span>
                        ) : null}
                        <span className="sidebar__label">{item.label}</span>
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )
}
