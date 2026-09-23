import { Card, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { ActivityActor } from '@/components/activity/ActivityActor'
import { useRecentActivity } from '@/hooks/useDashboardData'

const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'] as const

function groupLabelFor(isoDate: string): (typeof GROUP_ORDER)[number] {
  const now = new Date()
  const date = new Date(isoDate)

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const today = startOfDay(now)
  const target = startOfDay(date)
  const dayDiff = Math.round((today.getTime() - target.getTime()) / 86400000)

  if (dayDiff === 0) return 'Today'
  if (dayDiff === 1) return 'Yesterday'
  if (dayDiff <= 7) return 'This Week'
  if (dayDiff <= 30) return 'This Month'
  return 'Older'
}

export default function ActivityLogPage() {
  const { data: logs, loading, error } = useRecentActivity(200)

  const grouped = GROUP_ORDER.map((label) => ({
    label,
    items: logs.filter((l) => groupLabelFor(l.created_at) === label),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>
          Activity Log
        </h1>
      </div>

      {error ? (
        <Card>
          <p className="text-sm" style={{ color: 'var(--status-error-text)' }}>
            Unable to load the latest activity: {error}
          </p>
        </Card>
      ) : loading ? (
        <Card>
          <ul className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <li key={i} className="flex items-center justify-between py-1">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-10" />
              </li>
            ))}
          </ul>
        </Card>
      ) : grouped.length === 0 ? (
        <Card>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No activity recorded yet.</p>
        </Card>
      ) : (
        grouped.map((group) => (
          <Card key={group.label}>
            <CardTitle>{group.label}</CardTitle>
            <ul className="divide-y" style={{ borderColor: 'var(--divider-light)' }}>
              {group.items.map((a) => (
                <li key={a.id} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,300px)_auto] sm:items-center">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--btn-primary-bg)' }} />
                    <div className="min-w-0">
                      <p className="text-sm leading-5" style={{ color: 'var(--text-secondary)' }}>{a.description}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        {a.entity_type.replaceAll('_', ' ')}{a.entity_id ? ` · Record ${a.entity_id.slice(0, 8)}` : ''}
                      </p>
                    </div>
                  </div>
                  <ActivityActor activity={a} showEmail />
                  <span className="shrink-0 text-xs sm:text-right" style={{ color: 'var(--text-muted)' }}>{formatRelativeTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  )
}
