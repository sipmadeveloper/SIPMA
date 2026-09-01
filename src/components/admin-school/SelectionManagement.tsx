import React, { useState } from 'react';
import {
  Award,
  CheckCircle,
  XCircle,
  RotateCcw,
  ArrowUpDown,
  Filter,
  Users,
  Compass,
  MapPin,
  Play,
  FileSpreadsheet,
} from 'lucide-react';
import { Application, StudentProfile, School, SchoolOrigin } from '../../types/sipma';
import { formatDistanceIndonesian } from '../../utils/geo';
import { exportSelectionResultsToExcel } from '../../utils/excelExport';
import { useFeedback } from '../../context/FeedbackContext';

interface Props {
  school: School;
  applications: Application[];
  students: Record<string, StudentProfile>;
  schoolOrigins?: Record<string, SchoolOrigin>;
  onUpdateStatus: (regNumber: string, status: 'lulus' | 'tidak_lulus' | 'menunggu') => void;
  onBulkUpdate: (updates: { regNumber: string; status: 'lulus' | 'tidak_lulus' }[]) => void;
}

export const SelectionManagement: React.FC<Props> = ({
  school,
  applications,
  students,
  schoolOrigins = {},
  onUpdateStatus,
  onBulkUpdate,
}) => {
  const { showConfirm, showToast } = useFeedback();
  const safeSchool: School = school || {
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
    quota_percentage_zonasi: 50,
    quota_percentage_afirmasi: 20,
    quota_percentage_prestasi: 20,
    quota_percentage_mutasi: 10,
  };

  const [selectedPathway, setSelectedPathway] = useState<'zonasi' | 'afirmasi' | 'prestasi' | 'mutasi'>('zonasi');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Filter verified applications in selected pathway
  const pathwayApps = applications
    .filter((a) => a.pathway === selectedPathway)
    .sort((a, b) => {
      if (selectedPathway === 'zonasi') {
        // Zonasi: sorted by distance ascending (closest first)
        return a.distance_km - b.distance_km;
      }
      if (selectedPathway === 'prestasi') {
        // Prestasi: sorted by score or achievement
        return (b.score || 0) - (a.score || 0) || a.distance_km - b.distance_km;
      }
      if (selectedPathway === 'mutasi') {
        // Mutasi: sorted by distance
        return a.distance_km - b.distance_km;
      }
      // Afirmasi: sorted by distance or score
      return (b.score || 0) - (a.score || 0) || a.distance_km - b.distance_km;
    });

  const quota =
    selectedPathway === 'zonasi'
      ? safeSchool.quota_zonasi
      : selectedPathway === 'afirmasi'
      ? safeSchool.quota_afirmasi
      : selectedPathway === 'prestasi'
      ? safeSchool.quota_prestasi || 40
      : safeSchool.quota_mutasi || 20;

  const totalLulus = pathwayApps.filter((a) => a.selection_status === 'lulus').length;
  const totalTidakLulus = pathwayApps.filter((a) => a.selection_status === 'tidak_lulus').length;

  // Process auto-selection according to quota
  const handleProcessAutoSelection = () => {
    showConfirm(
      'Jalankan Seleksi Otomatis',
      `Jalankan proses seleksi otomatis untuk ${selectedPathway.toUpperCase()} berdasarkan kuota (${quota} kuota) & pemeringkatan verifikasi?`,
      () => {
        setIsProcessing(true);
        setTimeout(() => {
          const updates: { regNumber: string; status: 'lulus' | 'tidak_lulus' }[] = [];

          pathwayApps.forEach((app, idx) => {
            // Must be verified and within zonasi for zonasi pathway
            const isEligible =
              app.verification_status === 'terverifikasi' &&
              (selectedPathway !== 'zonasi' || app.zoning_status === 'memenuhi');
            if (isEligible && idx < quota) {
              updates.push({ regNumber: app.registration_number, status: 'lulus' });
            } else {
              updates.push({ regNumber: app.registration_number, status: 'tidak_lulus' });
            }
          });

          onBulkUpdate(updates);
          setIsProcessing(false);
          showToast(`Seleksi otomatis jalur ${selectedPathway.toUpperCase()} selesai diproses`, 'success');
        }, 600);
      },
      {
        confirmLabel: 'Ya, Jalankan Seleksi',
      }
    );
  };

  const handleResetSelection = () => {
    showConfirm(
      'Reset Hasil Seleksi',
      `Apakah Anda yakin ingin mereset seluruh status hasil seleksi pada jalur ${selectedPathway.toUpperCase()} menjadi Menunggu?`,
      () => {
        pathwayApps.forEach((a) => onUpdateStatus(a.registration_number, 'menunggu'));
        showToast(`Hasil seleksi jalur ${selectedPathway.toUpperCase()} telah direset`, 'info');
      },
      {
        type: 'warning',
        confirmLabel: 'Ya, Reset Status',
      }
    );
  };

  return (
    <div className="space-y-6" id="sipma-selection-management">
      {/* Top Banner & Pathway Tab Switcher */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Manajemen Seleksi & Pemeringkatan Calon Murid
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-0.5">{safeSchool.school_name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sistem otomatis melimpahkan berkas calon murid yang <strong>Tidak Lulus</strong> ke madrasah alternatif terdekat dengan kuota kosong.
          </p>
        </div>

        {/* Pathway Pills - 4 Pathways */}
        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold gap-1">
          <button
            type="button"
            onClick={() => setSelectedPathway('zonasi')}
            className={`px-3 py-2 rounded-lg transition-all ${
              selectedPathway === 'zonasi'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Zonasi ({school.quota_zonasi})
          </button>
          <button
            type="button"
            onClick={() => setSelectedPathway('afirmasi')}
            className={`px-3 py-2 rounded-lg transition-all ${
              selectedPathway === 'afirmasi'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Afirmasi ({school.quota_afirmasi})
          </button>
          <button
            type="button"
            onClick={() => setSelectedPathway('prestasi')}
            className={`px-3 py-2 rounded-lg transition-all ${
              selectedPathway === 'prestasi'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Prestasi ({school.quota_prestasi || 40})
          </button>
          <button
            type="button"
            onClick={() => setSelectedPathway('mutasi')}
            className={`px-3 py-2 rounded-lg transition-all ${
              selectedPathway === 'mutasi'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mutasi ({school.quota_mutasi || 20})
          </button>
        </div>
      </div>

      {/* Quota & Status KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">Total Pendaftar Jalur</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{pathwayApps.length}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">Daya Tampung / Kuota</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{quota} Murid</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">Dinyatakan Lulus</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{totalLulus}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">Tidak Lulus / Cadangan</div>
          <div className="text-2xl font-black text-rose-600 mt-1">{totalTidakLulus}</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="text-xs text-slate-600">
          Pemeringkatan otomatis dihitung berdasarkan{' '}
          <strong>
            {selectedPathway === 'zonasi'
              ? 'Jarak Terdekat ke Madrasah'
              : selectedPathway === 'prestasi'
              ? 'Portofolio Prestasi & Nilai Bobot Kejuaraan'
              : selectedPathway === 'mutasi'
              ? 'Validitas Surat Tugas/SK Mutasi & Jarak'
              : 'Kriteria Afirmasi & Verifikasi'}
          </strong>.
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportSelectionResultsToExcel(school, selectedPathway, pathwayApps, students, schoolOrigins)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title="Unduh hasil seleksi dan pemeringkatan jalur ini ke format Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleResetSelection}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Hasil</span>
          </button>

          <button
            type="button"
            onClick={handleProcessAutoSelection}
            disabled={isProcessing || pathwayApps.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isProcessing ? 'Memproses...' : 'Proses Seleksi Otomatis'}</span>
          </button>
        </div>
      </div>

      {/* Ranking Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">Rank</th>
                <th className="py-3.5 px-4">No. Pendaftaran</th>
                <th className="py-3.5 px-4">Nama Calon Murid</th>
                <th className="py-3.5 px-4">Keterangan Jalur</th>
                <th className="py-3.5 px-4">Jarak / Nilai</th>
                <th className="py-3.5 px-4">Status Verifikasi</th>
                <th className="py-3.5 px-4">Status Kelulusan</th>
                <th className="py-3.5 px-4 text-center">Ubah Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pathwayApps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Belum ada pendaftar pada {selectedPathway.toUpperCase()}.
                  </td>
                </tr>
              ) : (
                pathwayApps.map((app, idx) => {
                  const student = students[app.registration_number];
                  const rank = idx + 1;
                  const isWithinQuota = rank <= quota;

                  return (
                    <tr
                      key={app.application_id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        app.selection_status === 'lulus'
                          ? 'bg-emerald-50/30'
                          : app.selection_status === 'tidak_lulus'
                          ? 'bg-rose-50/20'
                          : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center font-mono font-bold">
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs ${
                            isWithinQuota
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {rank}
                        </span>
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
                        {selectedPathway === 'prestasi' && (
                          <div className="text-amber-900">
                            <span className="font-semibold">{app.achievement_name || 'Prestasi Akademik'}</span>
                            <span className="text-[10px] block text-amber-700">Tingkat {app.achievement_level} ({app.achievement_rank})</span>
                          </div>
                        )}
                        {selectedPathway === 'mutasi' && (
                          <div className="text-blue-900">
                            <span className="font-semibold">{app.mutation_parent_instansi || 'SK Penugasan'}</span>
                            <span className="text-[10px] block text-blue-700">No: {app.mutation_letter_number || '-'}</span>
                          </div>
                        )}
                        {selectedPathway === 'zonasi' && (
                          <span className="text-slate-600 font-medium">Jalur Domisili Zonasi</span>
                        )}
                        {selectedPathway === 'afirmasi' && (
                          <span className="text-purple-700 font-medium">Keluarga Ekonomi Tidak Mampu</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        <div>{formatDistanceIndonesian(app.distance_km)}</div>
                        {app.score ? <div className="text-[10px] text-emerald-700">Nilai: {app.score}</div> : null}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            app.verification_status === 'terverifikasi'
                              ? 'bg-emerald-100 text-emerald-800'
                              : app.verification_status === 'perlu_perbaikan'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {app.verification_status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                            app.selection_status === 'lulus'
                              ? 'bg-emerald-600 text-white'
                              : app.selection_status === 'tidak_lulus'
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {app.selection_status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(app.registration_number, 'lulus')}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors"
                            title="Set Lulus"
                          >
                            Lulus
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(app.registration_number, 'tidak_lulus')}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors"
                            title="Set Tidak Lulus"
                          >
                            Tidak Lulus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
