import type { AssistantPagination as AssistantPaginationData } from '@/utils/assistantClient'
import { paginationItems } from '@/utils/assistantPagination'

export function AssistantPagination({
  data,
  page,
  onPageChange,
}: {
  data: AssistantPaginationData
  page: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(data.rows.length / data.pageSize))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const start = (currentPage - 1) * data.pageSize
  const end = Math.min(start + data.pageSize, data.rows.length)
  const visibleRows = data.rows.slice(start, end)

  return (
    <div className="mt-2.5">
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--divider-light)', background: 'var(--bg-card)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: 'var(--menu-active-bg)' }}>
              {data.columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-2.5 py-2 text-left font-semibold" style={{ color: 'var(--nav-header-dark)' }}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={`${start}-${rowIndex}`} className="border-t" style={{ borderColor: 'var(--divider-light)' }}>
                {data.columns.map((column) => (
                  <td key={column.key} className="px-2.5 py-2 align-top" style={{ color: 'var(--text-primary)' }}>
                    {row[column.key] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-1" aria-label={`${data.title} pagination`}>
        <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className="rounded-md border px-2 py-1 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: 'var(--divider-light)' }}>Previous</button>
        {paginationItems(currentPage, totalPages).map((item, index) => item === 'ellipsis'
          ? <span key={`ellipsis-${index}`} className="px-1 text-xs" style={{ color: 'var(--text-muted)' }}>…</span>
          : <button key={item} type="button" aria-current={item === currentPage ? 'page' : undefined} onClick={() => onPageChange(item)} className="h-7 min-w-7 rounded-md border px-1 text-[11px] font-semibold" style={item === currentPage ? { borderColor: 'var(--btn-primary-bg)', background: 'var(--btn-primary-bg)', color: 'white' } : { borderColor: 'var(--divider-light)', color: 'var(--nav-header-dark)' }}>{item}</button>)}
        <button type="button" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} className="rounded-md border px-2 py-1 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: 'var(--divider-light)' }}>Next</button>
      </div>
      <p className="mt-1.5 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Page {currentPage} of {totalPages} · Showing {start + 1}–{end} of {data.rows.length} {data.noun}
      </p>
    </div>
  )
}
