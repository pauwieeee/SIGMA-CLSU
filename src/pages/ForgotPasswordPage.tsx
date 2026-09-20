import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import watermark from '@/assets/clsu-seal-watermark.png'
import clsuLogo from '@/assets/clsu-logo.png'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }

    // Supabase intentionally does not reveal whether an account exists for
    // this address, which prevents account enumeration.
    setSent(true)
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
            Reset your password
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Enter your admin email and we will send you a secure reset link.
          </p>
        </div>

        {sent ? (
          <div className="mt-6 text-center">
            <div
              role="status"
              className="rounded-lg px-4 py-3 text-sm"
              style={{ background: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}
            >
              If an account exists for <strong>{email}</strong>, a password reset link has been sent. Check the
              inbox and spam folder.
            </div>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-4 text-sm font-medium hover:underline"
              style={{ color: 'var(--btn-primary-bg)' }}
            >
              Send another link
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="recovery-email" className="mb-1 block text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Admin Email
              </label>
              <input
                id="recovery-email"
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
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="mt-5 text-center">
          <Link to="/login" className="text-sm font-medium hover:underline" style={{ color: 'var(--btn-primary-bg)' }}>
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
