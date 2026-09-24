import { useEffect, useState } from 'react'
import { Archive, RotateCcw, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
    await onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl shadow-xl" style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--divider-light)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--nav-header-dark)' }}>{restoring ? 'Restore Student Record' : 'Archive Student Record'}</h2>
          <button onClick={onClose} disabled={saving} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {restoring
              ? <>Do you want to restore <strong>{student.name}</strong>? The student will appear in the active Student Records list again, and all existing historical information will remain preserved.</>
              : <>Are you sure you want to archive <strong>{student.name}</strong>? The student will be hidden from the active records list, but their information and history will be preserved.</>}
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
                {saving ? (restoring ? 'Restoring…' : 'Archiving…') : (restoring ? 'Confirm Restore' : 'Confirm Archive')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
