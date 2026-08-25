import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/utils/logActivity'

interface Props {
  open: boolean
  onClose: () => void
  onDone: () => void
}

// Replaces the manual "VLOOKUP each student ID against the enrollment list"
// step described by the Product Owner: paste the official enrollment list
// for a term, and every active scholarship record for that term gets
// automatically marked enrolled/not-enrolled instead of being checked by
// hand, one ID at a time.
export function EnrollmentVerificationModal({ open, onClose, onDone }: Props) {
  const [academicYear, setAcademicYear] = useState('2025-2026')
  const [semester, setSemester] = useState('1st Semester')
  const [idList, setIdList] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ checked: number; enrolled: number; notEnrolled: number } | null>(null)

  if (!open) return null

  function close() {
    setIdList('')
    setResult(null)
    setError(null)
    onClose()
  }

  async function run() {
    const enrolledNumbers = new Set(
      idList
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )

    if (enrolledNumbers.size === 0) {
      setError('Paste at least one student ID number.')
      return
    }

    setRunning(true)
    setError(null)

    const { data: rows, error: fetchError } = await (supabase as any)
      .from('student_scholarships')
      .select('id, students ( student_number )')
      .eq('academic_year', academicYear)
      .eq('semester', semester)
      .eq('status', 'Active')
      .is('archived_at', null)

    if (fetchError) {
      setError(fetchError.message)
      setRunning(false)
      return
    }

    let enrolledCount = 0
    let notEnrolledCount = 0
    const now = new Date().toISOString()

    await Promise.all(
      (rows ?? []).map(async (row: any) => {
        const isEnrolled = enrolledNumbers.has(row.students?.student_number)
        if (isEnrolled) enrolledCount++
        else notEnrolledCount++
        await (supabase as any)
          .from('student_scholarships')
          .update({ is_enrolled: isEnrolled, enrollment_verified_at: now })
          .eq('id', row.id)
      })
    )

    await logActivity(
      'verify_enrollment',
      'student_scholarship',
      `Verified enrollment for ${academicYear} ${semester}: ${enrolledCount} enrolled, ${notEnrolledCount} not enrolled.`
    )

    setResult({ checked: (rows ?? []).length, enrolled: enrolledCount, notEnrolled: notEnrolledCount })
    setRunning(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl shadow-xl" style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--divider-light)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--nav-header-dark)' }}>
            Verify Enrollment
          </h2>
          <button onClick={close} aria-label="Close" style={{ color: 'var(--icon-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Paste the official enrollment list for a term (student ID numbers, one per line or comma-separated). Every
            active scholarship record for that term gets checked against it — anyone not on the list is marked "Not
            Enrolled."
          </p>

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

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Enrolled Student IDs</label>
            <textarea
              value={idList}
              onChange={(e) => setIdList(e.target.value)}
              rows={6}
              placeholder={'e.g.\n24-0499\n23-0506\n22-1187'}
              className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
              style={{ borderColor: 'var(--input-border)' }}
            />
          </div>

          {error && (
            <p className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}>
              {error}
            </p>
          )}

          {result && (
            <p className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}>
              Checked {result.checked} record(s) for {academicYear} {semester}: {result.enrolled} enrolled, {result.notEnrolled} not enrolled.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={close}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-[var(--menu-hover-bg)]"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              Close
            </button>
            <button
              onClick={run}
              disabled={running}
              className="rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[var(--btn-primary-hover)] disabled:opacity-60"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
            >
              {running ? 'Verifying…' : 'Verify Enrollment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
