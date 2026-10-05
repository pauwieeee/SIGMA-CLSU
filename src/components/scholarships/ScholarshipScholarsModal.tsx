import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Avatar } from '@/components/ui/Avatar'

interface Props {
  scholarshipId: string | null
  scholarshipName: string
  onClose: () => void
}

interface ScholarRow {
  id: string
  student_number: string
  full_name: string
  college: string
  academic_year: string
  semester: string
  status: string
}

// Answers the admin question "where can I see the list of all scholars
// under a specific scholarship?" — opened from the scholarship row itself
// rather than requiring a trip to Student Records and filtering by hand.
export function ScholarshipScholarsModal({ scholarshipId, scholarshipName, onClose }: Props) {
  const [rows, setRows] = useState<ScholarRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!scholarshipId) return
    setLoading(true)
    ;(supabase as any)
      .from('student_scholarships')
      .select('id, academic_year, semester, status, students ( student_number, last_name, first_name, middle_initial, programs ( colleges ( name ) ) )')
      .eq('scholarship_id', scholarshipId)
      .is('archived_at', null)
      .order('academic_year', { ascending: false })
      .then(({ data }: any) => {
        setRows(
          (data ?? []).map((r: any) => ({
            id: r.id,
            student_number: r.students?.student_number ?? '—',
            full_name: r.students
              ? `${r.students.last_name}, ${r.students.first_name}${r.students.middle_initial ? ' ' + r.students.middle_initial + '.' : ''}`
              : '—',
            college: r.students?.programs?.colleges?.name ?? '—',
            academic_year: r.academic_year,
            semester: r.semester,
            status: r.status,
          }))
        )
        setLoading(false)
      })
  }, [scholarshipId])

  useEffect(() => {
    if (!scholarshipId) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [scholarshipId, onClose])

  if (!scholarshipId) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="scholarship-scholars-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl shadow-xl sm:max-h-[85dvh]" style={{ background: 'var(--bg-card)' }}>
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--divider-light)', background: 'var(--bg-card)' }}>
          <div>
            <h2 id="scholarship-scholars-title" className="text-sm font-bold" style={{ color: 'var(--nav-header-dark)' }}>Scholars</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{scholarshipName}</p>
          </div>
          <button onClick={onClose} aria-label="Close" title="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-[var(--menu-hover-bg)]" style={{ color: 'var(--icon-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {loading ? (
            <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No students hold this scholarship yet.</p>
          ) : (
            <>
              <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {rows.length} scholar{rows.length === 1 ? '' : 's'} total
              </p>
              <ul className="divide-y" style={{ borderColor: 'var(--divider-light)' }}>
                {rows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={r.full_name} size={32} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.full_name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {r.student_number} · {r.college} · {r.academic_year} {r.semester}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
