import { useState } from 'react'
import { CheckCircle2, TriangleAlert, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { SEMESTER_OPTIONS } from '@/types/database'

interface SelectedStudent {
  assignmentId: string
  studentNumber: string
  name: string
  currentStatus: boolean | null
}
interface Props { open: boolean; onClose: () => void; onDone: () => void; selectedStudents?: SelectedStudent[] }
interface EnrollmentRow {
  id: string
  studentNumber: string
  studentName: string
  scholarshipName: string
  academicYear: string
  semester: string
  currentEnrollment: boolean | null
  scholarshipStatus: string
}
interface Preview { submittedIds: string[]; matchedIds: string[]; unmatchedIds: string[]; matchedRows: EnrollmentRow[]; unlistedRows: EnrollmentRow[]; activeRecordCount: number }
interface SelectiveResult { assignment_id: string; student_number: string | null; student_name: string | null; requested_enrollment: boolean; result_status: 'Success' | 'Failed' | 'Unchanged'; result_message: string }
interface VerificationResult { enrolled: number; notEnrolled: number; failed: SelectiveResult[]; unchanged: number; leftUnchanged: number }
type ReviewDecision = 'pending' | 'not_enrolled' | 'unchanged'
const ACADEMIC_YEARS = ['2025-2026', '2024-2025', '2023-2024', '2022-2023']

export function EnrollmentVerificationModal({ open, onClose, onDone, selectedStudents = [] }: Props) {
  const [academicYear, setAcademicYear] = useState('2025-2026')
  const [semester, setSemester] = useState('1st Semester')
  const [idList, setIdList] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [reviewStage, setReviewStage] = useState<'closed' | 'review' | 'confirm'>('closed')
  const [reviewDecisions, setReviewDecisions] = useState<Record<string, ReviewDecision>>({})
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [manualStatuses, setManualStatuses] = useState<Record<string, string>>({})
  if (!open) return null

  const isManualMode = selectedStudents.length > 0
  const matchedChanges = preview?.matchedRows.filter((row) => row.currentEnrollment !== true) ?? []
  const selectedUnlisted = preview?.unlistedRows.filter((row) => reviewDecisions[row.id] === 'not_enrolled') ?? []
  const reviewedUnlisted = preview?.unlistedRows.filter((row) => reviewDecisions[row.id] && reviewDecisions[row.id] !== 'pending') ?? []
  const unchangedUnlisted = preview?.unlistedRows.filter((row) => reviewDecisions[row.id] === 'unchanged') ?? []
  const pendingUnlisted = (preview?.unlistedRows.length ?? 0) - reviewedUnlisted.length
  const readyChanges = matchedChanges.length + selectedUnlisted.filter((row) => row.currentEnrollment !== false).length

  function setReviewDecision(id: string, decision: ReviewDecision) {
    setReviewDecisions((current) => ({ ...current, [id]: decision }))
  }

  function openUnlistedReview() {
    if (!preview) return
    setReviewDecisions(Object.fromEntries(preview.unlistedRows.map((row) => [row.id, reviewDecisions[row.id] ?? 'pending'])))
    setReviewStage('review')
  }

  async function applySelectedStatuses() {
    const updates = selectedStudents.map((student) => ({
      assignment_id: student.assignmentId,
      is_enrolled: manualStatuses[student.assignmentId] === 'enrolled'
        ? true
        : manualStatuses[student.assignmentId] === 'not_enrolled'
          ? false
          : student.currentStatus,
    }))
    if (updates.some((update) => update.is_enrolled === null)) {
      setError('Choose Enrolled or Not Enrolled for every selected student.')
      return
    }
    setRunning(true); setError(null)
    try {
      const { error: updateError } = await (supabase as any).rpc('set_selected_enrollment_statuses', { p_updates: updates })
      if (updateError) throw new Error(updateError.message)
      setManualStatuses({})
      onDone()
    } catch (updateError) {
      setError((updateError as Error).message)
    } finally {
      setRunning(false)
    }
  }

  function resetPreview() { setPreview(null); setReviewStage('closed'); setReviewDecisions({}); setVerificationResult(null); setError(null); setSuccess(null) }
  function close() { setIdList(''); setManualStatuses({}); resetPreview(); onClose() }
  function normalizedIds() { return [...new Set(idList.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean))] }

  async function previewVerification() {
    const submittedIds = normalizedIds()
    if (!submittedIds.length) { setError('Paste at least one official Student ID.'); return }
    setRunning(true); setError(null); setSuccess(null); setReviewStage('closed'); setReviewDecisions({}); setVerificationResult(null)
    const { data, error: fetchError } = await (supabase as any).from('student_scholarships')
      .select('id, academic_year, semester, is_enrolled, students!inner(student_number, first_name, middle_name, last_name), scholarships!inner(name, status)')
      .eq('academic_year', academicYear).eq('semester', semester).eq('status', 'Active')
      .in('scholarships.status', ['Active', 'Expiring Soon']).is('archived_at', null).is('term_closed_at', null)
    if (fetchError) { setError(fetchError.message); setRunning(false); return }
    const activeRows: EnrollmentRow[] = ((data ?? []) as any[]).map((row) => ({
      id: row.id,
      studentNumber: String(row.students?.student_number ?? '').trim(),
      studentName: [row.students?.first_name, row.students?.middle_name, row.students?.last_name].filter(Boolean).join(' '),
      scholarshipName: row.scholarships?.name ?? '—',
      academicYear: row.academic_year,
      semester: row.semester,
      currentEnrollment: row.is_enrolled,
      scholarshipStatus: row.scholarships?.status ?? '—',
    }))
    const submitted = new Set(submittedIds), activeIds = new Set(activeRows.map((row) => row.studentNumber))
    const matchedIds = submittedIds.filter((id) => activeIds.has(id)), unmatchedIds = submittedIds.filter((id) => !activeIds.has(id))
    setPreview({ submittedIds, matchedIds, unmatchedIds, matchedRows: activeRows.filter((row) => submitted.has(row.studentNumber)), unlistedRows: activeRows.filter((row) => !submitted.has(row.studentNumber)), activeRecordCount: activeRows.length })
    setRunning(false)
  }

  async function applyVerification() {
    if (!preview) return
    const matchedUpdates = preview.matchedRows
      .filter((row) => row.currentEnrollment !== true)
      .map((row) => ({ assignment_id: row.id, is_enrolled: true, expected_is_enrolled: row.currentEnrollment }))
    const notEnrolledUpdates = preview.unlistedRows
      .filter((row) => reviewDecisions[row.id] === 'not_enrolled' && row.currentEnrollment !== false)
      .map((row) => ({ assignment_id: row.id, is_enrolled: false, expected_is_enrolled: row.currentEnrollment }))
    const updates = [...matchedUpdates, ...notEnrolledUpdates]
    if (!updates.length) {
      setError('No changes are ready to apply. Review and select records first.')
      return
    }
    setRunning(true); setError(null)
    try {
      const { data, error: applyError } = await (supabase as any).rpc('apply_selective_enrollment_updates', { p_updates: updates })
      if (applyError) throw new Error(applyError.message)
      const results = (data ?? []) as SelectiveResult[]
      const successful = results.filter((result) => result.result_status === 'Success')
      const failed = results.filter((result) => result.result_status === 'Failed').map((result) => {
        const previewRow = [...preview.matchedRows, ...preview.unlistedRows].find((row) => row.id === result.assignment_id)
        return { ...result, student_number: result.student_number ?? previewRow?.studentNumber ?? null, student_name: result.student_name ?? previewRow?.studentName ?? null }
      })
      const unchanged = results.filter((result) => result.result_status === 'Unchanged').length
      const enrolled = successful.filter((result) => result.requested_enrollment).length
      const notEnrolled = successful.filter((result) => !result.requested_enrollment).length
      setVerificationResult({
        enrolled,
        notEnrolled,
        failed,
        unchanged,
        leftUnchanged: preview.unlistedRows.length - notEnrolled,
      })
      setReviewStage('closed'); setReviewDecisions({}); onDone()
    } catch (updateError) { setError((updateError as Error).message) } finally { setRunning(false) }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="verify-enrollment-title">
    <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl shadow-xl" style={{ background: 'var(--bg-card)' }}>
      <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--divider-light)' }}><h2 id="verify-enrollment-title" className="text-sm font-bold" style={{ color: 'var(--nav-header-dark)' }}>{isManualMode ? 'Set Selected Enrollment' : 'Verify Enrollment'}</h2><button onClick={close} aria-label="Close" style={{ color: 'var(--icon-muted)' }}><X size={18} /></button></div>
      <div className="space-y-4 px-5 py-4">
        {isManualMode ? <>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Choose the enrollment result for every selected student's current scholarship record.</p>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {selectedStudents.map((student) => (
              <div key={student.assignmentId} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_180px] sm:items-center" style={{ borderColor: 'var(--border-default)' }}>
                <div className="min-w-0"><p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{student.name}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{student.studentNumber}</p></div>
                <select
                  value={manualStatuses[student.assignmentId] ?? (student.currentStatus === true ? 'enrolled' : student.currentStatus === false ? 'not_enrolled' : '')}
                  onChange={(event) => setManualStatuses((current) => ({ ...current, [student.assignmentId]: event.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--input-border)', background: 'var(--bg-card)' }}
                >
                  <option value="">Select status</option>
                  <option value="enrolled">Enrolled</option>
                  <option value="not_enrolled">Not Enrolled</option>
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--divider-light)' }}><button onClick={close} disabled={running} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-default)' }}>Cancel</button><button onClick={applySelectedStatuses} disabled={running} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60" style={{ background: 'var(--btn-primary-bg)', color: 'white' }}>{running ? 'Saving…' : `Save ${selectedStudents.length} Status${selectedStudents.length === 1 ? '' : 'es'}`}</button></div>
          {error && <p role="alert" className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}>{error}</p>}
        </> : <>
        {verificationResult ? <VerificationResultPanel result={verificationResult} onClose={close} /> : <>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Use the official enrollment list to verify which students are enrolled for the selected Academic Year and Semester. SIGMA will compare the Student IDs with existing records and show the changes before applying them.</p>
          <div className="grid grid-cols-2 gap-3"><SelectField label="Academic Year" value={academicYear} onChange={(value) => { setAcademicYear(value); resetPreview() }} options={ACADEMIC_YEARS} /><SelectField label="Semester" value={semester} onChange={(value) => { setSemester(value); resetPreview() }} options={[...SEMESTER_OPTIONS]} /></div>
          <div><label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Official Enrolled Student IDs</label><p className="mb-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>Paste Student IDs from the registrar's enrollment list. You can paste one ID per line, comma-separated values, or directly from an Excel column. Duplicate IDs are automatically ignored.</p><textarea value={idList} onChange={(event) => { setIdList(event.target.value); resetPreview() }} rows={6} placeholder={'25-1019\n25-1139\n25-1059\n25-1099'} className="w-full rounded-lg border px-3 py-2 font-mono text-sm" style={{ borderColor: 'var(--input-border)' }} /></div>
          {!preview && <div className="flex justify-end gap-2 pt-2"><button onClick={close} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-default)' }}>Cancel</button><button onClick={previewVerification} disabled={running} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60" style={{ background: 'var(--btn-primary-bg)', color: 'white' }}>{running ? 'Comparing…' : 'Preview Verification'}</button></div>}
          {preview && <VerificationPreview preview={preview} matchedChanges={matchedChanges.length} selectedNotEnrolled={selectedUnlisted.length} reviewed={reviewedUnlisted.length} pending={pendingUnlisted} explicitUnchanged={unchangedUnlisted.length} />}
          {preview && reviewStage === 'closed' && <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--divider-light)' }}>{preview.unlistedRows.length > 0 && <button onClick={openUnlistedReview} className="w-full rounded-lg px-4 py-3 text-sm font-bold shadow-sm transition-colors hover:bg-[var(--btn-primary-hover)]" style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>Review {preview.unlistedRows.length} Unlisted Record{preview.unlistedRows.length === 1 ? '' : 's'}</button>}{readyChanges === 0 && <p className="rounded-md px-3 py-2 text-xs" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' }}>{preview.unlistedRows.length > 0 ? 'No changes are ready to apply. Review unlisted records first.' : 'No changes are ready to apply. All matched records are already verified.'}</p>}<div className="flex justify-end gap-2"><button onClick={resetPreview} disabled={running} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-default)' }}>Back</button><button onClick={() => selectedUnlisted.length ? setReviewStage('confirm') : applyVerification()} disabled={running || readyChanges === 0} title={readyChanges === 0 ? 'Review and select records before applying changes.' : undefined} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ background: 'var(--btn-primary-bg)', color: 'white' }}>{running ? 'Applying…' : `Apply Changes (${readyChanges})`}</button></div></div>}
          {preview && reviewStage === 'review' && <UnlistedReviewTable rows={preview.unlistedRows} decisions={reviewDecisions} onDecision={setReviewDecision} onSelectAll={() => setReviewDecisions(Object.fromEntries(preview.unlistedRows.map((row) => [row.id, row.currentEnrollment === false ? 'unchanged' : 'not_enrolled'])))} selectedCount={selectedUnlisted.length} reviewedCount={reviewedUnlisted.length} pendingCount={pendingUnlisted} readyCount={readyChanges} onBack={() => setReviewStage('closed')} onContinue={() => setReviewStage('confirm')} />}
          {preview && reviewStage === 'confirm' && <div className="rounded-lg border p-4" style={{ borderColor: 'var(--status-warning-text)', background: 'var(--status-warning-bg)' }}><p className="font-semibold uppercase tracking-wide" style={{ color: 'var(--status-warning-text)' }}>Complete-list reconciliation</p><p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>You are about to mark {selectedUnlisted.length} selected active scholarship record(s) as Not Enrolled.</p>{matchedChanges.length > 0 && <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{matchedChanges.length} matched scholarship record(s) will also be marked Enrolled.</p>}<p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{preview.unlistedRows.length - selectedUnlisted.length} unselected record(s) will remain unchanged. Please review the selected records before confirming.</p><div className="mt-3 max-h-32 overflow-y-auto rounded-md bg-white/60 p-2 text-xs">{selectedUnlisted.map((row) => <p key={row.id}>{row.studentNumber} · {row.studentName} · {row.scholarshipName}</p>)}</div><div className="mt-4 flex flex-wrap justify-end gap-2"><button onClick={() => { setReviewDecisions({}); setReviewStage('closed') }} disabled={running} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-default)' }}>Cancel</button><button onClick={() => setReviewStage('review')} disabled={running} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-default)' }}>Back to Review</button><button onClick={applyVerification} disabled={running || selectedUnlisted.length === 0} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60" style={{ background: 'var(--status-warning-text)', color: 'white' }}>{running ? 'Processing…' : `Confirm & Mark ${selectedUnlisted.length} as Not Enrolled`}</button></div></div>}
          {error && <p role="alert" className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}>{error}</p>}{success && <p className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}>{success}</p>}
        </>}
        </>}
      </div>
    </div>
  </div>
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <div><label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</label><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--input-border)' }}>{options.map((option) => <option key={option}>{option}</option>)}</select></div> }

