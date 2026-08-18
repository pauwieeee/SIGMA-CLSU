import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

interface StatCardProps {
  label: string
  value: string | number
  detail?: string
  detailTone?: 'neutral' | 'good' | 'warn' | 'bad'
  loading?: boolean
}

const toneColors: Record<NonNullable<StatCardProps['detailTone']>, string> = {
  neutral: 'var(--text-muted)',
  good: 'var(--status-success-text)',
  warn: 'var(--status-warning-text)',
  bad: 'var(--status-error-text)',
}

export function StatCard({ label, value, detail, detailTone = 'neutral', loading }: StatCardProps) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>
          {value}
        </p>
      )}
      {loading ? (
        <Skeleton className="mt-2 h-3 w-24" />
      ) : (
        detail && (
          <p className="mt-1 text-xs" style={{ color: toneColors[detailTone] }}>
            {detail}
          </p>
        )
      )}
    </Card>
  )
}
