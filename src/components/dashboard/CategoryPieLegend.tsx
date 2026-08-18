import { colorForCategory } from '@/utils/chartTheme'

interface Props {
  data: { category_name: string; scholar_count: number }[]
}

export function CategoryPieLegend({ data }: Props) {
  const total = data.reduce((sum, d) => sum + d.scholar_count, 0)

  return (
    <ul className="mt-3 space-y-1.5">
      {data.map((d, i) => {
        const pct = total > 0 ? Math.round((d.scholar_count / total) * 100) : 0
        return (
          <li key={d.category_name} className="flex items-center gap-2 text-sm" style={{ color: 'var(--legend-text)' }}>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: colorForCategory(d.category_name, i) }}
            />
            {d.category_name} ({pct}%)
          </li>
        )
      })}
    </ul>
  )
}
