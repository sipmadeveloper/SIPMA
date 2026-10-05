import React, { useState, useMemo, useEffect } from 'react';
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
  Archive,
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
import { DigitalArchiveManagement } from './DigitalArchiveManagement';
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
  highlightRegNumber?: string | null;
  onClearHighlight?: () => void;
  archiveSubTab?: 'detection' | 'files_gallery';
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
  highlightRegNumber,
  onClearHighlight,
  archiveSubTab,
}) => {
  const [internalTab, setInternalTab] = useState<SchoolTab>('overview');
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;

  const setActiveTab = (tab: SchoolTab) => {
    setInternalTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  // Auto-switch to applicants tab when a registration number is highlighted (e.g. from QR scan)
  useEffect(() => {
    if (highlightRegNumber && activeTab !== 'applicants') {
      setActiveTab('applicants');
    }
  }, [highlightRegNumber, activeTab]);

  const activeSchool: School = school || storageService.getSchools()[0] || {
    school_id: '',
    npsn: '',
    school_name: 'Madrasah',
    level: 'MI',
    status: 'active',
    address: '-',
    village: '',
    district: '',
    city: '',
    province: '',
    latitude: -6.964,
    longitude: 109.056,
    radius_zonasi_km: 1,
    zoning_radius_km: 1,
    quota_total: 0,
    quota_zonasi: 0,
    quota_afirmasi: 0,
    quota_prestasi: 0,
    quota_mutasi: 0,
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

  // Count of documents belonging to students registered for this school
  const schoolDocsCount = useMemo(() => {
    const regSet = new Set(schoolApps.map((a) => a.registration_number));
    return documents.filter((d) => regSet.has(d.registration_number)).length;
  }, [schoolApps, documents]);

  const isOperator = currentUser?.role === 'operator_sekolah';

  const currentTabInfo = useMemo(() => {
    switch (activeTab) {
      case 'applicants':
        return { label: 'Data Pendaftar', icon: Users, count: schoolApps.length };
      case 'selection':
        return { label: 'Proses Seleksi & Kelulusan', icon: Award };
      case 'archives':
        return { label: 'Arsip Digital Dokumen', icon: Archive, count: schoolDocsCount };
      case 'operators':
        return { label: 'Tim Operator Madrasah', icon: UserCheck, count: operators.length };
      case 'map':
        return { label: 'Peta Sebaran Murid', icon: MapPin };
      case 'settings':
        return { label: 'Pengaturan & Zonasi', icon: Settings };
      default:
        return { label: 'Ringkasan & Statistik', icon: TrendingUp };
    }
  }, [activeTab, schoolApps.length, schoolDocsCount, operators.length]);

  const CurrentTabIcon = currentTabInfo.icon;

  return (
    <div className="space-y-4" id="sipma-school-dashboard">
      {/* ================= TAB 1: OVERVIEW ================= */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Top Banner (Hanya Tampil di Halaman Awal / Overview) */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-4 sm:p-5 rounded-xl shadow-xs border border-slate-750 w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white leading-tight break-words">
                  {activeSchool.school_name}
                </h1>
                <p className="text-xs text-slate-300 max-w-5xl leading-relaxed break-words">
                  Kelola data calon murid baru, verifikasi berkas persyaratan, perhitungan zonasi koordinat, dan proses seleksi penerimaan murid.
                </p>
              </div>
              {activeSchool.npsn && (
                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <span className="text-[11px] font-mono bg-slate-800/90 border border-slate-750 px-2.5 py-1 rounded-md text-emerald-300 font-semibold tracking-wide">
                    NPSN: {activeSchool.npsn}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* KPI Cards Grid - Kotak Kecil Rapi Responsif Menyesuaikan Layar */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2.5 w-full">
            <div className="bg-gradient-to-br from-slate-50 to-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs text-center flex flex-col justify-center min-w-[70px]">
              <div className="text-[9px] sm:text-[10px] text-slate-700 font-bold uppercase tracking-wider truncate">Total</div>
              <div className="text-base sm:text-xl font-black text-slate-950 leading-tight my-0.5">{stats.total}</div>
              <div className="text-[8px] sm:text-[9px] text-slate-400 font-medium truncate">Pendaftar</div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50/80 to-white p-2 sm:p-2.5 rounded-xl border border-emerald-200/80 shadow-2xs text-center flex flex-col justify-center min-w-[70px]">
              <div className="text-[9px] sm:text-[10px] text-emerald-900 font-bold uppercase tracking-wider truncate">Zonasi</div>
              <div className="text-base sm:text-xl font-black text-emerald-950 leading-tight my-0.5">{stats.zonasi}</div>
              <div className="text-[8px] sm:text-[9px] text-emerald-700/80 font-medium truncate">K: {activeSchool.quota_zonasi}</div>
            </div>

            <div className="bg-gradient-to-br from-purple-50/80 to-white p-2 sm:p-2.5 rounded-xl border border-purple-200/80 shadow-2xs text-center flex flex-col justify-center min-w-[70px]">
              <div className="text-[9px] sm:text-[10px] text-purple-900 font-bold uppercase tracking-wider truncate">Afirmasi</div>
              <div className="text-base sm:text-xl font-black text-purple-950 leading-tight my-0.5">{stats.afirmasi}</div>
              <div className="text-[8px] sm:text-[9px] text-purple-700/80 font-medium truncate">K: {activeSchool.quota_afirmasi}</div>
            </div>

            <div className="bg-gradient-to-br from-amber-50/80 to-white p-2 sm:p-2.5 rounded-xl border border-amber-200/80 shadow-2xs text-center flex flex-col justify-center min-w-[70px]">
              <div className="text-[9px] sm:text-[10px] text-amber-900 font-bold uppercase tracking-wider truncate">Prestasi</div>
              <div className="text-base sm:text-xl font-black text-amber-950 leading-tight my-0.5">{stats.prestasi}</div>
              <div className="text-[8px] sm:text-[9px] text-amber-700/80 font-medium truncate">K: {activeSchool.quota_prestasi || 40}</div>
            </div>

            <div className="bg-gradient-to-br from-blue-50/80 to-white p-2 sm:p-2.5 rounded-xl border border-blue-200/80 shadow-2xs text-center flex flex-col justify-center min-w-[70px]">
              <div className="text-[9px] sm:text-[10px] text-blue-900 font-bold uppercase tracking-wider truncate">Mutasi</div>
              <div className="text-base sm:text-xl font-black text-blue-950 leading-tight my-0.5">{stats.mutasi}</div>
              <div className="text-[8px] sm:text-[9px] text-blue-700/80 font-medium truncate">K: {activeSchool.quota_mutasi || 20}</div>
            </div>

            <div className="bg-gradient-to-br from-teal-50/80 to-white p-2 sm:p-2.5 rounded-xl border border-teal-200/80 shadow-2xs text-center flex flex-col justify-center min-w-[70px]">
              <div className="text-[9px] sm:text-[10px] text-teal-900 font-bold uppercase tracking-wider truncate">Verifikasi</div>
              <div className="text-base sm:text-xl font-black text-teal-950 leading-tight my-0.5">{stats.verified}</div>
              <div className="text-[8px] sm:text-[9px] text-teal-700/80 font-medium truncate">{stats.waiting} tunda</div>
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
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Pendaftar Terbaru</h3>
              <button
                type="button"
                onClick={() => setActiveTab('applicants')}
                className="self-start sm:self-auto text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
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
          highlightRegNumber={highlightRegNumber}
          onClearHighlight={onClearHighlight}
        />
      )}

      {/* ================= TAB 3: SELECTION ================= */}
      {activeTab === 'selection' && (
        <SelectionManagement
          school={activeSchool}
          applications={schoolApps}
          students={students}
          schoolOrigins={schoolOrigins}
          parents={parents}
          addresses={addresses}
          onUpdateStatus={onUpdateSelection}
          onBulkUpdate={onBulkSelection}
        />
      )}

      {/* ================= TAB: DIGITAL ARCHIVES ================= */}
      {activeTab === 'archives' && (
        <DigitalArchiveManagement
          school={activeSchool}
          applications={applications}
          students={students}
          parents={parents}
          documents={documents}
          currentUser={currentUser}
          onRefreshData={onRefreshData}
          initialMainTab={archiveSubTab}
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
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Peta Sebaran Wilayah & Zonasi Madrasah
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
