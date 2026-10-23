import { useState } from 'react'
import { Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { clearSession } from '../services/mockAuth'

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  function handleLogout() {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-layout">
      <button
        type="button"
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={sidebarOpen}
      >
        <Menu size={20} />
      </button>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} />

      <main className="app-content">
        {children}
      </main>
    </div>
  )
}
