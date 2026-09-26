import type { CSSProperties } from 'react'
import clsx from 'clsx'

interface Props {
  className?: string
  style?: CSSProperties
}

/** Shared visual identity for the SIGMA AI assistant. */
export function SigmaAIWordmark({ className, style }: Props) {
  return (
    <span className={clsx('sigma-ai-wordmark', className)} style={style} aria-label="SIGMAI">
      <span className="sigma-ai-wordmark-base" aria-hidden="true">SIGM</span>
      <span className="sigma-ai-wordmark-accent" aria-hidden="true">
        AI
        <span className="sigma-ai-wordmark-sparkles"><i /><i /></span>
      </span>
    </span>
  )
}
