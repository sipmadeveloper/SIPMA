import React, { useState } from 'react';
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
import { normalizeImageUrl } from '../../utils/imageUrl';
import { RegistrationWizard } from './RegistrationWizard';
import { PrintBuktiPendaftaran } from './PrintBuktiPendaftaran';
import { DispensationLetterModal } from './DispensationLetterModal';
import { AcceptanceLetterModal } from './AcceptanceLetterModal';
import { StudentProfileView } from './StudentProfileView';
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
  const { showAlert, showConfirm } = useFeedback();
  const [internalTab, setInternalTab] = useState<'overview' | 'form' | 'print' | 'announcements' | 'profile'>('overview');
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;

  const setActiveTab = (tab: 'overview' | 'form' | 'print' | 'announcements' | 'profile') => {
    setInternalTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };
  const [showDispensationModal, setShowDispensationModal] = useState<boolean>(false);
  const [showAcceptanceModal, setShowAcceptanceModal] = useState<boolean>(false);
  const [isCancellingSchool, setIsCancellingSchool] = useState<boolean>(false);

  const safeSchool: School = school || {
    school_id: 'SCH-MAN1',
    npsn: '20100001',
    school_name: 'MAN 1 Kota Jakarta',
    level: 'MA',
    status: 'active',
    address: 'Jl. Madrasah No. 1',
    principal_name: 'H. Ahmad Fauzi, M.Pd',
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

  // Timeline steps
  const timelineSteps = [
    { title: 'Pembuatan Akun', status: 'completed' },
    { title: 'Isi Formulir & Zonasi', status: application.final_status !== 'draft' ? 'completed' : 'current' },
    { title: 'Submit Pendaftaran', status: application.final_status !== 'draft' ? 'completed' : 'pending' },
    {
      title: 'Verifikasi Berkas',
      status:
        application.final_status === 'perlu_perbaikan'
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
        onRefresh={onRefresh}
        onBack={() => setActiveTab('overview')}
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
      />
    );
  }

  return (
    <div className="space-y-6" id="sipma-student-dashboard">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 text-white p-5 sm:p-7 rounded-2xl shadow-md border border-emerald-800/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="relative group cursor-pointer focus:outline-none"
              title="Klik untuk ubah / unggah foto profil"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-600/30 border border-emerald-400/40 p-1 shrink-0 overflow-hidden flex items-center justify-center group-hover:ring-2 group-hover:ring-emerald-400 transition-all">
                {student.photo_url ? (
                  <img
                    src={normalizeImageUrl(student.photo_url)}
                    alt={student.name}
                    className="w-full h-full object-cover rounded-xl"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-200" />
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs border border-emerald-400">
                Ubah
              </span>
            </button>

            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
                Dashboard Calon Peserta Didik
              </div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight mt-1 truncate text-white">
                Selamat Datang, {student.name}!
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5 text-xs text-emerald-100/90">
                <span>No. Pendaftaran:</span>
                <span className="font-mono bg-emerald-900/80 border border-emerald-400/40 px-2.5 py-0.5 rounded-md text-emerald-300 font-bold text-[11px] sm:text-xs tracking-wider">
                  {student.registration_number}
                </span>
                {application.school_id ? (
                  <span className="bg-emerald-800/90 text-emerald-100 px-2.5 py-0.5 rounded text-[11px] font-semibold border border-emerald-500/50">
                    Terhubung: {safeSchool.school_name}
                  </span>
                ) : (
                  <span className="bg-amber-800/90 text-amber-100 px-2.5 py-0.5 rounded text-[11px] font-semibold border border-amber-500/50">
                    Belum Memilih Madrasah
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-emerald-800/60">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-white border border-emerald-400/30 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-emerald-300" />
              <span>Profil Saya</span>
            </button>

            {application.final_status !== 'draft' && (
              <button
                type="button"
                onClick={() => setActiveTab('print')}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-white hover:bg-slate-100 text-slate-900 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-700" />
                <span>Cetak Bukti</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>{application.final_status === 'draft' ? (application.school_id ? 'Lanjutkan Pengisian' : 'Pilih Madrasah & Isi Form') : 'Lihat Formulir'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notice if target school has not been selected */}
      {!application.school_id && (
        <div className="p-5 rounded-2xl border-2 border-amber-300 bg-amber-50/90 text-amber-950 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-900">
                Pilih Madrasah Tujuan Anda
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                Akun Anda belum terikat ke madrasah mana pun. Silakan buka formulir pendaftaran untuk memilih madrasah tujuan (MIN, MTsN, atau MAN) yang Anda inginkan agar data Anda langsung terhubung ke panitia PPDB madrasah tersebut.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-xs cursor-pointer"
          >
            Pilih Madrasah Sekarang →
          </button>
        </div>
      )}

      {/* Auto-Reroute Alert Banner if transferred */}
      {application.is_auto_rerouted && (
        <div className="p-5 rounded-2xl border border-sky-300 bg-sky-50 text-sky-950 shadow-xs flex flex-col sm:flex-row items-start gap-4">
          <div className="p-2.5 rounded-xl bg-sky-500 text-white shadow-xs shrink-0">
            <SchoolIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-sky-800">
                Pemberitahuan Pelimpahan Berkas Otomatis
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-200 text-sky-900">
                Otomatis Dialihkan ke Kuota Kosong
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-800 leading-relaxed">
              Berkas dan form data pendaftaran Anda telah otomatis dialihkan ke{' '}
              <strong className="text-sky-900 font-bold">{safeSchool.school_name}</strong> (Jarak:{' '}
              {formatDistanceIndonesian(application.distance_km)}).
            </p>
            {application.reroute_reason && (
              <p className="text-[11px] text-slate-600 italic bg-white/80 p-2.5 rounded-xl border border-sky-200">
                &ldquo;{application.reroute_reason}&rdquo;
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              Seluruh berkas pendaftaran Anda kini siap diverifikasi oleh Panitia PPDB {safeSchool.school_name}. Anda tidak perlu mengisi ulang formulir pendaftaran.
            </p>
          </div>
        </div>
      )}

      {/* Acceptance Special Banner if Lulus */}
      {application.final_status === 'lulus' && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white shadow-lg border-2 border-emerald-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 animate-in fade-in">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white text-emerald-800 rounded-2xl shadow-sm shrink-0">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-[11px] font-extrabold uppercase tracking-wider text-emerald-100 border border-emerald-300/40">
                Pengumuman Kelulusan Resmi
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white">
                Selamat! Anda Dinyatakan LULUS & DITERIMA di {safeSchool.school_name}
              </h3>
              <p className="text-xs text-emerald-100/90 leading-relaxed max-w-2xl">
                Silakan unduh Surat Keterangan Diterima resmi (PDF) berikut untuk keperluan verifikasi berkas fisik dan tahapan daftar ulang calon murid baru.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setShowAcceptanceModal(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-white hover:bg-emerald-50 text-emerald-950 font-bold rounded-xl text-xs shadow-md transition-transform active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-700" />
              <span>Cetak / Unduh Surat Diterima (PDF)</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Status Notification Card */}
      <div className={`p-6 rounded-2xl border ${statusInfo.bg} shadow-xs flex flex-col sm:flex-row items-start gap-4`}>
        <div className="p-2.5 rounded-xl bg-white/70 shadow-xs shrink-0">
          <StatusIcon className="w-7 h-7" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider">Status Pendaftaran:</span>
            <span className="text-sm font-black underline decoration-2">{statusInfo.label}</span>
          </div>
          <p className="text-xs leading-relaxed opacity-90">{statusInfo.desc}</p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {application.final_status === 'lulus' && (
              <button
                type="button"
                onClick={() => setShowAcceptanceModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-800 text-white rounded-lg text-xs font-bold hover:bg-emerald-900 shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Surat Keterangan Diterima (PDF)</span>
              </button>
            )}

            {application.school_id && (
              <button
                type="button"
                onClick={() => setShowDispensationModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Surat Permohonan Dispensasi (PDF)</span>
              </button>
            )}
          </div>

          {application.final_status === 'perlu_perbaikan' && (
            <div className="mt-3 pt-3 border-t border-amber-200/80 flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900">
                Silakan perbaiki data/dokumen Anda sekarang.
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className="px-3.5 py-1.5 bg-amber-800 text-white text-xs font-bold rounded-lg hover:bg-amber-900 transition-colors shadow-xs"
              >
                Perbaiki Berkas
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress Timeline Tracker */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-6">Alur & Progress Penerimaan Murid</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {timelineSteps.map((step, idx) => (
            <div
              key={step.title}
              className={`p-3 rounded-xl border text-center relative flex flex-col items-center justify-center space-y-1.5 ${
                step.status === 'completed'
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : step.status === 'current'
                  ? 'bg-blue-50/70 border-blue-300 text-blue-900 ring-2 ring-blue-500/20'
                  : step.status === 'warning'
                  ? 'bg-amber-50/70 border-amber-300 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <div className="text-[10px] font-mono font-bold opacity-60">0{idx + 1}</div>
              <div className="text-xs font-bold leading-tight">{step.title}</div>
              <div className="text-[10px] font-semibold uppercase">
                {step.status === 'completed'
                  ? '✓ Selesai'
                  : step.status === 'current'
                  ? '● Sedang Berjalan'
                  : step.status === 'warning'
                  ? '⚠️ Perbaikan'
                  : 'Belum'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Registration Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Jalur & Madrasah */}
        <div className="bg-gradient-to-br from-emerald-50/70 via-white to-white p-5 rounded-2xl border border-emerald-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                <SchoolIcon className="w-4 h-4" />
              </div>
              <span>Madrasah Pilihan</span>
            </div>
            {application.school_id && !application.is_locked && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                Dapat Diubah
              </span>
            )}
          </div>

          {application.school_id ? (
            <>
              <div className="text-base font-black text-slate-900">{safeSchool.school_name}</div>
              <div className="text-xs text-slate-600 leading-relaxed">{safeSchool.address}</div>

              {!application.is_locked && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('form')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <FileEdit className="w-3 h-3" />
                    <span>Ganti Madrasah</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelSchoolChoice}
                    disabled={isCancellingSchool}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3 h-3 text-rose-600" />
                    <span>{isCancellingSchool ? 'Membatalkan...' : 'Batalkan Pilihan'}</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-amber-800">Belum Memilih Madrasah</div>
              <div className="text-xs text-slate-600">Pilih madrasah tujuan pada formulir pendaftaran</div>
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <SchoolIcon className="w-3.5 h-3.5" />
                <span>Pilih Madrasah Sekarang</span>
              </button>
            </>
          )}
          <div className="pt-3 border-t border-emerald-100 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Jalur Pendaftaran:</span>
            <span className="font-bold text-emerald-900 uppercase px-2.5 py-0.5 bg-emerald-100/90 border border-emerald-300/80 rounded-md">
              Jalur {application.pathway || 'Zonasi'}
            </span>
          </div>
        </div>

        {/* Card 2: Zonasi & Jarak */}
        <div className="bg-gradient-to-br from-blue-50/70 via-white to-white p-5 rounded-2xl border border-blue-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-blue-950 font-bold text-sm">
            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-800">
              <MapPin className="w-4 h-4" />
            </div>
            <span>Hasil Perhitungan Zonasi</span>
          </div>
          <div className="text-2xl font-black text-blue-950">
            {application.school_id ? formatDistanceIndonesian(application.distance_km) : '-'}
          </div>
          <div className="text-xs text-slate-600">
            {application.school_id ? (
              <>Radius Maksimal Madrasah: <strong className="text-slate-900">{application.max_distance_km} km</strong></>
            ) : (
              <span>Pilih madrasah untuk menghitung zonasi</span>
            )}
          </div>
          <div className="pt-3 border-t border-blue-100 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Kriteria Zonasi:</span>
            <span
              className={`font-bold px-2.5 py-0.5 rounded-md text-[11px] uppercase border ${
                !application.school_id
                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                  : application.zoning_status === 'memenuhi'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-rose-100 text-rose-900 border-rose-300'
              }`}
            >
              {!application.school_id ? 'Menunggu Pilihan' : application.zoning_status === 'memenuhi' ? 'Memenuhi Syarat' : 'Luar Radius'}
            </span>
          </div>
        </div>

        {/* Card 3: Dokumen & Verifikasi */}
        <div className="bg-gradient-to-br from-teal-50/70 via-white to-white p-5 rounded-2xl border border-teal-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-teal-950 font-bold text-sm">
            <div className="p-1.5 rounded-lg bg-teal-100 text-teal-800">
              <FileText className="w-4 h-4" />
            </div>
            <span>Kelengkapan Berkas</span>
          </div>
          <div className="text-base font-black text-slate-900">
            {application.final_status === 'draft' ? 'Belum Lengkap' : 'Berkas Terkirim'}
          </div>
          <div className="text-xs text-slate-600 leading-relaxed">
            Tersimpan di Cloud Database & Google Drive
          </div>
          <div className="pt-3 border-t border-teal-100 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Status Verifikasi:</span>
            <span className="font-bold text-teal-900 bg-teal-100/90 border border-teal-300/80 px-2.5 py-0.5 rounded-md capitalize">
              {application.verification_status}
            </span>
          </div>
        </div>
      </div>

      {/* Announcements Widget */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-600" />
            <span>Pengumuman & Informasi Penting</span>
          </h3>
        </div>

        <div className="space-y-3">
          {announcements
            .filter((a) => a.is_published && (a.target_role === 'all' || a.target_role === 'calon_murid'))
            .map((anc) => (
              <div
                key={anc.announcement_id}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-slate-900">{anc.title}</div>
                  <span className="text-[11px] text-slate-500 font-mono">{anc.date}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{anc.content}</p>
                <div className="text-[11px] text-slate-400 font-medium pt-1">
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
    </div>
  );
};
