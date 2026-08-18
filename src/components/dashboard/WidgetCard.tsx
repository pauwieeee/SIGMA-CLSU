import type { ReactNode } from 'react'
import clsx from 'clsx'

// Styling dedicated to the "Scholars per Category" / "By Category Type"
// chart widgets (Dashboard, Reports & Analytics): white card, soft shadow,
// no visible border — distinct from the general-purpose Card component.
export function WidgetCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx('rounded-xl p-5', className)}
      style={{
        background: 'var(--widget-card-bg)',
        boxShadow: '0 2px 6px var(--widget-card-shadow)',
        border: 'none',
      }}
    >
      {children}
    </div>
  )
}

export function WidgetTitle({ children }: { children: ReactNode }) {
  return (
    <h3
      className="mb-3 text-xs font-bold tracking-wider uppercase"
      style={{ color: 'var(--widget-heading-text)' }}
    >
      {children}
    </h3>
  )
}
