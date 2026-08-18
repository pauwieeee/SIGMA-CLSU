import type { CSSProperties } from 'react'

// Shared pulsing placeholder block. Pass className to size/shape it to match
// whatever content it stands in for (a stat number, a chart, a table row…).
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ background: 'var(--bg-secondary)', ...style }}
      aria-hidden="true"
    />
  )
}
