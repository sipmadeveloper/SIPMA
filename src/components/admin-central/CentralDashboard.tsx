import React, { useState, useMemo } from 'react';
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
    <div className="space-y-6" id="sipma-central-dashboard">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 text-white p-6 rounded-2xl shadow-md border border-emerald-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
            Panel Administrator Wilayah
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1 text-white">
            SIPMA Central Command Center
          </h1>
          <p className="text-xs text-emerald-100/80 mt-1 max-w-xl">
            Monitoring terpusat penerimaan murid baru madrasah se-wilayah dan kontrol multi-satuan pendidikan secara terpadu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(onExportExcel || onExportCsv) && (
            <button
              type="button"
              onClick={onExportExcel || onExportCsv}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600/30 hover:bg-emerald-600/50 text-white border border-emerald-400/30 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Unduh rekapitulasi data pendaftar seluruh madrasah dalam format Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              <span>Export Excel Wilayah (.xlsx)</span>
            </button>
          )}

          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
              title="Buka Pengaturan Profil & Ganti Password Admin Pusat"
            >
              <User className="w-3.5 h-3.5 text-rose-300" />
              <span>Profil Admin</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleTabSelect('config')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Pengaturan Sinkronisasi</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex bg-slate-200/70 backdrop-blur-xs p-1.5 rounded-2xl border border-slate-300/80 shadow-xs overflow-x-auto text-xs font-bold gap-1">
        {[
          { id: 'overview', label: 'Ringkasan & Analitik', icon: TrendingUp },
          { id: 'schools', label: `Madrasah (${schools.length})`, icon: Building2 },
          { id: 'admins', label: 'Akun Admin Madrasah', icon: ShieldCheck },
          { id: 'applicants', label: `Semua Pendaftar (${applications.length})`, icon: Users },
          { id: 'map', label: 'Peta Sebaran Wilayah', icon: MapPin },
          { id: 'config', label: 'Sinkronisasi Backend API', icon: Settings },
          { id: 'logs', label: `Audit Log (${auditLogs.length})`, icon: History },
          { id: 'announcements', label: 'Pengumuman Resmi', icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabSelect(tab.id as any)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all font-bold ${
                isActive
                  ? 'bg-emerald-900 text-white shadow-sm ring-1 ring-emerald-800'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/80'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-300' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: OVERVIEW ================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-indigo-50/80 to-white p-4 rounded-xl border border-indigo-200/80 shadow-xs">
              <div className="text-xs text-indigo-900 font-bold uppercase tracking-wider">Total Madrasah</div>
              <div className="text-2xl font-black text-indigo-950 mt-1">{totalSchools}</div>
              <div className="text-[11px] text-indigo-700/80 mt-1 font-medium">Satuan Pendidikan MI, MTs, & MA</div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50/80 to-white p-4 rounded-xl border border-emerald-200/80 shadow-xs">
              <div className="text-xs text-emerald-900 font-bold uppercase tracking-wider">Total Calon Murid</div>
              <div className="text-2xl font-black text-emerald-950 mt-1">{totalApps}</div>
              <div className="text-[11px] text-emerald-800/80 mt-1 font-medium truncate">
                {totalZonasi} Zonasi · {totalAfirmasi} Afirmasi · {totalPrestasi} Prestasi · {totalMutasi} Mutasi
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50/80 to-white p-4 rounded-xl border border-blue-200/80 shadow-xs">
              <div className="text-xs text-blue-900 font-bold uppercase tracking-wider">Berkas Terverifikasi</div>
              <div className="text-2xl font-black text-blue-950 mt-1">{totalVerified}</div>
              <div className="text-[11px] text-blue-700/80 mt-1 font-medium">Valid & Memenuhi Syarat</div>
            </div>

            <div className="bg-gradient-to-br from-teal-50/80 to-white p-4 rounded-xl border border-teal-200/80 shadow-xs">
              <div className="text-xs text-teal-900 font-bold uppercase tracking-wider">Lulus Seleksi</div>
              <div className="text-2xl font-black text-teal-950 mt-1">{totalLulus}</div>
              <div className="text-[11px] text-teal-700/80 mt-1 font-medium">Murid Memenuhi Kuota</div>
            </div>
          </div>

          {/* Regional Chart */}
          <div className="bg-white/95 p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Statistik Pendaftar per Satuan Madrasah</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sebaran jumlah pendaftar di setiap madrasah se-wilayah</p>
              </div>
              <div className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
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

          {/* Quick List */}
          <div className="bg-white/95 p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900">Pendaftar Terbaru Wilayah</h3>
              <button
                type="button"
                onClick={() => handleTabSelect('applicants')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
              >
                Lihat Semua ({applications.length}) →
              </button>
            </div>
            <ApplicantList
              applications={applications.slice(0, 5)}
              students={students}
              parents={parents}
              schoolOrigins={schoolOrigins}
              addresses={addresses}
              documents={documents}
              school={schools[0]}
              onVerify={onVerify}
              onViewPrint={onViewPrint}
              onDeleteApplicant={onDeleteApplicant}
            />
          </div>
        </div>
      )}

      {/* ================= TAB 2: SCHOOLS ================= */}
      {activeTab === 'schools' && (
        <SchoolManagement schools={schools} onSaveSchool={onSaveSchool} onDeleteSchool={onDeleteSchool} />
      )}

      {/* ================= TAB: SCHOOL ADMINS ================= */}
      {activeTab === 'admins' && (
        <SchoolAdminManagement schools={schools} onRefreshData={onRefreshData} />
      )}

      {/* ================= TAB 3: APPLICANTS ================= */}
      {activeTab === 'applicants' && (
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
        />
      )}

      {/* ================= TAB 4: DISTRIBUTION MAP ================= */}
      {activeTab === 'map' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Peta Sebaran Murid se-Wilayah</h3>
            <p className="text-xs text-slate-500">
              Visualisasi pemetaan lokasi calon murid terhadap madrasah pilihan.
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
        <SystemConfig settings={settings} onSaveSettings={onSaveSettings} />
      )}

      {/* ================= TAB 6: AUDIT LOGS ================= */}
      {activeTab === 'logs' && (
        <AuditLogsView logs={auditLogs} />
      )}

      {/* ================= TAB 7: ANNOUNCEMENTS ================= */}
      {activeTab === 'announcements' && (
        <AnnouncementsView
          announcements={announcements}
          canManage={true}
          currentUserName="Administrator Pusat"
          onAddAnnouncement={onAddAnnouncement}
          onDeleteAnnouncement={onDeleteAnnouncement}
        />
      )}
    </div>
  );
};
