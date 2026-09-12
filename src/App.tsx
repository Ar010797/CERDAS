import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import Login from './screens/Login';
import AdminDashboard from './screens/admin/Dashboard';
import StudentsAdmin from './screens/admin/Students';
import GuruDashboard from './screens/guru/Dashboard';
import GradesGuru from './screens/guru/Grades';
import AttendanceGuru from './screens/guru/Attendance';
import LessonPlansGuru from './screens/guru/LessonPlans';
import SettingsGuru from './screens/guru/Settings';
import WaliMuridDashboard from './screens/walimurid/Dashboard';
import SchedulesScreen from './screens/Schedules';

// Placeholders for other routes
const Placeholder = ({ title }: { title: string }) => (
  <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
    <h2 className="text-2xl font-bold text-slate-800 mb-2">{title}</h2>
    <p className="text-slate-500">Fitur ini sedang dalam pengembangan.</p>
  </div>
);

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const { userData, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!userData) return <Navigate to="/login" replace />;
  if (userData && !allowedRoles.includes(userData.role || '')) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const RootRedirect = () => {
  const { userData, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-50" />;
  if (!userData) return <Navigate to="/login" replace />;
  if (userData.role === 'Admin') return <Navigate to="/admin/dashboard" replace />;
  if (userData.role === 'Guru') return <Navigate to="/guru/dashboard" replace />;
  if (userData.role === 'Wali Murid') return <Navigate to="/walimurid/dashboard" replace />;
  return <Navigate to="/login" replace />;
};

export default function App() {
  return (
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
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<Placeholder title="Kelola Pengguna" />} />
            <Route path="students" element={<StudentsAdmin />} />
            <Route path="schedules" element={<SchedulesScreen />} />
            <Route path="academic-years" element={<Placeholder title="Pengaturan Tahun Ajaran" />} />
            <Route path="announcements" element={<Placeholder title="Pengumuman" />} />
          </Route>

          <Route path="/guru" element={
            <ProtectedRoute allowedRoles={['Guru']}>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<GuruDashboard />} />
            <Route path="students" element={<StudentsAdmin />} />
            <Route path="attendance" element={<AttendanceGuru />} />
            <Route path="grades" element={<GradesGuru />} />
            <Route path="schedules" element={<SchedulesScreen />} />
            <Route path="lesson-plans" element={<LessonPlansGuru />} />
            <Route path="settings" element={<SettingsGuru />} />
          </Route>

          <Route path="/walimurid" element={
            <ProtectedRoute allowedRoles={['Wali Murid']}>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<WaliMuridDashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
