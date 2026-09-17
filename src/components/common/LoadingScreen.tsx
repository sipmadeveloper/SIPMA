import React from 'react';
import {
  Loader2,
  RefreshCw,
  Database,
  Cloud,
  CheckCircle2,
  ShieldCheck,
  Save,
  Trash2,
  Upload,
  ArrowUpDown,
  Sparkles,
  FolderSync,
} from 'lucide-react';
import { SystemSettings } from '../../types/sipma';
import { normalizeImageUrl, handleImageError } from '../../utils/imageUrl';

export type LoadingActionType = 'save' | 'delete' | 'upload' | 'sync' | 'default';

interface GlobalLoadingProps {
  isOpen: boolean;
  message?: string;
  subMessage?: string;
  actionType?: LoadingActionType;
}

export const GlobalLoadingOverlay: React.FC<GlobalLoadingProps> = ({
  isOpen,
  message = 'Memproses data...',
  subMessage,
  actionType = 'default',
}) => {
  if (!isOpen) return null;

  // Derive contextual action type if not explicitly provided
  const lowerMsg = (message || '').toLowerCase();
  let resolvedType: LoadingActionType = actionType;
  if (resolvedType === 'default') {
    if (lowerMsg.includes('unggah') || lowerMsg.includes('upload') || lowerMsg.includes('foto') || lowerMsg.includes('berkas')) {
      resolvedType = 'upload';
    } else if (lowerMsg.includes('hapus') || lowerMsg.includes('delete') || lowerMsg.includes('batal')) {
      resolvedType = 'delete';
    } else if (lowerMsg.includes('sinkron') || lowerMsg.includes('sync') || lowerMsg.includes('tarik') || lowerMsg.includes('menghubungkan')) {
      resolvedType = 'sync';
    } else if (lowerMsg.includes('simpan') || lowerMsg.includes('save') || lowerMsg.includes('perbarui') || lowerMsg.includes('kirim')) {
      resolvedType = 'save';
    }
  }

  const getTheme = () => {
    switch (resolvedType) {
      case 'save':
        return {
          ringPing: 'border-emerald-200',
          ringOuter: 'border-emerald-200 border-t-emerald-600',
          badgeBg: 'bg-emerald-50 border-emerald-300 text-emerald-700',
          badgeIcon: Save,
          badgeAnim: 'animate-pulse',
          tagText: 'Menyimpan ke Cloud & Database',
          tagColor: 'text-emerald-700',
        };
      case 'delete':
        return {
          ringPing: 'border-rose-200',
          ringOuter: 'border-rose-200 border-t-rose-600',
          badgeBg: 'bg-rose-50 border-rose-300 text-rose-700',
          badgeIcon: Trash2,
          badgeAnim: 'animate-bounce',
          tagText: 'Menghapus Data & Berkas Cloud',
          tagColor: 'text-rose-700',
        };
      case 'upload':
        return {
          ringPing: 'border-blue-200',
          ringOuter: 'border-blue-200 border-t-blue-600',
          badgeBg: 'bg-blue-50 border-blue-300 text-blue-700',
          badgeIcon: Upload,
          badgeAnim: 'animate-bounce',
          tagText: 'Mengunggah & Menyimpan ke Drive',
          tagColor: 'text-blue-700',
        };
      case 'sync':
        return {
          ringPing: 'border-teal-200',
          ringOuter: 'border-teal-200 border-t-teal-600',
          badgeBg: 'bg-teal-50 border-teal-300 text-teal-700',
          badgeIcon: ArrowUpDown,
          badgeAnim: 'animate-spin',
          tagText: 'Sinkronisasi Spreadsheet & Cloud',
          tagColor: 'text-teal-700',
        };
      default:
        return {
          ringPing: 'border-emerald-100',
          ringOuter: 'border-emerald-200 border-t-emerald-600',
          badgeBg: 'bg-emerald-50 border-emerald-300 text-emerald-700',
          badgeIcon: RefreshCw,
          badgeAnim: 'animate-spin',
          tagText: 'Sistem PPDB Madrasah Terenkripsi',
          tagColor: 'text-emerald-700',
        };
    }
  };

  const theme = getTheme();
  const IconComponent = theme.badgeIcon;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md transition-all animate-in fade-in duration-200 select-none"
      role="status"
      aria-live="polite"
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200/90 text-center flex flex-col items-center space-y-4 animate-in zoom-in-95 duration-200 relative overflow-hidden">
        {/* Subtle decorative top bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-pulse" />

        {/* Animated Double Ring Spinner with Contextual Icon */}
        <div className="relative w-16 h-16 flex items-center justify-center mt-1">
          <div className={`absolute inset-0 rounded-full border-4 ${theme.ringPing} animate-ping opacity-35`} />
          <div className={`w-14 h-14 rounded-full border-3 ${theme.ringOuter} animate-spin`} />
          <div className={`absolute w-8 h-8 rounded-full ${theme.badgeBg} border flex items-center justify-center shadow-xs`}>
            <IconComponent className={`w-4 h-4 ${theme.badgeAnim}`} />
          </div>
        </div>

        {/* Message and Submessage */}
        <div className="space-y-1.5 w-full">
          <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-snug">
            {message}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            {subMessage || 'Mohon tunggu sebentar, sistem sedang memproses dan memverifikasi permintaan Anda...'}
          </p>
        </div>

        {/* Indeterminate subtle progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 h-1.5 rounded-full w-2/3 animate-[shimmer_1.5s_infinite_linear] [animation-duration:1.2s] [animation-iteration-count:infinite]" />
        </div>

        {/* Security / System indicator */}
        <div className={`pt-2 border-t border-slate-100 w-full flex items-center justify-center gap-1.5 text-[11px] font-bold ${theme.tagColor}`}>
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{theme.tagText}</span>
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