function VerificationPreview({ preview, matchedChanges, selectedNotEnrolled, reviewed, pending, explicitUnchanged }: { preview: Preview; matchedChanges: number; selectedNotEnrolled: number; reviewed: number; pending: number; explicitUnchanged: number }) {
  const ready = matchedChanges + selectedNotEnrolled
  const unselected = preview.unlistedRows.length - selectedNotEnrolled
  const matchedSet = new Set(preview.matchedIds)
  return <div className="space-y-3 rounded-lg border p-4" style={{ borderColor: 'var(--border-default)' }}>
    <div><p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--widget-heading-text)' }}>Verification Preview</p><p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{preview.matchedRows[0]?.academicYear ?? preview.unlistedRows[0]?.academicYear} · {preview.matchedRows[0]?.semester ?? preview.unlistedRows[0]?.semester}</p></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Summary label="Submitted IDs" value={preview.submittedIds.length} /><Summary label="Matched" value={preview.matchedIds.length} /><Summary label="Unlisted Active" value={preview.unlistedRows.length} /><Summary label="Changes Ready" value={ready} /></div>
    {preview.unlistedRows.length > 0 && <div className="rounded-lg border px-3 py-3" style={{ borderColor: 'var(--status-warning-text)', background: 'var(--status-warning-bg)' }}><p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--status-warning-text)' }}>Review Required</p><p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{preview.unlistedRows.length} active scholarship record(s) were not included in your enrollment list. No students will be marked Not Enrolled until you manually review and confirm these records.</p></div>}
    <div className="max-h-44 overflow-auto rounded-md border" style={{ borderColor: 'var(--border-default)' }}><table className="w-full text-left text-xs"><thead className="sticky top-0" style={{ background: 'var(--bg-secondary)' }}><tr><th className="px-3 py-2">Student ID</th><th className="px-3 py-2">Result</th></tr></thead><tbody>{preview.submittedIds.map((id) => <tr key={id} className="border-t" style={{ borderColor: 'var(--divider-light)' }}><td className="px-3 py-2 font-semibold">{id}</td><td className="px-3 py-2">{matchedSet.has(id) ? <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--status-success-text)' }}><CheckCircle2 size={14} /> Matched (Active Record)</span> : <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--status-warning-text)' }}><TriangleAlert size={14} /> No Active Scholarship Match</span>}</td></tr>)}</tbody></table></div>
    <div className="grid gap-2 text-sm sm:grid-cols-2"><div className="rounded-md px-3 py-2" style={{ background: 'var(--status-success-bg)' }}><strong>CHANGES READY TO APPLY</strong><p>{matchedChanges} matched scholarship record(s) → Enrolled</p><p>{selectedNotEnrolled} selected record(s) → Not Enrolled</p><p>{reviewed} reviewed · {pending} pending review</p>{ready === 0 && <p className="mt-1 text-xs">No database changes are ready. Review and select records first.</p>}</div><div className="rounded-md px-3 py-2" style={{ background: 'var(--bg-secondary)' }}><strong>PENDING REVIEW</strong><p className="mt-1 text-xl font-bold">{unselected}</p><p>unlisted active record(s)</p><p className="mt-1 text-xs">{explicitUnchanged} explicitly left unchanged · {pending} still under review</p><p className="mt-1 text-xs">These require manual review before any enrollment status changes.</p></div></div>
    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Existing active scholarship records for this term: {preview.activeRecordCount}. No database records have been changed yet.</p>
  </div>
}

