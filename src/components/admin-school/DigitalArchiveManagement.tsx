import React, { useState, useMemo, useRef } from 'react';
import {
  Archive,
  Search,
  Filter,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Eye,
  Download,
  Trash2,
  Grid,
  List,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Cloud,
  FileCheck,
  CheckSquare,
  FileSpreadsheet,
  X,
  Phone,
  MessageCircle,
  UserCheck,
  ShieldCheck,
  Sparkles,
  Info,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  FolderCheck,
  HelpCircle,
} from 'lucide-react';
import {
  School,
  Application,
  StudentProfile,
  ParentData,
  DocumentItem,
  VerificationStatus,
  User as UserType,
} from '../../types/sipma';
import { storageService } from '../../services/storageService';
import { useFeedback } from '../../context/FeedbackContext';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { downloadDocumentFile } from '../../utils/fileDownload';

interface Props {
  school: School;
  applications: Application[];
  students: Record<string, StudentProfile>;
  parents?: Record<string, ParentData>;
  documents: DocumentItem[];
  currentUser?: UserType | null;
  onRefreshData?: () => void;
}

type MainViewTab = 'detection' | 'files_gallery';
type CategoryFilter = 'all' | 'kartu_keluarga' | 'akta_kelahiran' | 'ijazah_skl' | 'pas_foto' | 'pendukung';
type CompletenessFilter = 'all' | 'complete' | 'incomplete' | 'empty';

