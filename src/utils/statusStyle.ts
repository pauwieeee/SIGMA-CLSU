// Shared status-badge color + label mapping onto the SIGMA palette's status
// tokens, so every status pill across the app (students, scholarships,
// duplicate flags) looks and reads the same.

export interface BadgeStyle {
  background: string
  color: string
}

const statusStyles: Record<string, BadgeStyle> = {
  Active: { background: 'var(--status-active-bg)', color: 'var(--status-active-text)' },
  'Expiring Soon': { background: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' },
  'For Renewal': { background: 'var(--status-renewal-bg)', color: 'var(--status-renewal-text)' },
  'Pending Verification': { background: 'var(--status-pending-bg)', color: 'var(--status-pending-text)' },
  'Documents Incomplete': { background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' },
  Inactive: { background: 'var(--bg-secondary)', color: 'var(--text-muted)' },
  Closed: { background: 'var(--bg-secondary)', color: 'var(--text-muted)' },
  Archived: { background: 'var(--bg-secondary)', color: 'var(--text-disabled)' },
  Duplicate: { background: 'var(--status-duplicate-bg)', color: 'var(--status-duplicate-text)' },
  Resolved: { background: 'var(--status-active-bg)', color: 'var(--status-active-text)' },
}

// Short labels keep the badge on one line in narrow table cells; the full
// wording is preserved via the `title` tooltip so nothing is lost.
const shortLabels: Record<string, string> = {
  'Pending Verification': 'Pending',
  'Documents Incomplete': 'Incomplete',
  'For Renewal': 'Renewal',
}

const fallback: BadgeStyle = { background: 'var(--bg-secondary)', color: 'var(--text-muted)' }

export function statusBadgeStyle(status: string): BadgeStyle {
  return statusStyles[status] ?? fallback
}

export function statusShortLabel(status: string): string {
  return shortLabels[status] ?? status
}
