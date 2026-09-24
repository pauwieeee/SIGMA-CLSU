import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDuplicateFlags } from '@/hooks/useDuplicateFlags'
import { Card, CardTitle } from '@/components/ui/Card'

export function DuplicateFlagsCard({ className }: { className?: string }) {
  const { rows, loading } = useDuplicateFlags()
  const hasIssues = !loading && rows.length > 0

  return (
    <Card
      className={`flex flex-col justify-between gap-4 sm:flex-row sm:items-center ${className ?? ''}`}
      style={{ background: '#E8F5E9', borderColor: '#C8E6C9' }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {hasIssues
            ? <AlertTriangle size={19} style={{ color: 'var(--status-warning-text)' }} />
            : <CheckCircle2 size={19} style={{ color: '#4CAF50' }} />}
          <CardTitle>Potential Duplicates / Issues</CardTitle>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#66806F' }}>Potential Duplicates</p>
            <p className="text-3xl font-bold" style={{ color: '#285943' }}>{loading ? '—' : rows.length}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#66806F' }}>Records Requiring Review</p>
            <p className="text-3xl font-bold" style={{ color: '#285943' }}>{loading ? '—' : rows.length}</p>
          </div>
        </div>
        <p className="mt-2 text-xs" style={{ color: '#66806F' }}>
          {loading ? 'Checking records…' : hasIssues ? 'Records require administrator review.' : 'No records currently need review.'}
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
