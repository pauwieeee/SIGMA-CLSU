import { useEffect } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

export interface ToastMessage {
  id: number
  text: string
  tone: 'success' | 'error'
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const isSuccess = toast.tone === 'success'

  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg"
      style={{
        background: isSuccess ? 'var(--status-success-bg)' : 'var(--status-incomplete-bg)',
        color: isSuccess ? 'var(--status-success-text)' : 'var(--status-incomplete-text)',
      }}
    >
      {isSuccess ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      {toast.text}
    </div>
  )
}
