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
import { usePermissions } from '../context/PermissionsContext.jsx'

const navSections = [
  {
    id: 'overview',
    title: 'Visao Geral',
    icon: BarsIcon,
    collapsible: false,
    items: [
      { to: '/', label: 'Dashboard Estoque', icon: DashboardIcon, pageId: 'dashboard' },
      { to: '/dashboard/acidentes', label: 'Dashboard Acidentes', icon: AlertIcon, pageId: 'dashboard-acidentes' },
    ],
  },
  {
    id: 'estoque',
    title: 'Estoque',
    icon: InventoryIcon,
    items: [
      { to: '/estoque', label: 'Estoque Atual', icon: ChecklistIcon, pageId: 'estoque' },
      { to: '/movimentacoes/entradas', label: 'Entradas', icon: EntryIcon, pageId: 'entradas' },
      { to: '/movimentacoes/saidas', label: 'Saidas', icon: ExitIcon, pageId: 'saidas' },
    ],
  },
  {
    id: 'acidentes',
    title: 'Acidentes',
    icon: AlertIcon,
    items: [
      { to: '/acidentes/cadastro', label: 'Cadastro de Acidentes', icon: ChecklistIcon, pageId: 'acidentes-cadastro' },
      { to: '/acidentes/hht-mensal', label: 'HHT Mensal', icon: ChecklistIcon, pageId: 'acidentes-hht-mensal' },
    ],
  },
  {
    id: 'cadastros',
    title: 'Cadastros',
    icon: PeopleIcon,
    items: [
      { to: '/cadastros/pessoas', label: 'Pessoas', icon: PeopleIcon, pageId: 'cadastros-pessoas' },
      { to: '/cadastros/materiais', label: "Materiais", icon: MaterialIcon, pageId: 'cadastros-materiais' },
      { to: '/cadastros/base', label: 'Cadastro Base', icon: ChecklistIcon, pageId: 'cadastros-base' },
    ],
  },
  {
    id: 'termos',
    title: 'Termos',
    icon: ChecklistIcon,
    items: [{ to: '/documentos/termo-epi', label: 'Termo de EPI', icon: ChecklistIcon, pageId: 'termo-epi' }],
  },
]

const shouldOpenSection = (pathname, section) =>
  section.items?.some((item) => pathname.startsWith(item.to))

export function NavBar() {
  const location = useLocation()
  const { canAccessPath } = usePermissions()

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
        const visibleItems = (section.items || []).filter((item) => canAccessPath(item.to))

        if (!visibleItems.length) {
          return null
        }

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
                {visibleItems.map((item) => {
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
