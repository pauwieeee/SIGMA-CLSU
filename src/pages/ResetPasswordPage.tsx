import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import watermark from '@/assets/clsu-seal-watermark.png'
import clsuLogo from '@/assets/clsu-logo.png'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [checkingLink, setCheckingLink] = useState(true)
  const [validSession, setValidSession] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const query = new URLSearchParams(window.location.search)
    const redirectError = fragment.get('error_description') ?? query.get('error_description')
    if (redirectError) setError(decodeURIComponent(redirectError.replace(/\+/g, ' ')))

    supabase.auth.getSession().then(({ data }) => {
      setValidSession(Boolean(data.session))
      setCheckingLink(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setValidSession(true)
      setCheckingLink(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(true)
    await supabase.auth.signOut()
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

      <div className="relative z-10 w-full max-w-md rounded-2xl p-8 shadow-2xl" style={{ background: 'var(--bg-card)' }}>
        <div className="flex flex-col items-center text-center">
          <img src={clsuLogo} alt="CLSU seal" className="h-24 w-24 object-contain" />
          <h1 className="mt-2 text-2xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>
            Choose a new password
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Use at least 8 characters and keep your password private.
          </p>
        </div>

        {checkingLink ? (
          <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Checking reset link…</p>
        ) : success ? (
          <div className="mt-6 text-center">
            <div role="status" className="rounded-lg px-4 py-3 text-sm" style={{ background: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}>
              Your password has been updated successfully. You can now log in with your new password.
            </div>
            <Link
              to="/login"
              className="mt-4 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
            >
              Return to Login
            </Link>
          </div>
        ) : !validSession ? (
          <div className="mt-6 text-center">
            <p role="alert" className="rounded-lg px-4 py-3 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}>
              {error ?? 'This password reset link is invalid or has expired. Please request a new link.'}
            </p>
            <Link to="/forgot-password" className="mt-4 inline-block text-sm font-medium hover:underline" style={{ color: 'var(--btn-primary-bg)' }}>
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1 block text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1 block text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>

            {error && (
              <p role="alert" className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-2.5 text-sm font-semibold transition hover:bg-[var(--btn-primary-hover)] disabled:opacity-60"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
