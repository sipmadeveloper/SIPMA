import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  FileEdit,
  Printer,
  Bell,
  MapPin,
  FileText,
  School as SchoolIcon,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  KeyRound,
  Camera,
  Upload,
  Download,
  Eye,
} from 'lucide-react';
import {
  StudentProfile,
  Application,
  ParentData,
  SchoolOrigin,
  AddressData,
  School,
  Announcement,
} from '../../types/sipma';
import { formatDistanceIndonesian } from '../../utils/geo';
import { normalizeImageUrl, handleImageError, compressAndResizeImage } from '../../utils/imageUrl';
import { downloadElementAsPdf } from '../../utils/pdfGenerator';
import { RegistrationWizard } from './RegistrationWizard';
import { PrintBuktiPendaftaran } from './PrintBuktiPendaftaran';
import { DispensationLetterModal } from './DispensationLetterModal';
import { AcceptanceLetterModal } from './AcceptanceLetterModal';
import { StudentProfileView } from './StudentProfileView';
import { RejectedSchoolSelectionCard } from './RejectedSchoolSelectionCard';
import { useFeedback } from '../../context/FeedbackContext';
import { storageService } from '../../services/storageService';

interface Props {
  student: StudentProfile;
  application: Application;
  parent?: ParentData | null;
  schoolOrigin?: SchoolOrigin | null;
  address?: AddressData | null;
  school: School;
  announcements: Announcement[];
  onRefresh: () => void;
  activeTab?: 'overview' | 'form' | 'print' | 'announcements' | 'profile';
  onTabChange?: (tab: 'overview' | 'form' | 'print' | 'announcements' | 'profile') => void;
}

