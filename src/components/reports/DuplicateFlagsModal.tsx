import { useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import { useDuplicateFlags } from '@/hooks/useDuplicateFlags'
import { StudentDetailModal } from '@/components/students/StudentDetailModal'

interface Props {
  onClose: () => void
  onChanged: () => void
}

export function DuplicateFlagsModal({ onClose, onChanged }: Props) {
  const { rows, loading, resolve, refetch } = useDuplicateFlags()
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function markResolved(id: string) {
    setResolvingId(id)
    setError(null)
    try {
      await resolve(id)
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setResolvingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="duplicate-flags-title">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl shadow-xl" style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--divider-light)' }}>
          <div>
            <h2 id="duplicate-flags-title" className="text-base font-bold" style={{ color: 'var(--nav-header-dark)' }}>
              Students with Open Duplicate Flags
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              Review each conflict before changing or approving a scholarship record.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close duplicate flags" className="rounded-md p-1 hover:bg-[var(--menu-hover-bg)]" style={{ color: 'var(--icon-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {error && (
            <p role="alert" className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}>
              Could not resolve the flag: {error}
            </p>
          )}

          {loading ? (
            <p className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading duplicate cases…</p>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center">
              <Check size={32} className="mx-auto mb-2" style={{ color: 'var(--status-success-text)' }} />
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>No duplicate cases need review.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <article key={row.id} className="rounded-lg border p-4" style={{ borderColor: 'var(--border-default)' }}>
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={17} className="mt-0.5 shrink-0" style={{ color: 'var(--status-error-text)' }} />
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {row.student_name}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {row.student_number} · {row.program} · {row.college}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Conflicting Scholarships</p>
                          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>{row.scholarship_a}</p>
                          <p style={{ color: 'var(--text-secondary)' }}>{row.scholarship_b}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Academic Term</p>
                          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>{row.academic_year} · {row.semester}</p>
                          <p className="mt-2 text-xs" style={{ color: 'var(--status-error-text)' }}>{row.reason}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2 sm:flex-col">
                      <button
                        onClick={() => setViewingStudentId(row.student_id)}
                        className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-[var(--btn-primary-hover)]"
                        style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
                      >
                        View Student
                      </button>
                      <button
                        onClick={() => markResolved(row.id)}
                        disabled={resolvingId === row.id}
                        className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-[var(--menu-hover-bg)] disabled:opacity-60"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                      >
                        {resolvingId === row.id ? 'Resolving…' : 'Mark Resolved'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {viewingStudentId && (
        <StudentDetailModal
          studentId={viewingStudentId}
          onClose={() => setViewingStudentId(null)}
          onChanged={() => {
            refetch()
            onChanged()
          }}
        />
      )}
    </div>
  )
}
