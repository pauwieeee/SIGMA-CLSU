import { useDuplicateFlags } from '@/hooks/useDuplicateFlags'
import { Card, CardTitle } from '@/components/ui/Card'
import { Link } from 'react-router-dom'

export function DuplicateFlagsCard() {
  const { rows, loading } = useDuplicateFlags()

  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <CardTitle>Potential Duplicates / Issues</CardTitle>
        <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>
          {loading ? '—' : rows.length}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {loading
            ? 'Checking records…'
            : rows.length === 0
              ? 'No records currently need review.'
              : 'Records requiring administrator review.'}
        </p>
      </div>
      <Link
        to="/reports"
        className="w-fit shrink-0 rounded-md px-4 py-2 text-sm font-semibold"
        style={{ background: 'var(--btn-primary-bg)', color: 'white' }}
      >
        Review Records
      </Link>
    </Card>
  )
}
