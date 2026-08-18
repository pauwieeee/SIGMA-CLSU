import type { CSSProperties, ReactNode } from 'react'
import clsx from 'clsx'

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function Card({ children, className, style }: CardProps) {
  return (
    <div
      className={clsx('rounded-xl border p-5', className)}
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-default)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--nav-header-dark)' }}>
      {children}
    </h3>
  )
}
