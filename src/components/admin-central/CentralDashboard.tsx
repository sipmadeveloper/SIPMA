import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Users,
  ShieldCheck,
  Award,
  Settings,
  History,
  Bell,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  MapPin,
  User,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  School,
  Application,
  StudentProfile,
  ParentData,
  SchoolOrigin,
  AddressData,
  DocumentItem,
  AuditLog,
  Announcement,
  SystemSettings,
} from '../../types/sipma';
import { SchoolManagement } from './SchoolManagement';
import { SchoolAdminManagement } from './SchoolAdminManagement';
import { SystemConfig } from './SystemConfig';
import { AuditLogsView } from './AuditLogsView';
import { AnnouncementsView } from '../common/AnnouncementsView';
import { ApplicantList } from '../admin-school/ApplicantList';
import { ApplicantDistributionMap } from '../map/ApplicantDistributionMap';

interface Props {
  schools: School[];
  applications: Application[];
  students: Record<string, StudentProfile>;
  parents: Record<string, ParentData>;
  schoolOrigins: Record<string, SchoolOrigin>;
  addresses: Record<string, AddressData>;
  documents: DocumentItem[];
  auditLogs: AuditLog[];
  announcements: Announcement[];
  settings: SystemSettings;
  onSaveSchool: (school: School) => void;
  onDeleteSchool?: (schoolId: string) => void;
  onSaveSettings: (settings: SystemSettings) => void;
  onAddAnnouncement: (announcement: Announcement) => void;
  onDeleteAnnouncement?: (id: string) => void;
  onVerify: (regNumber: string, status: any, notes: string) => void;
  onViewPrint?: (regNumber: string) => void;
  onExportCsv?: () => void;
  onExportExcel?: () => void;
  onOpenProfile?: () => void;
  onDeleteApplicant?: (regNumber: string) => void;
  onRefreshData?: () => void;
  activeTab?: 'overview' | 'schools' | 'admins' | 'applicants' | 'map' | 'config' | 'logs' | 'announcements';
  onTabChange?: (tab: 'overview' | 'schools' | 'admins' | 'applicants' | 'map' | 'config' | 'logs' | 'announcements') => void;
  configSubTab?: 'config' | 'realtime' | 'backup' | 'guide' | 'code';
  onConfigSubTabChange?: (tab: 'config' | 'realtime' | 'backup' | 'guide' | 'code') => void;
  highlightRegNumber?: string | null;
  onClearHighlight?: () => void;
}

