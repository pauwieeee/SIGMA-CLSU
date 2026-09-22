import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound, X } from 'lucide-react'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabase'
import { Card, CardTitle } from '@/components/ui/Card'
import { getUserDisplayName } from '@/utils/userDisplayName'

function formatPasswordChangedAt(value: unknown) {
  if (typeof value !== 'string') return 'Not recorded yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded yet'
  return date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function AccountSettingsPage() {
  const { user } = useAuth()
  const [preferredUsername, setPreferredUsername] = useState(() => getUserDisplayName(user, ''))
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null)
  const [updatingPassword, setUpdatingPassword] = useState(false)

  useEffect(() => setPreferredUsername(getUserDisplayName(user, '')), [user])

  const passwordIsValid = newPassword.length >= 8
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword
  const canUpdatePassword = Boolean(currentPassword && passwordIsValid && confirmPassword && passwordsMatch && !updatingPassword)
  const profileHasChanges = preferredUsername.trim() !== getUserDisplayName(user, '')

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    const username = preferredUsername.trim()
    setProfileStatus(null)
    if (username.length < 2 || username.length > 50) {
      setProfileStatus({ type: 'error', message: 'Preferred username must contain 2 to 50 characters.' })
      return
    }

    setSavingProfile(true)
    const { error } = await supabase.auth.updateUser({ data: { preferred_username: username } })
    setSavingProfile(false)
    setProfileStatus(error
      ? { type: 'error', message: 'We could not save your profile. Please try again.' }
      : { type: 'success', message: 'Profile changes saved successfully.' })
  }

  function closePasswordDialog(force = false) {
    if (updatingPassword && !force) return
    setPasswordDialogOpen(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError(null)
    setShowCurrent(false)
    setShowNew(false)
    setShowConfirm(false)
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    if (!passwordsMatch) {
      setPasswordError('New password and confirmation password do not match.')
      return
    }
    if (!passwordIsValid) {
      setPasswordError('Password must contain at least 8 characters.')
      return
    }
    if (!user?.email) {
      setPasswordError('Your account could not be verified. Please log in again.')
      return
    }

    setUpdatingPassword(true)
    const { error: verificationError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (verificationError) {
      setUpdatingPassword(false)
      setPasswordError('The current password is incorrect.')
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { password_changed_at: new Date().toISOString() },
    })
    setUpdatingPassword(false)
    if (error) {
      setPasswordError('The password could not be updated. Please try again.')
      return
    }

    setPasswordStatus('Password updated successfully.')
    closePasswordDialog(true)
  }

  const passwordFields = [
    { id: 'current-password', label: 'Current password', value: currentPassword, setValue: setCurrentPassword, visible: showCurrent, setVisible: setShowCurrent, autoComplete: 'current-password' },
    { id: 'new-password', label: 'New password', value: newPassword, setValue: setNewPassword, visible: showNew, setVisible: setShowNew, autoComplete: 'new-password' },
    { id: 'confirm-new-password', label: 'Confirm new password', value: confirmPassword, setValue: setConfirmPassword, visible: showConfirm, setVisible: setShowConfirm, autoComplete: 'new-password' },
  ]

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>Account Settings</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Manage your profile information and account security.</p>
      </div>

      <Card className="shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <span className="rounded-lg p-2" style={{ background: 'var(--menu-active-bg)', color: 'var(--btn-primary-bg)' }}><UserRound size={20} /></span>
          <div><CardTitle>Profile Information</CardTitle><p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Update how your name appears inside SIGMA.</p></div>
        </div>
        <form onSubmit={saveProfile} className="space-y-5">
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}><Mail size={15} /> Email</label>
            <a href={`mailto:${user?.email ?? ''}`} className="text-sm font-medium hover:underline" style={{ color: 'var(--btn-primary-bg)' }}>{user?.email}</a>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>This is your login email and cannot be changed here.</p>
          </div>
          <div>
            <label htmlFor="preferred-username" className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Preferred Username</label>
            <input id="preferred-username" type="text" minLength={2} maxLength={50} required value={preferredUsername}
              onChange={(e) => { setPreferredUsername(e.target.value); setProfileStatus(null) }}
              className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none sm:max-w-lg" style={{ borderColor: 'var(--input-border)' }} />
            <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>This username will be displayed throughout the system, including your Dashboard greeting.</p>
          </div>
          {profileStatus && <p className="rounded-lg px-3 py-2 text-sm" style={{ background: profileStatus.type === 'success' ? 'var(--status-complete-bg)' : 'var(--status-incomplete-bg)', color: profileStatus.type === 'success' ? 'var(--status-complete-text)' : 'var(--status-incomplete-text)' }}>{profileStatus.message}</p>}
          <button type="submit" disabled={savingProfile || !profileHasChanges}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-[var(--btn-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>{savingProfile ? 'Saving...' : 'Save Changes'}</button>
        </form>
      </Card>

      <Card className="shadow-sm">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="rounded-lg p-2" style={{ background: 'var(--menu-active-bg)', color: 'var(--btn-primary-bg)' }}><ShieldCheck size={20} /></span>
            <div><CardTitle>Security</CardTitle><p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Your password protects your SIGMA account.</p><p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Last changed: {formatPasswordChangedAt(user?.user_metadata?.password_changed_at)}</p></div>
          </div>
          <button type="button" onClick={() => { setPasswordDialogOpen(true); setPasswordStatus(null) }}
            className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-[var(--menu-hover-bg)]"
            style={{ borderColor: 'var(--border-default)', color: 'var(--btn-primary-bg)' }}><LockKeyhole size={16} /> Change Password</button>
        </div>
        {passwordStatus && <p className="mt-4 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--status-complete-bg)', color: 'var(--status-complete-text)' }}>{passwordStatus}</p>}
      </Card>

      <Card className="shadow-sm"><CardTitle>Account Information</CardTitle><div className="mt-3 text-sm"><p style={{ color: 'var(--text-muted)' }}>Role</p><p className="mt-1 font-semibold" style={{ color: 'var(--text-primary)' }}>Admin</p></div></Card>

      {passwordDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
          <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl p-6 shadow-2xl" style={{ background: 'var(--bg-card)' }}>
            <button type="button" onClick={() => closePasswordDialog()} disabled={updatingPassword} aria-label="Close" className="absolute right-4 top-4 p-1" style={{ color: 'var(--icon-muted)' }}><X size={20} /></button>
            <h2 id="change-password-title" className="text-xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>Change Password</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Confirm your identity before choosing a new password.</p>
            <form onSubmit={changePassword} className="mt-5 space-y-4">
              {passwordFields.map((field) => (
                <div key={field.id}>
                  <label htmlFor={field.id} className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{field.label}</label>
                  <div className="relative">
                    <input id={field.id} type={field.visible ? 'text' : 'password'} autoComplete={field.autoComplete} required value={field.value}
                      onChange={(e) => { field.setValue(e.target.value); setPasswordError(null) }}
                      className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:outline-none" style={{ borderColor: 'var(--input-border)' }} />
                    <button type="button" onClick={() => field.setVisible(!field.visible)} aria-label={`${field.visible ? 'Hide' : 'Show'} ${field.label}`} className="absolute inset-y-0 right-0 flex items-center px-3" style={{ color: 'var(--icon-muted)' }}>{field.visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </div>
                </div>
              ))}
              <div className="space-y-1 text-xs">
                <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Password requirements</p>
                <p style={{ color: passwordIsValid ? 'var(--status-complete-text)' : 'var(--status-incomplete-text)' }}>
                  {passwordIsValid ? '✓' : '✕'} At least 8 characters
                </p>
              </div>
              {confirmPassword && !passwordsMatch && <p className="text-xs" style={{ color: 'var(--status-incomplete-text)' }}>New password and confirmation password do not match.</p>}
              {passwordError && <p role="alert" className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}>{passwordError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => closePasswordDialog()} disabled={updatingPassword} className="flex-1 rounded-lg border py-2.5 text-sm font-semibold disabled:opacity-50" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
                <button type="submit" disabled={!canUpdatePassword} className="flex-1 rounded-lg py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>{updatingPassword ? 'Updating...' : 'Update Password'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
