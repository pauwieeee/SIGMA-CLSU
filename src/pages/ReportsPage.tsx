import { useState } from 'react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, Eye, RefreshCw } from 'lucide-react'
import { useDashboardStats } from '@/hooks/useDashboardData'
import { useReportAnalytics } from '@/hooks/useReportAnalytics'
import { Card } from '@/components/ui/Card'
import { WidgetCard, WidgetTitle } from '@/components/dashboard/WidgetCard'
import { CategoryPieLegend } from '@/components/dashboard/CategoryPieLegend'
import { ToastStack } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToasts } from '@/hooks/useToasts'
import { supabase } from '@/lib/supabase'
import { chartAxisTick, chartGridStroke, chartTooltipStyle, colorForCategory, sortByCategoryOrder } from '@/utils/chartTheme'
import { useDuplicateFlagTrend } from '@/hooks/useTrends'
import { usePrograms } from '@/hooks/usePrograms'
import { DuplicateFlagsModal } from '@/components/reports/DuplicateFlagsModal'
import { logActivity } from '@/utils/logActivity'

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { stats, refetch: refetchStats } = useDashboardStats()
  const { data: duplicateTrend } = useDuplicateFlagTrend()
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts()

  const [academicYear, setAcademicYear] = useState('2025-2026')
  const [semester, setSemester] = useState('')
  const [college, setCollege] = useState('')
  const [program, setProgram] = useState('')
  const [category, setCategory] = useState('')
  const [scholarship, setScholarship] = useState('')
  const [status, setStatus] = useState('')
  const [enrollment, setEnrollment] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false)
  const [notificationFlagId, setNotificationFlagId] = useState<string | null>(null)
  const programs = usePrograms(college || undefined)
  const report = useReportAnalytics({ academicYear, semester, college, program, category, scholarship, status, enrollment })
  const categoryData = sortByCategoryOrder(report.categoryData)
  const trendData = report.trendData
  const loading = report.loading
  const trendLoading = report.loading
  const categoryTotals = Object.fromEntries(
    categoryData.map((item) => [item.category_name, item.scholar_count])
  ) as Record<string, number>

  useEffect(() => {
    const duplicateFlagId = searchParams.get('duplicateFlag')
    if (!duplicateFlagId) return
    setNotificationFlagId(duplicateFlagId)
    setDuplicateModalOpen(true)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  async function rescanDuplicates() {
    setScanning(true)
    try {
      const { data, error } = await supabase.rpc('rescan_all_duplicates')
      if (error) throw error
      const newFlags = (data as number) ?? 0
      const { count: openFlags, error: countError } = await supabase
        .from('duplicate_flags')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Open')
      if (countError) throw countError
      const openCount = openFlags ?? 0
      await logActivity('rescan', 'duplicate_flag', `Re-scanned all student records: ${newFlags} new scholarship conflict case(s) found; ${openCount} open case(s) still require review.`)
      pushToast(`Scan completed — New scholarship conflict cases found: ${newFlags}. Existing open scholarship conflict cases: ${openCount}${openCount > 0 ? ' (still require review).' : '.'}`, 'success')
      await refetchStats()
    } catch (err) {
      pushToast(`Scan failed: ${(err as Error).message}`, 'error')
    } finally {
      setScanning(false)
    }
  }

  async function exportPdf() {
    setExportingPdf(true)
    try {
      const { exportReportPdf } = await import('@/utils/exportReportPdf')
      await exportReportPdf({
        filters: { academicYear, semester, college, program, category, scholarship, status, enrollment },
        categoryData,
        trendData,
        duplicateFlagCount: stats?.duplicate_flags_open ?? 0,
      })
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div data-tour="report-analytics" className="space-y-4">
      <Card className="report-filter-card">
        <div className="report-filter-toolbar">
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="report-filter-control"
              style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
            >
              <option value="">All Academic Years</option>
              {report.options.academicYears.map((year) => <option key={year} value={year}>A.Y. {year}</option>)}
            </select>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="report-filter-control"
              style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
            >
              <option value="">All Semesters</option>
              <option value="1st Semester">1st Semester</option>
              <option value="2nd Semester">2nd Semester</option>
            </select>
            <select
              value={college}
              onChange={(e) => {
                setCollege(e.target.value)
                setProgram('')
              }}
              className="report-filter-control"
              style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
            >
              <option value="">All Colleges</option>
              {report.options.colleges.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              className="report-filter-control"
              style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
            >
              <option value="">All Programs</option>
              {programs.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setScholarship('')
              }}
              className="report-filter-control"
              style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
            >
              <option value="">All Categories</option>
              {report.options.categories.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select value={scholarship} onChange={(e) => setScholarship(e.target.value)} disabled={report.scholarshipOptionsLoading || Boolean(report.scholarshipOptionsError) || report.options.scholarships.length === 0} className="report-filter-control disabled:cursor-not-allowed disabled:opacity-60" style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}>
              <option value="">
                {report.scholarshipOptionsLoading
                  ? 'Loading scholarships...'
                  : report.scholarshipOptionsError
                    ? 'Unable to load scholarships'
                    : report.options.scholarships.length === 0
                      ? 'No scholarships available'
                      : category
                        ? `All ${category} Scholarships`
                        : 'All Scholarships'}
              </option>
              {report.options.scholarships.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="report-filter-control" style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}>
              <option value="">All Scholarship Statuses</option>
              {report.options.statuses.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select value={enrollment} onChange={(e) => setEnrollment(e.target.value)} className="report-filter-control" style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}>
              <option value="">All Enrollment Statuses</option>
              <option value="Enrolled">Enrolled</option>
              <option value="Not Enrolled">Not Enrolled</option>
              <option value="Not Yet Verified">Not Yet Verified</option>
            </select>
            <button
              onClick={exportPdf}
              disabled={exportingPdf}
              className="report-export-button disabled:opacity-60"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
            >
              <Download size={16} />
              {exportingPdf ? 'Preparing…' : 'Export PDF'}
            </button>
        </div>
      </Card>

      {report.error && (
        <Card className="text-sm" style={{ color: 'var(--status-error-text)' }}>
          Historical report data could not be loaded: {report.error}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Scholar totals by scholarship category">
        {(['Government', 'Institutional', 'Private'] as const).map((type) => (
          <Card key={type}>
            <p className="text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
              {type} Scholars
            </p>
            <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>
              {loading ? '—' : categoryTotals[type] ?? 0}
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Matching the selected report filters
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <WidgetCard className="lg:col-span-2">
          <WidgetTitle>Scholars per Category (updates with filters)</WidgetTitle>
          {loading ? (
            <div className="flex h-64 items-end gap-3 px-2 pb-2">
              {[60, 90, 45, 75, 55, 85].map((h, i) => (
                <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${h}%` }} />
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoryData} style={{ background: 'var(--bar-chart-bg)' }}>
                <defs>
                  <linearGradient id="reportsBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--bar-gradient-top)" />
                    <stop offset="100%" stopColor="var(--bar-gradient-bottom)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                <XAxis dataKey="category_name" tick={chartAxisTick} />
                <YAxis allowDecimals={false} tick={chartAxisTick} />
                <Tooltip {...chartTooltipStyle} />
                <Bar dataKey="scholar_count" fill="url(#reportsBarGradient)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </WidgetCard>

        <WidgetCard>
          <WidgetTitle>Institutional vs Gov't vs Private</WidgetTitle>
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4">
              <Skeleton className="h-40 w-40 rounded-full" />
              <div className="w-full space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categoryData} dataKey="scholar_count" nameKey="category_name" outerRadius={80}>
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={colorForCategory(entry.category_name, i)} />
                    ))}
                  </Pie>
                  <Tooltip {...chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <CategoryPieLegend data={categoryData} />
            </>
          )}
        </WidgetCard>

        <WidgetCard className="lg:col-span-2">
          <WidgetTitle>Scholars Trend by Semester / A.Y.</WidgetTitle>
          {trendLoading ? (
            <div className="flex h-56 items-end gap-2 px-2 pb-2">
              {[40, 55, 45, 65, 60, 80, 70].map((h, i) => (
                <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${h}%` }} />
              ))}
            </div>
          ) : trendData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No trend data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-primary)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                <XAxis dataKey="term" tick={{ ...chartAxisTick, fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={chartAxisTick} />
                <Tooltip {...chartTooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="scholar_count"
                  stroke="var(--chart-secondary-line)"
                  strokeWidth={2}
                  fill="url(#trendFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </WidgetCard>

        <Card data-tour="scholarship-conflicts">
          <p className="mb-3 text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
            Open Scholarship Conflict Cases
          </p>
          <p className="text-4xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>
            {stats?.duplicate_flags_open ?? '—'}
          </p>
          <p className="mt-1 text-xs" style={{ color: duplicateTrend?.has_previous ? 'var(--status-error-text)' : 'var(--text-muted)' }}>
            {!duplicateTrend
              ? 'Open scholarship conflicts requiring review'
              : !duplicateTrend.has_previous
                ? 'No prior data'
                : `${duplicateTrend.diff >= 0 ? '↑' : '↓'} ${Math.abs(duplicateTrend.diff)} vs last semester`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setNotificationFlagId(null)
                setDuplicateModalOpen(true)
              }}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-[var(--btn-primary-hover)]"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
            >
              <Eye size={13} />
              View Conflict Cases
            </button>
            <button
              onClick={rescanDuplicates}
              disabled={scanning}
              title="Rechecks all scholarship records for newly detected conflicts. Existing open cases are not removed automatically."
              className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-[var(--menu-hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              <RefreshCw size={13} className={scanning ? 'animate-spin' : undefined} />
              {scanning ? 'Scanning…' : 'Re-scan Records'}
            </button>
          </div>
        </Card>
      </div>

      {duplicateModalOpen && (
        <DuplicateFlagsModal
          focusFlagId={notificationFlagId}
          onClose={() => {
            setDuplicateModalOpen(false)
            setNotificationFlagId(null)
          }}
          onChanged={refetchStats}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
