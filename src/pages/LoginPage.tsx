import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/AuthProvider'
import watermark from '@/assets/clsu-seal-watermark.png'
import clsuLogo from '@/assets/clsu-logo.png'

export default function LoginPage() {
  const { session, user, loading: authLoading, signIn, signOut } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const handledAuthenticatedVisit = useRef(false)

  useEffect(() => {
    if (authLoading || !session || handledAuthenticatedVisit.current) return
    handledAuthenticatedVisit.current = true

    const previousCount = Number(sessionStorage.getItem('sigmaPublicBackAttempts')) || 0
    const count = previousCount + 1
    sessionStorage.setItem('sigmaPublicBackAttempts', String(count))

    if (count >= 3) {
      setShowConfirmation(true)
      return
    }

    // Push the authenticated destination so Back remains usable. If the user
    // tries to cross into the public area again, this guard runs again.
    navigate('/dashboard')
  }, [authLoading, navigate, session])

  const displayName = (() => {
    const metadata = user?.user_metadata
    const savedName = metadata?.full_name ?? metadata?.display_name ?? metadata?.name
    if (typeof savedName === 'string' && savedName.trim()) return savedName.trim()

    const emailParts = (user?.email?.split('@')[0] ?? 'this account')
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))

    // CLSU addresses commonly use surname.firstname; present that as a
    // natural display name when profile metadata is unavailable.
    return (emailParts.length === 2 ? emailParts.reverse() : emailParts).join(' ')
  })()

  function cancelConfirmation() {
    sessionStorage.removeItem('sigmaPublicBackAttempts')
    setShowConfirmation(false)
    navigate('/dashboard', { replace: true })
  }

  async function confirmLogout() {
    setLoading(true)
    sessionStorage.removeItem('sigmaPublicBackAttempts')
    await signOut()
    navigate('/login', { replace: true })
    setLoading(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError(error)
      return
    }
    sessionStorage.removeItem('sigmaPublicBackAttempts')
    navigate('/dashboard')
  }

  if (authLoading || session) {
    return (
      <div
        className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
        style={{
          background: 'var(--bg-login)',
          backgroundImage: `url(${watermark})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0" style={{ background: 'var(--bg-login)', opacity: 0.15 }} />

        {showConfirmation ? (
          <div
            className="relative z-10 w-full max-w-md rounded-2xl p-8 shadow-2xl"
            style={{ background: 'var(--bg-card)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="authenticated-confirm-title"
          >
            <img src={clsuLogo} alt="CLSU seal" className="mx-auto h-20 w-20 object-contain" />
            <h1
              id="authenticated-confirm-title"
              className="mt-2 text-center text-2xl font-bold"
              style={{ color: 'var(--nav-header-dark)' }}
            >
              Confirm
            </h1>
            <p className="mt-4 text-center text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              You cannot create a new account because you are already logged in as{' '}
              <strong>{displayName}</strong>.
            </p>
            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={cancelConfirmation}
                disabled={loading}
                className="flex-1 rounded-lg border py-2.5 text-sm font-semibold disabled:opacity-60"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
              >
                <LogOut size={16} />
                {loading ? 'Logging out...' : 'Log out'}
              </button>
            </div>
          </div>
        ) : (
          <div
            className="relative z-10 h-9 w-9 animate-spin rounded-full border-4 border-white/40 border-t-white"
            role="status"
            aria-label="Restoring authenticated session"
          />
        )}
      </div>
    )
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
      style={{
        background: 'var(--bg-login)',
        backgroundImage: `url(${watermark})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0" style={{ background: 'var(--bg-login)', opacity: 0.15 }} />

      <div
        className="relative z-10 w-full max-w-md rounded-2xl p-8 shadow-2xl"
        style={{ background: 'var(--bg-card)' }}
      >
        <div className="flex flex-col items-center text-center">
          <img src={clsuLogo} alt="CLSU seal" className="h-24 w-24 object-contain" />
          <h2 className="mt-2 text-2xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>
            SIGMA Admin Login
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Scholarship Information and Grants
            <br />
            Management Analytics
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Admin Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yourname@clsu2.edu.ph"
              className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none"
              style={{ borderColor: 'var(--input-border)' }}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:outline-none"
                style={{ borderColor: 'var(--input-border)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center pr-3"
                style={{ color: 'var(--icon-muted)' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md px-3 py-2 text-sm"
              style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2.5 text-sm font-semibold transition hover:bg-[var(--btn-primary-hover)] disabled:opacity-60"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
          >
            {loading ? 'Logging in…' : 'Log In'}
          </button>

          <div className="text-center">
            <Link to="/forgot-password" className="text-sm font-medium hover:underline" style={{ color: 'var(--btn-primary-bg)' }}>
              Forgot password?
            </Link>
          </div>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          Admin access only — accounts are provisioned by the Office of Admissions.
        </p>
      </div>
    </div>
  )
}
