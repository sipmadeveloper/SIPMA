import React from 'react';
import {
  TrendingUp,
  Users,
  Award,
  Archive,
  UserCheck,
  MapPin,
  Settings,
  Building2,
  ShieldCheck,
  History,
  Bell,
  FileEdit,
  Printer,
  User,
  KeyRound,
  LogOut,
  X,
  PanelLeft,
  PanelLeftClose,
  GraduationCap,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { User as UserType, School, SystemSettings } from '../../types/sipma';
import { normalizeImageUrl, handleImageError } from '../../utils/imageUrl';

export interface SidebarStats {
  totalSchools?: number;
  totalApps?: number;
  totalAuditLogs?: number;
  schoolAppsCount?: number;
  schoolDocsCount?: number;
  operatorsCount?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  currentUser: UserType | null;
  currentSchool?: School | null;
  settings?: SystemSettings | null;
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  stats?: SidebarStats;
  onLogout: () => void;
  onOpenProfile?: () => void;
}

export const SidebarMenu: React.FC<Props> = ({
  isOpen,
  onClose,
  onToggle,
  currentUser,
  currentSchool,
  settings,
  activeTab,
  onSelectTab,
  stats = {},
  onLogout,
  onOpenProfile,
}) => {
  if (!currentUser) return null;

  const appName = settings?.app_name || 'SIPMA';
  const appLogo = settings?.app_logo;
  const academicYear =
    settings?.academic_year_label ||
    `${settings?.application_year || '2027'}/${(parseInt(String(settings?.application_year || '2027'), 10) || 2027) + 1}`;

  const isOperator = currentUser.role === 'operator_sekolah';
  const isSchoolAdmin = currentUser.role === 'admin_sekolah';
  const isCentralAdmin = currentUser.role === 'admin_pusat';
  const isStudent = currentUser.role === 'calon_murid';

  // Navigation Items by User Role
  const getNavSections = () => {
    if (isCentralAdmin) {
      return [
        {
          title: 'Menu Pusat',
          items: [
            { id: 'overview', label: 'Ringkasan & Analitik', icon: TrendingUp },
            { id: 'schools', label: 'Satuan Madrasah', icon: Building2, badge: stats.totalSchools },
            { id: 'admins', label: 'Akun Admin Madrasah', icon: ShieldCheck },
            { id: 'applicants', label: 'Semua Pendaftar', icon: Users, badge: stats.totalApps },
            { id: 'map', label: 'Peta Sebaran Wilayah', icon: MapPin },
            { id: 'config', label: 'Sinkronisasi & Pengaturan', icon: Settings },
            { id: 'logs', label: 'Audit Log Sistem', icon: History, badge: stats.totalAuditLogs },
            { id: 'announcements', label: 'Pengumuman Resmi', icon: Bell },
          ],
        },
      ];
    }

    if (isSchoolAdmin || isOperator) {
      return [
        {
          title: 'Menu Madrasah',
          items: [
            { id: 'overview', label: 'Ringkasan & Statistik', icon: TrendingUp },
            { id: 'applicants', label: 'Data Pendaftar', icon: Users, badge: stats.schoolAppsCount },
            { id: 'selection', label: 'Proses Seleksi & Kelulusan', icon: Award },
            { id: 'archives', label: 'Arsip Digital Dokumen', icon: Archive, badge: stats.schoolDocsCount },
            ...(!isOperator
              ? [{ id: 'operators', label: 'Tim Operator Madrasah', icon: UserCheck, badge: stats.operatorsCount }]
              : []),
            { id: 'map', label: 'Peta Sebaran Murid', icon: MapPin },
            ...(!isOperator
              ? [{ id: 'settings', label: 'Pengaturan & Zonasi', icon: Settings }]
              : []),
          ],
        },
      ];
    }

    // Calon Murid / Wali Murid
    return [
      {
        title: 'Pendaftaran PPDB',
        items: [
          { id: 'overview', label: 'Beranda & Status Seleksi', icon: TrendingUp },
          { id: 'form', label: 'Formulir Pendaftaran', icon: FileEdit },
          { id: 'print', label: 'Cetak Bukti Pendaftaran', icon: Printer },
        ],
      },
      {
        title: 'Akun & Informasi',
        items: [
          { id: 'profile', label: 'Profil Calon Murid', icon: User },
          { id: 'announcements', label: 'Pengumuman Resmi', icon: Bell },
        ],
      },
    ];
  };

  const navSections = getNavSections();
  const allNavItems = navSections.flatMap((s) => s.items);

  const handleItemClick = (id: string) => {
    onSelectTab(id);
    onClose();
  };

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-white text-slate-800">
      {/* Top Header of Sidebar */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {appLogo ? (
              <img
                src={normalizeImageUrl(appLogo)}
                alt={appName}
                className="w-8 h-8 object-contain rounded-xl border border-emerald-200 bg-white p-0.5 shadow-2xs shrink-0"
                referrerPolicy="no-referrer"
                onError={(e) => handleImageError(e)}
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-800 to-teal-600 text-white flex items-center justify-center font-black text-sm shadow-2xs shrink-0">
                {appName.charAt(0) || 'S'}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-black text-sm text-slate-900 leading-tight truncate">
                {appName}
              </div>
              <div className="text-[10px] font-bold text-emerald-800 tracking-wider truncate uppercase">
                Menu Navigasi
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
            title="Tutup Menu Navigasi"
          >
            <PanelLeftClose className="w-4 h-4 hidden lg:block" />
            <X className="w-5 h-5 lg:hidden" />
          </button>
        </div>

        {/* User Identity Banner in Sidebar */}
        <div className="px-4 py-3 bg-gradient-to-r from-emerald-950/5 via-teal-950/5 to-slate-100 border-b border-slate-200/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              {currentUser.role === 'admin_pusat' && <ShieldCheck className="w-4 h-4 text-emerald-300" />}
              {(currentUser.role === 'admin_sekolah' || currentUser.role === 'operator_sekolah') && (
                <Building2 className="w-4 h-4 text-emerald-300" />
              )}
              {currentUser.role === 'calon_murid' && <GraduationCap className="w-4 h-4 text-emerald-300" />}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-slate-500 truncate font-medium">
                {currentUser.role === 'admin_pusat' && 'Admin Wilayah'}
                {currentUser.role === 'admin_sekolah' && (currentSchool?.school_name || 'Admin Madrasah')}
                {currentUser.role === 'operator_sekolah' && (currentSchool?.school_name || 'Operator')}
                {currentUser.role === 'calon_murid' && `No. Reg: ${currentUser.registration_number || '-'}`}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="p-3 space-y-4 overflow-y-auto flex-1 min-h-0">
          {navSections.map((sec, secIdx) => (
            <div key={secIdx} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                {sec.title}
              </div>
              <div className="space-y-0.5">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all text-left cursor-pointer group ${
                        isActive
                          ? 'bg-emerald-900 text-white font-bold shadow-xs ring-1 ring-emerald-800'
                          : 'text-slate-700 hover:text-emerald-950 hover:bg-emerald-50/70 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                            isActive ? 'text-emerald-300' : 'text-slate-600 group-hover:text-emerald-700'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            isActive
                              ? 'bg-emerald-800 text-emerald-200 border border-emerald-700'
                              : 'bg-slate-100 text-slate-700 border border-slate-200 group-hover:bg-emerald-100 group-hover:text-emerald-900'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Footer Area */}
      <div className="p-3 border-t border-slate-200/80 bg-slate-50/80 space-y-2">
        {/* Academic Year Indicator */}
        <div className="px-3 py-1.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-emerald-900 font-semibold">
            <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="truncate">Tahun Pelajaran:</span>
          </div>
          <span className="font-bold text-emerald-950 font-mono text-[10px] bg-white px-2 py-0.5 rounded-md border border-emerald-300/80 shadow-2xs">
            {academicYear}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {onOpenProfile && (
            <button
              type="button"
              onClick={() => {
                onOpenProfile();
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  onClose();
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Profil</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop Overlay when open */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-40 animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Slide-over Toggle Menu Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        <div className="w-full h-full flex flex-col">
          {sidebarContent}
        </div>
      </aside>
    </>
  );
};