export const DigitalArchiveManagement: React.FC<Props> = ({
  school,
  applications,
  students,
  parents = {},
  documents,
  currentUser,
  onRefreshData,
}) => {
  const { showAlert } = useFeedback();

  // Navigation View Tab: "Deteksi Kelengkapan" vs "Daftar Berkas Terarsip"
  const [activeMainTab, setActiveMainTab] = useState<MainViewTab>('detection');

  // Filters for Academic Year Archives
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('all');
  const systemSettings = useMemo(() => storageService.getSettings(), []);

  // Filters for Detection Matrix
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilter>('all');
  const [pathwayFilter, setPathwayFilter] = useState<string>('all');
  const [searchStudentQuery, setSearchStudentQuery] = useState<string>('');

  // Filters for Files Gallery
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchFileQuery, setSearchFileQuery] = useState<string>('');
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('all');
  const [cloudStatusFilter, setCloudStatusFilter] = useState<'all' | 'drive' | 'local'>('all');
  const [verifyFilter, setVerifyFilter] = useState<'all' | VerificationStatus>('all');
  const [galleryViewMode, setGalleryViewMode] = useState<'grid' | 'table'>('grid');

  // Modal States
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [studentDetailModal, setStudentDetailModal] = useState<Application | null>(null);

  // All School Applicants
  const allSchoolApps = useMemo(() => {
    return applications.filter((a) => a.school_id === school.school_id);
  }, [applications, school.school_id]);

  // Compute all available academic years from settings, applications, and documents
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    const currentLabel =
      systemSettings.academic_year_label ||
      `${systemSettings.application_year || '2026'}/${(parseInt(systemSettings.application_year || '2026', 10) || 2026) + 1}`;
    if (currentLabel) set.add(currentLabel);
    if (systemSettings.application_year) set.add(systemSettings.application_year);

    allSchoolApps.forEach((a) => {
      if (a.admission_year) set.add(a.admission_year);
    });
    documents.forEach((d) => {
      if ((d as any).academic_year) set.add((d as any).academic_year);
    });

    return Array.from(set).filter(Boolean).sort().reverse();
  }, [allSchoolApps, documents, systemSettings]);

  // School Specific Applicants (Filtered by Selected Academic Year if active)
  const schoolApps = useMemo(() => {
    if (selectedYearFilter === 'all') return allSchoolApps;
    return allSchoolApps.filter((a) => {
      const yr = a.admission_year || systemSettings.academic_year_label || systemSettings.application_year;
      return yr === selectedYearFilter || String(yr).includes(selectedYearFilter);
    });
  }, [allSchoolApps, selectedYearFilter, systemSettings]);

  const schoolRegNumbers = useMemo(() => {
    return new Set(schoolApps.map((a) => a.registration_number));
  }, [schoolApps]);

  // Documents belonging to this school's applicants (preserving archives across years)
  const schoolDocuments = useMemo(() => {
    return documents.filter((d) => {
      if (!schoolRegNumbers.has(d.registration_number)) return false;
      if (selectedYearFilter === 'all') return true;
      const docYr = (d as any).academic_year;
      if (docYr) return docYr === selectedYearFilter || String(docYr).includes(selectedYearFilter);
      return true;
    });
  }, [documents, schoolRegNumbers, selectedYearFilter]);

  // Normalize document type for grouping
  const normalizeDocTypeKey = (docType: string): string => {
    const t = String(docType || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    if (t === 'kk' || t === 'kartu_keluarga') return 'kartu_keluarga';
    if (t === 'akta' || t === 'akta_kelahiran' || t === 'akta_lahir') return 'akta_kelahiran';
    if (t === 'ijazah' || t === 'skl' || t === 'ijazah_skl') return 'ijazah_skl';
    if (t === 'foto' || t === 'pas_foto' || t === 'pas_foto_3x4') return 'pas_foto';
    if (t === 'kip' || t === 'pkh' || t === 'kks' || t === 'kartu_afirmasi' || t === 'afirmasi') return 'kartu_afirmasi';
    if (t === 'prestasi' || t === 'sertifikat' || t === 'sertifikat_prestasi' || t === 'piagam') return 'sertifikat_prestasi';
    if (t === 'mutasi' || t === 'surat_mutasi') return 'surat_mutasi';
    return t;
  };

  const getDocCategory = (docType: string): CategoryFilter => {
    const key = normalizeDocTypeKey(docType);
    if (key === 'kartu_keluarga') return 'kartu_keluarga';
    if (key === 'akta_kelahiran') return 'akta_kelahiran';
    if (key === 'ijazah_skl') return 'ijazah_skl';
    if (key === 'pas_foto') return 'pas_foto';
    return 'pendukung';
  };

  // =========================================================================
  // DETEKSI KELENGKAPAN DOKUMEN PER MURID
  // =========================================================================
  const studentDetectionList = useMemo(() => {
    return schoolApps.map((app) => {
      const student = students[app.registration_number];
      const parent = parents[app.student_id] || parents[app.registration_number];
      const studentDocs = schoolDocuments.filter((d) => d.registration_number === app.registration_number);

      // Dokumen Pokok Wajib
      const docKK = studentDocs.find((d) => normalizeDocTypeKey(d.document_type) === 'kartu_keluarga');
      const docAkta = studentDocs.find((d) => normalizeDocTypeKey(d.document_type) === 'akta_kelahiran');
      const docIjazah = studentDocs.find((d) => normalizeDocTypeKey(d.document_type) === 'ijazah_skl');
      const docFoto = studentDocs.find((d) => normalizeDocTypeKey(d.document_type) === 'pas_foto');

      // Dokumen Khusus Jalur
      const isAfirmasi = app.pathway === 'afirmasi';
      const isPrestasi = app.pathway === 'prestasi';
      const isMutasi = app.pathway === 'mutasi';

      const docAfirmasi = studentDocs.find((d) => normalizeDocTypeKey(d.document_type) === 'kartu_afirmasi');
      const docPrestasi = studentDocs.find((d) => normalizeDocTypeKey(d.document_type) === 'sertifikat_prestasi');
      const docMutasi = studentDocs.find((d) => normalizeDocTypeKey(d.document_type) === 'surat_mutasi');

      // Perhitungan Dokumen Wajib (KK, Akta, Ijazah)
      const missingCoreDocs: string[] = [];
      if (!docKK) missingCoreDocs.push('Kartu Keluarga (KK)');
      if (!docAkta) missingCoreDocs.push('Akta Kelahiran');
      if (!docIjazah) missingCoreDocs.push('Ijazah / SKL');

      // Tambahkan berkas jalur jika ada
      const missingPathwayDocs: string[] = [];
      if (isAfirmasi && !docAfirmasi) missingPathwayDocs.push('Kartu KIP/PKH/KKS (Afirmasi)');
      if (isPrestasi && !docPrestasi) missingPathwayDocs.push('Sertifikat Piagam Prestasi');
      if (isMutasi && !docMutasi) missingPathwayDocs.push('Surat Tugas Pindah Orang Tua');

      const coreTotal = 3;
      const coreUploaded = (docKK ? 1 : 0) + (docAkta ? 1 : 0) + (docIjazah ? 1 : 0);

      const isComplete = missingCoreDocs.length === 0 && missingPathwayDocs.length === 0;
      const isEmpty = studentDocs.length === 0;

      // Best Phone Number for WhatsApp Reminder
      const targetPhone =
        student?.phone ||
        parent?.father_phone ||
        parent?.mother_phone ||
        parent?.guardian_phone ||
        '';

      return {
        app,
        student,
        parent,
        studentDocs,
        docKK,
        docAkta,
        docIjazah,
        docFoto,
        docAfirmasi,
        docPrestasi,
        docMutasi,
        coreTotal,
        coreUploaded,
        missingCoreDocs,
        missingPathwayDocs,
        allMissingDocs: [...missingCoreDocs, ...missingPathwayDocs],
        isComplete,
        isEmpty,
        targetPhone,
      };
    });
  }, [schoolApps, students, parents, schoolDocuments]);

  // KPI Deteksi Kelengkapan
  const detectionStats = useMemo(() => {
    const totalApplicants = studentDetectionList.length;
    let completeCount = 0;
    let incompleteCount = 0;
    let emptyCount = 0;
    let totalKK = 0;
    let totalAkta = 0;
    let totalIjazah = 0;

    for (const item of studentDetectionList) {
      if (item.isComplete) completeCount++;
      else if (item.isEmpty) emptyCount++;
      else incompleteCount++;

      if (item.docKK) totalKK++;
      if (item.docAkta) totalAkta++;
      if (item.docIjazah) totalIjazah++;
    }

    const percentage = totalApplicants > 0 ? Math.round((completeCount / totalApplicants) * 100) : 0;

    return {
      totalApplicants,
      completeCount,
      incompleteCount,
      emptyCount,
      totalKK,
      totalAkta,
      totalIjazah,
      percentage,
    };
  }, [studentDetectionList]);

  // Filtered Detection Matrix
  const filteredDetectionList = useMemo(() => {
    return studentDetectionList.filter((item) => {
      // Completeness Filter
      if (completenessFilter === 'complete' && !item.isComplete) return false;
      if (completenessFilter === 'incomplete' && (item.isComplete || item.isEmpty)) return false;
      if (completenessFilter === 'empty' && !item.isEmpty) return false;

      // Pathway Filter
      if (pathwayFilter !== 'all' && item.app.pathway !== pathwayFilter) return false;

      // Search Query
      if (searchStudentQuery.trim()) {
        const q = searchStudentQuery.toLowerCase().trim();
        const name = (item.student?.name || '').toLowerCase();
        const reg = item.app.registration_number.toLowerCase();
        const nisn = (item.student?.nisn || '').toLowerCase();
        return name.includes(q) || reg.includes(q) || nisn.includes(q);
      }

      return true;
    });
  }, [studentDetectionList, completenessFilter, pathwayFilter, searchStudentQuery]);

  // =========================================================================
  // GALERI BERKAS ARSIP FILTER
  // =========================================================================
  const filteredFiles = useMemo(() => {
    return schoolDocuments.filter((doc) => {
      // Category Filter
      if (activeCategory !== 'all') {
        const cat = getDocCategory(doc.document_type);
        if (cat !== activeCategory) return false;
      }

      // Student Filter
      if (selectedStudentFilter !== 'all' && doc.registration_number !== selectedStudentFilter) {
        return false;
      }

      // Cloud Status Filter
      const hasDrive = Boolean(doc.drive_file_id && doc.drive_file_id !== 'LOCAL_STORAGE' && doc.drive_url);
      if (cloudStatusFilter === 'drive' && !hasDrive) return false;
      if (cloudStatusFilter === 'local' && hasDrive) return false;

      // Verification Status Filter
      if (verifyFilter !== 'all' && doc.verification_status !== verifyFilter) {
        return false;
      }

      // Search Query
      if (searchFileQuery.trim()) {
        const q = searchFileQuery.toLowerCase().trim();
        const student = students[doc.registration_number];
        const studentName = (student?.name || '').toLowerCase();
        const reg = (doc.registration_number || '').toLowerCase();
        const fileName = (doc.file_name || '').toLowerCase();
        const title = (doc.document_title || '').toLowerCase();

        return studentName.includes(q) || reg.includes(q) || fileName.includes(q) || title.includes(q);
      }

      return true;
    });
  }, [
    schoolDocuments,
    activeCategory,
    selectedStudentFilter,
    cloudStatusFilter,
    verifyFilter,
    searchFileQuery,
    students,
  ]);

  // Export CSV of Completeness Detection
  const handleExportCompletenessCsv = () => {
    if (studentDetectionList.length === 0) {
      showAlert('Data Kosong', 'Belum ada data pendaftar untuk diekspor.', 'warning');
      return;
    }

    const headers = [
      'No',
      'No Pendaftaran',
      'Nama Calon Murid',
      'NISN',
      'Jalur',
      'Kartu Keluarga (KK)',
      'Akta Kelahiran (Akta)',
      'Ijazah / SKL',
      'Pas Foto 3x4',
      'Dokumen Khusus Jalur',
      'Status Kelengkapan',
      'Dokumen yang Kurang',
      'No HP Kontak',
    ];

    const rows = studentDetectionList.map((item, idx) => {
      return [
        idx + 1,
        `"${item.app.registration_number}"`,
        `"${item.student?.name || 'Calon Murid'}"`,
        `"${item.student?.nisn || '-'}"`,
        `"${item.app.pathway.toUpperCase()}"`,
        item.docKK ? '"TERSEDIA"' : '"BELUM DIUNGGAH"',
        item.docAkta ? '"TERSEDIA"' : '"BELUM DIUNGGAH"',
        item.docIjazah ? '"TERSEDIA"' : '"BELUM DIUNGGAH"',
        item.docFoto ? '"TERSEDIA"' : '"BELUM DIUNGGAH"',
        item.docAfirmasi || item.docPrestasi || item.docMutasi ? '"TERSEDIA"' : '"-"',
        item.isComplete ? '"LENGKAP"' : item.isEmpty ? '"BELUM ADA BERKAS"' : '"BELUM LENGKAP"',
        `"${item.allMissingDocs.join(', ') || 'Nihil'}"`,
        `"${item.targetPhone || '-'}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Rekap_Kelengkapan_Berkas_${school.school_name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showAlert('Unduh Berhasil', 'Rekap deteksi kelengkapan berkas berhasil diunduh.', 'success');
  };

  // Send WhatsApp Reminder
  const handleSendWhatsAppReminder = (item: (typeof studentDetectionList)[0]) => {
    let rawPhone = item.targetPhone.replace(/[^0-9]/g, '');
    if (!rawPhone) {
      showAlert('Nomor Tidak Ditemukan', 'Nomor telepon calon murid atau orang tua belum tercatat.', 'warning');
      return;
    }

    if (rawPhone.startsWith('0')) {
      rawPhone = '62' + rawPhone.slice(1);
    }

    const missingListText = item.allMissingDocs.map((d, i) => `${i + 1}. ${d}`).join('\n');
    const message = `Assalamu'alaikum Wr. Wb.

Yth. Orang Tua / Wali dari Ananda *${item.student?.name || 'Calon Murid'}*
Nomor Registrasi: *${item.app.registration_number}*
Jalur Pendaftaran: *${item.app.pathway.toUpperCase()}*

Panitia Penerimaan Murid Baru (PPDB) *${school.school_name}* menginformasikan bahwa berkas persyaratan pendaftaran ananda saat ini *BELUM LENGKAP*.

Dokumen yang belum diunggah:
${missingListText}

Mohon untuk segera mengunggah dokumen persyaratan asli melalui portal pendaftaran SIPMA agar proses verifikasi dan seleksi dapat segera diproses panitia.

Terima kasih atas kerja samanya.
_Panitia PPDB ${school.school_name}_`;

    const waUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" id="sipma-digital-archive">
      {/* ================= HEADER SECTION ================= */}
      <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 text-white p-6 rounded-2xl border border-teal-800/40 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <Archive className="w-3.5 h-3.5" />
            <span>Manajemen Arsip & Deteksi Kelengkapan Dokumen</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1.5">
            Arsip Dokumen & Deteksi Berkas — {school.school_name}
          </h2>
          <p className="text-xs text-teal-100/80 mt-1 max-w-2xl leading-relaxed">
            Berkas yang diunggah oleh pendaftar secara otomatis tersimpan rapi di Google Drive dan Google Sheets berdasarkan kategori (KK, Akta, Ijazah). Admin dapat memantau kelengkapan dokumen seluruh calon peserta didik di sini.
          </p>
        </div>

        <div className="flex items-center justify-end shrink-0">
          {/* Export Completeness Report */}
          <button
            type="button"
            onClick={handleExportCompletenessCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm hover:shadow-md"
            title="Unduh rekap inventaris kelengkapan berkas seluruh calon murid (CSV)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Export Rekap Kelengkapan</span>
          </button>
        </div>
      </div>

      {/* ================= ACADEMIC YEAR ARCHIVE SELECTOR ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-950/10 via-white to-teal-950/10 p-4 rounded-2xl border border-emerald-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-800 to-teal-700 text-white flex items-center justify-center shadow-xs shrink-0">
            <Archive className="w-5 h-5 text-emerald-100" />
          </div>
          <div>
            <div className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Arsip Dokumen Menurut Tahun Pendaftaran</span>
              {selectedYearFilter !== 'all' ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Tahun {selectedYearFilter}
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Semua Tahun
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Data & berkas pendaftar lolos seleksi tersimpan rapi di Google Drive & Sheets dan dapat dibuka/diakses kapan saja.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Filter Tahun:</span>
          <select
            value={selectedYearFilter}
            onChange={(e) => setSelectedYearFilter(e.target.value)}
            className="h-8.5 px-3 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500 shadow-2xs outline-none cursor-pointer"
          >
            <option value="all">Semua Tahun Pendaftaran ({allSchoolApps.length} Murid)</option>
            {availableYears.map((yr) => {
              const countInYr = allSchoolApps.filter((a) => {
                const y = a.admission_year || systemSettings.academic_year_label || systemSettings.application_year;
                return y === yr || String(y).includes(yr);
              }).length;
              const isCurrent = yr === (systemSettings.academic_year_label || systemSettings.application_year);
              return (
                <option key={yr} value={yr}>
                  Tahun Ajaran {yr} {isCurrent ? '(Tahun Aktif)' : '(Arsip Kelulusan)'} ({countInYr} Murid)
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {selectedYearFilter !== 'all' && (
        <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 px-4 py-3 rounded-xl text-xs text-blue-900 font-medium shadow-2xs">
          <div className="flex items-center gap-2">
            <FolderCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Menampilkan arsip dokumen pendaftaran tahun ajaran <strong>{selectedYearFilter}</strong>. Berkas pendaftar lolos seleksi tersimpan di Google Drive & Sheets dan siap diakses.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedYearFilter('all')}
            className="text-blue-700 hover:text-blue-950 font-bold underline shrink-0 cursor-pointer"
          >
            Tampilkan Semua Tahun
          </button>
        </div>
      )}

      {/* ================= KPI STATS CARDS ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {/* Total Applicants */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Pendaftar</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{detectionStats.totalApplicants}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Calon Murid Terdaftar</div>
        </div>

        {/* Complete (Lengkap) */}
        <div
          onClick={() => {
            setActiveMainTab('detection');
            setCompletenessFilter('complete');
          }}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
            activeMainTab === 'detection' && completenessFilter === 'complete'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300/40'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">Berkas Lengkap</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-1">{detectionStats.completeCount}</div>
          <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
            {detectionStats.percentage}% Dari Total Murid
          </div>
        </div>

        {/* Incomplete (Belum Lengkap) */}
        <div
          onClick={() => {
            setActiveMainTab('detection');
            setCompletenessFilter('incomplete');
          }}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
            activeMainTab === 'detection' && completenessFilter === 'incomplete'
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300/40'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">Belum Lengkap</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-950 mt-1">{detectionStats.incompleteCount}</div>
          <div className="text-[10px] text-amber-700 font-medium mt-0.5">Perlu Dilengkapi Murid</div>
        </div>

        {/* Empty (Belum Unggah) */}
        <div
          onClick={() => {
            setActiveMainTab('detection');
            setCompletenessFilter('empty');
          }}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
            activeMainTab === 'detection' && completenessFilter === 'empty'
              ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300/40'
              : 'bg-white border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider">Belum Unggah</span>
            <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-950 mt-1">{detectionStats.emptyCount}</div>
          <div className="text-[10px] text-rose-700 font-medium mt-0.5">0 Dokumen Terunggah</div>
        </div>

        {/* Total Documents in Cloud Drive */}
        <div
          onClick={() => setActiveMainTab('files_gallery')}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
            activeMainTab === 'files_gallery'
              ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300/40'
              : 'bg-white border-slate-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">Total Berkas Masuk</span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-950 mt-1">{schoolDocuments.length}</div>
          <div className="text-[10px] text-blue-700 font-medium mt-0.5">Otomatis di Drive & Sheet</div>
        </div>
      </div>

      {/* Progress Bar of Overall Completeness */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Tingkat Kelengkapan Berkas Pendaftaran Madrasah</span>
            </span>
            <span className="text-emerald-700 font-black text-sm">{detectionStats.percentage}% Lengkap</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-600 rounded-full transition-all duration-500"
              style={{ width: `${detectionStats.percentage}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 sm:pl-4 pt-2 sm:pt-0">
          <div>
            KK: <strong className="text-slate-800">{detectionStats.totalKK}</strong>
          </div>
          <div>•</div>
          <div>
            Akta: <strong className="text-slate-800">{detectionStats.totalAkta}</strong>
          </div>
          <div>•</div>
          <div>
            Ijazah: <strong className="text-slate-800">{detectionStats.totalIjazah}</strong>
          </div>
        </div>
      </div>

      {/* ================= MAIN VIEW TOGGLE TABS ================= */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveMainTab('detection')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs ${
              activeMainTab === 'detection'
                ? 'bg-slate-900 text-white ring-2 ring-slate-800'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>Deteksi Kelengkapan Setiap Murid ({studentDetectionList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('files_gallery')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs ${
              activeMainTab === 'files_gallery'
                ? 'bg-slate-900 text-white ring-2 ring-slate-800'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Archive className="w-4 h-4 text-teal-400" />
            <span>Galeri & Daftar Berkas Terarsip ({schoolDocuments.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          {activeMainTab === 'detection'
            ? 'Detektor 3 dokumen wajib: Kartu Keluarga (KK), Akta Kelahiran, dan Ijazah / SKL'
            : 'Berkas tersimpan otomatis di Google Drive dan Google Sheets'}
        </div>
      </div>

      {/* =========================================================================
         TAB 1: DETEKSI KELENGKAPAN SETIAP MURID PENDAFTAR (FITUR UTAMA)
         ========================================================================= */}
      {activeMainTab === 'detection' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          {/* Practical Compact Filters for Document Detection */}
          <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchStudentQuery}
                  onChange={(e) => setSearchStudentQuery(e.target.value)}
                  placeholder="Cari nama murid, no. pendaftaran, NISN..."
                  className="w-full pl-8 pr-7 h-8.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/70"
                />
                {searchStudentQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchStudentQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Completeness Status Filter */}
              <select
                value={completenessFilter}
                onChange={(e) => setCompletenessFilter(e.target.value as CompletenessFilter)}
                className="h-8.5 px-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-semibold cursor-pointer shrink-0"
              >
                <option value="all">Semua Kelengkapan ({studentDetectionList.length})</option>
                <option value="complete">Lengkap ({detectionStats.completeCount})</option>
                <option value="incomplete">Belum Lengkap ({detectionStats.incompleteCount})</option>
                <option value="empty">Kosong ({detectionStats.emptyCount})</option>
              </select>

              {/* Pathway Filter */}
              <select
                value={pathwayFilter}
                onChange={(e) => setPathwayFilter(e.target.value)}
                className="h-8.5 px-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 cursor-pointer shrink-0"
              >
                <option value="all">Semua Jalur</option>
                <option value="zonasi">Zonasi</option>
                <option value="afirmasi">Afirmasi</option>
                <option value="prestasi">Prestasi</option>
                <option value="mutasi">Mutasi</option>
              </select>

              {/* Reset Filter Button */}
              {(searchStudentQuery || completenessFilter !== 'all' || pathwayFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchStudentQuery('');
                    setCompletenessFilter('all');
                    setPathwayFilter('all');
                  }}
                  className="h-8.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* List of Students with Document Detection */}
          {filteredDetectionList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <CheckSquare className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Tidak ada data pendaftar yang cocok</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Silakan sesuaikan kriteria pencarian atau filter status kelengkapan dokumen di atas.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDetectionList.map((item) => {
                const s = item.student;
                const app = item.app;

                return (
                  <div
                    key={app.registration_number}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all p-5 space-y-4"
                  >
                    {/* Header Row: Student Profile & Completeness Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                      <div className="flex items-start sm:items-center gap-3">
                        {/* Student Avatar / Photo */}
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-base overflow-hidden shrink-0 border border-emerald-200">
                          {s?.photo_url || item.docFoto?.file_data_base64 || item.docFoto?.drive_url ? (
                            <img
                              src={normalizeImageUrl(s?.photo_url || item.docFoto?.file_data_base64 || item.docFoto?.drive_url)}
                              alt={s?.name || 'Foto'}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span>{(s?.name || 'M').charAt(0).toUpperCase()}</span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-extrabold text-slate-900">{s?.name || 'Calon Murid'}</h3>
                            <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                              {app.registration_number}
                            </span>
                            <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                              Jalur {app.pathway}
                            </span>
                            <span className="text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-md">
                              TA {app.admission_year || systemSettings.academic_year_label || systemSettings.application_year || '2026/2027'}
                            </span>
                            {(app.final_status === 'lulus' || app.selection_status === 'lulus') && (
                              <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Lolos (Arsip Permanen)</span>
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap">
                            <span>NISN: <strong className="text-slate-700">{s?.nisn || '-'}</strong></span>
                            <span>•</span>
                            <span>NIK: <strong className="text-slate-700">{s?.nik || '-'}</strong></span>
                            {item.targetPhone && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 font-mono text-slate-700">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {item.targetPhone}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Completeness Badge */}
                      <div className="flex items-center gap-2">
                        {item.isComplete ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black shadow-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            <span>LENGKAP (3/3 Wajib Terpenuhi)</span>
                          </div>
                        ) : item.isEmpty ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100 text-rose-900 border border-rose-300 text-xs font-black shadow-xs">
                            <XCircle className="w-4 h-4 text-rose-700" />
                            <span>BELUM ADA BERKAS (0/3)</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black shadow-xs">
                            <AlertTriangle className="w-4 h-4 text-amber-700" />
                            <span>BELUM LENGKAP ({item.coreUploaded}/3 Berkas)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Matrix Row: Status of 3 Core Mandatory Documents */}
                    <div>
                      <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                        Status Verifikasi 3 Dokumen Pokok Pendaftaran:
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* 1. Kartu Keluarga (KK) */}
                        <div
                          className={`p-3.5 rounded-xl border text-xs flex flex-col justify-between transition-all ${
                            item.docKK
                              ? 'bg-blue-50/70 border-blue-200'
                              : 'bg-slate-50 border-dashed border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">
                                  KK
                                </span>
                                <span>Kartu Keluarga (KK)</span>
                              </span>
                              {item.docKK ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Ada</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  <span>Kurang</span>
                                </span>
                              )}
                            </div>

                            {item.docKK ? (
                              <div className="text-[11px] text-slate-600 space-y-0.5">
                                <div className="truncate font-medium text-slate-800" title={item.docKK.file_name}>
                                  {item.docKK.file_name}
                                </div>
                                <div className="text-slate-500 text-[10px] flex items-center justify-between">
                                  <span>{item.docKK.file_size_kb || 0} KB</span>
                                  {item.docKK.drive_file_id && (
                                    <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                                      <Cloud className="w-2.5 h-2.5" /> Di Drive
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">
                                Calon murid belum mengunggah Kartu Keluarga.
                              </p>
                            )}
                          </div>

                          {item.docKK && (
                            <div className="mt-2.5 pt-2 border-t border-blue-100 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(item.docKK!)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Pratinjau KK</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadDocumentFile(item.docKK!, s?.name)}
                                className="p-1 text-slate-500 hover:text-blue-700 cursor-pointer"
                                title="Unduh Berkas"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 2. Akta Kelahiran */}
                        <div
                          className={`p-3.5 rounded-xl border text-xs flex flex-col justify-between transition-all ${
                            item.docAkta
                              ? 'bg-amber-50/70 border-amber-200'
                              : 'bg-slate-50 border-dashed border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[10px]">
                                  AK
                                </span>
                                <span>Akta Kelahiran</span>
                              </span>
                              {item.docAkta ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Ada</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  <span>Kurang</span>
                                </span>
                              )}
                            </div>

                            {item.docAkta ? (
                              <div className="text-[11px] text-slate-600 space-y-0.5">
                                <div className="truncate font-medium text-slate-800" title={item.docAkta.file_name}>
                                  {item.docAkta.file_name}
                                </div>
                                <div className="text-slate-500 text-[10px] flex items-center justify-between">
                                  <span>{item.docAkta.file_size_kb || 0} KB</span>
                                  {item.docAkta.drive_file_id && (
                                    <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                                      <Cloud className="w-2.5 h-2.5" /> Di Drive
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">
                                Calon murid belum mengunggah Akta Kelahiran.
                              </p>
                            )}
                          </div>

                          {item.docAkta && (
                            <div className="mt-2.5 pt-2 border-t border-amber-100 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(item.docAkta!)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:text-amber-950 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Pratinjau Akta</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadDocumentFile(item.docAkta!, s?.name)}
                                className="p-1 text-slate-500 hover:text-amber-800 cursor-pointer"
                                title="Unduh Berkas"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 3. Ijazah / SKL */}
                        <div
                          className={`p-3.5 rounded-xl border text-xs flex flex-col justify-between transition-all ${
                            item.docIjazah
                              ? 'bg-purple-50/70 border-purple-200'
                              : 'bg-slate-50 border-dashed border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-[10px]">
                                  IJZ
                                </span>
                                <span>Ijazah / SKL</span>
                              </span>
                              {item.docIjazah ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Ada</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  <span>Kurang</span>
                                </span>
                              )}
                            </div>

                            {item.docIjazah ? (
                              <div className="text-[11px] text-slate-600 space-y-0.5">
                                <div className="truncate font-medium text-slate-800" title={item.docIjazah.file_name}>
                                  {item.docIjazah.file_name}
                                </div>
                                <div className="text-slate-500 text-[10px] flex items-center justify-between">
                                  <span>{item.docIjazah.file_size_kb || 0} KB</span>
                                  {item.docIjazah.drive_file_id && (
                                    <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                                      <Cloud className="w-2.5 h-2.5" /> Di Drive
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">
                                Calon murid belum mengunggah Ijazah / SKL.
                              </p>
                            )}
                          </div>

                          {item.docIjazah && (
                            <div className="mt-2.5 pt-2 border-t border-purple-100 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(item.docIjazah!)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-800 hover:text-purple-950 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Pratinjau Ijazah</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadDocumentFile(item.docIjazah!, s?.name)}
                                className="p-1 text-slate-500 hover:text-purple-800 cursor-pointer"
                                title="Unduh Berkas"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer Row: Missing Docs Summary & Actions */}
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                      <div>
                        {item.allMissingDocs.length > 0 ? (
                          <div className="text-xs text-rose-800 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>
                              Dokumen yang belum lengkap:{' '}
                              <strong>{item.allMissingDocs.join(', ')}</strong>
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs text-emerald-800 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Seluruh dokumen pokok persyaratan pendaftaran telah lengkap terarsip.</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        {item.allMissingDocs.length > 0 && item.targetPhone && (
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppReminder(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                            title="Kirim pesan pengingat dokumen yang belum lengkap ke WhatsApp murid / orang tua"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Kirim Pengingat WA</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMainTab('files_gallery');
                            setSelectedStudentFilter(app.registration_number);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5 text-slate-600" />
                          <span>Lihat Berkas Murid Ini ({item.studentDocs.length})</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
         TAB 2: GALERI & DAFTAR BERKAS TERARSIP (VIEW OTOMATIS)
         ========================================================================= */}
      {activeMainTab === 'files_gallery' && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
            {/* Category Pills */}
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'Semua Berkas', count: schoolDocuments.length },
                  { id: 'kartu_keluarga', label: 'Kartu Keluarga (KK)', count: detectionStats.totalKK },
                  { id: 'akta_kelahiran', label: 'Akta Kelahiran', count: detectionStats.totalAkta },
                  { id: 'ijazah_skl', label: 'Ijazah / SKL', count: detectionStats.totalIjazah },
                  {
                    id: 'pas_foto',
                    label: 'Pas Foto 3x4',
                    count: schoolDocuments.filter((d) => getDocCategory(d.document_type) === 'pas_foto').length,
                  },
                  {
                    id: 'pendukung',
                    label: 'Dokumen Jalur Khusus',
                    count: schoolDocuments.filter((d) => getDocCategory(d.document_type) === 'pendukung').length,
                  },
                ].map((tab) => {
                  const isActive = activeCategory === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveCategory(tab.id as CategoryFilter)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* View Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setGalleryViewMode('grid')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    galleryViewMode === 'grid'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Tampilan Galeri Visual"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryViewMode('table')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    galleryViewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Tampilan Tabel Rinci"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Practical Compact Filters for Archive Files */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchFileQuery}
                  onChange={(e) => setSearchFileQuery(e.target.value)}
                  placeholder="Cari berkas atau nama murid..."
                  className="w-full pl-8 pr-7 h-8.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/70"
                />
                {searchFileQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchFileQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                value={selectedStudentFilter}
                onChange={(e) => setSelectedStudentFilter(e.target.value)}
                aria-label="Filter Calon Murid"
                className="h-8.5 px-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 cursor-pointer shrink-0 max-w-[200px]"
              >
                <option value="all">Semua Murid ({schoolApps.length})</option>
                {schoolApps.map((a) => {
                  const s = students[a.registration_number];
                  return (
                    <option key={a.registration_number} value={a.registration_number}>
                      {s?.name || a.registration_number}
                    </option>
                  );
                })}
              </select>

              <select
                value={cloudStatusFilter}
                onChange={(e) => setCloudStatusFilter(e.target.value as any)}
                aria-label="Filter Lokasi Penyimpanan"
                className="h-8.5 px-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 cursor-pointer shrink-0"
              >
                <option value="all">Semua Lokasi</option>
                <option value="drive">Google Drive (Cloud)</option>
                <option value="local">Server Lokal</option>
              </select>

              <select
                value={verifyFilter}
                onChange={(e) => setVerifyFilter(e.target.value as any)}
                aria-label="Filter Status Verifikasi"
                className="h-8.5 px-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 cursor-pointer shrink-0"
              >
                <option value="all">Semua Status</option>
                <option value="terverifikasi">Terverifikasi</option>
                <option value="menunggu">Menunggu</option>
                <option value="perlu_perbaikan">Perbaikan</option>
                <option value="ditolak">Ditolak</option>
              </select>

              {(searchFileQuery || selectedStudentFilter !== 'all' || cloudStatusFilter !== 'all' || verifyFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchFileQuery('');
                    setSelectedStudentFilter('all');
                    setCloudStatusFilter('all');
                    setVerifyFilter('all');
                  }}
                  className="h-8.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Files Content */}
          {filteredFiles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <Archive className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Belum ada dokumen yang diunggah</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Saat calon murid mengunggah berkas persyaratan pendaftaran, dokumen akan otomatis muncul di sini dan tersimpan di Google Drive serta Google Sheets.
              </p>
            </div>
          ) : galleryViewMode === 'grid' ? (
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredFiles.map((doc) => {
                const student = students[doc.registration_number];
                const cat = getDocCategory(doc.document_type);
                const isPdf =
                  (doc.mime_type && doc.mime_type.includes('pdf')) ||
                  (doc.file_name && doc.file_name.toLowerCase().endsWith('.pdf'));
                const hasDrive = Boolean(doc.drive_file_id && doc.drive_file_id !== 'LOCAL_STORAGE');
                const previewUrl = doc.file_data_base64 || doc.drive_url || doc.local_url || '';

                const categoryLabels: Record<CategoryFilter, { bg: string; text: string; label: string }> = {
                  all: { bg: 'bg-slate-100', text: 'text-slate-800', label: 'Dokumen' },
                  kartu_keluarga: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Kartu Keluarga (KK)' },
                  akta_kelahiran: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Akta Kelahiran' },
                  ijazah_skl: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Ijazah / SKL' },
                  pas_foto: { bg: 'bg-teal-100', text: 'text-teal-800', label: 'Pas Foto 3x4' },
                  pendukung: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Dokumen Jalur' },
                };

                const catInfo = categoryLabels[cat] || categoryLabels.all;

                return (
                  <div
                    key={doc.document_id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    {/* Visual Preview */}
                    <div
                      onClick={() => setPreviewDoc(doc)}
                      className="relative h-44 bg-slate-100 border-b border-slate-100 cursor-pointer overflow-hidden flex items-center justify-center group-hover:opacity-95 transition-all"
                    >
                      {!isPdf && previewUrl ? (
                        <img
                          src={normalizeImageUrl(previewUrl)}
                          alt={doc.document_title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                          <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm shadow-xs mb-2">
                            PDF
                          </div>
                          <span className="text-xs font-semibold text-slate-600 line-clamp-1">
                            {doc.file_name}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Klik untuk pratinjau</span>
                        </div>
                      )}

                      {/* Category Badge Floating Top Left */}
                      <div className="absolute top-2.5 left-2.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.8 rounded-lg text-[10px] font-bold shadow-xs ${catInfo.bg} ${catInfo.text}`}
                        >
                          {catInfo.label}
                        </span>
                      </div>

                      {/* Google Drive Status Floating Top Right */}
                      <div className="absolute top-2.5 right-2.5">
                        {hasDrive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.8 rounded-lg text-[10px] font-bold bg-emerald-700 text-white shadow-xs">
                            <Cloud className="w-3 h-3 text-emerald-200" />
                            <span>Google Drive</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.8 rounded-lg text-[10px] font-bold bg-slate-700 text-white shadow-xs">
                            <Clock className="w-3 h-3" />
                            <span>Lokal</span>
                          </span>
                        )}
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewDoc(doc);
                          }}
                          className="p-2 rounded-xl bg-white text-slate-800 hover:bg-slate-100 shadow-md transition-transform hover:scale-110"
                          title="Pratinjau Dokumen"
                        >
                          <Eye className="w-4 h-4 text-emerald-700" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadDocumentFile(doc, student?.name);
                          }}
                          className="p-2 rounded-xl bg-white text-slate-800 hover:bg-slate-100 shadow-md transition-transform hover:scale-110"
                          title="Unduh Berkas ke Komputer"
                        >
                          <Download className="w-4 h-4 text-blue-700" />
                        </button>
                        {hasDrive && (
                          <a
                            href={`https://drive.google.com/file/d/${doc.drive_file_id}/view?usp=drivesdk`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-xl bg-white text-slate-800 hover:bg-slate-100 shadow-md transition-transform hover:scale-110"
                            title="Buka langsung di Google Drive"
                          >
                            <ExternalLink className="w-4 h-4 text-teal-700" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 line-clamp-1" title={doc.document_title}>
                          {doc.document_title || doc.file_name}
                        </h4>

                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className="font-semibold text-emerald-800 truncate" title={student?.name}>
                            {student?.name || 'Calon Murid'}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {doc.registration_number}
                          </span>
                        </div>

                        <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
                          <span className="truncate max-w-[130px]" title={doc.file_name}>
                            {doc.file_name}
                          </span>
                          <span className="font-medium text-slate-700 shrink-0">{doc.file_size_kb || 0} KB</span>
                        </div>
                      </div>

                      {/* Bottom Status & Actions */}
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                            doc.verification_status === 'terverifikasi'
                              ? 'bg-emerald-100 text-emerald-800'
                              : doc.verification_status === 'perlu_perbaikan'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {doc.verification_status || 'menunggu'}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
                            title="Pratinjau Berkas"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadDocumentFile(doc, student?.name)}
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                            title="Unduh Berkas"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Calon Murid</th>
                      <th className="py-3 px-4">Kategori Dokumen</th>
                      <th className="py-3 px-4">Nama Berkas</th>
                      <th className="py-3 px-4">Ukuran</th>
                      <th className="py-3 px-4">Status Cloud Drive</th>
                      <th className="py-3 px-4">Verifikasi</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap min-w-[130px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFiles.map((doc) => {
                      const student = students[doc.registration_number];
                      const cat = getDocCategory(doc.document_type);
                      const hasDrive = Boolean(doc.drive_file_id && doc.drive_file_id !== 'LOCAL_STORAGE');

                      return (
                        <tr key={doc.document_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{student?.name || 'Calon Murid'}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{doc.registration_number}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800 capitalize">
                              {cat === 'kartu_keluarga' && 'Kartu Keluarga (KK)'}
                              {cat === 'akta_kelahiran' && 'Akta Kelahiran'}
                              {cat === 'ijazah_skl' && 'Ijazah / SKL'}
                              {cat === 'pas_foto' && 'Pas Foto 3x4'}
                              {cat === 'pendukung' && 'Dokumen Pendukung'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800 truncate max-w-xs" title={doc.file_name}>
                              {doc.file_name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Diunggah: {new Date(doc.upload_time).toLocaleDateString('id-ID')}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono">{doc.file_size_kb || 0} KB</td>
                          <td className="py-3 px-4">
                            {hasDrive ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <Cloud className="w-3 h-3 text-emerald-600" />
                                <span>Tersimpan Cloud</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                <span>Lokal</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                                doc.verification_status === 'terverifikasi'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : doc.verification_status === 'perlu_perbaikan'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {doc.verification_status || 'menunggu'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap min-w-[130px]">
                            <div className="inline-flex items-center justify-end gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(doc)}
                                className="w-8 h-8 inline-flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg transition-all shadow-2xs shrink-0 active:scale-95 cursor-pointer"
                                title="Pratinjau Berkas"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadDocumentFile(doc, student?.name)}
                                className="w-8 h-8 inline-flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-lg transition-all shadow-2xs shrink-0 active:scale-95 cursor-pointer"
                                title="Unduh Berkas"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              {hasDrive && (
                                <a
                                  href={`https://drive.google.com/file/d/${doc.drive_file_id}/view?usp=drivesdk`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-8 h-8 inline-flex items-center justify-center bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg transition-all shadow-2xs shrink-0 active:scale-95 cursor-pointer"
                                  title="Buka di Google Drive"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: PRATINJAU DOKUMEN ================= */}
      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          student={students[previewDoc.registration_number]}
          school={school}
          onClose={() => setPreviewDoc(null)}
          onStatusUpdated={() => {
            if (onRefreshData) onRefreshData();
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   SUB-COMPONENT: DOCUMENT PREVIEW MODAL (ZOOM, ROTATE, METADATA & VERIFIKASI)
   ========================================================================= */
interface PreviewModalProps {
  doc: DocumentItem;
  student?: StudentProfile | null;
  school: School;
  onClose: () => void;
  onStatusUpdated: () => void;
}

const DocumentPreviewModal: React.FC<PreviewModalProps> = ({
  doc,
  student,
  school,
  onClose,
  onStatusUpdated,
}) => {
  const { showAlert } = useFeedback();
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [verifyStatus, setVerifyStatus] = useState<VerificationStatus>(doc.verification_status || 'menunggu');
  const [notes, setNotes] = useState<string>(doc.notes || '');
  const [isSavingVerify, setIsSavingVerify] = useState<boolean>(false);

  const previewContainerRef = useRef<HTMLDivElement>(null);

  const isPdf =
    (doc.mime_type && doc.mime_type.includes('pdf')) ||
    (doc.file_name && doc.file_name.toLowerCase().endsWith('.pdf'));

  const fileUrl = doc.file_data_base64 || doc.drive_url || doc.local_url || '';
  const hasDrive = Boolean(doc.drive_file_id && doc.drive_file_id !== 'LOCAL_STORAGE');

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 25, 300));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 25, 50));
  const handleResetZoom = () => {
    setZoomLevel(100);
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const toggleFullscreen = () => {
    if (!previewContainerRef.current) return;
    if (!document.fullscreenElement) {
      previewContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleSaveVerification = async () => {
    setIsSavingVerify(true);
    try {
      const ok = await storageService.updateArchiveVerification(doc.document_id, verifyStatus, notes);
      if (ok) {
        showAlert('Status Diperbarui', 'Verifikasi berkas berhasil disimpan.', 'success');
        onStatusUpdated();
      } else {
        showAlert('Gagal Menyimpan', 'Terjadi kesalahan saat menyimpan status.', 'error');
      }
    } catch (err: any) {
      showAlert('Error', err?.message || 'Gagal verifikasi.', 'error');
    } finally {
      setIsSavingVerify(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              {isPdf ? <FileText className="w-5 h-5 text-red-600" /> : <ImageIcon className="w-5 h-5 text-emerald-700" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">
                {doc.document_title || doc.file_name}
              </h3>
              <p className="text-xs text-slate-500">
                Pendaftar: <strong className="text-slate-800">{student?.name || 'Calon Murid'}</strong> ({doc.registration_number})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadDocumentFile(doc, student?.name)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Berkas</span>
            </button>

            {hasDrive && (
              <a
                href={`https://drive.google.com/file/d/${doc.drive_file_id}/view?usp=drivesdk`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold transition-all"
                title="Buka langsung di Google Drive"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Google Drive</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
          {/* Left: Viewer */}
          <div
            ref={previewContainerRef}
            className="lg:col-span-2 bg-slate-950 flex flex-col justify-between relative overflow-hidden min-h-[350px] lg:min-h-[480px]"
          >
            {/* Viewer Controls Toolbar */}
            <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-1 bg-slate-900/80 backdrop-blur-xs p-1 rounded-xl border border-slate-700/60 pointer-events-auto shadow-md">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
                  title="Perkecil"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono font-bold text-slate-200 px-1.5">{zoomLevel}%</span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
                  title="Perbesar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRotate}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
                  title="Putar 90 Derajat"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer text-xs"
                >
                  Reset
                </button>
              </div>

              <div className="flex items-center gap-1 bg-slate-900/80 backdrop-blur-xs p-1 rounded-xl border border-slate-700/60 pointer-events-auto shadow-md">
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
                  title="Layar Penuh"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Viewer Canvas */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
              {isPdf ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-slate-900 rounded-xl border border-slate-800">
                  <FileText className="w-16 h-16 text-red-500 mb-3" />
                  <h4 className="text-white font-bold text-sm mb-1">{doc.file_name}</h4>
                  <p className="text-slate-400 text-xs max-w-sm mb-5">
                    Dokumen PDF terarsip secara otomatis. Anda dapat mengunduh atau membuka langsung berkas ini.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => downloadDocumentFile(doc, student?.name)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>Unduh Berkas PDF</span>
                    </button>
                    {hasDrive && (
                      <a
                        href={`https://drive.google.com/file/d/${doc.drive_file_id}/view?usp=drivesdk`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Buka di Google Drive</span>
                      </a>
                    )}
                  </div>
                </div>
              ) : fileUrl ? (
                <div
                  className="transition-transform duration-200 flex items-center justify-center"
                  style={{
                    transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                  }}
                >
                  <img
                    src={normalizeImageUrl(fileUrl)}
                    alt={doc.document_title}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="text-slate-400 text-xs">Pratinjau tidak tersedia</div>
              )}
            </div>
          </div>

          {/* Right: Info & Verification Form */}
          <div className="bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 p-5 flex flex-col justify-between overflow-y-auto space-y-4">
            <div className="space-y-4">
              {/* Metadata */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Metadata Berkas Terarsip</span>
                </h4>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nama Dokumen:</span>
                    <span className="font-semibold text-slate-800 text-right">{doc.document_title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Kategori:</span>
                    <span className="font-bold text-emerald-800 capitalize">{doc.document_type.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nama File:</span>
                    <span className="font-mono text-[11px] text-slate-700 truncate max-w-[160px] text-right" title={doc.file_name}>
                      {doc.file_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ukuran:</span>
                    <span className="font-mono font-semibold text-slate-800">{doc.file_size_kb || 0} KB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Waktu Unggah:</span>
                    <span className="text-slate-700 text-right">
                      {new Date(doc.upload_time).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cloud Storage Location */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-blue-600" />
                  <span>Lokasi Otomatis Google Drive</span>
                </h4>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Status Penyimpanan:</span>
                    {hasDrive ? (
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                        Tersimpan di Cloud Google Drive
                      </span>
                    ) : (
                      <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        Penyimpanan Lokal
                      </span>
                    )}
                  </div>
                  {doc.drive_file_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">ID Berkas Drive:</span>
                      <span className="font-mono text-[10px] text-slate-600 truncate max-w-[150px]" title={doc.drive_file_id}>
                        {doc.drive_file_id}
                      </span>
                    </div>
                  )}
                  <div className="pt-1 text-[11px] text-slate-500">
                    <span className="block font-semibold text-slate-700">Hierarki Folder Kategori:</span>
                    <span className="text-slate-600 block mt-0.5 font-mono text-[10px] bg-slate-50 p-1.5 rounded border border-slate-100">
                      [Drive Root] / {school.school_name} / ARSIP DIGITAL BERDASARKAN KATEGORI / {doc.document_type.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Verification Form */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verifikasi Keabsahan Dokumen</span>
                </h4>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs space-y-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Status Verifikasi:</label>
                    <select
                      value={verifyStatus}
                      onChange={(e) => setVerifyStatus(e.target.value as VerificationStatus)}
                      className="w-full p-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-semibold"
                    >
                      <option value="terverifikasi">Terverifikasi (Dokumen Valid & Jelas)</option>
                      <option value="menunggu">Menunggu Verifikasi</option>
                      <option value="perlu_perbaikan">Perlu Perbaikan (Buram / Salah Dokumen)</option>
                      <option value="ditolak">Ditolak</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Catatan Verifikator:</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Tuliskan catatan verifikasi (opsional)..."
                      className="w-full p-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveVerification}
                    disabled={isSavingVerify}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isSavingVerify ? 'Menyimpan...' : 'Simpan Status Verifikasi'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 text-center text-[10px] text-slate-400">
              Pengarsipan otomatis oleh sistem PPDB SIPMA
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
