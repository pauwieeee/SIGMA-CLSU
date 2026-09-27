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
  const [administrator, setAdministrator] = useState('')
  const [student, setStudent] = useState('')
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filteredLogs = useMemo(() => logs.filter((log) => {
    const actor = `${log.actor_name ?? ''} ${log.actor_email ?? ''}`.toLowerCase()
    if (administrator && !actor.includes(administrator.toLowerCase())) return false
    if (student && !log.description.toLowerCase().includes(student.toLowerCase())) return false
    if (action && log.action !== action) return false
    const occurred = new Date(log.created_at).getTime()
    if (dateFrom && occurred < new Date(`${dateFrom}T00:00:00`).getTime()) return false
    if (dateTo && occurred > new Date(`${dateTo}T23:59:59`).getTime()) return false
    return true
  }), [logs, administrator, student, action, dateFrom, dateTo])

  const grouped = GROUP_ORDER.map((label) => ({
    label,
    items: filteredLogs.filter((l) => groupLabelFor(l.created_at) === label),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>
          Activity Log
        </h1>
      </div>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input value={administrator} onChange={(e) => setAdministrator(e.target.value)} placeholder="Administrator" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--input-border)' }} />
          <input value={student} onChange={(e) => setStudent(e.target.value)} placeholder="Student name or ID" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--input-border)' }} />
          <select value={action} onChange={(e) => setAction(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--input-border)' }}><option value="">All actions</option><option value="create">Created</option><option value="update">Edited / Status Changed</option><option value="delete">Deleted</option><option value="archive">Archived</option><option value="restore">Restored</option><option value="renew">Renewed</option><option value="verify_enrollment">Verified Enrollment</option><option value="resolve">Duplicate Resolved</option></select>
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>From<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--input-border)' }} /></label>
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>To<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--input-border)' }} /></label>
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>{filteredLogs.length} matching activit{filteredLogs.length === 1 ? 'y' : 'ies'}</p>
      </Card>

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
import { useMemo, useState } from 'react'
