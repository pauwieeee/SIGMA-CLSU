import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '@/lib/AuthProvider'
import { useDashboardStats, useRecentActivity, useScholarsPerCategory } from '@/hooks/useDashboardData'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card, CardTitle } from '@/components/ui/Card'
import { WidgetCard, WidgetTitle } from '@/components/dashboard/WidgetCard'
import { DuplicateFlagsCard } from '@/components/dashboard/DuplicateFlagsCard'
import { CategoryPieLegend } from '@/components/dashboard/CategoryPieLegend'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { chartAxisTick, chartGridStroke, chartTooltipStyle, colorForCategory, sortByCategoryOrder } from '@/utils/chartTheme'
import { useDuplicateFlagTrend, useScholarshipsAddedThisMonth, useScholarTrend } from '@/hooks/useTrends'

export default function DashboardPage() {
  const { user } = useAuth()
  const { stats, loading: statsLoading } = useDashboardStats()
  const { data: categoryDataRaw, loading: chartLoading } = useScholarsPerCategory()
  const categoryData = sortByCategoryOrder(categoryDataRaw)
  const { data: activity, loading: activityLoading } = useRecentActivity()
  const { data: scholarTrend } = useScholarTrend()
  const { count: addedThisMonth } = useScholarshipsAddedThisMonth()
  const { data: duplicateTrend } = useDuplicateFlagTrend()

  const displayName = user?.email?.split('@')[0] ?? 'Admin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--nav-header-dark)' }}>
          Welcome back, {displayName}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Here's what's happening across scholarship records today.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Scholars"
          loading={statsLoading}
          value={stats?.total_scholars ?? 0}
          detail={
            !scholarTrend
              ? undefined
              : !scholarTrend.has_previous || scholarTrend.pct_change === null
                ? 'No prior data'
                : `${scholarTrend.pct_change >= 0 ? '↑' : '↓'} ${Math.abs(scholarTrend.pct_change)}% this A.Y.`
          }
          detailTone={scholarTrend?.pct_change != null && scholarTrend.pct_change < 0 ? 'bad' : 'good'}
        />
        <StatCard
          label="Active Scholarships"
          loading={statsLoading}
          value={stats?.active_scholarships ?? 0}
          detail={addedThisMonth == null ? undefined : `${addedThisMonth} added this month`}
          detailTone="good"
        />
        <StatCard
          label="Duplicate Flags"
          loading={statsLoading}
          value={stats?.duplicate_flags_open ?? 0}
          detail={
            !duplicateTrend
              ? stats && stats.duplicate_flags_open > 0
                ? 'Needs review'
                : undefined
              : !duplicateTrend.has_previous
                ? 'No prior data'
                : `${duplicateTrend.diff >= 0 ? '↑' : '↓'} ${Math.abs(duplicateTrend.diff)} vs last semester`
          }
          detailTone="bad"
        />
        <StatCard
          label="Expiring Soon"
          loading={statsLoading}
          value={stats?.expiring_soon ?? 0}
          detail="Within 30 days"
          detailTone="warn"
        />
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

        <DuplicateFlagsCard />

        <Card>
          <CardTitle>Recent Activity</CardTitle>
          {activityLoading ? (
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
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--btn-primary-bg)' }} />
                    <div className="min-w-0">
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{a.description}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {a.actor_email ?? 'Unknown admin'}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>{formatRelativeTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
