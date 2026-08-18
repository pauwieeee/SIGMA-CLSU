import { X } from 'lucide-react'
import type { AppNotification } from '@/types/database'
import { formatRelativeTime } from '@/utils/formatRelativeTime'

interface Props {
  notification: AppNotification | null
  onClose: () => void
}

export function NotificationDetailModal({ notification, onClose }: Props) {
  if (!notification) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl shadow-xl"
        style={{ background: 'var(--bg-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--divider-light)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--nav-header-dark)' }}>
            {notification.title}
          </h2>
          <button onClick={onClose} aria-label="Close" style={{ color: 'var(--icon-muted)' }}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2 px-5 py-4">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {notification.message}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatRelativeTime(notification.created_at)}</p>
        </div>
      </div>
    </div>
  )
}