function UnlistedReviewTable({ rows, decisions, onDecision, onSelectAll, selectedCount, reviewedCount, pendingCount, readyCount, onBack, onContinue }: { rows: EnrollmentRow[]; decisions: Record<string, ReviewDecision>; onDecision: (id: string, decision: ReviewDecision) => void; onSelectAll: () => void; selectedCount: number; reviewedCount: number; pendingCount: number; readyCount: number; onBack: () => void; onContinue: () => void }) {
  return <div className="space-y-3 rounded-lg border p-3" style={{ borderColor: 'var(--border-default)' }}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Review Unlisted Active Records</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedCount} selected · {reviewedCount} reviewed · {pendingCount} under review</p></div><button onClick={onSelectAll} className="rounded-md border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--status-warning-text)', color: 'var(--status-warning-text)' }}>Select all intentionally</button></div><div className="max-h-[42vh] overflow-auto rounded-md border" style={{ borderColor: 'var(--border-default)' }}><table className="min-w-[1050px] w-full text-left text-xs"><thead className="sticky top-0" style={{ background: 'var(--bg-secondary)' }}><tr><th className="p-2">Select</th><th className="p-2">Student ID</th><th className="p-2">Student Name</th><th className="p-2">Scholarship</th><th className="p-2">Academic Year</th><th className="p-2">Semester</th><th className="p-2">Enrollment</th><th className="p-2">Scholarship Status</th><th className="p-2">Review Decision</th></tr></thead><tbody>{rows.map((row) => { const decision = decisions[row.id] ?? 'pending'; const alreadyNotEnrolled = row.currentEnrollment === false; return <tr key={row.id} className="border-t" style={{ borderColor: 'var(--divider-light)' }}><td className="p-2"><input type="checkbox" checked={decision === 'not_enrolled'} disabled={alreadyNotEnrolled} onChange={(event) => onDecision(row.id, event.target.checked ? 'not_enrolled' : 'pending')} aria-label={`Select ${row.studentName}`} /></td><td className="p-2 font-semibold">{row.studentNumber}</td><td className="p-2">{row.studentName}</td><td className="p-2">{row.scholarshipName}</td><td className="p-2">{row.academicYear}</td><td className="p-2">{row.semester}</td><td className="p-2">{row.currentEnrollment === true ? 'Enrolled' : row.currentEnrollment === false ? 'Not Enrolled' : 'Not Yet Verified'}</td><td className="p-2">{row.scholarshipStatus}</td><td className="p-2"><select value={decision} onChange={(event) => onDecision(row.id, event.target.value as ReviewDecision)} className="rounded border px-2 py-1" style={{ borderColor: 'var(--input-border)', background: 'var(--bg-card)' }}><option value="pending">Keep Under Review</option><option value="not_enrolled" disabled={alreadyNotEnrolled}>Mark Not Enrolled</option><option value="unchanged">Leave Unchanged</option></select></td></tr> })}</tbody></table></div>{selectedCount === 0 && <p className="text-xs" style={{ color: 'var(--status-warning-text)' }}>No unlisted records are selected. Nothing will be marked Not Enrolled.</p>}<div className="flex justify-end gap-2"><button onClick={onBack} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-default)' }}>Back</button><button onClick={onContinue} disabled={selectedCount === 0} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--btn-primary-bg)', color: 'white' }}>{`Apply Verification (${readyCount})`}</button></div></div>
}

