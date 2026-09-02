import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Eye,
  CheckCircle,
  AlertCircle,
  XCircle,
  FileSpreadsheet,
  Printer,
  MapPin,
  Clock,
  ArrowUpDown,
  Download,
  KeyRound,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  Application,
  StudentProfile,
  ParentData,
  SchoolOrigin,
  AddressData,
  DocumentItem,
  School,
  PathwayType,
  VerificationStatus,
} from '../../types/sipma';
import { formatDistanceIndonesian, formatCoordinates } from '../../utils/geo';
import { VerificationModal } from './VerificationModal';
import { ResetPasswordModal } from '../common/ResetPasswordModal';
import { exportApplicantsToExcel } from '../../utils/excelExport';

interface Props {
  applications: Application[];
  students: Record<string, StudentProfile>;
  parents: Record<string, ParentData>;
  schoolOrigins: Record<string, SchoolOrigin>;
  addresses: Record<string, AddressData>;
  documents: DocumentItem[];
  school: School;
  onVerify: (regNumber: string, status: VerificationStatus, notes: string) => void;
  onViewPrint?: (regNumber: string) => void;
  onExportCsv?: () => void;
  onExportExcel?: () => void;
  onDeleteApplicant?: (regNumber: string) => void;
}

export const ApplicantList: React.FC<Props> = ({
  applications,
  students,
  parents,
  schoolOrigins,
  addresses,
  documents,
  school,
  onVerify,
  onViewPrint,
  onExportCsv,
  onExportExcel,
  onDeleteApplicant,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pathwayFilter, setPathwayFilter] = useState<string>('all');
  const [verificationFilter, setVerificationFilter] = useState<string>('all');
  const [selectionFilter, setSelectionFilter] = useState<'all' | 'lulus' | 'tidak_lulus' | 'menunggu'>('all');
  const [sortBy, setSortBy] = useState<'distance' | 'name' | 'date'>('distance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [selectedAppForVerification, setSelectedAppForVerification] = useState<Application | null>(null);
  const [initialVerificationTab, setInitialVerificationTab] = useState<'profile' | 'location' | 'docs'>('profile');
  const [resetPasswordApp, setResetPasswordApp] = useState<Application | null>(null);
  const [appToDelete, setAppToDelete] = useState<Application | null>(null);

  // Export Excel Modal & Options state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [exportChoice, setExportChoice] = useState<'lulus' | 'all' | 'filtered'>('lulus');

  // Counts for badge & export
  const countLulus = useMemo(() => {
    return applications.filter((a) => a.final_status === 'lulus' || a.selection_status === 'lulus').length;
  }, [applications]);

  const countTotal = applications.length;

  // Filtered & Sorted Applicants
  const filteredApps = useMemo(() => {
    return applications
      .filter((app) => {
        const student = students[app.registration_number];
        const name = student?.name?.toLowerCase() || '';
        const nik = student?.nik || '';
        const nisn = student?.nisn || '';
        const reg = app.registration_number?.toLowerCase() || '';
        const q = searchQuery ? searchQuery.toLowerCase().trim() : '';

        const matchQuery = !q || name.includes(q) || nik.includes(q) || nisn.includes(q) || reg.includes(q);
        const matchPathway = pathwayFilter === 'all' || app.pathway === pathwayFilter;
        const matchVerification = verificationFilter === 'all' || app.verification_status === verificationFilter;

        const isLulus = app.final_status === 'lulus' || app.selection_status === 'lulus';
        const isTidakLulus = app.final_status === 'tidak_lulus' || app.selection_status === 'tidak_lulus';
        const isMenunggu = !isLulus && !isTidakLulus;
        const matchSelection =
          selectionFilter === 'all' ||
          (selectionFilter === 'lulus' && isLulus) ||
          (selectionFilter === 'tidak_lulus' && isTidakLulus) ||
          (selectionFilter === 'menunggu' && isMenunggu);

        return matchQuery && matchPathway && matchVerification && matchSelection;
      })
      .sort((a, b) => {
        if (sortBy === 'distance') {
          return sortOrder === 'asc' ? a.distance_km - b.distance_km : b.distance_km - a.distance_km;
        }
        if (sortBy === 'name') {
          const nameA = students[a.registration_number]?.name || '';
          const nameB = students[b.registration_number]?.name || '';
          return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        }
        // date
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
  }, [applications, students, searchQuery, pathwayFilter, verificationFilter, selectionFilter, sortBy, sortOrder]);

  const handleExportPassed = () => {
    const passedApps = applications.filter((a) => a.final_status === 'lulus' || a.selection_status === 'lulus');
    exportApplicantsToExcel(
      passedApps,
      students,
      parents,
      schoolOrigins,
      addresses,
      [school],
      {
        filterType: 'lulus',
        filterLabel: 'Khusus Siswa yang Lolos (Diterima)',
        schoolName: school.school_name,
      }
    );
    setIsExportModalOpen(false);
    setIsExportDropdownOpen(false);
  };

  const handleExportAll = () => {
    exportApplicantsToExcel(
      applications,
      students,
      parents,
      schoolOrigins,
      addresses,
      [school],
      {
        filterType: 'all',
        filterLabel: 'Seluruh Pendaftar Madrasah',
        schoolName: school.school_name,
      }
    );
    setIsExportModalOpen(false);
    setIsExportDropdownOpen(false);
  };

  const handleExportCurrent = () => {
    exportApplicantsToExcel(
      filteredApps,
      students,
      parents,
      schoolOrigins,
      addresses,
      [school],
      {
        filterType: 'filtered',
        filterLabel: `Tampilan Terfilter (${selectionFilter === 'lulus' ? 'Khusus Lolos' : selectionFilter}, Jalur: ${pathwayFilter})`,
        schoolName: school.school_name,
      }
    );
    setIsExportModalOpen(false);
    setIsExportDropdownOpen(false);
  };

  const toggleSort = (field: 'distance' | 'name' | 'date') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getVerificationBadge = (status: VerificationStatus) => {
    switch (status) {
      case 'terverifikasi':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">✓ Terverifikasi</span>;
      case 'perlu_perbaikan':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">⏳ Perlu Perbaikan</span>;
      case 'ditolak':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">✕ Ditolak</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">⏳ Menunggu</span>;
    }
  };

  return (
    <div className="space-y-4" id="sipma-applicant-list">
      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, NIK, NISN, no. pendaftaran..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Pathway filter */}
          <select
            value={pathwayFilter}
            onChange={(e) => setPathwayFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">Semua Jalur</option>
            <option value="zonasi">Jalur Zonasi</option>
            <option value="afirmasi">Jalur Afirmasi</option>
            <option value="prestasi">Jalur Prestasi</option>
            <option value="mutasi">Jalur Mutasi</option>
          </select>

          {/* Verification filter */}
          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">Semua Status Verifikasi</option>
            <option value="menunggu">Menunggu</option>
            <option value="terverifikasi">Terverifikasi</option>
            <option value="perlu_perbaikan">Perlu Perbaikan</option>
            <option value="ditolak">Ditolak</option>
          </select>

          {/* Selection status filter */}
          <select
            value={selectionFilter}
            onChange={(e) => setSelectionFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
            title="Filter pendaftar berdasarkan hasil seleksi kelulusan"
          >
            <option value="all">Semua Status Seleksi</option>
            <option value="lulus">🟢 Khusus Siswa Lolos ({countLulus})</option>
            <option value="tidak_lulus">🔴 Tidak Lolos</option>
            <option value="menunggu">⏳ Dalam Proses Seleksi</option>
          </select>

          {/* Export Excel Button with Dropdown & Modal */}
          <div className="relative inline-block text-left">
            <div className="inline-flex rounded-xl shadow-xs">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-l-xl text-xs font-bold transition-colors cursor-pointer"
                title="Unduh data pendaftar dalam format spreadsheet Excel (.xlsx) yang rapi"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                className="px-2 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-r-xl border-l border-emerald-500/50 text-xs font-bold transition-colors cursor-pointer"
                title="Pilihan Cepat Unduh Excel"
              >
                ▼
              </button>
            </div>

            {isExportDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl z-30 p-2 space-y-1">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Pilihan Unduh Format Excel (.xlsx)
                </div>
                <button
                  type="button"
                  onClick={handleExportPassed}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Unduh Khusus Siswa Lolos</span>
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">
                    {countLulus}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleExportAll}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>Unduh Seluruh Pendaftar</span>
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold">
                    {countTotal}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCurrent}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>Unduh Filter Tampilan</span>
                  </span>
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono font-bold">
                    {filteredApps.length}
                  </span>
                </button>
                <div className="border-t border-slate-100 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      setIsExportModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-emerald-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                  >
                    Buka Panduan & Opsi Lengkap...
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">No</th>
                <th className="py-3.5 px-4">No. Pendaftaran</th>
                <th
                  onClick={() => toggleSort('name')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Nama Calon Murid</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Jalur</th>
                <th
                  onClick={() => toggleSort('distance')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Jarak Zonasi</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Status Zonasi</th>
                <th className="py-3.5 px-4">Verifikasi Berkas</th>
                <th className="py-3.5 px-4">Hasil Seleksi</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Tidak ditemukan data pendaftar yang sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredApps.map((app, index) => {
                  const student = students[app.registration_number];
                  const isZonasiCompliant = app.zoning_status === 'memenuhi';

                  return (
                    <tr key={app.application_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <div>{app.registration_number}</div>
                        {app.is_auto_rerouted && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.5 rounded mt-0.5"
                            title={app.reroute_reason || 'Pelimpahan berkas otomatis'}
                          >
                            🔄 Pelimpahan Otomatis
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{student?.name || '-'}</div>
                        <div className="text-[11px] text-slate-500 font-mono">NIK: {student?.nik}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase inline-block ${
                            app.pathway === 'zonasi'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : app.pathway === 'afirmasi'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : app.pathway === 'prestasi'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {app.pathway}
                        </span>
                        {app.pathway === 'prestasi' && app.achievement_name && (
                          <div className="text-[10px] text-amber-800 truncate max-w-[130px] mt-0.5" title={app.achievement_name}>
                            🏆 {app.achievement_name}
                          </div>
                        )}
                        {app.pathway === 'mutasi' && app.mutation_parent_instansi && (
                          <div className="text-[10px] text-blue-800 truncate max-w-[130px] mt-0.5" title={app.mutation_parent_instansi}>
                            🏢 {app.mutation_parent_instansi}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setInitialVerificationTab('location');
                            setSelectedAppForVerification(app);
                          }}
                          className="inline-flex items-center gap-1.5 hover:text-emerald-700 hover:underline cursor-pointer group"
                          title="Lihat Peta Titik Rumah Pendaftar Ini"
                        >
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
                          <span>{formatDistanceIndonesian(app.distance_km)}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                            isZonasiCompliant ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {isZonasiCompliant ? '✓ Memenuhi' : '✕ Luar Radius'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">{getVerificationBadge(app.verification_status)}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            app.final_status === 'lulus'
                              ? 'bg-emerald-100 text-emerald-800'
                              : app.final_status === 'tidak_lulus'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {app.final_status ? app.final_status.replace('_', ' ') : 'proses'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setInitialVerificationTab('location');
                              setSelectedAppForVerification(app);
                            }}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg"
                            title="Buka Peta Zonasi Pendaftar Ini"
                          >
                            <MapPin className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setInitialVerificationTab('profile');
                              setSelectedAppForVerification(app);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                            title="Periksa & Verifikasi Berkas"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setInitialVerificationTab('docs');
                              setSelectedAppForVerification(app);
                            }}
                            className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg"
                            title="Buka & Unduh Berkas Persyaratan Pendaftar"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setResetPasswordApp(app)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg"
                            title="Reset Password Akun Murid Ini"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {onViewPrint && (
                            <button
                              type="button"
                              onClick={() => onViewPrint(app.registration_number)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg cursor-pointer"
                              title="Cetak Bukti Pendaftaran"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}

                          {onDeleteApplicant && (
                            <button
                              type="button"
                              onClick={() => setAppToDelete(app)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer"
                              title="Hapus Data Pendaftar Ini Permanen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Stats */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div>
            Menampilkan <strong>{filteredApps.length}</strong> dari <strong>{applications.length}</strong> total pendaftar
          </div>
        </div>
      </div>

      {/* Export Excel (.xlsx) Filtered Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Unduh Data Lengkap Excel (.xlsx)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Format spreadsheet resmi Microsoft Excel yang rapi & terstruktur (Bukan CSV)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Filter selection options */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-700 block">
                Pilih Cakupan Data Pendaftar:
              </label>

              {/* Option 1: Khusus Siswa Lolos */}
              <div
                onClick={() => setExportChoice('lulus')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                  exportChoice === 'lulus'
                    ? 'border-emerald-500 bg-emerald-50/60 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="exportChoice"
                  checked={exportChoice === 'lulus'}
                  onChange={() => setExportChoice('lulus')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Khusus Siswa yang Lolos (Diterima)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono">
                      {countLulus} Siswa
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Hanya mengunduh berkas dan data pendaftar yang status akhirnya <strong>LULUS SELEKSI</strong> untuk kebutuhan daftar ulang & arsip siswa baru.
                  </p>
                </div>
              </div>

              {/* Option 2: Seluruh Pendaftar */}
              <div
                onClick={() => setExportChoice('all')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                  exportChoice === 'all'
                    ? 'border-emerald-500 bg-emerald-50/60 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="exportChoice"
                  checked={exportChoice === 'all'}
                  onChange={() => setExportChoice('all')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Seluruh Pendaftar Madrasah
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                      {countTotal} Siswa
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Mengunduh seluruh calon murid (status lolos, tidak lolos, maupun masih dalam proses verifikasi) lengkap dengan statistik.
                  </p>
                </div>
              </div>

              {/* Option 3: Filter Tampilan Tabel */}
              <div
                onClick={() => setExportChoice('filtered')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                  exportChoice === 'filtered'
                    ? 'border-emerald-500 bg-emerald-50/60 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="exportChoice"
                  checked={exportChoice === 'filtered'}
                  onChange={() => setExportChoice('filtered')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Sesuai Filter Tabel Saat Ini
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono">
                      {filteredApps.length} Siswa
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Mengunduh data pendaftar yang sedang tampil berdasarkan filter pencarian, jalur, atau status verifikasi aktif.
                  </p>
                </div>
              </div>
            </div>

            {/* Information Notice */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-600 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Format Standar Resmi Excel (.xlsx)</span>
              </div>
              <p className="text-slate-500 text-[10px] leading-relaxed">
                Menyertakan 50+ data kolom lengkap (Biodata Siswa, NIK, NISN, Orang Tua/Wali, Sekolah Asal, Titik Zonasi, Jalur & Nilai Skor, Status Verifikasi, Hasil Seleksi) beserta Lembar Rekapitulasi Statistik.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (exportChoice === 'lulus') {
                    handleExportPassed();
                  } else if (exportChoice === 'all') {
                    handleExportAll();
                  } else {
                    handleExportCurrent();
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Unduh File Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {appToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Hapus Data Pendaftar?
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Anda akan menghapus data pendaftaran <strong>{students[appToDelete.registration_number]?.name || appToDelete.registration_number}</strong> (No: {appToDelete.registration_number}).
              </p>
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                Data pendaftaran, data siswa, berkas lampiran, dan akun pengguna akan <strong>dihapus permanen</strong> dari aplikasi dan <strong>langsung disinkronkan ke Google Sheets</strong> secara otomatis.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAppToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteApplicant && appToDelete) {
                    onDeleteApplicant(appToDelete.registration_number);
                  }
                  setAppToDelete(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordApp && (
        <ResetPasswordModal
          registrationNumber={resetPasswordApp.registration_number}
          student={students[resetPasswordApp.registration_number]}
          onClose={() => setResetPasswordApp(null)}
        />
      )}

      {/* Verification Modal */}
      {selectedAppForVerification && (
        <VerificationModal
          application={selectedAppForVerification}
          student={students[selectedAppForVerification.registration_number]}
          parent={parents[selectedAppForVerification.registration_number]}
          schoolOrigin={schoolOrigins[selectedAppForVerification.registration_number]}
          address={addresses[selectedAppForVerification.registration_number]}
          documents={documents.filter((d) => d.registration_number === selectedAppForVerification.registration_number)}
          school={school}
          initialTab={initialVerificationTab}
          onClose={() => setSelectedAppForVerification(null)}
          onVerify={(status, notes) => {
            onVerify(selectedAppForVerification.registration_number, status, notes);
          }}
        />
      )}
    </div>
  );
};
