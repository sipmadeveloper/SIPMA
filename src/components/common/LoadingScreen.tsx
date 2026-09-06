import React from 'react';
import { Loader2, RefreshCw, Database, Cloud, CheckCircle2, ShieldCheck } from 'lucide-react';
import { SystemSettings } from '../../types/sipma';
import { normalizeImageUrl, handleImageError } from '../../utils/imageUrl';

interface GlobalLoadingProps {
  isOpen: boolean;
  message?: string;
  subMessage?: string;
}

export const GlobalLoadingOverlay: React.FC<GlobalLoadingProps> = ({
  isOpen,
  message = 'Memproses data...',
  subMessage,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm transition-all animate-in fade-in duration-200"
      role="status"
      aria-live="polite"
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center flex flex-col items-center space-y-4 animate-in zoom-in-95 duration-200">
        {/* Animated Double Ring Spinner */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-100 animate-ping opacity-35" />
          <div className="w-14 h-14 rounded-full border-3 border-emerald-200 border-t-emerald-600 animate-spin" />
          <div className="absolute w-8 h-8 rounded-full bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-700 shadow-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-1.5 w-full">
          <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
            {message}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            {subMessage || 'Mohon tunggu sebentar, sistem sedang memproses permintaan Anda...'}
          </p>
        </div>

        {/* Security / System indicator */}
        <div className="pt-2 border-t border-slate-100 w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-emerald-700">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Sistem PPDB Madrasah Terenkripsi</span>
        </div>
      </div>
    </div>
  );
};

interface AppSplashScreenProps {
  settings?: SystemSettings | null;
  statusMessage?: string;
}

export const AppSplashScreen: React.FC<AppSplashScreenProps> = ({
  settings,
  statusMessage = 'Menyiapkan portal dan memuat database...',
}) => {
  const appName = settings?.app_name || 'SIPMA';
  const appTagline = settings?.app_tagline || 'Sistem Penerimaan Murid Madrasah';
  const appLogo = settings?.app_logo;

  return (
    <div className="fixed inset-0 z-[99999] bg-gradient-to-b from-emerald-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-300">
      {/* Background radial glow */}
      <div className="absolute w-96 h-96 rounded-full bg-emerald-600/15 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-sm w-full text-center space-y-6 flex flex-col items-center">
        {/* App Logo & Ring Animation */}
        <div className="relative flex items-center justify-center">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-400 opacity-30 blur-md absolute animate-pulse" />
          <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-2 shadow-2xl flex items-center justify-center relative">
            {appLogo ? (
              <img
                src={normalizeImageUrl(appLogo)}
                alt={appName}
                className="w-full h-full object-contain rounded-xl bg-white p-1"
                referrerPolicy="no-referrer"
                onError={(e) => handleImageError(e)}
              />
            ) : (
              <div className="w-full h-full rounded-xl bg-emerald-600 flex items-center justify-center font-black text-2xl text-white shadow-inner">
                {appName.charAt(0) || 'S'}
              </div>
            )}
          </div>
        </div>

        {/* Brand Text */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {appName}
          </h1>
          <p className="text-xs text-emerald-300 font-semibold tracking-wider uppercase">
            {appTagline}
          </p>
        </div>

        {/* Loading Progress Bar & Spinner */}
        <div className="w-full max-w-xs space-y-3 pt-2">
          <div className="relative w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 rounded-full animate-[shimmer_1.5s_infinite_linear] [animation-duration:1.2s] w-[60%] [animation-iteration-count:infinite] [animation-name:slide]" />
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-300">
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
            <span>{statusMessage}</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-4">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>Sinkronisasi Data Multi-Device</span>
        </div>
      </div>
    </div>
  );
};
