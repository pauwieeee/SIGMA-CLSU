import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/lib/AuthProvider'
import { SigmaAssistant } from '@/components/assistant/SigmaAssistant'
import { NotificationBell } from '@/components/layout/NotificationBell'
import clsuLogo from '@/assets/clsu-logo.png'

const topNav = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Student Records', to: '/students' },
  { label: 'Scholarships', to: '/scholarships' },
  { label: 'Reports & Analytics', to: '/reports' },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [backConfirmationOpen, setBackConfirmationOpen] = useState(
    () => sessionStorage.getItem('sigmaBackConfirmationOpen') === 'true',
  )
  const [loggingOut, setLoggingOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (sessionStorage.getItem('sigmaHistoryBoundaryInstalled') === 'true') return

    const currentUrl = window.location.href
    const currentState = window.history.state ?? {}
    const currentIndex = typeof currentState.idx === 'number' ? currentState.idx : 0

    // When an authenticated page is the tab's first history entry, Back would
    // leave SIGMA before React can protect the login boundary. Turn that entry
    // into the boundary and restore the current page directly above it.
    window.history.replaceState(
      { ...currentState, idx: currentIndex - 1, sigmaAuthBoundary: true },
      '',
      '/login',
    )
    window.history.pushState(
      { ...currentState, idx: currentIndex, sigmaAuthenticatedPage: true },
      '',
      currentUrl,
    )
    sessionStorage.setItem('sigmaHistoryBoundaryInstalled', 'true')
  }, [])

  useEffect(() => {
    const protectedDestination = `${location.pathname}${location.search}${location.hash}`

    function handleHistoryBoundary() {
      const destination = window.location.pathname
      if (destination !== '/' && destination !== '/login') return

      const previousCount = Number(sessionStorage.getItem('sigmaPublicBackAttempts')) || 0
      const count = previousCount + 1
      sessionStorage.setItem('sigmaPublicBackAttempts', String(count))

      if (count >= 3) {
        sessionStorage.setItem('sigmaBackConfirmationOpen', 'true')
        setBackConfirmationOpen(true)
      }

      // Restore the authenticated route immediately while the popstate event
      // is still being handled, before the public/login screen can render.
      navigate(protectedDestination)
    }

    window.addEventListener('popstate', handleHistoryBoundary)
    return () => window.removeEventListener('popstate', handleHistoryBoundary)
  }, [location.hash, location.pathname, location.search, navigate])

  const displayName = (() => {
    const metadata = user?.user_metadata
    const savedName = metadata?.full_name ?? metadata?.display_name ?? metadata?.name
    if (typeof savedName === 'string' && savedName.trim()) return savedName.trim()

    const emailParts = (user?.email?.split('@')[0] ?? 'this account')
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))

    return (emailParts.length === 2 ? emailParts.reverse() : emailParts).join(' ')
  })()

  function cancelBackConfirmation() {
    sessionStorage.removeItem('sigmaPublicBackAttempts')
    sessionStorage.removeItem('sigmaBackConfirmationOpen')
    setBackConfirmationOpen(false)
  }

  async function handleLogout() {
    setMenuOpen(false)
    setLoggingOut(true)
    sessionStorage.removeItem('sigmaPublicBackAttempts')
    sessionStorage.removeItem('sigmaBackConfirmationOpen')
    sessionStorage.removeItem('sigmaHistoryBoundaryInstalled')
    await signOut()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
                    onClick={handleLogout}
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
              end={item.to === '/dashboard'}
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

      {backConfirmationOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="back-confirm-title"
        >
          <div className="w-full max-w-md rounded-2xl p-8 text-center shadow-2xl" style={{ background: 'var(--bg-card)' }}>
            <img src={clsuLogo} alt="CLSU seal" className="mx-auto h-20 w-20 object-contain" />
            <h2 id="back-confirm-title" className="mt-2 text-2xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>
              Confirm
            </h2>
            <p className="mt-4 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              You cannot create a new account because you are already logged in as <strong>{displayName}</strong>.
            </p>
            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={cancelBackConfirmation}
                disabled={loggingOut}
                className="flex-1 rounded-lg border py-2.5 text-sm font-semibold disabled:opacity-60"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
              >
                <LogOut size={16} />
                {loggingOut ? 'Logging out...' : 'Log out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
