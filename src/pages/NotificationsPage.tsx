import { useMemo } from 'react'
import { useNotifications } from '@/hooks/useNotifications'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import type { AppNotification } from '@/types/database'

function dateGroupLabel(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)

  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 6) return 'This Week'
  return 'Earlier'
}

function groupByDate(notifications: AppNotification[]): { label: string; items: AppNotification[] }[] {
  const groups: { label: string; items: AppNotification[] }[] = []
  for (const n of notifications) {
    const label = dateGroupLabel(n.created_at)
    const existing = groups.find((g) => g.label === label)
    if (existing) existing.items.push(n)
    else groups.push({ label, items: [n] })
  }
  return groups
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markAllRead, markOneRead } = useNotifications(100)
  const groups = useMemo(() => groupByDate(notifications), [notifications])

  return (
    <div className="space-y-4">
      <div
        className="overflow-hidden rounded-lg border"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--border-default)' }}>
          <h1 className="text-xl font-bold tracking-wide" style={{ color: 'var(--nav-header-dark)' }}>
            NOTIFICATIONS
          </h1>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-[var(--menu-hover-bg)]"
              style={{ borderColor: 'var(--border-default)', color: 'var(--btn-primary-bg)' }}
            >
              Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No notifications yet.
          </p>
        ) : (
          <div>
            {groups.map((group) => (
              <div key={group.label}>
                <p
                  className="sticky top-0 z-10 border-b px-5 py-2 text-xs font-bold tracking-wider uppercase"
                  style={{ borderColor: 'var(--divider-light)', background: '#F1F5EF', color: 'var(--text-muted)' }}
                >
                  {group.label}
                </p>
                <ul className="divide-y" style={{ borderColor: 'var(--divider-light)' }}>
                  {group.items.map((n) => {
                    const unread = !n.is_read
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => markOneRead(n.id)}
                          className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--menu-hover-bg)]"
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
                            <p className="mt-1 text-sm" style={{ color: unread ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {n.message}
                            </p>
                            <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                              {formatRelativeTime(n.created_at)}
                            </p>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
