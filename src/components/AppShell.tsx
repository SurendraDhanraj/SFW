import { NavLink, useLocation } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import type { ReactNode } from 'react'

const navItems = [
  { to: '/', icon: 'dashboard', label: 'Dashboard', end: true },
  { to: '/residents', icon: 'groups', label: 'Directory' },
  { to: '/issues/new', icon: 'add_location_alt', label: 'Report', isAction: true },
  { to: '/issues', icon: 'assignment_late', label: 'Issues' },
  { to: '/admin', icon: 'admin_panel_settings', label: 'Admin' },
]

export default function AppShell({ children }: { children: ReactNode }) {
  const user = useUser()
  const isDirector = user.role?.name === 'Director'

  return (
    <div className="app-shell">
      <main className="page-content">{children}</main>
      <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
        {navItems.map((item) => {
          if (item.to === '/admin' && !isDirector) return null
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-item${isActive ? ' active' : ''}${item.isAction ? ' nav-action' : ''}`
              }
              aria-label={item.label}
            >
              <span className="material-symbols-outlined nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
