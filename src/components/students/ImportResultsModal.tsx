import { useMemo, useState } from 'react'
import { Download, Search, X } from 'lucide-react'
import type { ImportResult, ImportRowResult } from '@/utils/importStudents'

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`

function downloadFailures(result: ImportResult) {
  const failed = result.rows.filter((row) => row.status === 'Failed')
  if (!failed.length) return
  const headers = ['Original Row Number', 'Student ID', 'Student Name', 'Error Type', 'Error Message', 'Suggested Correction']
  const lines = [headers, ...failed.map((row) => [row.row, row.studentNumber, row.studentName, row.errorType, row.message, row.suggestedCorrection])]
    .map((row) => row.map(csvCell).join(','))
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${result.filename.replace(/\.[^.]+$/, '')}-failed-rows.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function ResultBadge({ row }: { row: ImportRowResult }) {
  const colors = row.status === 'Success' || row.status === 'Updated'
    ? { background: 'var(--status-success-bg)', color: 'var(--status-success-text)' }
    : row.status === 'Skipped'
      ? { background: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' }
      : row.errorType === 'Database Error'
        ? { background: '#fff7ed', color: '#c2410c' }
        : { background: 'var(--status-incomplete-bg)', color: 'var(--status-error-text)' }
  return <span className="rounded-full px-2 py-1 text-[11px] font-semibold" style={colors}>{row.status}</span>
}

type ResultFilter = 'All' | 'Success' | 'Failed' | 'Skipped'

export function ImportResultsModal({ result, onClose }: { result: ImportResult | null; onClose: () => void }) {
  const [filter, setFilter] = useState<ResultFilter>('All')
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<ImportRowResult | null>(null)
  const visibleRows = useMemo(() => {
    if (!result) return []
    const query = search.trim().toLowerCase()
    return result.rows.filter((row) => {
      if (filter === 'Success' && row.status !== 'Success' && row.status !== 'Updated') return false
      if (filter !== 'All' && filter !== 'Success' && row.status !== filter) return false
      return !query || `${row.row} ${row.studentNumber} ${row.studentName}`.toLowerCase().includes(query)
    })
  }, [result, filter, search])

  if (!result) return null
  const failedCount = result.validationErrorCount + result.databaseErrorCount
  const importedCount = result.rows.filter((row) => row.status === 'Success').length
  const bannerStyle = result.databaseErrorCount > 0
    ? { background: '#fff7ed', color: '#9a3412', borderColor: '#fdba74' }
    : result.validationErrorCount > 0
      ? { background: 'var(--status-incomplete-bg)', color: 'var(--status-error-text)', borderColor: 'var(--status-error-text)' }
      : { background: 'var(--status-success-bg)', color: 'var(--status-success-text)', borderColor: 'var(--status-success-text)' }
  const cards: Array<[string, number | string]> = [
    ['Imported Records', result.newStudentsCreated], ['Updated Records', result.updatedExistingCount],
    ['Duplicate Rows Skipped', result.existingCount], ['Duplicate Flags Created', result.duplicateFlagsCreated],
    ['Validation Errors', result.validationErrorCount], ['Database Errors', result.databaseErrorCount],
  ]

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="import-results-title">
    <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)' }}>
      <div className="flex shrink-0 items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--divider-light)' }}><div><h2 id="import-results-title" className="text-lg font-bold" style={{ color: 'var(--nav-header-dark)' }}>Import Results Report</h2><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{result.filename}</p></div><button onClick={onClose} aria-label="Close import report"><X size={19}/></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-4 rounded-lg border px-4 py-3" style={bannerStyle}><p className="font-bold">{result.status === 'Completed' ? 'Import completed successfully' : 'Import completed with errors'}</p><p className="mt-1 text-sm">{importedCount} imported · {result.updatedExistingCount} updated · {result.existingCount} duplicate Excel rows skipped · {result.duplicateFlagsCreated} duplicate flags created · {result.validationErrorCount} validation errors{result.databaseErrorCount ? ` · ${result.databaseErrorCount} database errors` : ''}.</p>{result.databaseErrorCount > 0 && <p className="mt-1 text-xs">Database errors are listed below. No Excel changes are required for internal query errors.</p>}</div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-6">{cards.map(([label, value]) => {
          const accent = label === 'Validation Errors' && Number(value) > 0 ? 'var(--status-error-text)' : label === 'Database Errors' && Number(value) > 0 ? '#c2410c' : label === 'Duplicate Rows Skipped' && Number(value) > 0 ? 'var(--status-warning-text)' : label === 'Duplicate Flags Created' && Number(value) > 0 ? 'var(--status-duplicate-text)' : 'var(--nav-header-dark)'
          return <div key={label} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}><p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p><p className="mt-1 text-xl font-bold" style={{ color: accent }}>{value}</p></div>
        })}</div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2 overflow-x-auto">{(['All', 'Success', 'Failed', 'Skipped'] as const).map((value) => <button key={value} onClick={() => setFilter(value)} className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={filter === value ? { background: 'var(--btn-primary-bg)', color: 'white', borderColor: 'var(--btn-primary-bg)' } : { borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>{value}</button>)}</div><div className="relative sm:w-72"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search row, ID, or name" className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm" style={{ borderColor: 'var(--input-border)' }}/></div></div>
        <div className="mt-3 overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-default)' }}><table className="w-full min-w-[940px] text-left text-xs"><thead style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Student ID</th><th className="px-3 py-2">Student Name</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Error Type</th><th className="px-3 py-2">Message</th><th className="px-3 py-2">Action</th></tr></thead><tbody className="divide-y" style={{ borderColor: 'var(--divider-light)' }}>{visibleRows.map((row) => <tr key={`${row.row}-${row.status}`}><td className="px-3 py-2">{row.row}</td><td className="px-3 py-2">{row.studentNumber || '—'}</td><td className="px-3 py-2">{row.studentName || '—'}</td><td className="px-3 py-2"><ResultBadge row={row}/>{row.duplicateFlagCreated && <span className="ml-1 rounded-full px-2 py-1 text-[11px] font-semibold" style={{ background: 'var(--status-duplicate-bg)', color: 'var(--status-duplicate-text)' }}>Duplicate Flag Created</span>}</td><td className="px-3 py-2">{row.errorType ?? '—'}</td><td className="max-w-sm px-3 py-2"><p className="truncate" title={row.message}>{row.message}</p></td><td className="px-3 py-2"><button onClick={() => setDetail(row)} className="font-semibold hover:underline" style={{ color: 'var(--btn-primary-bg)' }}>View Details</button></td></tr>)}</tbody></table></div>
        {visibleRows.length === 0 && <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{filter === 'Success' ? 'No successful imports.' : filter === 'Failed' ? 'No failed imports.' : filter === 'Skipped' ? 'No skipped imports.' : 'No matching import rows.'}</p>}
        {detail && <div className="mt-4 rounded-lg border p-4 text-sm" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}><div className="flex justify-between"><p className="font-bold">Imported Record · Row {detail.row}</p><button onClick={() => setDetail(null)} aria-label="Close row details"><X size={16}/></button></div><dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">{[
          ['Student ID', detail.importedData['ID Number']], ['Name', `${detail.importedData['First Name'] ?? ''} ${detail.importedData['Last Name'] ?? ''}`.trim()], ['Program', detail.importedData.Degree], ['Academic Year', detail.importedData['Acad Year']], ['Semester', detail.importedData.Semester], ['Scholarship', detail.importedData.Scholarship], ['Category', detail.importedData['Type of Scholarship']],
        ].map(([label, value]) => <div key={label} className="grid grid-cols-[120px_1fr] gap-2"><dt className="font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</dt><dd>{value || '—'}</dd></div>)}</dl><div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--divider-light)' }}><p><strong>Result:</strong> {detail.errorType ? `${detail.errorType}: ` : ''}{detail.message}</p><p className="mt-2"><strong>{detail.errorType === 'Database Error' ? 'Suggested Fix' : 'Suggested Correction'}:</strong> {detail.suggestedCorrection}</p></div></div>}
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t px-5 py-3" style={{ borderColor: 'var(--divider-light)' }}><button onClick={() => downloadFailures(result)} disabled={!failedCount} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: 'var(--btn-primary-bg)', color: 'var(--btn-primary-bg)' }}><Download size={16}/>Download Error Report</button><button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--btn-primary-bg)', color: 'white' }}>Done</button></div>
    </div>
  </div>
}
