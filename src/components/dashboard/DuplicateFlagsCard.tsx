import { useDuplicateFlags } from '@/hooks/useDuplicateFlags'
import { Card, CardTitle } from '@/components/ui/Card'

export function DuplicateFlagsCard() {
  const { rows, loading, resolve } = useDuplicateFlags()

  return (
    <Card>
      <CardTitle>Duplicate Flags Needing Review</CardTitle>
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No open duplicate flags. Nice.</p>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--divider-light)' }}>
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {r.student_name} <span style={{ color: 'var(--text-muted)' }}>({r.student_number})</span>
                </p>
                <p className="truncate text-xs" style={{ color: 'var(--status-error-text)' }}>
                  {r.scholarship_a} + {r.scholarship_b}
                </p>
              </div>
              <button
                onClick={() => resolve(r.id)}
                className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-[var(--menu-hover-bg)]"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Mark Resolved
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