function VerificationResultPanel({ result, onClose }: { result: VerificationResult; onClose: () => void }) {
  return <div className="space-y-4"><div className="rounded-lg border p-4" style={{ borderColor: result.failed.length ? 'var(--status-warning-text)' : 'var(--status-success-text)', background: result.failed.length ? 'var(--status-warning-bg)' : 'var(--status-success-bg)' }}><p className="font-bold uppercase tracking-wide">Verification Completed</p><div className="mt-2 grid gap-1 text-sm sm:grid-cols-2"><p>Successfully Marked Enrolled: <strong>{result.enrolled}</strong></p><p>Successfully Marked Not Enrolled: <strong>{result.notEnrolled}</strong></p><p>Failed Updates: <strong>{result.failed.length}</strong></p><p>Already Correct / Unchanged: <strong>{result.unchanged}</strong></p><p>Records Left Unchanged: <strong>{result.leftUnchanged}</strong></p></div></div>{result.failed.length > 0 && <div><p className="mb-2 text-sm font-semibold">Failed updates</p><div className="max-h-48 space-y-2 overflow-y-auto">{result.failed.map((failure, index) => <div key={`${failure.assignment_id}-${index}`} className="rounded-md border p-3 text-xs" style={{ borderColor: 'var(--status-error-text)' }}><p className="font-semibold">{failure.student_number ?? 'Unknown Student ID'} · {failure.student_name ?? 'Student name unavailable'}</p><p>{failure.result_message}</p><p className="mt-1" style={{ color: 'var(--text-muted)' }}>Recommended action: refresh the verification preview and review this record again.</p></div>)}</div></div>}<div className="flex justify-end"><button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--btn-primary-bg)', color: 'white' }}>Done</button></div></div>
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-md px-2 py-2 text-center" style={{ background: 'var(--bg-secondary)' }}><p className="text-xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>{value}</p><p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</p></div> }
