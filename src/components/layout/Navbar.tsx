import React from 'react';
import {
  User,
  LogOut,
  Bell,
  Building2,
  ShieldCheck,
  GraduationCap,
  ChevronDown,
  UserCheck,
} from 'lucide-react';
import { User as UserType, School, SystemSettings } from '../../types/sipma';
import { normalizeImageUrl } from '../../utils/imageUrl';

interface Props {
  currentUser: UserType | null;
  currentSchool?: School | null;
  settings?: SystemSettings | null;
  onLogout: () => void;
  onNavigateHome: () => void;
  onOpenProfile?: () => void;
}

export const Navbar: React.FC<Props> = ({
  currentUser,
  currentSchool,
  settings,
  onLogout,
  onNavigateHome,
  onOpenProfile,
}) => {
  const getRoleBadge = () => {
    switch (currentUser?.role) {
      case 'admin_pusat':
        return {
          label: 'Admin Pusat',
          bg: 'bg-rose-100 text-rose-800 border-rose-200',
          icon: ShieldCheck,
        };
      case 'admin_sekolah':
        return {
          label: `Panitia ${currentSchool?.school_name || 'Madrasah'}`,
          bg: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Building2,
        };
      case 'operator_sekolah':
        return {
          label: `Operator ${currentSchool?.school_name || 'Madrasah'}`,
          bg: 'bg-teal-100 text-teal-800 border-teal-200',
          icon: UserCheck,
        };
      default:
        return {
          label: 'Calon Murid',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: GraduationCap,
        };
    }
  };

  const roleInfo = getRoleBadge();
  const RoleIcon = roleInfo.icon;
  const appName = settings?.app_name || 'SIPMA';
  const appTagline = settings?.app_tagline || 'Sistem Penerimaan Murid Madrasah';
  const appLogo = settings?.app_logo;

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-emerald-100/80 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand - Dynamic App Logo & Name across all pages */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
          >
            {appLogo ? (
              <img
                src={normalizeImageUrl(appLogo)}
                alt={appName}
                className="w-9 h-9 object-contain rounded-xl border border-emerald-200/80 shadow-xs group-hover:scale-105 transition-transform bg-white p-0.5"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-800 to-teal-600 text-white flex items-center justify-center font-black text-lg shadow-xs group-hover:scale-105 transition-transform">
                {appName.charAt(0) || 'S'}
              </div>
            )}
            <div>
              <div className="font-black text-base tracking-tight text-slate-900 leading-none group-hover:text-emerald-800 transition-colors">
                {appName}
              </div>
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                {appTagline}
              </div>
            </div>
          </button>

          {/* Active Role Pill */}
          {currentUser && (
            <div className="hidden sm:flex items-center gap-1.5 ml-4 pl-4 border-l border-slate-200">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${roleInfo.bg}`}>
                <RoleIcon className="w-3.5 h-3.5" />
                <span className="truncate max-w-[200px]">{roleInfo.label}</span>
              </span>
            </div>
          )}
        </div>

        {/* User Right Menu */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenProfile}
                className="flex items-center gap-2.5 p-1 sm:px-2 sm:py-1 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all text-left cursor-pointer group"
                title="Buka Pengaturan Profil & Kata Sandi Akun"
              >
                {currentUser.photo_url ? (
                  <img
                    src={normalizeImageUrl(currentUser.photo_url)}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-xl object-cover border border-emerald-300 shadow-xs group-hover:border-emerald-500"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-emerald-50 border border-slate-200 group-hover:border-emerald-200 flex items-center justify-center text-slate-600 group-hover:text-emerald-700 transition-colors">
                    <User className="w-4 h-4" />
                  </div>
                )}

                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-900 transition-colors">
                    {currentUser.name}
                  </div>
                  <div className="text-[11px] text-slate-400 group-hover:text-slate-600 font-mono">
                    {currentUser.role === 'admin_pusat'
                      ? 'Admin Pusat'
                      : currentUser.role === 'admin_sekolah'
                      ? 'Panitia PPDB'
                      : currentUser.role === 'operator_sekolah'
                      ? 'Operator Madrasah'
                      : 'Calon Murid'} &bull; Profil
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                title="Keluar (Logout)"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onNavigateHome}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Beranda
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
