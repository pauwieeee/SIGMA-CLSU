import type { ActivityLog } from '@/types/database'
import { Avatar } from '@/components/ui/Avatar'

function activityActorName(activity: ActivityLog) {
  if (activity.actor_name?.trim()) return activity.actor_name.trim()
  if (activity.actor_email) return activity.actor_email.split('@')[0]
  return 'Unknown admin'
}

export function ActivityActor({ activity, showEmail = false }: { activity: ActivityLog; showEmail?: boolean }) {
  const name = activityActorName(activity)

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} size={32} />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</p>
        <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
          {activity.actor_role || 'Admin'}
          {showEmail && activity.actor_email ? ` · ${activity.actor_email}` : ''}
        </p>
      </div>
    </div>
  )
}
