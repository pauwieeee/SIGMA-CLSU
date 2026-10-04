export const OPEN_DUPLICATE_STATUSES = ['Open', 'Under Review'] as const
export const RESOLVED_DUPLICATE_STATUSES = ['Resolved', 'Confirmed Valid'] as const

export function isOpenDuplicateStatus(status: string) {
  return (OPEN_DUPLICATE_STATUSES as readonly string[]).includes(status)
}

export function isResolvedDuplicateStatus(status: string) {
  return (RESOLVED_DUPLICATE_STATUSES as readonly string[]).includes(status)
}
