import React from 'react';
import {
  X,
  User,
  Users,
  Building2,
  MapPin,
  Award,
  Briefcase,
  ShieldCheck,
  Calendar,
  Phone,
  Mail,
  Home,
} from 'lucide-react';
import {
  Application,
  StudentProfile,
  ParentData,
  SchoolOrigin,
  AddressData,
  School,
} from '../../types/sipma';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { formatDistanceIndonesian } from '../../utils/geo';

interface Props {
  application: Application;
  student?: StudentProfile | null;
  parent?: ParentData | null;
  schoolOrigin?: SchoolOrigin | null;
  address?: AddressData | null;
  school?: School;
  onClose: () => void;
}

export const ApplicantDetailModal: React.FC<Props> = ({
  application,
  student,
  parent,
  schoolOrigin,
  address,
  school,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
              {student?.photo_url ? (
                <img
                  src={normalizeImageUrl(student.photo_url)}
                  alt={student?.name || 'Calon Murid'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-6 h-6 text-slate-400" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                  Detail Calon Murid
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {application.registration_number}
                </span>
                <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                  Jalur {application.pathway}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 truncate mt-0.5">
                {student?.name || 'Calon Murid'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Tutup Detail Calon Murid"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Section 1: Biodata Murid */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-800 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-700" />
              <span>Identitas & Biodata Calon Murid</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Nama Lengkap:</span>
                <div className="font-bold text-slate-900 mt-0.5">{student?.name || '-'}</div>
              </div>
              <div>
                <span className="text-slate-500 font-medium">NIK:</span>
                <div className="font-bold font-mono text-slate-900 mt-0.5">{student?.nik || '-'}</div>
              </div>
              <div>
                <span className="text-slate-500 font-medium">NISN:</span>
                <div className="font-bold font-mono text-slate-900 mt-0.5">{student?.nisn || '-'}</div>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Tempat, Tanggal Lahir:</span>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {student?.birth_place || '-'}, {student?.birth_date || '-'}
                </div>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Jenis Kelamin:</span>
                <div className="font-semibold text-slate-900 mt-0.5 capitalize">
                  {student?.gender === 'L' ? 'Laki-Laki' : student?.gender === 'P' ? 'Perempuan' : '-'}
                </div>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Agama:</span>
                <div className="font-semibold text-slate-900 mt-0.5">{student?.religion || 'Islam'}</div>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Nomor Kartu Keluarga:</span>
                <div className="font-bold font-mono text-slate-900 mt-0.5">
                  {student?.family_card_number || '-'}
                </div>
              </div>
              <div>
                <span className="text-slate-500 font-medium">No. WhatsApp / HP:</span>
                <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-600" />
                  <span>{student?.phone || '-'}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Email:</span>
                <div className="font-medium text-slate-900 mt-0.5 flex items-center gap-1 truncate">
                  <Mail className="w-3 h-3 text-emerald-600" />
                  <span className="truncate">{student?.email || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Data Orang Tua / Wali */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700" />
              <span>Data Orang Tua / Wali</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Data Ayah Kandung</span>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{parent?.father_name || '-'}</div>
                <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                  <div>NIK: <span className="font-mono">{parent?.father_nik || '-'}</span></div>
                  <div>Pekerjaan: <strong>{parent?.father_job || '-'}</strong></div>
                  <div>Penghasilan: <strong>{parent?.father_income || '-'}</strong></div>
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Data Ibu Kandung</span>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{parent?.mother_name || '-'}</div>
                <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                  <div>NIK: <span className="font-mono">{parent?.mother_nik || '-'}</span></div>
                  <div>Pekerjaan: <strong>{parent?.mother_job || '-'}</strong></div>
                  <div>Penghasilan: <strong>{parent?.mother_income || '-'}</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Asal Sekolah & Alamat Domisili */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Sekolah Asal */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-700" />
                <span>Sekolah / Madrasah Asal</span>
              </h4>
              <div className="text-xs">
                <div className="font-bold text-slate-900 text-sm">{schoolOrigin?.school_name || '-'}</div>
                <div className="text-slate-500 mt-1">
                  NPSN / NSM: <span className="font-mono font-bold text-slate-700">{schoolOrigin?.npsn_nsm || '-'}</span>
                </div>
                <div className="text-slate-500 mt-0.5">
                  Alamat Sekolah: {schoolOrigin?.school_address || '-'}
                </div>
              </div>
            </div>

            {/* Alamat Domisili */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                <Home className="w-4 h-4 text-emerald-700" />
                <span>Alamat Domisili Sesuai KK</span>
              </h4>
              <div className="text-xs text-slate-800 font-medium leading-relaxed">
                {address
                  ? `${address.street_address || '-'}, RT ${address.rt || '0'}/RW ${address.rw || '0'}, Kel. ${address.village || '-'}, Kec. ${address.district || '-'}, ${address.city || '-'}, ${address.province || '-'}`
                  : 'Data alamat belum lengkap'}
              </div>
              <div className="text-[11px] text-slate-500 pt-1">
                Jarak ke madrasah: <strong>{formatDistanceIndonesian(application.distance_km)}</strong>
              </div>
            </div>
          </div>

          {/* Section 4: Data Khusus Jalur Pendaftaran */}
          {application.pathway === 'prestasi' && (
            <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200 space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-700" />
                <span>Data Sertifikat & Prestasi</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-amber-800">Nama Prestasi:</span>
                  <div className="font-bold text-slate-900 mt-0.5">{application.achievement_name || '-'}</div>
                </div>
                <div>
                  <span className="text-amber-800">Kategori:</span>
                  <div className="font-bold text-slate-900 mt-0.5 capitalize">{application.achievement_type || '-'}</div>
                </div>
                <div>
                  <span className="text-amber-800">Tingkat:</span>
                  <div className="font-bold text-slate-900 mt-0.5 capitalize">{application.achievement_level || '-'}</div>
                </div>
                <div>
                  <span className="text-amber-800">Juara / Peringkat:</span>
                  <div className="font-bold text-slate-900 mt-0.5">{application.achievement_rank || '-'}</div>
                </div>
              </div>
            </div>
          )}

          {application.pathway === 'mutasi' && (
            <div className="p-4 bg-blue-50/80 rounded-xl border border-blue-200 space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-blue-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-700" />
                <span>Data Perpindahan Tugas (Mutasi Orang Tua)</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-blue-800">Instansi / Lembaga:</span>
                  <div className="font-bold text-slate-900 mt-0.5">{application.mutation_parent_instansi || '-'}</div>
                </div>
                <div>
                  <span className="text-blue-800">Nomor Surat Tugas / SK:</span>
                  <div className="font-bold font-mono text-slate-900 mt-0.5">{application.mutation_letter_number || '-'}</div>
                </div>
                <div>
                  <span className="text-blue-800">Tanggal SK Penugasan:</span>
                  <div className="font-bold text-slate-900 mt-0.5">{application.mutation_letter_date || '-'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            Terdaftar pada: {new Date(application.created_at).toLocaleDateString('id-ID')}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
