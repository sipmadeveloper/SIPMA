import React, { useState, useRef, useEffect } from 'react';
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
  ArrowDown,
  ChevronDown,
} from 'lucide-react';
import { Application, StudentProfile, School, SchoolOrigin, ParentData, AddressData } from '../../types/sipma';
import { formatDistanceIndonesian, checkZoningCompliance } from '../../utils/geo';
import { exportSelectionResultsToExcel } from '../../utils/excelExport';
import { useFeedback } from '../../context/FeedbackContext';
import { storageService } from '../../services/storageService';
import { ApplicantLocationModal } from './ApplicantLocationModal';
import { ApplicantDetailModal } from './ApplicantDetailModal';
import { Eye } from 'lucide-react';

interface Props {
  school: School;
  applications: Application[];
  students: Record<string, StudentProfile>;
  schoolOrigins?: Record<string, SchoolOrigin>;
  parents?: Record<string, ParentData>;
  addresses?: Record<string, AddressData>;
  onUpdateStatus: (regNumber: string, status: 'lulus' | 'tidak_lulus' | 'menunggu') => void;
  onBulkUpdate: (updates: { regNumber: string; status: 'lulus' | 'tidak_lulus' }[]) => void;
}

export const SelectionManagement: React.FC<Props> = ({
  school,
  applications,
  students,
  schoolOrigins = {},
  parents = {},
  addresses = {},
  onUpdateStatus,
  onBulkUpdate,
}) => {
  const { showConfirm, showToast } = useFeedback();
  const [selectedAppForDetail, setSelectedAppForDetail] = useState<Application | null>(null);
  const [selectedAppForLocation, setSelectedAppForLocation] = useState<Application | null>(null);
  const safeSchool: School = school || storageService.getSchools()[0] || {
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
    quota_percentage_zonasi: 50,
    quota_percentage_afirmasi: 20,
    quota_percentage_prestasi: 20,
    quota_percentage_mutasi: 10,
  };

  const [selectedPathway, setSelectedPathway] = useState<'zonasi' | 'afirmasi' | 'prestasi' | 'mutasi'>('zonasi');
  const [statusFilter, setStatusFilter] = useState<'all' | 'lulus' | 'tidak_lulus' | 'menunggu'>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState<boolean>(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Close filter dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Filtered by status (all / lulus / tidak_lulus / menunggu)
  const displayedApps = pathwayApps.filter((a) => {
    if (statusFilter === 'all') return true;
    return a.selection_status === statusFilter;
  });

  // Count applicants per pathway
  const countZonasi = applications.filter((a) => a.pathway === 'zonasi').length;
  const countAfirmasi = applications.filter((a) => a.pathway === 'afirmasi').length;
  const countPrestasi = applications.filter((a) => a.pathway === 'prestasi').length;
  const countMutasi = applications.filter((a) => a.pathway === 'mutasi').length;

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
            const isZoningCompliant = checkZoningCompliance(app.distance_km, school.zoning_radius_km || app.max_distance_km) && app.zoning_status === 'memenuhi';
            // Must be verified and within zonasi for zonasi pathway
            const isEligible =
              app.verification_status === 'terverifikasi' &&
              (selectedPathway !== 'zonasi' || isZoningCompliant);
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

        {/* Single Filter Dropdown Box */}
        <div className="relative shrink-0 w-full sm:w-auto" ref={filterDropdownRef}>
          <button
            type="button"
            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
            className={`w-full sm:w-auto inline-flex items-center justify-between gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 border rounded-xl shadow-2xs text-xs font-bold transition-all cursor-pointer ${
              isFilterDropdownOpen
                ? 'border-emerald-600 ring-2 ring-emerald-500/20 text-emerald-950'
                : 'border-slate-300 text-slate-800'
            }`}
            title="Klik untuk membuka pilihan filter seleksi"
            aria-expanded={isFilterDropdownOpen}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0">
                <Filter className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Filter Seleksi</div>
                <div className="text-xs font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                  <span>Jalur {selectedPathway.toUpperCase()}</span>
                  <span className="text-emerald-700 font-semibold">({quota} Kuota)</span>
                  {statusFilter !== 'all' && (
                    <span className="text-[10px] bg-slate-900 text-white px-1.5 py-0.2 rounded font-mono font-bold uppercase">
                      {statusFilter.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isFilterDropdownOpen ? 'rotate-180 text-emerald-600' : ''}`} />
          </button>

          {/* Filter Options Popover Dropdown */}
          {isFilterDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 shadow-xl rounded-2xl p-3 z-30 space-y-3">
              {/* Header inside popover */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Pilihan Filter Seleksi</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterDropdownOpen(false)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  Tutup ✕
                </button>
              </div>

              {/* Section 1: Pilihan Jalur Pendaftaran */}
              <div className="space-y-1.5">
                <div className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                  1. Pilih Jalur Pendaftaran:
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {[
                    { id: 'zonasi', name: 'Jalur Zonasi', quota: safeSchool.quota_zonasi, count: countZonasi, desc: 'Pemeringkatan jarak koordinat rumah ke madrasah' },
                    { id: 'afirmasi', name: 'Jalur Afirmasi', quota: safeSchool.quota_afirmasi, count: countAfirmasi, desc: 'Siswa prasejahtera KIP/PKH & afirmasi khusus' },
                    { id: 'prestasi', name: 'Jalur Prestasi', quota: safeSchool.quota_prestasi || 40, count: countPrestasi, desc: 'Bobot nilai rapor & sertifikat prestasi' },
                    { id: 'mutasi', name: 'Jalur Mutasi', quota: safeSchool.quota_mutasi || 20, count: countMutasi, desc: 'Perpindahan tugas instansi/orang tua' },
                  ].map((p) => {
                    const isSelected = selectedPathway === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPathway(p.id as any);
                          setIsFilterDropdownOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50/90 border-emerald-500 shadow-2xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-black ${isSelected ? 'text-emerald-950' : 'text-slate-900'}`}>{p.name}</span>
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                              Kuota: {p.quota}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-slate-500 leading-tight">{p.desc}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-[10.5px] font-bold text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                            {p.count} Murid
                          </span>
                          {isSelected && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Pilihan Status Kelulusan */}
              <div className="space-y-1.5 border-t border-slate-100 pt-2">
                <div className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                  2. Saring Status Hasil:
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: 'all', label: 'Semua' },
                    { id: 'lulus', label: 'Lulus' },
                    { id: 'tidak_lulus', label: 'Tdk Lulus' },
                    { id: 'menunggu', label: 'Menunggu' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setStatusFilter(s.id as any);
                        setIsFilterDropdownOpen(false);
                      }}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all text-center cursor-pointer border ${
                        statusFilter === s.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quota & Status KPIs - Kotak Kecil Rapi 1 Baris Menyamping */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 overflow-x-auto">
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs text-center flex flex-col justify-center min-w-[75px]">
          <div className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">Pendaftar</div>
          <div className="text-base sm:text-xl font-black text-slate-900 leading-tight my-0.5">{pathwayApps.length}</div>
          <div className="text-[8px] sm:text-[9px] text-slate-400 font-medium truncate">Total Berkas</div>
        </div>

        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs text-center flex flex-col justify-center min-w-[75px]">
          <div className="text-[9px] sm:text-[10px] text-emerald-800 font-bold uppercase tracking-wider truncate">Kuota</div>
          <div className="text-base sm:text-xl font-black text-emerald-700 leading-tight my-0.5">{quota}</div>
          <div className="text-[8px] sm:text-[9px] text-emerald-600 font-medium truncate">Daya Tampung</div>
        </div>

        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs text-center flex flex-col justify-center min-w-[75px]">
          <div className="text-[9px] sm:text-[10px] text-emerald-800 font-bold uppercase tracking-wider truncate">Lulus</div>
          <div className="text-base sm:text-xl font-black text-emerald-600 leading-tight my-0.5">{totalLulus}</div>
          <div className="text-[8px] sm:text-[9px] text-emerald-600 font-medium truncate">Diterima</div>
        </div>

        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs text-center flex flex-col justify-center min-w-[75px]">
          <div className="text-[9px] sm:text-[10px] text-rose-800 font-bold uppercase tracking-wider truncate">Tidak Lulus</div>
          <div className="text-base sm:text-xl font-black text-rose-600 leading-tight my-0.5">{totalTidakLulus}</div>
          <div className="text-[8px] sm:text-[9px] text-rose-500 font-medium truncate">Cadangan/Dilimpah</div>
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
          {/* Tombol Aksi Unduh Excel: Cukup Gambar Icon File Excel Hijau dengan Tanda Panah Kebawah Tanpa Tulisan */}
          <button
            type="button"
            onClick={() => exportSelectionResultsToExcel(school, selectedPathway, pathwayApps, students, schoolOrigins)}
            className="inline-flex items-center justify-center w-8.5 h-8.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-700 transition-all shadow-2xs cursor-pointer shrink-0 active:scale-95"
            title="Unduh hasil seleksi dan pemeringkatan jalur ini ke format Excel (.xlsx)"
            aria-label="Unduh File Excel"
          >
            <span className="relative inline-flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <ArrowDown className="w-2.5 h-2.5 text-emerald-700 absolute -bottom-1 -right-1 bg-white rounded-full ring-1 ring-emerald-500 stroke-[3]" />
            </span>
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
                <th className="py-3.5 px-4 text-center whitespace-nowrap min-w-[190px]">Ubah Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedApps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    {statusFilter === 'all'
                      ? `Belum ada pendaftar pada Jalur ${selectedPathway.toUpperCase()}.`
                      : `Tidak ada pendaftar dengan status "${statusFilter.replace('_', ' ')}" pada Jalur ${selectedPathway.toUpperCase()}.`}
                  </td>
                </tr>
              ) : (
                displayedApps.map((app, idx) => {
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
                        <button
                          type="button"
                          onClick={() => setSelectedAppForDetail(app)}
                          className="font-bold text-slate-900 hover:text-emerald-700 hover:underline cursor-pointer text-left block"
                          title="Klik untuk melihat Detail Lengkap Murid (Terpisah)"
                        >
                          {student?.name || '-'}
                        </button>
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
                        <button
                          type="button"
                          onClick={() => setSelectedAppForLocation(app)}
                          className="inline-flex items-center gap-1.5 hover:text-emerald-700 hover:underline cursor-pointer group"
                          title="Lihat Peta Titik Rumah & Zonasi (Terpisah)"
                        >
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
                          <span>{formatDistanceIndonesian(app.distance_km)}</span>
                        </button>
                        {selectedPathway === 'zonasi' && (
                          <span
                            className={`inline-block text-[10px] font-bold mt-0.5 px-1.5 py-0.2 rounded ${
                              checkZoningCompliance(app.distance_km, school.zoning_radius_km || app.max_distance_km) && app.zoning_status === 'memenuhi'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {checkZoningCompliance(app.distance_km, school.zoning_radius_km || app.max_distance_km) && app.zoning_status === 'memenuhi'
                              ? '✓ Dalam Zona'
                              : '✕ Luar Zona'}
                          </span>
                        )}
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
                      <td className="py-3.5 px-4 text-center whitespace-nowrap min-w-[210px]">
                        <div className="inline-flex items-center justify-center gap-1.5 shrink-0">
                          {/* 1. Set Lulus */}
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(app.registration_number, 'lulus')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
                            title="Set Lulus Murid Ini"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Lulus</span>
                          </button>

                          {/* 2. Set Tidak Lulus */}
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(app.registration_number, 'tidak_lulus')}
                            className="inline-flex items-center gap-1 px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer active:scale-95"
                            title="Set Tidak Lulus Murid Ini"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Tdk Lulus</span>
                          </button>

                          {/* 3. Aksi Terpisah: Lihat Peta Zonasi */}
                          <button
                            type="button"
                            onClick={() => setSelectedAppForLocation(app)}
                            className="w-7.5 h-7.5 inline-flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg transition-all shadow-2xs shrink-0 cursor-pointer active:scale-95"
                            title="Buka Peta Lokasi Rumah & Zonasi (Terpisah)"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                          </button>

                          {/* 4. Aksi Terpisah: Lihat Detail Murid */}
                          <button
                            type="button"
                            onClick={() => setSelectedAppForDetail(app)}
                            className="w-7.5 h-7.5 inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg transition-all shadow-2xs shrink-0 cursor-pointer active:scale-95"
                            title="Lihat Detail Profil Calon Murid (Terpisah)"
                          >
                            <Eye className="w-3.5 h-3.5" />
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

      {/* Modal Terpisah: Peta Titik Rumah & Zonasi */}
      {selectedAppForLocation && (
        <ApplicantLocationModal
          application={selectedAppForLocation}
          student={students[selectedAppForLocation.registration_number]}
          school={school}
          address={addresses[selectedAppForLocation.registration_number]}
          onClose={() => setSelectedAppForLocation(null)}
        />
      )}

      {/* Modal Terpisah: Detail Profil Calon Murid */}
      {selectedAppForDetail && (
        <ApplicantDetailModal
          application={selectedAppForDetail}
          student={students[selectedAppForDetail.registration_number]}
          parent={parents[selectedAppForDetail.registration_number]}
          schoolOrigin={schoolOrigins[selectedAppForDetail.registration_number]}
          address={addresses[selectedAppForDetail.registration_number]}
          school={school}
          onClose={() => setSelectedAppForDetail(null)}
        />
      )}
    </div>
  );
};
