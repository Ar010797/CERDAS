import React from 'react';
import { WifiOff, Database, Check } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-2xl bg-amber-500/95 dark:bg-amber-600/95 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md border border-amber-300/40 animate-in fade-in slide-in-from-bottom-2">
      <span className="flex h-2.5 w-2.5 relative">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
      </span>
      <div className="flex items-center gap-1.5">
        <WifiOff className="w-4 h-4" />
        <span>Mode Offline Aktif</span>
      </div>
      <span className="text-[11px] font-normal text-amber-100 hidden sm:inline border-l border-amber-400/60 pl-2">
        Melihat data tugas & pengumuman dari penyimpanan IndexedDB
      </span>
    </div>
  );
};
