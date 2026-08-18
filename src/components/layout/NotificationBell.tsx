import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { NotificationDetailModal } from '@/components/layout/NotificationDetailModal'
import type { AppNotification } from '@/types/database'

const PREVIEW_COUNT = 5

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<AppNotification | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const preview = notifications.slice(0, PREVIEW_COUNT)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggle() {
    setOpen((v) => !v)
  }

  function openFull(n: AppNotification) {
    markOneRead(n.id)
    setViewing(n)
    setOpen(false)
  }

  function seeAll() {
    setOpen(false)
    navigate('/notifications')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--menu-hover-bg)]"
        style={{ color: 'var(--icon-default)' }}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ background: 'var(--status-error-text)' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-lg border shadow-lg"
          style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-2.5"
            style={{ borderColor: 'var(--divider-light)' }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--nav-header-dark)' }}>
              Notifications{unreadCount > 0 ? ` ${unreadCount}` : ''}
            </p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium hover:underline"
                style={{ color: 'var(--btn-primary-bg)' }}
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {preview.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--divider-light)' }}>
                {preview.map((n) => {
                  const unread = !n.is_read
                  return (
                    <li key={n.id}>
                      <div
                        className="flex items-start gap-2 px-4 py-3"
                        style={unread ? { background: 'var(--menu-active-bg)' } : undefined}
                      >
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: unread ? 'var(--btn-primary-bg)' : 'transparent' }}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm ${unread ? 'font-bold' : 'font-medium'}`}
                            style={{ color: unread ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                          >
                            {n.title}
                          </p>
                          <p
                            className="mt-0.5 line-clamp-2 text-xs"
                            style={{ color: unread ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                          >
                            {n.message}
                          </p>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {formatRelativeTime(n.created_at)}
                            </p>
                            <button
                              onClick={() => openFull(n)}
                              className="text-xs font-medium hover:underline"
                              style={{ color: 'var(--btn-primary-bg)' }}
                            >
                              View full notification
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="border-t" style={{ borderColor: 'var(--divider-light)' }}>
            <button
              onClick={seeAll}
              className="w-full py-2.5 text-center text-sm font-medium hover:bg-[var(--menu-hover-bg)]"
              style={{ color: 'var(--nav-header-dark)' }}
            >
              See all
            </button>
          </div>
        </div>
      )}

      <NotificationDetailModal notification={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}
