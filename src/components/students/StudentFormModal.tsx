import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/utils/logActivity'
import type { StudentDetail } from '@/hooks/useStudentDetail'

interface FormValues {
  yr_level: string
  address: string
  contact_number: string
  email: string
  gwa: string
  participation_org: string
}

interface Props {
  student: StudentDetail | null
  onClose: () => void
  onSaved: () => void
}

export function StudentFormModal({ student, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormValues>({
    yr_level: '',
    address: '',
    contact_number: '',
    email: '',
    gwa: '',
    participation_org: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!student) return
    setForm({
      yr_level: student.yr_level ?? '',
      address: student.address ?? '',
      contact_number: student.contact_number ?? '',
      email: student.email ?? '',
      gwa: student.gwa != null ? String(student.gwa) : '',
      participation_org: student.participation_org ?? '',
    })
    setError(null)
  }, [student])

  if (!student) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const gwaValue = form.gwa.trim() ? Number(form.gwa) : null
    if (form.gwa.trim() && (Number.isNaN(gwaValue) || gwaValue! < 1 || gwaValue! > 5)) {
      setError('GWA must be a number between 1.00 and 5.00.')
      setSaving(false)
      return
    }

    const { error } = await (supabase as any)
      .from('students')
      .update({
        yr_level: form.yr_level,
        address: form.address || null,
        contact_number: form.contact_number || null,
        email: form.email || null,
        gwa: gwaValue,
        participation_org: form.participation_org || null,
      })
      .eq('id', student!.id)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    await logActivity('update', 'student', `Updated profile for ${student!.full_name}.`, student!.id)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl shadow-xl" style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--divider-light)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--nav-header-dark)' }}>
            Edit Record — {student.full_name}
          </h2>
          <button onClick={onClose} aria-label="Close" style={{ color: 'var(--icon-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Year Level</label>
              <input
                value={form.yr_level}
                onChange={(e) => setForm((f) => ({ ...f, yr_level: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>GWA</label>
              <input
                value={form.gwa}
                onChange={(e) => setForm((f) => ({ ...f, gwa: e.target.value }))}
                placeholder="e.g. 1.75"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Participation in Org</label>
            <input
              value={form.participation_org}
              onChange={(e) => setForm((f) => ({ ...f, participation_org: e.target.value }))}
              placeholder="e.g. CLSU Civil Engineering Society — Active Member"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--input-border)' }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Address</label>
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--input-border)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Contact Number</label>
              <input
                value={form.contact_number}
                onChange={(e) => setForm((f) => ({ ...f, contact_number: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-[var(--menu-hover-bg)]"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[var(--btn-primary-hover)] disabled:opacity-60"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
