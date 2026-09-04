import React, { useState, useMemo } from 'react';
import {
  Users,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Settings,
  Award,
  Layers,
  ChevronRight,
  TrendingUp,
  User,
  UserCheck,
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
  VerificationStatus,
  User as UserType,
} from '../../types/sipma';
import { ApplicantList } from './ApplicantList';
import { SelectionManagement } from './SelectionManagement';
import { SchoolSettings } from './SchoolSettings';
import { SchoolOperatorManagement } from './SchoolOperatorManagement';
import { ApplicantDistributionMap } from '../map/ApplicantDistributionMap';
import { formatDistanceIndonesian } from '../../utils/geo';
import { storageService } from '../../services/storageService';
import { SchoolTab } from '../../utils/router';

interface Props {
  school: School;
  applications: Application[];
  students: Record<string, StudentProfile>;
  parents: Record<string, ParentData>;
  schoolOrigins: Record<string, SchoolOrigin>;
  addresses: Record<string, AddressData>;
  documents: DocumentItem[];
  currentUser?: UserType | null;
  onVerify: (regNumber: string, status: VerificationStatus, notes: string) => void;
  onUpdateSelection: (regNumber: string, status: 'lulus' | 'tidak_lulus' | 'menunggu') => void;
  onBulkSelection: (updates: { regNumber: string; status: 'lulus' | 'tidak_lulus' }[]) => void;
  onSaveSchool: (updatedSchool: School) => void;
  onViewPrint?: (regNumber: string) => void;
  onExportCsv?: () => void;
  onExportExcel?: () => void;
  onOpenProfile?: () => void;
  onDeleteApplicant?: (regNumber: string) => void;
  onRefreshData?: () => void;
  activeTab?: SchoolTab;
  onTabChange?: (tab: SchoolTab) => void;
}

