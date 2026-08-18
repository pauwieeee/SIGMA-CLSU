import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/lib/AuthProvider'
import watermark from '@/assets/clsu-seal-watermark.png'
import clsuLogo from '@/assets/clsu-logo.png'

export default function LoginPage() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

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
    navigate('/')
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
          <img src={clsuLogo} alt="CLSU seal" className="h-16 w-16" />
          <p className="mt-1.5 text-lg font-bold" style={{ color: 'var(--nav-header-dark)' }}>
            CLSU
          </p>
          <h2 className="mt-3 text-2xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>
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
            <a href="#forgot-password" className="text-sm font-medium hover:underline" style={{ color: 'var(--btn-primary-bg)' }}>
              Forgot password?
            </a>
          </div>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          Admin access only — accounts are provisioned by the Office of Admissions.
        </p>
      </div>
    </div>
  )
}
