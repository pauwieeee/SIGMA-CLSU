import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { CircleHelp, LogOut, Settings } from 'lucide-react'
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
  const [menuOpen, setMenuOpen] = useState(false)
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
      <OnboardingTour />
    </div>
  )
}
