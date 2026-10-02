export type PaginationItem = number | 'ellipsis'

export function paginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
  const ordered = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b)
  const result: PaginationItem[] = []
  ordered.forEach((page, index) => {
    if (index > 0 && page - ordered[index - 1] > 1) result.push('ellipsis')
    result.push(page)
  })
  return result
}
