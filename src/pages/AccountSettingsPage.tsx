import { useState, type FormEvent } from 'react'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabase'
import { Card, CardTitle } from '@/components/ui/Card'

export default function AccountSettingsPage() {
  const { user } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setStatus(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    setStatus(error ? error.message : 'Password updated successfully.')
    setNewPassword('')
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>
        Account Settings
      </h1>

      <Card>
        <CardTitle>Profile</CardTitle>
        <div className="space-y-1 text-sm">
          <p style={{ color: 'var(--text-muted)' }}>Email</p>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{user?.email}</p>
        </div>
        <div className="mt-3 space-y-1 text-sm">
          <p style={{ color: 'var(--text-muted)' }}>Role</p>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Admin</p>
        </div>
      </Card>

      <Card>
        <CardTitle>Change Password</CardTitle>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
            style={{ borderColor: 'var(--input-border)' }}
          />
          {status && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{status}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[var(--btn-primary-hover)] disabled:opacity-60"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
          >
            {saving ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </Card>
    </div>
  )
}
