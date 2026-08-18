// Central chart styling so every chart across the app pulls from the same
// CSS custom properties instead of hardcoding colors per page.

const CATEGORY_ORDER = ['Government', 'Institutional', 'Private']

const sliceColors: Record<string, string> = {
  Government: 'var(--pie-government)',
  Institutional: 'var(--pie-institutional)',
  Private: 'var(--pie-private)',
}
const fallbackSliceColors = ['var(--pie-government)', 'var(--pie-institutional)', 'var(--pie-private)']

export function colorForCategory(name: string, index: number) {
  return sliceColors[name] ?? fallbackSliceColors[index % fallbackSliceColors.length]
}

/** Enforces Government → Institutional → Private ordering for bar/pie/legend data, regardless of query order. */
export function sortByCategoryOrder<T extends { category_name: string }>(data: T[]): T[] {
  return [...data].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category_name)
    const bi = CATEGORY_ORDER.indexOf(b.category_name)
    return (ai === -1 ? CATEGORY_ORDER.length : ai) - (bi === -1 ? CATEGORY_ORDER.length : bi)
  })
}

export const chartAxisTick = { fontSize: 12, fill: 'var(--chart-axis-label)' }

export const chartGridStroke = 'var(--chart-grid)'

export const chartTooltipStyle = {
  contentStyle: {
    background: 'var(--tooltip-bg)',
    color: 'var(--tooltip-text)',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
  },
  itemStyle: { color: 'var(--tooltip-text)' },
  labelStyle: { color: 'var(--tooltip-text)' },
}

export const chartLegendStyle = { fontSize: 12, color: 'var(--legend-text)' }
