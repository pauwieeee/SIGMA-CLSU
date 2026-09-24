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
interface EnrollmentRow { id: string; studentNumber: string }
interface ApplyResult { matched_students: number; enrolled_records: number; not_enrolled_records: number }
interface Preview { submittedIds: string[]; matchedIds: string[]; unmatchedIds: string[]; matchedRows: EnrollmentRow[]; unlistedRows: EnrollmentRow[]; activeRecordCount: number }
const ACADEMIC_YEARS = ['2025-2026', '2024-2025', '2023-2024', '2022-2023']

export function EnrollmentVerificationModal({ open, onClose, onDone, selectedStudents = [] }: Props) {
  const [academicYear, setAcademicYear] = useState('2025-2026')
  const [semester, setSemester] = useState('1st Semester')
  const [idList, setIdList] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [reviewingMissing, setReviewingMissing] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [manualStatuses, setManualStatuses] = useState<Record<string, string>>({})
  if (!open) return null

  const isManualMode = selectedStudents.length > 0

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

  function resetPreview() { setPreview(null); setReviewingMissing(false); setError(null); setSuccess(null) }
  function close() { setIdList(''); setManualStatuses({}); resetPreview(); onClose() }
  function normalizedIds() { return [...new Set(idList.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean))] }

  async function previewVerification() {
    const submittedIds = normalizedIds()
    if (!submittedIds.length) { setError('Paste at least one official Student ID.'); return }
    setRunning(true); setError(null); setSuccess(null); setReviewingMissing(false)
    const { data, error: fetchError } = await (supabase as any).from('student_scholarships')
      .select('id, students!inner(student_number), scholarships!inner(status)')
      .eq('academic_year', academicYear).eq('semester', semester).eq('status', 'Active')
      .in('scholarships.status', ['Active', 'Expiring Soon']).is('archived_at', null).is('term_closed_at', null)
    if (fetchError) { setError(fetchError.message); setRunning(false); return }
    const activeRows: EnrollmentRow[] = ((data ?? []) as any[]).map((row) => ({ id: row.id, studentNumber: String(row.students?.student_number ?? '').trim() }))
    const submitted = new Set(submittedIds), activeIds = new Set(activeRows.map((row) => row.studentNumber))
    const matchedIds = submittedIds.filter((id) => activeIds.has(id)), unmatchedIds = submittedIds.filter((id) => !activeIds.has(id))
    setPreview({ submittedIds, matchedIds, unmatchedIds, matchedRows: activeRows.filter((row) => submitted.has(row.studentNumber)), unlistedRows: activeRows.filter((row) => !submitted.has(row.studentNumber)), activeRecordCount: activeRows.length })
    setRunning(false)
  }

  async function applyVerification(reconcileCompleteList: boolean) {
    if (!preview) return
    setRunning(true); setError(null)
    try {
      const { data, error: applyError } = await (supabase as any).rpc('apply_enrollment_verification', {
        p_academic_year: academicYear,
        p_semester: semester,
        p_student_numbers: preview.submittedIds,
        p_reconcile_complete_list: reconcileCompleteList,
      })
      if (applyError) throw new Error(applyError.message)
      const result = (data?.[0] ?? {}) as Partial<ApplyResult>
      const enrolled = result.enrolled_records ?? 0
      const notEnrolled = result.not_enrolled_records ?? 0
      setSuccess(reconcileCompleteList ? `${enrolled} record(s) marked Enrolled and ${notEnrolled} record(s) marked Not Enrolled.` : `${enrolled} matching record(s) marked Enrolled. No other records were changed.`)
      setReviewingMissing(false); onDone()
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
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Use the official enrollment list to verify which students are enrolled for the selected Academic Year and Semester. SIGMA will compare the Student IDs with existing records and show the changes before applying them.</p>
        <div className="grid grid-cols-2 gap-3"><SelectField label="Academic Year" value={academicYear} onChange={(value) => { setAcademicYear(value); resetPreview() }} options={ACADEMIC_YEARS} /><SelectField label="Semester" value={semester} onChange={(value) => { setSemester(value); resetPreview() }} options={[...SEMESTER_OPTIONS]} /></div>
        <div><label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Official Enrolled Student IDs</label><p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>Paste one Student ID per line. Spaces, commas, and pasted spreadsheet columns are accepted; repeated IDs are counted once.</p><textarea value={idList} onChange={(event) => { setIdList(event.target.value); resetPreview() }} rows={6} placeholder={'25-1019\n25-1139\n25-1059\n25-1099'} className="w-full rounded-lg border px-3 py-2 font-mono text-sm" style={{ borderColor: 'var(--input-border)' }} /></div>
        {!preview && <div className="flex justify-end gap-2 pt-2"><button onClick={close} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-default)' }}>Cancel</button><button onClick={previewVerification} disabled={running} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60" style={{ background: 'var(--btn-primary-bg)', color: 'white' }}>{running ? 'Comparing…' : 'Preview Verification'}</button></div>}
        {preview && <VerificationPreview preview={preview} academicYear={academicYear} semester={semester} reconcileCompleteList={reviewingMissing} />}
        {preview && !reviewingMissing && <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--divider-light)' }}><div className="rounded-lg border px-3 py-3 text-sm" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}><p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Is this the complete official enrollment list?</p><p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>The {preview.unlistedRows.length} unlisted active scholarship record(s) are existing records that were not included in your submitted list. They are not considered Not Enrolled unless you review and explicitly confirm the complete-list reconciliation.</p><button onClick={() => setReviewingMissing(true)} disabled={!preview.unlistedRows.length} className="mt-3 rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ borderColor: 'var(--status-warning-text)', color: 'var(--status-warning-text)' }}>Review {preview.unlistedRows.length} Unlisted Active Record{preview.unlistedRows.length === 1 ? '' : 's'}</button></div>{preview.matchedRows.length === 0 && <p className="rounded-md px-3 py-2 text-xs" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' }}>No enrollment changes are ready to apply. Review the unmatched Student IDs or review the unlisted active records first.</p>}<div className="flex justify-end gap-2"><button onClick={resetPreview} disabled={running} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-default)' }}>Back</button><button onClick={() => applyVerification(false)} disabled={running || !preview.matchedRows.length} title={!preview.matchedRows.length ? 'No matched scholarship records are ready to verify' : undefined} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--btn-primary-bg)', color: 'white' }}>{running ? 'Applying…' : `Apply Verification (${preview.matchedRows.length})`}</button></div></div>}
        {preview && reviewingMissing && <div className="rounded-lg border p-4" style={{ borderColor: 'var(--status-warning-text)', background: 'var(--status-warning-bg)' }}><p className="font-semibold" style={{ color: 'var(--status-warning-text)' }}>Complete-list reconciliation</p><p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>You are about to mark {preview.unlistedRows.length} currently active scholarship record(s) as Not Enrolled because they do not appear in the complete official list.</p><div className="mt-4 flex justify-end gap-2"><button onClick={() => setReviewingMissing(false)} disabled={running} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-default)' }}>Cancel</button><button onClick={() => applyVerification(true)} disabled={running} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60" style={{ background: 'var(--status-warning-text)', color: 'white' }}>{running ? 'Applying…' : `Confirm & Mark ${preview.unlistedRows.length} as Not Enrolled`}</button></div></div>}
        {error && <p role="alert" className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}>{error}</p>}{success && <p className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}>{success}</p>}
        </>}
      </div>
    </div>
  </div>
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <div><label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</label><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--input-border)' }}>{options.map((option) => <option key={option}>{option}</option>)}</select></div> }

