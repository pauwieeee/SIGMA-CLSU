import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/utils/logActivity'

interface Props {
  open: boolean
  onClose: () => void
  onDone: () => void
}

export function EnrollmentVerificationModal({ open, onClose, onDone }: Props) {
  const [academicYear, setAcademicYear] = useState('2025-2026')
  const [semester, setSemester] = useState('1st Semester')
  const [idList, setIdList] = useState('')
  const [markUnlisted, setMarkUnlisted] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    activeRecords: number
    enrolled: number
    notEnrolled: number
    unchanged: number
    unmatchedIds: string[]
  } | null>(null)

  if (!open) return null

  function close() {
    setIdList('')
    setMarkUnlisted(false)
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

    const activeRows = (rows ?? []) as any[]
    const activeStudentNumbers = new Set(activeRows.map((row) => String(row.students?.student_number ?? '').trim()))
    const matchedRows = activeRows.filter((row) => enrolledNumbers.has(String(row.students?.student_number ?? '').trim()))
    const unmatchedIds = [...enrolledNumbers].filter((studentNumber) => !activeStudentNumbers.has(studentNumber))

    if (matchedRows.length === 0) {
      setError(
        `None of the pasted IDs matched an active scholarship record for ${academicYear} ${semester}. Check the selected term and the student's scholarship status. No records were changed.`
      )
      setRunning(false)
      return
    }

    const unlistedRows = activeRows.filter((row) => !enrolledNumbers.has(String(row.students?.student_number ?? '').trim()))
    if (
      markUnlisted
      && !window.confirm(
        `This complete-list update will mark ${unlistedRows.length} unlisted active scholarship record(s) as Not Enrolled. Continue?`
      )
    ) {
      setRunning(false)
      return
    }

    const now = new Date().toISOString()

    const rowsToUpdate = markUnlisted ? activeRows : matchedRows
    const updateResults = await Promise.all(
      rowsToUpdate.map((row) =>
        (supabase as any)
          .from('student_scholarships')
          .update({
            is_enrolled: enrolledNumbers.has(String(row.students?.student_number ?? '').trim()),
            enrollment_verified_at: now,
          })
          .eq('id', row.id)
      )
    )
    const updateError = updateResults.find((update) => update.error)?.error
    if (updateError) {
      setError(updateError.message)
      setRunning(false)
      return
    }

    const enrolledCount = matchedRows.length
    const notEnrolledCount = markUnlisted ? unlistedRows.length : 0
    const unchangedCount = markUnlisted ? 0 : unlistedRows.length

    await logActivity(
      'verify_enrollment',
      'student_scholarship',
      `Verified enrollment for ${academicYear} ${semester}: ${enrolledCount} listed record(s) marked Enrolled, ${notEnrolledCount} unlisted record(s) marked Not Enrolled, ${unchangedCount} unchanged.`
    )

    setResult({
      activeRecords: activeRows.length,
      enrolled: enrolledCount,
      notEnrolled: notEnrolledCount,
      unchanged: unchangedCount,
      unmatchedIds,
    })
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
            Enter student IDs to verify them as enrolled for the selected term. By default, records not listed here
            will not be changed.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Academic Year</label>
              <select
                value={academicYear}
                onChange={(e) => {
                  setAcademicYear(e.target.value)
                  setResult(null)
                }}
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
                onChange={(e) => {
                  setSemester(e.target.value)
                  setResult(null)
                }}
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
              onChange={(e) => {
                setIdList(e.target.value)
                setResult(null)
                setError(null)
              }}
              rows={6}
              placeholder={'e.g.\n24-0499\n23-0506\n22-1187'}
              className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
              style={{ borderColor: 'var(--input-border)' }}
            />
          </div>

          <label
            className="flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            <input
              type="checkbox"
              checked={markUnlisted}
              onChange={(event) => {
                setMarkUnlisted(event.target.checked)
                setResult(null)
              }}
              className="mt-0.5"
            />
            <span>
              <strong>Complete official list:</strong> also mark active scholars not included above as Not Enrolled.
              Use this only when the pasted list is complete.
            </span>
          </label>

          {error && (
            <p className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}>
              {error}
            </p>
          )}

          {result && (
            <div className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}>
              <p>
                Verified {result.enrolled} matching record(s) as Enrolled for {academicYear} {semester}.
                {result.notEnrolled > 0 ? ` ${result.notEnrolled} unlisted record(s) were marked Not Enrolled.` : ''}
                {result.unchanged > 0 ? ` ${result.unchanged} unlisted record(s) were left unchanged.` : ''}
              </p>
              {result.unmatchedIds.length > 0 && (
                <p className="mt-1">
                  {result.unmatchedIds.length} pasted ID(s) had no active scholarship record for this term: {result.unmatchedIds.slice(0, 5).join(', ')}
                  {result.unmatchedIds.length > 5 ? '…' : ''}
                </p>
              )}
            </div>
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
