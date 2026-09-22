import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Settings, X } from 'lucide-react'
import { useAuth } from '@/lib/AuthProvider'
import { SigmaAssistant } from '@/components/assistant/SigmaAssistant'
import { NotificationBell } from '@/components/layout/NotificationBell'
import clsuLogo from '@/assets/clsu-logo.png'

const topNav = [
  { label: 'Dashboard', to: '/' },
  { label: 'Student Records', to: '/students' },
  { label: 'Scholarships', to: '/scholarships' },
  { label: 'Reports & Analytics', to: '/reports' },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [backLogoutOpen, setBackLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const backPressCount = useRef(0)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const guardState = { ...window.history.state, sigmaBackGuard: true }
    window.history.pushState(guardState, '', window.location.href)

    function handleBrowserBack() {
      window.history.pushState(guardState, '', window.location.href)

      if (backLogoutOpen) return

      backPressCount.current += 1
      if (backPressCount.current >= 3) {
        backPressCount.current = 0
        setBackLogoutOpen(true)
      }
    }

    window.addEventListener('popstate', handleBrowserBack)
    return () => window.removeEventListener('popstate', handleBrowserBack)
  }, [backLogoutOpen])

  function cancelBackLogout() {
    backPressCount.current = 0
    setBackLogoutOpen(false)
  }

  async function confirmBackLogout() {
    setLoggingOut(true)
    await signOut()
    navigate('/login', { replace: true })
  }

  const initials =
    user?.email
      ?.split('@')[0]
      .split(/[._]/)
      .map((p) => p[0]?.toUpperCase())
      .slice(0, 2)
      .join('') || 'SA'

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-app)' }}>
      <header className="border-b" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={clsuLogo} alt="CLSU seal" className="h-9 w-9" />
            <div>
              <p className="text-[10px] font-semibold tracking-wider" style={{ color: 'var(--text-muted)' }}>
                OFFICE OF ADMISSIONS
              </p>
              <p className="text-xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>
                SIGMA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium sm:flex"
              style={{ background: 'var(--menu-active-bg)', color: 'var(--menu-active-text)' }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--btn-primary-bg)' }} />
              Role: Admin
            </span>

            <NotificationBell />

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                title={user?.email ?? ''}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
              >
                {initials}
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-lg border shadow-lg"
                  style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
                >
                  <div className="border-b px-4 py-2.5" style={{ borderColor: 'var(--divider-light)' }}>
                    <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {user?.email}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Admin
                    </p>
                  </div>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate('/settings')
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:brightness-95"
                    style={{ color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
                  >
                    <Settings size={15} />
                    Account Settings
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      signOut()
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm"
                    style={{ color: 'var(--status-error-text)' }}
                  >
                    <LogOut size={15} />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <nav
          className="flex overflow-x-auto px-2 sm:px-6"
          style={{ background: `linear-gradient(to right, var(--nav-gradient-start), var(--nav-gradient-end))` }}
        >
          {topNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `shrink-0 px-4 py-3 text-sm font-medium text-white/90 transition ${
                  isActive ? 'border-b-2 border-white font-semibold text-white' : 'hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-[1600px]">
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>

      <SigmaAssistant />

      {backLogoutOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="back-logout-title"
        >
          <div
            className="relative w-full max-w-sm rounded-2xl p-7 text-center shadow-2xl"
            style={{ background: 'var(--bg-card)' }}
          >
            <button
              type="button"
              onClick={cancelBackLogout}
              aria-label="Close logout confirmation"
              className="absolute right-4 top-4 rounded-full p-1"
              style={{ color: 'var(--icon-muted)' }}
            >
              <X size={20} />
            </button>

            <img src={clsuLogo} alt="CLSU seal" className="mx-auto h-20 w-20 object-contain" />
            <h2 id="back-logout-title" className="mt-2 text-xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>
              Do you want to log out?
            </h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              You pressed the browser Back button three times. Logging out will end your current session.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={cancelBackLogout}
                disabled={loggingOut}
                className="flex-1 rounded-lg border py-2.5 text-sm font-semibold disabled:opacity-60"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBackLogout}
                disabled={loggingOut}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
              >
                <LogOut size={16} />
                {loggingOut ? 'Logging out...' : 'Log Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
