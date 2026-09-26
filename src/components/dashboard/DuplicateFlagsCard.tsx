import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDuplicateFlags } from '@/hooks/useDuplicateFlags'
import { Card, CardTitle } from '@/components/ui/Card'

export function DuplicateFlagsCard({ className }: { className?: string }) {
  const { rows, loading } = useDuplicateFlags('All')
  const unresolved = rows.filter((row) => row.status === 'Open').length
  const underReview = rows.filter((row) => row.status === 'Under Review').length
  const resolved = rows.filter((row) => row.status === 'Resolved').length
  const confirmedValid = rows.filter((row) => row.status === 'Confirmed Valid').length
  const hasIssues = !loading && unresolved + underReview > 0
  const metrics = [
    ['Total Conflicts', rows.length], ['Unresolved', unresolved], ['Under Review', underReview],
    ['Resolved', resolved], ['Confirmed Valid', confirmedValid],
  ] as const

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
          <CardTitle>Potential Scholarship Conflicts</CardTitle>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3">
          {metrics.map(([label, value]) => <div key={label}>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#66806F' }}>{label}</p>
            <p className="text-2xl font-bold" style={{ color: '#285943' }}>{loading ? '—' : value}</p>
          </div>)}
        </div>
        <p className="mt-2 max-w-2xl text-xs" style={{ color: '#66806F' }}>
          {loading ? 'Checking records…' : hasIssues ? 'Records require administrator review.' : 'No records currently need review.'}
        </p>
        <p className="mt-1 max-w-2xl text-xs" style={{ color: '#66806F' }}>
          A scholarship conflict occurs when the same student has two or more Active scholarships within the same Academic Year and Semester. These cases require administrator review before approval.
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