export const CentralDashboard: React.FC<Props> = ({
  schools,
  applications,
  students,
  parents,
  schoolOrigins,
  addresses,
  documents,
  auditLogs,
  announcements,
  settings,
  onSaveSchool,
  onDeleteSchool,
  onSaveSettings,
  onAddAnnouncement,
  onDeleteAnnouncement,
  onVerify,
  onViewPrint,
  onExportCsv,
  onExportExcel,
  onOpenProfile,
  onDeleteApplicant,
  onRefreshData,
  activeTab: controlledActiveTab,
  onTabChange,
  configSubTab,
  onConfigSubTabChange,
  highlightRegNumber,
  onClearHighlight,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<
    'overview' | 'schools' | 'admins' | 'applicants' | 'map' | 'config' | 'logs' | 'announcements'
  >('overview');

  const activeTab = controlledActiveTab || internalActiveTab;
  const handleTabSelect = (tab: 'overview' | 'schools' | 'admins' | 'applicants' | 'map' | 'config' | 'logs' | 'announcements') => {
    setInternalActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  // Active Tab Info for Section Header
  const tabInfoMap: Record<string, { label: string; icon: any; count?: number }> = {
    overview: { label: 'Ringkasan & Analitik Penerimaan', icon: TrendingUp },
    schools: { label: 'Data Satuan Pendidikan Madrasah', icon: Building2, count: schools.length },
    admins: { label: 'Manajemen Akun Admin Madrasah', icon: ShieldCheck },
    applicants: { label: 'Data Seluruh Pendaftar Murid', icon: Users, count: applications.length },
    map: { label: 'Peta Sebaran Wilayah Calon Murid', icon: MapPin },
    config: { label: 'Sinkronisasi Backend & Pengaturan', icon: Settings },
    logs: { label: 'Audit Log & Riwayat Aktivitas', icon: History, count: auditLogs.length },
    announcements: { label: 'Pengumuman Resmi Portal', icon: Bell, count: announcements.length },
  };

  const currentTabInfo = tabInfoMap[activeTab] || { label: 'Menu Utama', icon: TrendingUp };
  const CurrentTabIcon = currentTabInfo.icon;

  // Auto-switch to applicants tab when a registration number is highlighted (e.g. from QR scan)
  useEffect(() => {
    if (highlightRegNumber && activeTab !== 'applicants') {
      handleTabSelect('applicants');
    }
  }, [highlightRegNumber, activeTab]);

  // Multi-school stats
  const totalSchools = schools.length;
  const totalApps = applications.length;
  const totalVerified = applications.filter((a) => a.verification_status === 'terverifikasi').length;
  const totalLulus = applications.filter((a) => a.final_status === 'lulus').length;
  const totalZonasi = applications.filter((a) => a.pathway === 'zonasi').length;
  const totalAfirmasi = applications.filter((a) => a.pathway === 'afirmasi').length;
  const totalPrestasi = applications.filter((a) => a.pathway === 'prestasi').length;
  const totalMutasi = applications.filter((a) => a.pathway === 'mutasi').length;

  // Chart: Pendaftar per Madrasah
  const schoolChartData = useMemo(() => {
    return schools.map((sch) => {
      const count = applications.filter((a) => a.school_id === sch.school_id).length;
      return {
        name: (sch.school_name || sch.school_id || 'Madrasah')
          .replace('Madrasah Aliyah Negeri', 'MAN')
          .replace('Madrasah Tsanawiyah Negeri', 'MTsN'),
        pendaftar: count,
      };
    });
  }, [schools, applications]);

  return (
    <div className="space-y-4" id="sipma-central-dashboard">
      {/* ================= TAB 1: OVERVIEW ================= */}
      {activeTab === 'overview' && (
        <div key="overview" className="space-y-4 animate-tab-pane">
          {/* Top Banner (Hanya Tampil di Halaman Awal / Overview) */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-4 sm:p-5 rounded-xl shadow-xs border border-slate-750 w-full overflow-hidden">
            <div className="space-y-1">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white leading-tight break-words">
                Pusat Komando & Monitoring PPDB Madrasah
              </h1>
              <p className="text-xs text-slate-300 max-w-5xl leading-relaxed break-words">
                Monitoring penerimaan murid baru madrasah se-wilayah, rekapitulasi kuota, audit log, dan sinkronisasi data.
              </p>
            </div>
          </div>

          {/* KPI Cards - Kotak Kecil Rapi Responsif Menyesuaikan Layar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2.5 w-full">
            <div className="bg-gradient-to-br from-indigo-50/80 to-white p-2 sm:p-2.5 rounded-xl border border-indigo-200/80 shadow-2xs text-center flex flex-col justify-center min-w-0">
              <div className="text-[9px] sm:text-[10px] text-indigo-900 font-bold uppercase tracking-wider truncate">Madrasah</div>
              <div className="text-base sm:text-xl font-black text-indigo-950 leading-tight my-0.5">{totalSchools}</div>
              <div className="text-[8px] sm:text-[9px] text-indigo-700/80 font-medium truncate">Satuan Pendidikan</div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50/80 to-white p-2 sm:p-2.5 rounded-xl border border-emerald-200/80 shadow-2xs text-center flex flex-col justify-center min-w-0">
              <div className="text-[9px] sm:text-[10px] text-emerald-900 font-bold uppercase tracking-wider truncate">Total Murid</div>
              <div className="text-base sm:text-xl font-black text-emerald-950 leading-tight my-0.5">{totalApps}</div>
              <div className="text-[8px] sm:text-[9px] text-emerald-800/80 font-medium truncate">Semua Jalur</div>
            </div>

            <div className="bg-gradient-to-br from-blue-50/80 to-white p-2 sm:p-2.5 rounded-xl border border-blue-200/80 shadow-2xs text-center flex flex-col justify-center min-w-0">
              <div className="text-[9px] sm:text-[10px] text-blue-900 font-bold uppercase tracking-wider truncate">Verifikasi</div>
              <div className="text-base sm:text-xl font-black text-blue-950 leading-tight my-0.5">{totalVerified}</div>
              <div className="text-[8px] sm:text-[9px] text-blue-700/80 font-medium truncate">Berkas Valid</div>
            </div>

            <div className="bg-gradient-to-br from-teal-50/80 to-white p-2 sm:p-2.5 rounded-xl border border-teal-200/80 shadow-2xs text-center flex flex-col justify-center min-w-0">
              <div className="text-[9px] sm:text-[10px] text-teal-900 font-bold uppercase tracking-wider truncate">Lulus</div>
              <div className="text-base sm:text-xl font-black text-teal-950 leading-tight my-0.5">{totalLulus}</div>
              <div className="text-[8px] sm:text-[9px] text-teal-700/80 font-medium truncate">Memenuhi Kuota</div>
            </div>
          </div>

          {/* Regional Chart */}
          <div className="bg-white/95 p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Statistik Pendaftar per Satuan Madrasah</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sebaran jumlah pendaftar di setiap madrasah se-wilayah</p>
              </div>
              <div className="self-start sm:self-auto px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 shrink-0">
                {totalApps} Total Calon Murid
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={schoolChartData}>
                  <XAxis dataKey="name" fontSize={11} stroke="#475569" />
                  <YAxis fontSize={11} stroke="#475569" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }} />
                  <Bar dataKey="pendaftar" radius={[6, 6, 0, 0]} fill="#059669" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: SCHOOLS ================= */}
      {activeTab === 'schools' && (
        <div key="schools" className="animate-tab-pane">
          <SchoolManagement schools={schools} onSaveSchool={onSaveSchool} onDeleteSchool={onDeleteSchool} />
        </div>
      )}

      {/* ================= TAB: SCHOOL ADMINS ================= */}
      {activeTab === 'admins' && (
        <div key="admins" className="animate-tab-pane">
          <SchoolAdminManagement schools={schools} onRefreshData={onRefreshData} />
        </div>
      )}

      {/* ================= TAB 3: APPLICANTS ================= */}
      {activeTab === 'applicants' && (
        <div key="applicants" className="animate-tab-pane">
          <ApplicantList
            applications={applications}
            students={students}
            parents={parents}
            schoolOrigins={schoolOrigins}
            addresses={addresses}
            documents={documents}
            school={schools[0]}
            onVerify={onVerify}
            onViewPrint={onViewPrint}
            onExportCsv={onExportCsv}
            onExportExcel={onExportExcel}
            onDeleteApplicant={onDeleteApplicant}
            highlightRegNumber={highlightRegNumber}
            onClearHighlight={onClearHighlight}
          />
        </div>
      )}

      {/* ================= TAB 4: DISTRIBUTION MAP ================= */}
      {activeTab === 'map' && (
        <div key="map" className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 animate-tab-pane">
          <div className="border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900">Peta Sebaran Wilayah</h3>
            <p className="text-xs text-slate-500">
              Visualisasi pemetaan titik koordinat lokasi calon murid terhadap madrasah se-wilayah.
            </p>
          </div>

          <ApplicantDistributionMap
            school={schools[0]}
            applications={applications}
            students={students}
          />
        </div>
      )}

      {/* ================= TAB 5: GAS & SYSTEM CONFIG ================= */}
      {activeTab === 'config' && (
        <div key="config" className="animate-tab-pane">
          <SystemConfig
            settings={settings}
            onSaveSettings={onSaveSettings}
            activeSubTab={configSubTab}
            onSubTabChange={onConfigSubTabChange}
          />
        </div>
      )}

      {/* ================= TAB 6: AUDIT LOGS ================= */}
      {activeTab === 'logs' && (
        <div key="logs" className="animate-tab-pane">
          <AuditLogsView logs={auditLogs} />
        </div>
      )}

      {/* ================= TAB 7: ANNOUNCEMENTS ================= */}
      {activeTab === 'announcements' && (
        <div key="announcements" className="animate-tab-pane">
          <AnnouncementsView
            announcements={announcements}
            canManage={true}
            currentUserName="Administrator Pusat"
            onAddAnnouncement={onAddAnnouncement}
            onDeleteAnnouncement={onDeleteAnnouncement}
          />
        </div>
      )}
    </div>
  );
};
