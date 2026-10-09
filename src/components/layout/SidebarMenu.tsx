import React, { useState, useEffect } from 'react';
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
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Database,
  Cloud,
  HardDrive,
  FileText,
  Code,
} from 'lucide-react';
import { User as UserType, School, SystemSettings } from '../../types/sipma';
import { normalizeImageUrl, handleImageError } from '../../utils/imageUrl';
import { storageService } from '../../services/storageService';

export interface SidebarStats {
  totalSchools?: number;
  totalApps?: number;
  totalAuditLogs?: number;
  schoolAppsCount?: number;
  schoolDocsCount?: number;
  operatorsCount?: number;
}

export interface NavSubItem {
  id: string;
  label: string;
  icon?: any;
  badge?: number;
  subTab?: string;
  subItems?: NavSubItem[];
}

export interface NavParentMenu {
  id: string;
  label: string;
  icon: any;
  badge?: number;
  subItems: NavSubItem[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  currentUser: UserType | null;
  currentSchool?: School | null;
  settings?: SystemSettings | null;
  activeTab: string;
  activeSubTab?: string;
  onSelectTab: (tabId: string, subTab?: string) => void;
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
  activeSubTab,
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

  const isSchoolStaff = isSchoolAdmin || isOperator;
  const targetSchool = isSchoolStaff
    ? currentSchool || (currentUser?.school_id ? storageService.getSchoolById(currentUser.school_id) : null)
    : null;

  const displayLogo = isSchoolStaff && targetSchool?.logo_url ? targetSchool.logo_url : appLogo;
  const displayName = isSchoolStaff && targetSchool?.school_name ? String(targetSchool.school_name) : appName;

  const nsmStr = targetSchool?.nsm !== undefined && targetSchool?.nsm !== null ? String(targetSchool.nsm).trim() : '';
  const npsnStr = targetSchool?.npsn !== undefined && targetSchool?.npsn !== null ? String(targetSchool.npsn).trim() : '';

  const displaySubtitle = isSchoolStaff
    ? nsmStr
      ? (nsmStr.toUpperCase().startsWith('NSM') ? nsmStr : `NSM: ${nsmStr}`)
      : (npsnStr ? `NPSN: ${npsnStr}` : 'Madrasah')
    : 'Menu Navigasi';

  // Hierarchical Menus with Sub-menus for Each User Account
  const getNavMenus = (): NavParentMenu[] => {
    if (isCentralAdmin) {
      return [
        {
          id: 'menu_central_dashboard',
          label: 'Dashboard & Analitik',
          icon: TrendingUp,
          subItems: [
            { id: 'overview', label: 'Ringkasan & Analitik', icon: TrendingUp },
            { id: 'map', label: 'Peta Sebaran Wilayah', icon: MapPin },
          ],
        },
        {
          id: 'menu_central_institutions',
          label: 'Lembaga & Pendaftar',
          icon: Building2,
          badge: (stats.totalSchools || 0) + (stats.totalApps || 0),
          subItems: [
            { id: 'schools', label: 'Satuan Madrasah', icon: Building2, badge: stats.totalSchools },
            { id: 'admins', label: 'Akun Admin Madrasah', icon: ShieldCheck },
            { id: 'applicants', label: 'Semua Pendaftar', icon: Users, badge: stats.totalApps },
          ],
        },
        {
          id: 'menu_central_system',
          label: 'Sistem & Informasi',
          icon: Settings,
          badge: stats.totalAuditLogs,
          subItems: [
            {
              id: 'config',
              label: 'Sinkronisasi & Pengaturan',
              icon: Settings,
              subItems: [
                { id: 'config', subTab: 'config', label: 'Konfigurasi & Koneksi Database', icon: Database },
                { id: 'config', subTab: 'realtime', label: 'Sinkronisasi Realtime', icon: Cloud },
                { id: 'config', subTab: 'backup', label: 'Backup & Restore Database', icon: HardDrive },
                { id: 'config', subTab: 'guide', label: 'Panduan Setup (GAS & Vercel)', icon: FileText },
                { id: 'config', subTab: 'code', label: 'Kode Backend (Code.gs)', icon: Code },
              ],
            },
            { id: 'announcements', label: 'Pengumuman Resmi', icon: Bell },
            { id: 'logs', label: 'Audit Log Sistem', icon: History, badge: stats.totalAuditLogs },
          ],
        },
      ];
    }

    if (isSchoolAdmin || isOperator) {
      return [
        {
          id: 'menu_school_dashboard',
          label: 'Dashboard & Wilayah',
          icon: TrendingUp,
          subItems: [
            { id: 'overview', label: 'Ringkasan & Statistik', icon: TrendingUp },
            { id: 'map', label: 'Peta Sebaran Murid', icon: MapPin },
          ],
        },
        {
          id: 'menu_school_applicants',
          label: 'Manajemen Pendaftar',
          icon: Users,
          badge: stats.schoolAppsCount,
          subItems: [
            { id: 'applicants', label: 'Data Pendaftar', icon: Users, badge: stats.schoolAppsCount },
            { id: 'selection', label: 'Proses Seleksi & Kelulusan', icon: Award },
          ],
        },
        {
          id: 'menu_school_archives',
          label: 'Arsip Digital Dokumen',
          icon: Archive,
          badge: stats.schoolDocsCount,
          subItems: [
            { id: 'archives', subTab: 'detection', label: 'Deteksi Kelengkapan Berkas', icon: CheckSquare },
            { id: 'archives', subTab: 'files_gallery', label: 'Daftar Berkas Terarsip (List)', icon: Archive, badge: stats.schoolDocsCount },
          ],
        },
        ...(!isOperator
          ? [
              {
                id: 'menu_school_settings',
                label: 'Pengaturan Madrasah',
                icon: Settings,
                subItems: [
                  { id: 'settings', label: 'Pengaturan & Zonasi', icon: Settings },
                  { id: 'operators', label: 'Tim Operator Madrasah', icon: UserCheck, badge: stats.operatorsCount },
                ],
              },
            ]
          : []),
      ];
    }

    // Calon Murid / Wali Murid
    return [
      {
        id: 'menu_student_registration',
        label: 'Pendaftaran PPDB',
        icon: GraduationCap,
        subItems: [
          { id: 'overview', label: 'Beranda & Status Seleksi', icon: TrendingUp },
          { id: 'form', label: 'Formulir Pendaftaran', icon: FileEdit },
          { id: 'print', label: 'Cetak Bukti Pendaftaran', icon: Printer },
        ],
      },
      {
        id: 'menu_student_info',
        label: 'Informasi & Akun',
        icon: User,
        subItems: [
          { id: 'profile', label: 'Profil Calon Murid', icon: User },
          { id: 'announcements', label: 'Pengumuman Resmi', icon: Bell },
        ],
      },
    ];
  };

  const navMenus = getNavMenus();

  // Track accordion state for each menu & sub-menu
  const [openMenuIds, setOpenMenuIds] = useState<Record<string, boolean>>({});
  const [openSubMenuIds, setOpenSubMenuIds] = useState<Record<string, boolean>>({});

  // Auto-expand parent menu & sub-menu that contains the current active tab
  useEffect(() => {
    const parentMenu = navMenus.find((m) =>
      m.subItems.some((sub) => {
        if (sub.id === activeTab) return true;
        if (sub.subItems?.some((child) => child.id === activeTab)) return true;
        return false;
      })
    );
    if (parentMenu) {
      setOpenMenuIds((prev) => ({
        ...prev,
        [parentMenu.id]: true,
      }));
    }
    if (activeTab === 'config') {
      setOpenSubMenuIds((prev) => ({
        ...prev,
        config: true,
      }));
    }
  }, [activeTab]);

  const toggleMenu = (menuId: string) => {
    setOpenMenuIds((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }));
  };

