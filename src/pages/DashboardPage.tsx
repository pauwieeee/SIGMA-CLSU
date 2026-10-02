import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/authContext'
import { useRecentActivity } from '@/hooks/useDashboardData'
import { useReportAnalytics } from '@/hooks/useReportAnalytics'
import { useAnalyticsAcademicYear } from '@/hooks/useAnalyticsAcademicYear'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card, CardTitle } from '@/components/ui/Card'
import { WidgetCard, WidgetTitle } from '@/components/dashboard/WidgetCard'
import { DuplicateFlagsCard } from '@/components/dashboard/DuplicateFlagsCard'
import { CategoryPieLegend } from '@/components/dashboard/CategoryPieLegend'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { chartAxisTick, chartGridStroke, chartTooltipStyle, colorForCategory, sortByCategoryOrder } from '@/utils/chartTheme'
import { ActivityActor } from '@/components/activity/ActivityActor'

export default function DashboardPage() {
  const { user } = useAuth()
  const [academicYear, setAcademicYear] = useAnalyticsAcademicYear()
  const analytics = useReportAnalytics({ academicYear, semester: '', college: '', program: '', category: '', scholarship: '', status: '', enrollment: '' })
  const stats = analytics.metrics
  const statsLoading = analytics.loading
  const chartLoading = analytics.loading
  const categoryData = sortByCategoryOrder(analytics.categoryData)
  const { data: activity, loading: activityLoading, error: activityError } = useRecentActivity()

  const profileName = user?.user_metadata?.preferred_username
    ?? user?.user_metadata?.full_name
    ?? user?.user_metadata?.display_name
    ?? user?.user_metadata?.name
  const displayName = typeof profileName === 'string' && profileName.trim()
    ? profileName.trim()
    : 'Admin'
  return (
    <div className="space-y-6">
      {analytics.error && (
        <div role="alert" className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--status-warning-text)', background: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' }}>
          Some dashboard data required a live-record fallback. The displayed values were recalculated from the available Supabase records. Details: {analytics.error}
        </div>
      )}
      <section className="sigma-dashboard-hero" aria-labelledby="dashboard-welcome-heading">
        <div className="sigma-dashboard-hero-decoration" aria-hidden="true">
          <span className="sigma-dashboard-hero-circle sigma-dashboard-hero-circle-large" />
          <span className="sigma-dashboard-hero-circle sigma-dashboard-hero-circle-small" />
          <span className="sigma-dashboard-hero-wave" />
        </div>
        <div className="sigma-dashboard-hero-content">
          <div className="sigma-dashboard-hero-copy">
            <div className="sigma-dashboard-hero-identity">
              <p className="sigma-dashboard-hero-office">Office of Admissions</p>
              <p className="sigma-dashboard-hero-label">CLSU Scholarship Management System</p>
            </div>
            <h1 id="dashboard-welcome-heading">Welcome back, {displayName} <span aria-hidden="true">👋</span></h1>
            <p className="sigma-dashboard-hero-subtitle">
              Here's what's happening across scholarship records today.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3" style={{ borderColor: 'var(--border-default)' }} aria-label="Dashboard analytics scope">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--widget-heading-text)' }}>Analytics Scope</p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{academicYear ? `Dashboard and Reports are synchronized to A.Y. ${academicYear}.` : 'Dashboard and Reports are synchronized across all academic years.'}</p>
        </div>
        <select value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--input-border)', background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
          <option value="">All Academic Years</option>
          {analytics.options.academicYears.map((year) => <option key={year} value={year}>A.Y. {year}</option>)}
        </select>
      </section>

      <section data-tour="dashboard-stats" className="space-y-3" aria-labelledby="student-overview-heading">
        <h2 id="student-overview-heading" className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--widget-heading-text)' }}>
          Student Overview
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Students"
            loading={statsLoading}
            value={stats.totalStudents}
            detail={academicYear ? 'Distinct students matching the selected A.Y.' : 'Active, non-archived student profiles'}
          />
          <StatCard
            label="Active Scholarship Records"
            loading={statsLoading}
            value={stats.activeScholarships}
            detail="Assignment records"
          />
          <StatCard
            label="Expiring Soon"
            loading={statsLoading}
            value={stats.expiringSoon}
            detail="Within 30 days"
            detailTone="warn"
          />
          <StatCard
            label="Expired Scholarships"
            loading={statsLoading}
            value={stats.expiredScholarships}
            detail="Past expiration date"
            detailTone="bad"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col space-y-3" aria-labelledby="enrollment-heading">
          <h2 id="enrollment-heading" className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--widget-heading-text)' }}>
            Enrollment
          </h2>
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="Enrolled" loading={statsLoading} value={stats.enrolledStudents} />
            <StatCard label="Not Enrolled" loading={statsLoading} value={stats.notEnrolledStudents} />
          </div>
        </section>

        <section className="flex min-w-0 flex-col space-y-3" aria-labelledby="data-review-heading">
          <h2 id="data-review-heading" className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--widget-heading-text)' }}>
            Data Review
          </h2>
          <DuplicateFlagsCard className="flex-1" loading={statsLoading} metrics={{ open: stats.openDuplicateFlags, resolved: stats.resolvedDuplicateFlags, total: stats.totalDuplicateFlags }} />
        </section>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <WidgetCard className="lg:col-span-2">
            <WidgetTitle>Scholars per Category</WidgetTitle>
            {chartLoading ? (
              <div className="flex h-64 items-end gap-3 px-2 pb-2">
                {[60, 90, 45, 75, 55, 85].map((h, i) => (
                  <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${h}%` }} />
                ))}
              </div>
            ) : categoryData.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryData} style={{ background: 'var(--bar-chart-bg)' }}>
                  <defs>
                    <linearGradient id="scholarBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--bar-gradient-top)" />
                      <stop offset="100%" stopColor="var(--bar-gradient-bottom)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                  <XAxis dataKey="category_name" tick={chartAxisTick} />
                  <YAxis allowDecimals={false} tick={chartAxisTick} />
                  <Tooltip {...chartTooltipStyle} />
                  <Bar dataKey="scholar_count" fill="url(#scholarBarGradient)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </WidgetCard>

          <WidgetCard>
            <WidgetTitle>By Category Type</WidgetTitle>
            {chartLoading ? (
              <div className="flex h-64 flex-col items-center justify-center gap-4">
                <Skeleton className="h-40 w-40 rounded-full" />
                <div className="w-full space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ) : categoryData.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No data yet
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="scholar_count" nameKey="category_name" innerRadius={0} outerRadius={80}>
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
        </div>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Link
              to="/activity"
              className="text-xs font-semibold hover:underline"
              style={{ color: 'var(--btn-primary-bg)' }}
            >
              View All
            </Link>
          </div>
          {activityError ? (
            <p className="text-sm" style={{ color: 'var(--status-error-text)' }}>
              Unable to load the latest activity: {activityError}
            </p>
          ) : activityLoading ? (
            <ul className="space-y-3">
              {[1, 2, 3].map((i) => (
                <li key={i} className="flex items-center justify-between py-1">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-10" />
                </li>
              ))}
            </ul>
          ) : activity.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No recent activity.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--divider-light)' }}>
              {activity.map((a) => (
                <li key={a.id} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,220px)_auto] sm:items-center">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--btn-primary-bg)' }} />
                    <p className="text-sm leading-5" style={{ color: 'var(--text-secondary)' }}>{a.description}</p>
                  </div>
                  <ActivityActor activity={a} />
                  <span className="shrink-0 text-xs sm:text-right" style={{ color: 'var(--text-muted)' }}>{formatRelativeTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