export const StudentDashboard: React.FC<Props> = ({
  student,
  application,
  parent,
  schoolOrigin,
  address,
  school,
  announcements,
  onRefresh,
  activeTab: controlledTab,
  onTabChange,
}) => {
  const { showAlert, showConfirm, showToast, showLoading, hideLoading } = useFeedback();
  const [internalTab, setInternalTab] = useState<'overview' | 'form' | 'print' | 'announcements' | 'profile'>('overview');
  const [profileTab, setProfileTab] = useState<'profile' | 'password'>('profile');
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;

  // Collapsible state for Status Card and Timeline Tracker (auto-closed upon entering account)
  const [isStatusOpen, setIsStatusOpen] = useState<boolean>(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(false);

  // Direct download states without preview
  const [isDownloadingBukti, setIsDownloadingBukti] = useState<boolean>(false);
  const [isDownloadingLetter, setIsDownloadingLetter] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Direct Download Bukti Pendaftaran Word (.doc) fallback
  const handleDirectDownloadBuktiDoc = () => {
    const regSafe = application?.registration_number || student?.registration_number || 'SIPMA';
    const nameSafe = student?.name || 'Calon Siswa';
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bukti Pendaftaran - ${regSafe}</title></head><body><h1>BUKTI PENDAFTARAN RESMI PPDB</h1><p>Nomor Pendaftaran: <b>${regSafe}</b></p><p>Nama Calon Murid: <b>${nameSafe}</b></p><p>NIK: ${student?.nik || '-'}</p><p>NISN: ${student?.nisn || '-'}</p><p>Madrasah Tujuan: <b>${safeSchool?.school_name || '-'}</b></p><p>Jalur: ${(application?.pathway || 'ZONASI').toUpperCase()}</p><p>Status: ${(application?.final_status || 'PROSES').toUpperCase()}</p></body></html>`;
    const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bukti_Pendaftaran_${regSafe}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Bukti Pendaftaran berhasil diunduh.', 'success');
  };

  // Direct Download Bukti Pendaftaran PDF without preview
  const handleDirectDownloadBuktiPdf = async () => {
    setIsDownloadingBukti(true);
    showToast('Menyiapkan berkas Bukti Pendaftaran (PDF)...', 'info');
    try {
      const regSafe = application?.registration_number || student?.registration_number || 'SIPMA';
      const fileName = `Bukti_Pendaftaran_${regSafe}.pdf`;
      const success = await downloadElementAsPdf('sipma-print-sheet', fileName);
      if (success) {
        showToast('Bukti Pendaftaran berhasil diunduh.', 'success');
      } else {
        handleDirectDownloadBuktiDoc();
      }
    } catch {
      handleDirectDownloadBuktiDoc();
    } finally {
      setIsDownloadingBukti(false);
    }
  };

  // Direct Download Surat Keterangan Diterima PDF without preview
  const handleDirectDownloadAcceptanceLetter = async () => {
    setIsDownloadingLetter(true);
    showToast('Menyiapkan Surat Keterangan Diterima (PDF)...', 'info');
    try {
      const regSafe = application?.registration_number || student?.registration_number || 'SIPMA';
      const fileName = `Surat_Keterangan_Diterima_${regSafe}.pdf`;
      const success = await downloadElementAsPdf('sipma-acceptance-sheet', fileName);
      if (success) {
        showToast('Surat Keterangan Diterima berhasil diunduh.', 'success');
      } else {
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Surat Diterima - ${regSafe}</title></head><body><h1>SURAT KETERANGAN DITERIMA</h1><p>Madrasah: <b>${safeSchool?.school_name || 'Madrasah'}</b></p><p>Selamat! Calon Murid <b>${student?.name}</b> (No. Reg: ${regSafe}) dinyatakan LULUS & DITERIMA.</p></body></html>`;
        const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Surat_Keterangan_Diterima_${regSafe}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Surat Keterangan Diterima berhasil diunduh.', 'success');
      }
    } catch {
      showToast('Gagal memproses berkas Surat Keterangan Diterima.', 'error');
    } finally {
      setIsDownloadingLetter(false);
    }
  };

  const handleDirectPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showAlert('Format Tidak Sesuai', 'Format berkas harus berupa gambar (JPG, PNG, atau WEBP).', 'error');
      return;
    }

    showLoading('Memproses foto...');
    try {
      const compressed = await compressAndResizeImage(file, 600, 600, 0.88);
      const base64Data = compressed.base64;

      const standardFileName = `00_PAS_FOTO_3X4_${student.registration_number || 'REG'}.jpg`;
      const existingDocs = storageService.getDocumentsByRegistration(student.registration_number);
      const fotoDoc = existingDocs.find((d) => d.document_type === 'foto' || d.document_type === 'pas_foto');
      const oldDriveId = fotoDoc?.drive_file_id || '';

      const photoDoc = {
        document_id: fotoDoc ? fotoDoc.document_id : `DOC-FOTO-${Date.now()}`,
        registration_number: student.registration_number,
        student_id: student.student_id || `STD-${Date.now()}`,
        document_type: 'foto' as const,
        document_title: 'Pas Foto 3x4 Calon Murid',
        file_name: standardFileName,
        file_size_kb: Math.round((base64Data.length * 0.75) / 1024),
        file_data_base64: base64Data,
        old_drive_file_id: oldDriveId,
        upload_time: new Date().toISOString(),
        verification_status: 'menunggu' as const,
      };

      storageService.saveDocument(photoDoc, student.name, safeSchool?.school_name, false);
      const uploadRes = await storageService.uploadDocumentToDrive(photoDoc, student.name, safeSchool?.school_name);
      const finalUrl = uploadRes?.file?.thumbnail_url || uploadRes?.file?.drive_url || base64Data;

      const updatedStudent: StudentProfile = {
        ...student,
        photo_url: finalUrl,
      };
      storageService.saveStudentProfile(updatedStudent);

      const curUser = storageService.getCurrentUser();
      if (curUser) {
        storageService.setCurrentUser({ ...curUser, photo_url: finalUrl });
      }

      hideLoading();
      showToast('Pas foto & foto profil akun berhasil diperbarui!', 'success');
      onRefresh();
    } catch (err: any) {
      hideLoading();
      showToast(err?.message || 'Gagal menyimpan foto.', 'error');
    }
  };

  const setActiveTab = (tab: 'overview' | 'form' | 'print' | 'announcements' | 'profile') => {
    setInternalTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };
  const [showDispensationModal, setShowDispensationModal] = useState<boolean>(false);
  const [showAcceptanceModal, setShowAcceptanceModal] = useState<boolean>(false);
  const [isCancellingSchool, setIsCancellingSchool] = useState<boolean>(false);

  const allSchools = storageService.getSchools();
  const safeSchool: School = school || allSchools.find((s) => s.school_id === application.school_id) || allSchools[0] || {
    school_id: application.school_id || '',
    npsn: '',
    school_name: 'Madrasah',
    level: 'MI',
    status: 'active',
    address: '-',
    principal_name: '-',
    village: '',
    district: '',
    city: '',
    province: '',
    latitude: 0,
    longitude: 0,
    radius_zonasi_km: 5,
    zoning_radius_km: 5,
    quota_total: 100,
    quota_zonasi: 50,
    quota_afirmasi: 20,
    quota_prestasi: 20,
    quota_mutasi: 10,
  };

  const [effectivePhotoState, setEffectivePhotoState] = useState<string>(
    student.photo_url || storageService.getCurrentUser()?.photo_url || ''
  );

  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      const newPhoto = e?.detail?.photo_url;
      if (newPhoto) {
        setEffectivePhotoState(newPhoto);
      }
    };
    window.addEventListener('sipma:user_profile_updated', handleProfileUpdate);
    return () => window.removeEventListener('sipma:user_profile_updated', handleProfileUpdate);
  }, []);

  const currentEffectivePhoto = effectivePhotoState || student.photo_url || storageService.getCurrentUser()?.photo_url || '';

  const handleCancelSchoolChoice = () => {
    if (application.is_locked) {
      showAlert('Pendaftaran Terkunci', 'Pendaftaran Anda telah dikunci dan tidak dapat membatalkan pilihan madrasah.', 'warning');
      return;
    }

    showConfirm(
      'Batalkan Pilihan Madrasah?',
      `Apakah Anda yakin ingin membatalkan pilihan madrasah ${safeSchool.school_name}? Anda dapat memilih kembali madrasah tujuan kapan saja di formulir pendaftaran.`,
      () => {
        try {
          setIsCancellingSchool(true);
          storageService.cancelStudentTargetSchool(student.registration_number);
          showAlert('Pilihan Dibatalkan', 'Pilihan madrasah tujuan berhasil dibatalkan. Silakan pilih madrasah tujuan baru pada formulir pendaftaran.', 'success');
          onRefresh();
        } catch (err: any) {
          showAlert('Gagal Membatalkan Pilihan', err.message || 'Terjadi kesalahan saat membatalkan pilihan madrasah.', 'error');
        } finally {
          setIsCancellingSchool(false);
        }
      },
      {
        confirmLabel: 'Ya, Batalkan Pilihan',
        cancelLabel: 'Tetap di Madrasah Ini',
        type: 'warning',
      }
    );
  };

  const getStatusBadge = () => {
    switch (application.final_status) {
      case 'lulus':
        return {
          label: 'LULUS SELEKSI',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: CheckCircle2,
          desc: 'Selamat! Anda dinyatakan LULUS seleksi penerimaan murid baru di madrasah pilihan.',
        };
      case 'ditolak':
        return {
          label: 'BERKAS DITOLAK',
          bg: 'bg-rose-100 text-rose-800 border-rose-300',
          icon: XCircle,
          desc: application.verification_notes || 'Mohon maaf, berkas pendaftaran Anda tidak memenuhi kriteria penerimaan madrasah asal.',
        };
      case 'tidak_lulus':
        return {
          label: 'TIDAK LULUS SELEKSI',
          bg: 'bg-rose-100 text-rose-800 border-rose-300',
          icon: XCircle,
          desc: 'Mohon maaf, Anda belum memenuhi kuota penerimaan tahun ini. Tetap semangat!',
        };
      case 'terverifikasi':
        return {
          label: 'BERKAS TERVERIFIKASI',
          bg: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: ShieldCheck,
          desc: 'Seluruh berkas dan titik koordinat zonasi Anda telah diverifikasi valid oleh panitia.',
        };
      case 'perlu_perbaikan':
        return {
          label: 'PERLU PERBAIKAN BERKAS',
          bg: 'bg-amber-100 text-amber-800 border-amber-300',
          icon: AlertCircle,
          desc: application.verification_notes || 'Panitia meminta Anda untuk memperbaiki beberapa data/dokumen yang diunggah.',
        };
      case 'submitted':
        return {
          label: 'MENUNGGU VERIFIKASI',
          bg: 'bg-indigo-100 text-indigo-800 border-indigo-300',
          icon: Clock,
          desc: 'Pendaftaran Anda telah diterima dan sedang dalam antrean verifikasi berkas oleh panitia.',
        };
      default:
        return {
          label: 'DRAF (BELUM LENGKAP)',
          bg: 'bg-slate-100 text-slate-800 border-slate-300',
          icon: Clock,
          desc: 'Silakan lengkapi seluruh tahapan formulir pendaftaran hingga tahap submit final.',
        };
    }
  };

  const statusInfo = getStatusBadge();
  const StatusIcon = statusInfo.icon;

  const isRejected =
    application.verification_status === 'ditolak' ||
    application.final_status === 'ditolak' ||
    (application.final_status === 'tidak_lulus' && application.selection_status === 'tidak_lulus');

  // Timeline steps
  const timelineSteps = [
    { title: 'Pembuatan Akun', status: 'completed' },
    { title: 'Isi Formulir & Zonasi', status: application.final_status !== 'draft' ? 'completed' : 'current' },
    { title: 'Submit Pendaftaran', status: application.final_status !== 'draft' ? 'completed' : 'pending' },
    {
      title: 'Verifikasi Berkas',
      status:
        application.final_status === 'perlu_perbaikan' || isRejected
          ? 'warning'
          : application.final_status === 'terverifikasi' || application.final_status === 'lulus' || application.final_status === 'tidak_lulus'
          ? 'completed'
          : application.final_status === 'submitted'
          ? 'current'
          : 'pending',
    },
    {
      title: 'Seleksi & Pemeringkatan',
      status: application.final_status === 'lulus' || application.final_status === 'tidak_lulus' ? 'completed' : 'pending',
    },
    {
      title: 'Pengumuman Hasil',
      status: application.final_status === 'lulus' || application.final_status === 'tidak_lulus' ? 'completed' : 'pending',
    },
  ];

  if (activeTab === 'form') {
    return (
      <RegistrationWizard
        registrationNumber={student.registration_number}
        onBack={() => {
          setActiveTab('overview');
          onRefresh();
        }}
        onSchoolSelected={() => {
          onRefresh();
        }}
        onFinish={() => {
          setActiveTab('overview');
          onRefresh();
        }}
        onOpenPrint={() => {
          setActiveTab('print');
          onRefresh();
        }}
      />
    );
  }

  if (activeTab === 'profile') {
    return (
      <StudentProfileView
        student={student}
        application={application}
        school={safeSchool}
        initialTab={profileTab}
        onRefresh={onRefresh}
        onBack={() => {
          setProfileTab('profile');
          setActiveTab('overview');
        }}
      />
    );
  }

  if (activeTab === 'print') {
    return (
      <PrintBuktiPendaftaran
        application={application}
        student={student}
        parent={parent}
        schoolOrigin={schoolOrigin}
        address={address}
        school={safeSchool}
        onBack={() => setActiveTab('overview')}
        onTriggerVerification={(regNumber) => {
          window.location.hash = `#/verify?reg=${encodeURIComponent(regNumber)}`;
        }}
      />
    );
  }

  if (activeTab === 'announcements') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            ← Kembali ke Beranda
          </button>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <p className="text-xs text-slate-500">
            Informasi edaran resmi dari Panitia PPDB Madrasah untuk calon murid baru.
          </p>

          <div className="space-y-2.5">
            {announcements
              .filter((a) => a.is_published && (a.target_role === 'all' || a.target_role === 'calon_murid'))
              .map((anc) => (
                <div key={anc.announcement_id} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs sm:text-sm text-slate-900">{anc.title}</div>
                    <span className="text-[10px] text-slate-500 font-mono">{anc.date}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{anc.content}</p>
                  <div className="text-[10px] text-emerald-800 font-medium pt-1">
                    Diterbitkan oleh: {anc.author_name}
                  </div>
                </div>
              ))}
            {announcements.filter((a) => a.is_published && (a.target_role === 'all' || a.target_role === 'calon_murid')).length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs">
                Belum ada pengumuman terbaru saat ini.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full overflow-hidden" id="sipma-student-dashboard">
      {/* Welcome Banner (Institutional Executive Header) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-4 sm:p-5 rounded-xl shadow-xs border border-slate-750 relative overflow-hidden w-full">
        {/* Hidden File Input for direct photo upload & instant sync */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleDirectPhotoUpload}
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-4.5 min-w-0">
            {/* Student 3x4 Pass Photo Frame with Quick Upload Button */}
            <div className="relative group shrink-0">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-24 sm:w-24 sm:h-28 rounded-xl bg-slate-800/90 border-2 border-emerald-400/50 p-0.5 shrink-0 overflow-hidden flex items-center justify-center cursor-pointer group-hover:border-emerald-300 transition-all shadow-md"
                title="Klik untuk memilih & mengunggah pas foto baru"
              >
                {currentEffectivePhoto ? (
                  <img
                    src={normalizeImageUrl(currentEffectivePhoto)}
                    alt={student.name}
                    className="w-full h-full object-cover rounded-lg"
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-1 p-2 text-center">
                    <User className="w-8 h-8 text-emerald-300/80" />
                    <span className="text-[9px] font-semibold text-slate-300 leading-tight">3x4 Foto</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-emerald-700 hover:bg-emerald-600 text-white text-[9.5px] font-bold px-2 py-0.5 rounded-md shadow-xs border border-emerald-400/60 flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                title="Ganti pas foto calon murid"
              >
                <Camera className="w-2.5 h-2.5" />
                <span>Ubah</span>
              </button>
            </div>

            {/* Student Identity & Metadata */}
            <div className="min-w-0 space-y-1">
              <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>Portal Calon Murid</span>
                <span className="text-emerald-500/60">·</span>
                <span>PPDB Madrasah</span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white leading-tight truncate">
                {student.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-slate-300">
                <span className="font-mono bg-slate-800/90 border border-slate-700 px-2 py-0.5 rounded text-emerald-300 font-semibold text-xs tracking-wide">
                  {student.registration_number}
                </span>
                {student.nisn && (
                  <span className="text-slate-300 text-xs">
                    NISN: <strong className="text-white font-mono">{student.nisn}</strong>
                  </span>
                )}
                {safeSchool?.school_name && (
                  <span className="text-slate-300 text-xs hidden md:inline">
                    · <span className="text-white">{safeSchool.school_name}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="flex flex-wrap sm:flex-col items-stretch gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>Formulir Pendaftaran</span>
            </button>
            <button
              type="button"
              onClick={handleDirectDownloadBuktiPdf}
              disabled={isDownloadingBukti}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Langsung unduh file PDF Bukti Pendaftaran resmi ke perangkat tanpa preview"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloadingBukti ? 'Mengunduh...' : 'Unduh Bukti (PDF)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('print')}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg border border-white/20 shadow-2xs transition-colors cursor-pointer"
              title="Pratinjau lembar cetak bukti pendaftaran"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Lihat Bukti</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notice if target school has not been selected */}
      {!application.school_id && (
        <div className="p-3 rounded-lg border border-amber-300 bg-amber-50/90 text-amber-950 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500 text-white shadow-2xs shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-amber-900">
                Pilih Madrasah Tujuan Anda
              </h4>
              <p className="text-[11px] text-amber-800 leading-snug">
                Akun Anda belum terikat ke madrasah mana pun. Silakan buka formulir untuk memilih madrasah tujuan.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-2xs cursor-pointer"
          >
            Pilih Madrasah Sekarang →
          </button>
        </div>
      )}

      {/* Auto-Reroute Alert Banner if transferred */}
      {application.is_auto_rerouted && (
        <div className="p-3.5 rounded-lg border border-sky-300 bg-sky-50 text-sky-950 shadow-2xs flex flex-col sm:flex-row items-start gap-3">
          <div className="p-2 rounded-lg bg-sky-500 text-white shadow-2xs shrink-0">
            <SchoolIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] uppercase font-bold tracking-wider text-sky-800">
                Pemberitahuan Pelimpahan Berkas Otomatis
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-sky-200 text-sky-900">
                Otomatis Dialihkan ke Kuota Kosong
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-800 leading-snug">
              Berkas dan form data pendaftaran Anda telah otomatis dialihkan ke{' '}
              <strong className="text-sky-900 font-bold">{safeSchool.school_name}</strong> (Jarak:{' '}
              {formatDistanceIndonesian(application.distance_km)}).
            </p>
            {application.reroute_reason && (
              <p className="text-[10.5px] text-slate-600 italic bg-white/80 p-2 rounded-lg border border-sky-200">
                &ldquo;{application.reroute_reason}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}

      {/* Acceptance Special Banner if Lulus */}
      {application.final_status === 'lulus' && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white shadow-xs border border-emerald-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white text-emerald-800 rounded-lg shadow-2xs shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="space-y-0.5">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/30 text-[9px] font-extrabold uppercase tracking-wider text-emerald-100 border border-emerald-300/40">
                Pengumuman Kelulusan Resmi
              </div>
              <h3 className="text-sm sm:text-base font-black text-white">
                Selamat! Anda Dinyatakan LULUS & DITERIMA di {safeSchool.school_name}
              </h3>
              <p className="text-[11px] text-emerald-100/90 leading-snug max-w-2xl">
                Unduh Surat Keterangan Diterima resmi (PDF) berikut untuk verifikasi berkas fisik dan daftar ulang.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={handleDirectDownloadAcceptanceLetter}
              disabled={isDownloadingLetter}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg text-xs shadow-2xs transition-transform active:scale-95 cursor-pointer disabled:opacity-60"
              title="Langsung unduh Surat Keterangan Diterima resmi (PDF) tanpa membuka pratinjau"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span>{isDownloadingLetter ? 'Mengunduh PDF...' : 'Unduh Surat Diterima (PDF)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAcceptanceModal(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-950 font-bold rounded-lg text-xs shadow-2xs transition-transform active:scale-95 cursor-pointer"
              title="Buka pratinjau surat kelulusan"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-700" />
              <span>Lihat Surat</span>
            </button>
          </div>
        </div>
      )}

      {/* Rejected School Manual Selection Card */}
      {isRejected && application.final_status !== 'lulus' && (
        <RejectedSchoolSelectionCard
          application={application}
          currentSchool={safeSchool}
          schools={storageService.getSchools()}
          onTransferred={(_newRegNum, _targetSchool) => {
            onRefresh();
          }}
        />
      )}

      {/* Main Status Notification Card (Collapsible) */}
      <div className={`p-3 sm:p-3.5 rounded-lg border ${statusInfo.bg} shadow-2xs transition-all`}>
        {/* Clickable Header with Triangle Button on the Right */}
        <div
          onClick={() => setIsStatusOpen(!isStatusOpen)}
          className="flex items-center justify-between cursor-pointer select-none gap-2"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsStatusOpen(!isStatusOpen);
            }
          }}
          title={isStatusOpen ? 'Klik untuk menutup rincian status' : 'Klik segitiga untuk melihat semua isi status'}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-white/80 shadow-2xs shrink-0">
              <StatusIcon className="w-5 h-5" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="text-[11px] uppercase font-bold tracking-wider opacity-85">Status Pendaftaran:</span>
              <span className="text-xs sm:text-sm font-black underline decoration-2 truncate">{statusInfo.label}</span>
            </div>
          </div>

          {/* Right Triangle (Segitiga) Button for Open & Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsStatusOpen(!isStatusOpen);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-2xs text-xs font-bold transition-all active:scale-95 cursor-pointer"
              title={isStatusOpen ? 'Klik segitiga untuk menutup' : 'Klik segitiga untuk melihat semua isi'}
              aria-label={isStatusOpen ? 'Tutup rincian status' : 'Buka rincian status'}
            >
              <span className="text-[11px] font-bold text-slate-700">{isStatusOpen ? 'Tutup' : 'Buka'}</span>
              <span
                className={`inline-block text-[10px] text-slate-800 font-bold transition-transform duration-200 transform ${
                  isStatusOpen ? 'rotate-180' : 'rotate-0'
                }`}
                aria-hidden="true"
              >
                ▼
              </span>
            </button>
          </div>
        </div>

        {/* Collapsible Content: Melihat Semua Isi Tampilan */}
        {isStatusOpen && (
          <div className="pt-2.5 mt-2 border-t border-black/10 space-y-2 animate-in fade-in duration-150">
            <p className="text-xs leading-normal opacity-90">{statusInfo.desc}</p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {application.final_status === 'lulus' && (
                <button
                  type="button"
                  onClick={() => setShowAcceptanceModal(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-800 text-white rounded-md text-xs font-bold hover:bg-emerald-900 shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3 h-3" />
                  <span>Surat Keterangan Diterima (PDF)</span>
                </button>
              )}

              {application.school_id && (
                <button
                  type="button"
                  onClick={() => setShowDispensationModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <FileText className="w-3 h-3 text-slate-500" />
                  <span>Surat Permohonan Dispensasi (PDF)</span>
                </button>
              )}
            </div>

            {application.final_status === 'perlu_perbaikan' && (
              <div className="mt-2 pt-2 border-t border-amber-200/80 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">
                  Silakan perbaiki data/dokumen Anda sekarang.
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('form')}
                  className="px-2.5 py-1 bg-amber-800 text-white text-xs font-bold rounded-md hover:bg-amber-900 transition-colors shadow-2xs cursor-pointer"
                >
                  Perbaiki Berkas
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress Timeline Tracker (Collapsible) */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs transition-all">
        {/* Clickable Header with Triangle Button on the Right */}
        <div
          onClick={() => setIsTimelineOpen(!isTimelineOpen)}
          className="flex items-center justify-between cursor-pointer select-none gap-2"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsTimelineOpen(!isTimelineOpen);
            }
          }}
          title={isTimelineOpen ? 'Klik untuk menutup alur progres' : 'Klik segitiga untuk melihat semua isi alur progres'}
        >
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
              Alur & Progress Penerimaan Murid
            </h3>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full hidden sm:inline">
              Tahap {timelineSteps.filter((s) => s.status === 'completed').length}/{timelineSteps.length} Selesai
            </span>
          </div>

          {/* Right Triangle (Segitiga) Button for Open & Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsTimelineOpen(!isTimelineOpen);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-2xs text-xs font-bold transition-all active:scale-95 cursor-pointer"
              title={isTimelineOpen ? 'Klik segitiga untuk menutup' : 'Klik segitiga untuk melihat semua isi'}
              aria-label={isTimelineOpen ? 'Tutup alur progres' : 'Buka alur progres'}
            >
              <span className="text-[11px] font-bold text-slate-700">{isTimelineOpen ? 'Tutup' : 'Buka'}</span>
              <span
                className={`inline-block text-[10px] text-slate-800 font-bold transition-transform duration-200 transform ${
                  isTimelineOpen ? 'rotate-180' : 'rotate-0'
                }`}
                aria-hidden="true"
              >
                ▼
              </span>
            </button>
          </div>
        </div>

        {/* Collapsible Content: Melihat Semua Isi Tampilan */}
        {isTimelineOpen && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {timelineSteps.map((step, idx) => (
                <div
                  key={step.title}
                  className={`p-2 rounded-md border text-center relative flex flex-col items-center justify-center space-y-0.5 ${
                    step.status === 'completed'
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : step.status === 'current'
                      ? 'bg-blue-50/70 border-blue-300 text-blue-900 ring-1 ring-blue-500/20'
                      : step.status === 'warning'
                      ? 'bg-amber-50/70 border-amber-300 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="text-[9.5px] font-mono font-bold opacity-60">0{idx + 1}</div>
                  <div className="text-[10.5px] sm:text-[11px] font-bold leading-tight break-words">{step.title}</div>
                  <div className="text-[8.5px] font-semibold uppercase">
                    {step.status === 'completed'
                      ? '✓ Selesai'
                      : step.status === 'current'
                      ? '● Berjalan'
                      : step.status === 'warning'
                      ? '⚠️ Perbaikan'
                      : 'Belum'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Registration Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Jalur & Madrasah */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs">
                <div className="p-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <SchoolIcon className="w-3.5 h-3.5" />
                </div>
                <span>Madrasah Pilihan</span>
              </div>
              {application.school_id && !application.is_locked && (
                <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                  Dapat Diubah
                </span>
              )}
            </div>

            {application.school_id ? (
              <>
                <div className="text-sm font-bold text-slate-900 leading-snug">{safeSchool.school_name}</div>
                <div className="text-xs text-slate-500 leading-normal line-clamp-2">{safeSchool.address}</div>

                {!application.is_locked && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('form')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <FileEdit className="w-3 h-3" />
                      <span>Ganti Madrasah</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelSchoolChoice}
                      disabled={isCancellingSchool}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <XCircle className="w-3 h-3 text-rose-600" />
                      <span>{isCancellingSchool ? 'Membatalkan...' : 'Batalkan Pilihan'}</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-xs font-semibold text-amber-800">Belum Memilih Madrasah</div>
                <div className="text-xs text-slate-500">Silakan tentukan madrasah tujuan pada formulir pendaftaran.</div>
                <button
                  type="button"
                  onClick={() => setActiveTab('form')}
                  className="mt-1 inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-semibold transition-colors cursor-pointer"
                >
                  <SchoolIcon className="w-3.5 h-3.5" />
                  <span>Pilih Madrasah Sekarang</span>
                </button>
              </>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Jalur:</span>
            <span className="font-semibold text-slate-800 uppercase px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px]">
              Jalur {application.pathway || 'Zonasi'}
            </span>
          </div>
        </div>

        {/* Card 2: Zonasi & Jarak */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs">
              <div className="p-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <span>Hasil Perhitungan Zonasi</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
              {application.school_id ? formatDistanceIndonesian(application.distance_km) : '-'}
            </div>
            <div className="text-xs text-slate-500">
              {application.school_id ? (
                <>Radius Maksimal: <strong className="text-slate-800 font-semibold tabular-nums">{application.max_distance_km} km</strong></>
              ) : (
                <span>Tentukan madrasah untuk hitung radius zonasi</span>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Status Zonasi:</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded text-[11px] uppercase border ${
                !application.school_id
                  ? 'bg-slate-50 text-slate-600 border-slate-200'
                  : application.zoning_status === 'memenuhi'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {!application.school_id ? 'Menunggu' : application.zoning_status === 'memenuhi' ? 'Memenuhi Syarat' : 'Luar Radius'}
            </span>
          </div>
        </div>

        {/* Card 3: Dokumen & Verifikasi */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs">
              <div className="p-1 rounded-md bg-teal-50 text-teal-700 border border-teal-200/60">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <span>Kelengkapan Berkas</span>
            </div>
            <div className="text-sm font-bold text-slate-900">
              {application.final_status === 'draft' ? 'Formulir Belum Lengkap' : 'Berkas Terkirim'}
            </div>
            <div className="text-xs text-slate-500 leading-normal">
              Tersimpan aman di Cloud Database PPDB
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Verifikasi Panitia:</span>
            <span className="font-semibold text-slate-800 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded capitalize text-[11px]">
              {application.verification_status || 'Menunggu'}
            </span>
          </div>
        </div>
      </div>

      {/* Announcements Widget */}
      <div className="bg-white p-3 sm:p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
            <Bell className="w-3.5 h-3.5 text-emerald-600" />
            <span>Pengumuman & Informasi Penting</span>
          </h3>
        </div>

        <div className="space-y-2">
          {announcements
            .filter((a) => a.is_published && (a.target_role === 'all' || a.target_role === 'calon_murid'))
            .map((anc) => (
              <div
                key={anc.announcement_id}
                className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200 space-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-slate-900">{anc.title}</div>
                  <span className="text-[9.5px] text-slate-500 font-mono">{anc.date}</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">{anc.content}</p>
                <div className="text-[9.5px] text-slate-400 font-medium">
                  Oleh: {anc.author_name}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Dispensation Letter Modal */}
      {showDispensationModal && (
        <DispensationLetterModal
          isOpen={showDispensationModal}
          student={student}
          parent={parent}
          schoolOrigin={schoolOrigin}
          school={safeSchool}
          address={address}
          application={application}
          reason={application?.dispensation_reason}
          onClose={() => setShowDispensationModal(false)}
        />
      )}

      {/* Official Acceptance Letter Modal (PDF Only) */}
      {showAcceptanceModal && (
        <AcceptanceLetterModal
          isOpen={showAcceptanceModal}
          student={student}
          parent={parent}
          schoolOrigin={schoolOrigin}
          school={safeSchool}
          address={address}
          application={application}
          onClose={() => setShowAcceptanceModal(false)}
        />
      )}

      {/* Offscreen background sheets for instant direct PDF download without preview */}
      <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none w-[850px] overflow-hidden" aria-hidden="true">
        <PrintBuktiPendaftaran
          application={application}
          student={student}
          parent={parent}
          schoolOrigin={schoolOrigin}
          address={address}
          school={safeSchool}
          onBack={() => {}}
        />
        {application.final_status === 'lulus' && (
          <AcceptanceLetterModal
            isOpen={true}
            student={student}
            parent={parent}
            schoolOrigin={schoolOrigin}
            school={safeSchool}
            address={address}
            application={application}
            onClose={() => {}}
          />
        )}
      </div>
    </div>
  );
};