  const toggleSubMenu = (subItemId: string, defaultSubTab?: string) => {
    setOpenSubMenuIds((prev) => {
      const willOpen = !prev[subItemId];
      if (willOpen) {
        onSelectTab(subItemId, activeSubTab || defaultSubTab || 'config');
      }
      return {
        ...prev,
        [subItemId]: willOpen,
      };
    });
  };

  const handleSubItemClick = (subItem: NavSubItem) => {
    if (subItem.subItems && subItem.subItems.length > 0) {
      toggleSubMenu(subItem.id, subItem.subItems[0]?.subTab);
      return;
    }
    onSelectTab(subItem.id, subItem.subTab);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onClose();
    }
  };

  const isSubItemActive = (subItem: NavSubItem) => {
    if (subItem.id !== activeTab) return false;
    if (subItem.subTab) {
      const currentSub = activeSubTab || (activeTab === 'config' ? 'config' : '');
      return subItem.subTab === currentSub;
    }
    return !subItem.subItems || subItem.subItems.length === 0;
  };

  const hasActiveSubChild = (subItem: NavSubItem) => {
    if (subItem.id !== activeTab) return false;
    if (!subItem.subItems || subItem.subItems.length === 0) return true;
    return subItem.subItems.some((child) => isSubItemActive(child));
  };

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-white text-slate-800">
      {/* Top Header of Sidebar */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {displayLogo ? (
              <img
                src={normalizeImageUrl(displayLogo)}
                alt={displayName}
                className="w-8 h-8 object-contain rounded-xl border border-emerald-200 bg-white p-0.5 shadow-2xs shrink-0"
                referrerPolicy="no-referrer"
                onError={(e) => handleImageError(e)}
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-800 to-teal-600 text-white flex items-center justify-center font-black text-sm shadow-2xs shrink-0">
                {displayName.charAt(0) || 'M'}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-black text-sm text-slate-900 leading-tight truncate" title={displayName}>
                {displayName}
              </div>
              <div className="text-[10px] font-bold text-emerald-800 tracking-wider truncate uppercase font-mono">
                {displaySubtitle}
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

        {/* Navigation Links with Expandable Sub-menus */}
        <div className="p-3 space-y-2 overflow-y-auto flex-1 min-h-0">
          <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
            Daftar Menu & Sub Menu
          </div>

          <div className="space-y-1.5">
            {navMenus.map((menu) => {
              const MenuIcon = menu.icon;
              const isMenuOpen = Boolean(openMenuIds[menu.id]);
              const hasActiveChild = menu.subItems.some((sub) => isSubItemActive(sub));

              return (
                <div key={menu.id} className="space-y-1">
                  {/* Primary Parent Menu Button */}
                  <button
                    type="button"
                    onClick={() => toggleMenu(menu.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer group ${
                      hasActiveChild
                        ? 'bg-slate-100 text-slate-900 border border-slate-300/80 shadow-2xs'
                        : isMenuOpen
                        ? 'bg-slate-50 text-slate-900 border border-slate-200'
                        : 'text-slate-700 hover:text-emerald-950 hover:bg-emerald-50/70 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MenuIcon
                        className={`w-4 h-4 shrink-0 transition-transform ${
                          hasActiveChild || isMenuOpen
                            ? 'text-emerald-700'
                            : 'text-slate-500 group-hover:text-emerald-600'
                        }`}
                      />
                      <span className="truncate">{menu.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {menu.badge !== undefined && menu.badge > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
                          {menu.badge}
                        </span>
                      )}
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                          isMenuOpen ? 'rotate-0 text-emerald-700' : '-rotate-90 text-slate-400'
                        }`}
                      />
                    </div>
                  </button>

                  {/* Collapsible Sub-menu Items */}
                  {isMenuOpen && (
                    <div className="ml-3 pl-1.5 my-1 space-y-1 py-0.5 animate-in fade-in duration-200">
                      {menu.subItems.map((subItem, sIdx) => {
                        const SubIcon = subItem.icon || ChevronRight;
                        const hasSubSubItems = Boolean(subItem.subItems && subItem.subItems.length > 0);
                        const isSubMenuOpen = Boolean(openSubMenuIds[subItem.id]);
                        const isParentActive = hasActiveSubChild(subItem);
                        const isActive = isSubItemActive(subItem);

                        if (hasSubSubItems) {
                          return (
                            <div key={`${subItem.id}-${sIdx}`} className="space-y-1">
                              {/* Sub Menu Toggle Header */}
                              <button
                                type="button"
                                onClick={() => toggleSubMenu(subItem.id, subItem.subItems?.[0]?.subTab)}
                                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all text-left cursor-pointer group ${
                                  isParentActive
                                    ? 'bg-slate-900 text-white font-bold shadow-2xs'
                                    : 'text-slate-700 hover:text-emerald-950 hover:bg-emerald-50/70 font-semibold'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <SubIcon
                                    className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110 ${
                                      isParentActive
                                        ? 'text-emerald-300'
                                        : 'text-slate-500 group-hover:text-emerald-600'
                                    }`}
                                  />
                                  <span className="truncate">{subItem.label}</span>
                                </div>

                                <ChevronDown
                                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                    isParentActive ? 'text-emerald-300' : 'text-slate-400'
                                  } ${isSubMenuOpen ? 'rotate-0' : '-rotate-90'}`}
                                />
                              </button>

                              {/* Sub-sub Menu Items */}
                              {isSubMenuOpen && subItem.subItems && (
                                <div className="ml-2.5 pl-1.5 my-1 space-y-1 py-0.5 animate-in fade-in duration-150">
                                  {subItem.subItems.map((child, cIdx) => {
                                    const ChildIcon = child.icon || ChevronRight;
                                    const isChildActive = isSubItemActive(child);

                                    return (
                                      <button
                                        key={`${child.id}-${child.subTab || cIdx}`}
                                        type="button"
                                        onClick={() => handleSubItemClick(child)}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-all text-left cursor-pointer group ${
                                          isChildActive
                                            ? 'bg-emerald-800 text-white font-bold shadow-2xs ring-1 ring-emerald-700'
                                            : 'text-slate-600 hover:text-emerald-950 hover:bg-emerald-100/60 font-medium'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <ChildIcon
                                            className={`w-3 h-3 shrink-0 transition-transform group-hover:scale-110 ${
                                              isChildActive
                                                ? 'text-emerald-200'
                                                : 'text-slate-400 group-hover:text-emerald-700'
                                            }`}
                                          />
                                          <span className="truncate">{child.label}</span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <button
                            key={`${subItem.id}-${subItem.subTab || sIdx}`}
                            type="button"
                            onClick={() => handleSubItemClick(subItem)}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all text-left cursor-pointer group ${
                              isActive
                                ? 'bg-emerald-900 text-white font-bold shadow-2xs ring-1 ring-emerald-800'
                                : 'text-slate-600 hover:text-emerald-950 hover:bg-emerald-50/70 font-semibold'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <SubIcon
                                className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110 ${
                                  isActive
                                    ? 'text-emerald-300'
                                    : 'text-slate-400 group-hover:text-emerald-600'
                                }`}
                              />
                              <span className="truncate">{subItem.label}</span>
                            </div>

                            {subItem.badge !== undefined && subItem.badge > 0 && (
                              <span
                                className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                                  isActive
                                    ? 'bg-emerald-800 text-emerald-200 border border-emerald-700'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200 group-hover:bg-emerald-100 group-hover:text-emerald-900'
                                }`}
                              >
                                {subItem.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Footer Area */}
      <div className="p-3 border-t border-slate-200/80 bg-slate-50/80">
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
