import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/utils/logActivity'

type Action = 'status' | 'term' | 'archive'

const statusChoices: { label: string; value: string }[] = [
  { label: 'Active', value: 'Active' },
  { label: 'Pending', value: 'Pending Verification' },
  { label: 'Renewal', value: 'For Renewal' },
  { label: 'Incomplete', value: 'Documents Incomplete' },
]

interface SelectedStudent {
  studentId: string
  studentScholarshipId: string | null
}

interface Props {
  open: boolean
  students: SelectedStudent[]
  onClose: () => void
  onDone: (result: { updated: number; failed: number }) => void
}

export function BatchUpdateModal({ open, students, onClose, onDone }: Props) {
  const [action, setAction] = useState<Action>('status')
  const [newStatus, setNewStatus] = useState('Active')
  const [academicYear, setAcademicYear] = useState('2025-2026')
  const [semester, setSemester] = useState('1st Semester')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, saving, onClose])

  if (!open) return null

  const scholarshipIds = students.map((s) => s.studentScholarshipId).filter((id): id is string => !!id)
  const studentIds = students.map((s) => s.studentId)

  const summary =
    action === 'status'
      ? `This will update ${scholarshipIds.length} student(s) to status: ${newStatus}.`
      : action === 'term'
        ? `This will move ${scholarshipIds.length} student(s) to ${academicYear}, ${semester}.`
        : `This will archive ${studentIds.length} student(s). They will be hidden from active lists.`

  async function commit() {
    setSaving(true)
    setError(null)

    try {
      if (action === 'archive') {
        const results = await Promise.all(studentIds.map((id) =>
          (supabase as any).rpc('archive_student', { p_student_id: id, p_reason: 'Batch archive' })
        ))
        const updated = results.filter((result) => !result.error).length
        onDone({ updated, failed: studentIds.length - updated })
        return
      }

      const payload = action === 'status' ? { status: newStatus } : { academic_year: academicYear, semester }
      const { data, error } = await (supabase as any)
        .from('student_scholarships')
        .update(payload)
        .in('id', scholarshipIds)
        .select('id')
      if (error) throw error
      const updated = data?.length ?? 0
      if (updated > 0) {
        await logActivity(
          'update',
          'student',
          action === 'status'
            ? `Updated status to "${newStatus}" for ${updated} student record(s).`
            : `Moved ${updated} student record(s) to ${academicYear}, ${semester}.`
        )
      }
      onDone({ updated, failed: scholarshipIds.length - updated })
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="batch-update-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-xl shadow-xl" style={{ background: 'var(--bg-card)' }}>
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--divider-light)', background: 'var(--bg-card)' }}>
          <h2 id="batch-update-title" className="text-sm font-bold" style={{ color: 'var(--nav-header-dark)' }}>
            Batch Update ({students.length} selected)
          </h2>
          <button onClick={onClose} disabled={saving} aria-label="Close" title="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-[var(--menu-hover-bg)]" style={{ color: 'var(--icon-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {!confirming ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Action</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as Action)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              >
                <option value="status">Change Status</option>
                <option value="term">Change Term</option>
                <option value="archive">Archive Selected Students</option>
              </select>
            </div>

            {action === 'status' && (
              <div>
                <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--input-border)' }}
                >
                  {statusChoices.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}

            {action === 'term' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Academic Year</label>
                  <select
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--input-border)' }}
                  >
                    <option>2025-2026</option>
                    <option>2024-2025</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Semester</label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--input-border)' }}
                  >
                    <option>1st Semester</option>
                    <option>2nd Semester</option>
                  </select>
                </div>
              </div>
            )}

            {action !== 'archive' && scholarshipIds.length < students.length && (
              <p className="text-xs" style={{ color: 'var(--status-warning-text)' }}>
                {students.length - scholarshipIds.length} of {students.length} selected student(s) have no scholarship
                record to update and will be skipped.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-[var(--menu-hover-bg)]"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => setConfirming(true)}
                className="rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[var(--btn-primary-hover)]"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <p className="rounded-lg px-3 py-2.5 text-sm" style={{ background: 'var(--menu-active-bg)', color: 'var(--nav-header-dark)' }}>
              {summary}
            </p>
            {error && (
              <p className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}>
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={saving}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-[var(--menu-hover-bg)]"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Back
              </button>
              <button
                onClick={commit}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[var(--btn-primary-hover)] disabled:opacity-60"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
              >
                {saving ? 'Updating…' : 'Confirm Update'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
