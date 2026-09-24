import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ScheduleReminderBell from '../ScheduleReminderBell';
import ScheduleReminderBanner from '../ScheduleReminderBanner';
import AnnouncementNotificationBell from '../AnnouncementNotificationBell';
import AssignmentDeadlineBell from '../AssignmentDeadlineBell';
import AssignmentDeadlineBanner from '../AssignmentDeadlineBanner';
import { useScheduleReminder } from '../../hooks/useScheduleReminder';
import { useAssignmentDeadlineReminder } from '../../hooks/useAssignmentDeadlineReminder';
import { OfflineIndicator } from '../OfflineIndicator';
import { PWAInstallButton } from '../PWAInstallButton';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Calendar,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  GraduationCap,
  ClipboardList,
  FileCheck,
  Bell,
  UserCircle,
  Image as ImageIcon,
  Wallet,
  Sun,
  Moon
} from 'lucide-react';

export const DashboardLayout = () => {
  const { userData, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Automatic Schedule Reminder Hook (15 minutes before class)
  const {
    upcomingAlerts,
    dismissAlert,
    soundEnabled,
    toggleSound
  } = useScheduleReminder();

  // Automatic Assignment Deadline Reminder Hook (due within 24 hours, browser notification + sound)
  const {
    activeAlerts: deadlineAlerts,
    dismissAlert: dismissDeadlineAlert,
    soundEnabled: deadlineSoundEnabled,
    toggleSound: toggleDeadlineSound,
    notificationPermission: deadlineNotifPermission,
    requestPermission: requestDeadlineNotifPermission,
    triggerSimulation: triggerDeadlineSimulation
  } = useAssignmentDeadlineReminder();

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
    { to: '/admin/assignments', icon: FileCheck, label: 'Tugas Online' },
    { to: '/admin/schedules', icon: CalendarDays, label: 'Jadwal Kelas' },
    { to: '/admin/calendar', icon: Calendar, label: 'Kalender Pendidikan' },
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
    { to: '/guru/assignments', icon: FileCheck, label: 'Tugas Online' },
    { to: '/guru/schedules', icon: CalendarDays, label: 'Jadwal Kelas' },
    { to: '/guru/calendar', icon: Calendar, label: 'Kalender Pendidikan' },
    { to: '/guru/lesson-plans', icon: BookOpen, label: 'E-RPP' },
    { to: '/guru/question-bank', icon: BookOpen, label: 'Bank Soal' },
    { to: '/guru/finance', icon: Wallet, label: 'Keuangan Kelas' },
    { to: '/guru/announcements', icon: Bell, label: 'Pengumuman' },
    { to: '/guru/settings', icon: Settings, label: 'Pengaturan Kelas' },
  ];

  const waliMuridLinks = [
    { to: '/walimurid/dashboard', icon: UserCircle, label: 'Profil Anak & Rapor' },
    { to: '/walimurid/assignments', icon: FileCheck, label: 'Tugas & PR Online' },
    { to: '/walimurid/calendar', icon: Calendar, label: 'Kalender Pendidikan' },
    { to: '/walimurid/announcements', icon: Bell, label: 'Pengumuman' },
  ];

  const links = userData?.role === 'Admin' ? adminLinks : 
                userData?.role === 'Guru' ? guruLinks : 
                waliMuridLinks;

  const currentActiveLink = links.find(l => location.pathname.startsWith(l.to));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors duration-200">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-indigo-900 dark:bg-slate-950 text-white shadow-xl z-20 border-r border-indigo-800/40 dark:border-slate-800/80 transition-colors duration-200">
        <div className="p-6 flex items-center justify-between border-b border-indigo-800 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <GraduationCap className="w-8 h-8 text-indigo-300 dark:text-indigo-400" />
            <span className="text-2xl font-bold tracking-tight">CERDAS</span>
          </div>
          <button
            onClick={toggleTheme}
            id="sidebar-theme-quick-toggle"
            aria-label={`Ganti ke mode ${theme === 'dark' ? 'terang' : 'gelap'}`}
            title={`Ganti ke mode ${theme === 'dark' ? 'terang' : 'gelap'}`}
            className="p-1.5 rounded-lg bg-indigo-800/80 hover:bg-indigo-700 dark:bg-slate-900 dark:hover:bg-slate-800 text-indigo-200 dark:text-amber-300 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-indigo-200" />}
          </button>
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
                    ? "bg-indigo-600 dark:bg-indigo-600 text-white shadow-md font-semibold"
                    : "text-indigo-200 dark:text-slate-400 hover:bg-indigo-800 dark:hover:bg-slate-900 hover:text-white dark:hover:text-slate-100"
                )
              }
            >
              <link.icon className="w-5 h-5" />
              <span className="font-medium">{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-indigo-800 dark:border-slate-800">
          {/* Theme Switcher Card */}
          <button
            onClick={toggleTheme}
            id="sidebar-theme-toggle"
            className="flex items-center justify-between px-3.5 py-2.5 mb-3.5 w-full rounded-xl bg-indigo-950/60 hover:bg-indigo-950 dark:bg-slate-900/90 dark:hover:bg-slate-850 text-indigo-200 dark:text-slate-300 border border-indigo-800/60 dark:border-slate-800 transition-colors text-xs font-medium"
          >
            <span className="flex items-center gap-2.5">
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-300" />
              )}
              <span>{theme === 'dark' ? 'Mode Gelap' : 'Mode Terang'}</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-800/80 dark:bg-slate-800 text-[10px] text-white">
              {theme === 'dark' ? 'Aktif' : 'Aktif'}
            </span>
          </button>

          <div className="mb-3 px-2">
            <p className="text-xs text-indigo-300 dark:text-slate-400 font-medium">Masuk sebagai</p>
            <p className="text-white font-semibold truncate text-sm">{userData?.name}</p>
            <p className="text-[11px] text-indigo-400 dark:text-indigo-300">{userData?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-2.5 w-full rounded-xl text-indigo-200 hover:bg-indigo-800 dark:hover:bg-slate-900 hover:text-white transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header & Sidebar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-indigo-900 dark:bg-slate-950 text-white z-50 flex items-center justify-between px-4 shadow-md border-b border-indigo-800/40 dark:border-slate-800">
        <div className="flex items-center space-x-2.5">
          <GraduationCap className="w-6 h-6 text-indigo-300" />
          <span className="text-lg font-bold">CERDAS</span>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Assignment Deadline Reminder Bell */}
          <AssignmentDeadlineBell />

          {/* Announcements & Notifications Bell */}
          <AnnouncementNotificationBell />

          {/* Schedule Reminder Bell */}
          <ScheduleReminderBell />

          {/* Mobile Theme Toggle */}
          <button
            onClick={toggleTheme}
            id="mobile-theme-toggle"
            aria-label={`Ganti ke mode ${theme === 'dark' ? 'terang' : 'gelap'}`}
            className="p-2 rounded-xl text-indigo-200 hover:text-white hover:bg-indigo-800 dark:hover:bg-slate-900 transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-300" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-200" />
            )}
          </button>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Buka Menu"
            className="p-2 rounded-xl hover:bg-indigo-800 dark:hover:bg-slate-900 transition-colors"
          >
            <AnimatePresence mode="wait">
              {isMobileMenuOpen ? (
                <motion.div key="close" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 90 }} transition={{ duration: 0.15 }}>
                  <X className="w-6 h-6" />
                </motion.div>
              ) : (
                <motion.div key="menu" initial={{ opacity: 0, rotate: 90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: -90 }} transition={{ duration: 0.15 }}>
                  <Menu className="w-6 h-6" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-40 bg-indigo-950/95 dark:bg-slate-950/95 backdrop-blur-md text-white pt-16 flex flex-col"
          >
            <div className="p-4 border-b border-indigo-800/60 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-300 dark:text-slate-400 font-medium">Masuk sebagai</p>
                <p className="text-white font-semibold text-sm">{userData?.name}</p>
                <p className="text-[11px] text-indigo-300 dark:text-indigo-400">{userData?.role}</p>
              </div>
              <button
                onClick={toggleTheme}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-indigo-900 dark:bg-slate-900 border border-indigo-700/60 dark:border-slate-800 text-xs font-medium"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-300" />
                    <span>Mode Terang</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-200" />
                    <span>Mode Gelap</span>
                  </>
                )}
              </button>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors text-sm",
                      isActive
                        ? "bg-indigo-600 text-white font-semibold shadow-sm"
                        : "text-indigo-200 dark:text-slate-300 hover:bg-indigo-900 dark:hover:bg-slate-900 hover:text-white"
                    )
                  }
                >
                  <link.icon className="w-5 h-5" />
                  <span className="font-medium">{link.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="p-4 border-t border-indigo-800 dark:border-slate-800">
              <button
                onClick={handleLogout}
                className="flex items-center justify-center space-x-2 px-4 py-3 w-full rounded-xl bg-red-600/20 text-red-200 border border-red-500/30 hover:bg-red-600 hover:text-white transition-colors text-sm font-semibold"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Aplikasi</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pt-16 md:pt-0">
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex h-16 items-center justify-between px-8 bg-white/70 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-10 transition-colors duration-200">
          <div className="flex items-center space-x-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {currentActiveLink?.label || 'CERDAS'}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-100 dark:border-indigo-900">
              {userData?.role || 'Pengguna'}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {/* PWA Install Button */}
            <PWAInstallButton />

            {/* Assignment Deadline Reminder Bell */}
            <AssignmentDeadlineBell />

            {/* Announcements & Notifications Bell */}
            <AnnouncementNotificationBell />

            {/* Automatic Schedule Reminder Bell Notification */}
            <ScheduleReminderBell />

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              id="header-theme-toggle"
              title={`Beralih ke mode ${theme === 'dark' ? 'terang' : 'gelap'}`}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/90 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/70 transition-all text-xs font-semibold shadow-2xs"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Mode Terang</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-600" />
                  <span>Mode Gelap</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Content View */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 relative transition-colors duration-200">
          <AnimatePresence mode="wait">
            <motion.div 
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="p-5 md:p-8 max-w-7xl mx-auto min-h-full"
            >
              {/* 15-Minute Upcoming Class Reminder Alert Banner */}
              <ScheduleReminderBanner
                alerts={upcomingAlerts}
                onDismiss={dismissAlert}
                soundEnabled={soundEnabled}
                onToggleSound={toggleSound}
              />

              {/* Assignment Deadline Reminder Alert Banner (Due within 24 hours) */}
              <AssignmentDeadlineBanner
                alerts={deadlineAlerts}
                onDismiss={dismissDeadlineAlert}
                soundEnabled={deadlineSoundEnabled}
                onToggleSound={toggleDeadlineSound}
                notificationPermission={deadlineNotifPermission}
                onRequestPermission={requestDeadlineNotifPermission}
                onTestReminder={triggerDeadlineSimulation}
              />

              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Floating Offline Indicator when user loses network */}
      <OfflineIndicator />
    </div>
  );
};

