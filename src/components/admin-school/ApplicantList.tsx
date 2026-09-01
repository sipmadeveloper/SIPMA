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
  const [sortBy, setSortBy] = useState<'distance' | 'name' | 'date'>('distance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [selectedAppForVerification, setSelectedAppForVerification] = useState<Application | null>(null);
  const [initialVerificationTab, setInitialVerificationTab] = useState<'profile' | 'location' | 'docs'>('profile');
  const [resetPasswordApp, setResetPasswordApp] = useState<Application | null>(null);
  const [appToDelete, setAppToDelete] = useState<Application | null>(null);

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

        return matchQuery && matchPathway && matchVerification;
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
  }, [applications, students, searchQuery, pathwayFilter, verificationFilter, sortBy, sortOrder]);

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

          {/* Export Excel button */}
          <button
            type="button"
            onClick={() => {
              if (onExportExcel) {
                onExportExcel();
              } else if (onExportCsv) {
                onExportCsv();
              } else {
                exportApplicantsToExcel(
                  applications,
                  students,
                  parents,
                  schoolOrigins,
                  addresses,
                  [school],
                  { schoolName: school.school_name }
                );
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
            title="Unduh data pendaftar dalam format spreadsheet Excel (.xlsx) yang rapi"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
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
