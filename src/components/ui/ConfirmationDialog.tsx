import { useEffect } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  message: string
  cancelLabel: string
  confirmLabel: string
  tone?: 'primary' | 'danger'
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmationDialog({ open, title, message, cancelLabel, confirmLabel, tone = 'primary', onCancel, onConfirm }: Props) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return <div
    className="fixed inset-0 z-[100] flex animate-[fadeIn_180ms_ease-out] items-center justify-center bg-black/45 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirmation-dialog-title"
    onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}
  >
    <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)' }}>
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--divider-light)' }}>
        <h2 id="confirmation-dialog-title" className="text-base font-bold" style={{ color: 'var(--nav-header-dark)' }}>{title}</h2>
        <button type="button" onClick={onCancel} aria-label="Close confirmation"><X size={18}/></button>
      </div>
      <div className="px-5 py-4"><p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{message}</p></div>
      <div className="flex justify-end gap-2 border-t px-5 py-4" style={{ borderColor: 'var(--divider-light)' }}>
        <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>{cancelLabel}</button>
        <button type="button" onClick={onConfirm} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: tone === 'danger' ? '#b91c1c' : 'var(--btn-primary-bg)' }}>{confirmLabel}</button>
      </div>
    </div>
  </div>
}
