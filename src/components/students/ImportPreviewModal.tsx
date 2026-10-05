import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { ImportPreview, ImportPreviewItem } from '@/utils/importStudents'

function Group({ title, items, color }: { title: string; items: ImportPreviewItem[]; color: string }) {
  return <details className="rounded-lg border" style={{borderColor:'var(--border-default)'}} open={items.length>0&&items.length<=5}>
    <summary className="cursor-pointer px-3 py-2 text-sm font-semibold"><span style={{color}}>{title}</span> — {items.length} record(s)</summary>
    {items.length>0&&<div className="max-h-36 overflow-auto border-t px-3 py-2 text-xs" style={{borderColor:'var(--divider-light)'}}>{items.map(item=><p key={`${item.row}-${item.classification}`} className="py-1"><strong>Row {item.row}:</strong> {item.studentNumber} · {item.studentName} · {item.scholarship} — {item.message}</p>)}</div>}
  </details>
}

export function ImportPreviewModal({preview,processing,onCancel,onConfirm}:{preview:ImportPreview;processing:boolean;onCancel:()=>void;onConfirm:()=>void}) {
  const importable=preview.newRecords.length+preview.conflicts.length
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !processing) onCancel() }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel, processing])
  return <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-black/45 p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="import-preview-title">
    <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-2xl sm:max-h-[92vh]" style={{background:'var(--bg-card)'}}>
      <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b px-5 py-4" style={{borderColor:'var(--divider-light)',background:'var(--bg-card)'}}><div className="min-w-0"><h2 id="import-preview-title" className="text-lg font-bold" style={{color:'var(--nav-header-dark)'}}>Import Preview</h2><p className="truncate text-xs" style={{color:'var(--text-muted)'}}>{preview.filename}</p></div><button type="button" onClick={onCancel} disabled={processing} aria-label="Close import preview" title="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors hover:bg-[var(--menu-hover-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" style={{color:'var(--icon-muted)',outlineColor:'var(--btn-primary-bg)'}}><X size={20}/></button></div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[['Total rows',preview.totalRows],['Ready to import/update',preview.newRecords.length],['Duplicate rows skipped',preview.existingRecords.length],['Flags expected',preview.conflicts.length],['Validation errors',preview.invalidRecords.length]].map(([label,count])=><div key={String(label)} className="rounded-lg p-3" style={{background:'var(--bg-secondary)'}}><p className="text-xs" style={{color:'var(--text-muted)'}}>{label}</p><p className="text-xl font-bold" style={{color:'var(--nav-header-dark)'}}>{count}</p></div>)}</div>
        <p className="text-sm" style={{color:'var(--text-secondary)'}}>Repeated rows in this Excel file will be skipped. Valid records are imported or updated; scholarship conflicts are imported and sent to Duplicate Review.</p>
        <div className="space-y-2"><Group title="Ready to Import or Update" items={preview.newRecords} color="var(--status-success-text)"/><Group title="Duplicate Excel Rows — Skipped" items={preview.existingRecords} color="var(--text-muted)"/><Group title="Will Import + Create Duplicate Flag" items={preview.conflicts} color="var(--status-warning-text)"/><Group title="Validation Errors" items={preview.invalidRecords} color="var(--status-error-text)"/></div>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t px-5 py-4" style={{borderColor:'var(--divider-light)',background:'var(--bg-card)'}}><button onClick={onCancel} disabled={processing} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{borderColor:'var(--border-default)'}}>Cancel</button><button onClick={onConfirm} disabled={processing||importable===0} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{background:'var(--btn-primary-bg)',color:'white'}}>{processing?'Importing…':`Process ${importable} Record${importable===1?'':'s'}`}</button></div>
    </div>
  </div>
}
