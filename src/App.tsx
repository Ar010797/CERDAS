import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import Login from './screens/Login';
import AdminDashboard from './screens/admin/Dashboard';
import StudentsAdmin from './screens/admin/Students';
import UsersAdmin from './screens/admin/Users';
import AcademicYearsAdmin from './screens/admin/AcademicYears';
import AnnouncementsAdmin from './screens/admin/Announcements';
import GuruDashboard from './screens/guru/Dashboard';
import GradesGuru from './screens/guru/Grades';
import AttendanceGuru from './screens/guru/Attendance';
import LessonPlansGuru from './screens/guru/LessonPlans';
import SettingsGuru from './screens/guru/Settings';
import QuestionBankGuru from './screens/guru/QuestionBank';
import FinanceGuru from './screens/guru/Finance';
import WaliMuridDashboard from './screens/walimurid/Dashboard';
import SchedulesScreen from './screens/Schedules';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const { userData, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors">
        <div className="w-8 h-8 border-3 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mb-3" />
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Memverifikasi akses...</span>
      </div>
    );
  }
  if (!userData) return <Navigate to="/login" replace />;
  if (userData && !allowedRoles.includes(userData.role || '')) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const RootRedirect = () => {
  const { userData, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors">
        <div className="w-8 h-8 border-3 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mb-3" />
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Menghubungkan ke sistem...</span>
      </div>
    );
  }
  if (!userData) return <Navigate to="/login" replace />;
  if (userData.role === 'Admin') return <Navigate to="/admin/dashboard" replace />;
  if (userData.role === 'Guru') return <Navigate to="/guru/dashboard" replace />;
  if (userData.role === 'Wali Murid') return <Navigate to="/walimurid/dashboard" replace />;
  return <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<Login />} />
              
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<UsersAdmin />} />
                <Route path="students" element={<StudentsAdmin />} />
                <Route path="attendance" element={<AttendanceGuru />} />
                <Route path="grades" element={<GradesGuru />} />
                <Route path="schedules" element={<SchedulesScreen />} />
                <Route path="lesson-plans" element={<LessonPlansGuru />} />
                <Route path="question-bank" element={<QuestionBankGuru />} />
                <Route path="finance" element={<FinanceGuru />} />
                <Route path="academic-years" element={<AcademicYearsAdmin />} />
                <Route path="announcements" element={<AnnouncementsAdmin />} />
              </Route>

              <Route path="/guru" element={
                <ProtectedRoute allowedRoles={['Guru']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<GuruDashboard />} />
                <Route path="students" element={<StudentsAdmin />} />
                <Route path="attendance" element={<AttendanceGuru />} />
                <Route path="grades" element={<GradesGuru />} />
                <Route path="schedules" element={<SchedulesScreen />} />
                <Route path="lesson-plans" element={<LessonPlansGuru />} />
                <Route path="question-bank" element={<QuestionBankGuru />} />
                <Route path="finance" element={<FinanceGuru />} />
                <Route path="settings" element={<SettingsGuru />} />
              </Route>

              <Route path="/walimurid" element={
                <ProtectedRoute allowedRoles={['Wali Murid']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<WaliMuridDashboard />} />
              </Route>

              {/* Catch-all route to prevent blank page on any unknown path or 404 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
