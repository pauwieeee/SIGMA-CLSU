import { useCallback, useState } from 'react'
import type { ToastMessage } from '@/components/ui/Toast'

let nextId = 1

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const push = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, text, tone }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, push, dismiss }
}
