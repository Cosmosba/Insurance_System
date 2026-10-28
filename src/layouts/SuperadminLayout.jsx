import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Users, ShieldCheck,
  UserCheck, Activity, BarChart2, Settings,
  LogOut, Menu, X, Shield, ChevronRight,
} from 'lucide-react'
import { clearSession, getSession } from '../services/mockAuth'
import { hasPermission } from '../services/rolePermissions'
import useOrganizationName from '../components/useOrganizationName'
import './SuperadminLayout.css'

const navItems = [
  { label: 'Dashboard',          icon: LayoutDashboard, path: '/admin/dashboard', permission: 'dashboard.admin.view' },
  { label: 'Departments',        icon: Building2,       path: '/admin/departments', permission: 'departments.view' },
  { label: 'User Management',    icon: Users,           path: '/admin/users', permission: 'users.view' },
  { label: 'Roles & Permissions',icon: ShieldCheck,     path: '/admin/roles-permissions', permission: 'roles.view' },
  { label: 'Customer Management',icon: UserCheck,       path: '/admin/customers', permission: 'customers.view' },
  { label: 'System Activity',    icon: Activity,        path: '/admin/system-activity', permission: 'activity.view' },
  { label: 'Reports & Analytics',icon: BarChart2,       path: '/admin/reports', permission: 'reports.view' },
  { label: 'Settings',           icon: Settings,        path: '/admin/settings', permission: 'settings.manage' },
]

// Modules not yet implemented — navigating to these paths falls through to /login
// via the catch-all route until each module is built.
const IMPLEMENTED = new Set(['/admin/dashboard', '/admin/departments', '/admin/users', '/admin/roles-permissions', '/admin/customers', '/admin/system-activity', '/admin/reports', '/admin/settings'])

export default function SuperadminLayout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [session, setSession]       = useState(() => getSession())
  const organizationName = useOrganizationName()
  const navigate  = useNavigate()
  const location  = useLocation()

  useEffect(() => {
    function onUpdate() { setSession(getSession()) }
    window.addEventListener('emple:session-updated', onUpdate)
    return () => window.removeEventListener('emple:session-updated', onUpdate)
  }, [])

  function handleLogout() {
    clearSession()
    navigate('/login', { replace: true })
  }

  function handleNav(path) {
    navigate(path)
    setDrawerOpen(false)
  }

  const initials = session?.name
    ? session.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'SA'

  return (
    <div className="sal-layout">

      {/* ── Mobile top bar ── */}
      <div className="sal-topbar">
        <button
          type="button"
          className="sal-menu-btn"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
          aria-controls="sal-sidebar"
        >
          <Menu size={20} />
        </button>
        <div className="sal-topbar-brand">
          <Shield size={18} className="sal-topbar-icon" aria-hidden="true" />
          <span>emPLE Admin</span>
        </div>
      </div>

      {/* ── Overlay ── */}
      {drawerOpen && (
        <div
          className="sal-overlay"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        id="sal-sidebar"
        className={`sal-sidebar${drawerOpen ? ' sal-sidebar--open' : ''}`}
        aria-label="Superadmin navigation"
      >
        {/* Brand */}
        <div className="sal-brand">
          <Shield size={24} className="sal-brand-icon" aria-hidden="true" />
          <div className="sal-brand-text">
            {organizationName}
            <span>Admin Console</span>
          </div>
          <button
            type="button"
            className="sal-close-btn"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="sal-nav" aria-label="Admin menu">
          <p className="sal-nav-label">Administration</p>
          <ul>
            {navItems.filter(item => hasPermission(session, item.permission)).map(({ label, icon: Icon, path }) => {
              const active = location.pathname === path || location.pathname.startsWith(`${path}/`)
              const ready  = IMPLEMENTED.has(path)
              return (
                <li key={label}>
                  <button
                    type="button"
                    className={`sal-nav-item${active ? ' sal-nav-item--active' : ''}${!ready ? ' sal-nav-item--soon' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => handleNav(path)}
                  >
                    <Icon size={17} className="sal-nav-icon" aria-hidden="true" />
                    <span className="sal-nav-label-text">{label}</span>
                    {!ready && <span className="sal-nav-soon" aria-label="coming soon">Soon</span>}
                    {active && <ChevronRight size={14} className="sal-nav-active-arrow" aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Account footer */}
        <div className="sal-footer">
          <div className="sal-account">
            <div className="sal-account-avatar" aria-hidden="true">{initials}</div>
            <div className="sal-account-info">
              <span className="sal-account-name">{session?.name ?? 'Administrator'}</span>
              <span className="sal-account-role">Superadmin</span>
            </div>
          </div>
          <button type="button" className="sal-signout-btn" onClick={handleLogout}>
            <LogOut size={15} aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="sal-main">
        {/* Top header */}
        <header className="sal-topheader">
          <span className="sal-page-title">
            {navItems.find(n => location.pathname.startsWith(n.path))?.label ?? 'Admin Console'}
          </span>
          <div className="sal-topheader-right">
            <span className="sal-topheader-email">{session?.email}</span>
            <div className="sal-topheader-avatar" aria-hidden="true">{initials}</div>
          </div>
        </header>

        {/* Content */}
        <main className="sal-content">
          {children}
        </main>
      </div>

    </div>
  )
}
