import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FileText, CreditCard, AlertCircle, User, LogOut, Menu, X, Shield,
} from 'lucide-react'
import { clearSession, getSession, getPhoto } from '../services/mockAuth'
import useOrganizationName from '../components/useOrganizationName'
import './CustomerLayout.css'

const navItems = [
  { label: 'Dashboard',   icon: LayoutDashboard, path: '/customer/dashboard' },
  { label: 'My Policies', icon: FileText,         path: '/customer/policies'  },
  { label: 'Payments',    icon: CreditCard,       path: '/customer/payments'  },
  { label: 'My Claims',   icon: AlertCircle,      path: '/customer/claims'    },
  { label: 'My Profile',  icon: User,             path: '/customer/profile'   },
]

export default function CustomerLayout({ children }) {
  const organizationName = useOrganizationName()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [session, setSession] = useState(() => getSession())
  const [sidebarPhoto, setSidebarPhoto] = useState(() => getPhoto())
  const navigate = useNavigate()
  const location = useLocation()

  // Re-read session and photo whenever a profile save updates them
  useEffect(() => {
    function onSessionUpdated() {
      setSession(getSession())
      setSidebarPhoto(getPhoto())
    }
    window.addEventListener('emple:session-updated', onSessionUpdated)
    return () => window.removeEventListener('emple:session-updated', onSessionUpdated)
  }, [])

  function handleLogout() {
    clearSession()
    navigate('/login', { replace: true })
  }

  function handleNav(path) {
    navigate(path)
    setDrawerOpen(false)
  }

  return (
    <div className="cl-layout">

      {/* ── Mobile top bar ── */}
      <div className="cl-topbar">
        <button
          type="button"
          className="cl-menu-btn"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
          aria-controls="cl-sidebar"
        >
          <Menu size={20} />
        </button>
        <div className="cl-topbar-brand">
          <img src="/favicon.png" alt="" className="cl-topbar-favicon" aria-hidden="true" />
          <span>{organizationName}</span>
        </div>
      </div>

      {/* ── Overlay ── */}
      {drawerOpen && (
        <div
          className="cl-overlay"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        id="cl-sidebar"
        className={`cl-sidebar${drawerOpen ? ' cl-sidebar--open' : ''}`}
        aria-label="Customer navigation"
      >
        {/* Brand */}
        <div className="cl-brand">
          <Shield size={26} className="cl-brand-icon" aria-hidden="true" />
          <div className="cl-brand-text">
            {organizationName}
            <span>Customer Portal</span>
          </div>
          <button
            type="button"
            className="cl-close-btn"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="cl-nav" aria-label="Customer menu">
          <p className="cl-nav-label">My Account</p>
          <ul>
            {navItems.map(({ label, icon: Icon, path }) => {
              const active = location.pathname === path
              return (
                <li key={label}>
                  <button
                    type="button"
                    className={`cl-nav-item${active ? ' cl-nav-item--active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => handleNav(path)}
                  >
                    <Icon size={18} className="cl-nav-icon" aria-hidden="true" />
                    {label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Profile + Sign out */}
        <div className="cl-sidebar-footer">
          <div className="cl-profile">
            <div className="cl-profile-avatar" aria-hidden="true">
              {sidebarPhoto
                ? <img src={sidebarPhoto} alt="" className="cl-profile-avatar-img" />
                : (session?.name?.[0] ?? 'C')
              }
            </div>
            <div className="cl-profile-info">
              <span className="cl-profile-name">{session?.name ?? 'Customer'}</span>
              <span className="cl-profile-email">{session?.email ?? ''}</span>
            </div>
          </div>
          <button type="button" className="cl-signout-btn" onClick={handleLogout}>
            <LogOut size={16} aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="cl-content">
        {children}
      </main>

    </div>
  )
}
