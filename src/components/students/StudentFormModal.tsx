import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/utils/logActivity'
import type { StudentDetail } from '@/hooks/useStudentDetail'
import { STUDENT_YEAR_LEVEL_OPTIONS } from '@/types/database'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'

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
  const [initialForm, setInitialForm] = useState<FormValues | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const dirty = initialForm != null && (Object.keys(form) as Array<keyof FormValues>).some((key) => form[key] !== initialForm[key])

  useEffect(() => {
    if (!student) return
    const values = {
      yr_level: student.yr_level ?? '',
      address: student.address ?? '',
      contact_number: student.contact_number ?? '',
      email: student.email ?? '',
      gwa: student.gwa != null ? String(student.gwa) : '',
      participation_org: student.participation_org ?? '',
    }
    setForm(values)
    setInitialForm(values)
    setDiscardOpen(false)
    setError(null)
  }, [student])

  useEffect(() => {
    if (!student) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [student])

  useEffect(() => {
    if (!student || discardOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || saving) return
      if (dirty) setDiscardOpen(true)
      else onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dirty, discardOpen, onClose, saving, student])

  if (!student) return null

  const requestClose = () => {
    if (saving) return
    if (dirty) setDiscardOpen(true)
    else onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (!STUDENT_YEAR_LEVEL_OPTIONS.includes(form.yr_level as (typeof STUDENT_YEAR_LEVEL_OPTIONS)[number])) {
      setError('Select a valid year level.')
      setSaving(false)
      return
    }

    const gwaValue = form.gwa.trim() ? Number(form.gwa) : null
    if (form.gwa.trim() && (Number.isNaN(gwaValue) || gwaValue! < 1 || gwaValue! > 5)) {
      setError('GWA must be a number between 1.00 and 5.00.')
      setSaving(false)
      return
    }

    const emailValue = form.email.trim() || null
    if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setError('Enter a valid email address or leave the email field blank.')
      setSaving(false)
      return
    }

    const { data: savedStudent, error } = await (supabase as any)
      .from('students')
      .update({
        yr_level: form.yr_level,
        address: form.address || null,
        contact_number: form.contact_number || null,
        email: emailValue,
        gwa: gwaValue,
        participation_org: form.participation_org || null,
      })
      .eq('id', student!.id)
      .select('id, email')
      .single()

    setSaving(false)

    if (error) {
      console.error('Student profile update failed:', error)
      setError('Unable to update the student. Please check the information and try again.')
      return
    }

    if (!savedStudent || savedStudent.email !== emailValue) {
      setError('The student record could not be verified after saving. Please try again.')
      return
    }

    onSaved()
    onClose()
    void logActivity('update', 'student', `Updated profile for ${student!.full_name}.`, student!.id)
      .catch((activityError) => console.error('Activity logging failed:', activityError))
  }

  return <>
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="student-form-title" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose() }}>
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-xl shadow-xl" style={{ background: 'var(--bg-card)' }}>
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--divider-light)', background: 'var(--bg-card)' }}>
          <h2 id="student-form-title" className="text-sm font-bold" style={{ color: 'var(--nav-header-dark)' }}>
            Edit Record — {student.full_name}
          </h2>
          <button onClick={requestClose} aria-label="Close" title="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-[var(--menu-hover-bg)]" style={{ color: 'var(--icon-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Year Level</label>
              <select
                value={form.yr_level}
                onChange={(e) => setForm((f) => ({ ...f, yr_level: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
                required
              >
                <option value="">Select Year Level</option>
                {STUDENT_YEAR_LEVEL_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
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
              onClick={requestClose}
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
    <ConfirmationDialog open={discardOpen} title="Discard Changes?" message="You have unsaved changes. Are you sure you want to close this window? Your edits will not be saved." cancelLabel="Keep Editing" confirmLabel="Discard Changes" tone="danger" onCancel={() => setDiscardOpen(false)} onConfirm={onClose}/>
  </>
}
