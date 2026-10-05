import { useEffect } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { AppNotification } from '@/types/database'
import { formatRelativeTime } from '@/utils/formatRelativeTime'

interface Props {
  notification: AppNotification | null
  onClose: () => void
}

export function NotificationDetailModal({ notification, onClose }: Props) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!notification) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [notification, onClose])

  if (!notification) return null

  const action = notification.related_student_id
    ? { label: 'View Related Student', path: `/students?student=${notification.related_student_id}` }
    : notification.type === 'duplicate_flag'
    ? { label: 'Review Duplicate Flag', path: `/reports?duplicateFlag=${notification.related_entity_id ?? ''}` }
    : notification.type === 'expiring_soon'
      ? { label: 'View and Edit Scholarship', path: `/scholarships?edit=${notification.related_entity_id ?? ''}` }
      : notification.type === 'import_complete' || notification.type === 'import_failed'
        ? { label: 'View Student Records', path: '/students' }
        : notification.type === 'enrollment_complete'
          ? { label: 'View Student Records', path: '/students' }
          : notification.type === 'duplicate_review'
            ? { label: 'Review Duplicate Flags', path: '/reports' }
        : null

  function openRelatedRecord() {
    if (!action) return
    onClose()
    navigate(action.path)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="notification-detail-title" onClick={onClose}>
      <div
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-xl shadow-xl"
        style={{ background: 'var(--bg-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--divider-light)', background: 'var(--bg-card)' }}>
          <h2 id="notification-detail-title" className="text-sm font-bold" style={{ color: 'var(--nav-header-dark)' }}>
            {notification.title}
          </h2>
          <button onClick={onClose} aria-label="Close" title="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-[var(--menu-hover-bg)]" style={{ color: 'var(--icon-muted)' }}>
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {notification.message}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatRelativeTime(notification.created_at)}</p>
          {action && (
            <button
              onClick={openRelatedRecord}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-[var(--btn-primary-hover)]"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
            >
              {action.label}
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
