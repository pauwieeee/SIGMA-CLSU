import { useEffect, useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import { useDuplicateFlags } from '@/hooks/useDuplicateFlags'
import { StudentDetailModal } from '@/components/students/StudentDetailModal'

interface Props {
  onClose: () => void
  onChanged: () => void
  focusFlagId?: string | null
}

export function DuplicateFlagsModal({ onClose, onChanged, focusFlagId }: Props) {
  const { rows, loading, resolve, refetch } = useDuplicateFlags('All')
  const [tab, setTab] = useState<'Open' | 'Resolved'>('Open')
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [resolutionType, setResolutionType] = useState('')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const visibleRows = rows
    .filter((row) => row.status === tab)
    .sort((a, b) => Number(b.id === focusFlagId) - Number(a.id === focusFlagId))
  const openCount = rows.filter((row) => row.status === 'Open').length
  const resolvedCount = rows.filter((row) => row.status === 'Resolved').length
  const reviewingRow = rows.find((row) => row.id === reviewingId) ?? null

  useEffect(() => {
    const focused = rows.find((row) => row.id === focusFlagId)
    if (focused) setTab(focused.status)
  }, [focusFlagId, rows])

  function beginReview(id: string) {
    setReviewingId(id)
    setResolutionType('')
    setResolutionNotes('')
    setError(null)
  }

  async function markResolved(id: string) {
    if (!resolutionType) {
      setError('Select a resolution before confirming.')
      return
    }
    if (!resolutionNotes.trim()) {
      setError('Add a short note explaining what was done.')
      return
    }

    const row = rows.find((item) => item.id === id)
    const bothStillActive = row?.scholarship_a_status === 'Active' && row?.scholarship_b_status === 'Active'
    const permitsActivePair = ['Approved Exception', 'False Positive'].includes(resolutionType)
    if (bothStillActive && !permitsActivePair) {
      setError('Both scholarships are still active. Open the student record and correct or deactivate one scholarship, or choose an approved exception/false positive resolution.')
      return
    }

    setResolvingId(id)
    setError(null)
    try {
      await resolve(id, resolutionType, resolutionNotes.trim())
      setReviewingId(null)
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
          <div className="mb-4 flex gap-2 border-b" style={{ borderColor: 'var(--divider-light)' }}>
            {(['Open', 'Resolved'] as const).map((status) => {
              const count = status === 'Open' ? openCount : resolvedCount
              return (
                <button
                  key={status}
                  onClick={() => {
                    setTab(status)
                    setReviewingId(null)
                    setError(null)
                  }}
                  className="border-b-2 px-3 py-2 text-sm font-semibold"
                  style={{
                    borderColor: tab === status ? 'var(--btn-primary-bg)' : 'transparent',
                    color: tab === status ? 'var(--btn-primary-bg)' : 'var(--text-muted)',
                  }}
                >
                  {status} Cases ({count})
                </button>
              )
            })}
          </div>

          {error && (
            <p role="alert" className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}>
              Could not resolve the flag: {error}
            </p>
          )}

          {loading ? (
            <p className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading duplicate cases…</p>
          ) : visibleRows.length === 0 ? (
            <div className="py-10 text-center">
              <Check size={32} className="mx-auto mb-2" style={{ color: 'var(--status-success-text)' }} />
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {tab === 'Open' ? 'No duplicate cases need review.' : 'No resolved cases yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleRows.map((row) => (
                <article
                  key={row.id}
                  className="rounded-lg border p-4"
                  style={{
                    borderColor: row.id === focusFlagId ? 'var(--btn-primary-bg)' : 'var(--border-default)',
                    boxShadow: row.id === focusFlagId ? '0 0 0 1px var(--btn-primary-bg)' : undefined,
                  }}
                >
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
                          {row.status === 'Resolved' && (
                            <div className="mt-3 rounded-md px-3 py-2 text-xs" style={{ background: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}>
                              <p><strong>Resolution:</strong> {row.resolution_type ?? 'Not recorded'}</p>
                              <p><strong>Notes:</strong> {row.resolution_notes ?? 'No notes recorded'}</p>
                              <p>
                                <strong>Resolved by:</strong> {row.resolved_by_email ?? 'Unknown administrator'}
                                {row.resolved_at ? ` · ${new Date(row.resolved_at).toLocaleString()}` : ''}
                              </p>
                            </div>
                          )}
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
                      {row.status === 'Open' && (
                        <button
                          onClick={() => beginReview(row.id)}
                          className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-[var(--menu-hover-bg)]"
                          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                        >
                          Review Case
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {reviewingRow && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              markResolved(reviewingRow.id)
            }}
            className="w-full max-w-lg rounded-xl p-5 shadow-2xl"
            style={{ background: 'var(--bg-card)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--nav-header-dark)' }}>Resolve Duplicate Case</h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {reviewingRow.student_name} · {reviewingRow.student_number}
                </p>
              </div>
              <button type="button" onClick={() => setReviewingId(null)} aria-label="Close resolution form" style={{ color: 'var(--icon-muted)' }}>
                <X size={19} />
              </button>
            </div>

            <div className="mt-4 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
              <p>{reviewingRow.scholarship_a} <strong>({reviewingRow.scholarship_a_status})</strong></p>
              <p>{reviewingRow.scholarship_b} <strong>({reviewingRow.scholarship_b_status})</strong></p>
            </div>

            <label htmlFor="resolution-type" className="mt-4 block text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Resolution
            </label>
            <select
              id="resolution-type"
              required
              value={resolutionType}
              onChange={(event) => setResolutionType(event.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--input-border)', background: 'var(--bg-card)' }}
            >
              <option value="">Select what was done</option>
              <option>Scholarship Deactivated</option>
              <option>Record Corrected</option>
              <option>Duplicate Entry Removed</option>
              <option>Approved Exception</option>
              <option>False Positive</option>
              <option>Other</option>
            </select>

            <label htmlFor="resolution-notes" className="mt-4 block text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Resolution Notes
            </label>
            <textarea
              id="resolution-notes"
              required
              rows={4}
              value={resolutionNotes}
              onChange={(event) => setResolutionNotes(event.target.value)}
              placeholder="Explain what was corrected or why this combination was approved."
              className="mt-1 w-full resize-none rounded-lg border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--input-border)' }}
            />

            {error && (
              <p role="alert" className="mt-3 rounded-md px-3 py-2 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}>
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setReviewingId(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button type="submit" disabled={resolvingId === reviewingRow.id} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60" style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
                {resolvingId === reviewingRow.id ? 'Saving…' : 'Confirm Resolution'}
              </button>
            </div>
          </form>
        </div>
      )}

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
