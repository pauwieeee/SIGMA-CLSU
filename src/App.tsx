import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthProvider'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { ConfigGate } from '@/components/layout/ConfigGate'
import LoginPage from '@/pages/LoginPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import DashboardPage from '@/pages/DashboardPage'
import StudentRecordsPage from '@/pages/StudentRecordsPage'
import ScholarshipsPage from '@/pages/ScholarshipsPage'
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))
const AccountSettingsPage = lazy(() => import('@/pages/AccountSettingsPage'))
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'))
const ActivityLogPage = lazy(() => import('@/pages/ActivityLogPage'))
import { AuthenticatedHistoryBoundary } from '@/components/layout/AuthenticatedHistoryBoundary'

function App() {
  return (
    <ConfigGate>
    <BrowserRouter>
      <AuthProvider>
        <AuthenticatedHistoryBoundary />
        <Suspense fallback={<div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading module…</div>}><Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DashboardPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/students"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <StudentRecordsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/scholarships"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ScholarshipsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ReportsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <NotificationsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/activity"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ActivityLogPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <AccountSettingsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes></Suspense>
      </AuthProvider>
    </BrowserRouter>
    </ConfigGate>
  )
}

export default App
