import { useEffect, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthProvider'
import { getUserDisplayName } from '@/utils/userDisplayName'
import clsuLogo from '@/assets/clsu-logo.png'

const BOUNDARY_VERSION = 'sigma-auth-boundary-v1'
const PUBLIC_PATHS = new Set(['/', '/login', '/forgot-password', '/reset-password'])

export function AuthenticatedHistoryBoundary() {
  const { session, user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const backAttempts = useRef(0)
  const returningToTop = useRef(false)

  useEffect(() => {
    if (!session || PUBLIC_PATHS.has(location.pathname)) return
    if (sessionStorage.getItem(BOUNDARY_VERSION) === 'installed') return

    const currentUrl = `${location.pathname}${location.search}${location.hash}`
    const state = window.history.state ?? {}
    const index = typeof state.idx === 'number' ? state.idx : 0

    // Build the complete boundary once. Back consumes these existing entries;
    // the popstate handler never adds or redirects to another history entry.
    window.history.replaceState({ ...state, idx: index, sigmaBoundaryAttempt: 3 }, '', '/dashboard')
    window.history.pushState({ ...state, idx: index + 1, sigmaBoundaryAttempt: 2 }, '', '/dashboard')
    window.history.pushState({ ...state, idx: index + 2, sigmaBoundaryAttempt: 1 }, '', '/dashboard')
    window.history.pushState({ ...state, idx: index + 3, sigmaAuthTop: true }, '', currentUrl)
    sessionStorage.setItem(BOUNDARY_VERSION, 'installed')
  }, [location.hash, location.pathname, location.search, session])

  useEffect(() => {
    function handlePopState(event: PopStateEvent) {
      if (!session) return

      if (returningToTop.current) {
        returningToTop.current = false
        return
      }

      const attempt = Number(event.state?.sigmaBoundaryAttempt)
      if (attempt < 1 || attempt > 3 || confirmationOpen) return

      backAttempts.current = attempt
      if (attempt === 3) setConfirmationOpen(true)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [confirmationOpen, session])

  useEffect(() => {
    if (session) return
    sessionStorage.removeItem(BOUNDARY_VERSION)
    backAttempts.current = 0
    setConfirmationOpen(false)
  }, [session])

  function cancel() {
    setConfirmationOpen(false)
    backAttempts.current = 0
    returningToTop.current = true
    window.history.go(3)
  }

  async function logout() {
    setLoggingOut(true)
    sessionStorage.removeItem(BOUNDARY_VERSION)
    await signOut()
    navigate('/login', { replace: true })
  }

  if (!session || !confirmationOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="auth-boundary-title">
      <div className="w-full max-w-md rounded-2xl p-8 text-center shadow-2xl" style={{ background: 'var(--bg-card)' }}>
        <img src={clsuLogo} alt="CLSU seal" className="mx-auto h-20 w-20 object-contain" />
        <h2 id="auth-boundary-title" className="mt-2 text-2xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>Confirm</h2>
        <p className="mt-4 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
          You are already logged in as <strong>{getUserDisplayName(user)}</strong>.
        </p>
        <div className="mt-7 flex gap-3">
          <button type="button" onClick={cancel} disabled={loggingOut} className="flex-1 rounded-lg border py-2.5 text-sm font-semibold disabled:opacity-60" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button type="button" onClick={logout} disabled={loggingOut} className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60" style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
            <LogOut size={16} /> {loggingOut ? 'Logging out...' : 'Log out'}
          </button>
        </div>
      </div>
    </div>
  )
}
