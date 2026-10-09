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
  ArrowDown,
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
import { normalizeImageUrl, handleImageError } from '../../utils/imageUrl';
import { downloadDocumentFile } from '../../utils/fileDownload';

interface Props {
  school: School;
  applications: Application[];
  students: Record<string, StudentProfile>;
  parents?: Record<string, ParentData>;
  documents: DocumentItem[];
  currentUser?: UserType | null;
  onRefreshData?: () => void;
  initialMainTab?: MainViewTab;
}

type MainViewTab = 'detection' | 'files_gallery';
type CategoryFilter =
  | 'all'
  | 'kartu_keluarga'
  | 'akta_kelahiran'
  | 'ijazah_skl'
  | 'pas_foto'
  | 'pendukung'
  | 'kartu_afirmasi'
  | 'sertifikat_prestasi'
  | 'surat_mutasi';
type CompletenessFilter = 'all' | 'complete' | 'incomplete' | 'empty';

export const DigitalArchiveManagement: React.FC<Props> = ({
  school,
  applications,
  students,
  parents = {},
  documents,
  currentUser,
  onRefreshData,
  initialMainTab,
}) => {
  const { showAlert } = useFeedback();

  // Navigation View Tab: "Deteksi Kelengkapan" vs "Daftar Berkas Terarsip"
  const [activeMainTab, setActiveMainTab] = useState<MainViewTab>(initialMainTab || 'detection');

  React.useEffect(() => {
    if (initialMainTab) {
      setActiveMainTab(initialMainTab);
    }
  }, [initialMainTab]);

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
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name' | 'reg' | 'size'>('newest');

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
        const docKey = normalizeDocTypeKey(doc.document_type);
        if (activeCategory === 'pendukung') {
          const cat = getDocCategory(doc.document_type);
          if (cat !== 'pendukung') return false;
        } else if (
          activeCategory === 'kartu_keluarga' ||
          activeCategory === 'akta_kelahiran' ||
          activeCategory === 'ijazah_skl' ||
          activeCategory === 'pas_foto'
        ) {
          const cat = getDocCategory(doc.document_type);
          if (cat !== activeCategory) return false;
        } else {
          if (docKey !== activeCategory) return false;
        }
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

  // Tata urutan berkas arsip (Model List)
  const sortedFiles = useMemo(() => {
    const list = [...filteredFiles];
    if (sortOrder === 'newest') {
      list.sort((a, b) => new Date(b.upload_time || 0).getTime() - new Date(a.upload_time || 0).getTime());
    } else if (sortOrder === 'oldest') {
      list.sort((a, b) => new Date(a.upload_time || 0).getTime() - new Date(b.upload_time || 0).getTime());
    } else if (sortOrder === 'name') {
      list.sort((a, b) => {
        const nameA = (students[a.registration_number]?.name || '').toLowerCase();
        const nameB = (students[b.registration_number]?.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    } else if (sortOrder === 'reg') {
      list.sort((a, b) => (a.registration_number || '').localeCompare(b.registration_number || ''));
    } else if (sortOrder === 'size') {
      list.sort((a, b) => (b.file_size_kb || 0) - (a.file_size_kb || 0));
    }
    return list;
  }, [filteredFiles, sortOrder, students]);

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
    <div className="space-y-4 animate-in fade-in duration-300" id="sipma-digital-archive">
      {/* =========================================================================
         TAB 1: DETEKSI KELENGKAPAN SETIAP MURID PENDAFTAR (FITUR UTAMA)
         ========================================================================= */}
      {activeMainTab === 'detection' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          {/* Practical Compact Filters for Document Detection: Sejajar Rapi 1 Baris */}
          <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs max-w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full min-w-0">
              {/* Search Box */}
              <div className="relative flex-1 min-w-0">
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

              {/* Action and Filter Controls Inline Sejajar: Geser Horizontal di HP */}
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full w-full sm:w-auto shrink-0 pb-0.5 sm:pb-0 touch-pan-x flex-nowrap min-w-0">
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

                {/* Tombol Aksi Unduh Excel Sejajar */}
                <button
                  type="button"
                  onClick={handleExportCompletenessCsv}
                  className="inline-flex items-center justify-center w-8.5 h-8.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-700 transition-all shadow-2xs cursor-pointer shrink-0 active:scale-95"
                  title="Unduh rekap inventaris kelengkapan berkas seluruh calon murid (Excel / CSV)"
                  aria-label="Unduh Rekap Kelengkapan Excel"
                >
                  <span className="relative inline-flex items-center justify-center">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <ArrowDown className="w-2.5 h-2.5 text-emerald-700 absolute -bottom-1 -right-1 bg-white rounded-full ring-1 ring-emerald-500 stroke-[3]" />
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* List of Students with Document Detection (Simple & Compact) */}
          {filteredDetectionList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Tidak ada data pendaftar yang cocok</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Silakan sesuaikan kriteria pencarian atau filter status kelengkapan dokumen di atas.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="divide-y divide-slate-100">
                {filteredDetectionList.map((item) => {
                  const s = item.student;
                  const app = item.app;
                  const avatarUrl = s?.photo_url || item.docFoto?.file_data_base64 || item.docFoto?.drive_url;

                  return (
                    <div
                      key={app.registration_number}
                      className="p-3 sm:px-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                    >
                      {/* Left: Foto, Nomor Pendaftaran, Nama */}
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Foto */}
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs overflow-hidden shrink-0 border border-emerald-200">
                          {avatarUrl ? (
                            <img
                              src={normalizeImageUrl(avatarUrl)}
                              alt={s?.name || 'Foto'}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span>{(s?.name || 'M').charAt(0).toUpperCase()}</span>
                          )}
                        </div>

                        {/* No Reg & Nama */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                              {app.registration_number}
                            </span>
                            <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                              {s?.name || 'Calon Murid'}
                            </span>
                            <span className="text-[10px] font-bold uppercase bg-slate-50 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                              Jalur {app.pathway}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Nama Dokumen (KK, Akta Lahir, Ijazah/SKL, dll) + Tombol Mata */}
                      <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap shrink-0">
                        {/* KK */}
                        {item.docKK ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                            <span>KK</span>
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(item.docKK!)}
                              className="p-0.5 hover:bg-emerald-100 rounded text-emerald-800 transition-colors cursor-pointer"
                              title="Lihat Berkas Kartu Keluarga"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs">
                            KK
                          </span>
                        )}

                        {/* Akta Lahir */}
                        {item.docAkta ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                            <span>Akta Lahir</span>
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(item.docAkta!)}
                              className="p-0.5 hover:bg-emerald-100 rounded text-emerald-800 transition-colors cursor-pointer"
                              title="Lihat Berkas Akta Kelahiran"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs">
                            Akta Lahir
                          </span>
                        )}

                        {/* Ijazah / SKL */}
                        {item.docIjazah ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                            <span>Ijazah/SKL</span>
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(item.docIjazah!)}
                              className="p-0.5 hover:bg-emerald-100 rounded text-emerald-800 transition-colors cursor-pointer"
                              title="Lihat Berkas Ijazah / SKL"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs">
                            Ijazah/SKL
                          </span>
                        )}

                        {/* Dokumen Jalur / Tambahan (dll) */}
                        {app.pathway === 'afirmasi' && (
                          item.docAfirmasi ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                              <span>KIP/PKH</span>
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(item.docAfirmasi!)}
                                className="p-0.5 hover:bg-emerald-100 rounded text-emerald-800 transition-colors cursor-pointer"
                                title="Lihat Berkas Afirmasi"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs">
                              KIP/PKH
                            </span>
                          )
                        )}

                        {app.pathway === 'prestasi' && (
                          item.docPrestasi ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                              <span>Sertifikat</span>
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(item.docPrestasi!)}
                                className="p-0.5 hover:bg-emerald-100 rounded text-emerald-800 transition-colors cursor-pointer"
                                title="Lihat Sertifikat Prestasi"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs">
                              Sertifikat
                            </span>
                          )
                        )}

                        {app.pathway === 'mutasi' && (
                          item.docMutasi ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                              <span>Surat Mutasi</span>
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(item.docMutasi!)}
                                className="p-0.5 hover:bg-emerald-100 rounded text-emerald-800 transition-colors cursor-pointer"
                                title="Lihat Surat Mutasi"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs">
                              Surat Mutasi
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            {/* 1. Fitur Cari Nama Berkas / Murid (Terpisah di Atas Agar Lebih Lebar) */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchFileQuery}
                onChange={(e) => setSearchFileQuery(e.target.value)}
                placeholder="Cari nama calon murid, nomor pendaftaran, atau nama berkas..."
                className="w-full pl-9.5 pr-8 h-9 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/70"
              />
              {searchFileQuery && (
                <button
                  type="button"
                  onClick={() => setSearchFileQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 2. Filter Baris Bawah: Tahun Pendaftaran, Jenis Berkas, Murid, Lokasi, Status, View Switcher: Geser Horizontal di HP */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto max-w-full w-full pb-1 touch-pan-x flex-nowrap min-w-0">
              {/* Filter Pilihan Tahun Pendaftaran (Cukup Satu Kotak) */}
              <select
                value={selectedYearFilter}
                onChange={(e) => setSelectedYearFilter(e.target.value)}
                aria-label="Filter Tahun Pendaftaran"
                className="h-8.5 px-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-bold text-slate-800 cursor-pointer shrink-0"
              >
                <option value="all">Semua Tahun Pendaftaran ({allSchoolApps.length} Murid)</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Tahun Ajaran {yr}
                  </option>
                ))}
              </select>

              {/* Filter Jenis Berkas (Ringkas Cukup Satu Kotak dengan Banyak Pilihan Kategori Berkas) */}
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value as CategoryFilter)}
                aria-label="Filter Jenis Berkas"
                className="h-8.5 px-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-bold text-slate-800 cursor-pointer shrink-0"
              >
                <option value="all">Semua Jenis Berkas ({schoolDocuments.length})</option>
                <option value="kartu_keluarga">Kartu Keluarga (KK)</option>
                <option value="akta_kelahiran">Akta Kelahiran</option>
                <option value="ijazah_skl">Ijazah / SKL</option>
                <option value="pas_foto">Pas Foto 3x4</option>
                <option value="pendukung">Dokumen Pendukung / Pernyataan</option>
                <option value="kartu_afirmasi">Kartu Afirmasi (KIP/PKH/KKS)</option>
                <option value="sertifikat_prestasi">Sertifikat Piagam Prestasi</option>
                <option value="surat_mutasi">Surat Mutasi Tugas</option>
              </select>

              {/* Filter Murid */}
              <select
                value={selectedStudentFilter}
                onChange={(e) => setSelectedStudentFilter(e.target.value)}
                aria-label="Filter Calon Murid"
                className="h-8.5 px-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 cursor-pointer shrink-0 max-w-[190px]"
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

              {/* Filter Lokasi Penyimpanan */}
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

              {/* Filter Status Verifikasi */}
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

              {/* Reset Button */}
              {(selectedYearFilter !== 'all' || activeCategory !== 'all' || selectedStudentFilter !== 'all' || cloudStatusFilter !== 'all' || verifyFilter !== 'all' || searchFileQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedYearFilter('all');
                    setActiveCategory('all');
                    setSelectedStudentFilter('all');
                    setCloudStatusFilter('all');
                    setVerifyFilter('all');
                    setSearchFileQuery('');
                  }}
                  className="h-8.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Reset
                </button>
              )}

              {/* Sort Order Selector (Tata Urutan Model List) */}
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-slate-500 font-semibold hidden sm:inline">Urutkan:</span>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  aria-label="Urutan Berkas"
                  className="h-8.5 px-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-medium text-slate-800 cursor-pointer"
                >
                  <option value="newest">Terbaru Diunggah</option>
                  <option value="oldest">Terlama Diunggah</option>
                  <option value="name">Nama Murid (A-Z)</option>
                  <option value="reg">No. Pendaftaran</option>
                  <option value="size">Ukuran Terbesar</option>
                </select>
                <div className="h-8.5 px-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs">
                  <List className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Model List ({sortedFiles.length})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Files Content - Pure List Model */}
          {sortedFiles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <Archive className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Belum ada dokumen yang sesuai kriteria</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Saat berkas pendaftaran diunggah atau kriteria pencarian direset, dokumen akan otomatis tersusun rapi dalam model list di sini.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead className="bg-slate-50/90 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4 w-12 text-center">No</th>
                      <th className="py-3.5 px-4">Calon Murid</th>
                      <th className="py-3.5 px-4">Nama Berkas Dokumen</th>
                      <th className="py-3.5 px-4">Kategori Berkas</th>
                      <th className="py-3.5 px-4">Ukuran</th>
                      <th className="py-3.5 px-4">Penyimpanan Cloud</th>
                      <th className="py-3.5 px-4">Status Verifikasi</th>
                      <th className="py-3.5 px-4 text-center whitespace-nowrap min-w-[130px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedFiles.map((doc, idx) => {
                      const student = students[doc.registration_number];
                      const cat = getDocCategory(doc.document_type);
                      const hasDrive = Boolean(doc.drive_file_id && doc.drive_file_id !== 'LOCAL_STORAGE');
                      const isPdf =
                        (doc.mime_type && doc.mime_type.includes('pdf')) ||
                        (doc.file_name && doc.file_name.toLowerCase().endsWith('.pdf'));
                      const previewUrl = doc.file_data_base64 || doc.drive_url || doc.local_url || '';

                      return (
                        <tr key={doc.document_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 text-center font-mono text-slate-400 font-bold">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{student?.name || 'Calon Murid'}</div>
                            <div className="text-[11px] text-slate-400 font-mono">No. Reg: {doc.registration_number}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              {/* Visual Preview Icon / Thumbnail */}
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(doc)}
                                className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center hover:ring-2 hover:ring-emerald-500 transition-all cursor-pointer shadow-2xs"
                                title="Klik untuk pratinjau berkas"
                              >
                                {isPdf ? (
                                  <div className="w-full h-full bg-rose-50 flex items-center justify-center text-rose-600 font-black text-[10px]">
                                    PDF
                                  </div>
                                ) : previewUrl ? (
                                  <img
                                    src={normalizeImageUrl(previewUrl)}
                                    alt={doc.file_name}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => handleImageError(e)}
                                  />
                                ) : (
                                  <FileText className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                              <div className="min-w-0 max-w-xs">
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc(doc)}
                                  className="font-bold text-slate-800 hover:text-emerald-700 hover:underline text-left truncate block max-w-[240px] cursor-pointer"
                                  title={doc.file_name}
                                >
                                  {doc.file_name}
                                </button>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                  <span>Diunggah: {new Date(doc.upload_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold ${
                              cat === 'kartu_keluarga'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : cat === 'akta_kelahiran'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : cat === 'ijazah_skl'
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : cat === 'pas_foto'
                                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}>
                              {cat === 'kartu_keluarga' && 'Kartu Keluarga (KK)'}
                              {cat === 'akta_kelahiran' && 'Akta Kelahiran'}
                              {cat === 'ijazah_skl' && 'Ijazah / SKL'}
                              {cat === 'pas_foto' && 'Pas Foto 3x4'}
                              {cat === 'pendukung' && 'Dokumen Jalur'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-medium text-slate-700">{doc.file_size_kb || 0} KB</td>
                          <td className="py-3.5 px-4">
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
                          <td className="py-3.5 px-4">
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
                          <td className="py-3.5 px-4 text-center whitespace-nowrap min-w-[130px]">
                            <div className="inline-flex items-center justify-center gap-1.5 shrink-0">
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
