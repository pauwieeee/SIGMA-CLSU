import { statusBadgeStyle, statusShortLabel } from '@/utils/statusStyle'

export function StatusBadge({ status }: { status: string }) {
  const short = statusShortLabel(status)
  return (
    <span
      title={short !== status ? status : undefined}
      className="inline-block font-semibold"
      style={{
        ...statusBadgeStyle(status),
        whiteSpace: 'nowrap',
        fontSize: 12,
        padding: '4px 10px',
        borderRadius: 12,
        lineHeight: 1.4,
      }}
    >
      {short}
    </span>
  )
}
