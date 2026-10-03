import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  ChevronDown,
  LogOut,
  QrCode,
} from 'lucide-react';
import { User as UserType, School, SystemSettings } from '../../types/sipma';
import { normalizeImageUrl, handleImageError } from '../../utils/imageUrl';
import { NotificationBellDropdown } from '../common/NotificationBellDropdown';
import { NewApplicantItem } from '../common/NewApplicantNotificationBanner';

interface Props {
  currentUser: UserType | null;
  currentSchool?: School | null;
  settings?: SystemSettings | null;
  onNavigateHome: () => void;
  onOpenProfile?: () => void;
  onOpenQRScanner?: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onLogout?: () => void;
  notifications?: NewApplicantItem[];
  unreadNotificationsCount?: number;
  onOpenApplicantFromNotification?: (regNumber: string) => void;
  onMarkAllNotificationsAsRead?: () => void;
}

export const Navbar: React.FC<Props> = ({
  currentUser,
  currentSchool,
  settings,
  onNavigateHome,
  onOpenProfile,
  onOpenQRScanner,
  onToggleSidebar,
  isSidebarOpen,
  onLogout,
  notifications = [],
  unreadNotificationsCount = 0,
  onOpenApplicantFromNotification,
  onMarkAllNotificationsAsRead,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const appName = settings?.app_name || 'SIPMA';
  const appTagline = settings?.app_tagline || 'Sistem Penerimaan Murid Madrasah';
  const appLogo = settings?.app_logo;

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-emerald-100/80 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Side: Seamless Integrated Toggle Menu Button & Clean App Identity (No Role Badge) */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {currentUser ? (
            <div className="flex items-center gap-2.5">
              {/* Integrated Top Header Toggle Menu Button: Kotak Bergaris Tiga Elegan & Halus */}
              {onToggleSidebar && (
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  className={`w-9 h-9 sm:w-10 sm:h-10 flex flex-col items-center justify-center gap-[4.5px] rounded-lg bg-white hover:bg-slate-50 active:scale-95 transition-all border border-slate-300 hover:border-slate-500 shadow-2xs cursor-pointer shrink-0 ${
                    isSidebarOpen ? 'bg-slate-100 border-slate-600 ring-2 ring-slate-400/20' : ''
                  }`}
                  title={isSidebarOpen ? 'Tutup Menu Navigasi' : 'Buka Menu Navigasi'}
                  aria-label={isSidebarOpen ? 'Tutup Menu Navigasi' : 'Buka Menu Navigasi'}
                >
                  <span className="w-4 sm:w-4.5 h-[2px] bg-slate-700 rounded-full transition-colors" />
                  <span className="w-4 sm:w-4.5 h-[2px] bg-slate-700 rounded-full transition-colors" />
                  <span className="w-4 sm:w-4.5 h-[2px] bg-slate-700 rounded-full transition-colors" />
                </button>
              )}

              {/* Clean App Identity Without Role Badge */}
              <div className="flex items-center gap-2 min-w-0">
                {appLogo ? (
                  <img
                    src={normalizeImageUrl(appLogo)}
                    alt={appName}
                    className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-lg border border-emerald-200/80 shadow-2xs bg-white p-0.5 shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e)}
                  />
                ) : (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-emerald-800 to-teal-600 text-white flex items-center justify-center font-black text-xs sm:text-sm shadow-2xs shrink-0">
                    {appName.charAt(0) || 'S'}
                  </div>
                )}
                <div className="font-black text-sm text-slate-900 leading-tight truncate">
                  {appName}
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onNavigateHome}
              className="flex items-center gap-2.5 text-left group cursor-pointer min-w-0"
            >
              {appLogo ? (
                <img
                  src={normalizeImageUrl(appLogo)}
                  alt={appName}
                  className="w-9 h-9 object-contain rounded-xl border border-emerald-200/80 shadow-xs group-hover:scale-105 transition-transform bg-white p-0.5 shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => handleImageError(e)}
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-800 to-teal-600 text-white flex items-center justify-center font-black text-lg shadow-xs group-hover:scale-105 transition-transform shrink-0">
                  {appName.charAt(0) || 'S'}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-black text-sm sm:text-base tracking-tight text-slate-900 leading-none group-hover:text-emerald-800 transition-colors truncate max-w-[140px] sm:max-w-none">
                  {appName}
                </div>
                <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider truncate max-w-[140px] sm:max-w-none">
                  {appTagline}
                </div>
              </div>
            </button>
          )}
        </div>

        {/* User Right Menu */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-2">
              {/* QR Scanner Quick Button for Admin & Operators */}
              {currentUser.role !== 'calon_murid' && onOpenQRScanner && (
                <button
                  type="button"
                  onClick={onOpenQRScanner}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer group"
                  title="Pindai QR Bukti Pendaftaran untuk verifikasi berkas otomatis"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
                  <span className="hidden md:inline">Pindai QR</span>
                </button>
              )}

              {/* Notification Bell Dropdown for Admin & Operators */}
              {currentUser.role !== 'calon_murid' && onOpenApplicantFromNotification && onMarkAllNotificationsAsRead && (
                <NotificationBellDropdown
                  notifications={notifications}
                  unreadCount={unreadNotificationsCount}
                  onOpenApplicant={onOpenApplicantFromNotification}
                  onMarkAllAsRead={onMarkAllNotificationsAsRead}
                />
              )}

              {/* User Dropdown Action Button (Segitiga Kebawah) */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer shadow-2xs active:scale-95 ${
                    isUserMenuOpen
                      ? 'bg-slate-100 border-slate-400 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 hover:text-slate-900 hover:border-slate-400'
                  }`}
                  title="Klik untuk membuka pilihan profil akun & keluar"
                  aria-label="Menu Akun"
                  aria-expanded={isUserMenuOpen}
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isUserMenuOpen ? 'rotate-180 text-emerald-700' : 'text-slate-600'
                    }`}
                  />
                </button>

                {/* Popover Dropdown Menu: 2 Pilihan (Profil Akun & Keluar) */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 sm:w-52 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    {/* User Summary Header */}
                    <div className="px-3 py-2 border-b border-slate-100 mb-1">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {currentUser.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {currentUser.email || currentUser.phone || currentUser.registration_number || '-'}
                      </div>
                    </div>

                    {/* Pilihan 1: Tombol Profil Akun */}
                    {onOpenProfile && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenProfile();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-950 hover:bg-emerald-50/80 transition-all cursor-pointer text-left"
                      >
                        <User className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>Profil Akun</span>
                      </button>
                    )}

                    {/* Pilihan 2: Tombol Keluar */}
                    {onLogout && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 transition-all cursor-pointer text-left border-t border-slate-100 mt-1"
                      >
                        <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Keluar</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onNavigateHome}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Beranda
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
