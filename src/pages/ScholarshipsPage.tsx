import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useScholarships, type ScholarshipRow } from '@/hooks/useScholarships'
import { ScholarshipFormModal } from '@/components/scholarships/ScholarshipFormModal'
import { ScholarshipScholarsModal } from '@/components/scholarships/ScholarshipScholarsModal'
import { supabase } from '@/lib/supabase'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Skeleton } from '@/components/ui/Skeleton'
import type { ScholarshipCategoryName } from '@/types/database'
import { logActivity } from '@/utils/logActivity'

const tabs: ScholarshipCategoryName[] = ['Institutional', 'Government', 'Private']

export default function ScholarshipsPage() {
  const [activeTab, setActiveTab] = useState<ScholarshipCategoryName>('Government')
  const [showArchived, setShowArchived] = useState(false)
  const { rows, loading, error, refetch } = useScholarships(activeTab, showArchived)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ScholarshipRow | null>(null)
  const [viewingScholars, setViewingScholars] = useState<ScholarshipRow | null>(null)

  const headerRef = useRef<HTMLDivElement>(null)
  const [headerHeight, setHeaderHeight] = useState(0)

  useLayoutEffect(() => {
    if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight)
  }, [activeTab, showArchived])

  const grouped = useMemo(() => {
    const withAgency = rows.filter((r) => r.agency_name)
    const standalone = rows.filter((r) => !r.agency_name)
    const byAgency = new Map<string, typeof rows>()
    for (const r of withAgency) {
      const list = byAgency.get(r.agency_name!) ?? []
      list.push(r)
      byAgency.set(r.agency_name!, list)
    }
    return { standalone, byAgency }
  }, [rows])

  function openAdd() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(row: ScholarshipRow) {
    setEditing(row)
    setModalOpen(true)
  }

  async function handleArchive(row: ScholarshipRow) {
    if (!confirm(`Archive "${row.name}"? It will be hidden from active lists but not deleted — find it again under "Show Archived".`))
      return
    await (supabase as any)
      .from('scholarships')
      .update({ archived_at: new Date().toISOString(), status: 'Archived' })
      .eq('id', row.id)
    await logActivity('archive', 'scholarship', `Archived scholarship "${row.name}".`, row.id)
    refetch()
  }

  async function handleRestore(row: ScholarshipRow) {
    await (supabase as any)
      .from('scholarships')
      .update({ archived_at: null, status: 'Active' })
      .eq('id', row.id)
    await logActivity('restore', 'scholarship', `Restored scholarship "${row.name}".`, row.id)
    refetch()
  }

  return (
    <div className="space-y-4">
      {/* Single scroll container — the ONLY scrolling ancestor between the
          sticky header/tabs bar, the sticky agency labels, and the rows. */}
      <div
        className="overflow-auto rounded-lg border"
        style={{ height: 640, borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
      >
        <div ref={headerRef} className="sticky top-0 z-30" style={{ background: 'var(--bg-card)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 pt-5 pb-3" style={{ borderColor: 'var(--border-default)' }}>
            <h1 className="text-xl font-bold tracking-wide" style={{ color: 'var(--nav-header-dark)' }}>
              SCHOLARSHIP CATEGORIES
            </h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="rounded-lg border px-4 py-2 text-sm font-medium"
                style={
                  showArchived
                    ? { background: 'var(--menu-active-bg)', borderColor: 'var(--btn-primary-bg)', color: 'var(--nav-header-dark)' }
                    : { background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }
                }
              >
                {showArchived ? 'Showing Archived' : 'Show Archived'}
              </button>
              <button
                onClick={openAdd}
                className="rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[var(--btn-primary-hover)]"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
              >
                + Add Scholarship
              </button>
            </div>
          </div>

          <div className="flex gap-6 border-b px-5" style={{ borderColor: 'var(--border-default)' }}>
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="-mb-px border-b-2 px-1 py-2.5 text-sm font-medium"
                style={
                  activeTab === tab
                    ? { borderColor: 'var(--btn-primary-bg)', color: 'var(--nav-header-dark)' }
                    : { borderColor: 'transparent', color: 'var(--text-muted)' }
                }
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="divide-y" style={{ borderColor: 'var(--divider-light)' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-1/5" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--status-error-text)' }}>
            <p className="font-medium">Couldn't load scholarships.</p>
            <p className="mt-1" style={{ color: 'var(--text-muted)' }}>{error}</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            {showArchived ? 'No archived scholarships in this category.' : 'No scholarships in this category yet.'}
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--divider-light)' }}>
            {grouped.standalone.map((s) => (
              <ScholarshipRowView
                key={s.id}
                row={s}
                sub={s.category_name}
                archivedView={showArchived}
                onEdit={openEdit}
                onArchive={handleArchive}
                onRestore={handleRestore}
                onViewScholars={setViewingScholars}
              />
            ))}

            {[...grouped.byAgency.entries()].map(([agency, items]) => (
              <div key={agency}>
                <p
                  className="sticky z-20 px-4 py-2.5 text-xs font-semibold"
                  style={{ top: headerHeight, background: '#F1F5EF', color: 'var(--text-muted)' }}
                >
                  {agency} — agency group
                </p>
                {items.map((s) => (
                  <ScholarshipRowView
                    key={s.id}
                    row={s}
                    sub={`Government · ${agency.split(' ')[0]}`}
                    archivedView={showArchived}
                    onEdit={openEdit}
                    onArchive={handleArchive}
                    onRestore={handleRestore}
                    onViewScholars={setViewingScholars}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <ScholarshipFormModal
        open={modalOpen}
        category={activeTab}
        initial={
          editing
            ? {
                id: editing.id,
                name: editing.name,
                code: editing.code ?? '',
                description: editing.description ?? '',
                agency_name: editing.agency_name ?? '',
                status: editing.status as any,
                start_date: editing.start_date ?? '',
                end_date: editing.end_date ?? '',
                notes: editing.notes ?? '',
                level: editing.level ?? 'Undergraduate',
                qualifications: editing.qualifications ?? '',
                application_requirements: editing.application_requirements ?? '',
                benefits_amount: editing.benefits_amount ?? '',
                coverage_deadline: editing.coverage_deadline ?? '',
                contact_person: editing.contact_person ?? '',
                contact_email: editing.contact_email ?? '',
                min_gwa: editing.min_gwa != null ? String(editing.min_gwa) : '',
                min_units: editing.min_units != null ? String(editing.min_units) : '',
              }
            : undefined
        }
        onClose={() => setModalOpen(false)}
        onSaved={refetch}
      />

      <ScholarshipScholarsModal
        scholarshipId={viewingScholars?.id ?? null}
        scholarshipName={viewingScholars?.name ?? ''}
        onClose={() => setViewingScholars(null)}
      />
    </div>
  )
}

function ScholarshipRowView({
  row,
  sub,
  archivedView,
  onEdit,
  onArchive,
  onRestore,
  onViewScholars,
}: {
  row: ScholarshipRow
  sub: string
  archivedView: boolean
  onEdit: (row: ScholarshipRow) => void
  onArchive: (row: ScholarshipRow) => void
  onRestore: (row: ScholarshipRow) => void
  onViewScholars: (row: ScholarshipRow) => void
}) {
  const initials = row.name
    .split(' ')
    .filter((w) => w[0] === w[0]?.toUpperCase())
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--divider-light)', background: 'var(--bg-card)' }}>
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold"
          style={{ background: 'var(--menu-active-bg)', color: 'var(--nav-header-dark)' }}
        >
          {initials || row.name[0]}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }} title={row.name}>{row.name}</p>
          <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge status={row.is_expiring_soon && row.status === 'Active' ? 'Expiring Soon' : row.status} />
        {archivedView ? (
          <button
            onClick={() => onRestore(row)}
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-[var(--menu-hover-bg)]"
            style={{ borderColor: 'var(--border-default)', color: 'var(--status-success-text)' }}
          >
            Restore
          </button>
        ) : (
          <>
            <button
              onClick={() => onViewScholars(row)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-[var(--menu-hover-bg)]"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              View Scholars
            </button>
            <button
              onClick={() => onEdit(row)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-[var(--menu-hover-bg)]"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              Edit
            </button>
            <button
              onClick={() => onArchive(row)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--border-default)', color: 'var(--status-error-text)' }}
            >
              Archive
            </button>
          </>
        )}
      </div>
    </div>
  )
}
