import { statusBadgeStyle, statusShortLabel } from '@/utils/statusStyle'

export function StatusBadge({ status }: { status: string }) {
  const short = statusShortLabel(status)
  return (
    <span
      title={short !== status ? status : undefined}
      className="status-badge"
      style={{
        ...statusBadgeStyle(status),
      }}
    >
      {short}
    </span>
  )
}
