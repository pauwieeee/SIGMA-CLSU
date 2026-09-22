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
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="import-preview-title">
    <div className="w-full max-w-2xl rounded-2xl shadow-2xl" style={{background:'var(--bg-card)'}}>
      <div className="flex items-center justify-between border-b px-5 py-4" style={{borderColor:'var(--divider-light)'}}><div><h2 id="import-preview-title" className="text-lg font-bold" style={{color:'var(--nav-header-dark)'}}>Import Preview</h2><p className="text-xs" style={{color:'var(--text-muted)'}}>{preview.filename}</p></div><button onClick={onCancel} disabled={processing} aria-label="Close"><X size={19}/></button></div>
      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[['Total rows',preview.totalRows],['New records',preview.newRecords.length],['Already existing',preview.existingRecords.length],['Possible conflicts',preview.conflicts.length],['Invalid',preview.invalidRecords.length]].map(([label,count])=><div key={String(label)} className="rounded-lg p-3" style={{background:'var(--bg-secondary)'}}><p className="text-xs" style={{color:'var(--text-muted)'}}>{label}</p><p className="text-xl font-bold" style={{color:'var(--nav-header-dark)'}}>{count}</p></div>)}</div>
        <p className="text-sm" style={{color:'var(--text-secondary)'}}>Existing records will remain unchanged. Conflicts will be added and passed through SIGMA’s duplicate-review rules.</p>
        <div className="space-y-2"><Group title="New Records" items={preview.newRecords} color="var(--status-success-text)"/><Group title="Already Existing" items={preview.existingRecords} color="var(--text-muted)"/><Group title="Possible Duplicates" items={preview.conflicts} color="var(--status-warning-text)"/><Group title="Invalid" items={preview.invalidRecords} color="var(--status-error-text)"/></div>
      </div>
      <div className="flex justify-end gap-2 border-t px-5 py-4" style={{borderColor:'var(--divider-light)'}}><button onClick={onCancel} disabled={processing} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{borderColor:'var(--border-default)'}}>Cancel</button><button onClick={onConfirm} disabled={processing||importable===0} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{background:'var(--btn-primary-bg)',color:'white'}}>{processing?'Importing…':`Import ${importable} New Record${importable===1?'':'s'}`}</button></div>
    </div>
  </div>
}