export const SchoolDashboard: React.FC<Props> = ({
  school,
  applications,
  students,
  parents,
  schoolOrigins,
  addresses,
  documents,
  currentUser,
  onVerify,
  onUpdateSelection,
  onBulkSelection,
  onSaveSchool,
  onViewPrint,
  onExportCsv,
  onExportExcel,
  onOpenProfile,
  onDeleteApplicant,
  onRefreshData,
  activeTab: controlledTab,
  onTabChange,
}) => {
  const [internalTab, setInternalTab] = useState<SchoolTab>('overview');
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;

  const setActiveTab = (tab: SchoolTab) => {
    setInternalTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const activeSchool: School = school || {
    school_id: 'SCH-MAN1',
    npsn: '20100001',
    school_name: 'MAN 1 Kota Jakarta',
    level: 'MA',
    status: 'active',
    address: 'Jl. Madrasah No. 1',
    village: 'Pondok Indah',
    district: 'Kebayoran Lama',
    city: 'Jakarta Selatan',
    province: 'DKI Jakarta',
    latitude: -6.2655,
    longitude: 106.7844,
    radius_zonasi_km: 5,
    zoning_radius_km: 5,
    quota_total: 100,
    quota_zonasi: 50,
    quota_afirmasi: 20,
    quota_prestasi: 20,
    quota_mutasi: 10,
  };

  // School-specific applications (only students that have selected this madrasah)
  const schoolApps = useMemo(() => {
    return applications.filter((a) => a.school_id === activeSchool.school_id);
  }, [applications, activeSchool.school_id]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = schoolApps.length;
    const zonasi = schoolApps.filter((a) => a.pathway === 'zonasi').length;
    const afirmasi = schoolApps.filter((a) => a.pathway === 'afirmasi').length;
    const prestasi = schoolApps.filter((a) => a.pathway === 'prestasi').length;
    const mutasi = schoolApps.filter((a) => a.pathway === 'mutasi').length;
    const waiting = schoolApps.filter((a) => a.verification_status === 'menunggu').length;
    const fixNeeded = schoolApps.filter((a) => a.verification_status === 'perlu_perbaikan').length;
    const verified = schoolApps.filter((a) => a.verification_status === 'terverifikasi').length;
    const lulus = schoolApps.filter((a) => a.final_status === 'lulus').length;
    const tidakLulus = schoolApps.filter((a) => a.final_status === 'tidak_lulus').length;

    return { total, zonasi, afirmasi, prestasi, mutasi, waiting, fixNeeded, verified, lulus, tidakLulus };
  }, [schoolApps]);

  // Chart Data
  const pathwayChartData = [
    { name: 'Zonasi', pendaftar: stats.zonasi, fill: '#059669' },
    { name: 'Afirmasi', pendaftar: stats.afirmasi, fill: '#9333ea' },
    { name: 'Prestasi', pendaftar: stats.prestasi, fill: '#d97706' },
    { name: 'Mutasi', pendaftar: stats.mutasi, fill: '#2563eb' },
  ];

  const statusChartData = [
    { name: 'Terverifikasi', value: stats.verified, color: '#10b981' },
    { name: 'Menunggu', value: stats.waiting, color: '#6366f1' },
    { name: 'Perlu Perbaikan', value: stats.fixNeeded, color: '#f59e0b' },
    { name: 'Lulus', value: stats.lulus, color: '#047857' },
    { name: 'Tidak Lulus', value: stats.tidakLulus, color: '#e11d48' },
  ].filter((d) => d.value > 0);

  // Operator team for this school
  const operators = useMemo(() => {
    return storageService.getSchoolOperators(activeSchool.school_id);
  }, [activeSchool.school_id]);

  const isOperator = currentUser?.role === 'operator_sekolah';

  return (
    <div className="space-y-6" id="sipma-school-dashboard">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 text-white p-6 rounded-2xl shadow-md border border-emerald-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
            {isOperator ? 'Panel Operator Madrasah' : 'Panel Administrator Madrasah'}
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1 text-white">
            {isOperator
              ? `Selamat Datang, Operator ${activeSchool.school_name}`
              : `Selamat Datang, Admin ${activeSchool.school_name}`}
          </h1>
          <p className="text-xs text-emerald-100/80 mt-1 max-w-xl">
            {isOperator
              ? 'Bantu verifikasi berkas persyaratan pendaftar, keabsahan dokumen, dan proses pemeringkatan seleksi calon peserta didik baru.'
              : 'Kelola data calon murid baru, akun tim operator madrasah, verifikasi berkas persyaratan, perhitungan zonasi koordinat, dan proses seleksi.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isOperator && (
            <button
              type="button"
              onClick={() => setActiveTab('operators')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                activeTab === 'operators'
                  ? 'bg-teal-600 text-white ring-2 ring-teal-400/40'
                  : 'bg-teal-800/70 hover:bg-teal-700 text-white border border-teal-500/40'
              }`}
              title="Kelola Akun Operator Madrasah"
            >
              <UserCheck className="w-3.5 h-3.5 text-teal-200" />
              <span>Tim Operator ({operators.length})</span>
            </button>
          )}

          {(onExportExcel || onExportCsv) && (
            <button
              type="button"
              onClick={onExportExcel || onExportCsv}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600/30 hover:bg-emerald-600/50 text-white border border-emerald-400/30 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Unduh seluruh rekap pendaftar madrasah ini dalam format Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              <span>Export Excel (.xlsx)</span>
            </button>
          )}

          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
              title={isOperator ? 'Profil Operator Madrasah' : 'Profil Admin Madrasah'}
            >
              <User className="w-3.5 h-3.5 text-emerald-300" />
              <span>{isOperator ? 'Profil Operator' : 'Profil Admin'}</span>
            </button>
          )}

          {!isOperator && (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Pengaturan Madrasah</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex bg-slate-200/70 backdrop-blur-xs p-1.5 rounded-2xl border border-slate-300/80 shadow-xs overflow-x-auto text-xs font-bold gap-1">
        {[
          { id: 'overview', label: 'Ringkasan & Statistik', icon: TrendingUp },
          { id: 'applicants', label: `Data Pendaftar (${schoolApps.length})`, icon: Users },
          { id: 'selection', label: 'Proses Seleksi & Kelulusan', icon: Award },
          { id: 'operators', label: `Tim Operator (${operators.length})`, icon: UserCheck },
          { id: 'map', label: 'Peta Sebaran Murid', icon: MapPin },
          ...(!isOperator
            ? [{ id: 'settings', label: 'Pengaturan Madrasah & Lokasi', icon: Settings }]
            : []),
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
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
          {/* KPI Cards Grid - 6 columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="bg-gradient-to-br from-slate-50 to-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
              <div className="text-[11px] text-slate-800 font-bold uppercase tracking-wider">Total Pendaftar</div>
              <div className="text-2xl font-black text-slate-950 mt-1">{stats.total}</div>
              <div className="text-[10px] text-slate-500 mt-1 font-medium">Murid Terdaftar</div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50/80 to-white p-4 rounded-xl border border-emerald-200/80 shadow-xs">
              <div className="text-[11px] text-emerald-900 font-bold uppercase tracking-wider">Jalur Zonasi</div>
              <div className="text-2xl font-black text-emerald-950 mt-1">{stats.zonasi}</div>
              <div className="text-[10px] text-emerald-700/80 mt-1 font-medium">Kuota: {activeSchool.quota_zonasi}</div>
            </div>

            <div className="bg-gradient-to-br from-purple-50/80 to-white p-4 rounded-xl border border-purple-200/80 shadow-xs">
              <div className="text-[11px] text-purple-900 font-bold uppercase tracking-wider">Jalur Afirmasi</div>
              <div className="text-2xl font-black text-purple-950 mt-1">{stats.afirmasi}</div>
              <div className="text-[10px] text-purple-700/80 mt-1 font-medium">Kuota: {activeSchool.quota_afirmasi}</div>
            </div>

            <div className="bg-gradient-to-br from-amber-50/80 to-white p-4 rounded-xl border border-amber-200/80 shadow-xs">
              <div className="text-[11px] text-amber-900 font-bold uppercase tracking-wider">Jalur Prestasi</div>
              <div className="text-2xl font-black text-amber-950 mt-1">{stats.prestasi}</div>
              <div className="text-[10px] text-amber-700/80 mt-1 font-medium">Kuota: {activeSchool.quota_prestasi || 40}</div>
            </div>

            <div className="bg-gradient-to-br from-blue-50/80 to-white p-4 rounded-xl border border-blue-200/80 shadow-xs">
              <div className="text-[11px] text-blue-900 font-bold uppercase tracking-wider">Jalur Mutasi</div>
              <div className="text-2xl font-black text-blue-950 mt-1">{stats.mutasi}</div>
              <div className="text-[10px] text-blue-700/80 mt-1 font-medium">Kuota: {activeSchool.quota_mutasi || 20}</div>
            </div>

            <div className="bg-gradient-to-br from-teal-50/80 to-white p-4 rounded-xl border border-teal-200/80 shadow-xs">
              <div className="text-[11px] text-teal-900 font-bold uppercase tracking-wider">Terverifikasi</div>
              <div className="text-2xl font-black text-teal-950 mt-1">{stats.verified}</div>
              <div className="text-[10px] text-teal-700/80 mt-1 font-medium">{stats.waiting} menunggu</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Bar Chart: Pendaftar per Jalur */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Statistik Pendaftar per Jalur</h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pathwayChartData}>
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="pendaftar" radius={[6, 6, 0, 0]} fill="#059669" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie Chart: Status Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Distribusi Status Pendaftaran</h3>
              <div className="h-60 flex items-center justify-center">
                {statusChartData.length === 0 ? (
                  <div className="text-xs text-slate-400">Belum ada data pendaftar</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                        fontSize={10}
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Recent Applicants Section */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Pendaftar Terbaru</h3>
              <button
                type="button"
                onClick={() => setActiveTab('applicants')}
                className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
              >
                <span>Lihat Semua Pendaftar</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <ApplicantList
              applications={schoolApps.slice(0, 5)}
              students={students}
              parents={parents}
              schoolOrigins={schoolOrigins}
              addresses={addresses}
              documents={documents}
              school={school}
              onVerify={onVerify}
              onViewPrint={onViewPrint}
              onDeleteApplicant={onDeleteApplicant}
            />
          </div>
        </div>
      )}

      {/* ================= TAB 2: APPLICANTS ================= */}
      {activeTab === 'applicants' && (
        <ApplicantList
          applications={schoolApps}
          students={students}
          parents={parents}
          schoolOrigins={schoolOrigins}
          addresses={addresses}
          documents={documents}
          school={activeSchool}
          onVerify={onVerify}
          onViewPrint={onViewPrint}
          onExportCsv={onExportCsv}
          onExportExcel={onExportExcel}
          onDeleteApplicant={onDeleteApplicant}
        />
      )}

      {/* ================= TAB 3: SELECTION ================= */}
      {activeTab === 'selection' && (
        <SelectionManagement
          school={activeSchool}
          applications={schoolApps}
          students={students}
          schoolOrigins={schoolOrigins}
          onUpdateStatus={onUpdateSelection}
          onBulkUpdate={onBulkSelection}
        />
      )}

      {/* ================= TAB: OPERATORS ================= */}
      {activeTab === 'operators' && (
        <SchoolOperatorManagement
          school={activeSchool}
          currentUser={currentUser}
          onRefreshData={onRefreshData}
        />
      )}

      {/* ================= TAB 4: DISTRIBUTION MAP ================= */}
      {activeTab === 'map' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Peta Persebaran Titik Rumah Calon Murid
              </h3>
              <p className="text-xs text-slate-500">
                Visualisasi titik koordinat rumah calon murid relatif terhadap radius zonasi ({activeSchool.zoning_radius_km} km) {activeSchool.school_name}.
              </p>
            </div>
          </div>

          <ApplicantDistributionMap
            school={activeSchool}
            applications={schoolApps}
            students={students}
          />
        </div>
      )}

      {/* ================= TAB 5: SETTINGS ================= */}
      {activeTab === 'settings' && (
        <SchoolSettings school={activeSchool} onSave={onSaveSchool} />
      )}
    </div>
  );
};
