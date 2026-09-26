import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { CircleHelp, LogOut, Menu, Settings, X } from 'lucide-react'
import { useAuth } from '@/lib/AuthProvider'
import { SigmaAssistant } from '@/components/assistant/SigmaAssistant'
import { NotificationBell } from '@/components/layout/NotificationBell'
import clsuLogo from '@/assets/clsu-logo.png'
import { OnboardingTour } from '@/components/onboarding/OnboardingTour'

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [enteringFromIntro] = useState(() => sessionStorage.getItem('sigmaDashboardEntrance') === 'true')
  const menuRef = useRef<HTMLDivElement>(null)

  async function handleLogout() {
    setMenuOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    if (enteringFromIntro) sessionStorage.removeItem('sigmaDashboardEntrance')
  }, [enteringFromIntro])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

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
    <div className={`min-h-screen${enteringFromIntro ? ' sigma-app-enter' : ''}`} style={{ background: 'var(--bg-app)' }}>
      <header className="sigma-site-header border-b" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
        <div className="mx-auto flex min-h-[56px] max-w-[1600px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src={clsuLogo} alt="CLSU seal" className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
            <div className="min-w-0 leading-none">
              <p className="truncate text-[9px] font-semibold tracking-[0.14em] sm:text-[10px]" style={{ color: 'var(--text-muted)' }}>
                OFFICE OF ADMISSIONS
              </p>
              <p className="mt-1 text-xl font-extrabold tracking-[0.04em] sm:text-[22px]" style={{ color: 'var(--nav-header-dark)' }}>
                SIGMA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
            <span
              className="hidden items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold sm:flex"
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
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold shadow-sm transition-transform hover:scale-105"
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
                      window.dispatchEvent(new Event('sigma:start-tour'))
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:brightness-95"
                    style={{ color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
                  >
                    <CircleHelp size={15} />
                    Website Tour
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

            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileNavOpen}
              aria-controls="sigma-mobile-navigation"
              className="flex h-9 w-9 items-center justify-center rounded-lg border md:hidden"
              style={{ borderColor: 'var(--border-default)', color: 'var(--nav-header-dark)', background: 'var(--bg-card)' }}
            >
              {mobileNavOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>

        <nav
          className="sigma-primary-nav hidden md:block"
          aria-label="Primary navigation"
          style={{ background: `linear-gradient(to right, var(--nav-gradient-start), var(--nav-gradient-end))` }}
        >
          <div className="flex h-8 w-full items-stretch justify-center gap-[clamp(24px,7vw,112px)]">
            {topNav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'} className={({ isActive }) => `sigma-nav-link ${isActive ? 'sigma-nav-link-active' : ''}`}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {mobileNavOpen && (
          <nav id="sigma-mobile-navigation" className="sigma-mobile-nav md:hidden" aria-label="Mobile primary navigation">
            {topNav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'} className={({ isActive }) => `sigma-mobile-nav-link ${isActive ? 'sigma-mobile-nav-link-active' : ''}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <div className="mx-auto max-w-[1600px]">
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>

      <SigmaAssistant />
      <OnboardingTour />
    </div>
  )
}
