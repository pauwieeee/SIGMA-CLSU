import { useState } from 'react'
import { X, AlertTriangle, Archive, RotateCcw, RefreshCw, UserPlus, Pencil, BookOpen, BadgeCheck, History, UserCog } from 'lucide-react'
import { useStudentDetail, type ScholarshipHistoryRow } from '@/hooks/useStudentDetail'
import { Avatar } from '@/components/ui/Avatar'
import { StudentFormModal } from '@/components/students/StudentFormModal'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/utils/logActivity'
import { notifySaveFailure } from '@/utils/notifySaveFailure'

const statusChoices = ['Active', 'For Renewal', 'Documents Incomplete', 'Pending Verification', 'Inactive']

interface Props {
  studentId: string | null
  onClose: () => void
  /** Called after any edit inside this modal (status change, profile edit)
   * so the page behind it (e.g. the Student Records table) can refetch —
   * this modal's own refetch() only updates its own data, not the list. */
  onChanged?: () => void
}

export function StudentDetailModal({ studentId, onClose, onChanged }: Props) {
  const { student, history, flags, timeline, loading, refetch } = useStudentDetail(studentId)
  const [editing, setEditing] = useState(false)
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null)
  const [renewing, setRenewing] = useState<ScholarshipHistoryRow | null>(null)

  if (!studentId) return null

  const openFlags = flags.filter((f) => ['Open', 'Under Review'].includes(f.status))

  async function changeStatus(historyId: string, scholarshipName: string, newStatus: string) {
    setSavingStatusId(historyId)
    const { error } = await (supabase as any).from('student_scholarships').update({ status: newStatus }).eq('id', historyId)
    if (error) {
      console.error('Status update failed:', error)
      void notifySaveFailure(`Changing ${scholarshipName} status`, error, studentId)
      setSavingStatusId(null)
      return
    }
    await refetch()
    onChanged?.()
    setSavingStatusId(null)
    void logActivity('update', 'student_scholarship', `Changed status of "${scholarshipName}" to "${newStatus}" for ${student?.full_name}.`, historyId)
      .catch((activityError) => console.error('Activity logging failed:', activityError))
  }

  async function toggleArchive(row: ScholarshipHistoryRow) {
    setSavingStatusId(row.id)
    const restoring = Boolean(row.archived_at)
    const { error } = await (supabase as any).from('student_scholarships')
      .update({ archived_at: restoring ? null : new Date().toISOString() })
      .eq('id', row.id)
    if (error) {
      console.error(`${restoring ? 'Restore' : 'Archive'} failed:`, error)
      void notifySaveFailure(`${restoring ? 'Restoring' : 'Archiving'} ${row.scholarship_name}`, error, studentId)
    }
    else {
      await logActivity(restoring ? 'restore' : 'archive', 'student_scholarship', `${restoring ? 'Restored' : 'Archived'} "${row.scholarship_name}" for ${student?.full_name}.`, row.id)
      await refetch()
      onChanged?.()
    }
    setSavingStatusId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl shadow-xl" style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--divider-light)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--nav-header-dark)' }}>
            Student Record
          </h2>
          <button onClick={onClose} aria-label="Close" style={{ color: 'var(--icon-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {loading || !student ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading student…
          </p>
        ) : (
          <div className="space-y-5 px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={student.full_name} size={48} />
                <div>
                  <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{student.full_name}</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{student.student_number}</p>
                </div>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[var(--btn-primary-hover)]"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
              >
                Edit Record
              </button>
            </div>

            {openFlags.length > 0 && (
              <div
                className="flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
                style={{ background: 'var(--status-duplicate-bg)', color: 'var(--status-duplicate-text)', borderColor: 'var(--status-duplicate-text)' }}
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  <strong className="block">Duplicate Flag Detected</strong>
                  <span className="block"><strong>Reason:</strong> This student has 2 Active scholarships in {openFlags[0].academic_year} • {openFlags[0].semester}.</span>
                  <span className="mt-1 block">Review the scholarship history below and resolve the duplicate if necessary.</span>
                  {openFlags.length > 1 ? <span className="mt-1 block">This student has {openFlags.length} open duplicate flags.</span> : null}
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
              <DetailField label="Student ID" value={student.student_number} />
              <DetailField label="College" value={student.college} />
              <DetailField label="Program" value={student.program} />
              <DetailField label="Year Level" value={student.yr_level} />
              <DetailField label="GWA" value={student.gwa != null ? student.gwa.toFixed(2) : '—'} />
              <DetailField label="Participation in Org" value={student.participation_org ?? '—'} />
              <DetailField label="Address" value={student.address ?? '—'} />
              <DetailField label="Contact Number" value={student.contact_number ?? '—'} />
              <DetailField label="Email" value={student.email ?? '—'} />
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--widget-heading-text)' }}>
                Scholarship History
              </h3>
              {history.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No scholarship records.</p>
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--divider-light)' }}>
                  {history.map((h) => {
                    const belowGwaThreshold = h.min_gwa != null && student.gwa != null && student.gwa > h.min_gwa
                    return (
                      <li key={h.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{h.scholarship_name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {h.category_name} · {h.academic_year} · {h.semester}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {h.is_enrolled === false && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}
                            >
                              Not Enrolled
                            </span>
                          )}
                          {h.status === 'Active' && h.is_enrolled === false && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' }}
                              title="Active scholarship but currently not enrolled — administrator review required."
                            >
                              Review Required
                            </span>
                          )}
                          {h.term_closed_at && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                              title="This semester is closed; the record remains available as history."
                            >
                              Historical
                            </span>
                          )}
                          {belowGwaThreshold && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ background: 'var(--status-pending-bg)', color: 'var(--status-pending-text)' }}
                              title={`Requires GWA ${h.min_gwa!.toFixed(2)} or better`}
                            >
                              Below GWA Req.
                            </span>
                          )}
                          <select
                            value={h.status}
                            disabled={savingStatusId === h.id || Boolean(h.archived_at)}
                            onChange={(e) => changeStatus(h.id, h.scholarship_name, e.target.value)}
                            className="rounded-full border-0 px-2.5 py-1 text-xs font-medium disabled:opacity-60"
                            style={{ background: 'var(--menu-active-bg)', color: 'var(--nav-header-dark)' }}
                          >
                            {statusChoices.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => setRenewing(h)} className="rounded-lg border p-1.5" title="Renew scholarship" style={{ borderColor: 'var(--border-default)', color: 'var(--btn-primary-bg)' }}><RefreshCw size={14} /></button>
                          <button type="button" onClick={() => toggleArchive(h)} disabled={savingStatusId === h.id} className="rounded-lg border p-1.5 disabled:opacity-50" title={h.archived_at ? 'Restore archived record' : 'Archive record'} style={{ borderColor: 'var(--border-default)', color: h.archived_at ? 'var(--status-success-text)' : 'var(--status-warning-text)' }}>{h.archived_at ? <RotateCcw size={14} /> : <Archive size={14} />}</button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {flags.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--widget-heading-text)' }}>
                  Duplicate Flag History
                </h3>
                <ul className="ml-2 border-l-2 pl-5" style={{ borderColor: 'var(--divider-light)' }}>
                  {flags.flatMap((f) => {
                    const context = { academicYear: f.academic_year, semester: f.semester, scholarshipA: f.scholarship_a, scholarshipB: f.scholarship_b }
                    const created = { ...context, key: `${f.id}-created`, title: 'Duplicate Flag Created', date: f.created_at, badge: f.status === 'Open' || f.status === 'Under Review' ? 'Open' : f.resolution_type === 'Approved Exception' ? 'Exception' : 'Resolved', details: f.reason || `Student has multiple Active scholarships: ${f.scholarship_a} and ${f.scholarship_b}.` }
                    const resolved = f.resolved_at ? [{ ...context, key: `${f.id}-resolved`, title: f.resolution_type === 'Approved Exception' ? 'Approved Exception' : 'Duplicate Flag Resolved', date: f.resolved_at, badge: f.resolution_type === 'Approved Exception' ? 'Exception' : 'Resolved', details: f.resolution_notes || f.reason }] : []
                    return [created, ...resolved]
                  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((event) => (
                    <li key={event.key} className="relative pb-5 text-sm last:pb-0">
                      <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2" style={{ background: 'var(--bg-card)', borderColor: event.badge === 'Open' ? 'var(--status-duplicate-text)' : 'var(--status-success-text)' }} />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{event.title}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(event.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {event.academicYear} • {event.semester}</p>
                          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>{event.details}</p>
                          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Scholarships: {event.scholarshipA} and {event.scholarshipB}</p>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={event.badge === 'Open'
                            ? { background: 'var(--status-duplicate-bg)', color: 'var(--status-duplicate-text)' }
                            : { background: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}
                        >
                          {event.badge}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--widget-heading-text)' }}>Student Activity Timeline</h3>
              {timeline.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No recorded activity yet.</p> : (
                <ul className="space-y-2">{timeline.map((item) => <ActivityTimelineItem key={item.id} item={item} />)}</ul>
              )}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <StudentFormModal
          student={student}
          onClose={() => setEditing(false)}
          onSaved={() => {
            refetch()
            onChanged?.()
          }}
        />
      )}
      {renewing && <RenewScholarshipModal row={renewing} onClose={() => setRenewing(null)} onSaved={async () => { setRenewing(null); await refetch(); onChanged?.() }} />}
    </div>
  )
}

function ActivityTimelineItem({ item }: { item: import('@/hooks/useStudentDetail').StudentActivityItem }) {
  const action = item.action.toLowerCase()
  const Icon = action === 'create' ? UserPlus : action === 'renew' ? RefreshCw : action === 'verify_enrollment' ? BadgeCheck : action === 'archive' || action === 'restore' ? Archive : action === 'update' ? Pencil : item.entity_type === 'student_scholarship' ? BookOpen : History
  return <li className="flex gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: 'var(--menu-active-bg)', color: 'var(--btn-primary-bg)' }}><Icon size={17} /></span>
    <div className="min-w-0 flex-1"><p className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.description}</p><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}><span>{new Date(item.occurred_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span><span className="inline-flex items-center gap-1"><UserCog size={12} /> Performed by {item.actor_name || item.actor_email || 'System'}</span></div></div>
  </li>
}

function RenewScholarshipModal({ row, onClose, onSaved }: { row: ScholarshipHistoryRow; onClose: () => void; onSaved: () => void }) {
  const [academicYear, setAcademicYear] = useState('')
  const [semester, setSemester] = useState('1st Semester')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('Active')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    if (!academicYear.trim()) return setError('Academic year is required.')
    setSaving(true); setError('')
    const { error: rpcError } = await (supabase as any).rpc('renew_student_scholarship', { p_assignment_id: row.id, p_academic_year: academicYear.trim(), p_semester: semester, p_start_date: startDate || null, p_end_date: endDate || null, p_status: status })
    setSaving(false)
    if (rpcError) { void notifySaveFailure(`Renewing ${row.scholarship_name}`, rpcError); return setError(rpcError.message) }
    onSaved()
  }
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"><div className="w-full max-w-md rounded-xl p-5 shadow-xl" style={{ background: 'var(--bg-card)' }}>
    <div className="flex items-center justify-between"><div><h3 className="font-bold" style={{ color: 'var(--nav-header-dark)' }}>Renew Scholarship</h3><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.scholarship_name}</p></div><button onClick={onClose}><X size={18} /></button></div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><label>Academic Year<input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2026-2027" className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label>Semester<select value={semester} onChange={e => setSemester(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"><option>1st Semester</option><option>2nd Semester</option><option>Summer</option></select></label><label>Start Date<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label>Expiration Date<input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="col-span-2">Status<select value={status} onChange={e => setStatus(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">{statusChoices.map(option => <option key={option}>{option}</option>)}</select></label></div>
    {error && <p className="mt-3 text-sm" style={{ color: 'var(--status-error-text)' }}>{error}</p>}
    <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} disabled={saving} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button onClick={save} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60" style={{ background: 'var(--btn-primary-bg)', color: 'white' }}>{saving ? 'Renewing…' : 'Create Renewal'}</button></div>
  </div></div>
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p style={{ color: 'var(--text-secondary)' }}>{value}</p>
    </div>
  )
}
