import { Shield, LayoutDashboard, Users, FileText, CreditCard, AlertCircle, Settings, LogOut } from 'lucide-react'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Customers', icon: Users },
  { label: 'Policies', icon: FileText },
  { label: 'Payments', icon: CreditCard },
  { label: 'Claims', icon: AlertCircle },
  { label: 'Settings', icon: Settings },
]

export default function Sidebar({ isOpen, onClose, onLogout }) {
  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />}
      <aside className={`sidebar${isOpen ? ' sidebar-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <Shield size={28} className="sidebar-brand-icon" aria-hidden="true" />
          <div className="sidebar-brand-name">
            Emple Life Insurance
            <span>Management System</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <p className="sidebar-nav-label">Main Menu</p>
          <ul>
            {navItems.map(({ label, icon: Icon, active }) => (
              <li key={label}>
                <button
                  type="button"
                  className={`nav-item${active ? ' active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={18} className="nav-icon" aria-hidden="true" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-signout">
          <button type="button" className="signout-btn" onClick={onLogout}>
            <LogOut size={18} aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
