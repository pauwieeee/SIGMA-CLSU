import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardTitle } from '@/components/ui/Card'

interface DuplicateMetrics { open: number; resolved: number; total: number }

export function DuplicateFlagsCard({ className, metrics: suppliedMetrics, loading = false }: { className?: string; metrics: DuplicateMetrics; loading?: boolean }) {
  const { open, resolved, total } = suppliedMetrics
  const effectiveLoading = loading
  const hasIssues = !effectiveLoading && open > 0
  const metrics = [
    ['Open Cases', open], ['Resolved', resolved], ['Total Flagged', total],
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
          <CardTitle>Duplicate Flags</CardTitle>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-x-5 gap-y-3">
          {metrics.map(([label, value]) => <div key={label}>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#66806F' }}>{label}</p>
            <p className={label === 'Open Cases' ? 'text-3xl font-extrabold' : 'text-2xl font-bold'} style={{ color: label === 'Open Cases' ? '#174D2D' : '#285943' }}>{effectiveLoading ? '—' : value}</p>
          </div>)}
        </div>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed" style={{ color: '#66806F' }}>
          {effectiveLoading ? 'Checking records…' : 'A duplicate flag is created when one student has both an Active Government scholarship and an Active Private scholarship in the same Academic Year and Semester.'}
        </p>
      </div>
      <Link
        to="/reports"
        className="w-fit shrink-0 rounded-md px-4 py-2 text-sm font-semibold"
        style={{ background: 'var(--btn-primary-bg)', color: 'white' }}
      >
        Review Duplicate Flags
      </Link>
    </Card>
  )
}
