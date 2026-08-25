import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import type { ActivityLog } from '@/types/database'

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
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!active) return
        if (!error && data) setLogs(data as ActivityLog[])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

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
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Every change made in SIGMA, grouped by when it happened.
        </p>
      </div>

      {loading ? (
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
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--btn-primary-bg)' }} />
                    <div className="min-w-0">
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{a.description}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {a.actor_email ?? 'Unknown admin'}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>{formatRelativeTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  )
}
