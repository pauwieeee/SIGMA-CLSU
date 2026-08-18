import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { useStudentDetail } from '@/hooks/useStudentDetail'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Avatar } from '@/components/ui/Avatar'
import { StudentFormModal } from '@/components/students/StudentFormModal'

interface Props {
  studentId: string | null
  onClose: () => void
}

export function StudentDetailModal({ studentId, onClose }: Props) {
  const { student, history, flags, loading, refetch } = useStudentDetail(studentId)
  const [editing, setEditing] = useState(false)

  if (!studentId) return null

  const openFlags = flags.filter((f) => f.status === 'Open')

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
                  Duplicate scholarship detected — this student is currently listed under both "{openFlags[0].scholarship_a}"
                  and "{openFlags[0].scholarship_b}."
                  {openFlags.length > 1 ? ` (${openFlags.length} duplicate flags total.)` : ''} Review before approving a new
                  application.
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
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{h.scholarship_name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {h.category_name} · {h.academic_year} · {h.semester}
                        </p>
                      </div>
                      <StatusBadge status={h.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {flags.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--widget-heading-text)' }}>
                  Duplicate Flag History
                </h3>
                <ul className="divide-y" style={{ borderColor: 'var(--divider-light)' }}>
                  {flags.map((f) => (
                    <li key={f.id} className="py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p style={{ color: 'var(--text-secondary)' }}>{f.reason}</p>
                        <StatusBadge status={f.status === 'Open' ? 'Duplicate' : 'Resolved'} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {editing && (
        <StudentFormModal
          student={student}
          onClose={() => setEditing(false)}
          onSaved={refetch}
        />
      )}
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p style={{ color: 'var(--text-secondary)' }}>{value}</p>
    </div>
  )
}
