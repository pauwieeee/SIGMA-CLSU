import { useEffect, useState } from 'react'
import { Archive, RotateCcw, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { notifyDataChanged } from '@/utils/dataSync'

interface Props {
  student: { id: string; name: string } | null
  mode: 'archive' | 'restore'
  onClose: () => void
  onDone: () => void | Promise<void>
}

export function StudentArchiveModal({ student, mode, onClose, onDone }: Props) {
  const [reasonChoice, setReasonChoice] = useState('')
  const [otherReason, setOtherReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setReasonChoice(''); setOtherReason(''); setError(null); setSaving(false) }, [student, mode])
  useEffect(() => {
    if (!student) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [student, saving, onClose])
  if (!student) return null

  const restoring = mode === 'restore'

  async function submit() {
    if (!restoring && !reasonChoice) {
      setError('Select an archive reason.')
      return
    }
    if (!restoring && reasonChoice === 'Other' && !otherReason.trim()) {
      setError('Enter the archive reason.')
      return
    }
    setSaving(true); setError(null)
    const archiveReason = reasonChoice === 'Other' ? otherReason.trim() : reasonChoice
    const { error: rpcError } = restoring
      ? await (supabase as any).rpc('restore_student', { p_student_id: student!.id })
      : await (supabase as any).rpc('archive_student', { p_student_id: student!.id, p_reason: archiveReason })
    if (rpcError) {
      console.error(`${restoring ? 'Restore' : 'Archive'} student failed:`, rpcError)
      setError('Unable to update the student record. Please try again.')
      setSaving(false)
      return
    }
    notifyDataChanged({ source: 'student' })
    await onDone()
  }

  return (
    <div className="fixed inset-0 z-[80] flex animate-[fadeIn_180ms_ease-out] items-center justify-center bg-black/40 p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="student-archive-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)' }}>
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--divider-light)', background: 'var(--bg-card)' }}>
          <h2 id="student-archive-title" className="text-sm font-bold" style={{ color: 'var(--nav-header-dark)' }}>{restoring ? 'Restore Student Record?' : 'Archive Student?'}</h2>
          <button onClick={onClose} disabled={saving} aria-label="Close" title="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-[var(--menu-hover-bg)]"><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {restoring
              ? <>Do you want to restore <strong>{student.name}</strong>? The student will appear in the active Student Records list again, and all existing historical information will remain preserved.</>
              : <>Archive <strong>{student.name}</strong>? This record will be removed from active lists but will not be permanently deleted. You can access it again by selecting <strong>Show Archived</strong>.</>}
          </p>
          {!restoring && <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Archive Reason <span style={{ color: 'var(--status-error-text)' }}>*</span></label>
            <select value={reasonChoice} onChange={(e) => { setReasonChoice(e.target.value); setError(null) }}
              className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--input-border)' }}>
              <option value="">Select archive reason</option>
              {['Graduated', 'Inactive', 'Transferred', 'No Longer Eligible', 'Other'].map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </select>
            {reasonChoice === 'Other' && <textarea value={otherReason} onChange={(e) => { setOtherReason(e.target.value); setError(null) }} rows={3} maxLength={500}
              placeholder="Enter archive reason"
              className="mt-2 w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: 'var(--input-border)' }} />}
          </div>}
          {error && <p className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-error-text)' }}>{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} disabled={saving} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: 'var(--border-default)' }}>Cancel</button>
            <button onClick={submit} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
              <span className="flex items-center gap-2">
                {restoring ? <RotateCcw size={15} /> : <Archive size={15} />}
                {saving ? (restoring ? 'Restoring…' : 'Archiving…') : (restoring ? 'Restore' : 'Archive')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
