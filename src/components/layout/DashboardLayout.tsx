import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  GraduationCap,
  ClipboardList,
  Bell,
  UserCircle,
  Image as ImageIcon,
  Wallet
} from 'lucide-react';

export const DashboardLayout = () => {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const adminLinks = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/users', icon: Users, label: 'Kelola Pengguna' },
    { to: '/admin/students', icon: GraduationCap, label: 'Data Siswa' },
    { to: '/admin/attendance', icon: ClipboardList, label: 'Absensi Siswa' },
    { to: '/admin/grades', icon: BookOpen, label: 'Penilaian & Rapor' },
    { to: '/admin/schedules', icon: CalendarDays, label: 'Jadwal Kelas' },
    { to: '/admin/lesson-plans', icon: BookOpen, label: 'E-RPP Guru' },
    { to: '/admin/question-bank', icon: BookOpen, label: 'Bank Soal' },
    { to: '/admin/finance', icon: Wallet, label: 'Keuangan Kelas' },
    { to: '/admin/academic-years', icon: CalendarDays, label: 'Tahun Ajaran & KKM' },
    { to: '/admin/announcements', icon: Bell, label: 'Pengumuman' },
  ];

  const guruLinks = [
    { to: '/guru/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/guru/students', icon: GraduationCap, label: 'Siswa Kelas' },
    { to: '/guru/attendance', icon: ClipboardList, label: 'Absensi' },
    { to: '/guru/grades', icon: BookOpen, label: 'Penilaian & Rapor' },
    { to: '/guru/schedules', icon: CalendarDays, label: 'Jadwal Kelas' },
    { to: '/guru/lesson-plans', icon: BookOpen, label: 'E-RPP' },
    { to: '/guru/question-bank', icon: BookOpen, label: 'Bank Soal' },
    { to: '/guru/finance', icon: Wallet, label: 'Keuangan Kelas' },
    { to: '/guru/settings', icon: Settings, label: 'Pengaturan Kelas' },
  ];

  const waliMuridLinks = [
    { to: '/walimurid/dashboard', icon: UserCircle, label: 'Profil Anak & Rapor' },
  ];

  const links = userData?.role === 'Admin' ? adminLinks : 
                userData?.role === 'Guru' ? guruLinks : 
                waliMuridLinks;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-indigo-900 text-white shadow-xl z-20">
        <div className="p-6 flex items-center space-x-3 border-b border-indigo-800">
          <GraduationCap className="w-8 h-8 text-indigo-300" />
          <span className="text-2xl font-bold tracking-tight">CERDAS</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ease-in-out",
                  isActive
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-indigo-200 hover:bg-indigo-800 hover:text-white"
                )
              }
            >
              <link.icon className="w-5 h-5" />
              <span className="font-medium">{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-indigo-800">
          <div className="mb-4 px-4">
            <p className="text-sm text-indigo-300 font-medium">Masuk sebagai</p>
            <p className="text-white font-semibold truncate">{userData?.name}</p>
            <p className="text-xs text-indigo-400">{userData?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-3 w-full rounded-xl text-indigo-200 hover:bg-indigo-800 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header & Sidebar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-indigo-900 text-white z-50 flex items-center justify-between px-4 shadow-md">
        <div className="flex items-center space-x-3">
          <GraduationCap className="w-6 h-6 text-indigo-300" />
          <span className="text-xl font-bold">CERDAS</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 relative z-50">
          <AnimatePresence mode="wait">
            {isMobileMenuOpen ? (
              <motion.div key="close" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 90 }} transition={{ duration: 0.2 }}>
                <X className="w-6 h-6" />
              </motion.div>
            ) : (
              <motion.div key="menu" initial={{ opacity: 0, rotate: 90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: -90 }} transition={{ duration: 0.2 }}>
                <Menu className="w-6 h-6" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="md:hidden fixed inset-0 z-40 bg-indigo-900 text-white pt-16 flex flex-col"
          >
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors",
                      isActive ? "bg-indigo-600 text-white" : "text-indigo-200 hover:bg-indigo-800 hover:text-white"
                    )
                  }
                >
                  <link.icon className="w-5 h-5" />
                  <span className="font-medium">{link.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="p-6 border-t border-indigo-800">
              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 px-4 py-3 w-full rounded-xl text-indigo-200 hover:bg-indigo-800 hover:text-white transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Keluar</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 md:pt-0 bg-slate-50 relative">
        <AnimatePresence mode="wait">
          <motion.div 
            key={location.pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="p-6 md:p-8 max-w-7xl mx-auto min-h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};
