interface Props {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

function pageNumbersFor(current: number, total: number): number[] {
  const windowSize = 4
  let start = Math.max(1, current - Math.floor(windowSize / 2))
  const end = Math.min(total, start + windowSize - 1)
  start = Math.max(1, end - windowSize + 1)
  const pages: number[] = []
  for (let p = start; p <= end; p++) pages.push(p)
  return pages
}

// Shared pagination control — reused by any table in the app that paginates
// (Student Records, and future long lists like Scholarship Categories).
export function Pagination({ currentPage, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null

  const pages = pageNumbersFor(currentPage, totalPages)

  return (
    <div
      className="flex items-center justify-end gap-1.5 px-4 py-3"
      style={{ borderTop: '1px solid var(--border-default)' }}
    >
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
      >
        Previous
      </button>

      {pages[0] > 1 && <span style={{ color: 'var(--text-muted)' }}>…</span>}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          aria-current={p === currentPage ? 'page' : undefined}
          className="flex h-8 min-w-8 items-center justify-center rounded-md border text-[13px]"
          style={
            p === currentPage
              ? { background: 'var(--btn-primary-bg)', color: '#FFFFFF', borderColor: 'var(--btn-primary-bg)' }
              : { background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }
          }
        >
          {p}
        </button>
      ))}

      {pages[pages.length - 1] < totalPages && <span style={{ color: 'var(--text-muted)' }}>…</span>}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
      >
        Next
      </button>
    </div>
  )
}
