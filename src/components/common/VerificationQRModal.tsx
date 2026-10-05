import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  X,
  UserCheck,
  Building2,
  Clock,
  ArrowRight,
  ExternalLink,
  MapPin,
  Sparkles,
  User,
} from 'lucide-react';
import { Application, StudentProfile, School, User as UserType } from '../../types/sipma';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { formatDistanceIndonesian } from '../../utils/geo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  application: Application | null;
  student: StudentProfile | null;
  school: School | null;
  currentUser: UserType | null;
  onProceedToAdminVerification: (regNumber: string) => void;
  onRequestAdminLogin: () => void;
}

export const VerificationQRModal: React.FC<Props> = ({
  isOpen,
  onClose,
  application,
  student,
  school,
  currentUser,
  onProceedToAdminVerification,
  onRequestAdminLogin,
}) => {
  if (!isOpen || !application) return null;

  const isAdmin =
    currentUser?.role === 'admin_sekolah' ||
    currentUser?.role === 'operator_sekolah' ||
    currentUser?.role === 'admin_pusat';

  const regNumber = application.registration_number;
  const studentName = student?.name || 'Calon Murid';

  const getStatusBadge = () => {
    switch (application.verification_status) {
      case 'terverifikasi':
        return {
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          label: 'BERKAS TERVERIFIKASI',
          icon: CheckCircle2,
        };
      case 'perlu_perbaikan':
        return {
          bg: 'bg-amber-100 text-amber-800 border-amber-300',
          label: 'PERLU PERBAIKAN BERKAS',
          icon: Clock,
        };
      case 'ditolak':
        return {
          bg: 'bg-rose-100 text-rose-800 border-rose-300',
          label: 'BERKAS TIDAK MEMENUHI SYARAT',
          icon: X,
        };
      default:
        return {
          bg: 'bg-blue-100 text-blue-800 border-blue-300',
          label: 'MENUNGGU VERIFIKASI PANITIA',
          icon: Clock,
        };
    }
  };

  const statusInfo = getStatusBadge();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-emerald-300 border border-white/20 shadow-md">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
                Validasi QR Code SIPMA
              </div>
              <h2 className="text-lg font-black text-white leading-tight">
                Bukti Pendaftaran Sah Terdaftar
              </h2>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status Chip */}
          <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="text-xs font-semibold text-slate-500">Status Dokumen:</div>
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${statusInfo.bg}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              <span>{statusInfo.label}</span>
            </div>
          </div>

          {/* Student Profile Card */}
          <div className="flex items-start gap-4 p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl">
            <div className="w-16 h-20 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-300">
              {student?.photo_url ? (
                <img
                  src={normalizeImageUrl(student.photo_url)}
                  alt={studentName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 text-center p-1">
                  <User className="w-6 h-6 text-slate-400 mb-0.5" />
                  <span className="text-[9px] font-bold text-slate-400">Pas Foto</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono font-bold text-emerald-800 tracking-wider">
                {regNumber}
              </div>
              <h3 className="text-base font-extrabold text-slate-900 truncate mt-0.5">
                {studentName}
              </h3>
              <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                <div>
                  NIK: <span className="font-mono">{student?.nik || '-'}</span> | NISN:{' '}
                  <span className="font-mono">{student?.nisn || '-'}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-700 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{school?.school_name || 'Madrasah Pilihan'}</span>
                </div>
                <div className="text-[11px] text-slate-500 capitalize">
                  Jalur Penerimaan: <strong>{application.pathway}</strong>
                  {application.distance_km !== undefined && (
                    <span> &bull; Jarak: {formatDistanceIndonesian(application.distance_km)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Verification Actions */}
          <div className="space-y-2.5 pt-2">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => onProceedToAdminVerification(regNumber)}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl text-xs font-extrabold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>Buka Formulir Verifikasi Berkas (Mode Panitia)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                  <strong>Untuk Panitia / Admin PPDB:</strong> Masuk ke akun verifikator madrasah untuk mengubah status atau menyetujui berkas pendaftaran calon murid ini.
                </div>

                <button
                  type="button"
                  onClick={onRequestAdminLogin}
                  className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-xs font-extrabold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Masuk sebagai Panitia untuk Memverifikasi</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
