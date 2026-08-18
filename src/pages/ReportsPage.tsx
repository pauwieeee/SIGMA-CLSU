import { useState } from 'react'
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
import { ChevronDown, Download, FileText, RefreshCw } from 'lucide-react'
import { useDashboardStats, useScholarsPerCategory } from '@/hooks/useDashboardData'
import { useScholarsTrend } from '@/hooks/useScholarsTrend'
import { useColleges } from '@/hooks/useColleges'
import { Card } from '@/components/ui/Card'
import { WidgetCard, WidgetTitle } from '@/components/dashboard/WidgetCard'
import { CategoryPieLegend } from '@/components/dashboard/CategoryPieLegend'
import { ToastStack } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToasts } from '@/hooks/useToasts'
import { supabase } from '@/lib/supabase'
import { chartAxisTick, chartGridStroke, chartTooltipStyle, colorForCategory, sortByCategoryOrder } from '@/utils/chartTheme'
import { useDuplicateFlagTrend } from '@/hooks/useTrends'

export default function ReportsPage() {
  const { stats, refetch: refetchStats } = useDashboardStats()
  const { data: duplicateTrend } = useDuplicateFlagTrend()
  const { data: categoryDataRaw, loading } = useScholarsPerCategory()
  const categoryData = sortByCategoryOrder(categoryDataRaw)
  const { data: trendData, loading: trendLoading } = useScholarsTrend()
  const colleges = useColleges()
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts()

  const [academicYear, setAcademicYear] = useState('2025-2026')
  const [semester, setSemester] = useState('')
  const [college, setCollege] = useState('')
  const [category, setCategory] = useState('')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [scanning, setScanning] = useState(false)

  async function rescanDuplicates() {
    setScanning(true)
    try {
      const { data, error } = await supabase.rpc('rescan_all_duplicates')
      if (error) throw error
      const newFlags = (data as number) ?? 0
      pushToast(
        newFlags > 0 ? `Scan complete — ${newFlags} new duplicate flag(s) found.` : 'Scan complete — no new duplicates found.',
        'success'
      )
      refetchStats()
    } catch (err) {
      pushToast(`Scan failed: ${(err as Error).message}`, 'error')
    } finally {
      setScanning(false)
    }
  }

  function exportCsv() {
    const header = 'Category,Scholar Count\n'
    const body = categoryData.map((c) => `${c.category_name},${c.scholar_count}`).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sigma-scholars-per-category.csv'
    a.click()
    URL.revokeObjectURL(url)
    setExportMenuOpen(false)
  }

  async function exportPdf() {
    setExportMenuOpen(false)
    setExportingPdf(true)
    try {
      const { exportReportPdf } = await import('@/utils/exportReportPdf')
      await exportReportPdf({
        filters: { academicYear, semester, college, category },
        categoryData,
        trendData,
        duplicateFlagCount: stats?.duplicate_flags_open ?? 0,
      })
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="rounded-full border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
            >
              <option value="2025-2026">A.Y. 2025-2026</option>
              <option value="2024-2025">A.Y. 2024-2025</option>
            </select>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="rounded-full border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
            >
              <option value="">All Semesters</option>
              <option value="1st Semester">1st Semester</option>
              <option value="2nd Semester">2nd Semester</option>
            </select>
            <select
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="rounded-full border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
            >
              <option value="">All Colleges</option>
              {colleges.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-full border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
            >
              <option value="">All Categories</option>
              <option value="Government">Government</option>
              <option value="Institutional">Institutional</option>
              <option value="Private">Private</option>
            </select>
          </div>

          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={exportingPdf}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[var(--btn-primary-hover)] disabled:opacity-60"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
            >
              <Download size={16} />
              {exportingPdf ? 'Preparing PDF…' : 'Export Report'}
              <ChevronDown size={14} />
            </button>

            {exportMenuOpen && (
              <div
                className="absolute right-0 z-30 mt-1 w-40 overflow-hidden rounded-lg border shadow-lg"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
              >
                <button
                  onClick={exportCsv}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-[var(--menu-hover-bg)]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Download size={14} />
                  Export as CSV
                </button>
                <button
                  onClick={exportPdf}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-[var(--menu-hover-bg)]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <FileText size={14} />
                  Export as PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

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

        <Card>
          <p className="mb-3 text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
            Duplicate-Flag Count
          </p>
          <p className="text-4xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>
            {stats?.duplicate_flags_open ?? '—'}
          </p>
          <p className="mt-1 text-xs" style={{ color: duplicateTrend?.has_previous ? 'var(--status-error-text)' : 'var(--text-muted)' }}>
            {!duplicateTrend
              ? 'Open flags requiring review'
              : !duplicateTrend.has_previous
                ? 'No prior data'
                : `${duplicateTrend.diff >= 0 ? '↑' : '↓'} ${Math.abs(duplicateTrend.diff)} vs last semester`}
          </p>
          <button
            onClick={rescanDuplicates}
            disabled={scanning}
            title="Runs duplicate detection against every student record, not just recently changed ones — catches duplicates that bulk imports or manual edits may have missed."
            className="mt-4 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-[var(--menu-hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            <RefreshCw size={13} className={scanning ? 'animate-spin' : undefined} />
            {scanning ? 'Scanning all records…' : 'Re-scan All Records for Duplicates'}
          </button>
        </Card>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
