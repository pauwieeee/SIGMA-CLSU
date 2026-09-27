import { useCallback, useEffect, useId, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AppNotification } from '@/types/database'

// limit governs how much history is loaded (and therefore how far the
// unread count and "see all" page can see) — it's independent of how many
// items the dropdown preview actually renders, which is capped separately.
export function useNotifications(limit = 50) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const instanceId = useId()

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .is('dismissed_at', null)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(limit)
    let rows = (data ?? []) as AppNotification[]
    const expiringIds = [...new Set(rows
      .filter((notification) => notification.type === 'expiring_soon' && notification.related_entity_id)
      .map((notification) => notification.related_entity_id as string))]

    // Defensively hide stale legacy notifications even before the cleanup
    // migration is applied to an older deployment.
    if (expiringIds.length > 0) {
      const { data: scholarships, error } = await (supabase as any)
        .from('scholarships')
        .select('id, status, end_date, archived_at')
        .in('id', expiringIds)
      if (!error) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const cutoff = new Date(today)
        cutoff.setDate(cutoff.getDate() + 30)
        const validIds = new Set((scholarships ?? []).filter((scholarship: any) => {
          if (!scholarship.end_date || scholarship.archived_at || ['Archived', 'Inactive', 'Expired'].includes(scholarship.status)) return false
          const endDate = new Date(`${scholarship.end_date}T00:00:00`)
          return endDate >= today && endDate <= cutoff
        }).map((scholarship: any) => scholarship.id))
        rows = rows.filter((notification) => notification.type !== 'expiring_soon'
          || (notification.related_entity_id != null && validIds.has(notification.related_entity_id)))
      }
    }

    setNotifications(rows)
    setLoading(false)
  }, [limit])

  useEffect(() => {
    load()

    // Channel names must be unique per subscription — multiple mounted
    // instances of this hook (e.g. the always-on NotificationBell plus the
    // full NotificationsPage) would otherwise fight over the same topic.
    const channel = supabase
      .channel(`notifications-changes-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => load())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load, instanceId])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await (supabase as any).from('notifications').update({ is_read: true }).in('id', unreadIds)
  }

  async function markOneRead(id: string) {
    const target = notifications.find((n) => n.id === id)
    if (!target || target.is_read) return
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    await (supabase as any).from('notifications').update({ is_read: true }).eq('id', id)
  }

  async function dismiss(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    await (supabase as any).from('notifications').update({ dismissed_at: new Date().toISOString() }).eq('id', id)
  }

  async function archive(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    await (supabase as any).from('notifications').update({ archived_at: new Date().toISOString() }).eq('id', id)
  }

  return { notifications, unreadCount, loading, markAllRead, markOneRead, dismiss, archive, refetch: load }
}
