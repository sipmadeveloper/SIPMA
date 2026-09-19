import React from 'react';
import { SystemSettings } from '../../types/sipma';

export type LoadingActionType = 'save' | 'delete' | 'upload' | 'sync' | 'default';

interface GlobalLoadingProps {
  isOpen: boolean;
  message?: string;
  subMessage?: string;
  actionType?: LoadingActionType;
}

export const GlobalLoadingOverlay: React.FC<GlobalLoadingProps> = ({
  isOpen,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all animate-in fade-in duration-150 select-none pointer-events-auto"
      role="status"
      aria-live="polite"
      aria-label="Memuat..."
    >
      {/* Elegant minimalist spinning circle without text and without background card */}
      <div className="relative flex items-center justify-center">
        <div className="w-14 h-14 rounded-full border-4 border-white/20 border-t-emerald-500 animate-spin shadow-lg" />
      </div>
    </div>
  );
};

interface AppSplashScreenProps {
  settings?: SystemSettings | null;
  statusMessage?: string;
}

export const AppSplashScreen: React.FC<AppSplashScreenProps> = () => {
  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs select-none pointer-events-auto"
      role="status"
      aria-live="polite"
      aria-label="Memuat aplikasi..."
    >
      {/* Elegant minimalist spinning circle without text and without background card */}
      <div className="relative flex items-center justify-center">
        <div className="w-14 h-14 rounded-full border-4 border-white/20 border-t-emerald-500 animate-spin shadow-lg" />
      </div>
    </div>
  );
};
