import { useRef, useState } from 'react'
import { Plus, Search, Upload } from 'lucide-react'
import { useStudentRecords } from '@/hooks/useStudentRecords'
import { useColleges } from '@/hooks/useColleges'
import { usePrograms } from '@/hooks/usePrograms'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import type { ImportPreview, ImportResult } from '@/utils/importStudents'
import { ImportPreviewModal } from '@/components/students/ImportPreviewModal'
import { StudentDetailModal } from '@/components/students/StudentDetailModal'
import { BatchUpdateModal } from '@/components/students/BatchUpdateModal'
import { EnrollmentVerificationModal } from '@/components/students/EnrollmentVerificationModal'
import { AddStudentModal } from '@/components/students/AddStudentModal'
import { ToastStack } from '@/components/ui/Toast'
import { useToasts } from '@/hooks/useToasts'

const statusOptions = ['Active', 'Expiring Soon', 'Expired', 'For Renewal', 'Documents Incomplete', 'Pending Verification', 'Inactive', 'Needs Review']

// Grid column template shared by the header row and every data row so they
// always align — this is what makes the CSS Grid approach reliable for a
// sticky header (native <table> sticky-thead has cross-browser quirks).
const GRID_COLS = '40px minmax(220px,1fr) 220px minmax(200px,1fr) 160px 340px 100px'
const GRID_MIN_WIDTH = 'min-w-[1280px]'

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: string[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-36 shrink-0 truncate rounded-full border px-3 py-1.5 text-sm sm:w-40"
      style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

export default function StudentRecordsPage() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [collegeId, setCollegeId] = useState('')
  const [programId, setProgramId] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [semester, setSemester] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false)
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false)
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts()

  const colleges = useColleges()
  const programs = usePrograms(collegeId || undefined)
  const { rows, loading, error, refetch } = useStudentRecords({
    search,
    collegeId,
    programId,
    categoryId,
    academicYear,
    semester,
    status,
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const { previewStudentsFile } = await import('@/utils/importStudents')
      setImportPreview(await previewStudentsFile(file))
    } catch (error) {
      pushToast((error as Error).message, 'error')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function confirmImport() {
    if (!importPreview || importing) return
    setImporting(true)
    try {
      const { commitStudentsImport } = await import('@/utils/importStudents')
      const result = await commitStudentsImport(importPreview)
      setImportResult(result); setImportPreview(null); await refetch()
      pushToast(`Import completed — ${result.addedCount} new record(s) added.`)
    } catch (error) { pushToast(`Import failed: ${(error as Error).message}`, 'error') }
    finally { setImporting(false) }
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const selectedCount = rows.reduce((count, row) => count + (selected.has(row.id) ? 1 : 0), 0)

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function exportSelectedPdf() {
    const selectedRows = rows.filter((r) => selected.has(r.id))
    if (selectedRows.length === 0) return
    setExportingPdf(true)
    try {
      const { exportStudentRecordsPdf } = await import('@/utils/exportStudentRecordsPdf')
      await exportStudentRecordsPdf(selectedRows)
    } catch (error) {
      pushToast(`Could not export PDF: ${(error as Error).message}`, 'error')
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileSelected}
        />
        <button
          onClick={() => setEnrollmentModalOpen(true)}
          className="self-start rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-[var(--menu-hover-bg)]"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          Verify Enrollment
        </button>
        <button
          onClick={() => setAddStudentModalOpen(true)}
          className="flex items-center gap-2 self-start rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-[var(--menu-hover-bg)]"
          style={{ borderColor: 'var(--btn-primary-bg)', color: 'var(--btn-primary-bg)' }}
        >
          <Plus size={16} />
          Add Student
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 self-start rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[var(--btn-primary-hover)] disabled:opacity-60"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
        >
          <Upload size={16} />
          {importing ? 'Importing…' : 'Import Students'}
        </button>
      </div>

      {importResult && (
        <Card
          style={{
            borderColor: importResult.invalidCount > 0 ? 'var(--status-warning-text)' : 'var(--btn-primary-bg)',
            background: importResult.invalidCount > 0 ? 'var(--status-warning-bg)' : 'var(--status-success-bg)',
          }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Import completed: {importResult.addedCount} added, {importResult.existingCount} existing skipped, {importResult.conflictCount} conflict(s) reviewed, and {importResult.invalidCount} invalid.
            {' '}Student Records: {importResult.beforeStudentCount} → {importResult.afterStudentCount}.
          </p>
          {importResult.errors.length > 0 && (
            <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs" style={{ color: 'var(--text-secondary)' }}>
              {importResult.errors.slice(0, 10).map((e, i) => (
                <li key={i}>Row {e.row}: {e.message}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--widget-heading-text)' }}>
          Search Students
        </h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2" style={{ color: 'var(--icon-muted)' }} />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
              placeholder="Search by name, student ID, or program…"
              className="w-full rounded-lg border py-2.5 pr-3 pl-9 text-sm focus:outline-none"
              style={{ borderColor: 'var(--input-border)' }}
            />
          </div>
          <button
            onClick={() => setSearch(searchInput)}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-[var(--btn-primary-hover)]"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
          >
            Search
          </button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <FilterSelect value={categoryId} onChange={setCategoryId} placeholder="Scholarship Category" options={['Government', 'Institutional', 'Private']} />
          <FilterSelect value={collegeId} onChange={(v) => (setCollegeId(v), setProgramId(''))} placeholder="College" options={colleges} />
          <FilterSelect value={programId} onChange={setProgramId} placeholder="Program" options={programs} />
          <FilterSelect value={academicYear} onChange={setAcademicYear} placeholder="A.Y." options={['2025-2026']} />
          <FilterSelect value={semester} onChange={setSemester} placeholder="Semester" options={['1st Semester', '2nd Semester']} />
          <FilterSelect value={status} onChange={setStatus} placeholder="Status" options={statusOptions} />
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
          <p className="text-sm font-bold tracking-wide" style={{ color: 'var(--widget-heading-text)' }}>
            {rows.length.toLocaleString()} STUDENTS
          </p>
          <div className="flex gap-2">
            <span className="self-center text-xs font-semibold" style={{ color: selected.size > 0 ? 'var(--btn-primary-bg)' : 'var(--text-muted)' }}>
              {selectedCount.toLocaleString()} selected
            </span>
            <button
              onClick={() => setBatchModalOpen(true)}
              disabled={selectedCount === 0}
              title={selectedCount === 0 ? 'Select students to enable' : undefined}
              className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
            >
              Batch Update
            </button>
            <button
              onClick={exportSelectedPdf}
              disabled={selectedCount === 0 || exportingPdf}
              title={selectedCount === 0 ? 'Select students to enable' : undefined}
              className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
            >
              {exportingPdf ? 'Preparing PDF…' : 'Export as PDF'}
            </button>
          </div>
        </div>

        {/* .table-wrapper equivalent: the ONLY scrolling ancestor between the
            sticky header and the rows. Fixed height + overflow-y:auto is what
            creates the contained scroll box; sticky works because this div is
            the nearest scrolling ancestor of the header row below. */}
        <div
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
          className="mx-5 mb-5 overflow-auto rounded-lg border"
          style={{ height: 640, borderColor: 'var(--border-default)' }}
        >
          {/* Sticky header row — CSS Grid, not a <table>, so position:sticky
              is applied directly to this single element with no <thead>/<tr>
              ambiguity. */}
          <div
            className={`sticky top-0 z-20 grid items-center border-b text-left text-xs font-semibold tracking-wide uppercase transition-shadow ${GRID_MIN_WIDTH}`}
            style={{
              gridTemplateColumns: GRID_COLS,
              borderColor: 'var(--border-default)',
              color: 'var(--text-muted)',
              background: '#FFFFFF',
              boxShadow: scrolled ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <div className="flex h-11 items-center justify-center">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all students" />
            </div>
            <div className="py-3 pr-2">Student</div>
            <div className="px-4 py-3">College</div>
            <div className="px-4 py-3">Scholarship</div>
            <div className="px-4 py-3">A.Y. / Sem</div>
            <div className="px-4 py-3">Status</div>
            <div className="px-4 py-3 text-center">Actions</div>
          </div>

          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`grid items-center border-b ${GRID_MIN_WIDTH}`} style={{ gridTemplateColumns: GRID_COLS, borderColor: 'var(--divider-light)' }}>
                <div className="px-4 py-3">
                  <Skeleton className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2.5 py-3 pr-2">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
                <div className="px-4 py-3">
                  <Skeleton className="h-3.5 w-4/5" />
                </div>
                <div className="px-4 py-3">
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
                <div className="px-4 py-3">
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
                <div className="px-4 py-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="px-4 py-3">
                  <Skeleton className="h-7 w-12" />
                </div>
              </div>
            ))}
          {!loading && error && (
            <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--status-error-text)' }}>
              {error}
            </p>
          )}
          {!loading && !error && rows.length === 0 && (
            <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No student records found.
            </p>
          )}

          {rows.map((r) => {
            const displayStatus = r.status ?? 'Closed'
            return (
              <div
                key={r.id}
                className={`grid items-center border-b text-sm hover:bg-[var(--menu-hover-bg)] ${GRID_MIN_WIDTH}`}
                style={{ gridTemplateColumns: GRID_COLS, borderColor: 'var(--divider-light)' }}
              >
                <div className="flex h-full min-h-11 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleOne(r.id)}
                    aria-label={`Select ${r.full_name}`}
                  />
                </div>
                <div className="py-3 pr-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.full_name} />
                    <div className="min-w-0">
                      <p className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>{r.full_name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.student_number}</p>
                    </div>
                  </div>
                </div>
                <div className="truncate px-4 py-3" style={{ color: 'var(--text-secondary)' }} title={r.college}>
                  {r.college}
                </div>
                <div className="truncate px-4 py-3" style={{ color: 'var(--text-secondary)' }} title={r.scholarship ?? undefined}>
                  {r.scholarship ?? '—'}
                </div>
                <div className="truncate px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                  {r.academic_year ? `${r.academic_year} · ${r.semester}` : '—'}
                </div>
                <div className="grid min-w-0 grid-cols-[92px_100px_116px] items-center gap-x-2 px-4 py-3">
                  <div className="flex items-center">
                    <StatusBadge status={displayStatus} />
                  </div>
                  {r.isEnrolled === false && (
                    <span
                      className="status-badge"
                      style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}
                      title="Not found on the last verified enrollment list"
                    >
                      Not Enrolled
                    </span>
                  )}
                  {r.hasDuplicate && (
                    <span
                      className="status-badge"
                      style={{ background: 'var(--status-duplicate-bg)', color: 'var(--status-duplicate-text)' }}
                      title="A possible duplicate record needs administrator review"
                    >
                      Needs Review
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-center px-4 py-3">
                  <button
                    onClick={() => setViewingId(r.id)}
                    className="min-w-16 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-[var(--menu-hover-bg)]"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                  >
                    View
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <StudentDetailModal studentId={viewingId} onClose={() => setViewingId(null)} onChanged={refetch} />

      {importPreview && <ImportPreviewModal preview={importPreview} processing={importing} onCancel={() => setImportPreview(null)} onConfirm={confirmImport} />}

      <AddStudentModal
        open={addStudentModalOpen}
        onClose={() => setAddStudentModalOpen(false)}
        onAdded={async (studentName) => {
          setAddStudentModalOpen(false)
          await refetch()
          pushToast(`Student Added Successfully\n${studentName} has been added to Student Records.`)
        }}
      />

      <BatchUpdateModal
        open={batchModalOpen}
        students={rows
          .filter((r) => selected.has(r.id))
          .map((r) => ({ studentId: r.id, studentScholarshipId: r.studentScholarshipId }))}
        onClose={() => setBatchModalOpen(false)}
        onDone={({ updated, failed }) => {
          setBatchModalOpen(false)
          setSelected(new Set())
          refetch()
          pushToast(
            failed > 0 ? `Updated ${updated} record(s); ${failed} could not be updated.` : `Updated ${updated} record(s).`,
            failed > 0 ? 'error' : 'success'
          )
        }}
      />

      <EnrollmentVerificationModal
        open={enrollmentModalOpen}
        onClose={() => setEnrollmentModalOpen(false)}
        onDone={refetch}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