function VerificationPreview({ preview, academicYear, semester, reconcileCompleteList }: { preview: Preview; academicYear: string; semester: string; reconcileCompleteList: boolean }) {
  const notEnrolledChanges = reconcileCompleteList ? preview.unlistedRows.length : 0
  const hasReadyChanges = preview.matchedRows.length > 0 || notEnrolledChanges > 0
  return <div className="space-y-3 rounded-lg border p-4" style={{ borderColor: 'var(--border-default)' }}><div><p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--widget-heading-text)' }}>Verification Preview</p><p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{academicYear} · {semester}</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Summary label="Submitted IDs" value={preview.submittedIds.length} /><Summary label="Matched students" value={preview.matchedIds.length} /><Summary label="No scholarship match" value={preview.unmatchedIds.length} /><Summary label="Active records not in submitted list" value={preview.unlistedRows.length} /></div>{preview.unlistedRows.length > 0 && <p className="rounded-md px-3 py-2 text-xs" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{preview.unlistedRows.length} existing active scholarship record(s) were not included in the submitted list. This does not mean those students are confirmed Not Enrolled.</p>}<div className="max-h-40 space-y-1 overflow-y-auto text-sm">{preview.matchedIds.map((id) => <p key={id} className="flex items-center gap-2" style={{ color: 'var(--status-success-text)' }}><CheckCircle2 size={14} /> <strong>{id}</strong> — matched to an active scholarship record</p>)}{preview.unmatchedIds.map((id) => <p key={id} className="flex items-start gap-2" style={{ color: 'var(--status-warning-text)' }}><TriangleAlert size={14} className="mt-0.5 shrink-0" /> <span><strong>{id}</strong> — no matching active scholarship record found. This does not mean the student is Not Enrolled.</span></p>)}</div><div className="grid gap-2 text-sm sm:grid-cols-2"><div className="rounded-md px-3 py-2" style={{ background: 'var(--status-success-bg)' }}><strong>CHANGES READY TO APPLY</strong><p>{preview.matchedRows.length} matched scholarship record(s) will be marked Enrolled</p><p>{notEnrolledChanges} reviewed record(s) will be marked Not Enrolled</p>{!hasReadyChanges && <p className="mt-1 text-xs">No records will be changed until you review and confirm the verification results.</p>}</div><div className="rounded-md px-3 py-2" style={{ background: 'var(--bg-secondary)' }}><strong>WILL NOT CHANGE</strong><p>{preview.unmatchedIds.length} submitted ID(s) without a match</p>{!reconcileCompleteList && <p>{preview.unlistedRows.length} unlisted active record(s)</p>}<p>Scholarships, expiration dates, categories, and history</p></div></div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Existing active scholarship records for this term: {preview.activeRecordCount}. No database records have been changed yet.</p></div>
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-md px-2 py-2 text-center" style={{ background: 'var(--bg-secondary)' }}><p className="text-xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>{value}</p><p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</p></div> }
