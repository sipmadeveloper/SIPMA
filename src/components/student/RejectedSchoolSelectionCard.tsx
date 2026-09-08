import React, { useState } from 'react';
import {
  AlertTriangle,
  GraduationCap,
  MapPin,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldCheck,
  Building2,
  Sparkles,
  Lock,
} from 'lucide-react';
import { Application, School } from '../../types/sipma';
import { storageService } from '../../services/storageService';
import { calculateHaversineDistance, checkZoningCompliance, formatDistanceIndonesian } from '../../utils/geo';
import { useFeedback } from '../../context/FeedbackContext';

interface Props {
  application: Application;
  currentSchool: School;
  schools: School[];
  onTransferred: (newRegNum: string, targetSchool: School) => void;
}

export const RejectedSchoolSelectionCard: React.FC<Props> = ({
  application,
  currentSchool,
  schools,
  onTransferred,
}) => {
  const { showConfirm, showAlert, showToast, showLoading, hideLoading } = useFeedback();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [transferNotes, setTransferNotes] = useState<string>('');

  // Filter out the school that rejected the applicant
  const candidateSchools = schools.filter(
    (s) => s.status === 'active' && s.school_id !== application.school_id
  );

  // Calculate distances & quotas for candidates
  const studentLat = application.latitude || currentSchool.latitude;
  const studentLon = application.longitude || currentSchool.longitude;

  const schoolOptions = candidateSchools
    .map((s) => {
      const quotaInfo = storageService.getSchoolApplicantCount(s.school_id);
      const distance = calculateHaversineDistance(
        studentLat,
        studentLon,
        s.latitude,
        s.longitude
      );
      const isZonasi = checkZoningCompliance(distance, s.zoning_radius_km);

      return {
        school: s,
        quotaInfo,
        distance,
        isZonasi,
      };
    })
    .sort((a, b) => {
      // Prioritize schools with available quota, then by shortest distance
      if (a.quotaInfo.is_full && !b.quotaInfo.is_full) return 1;
      if (!a.quotaInfo.is_full && b.quotaInfo.is_full) return -1;
      return a.distance - b.distance;
    });

  const selectedOption = schoolOptions.find((opt) => opt.school.school_id === selectedSchoolId);

  const handleSelect = (schoolId: string, isFull: boolean, schoolName: string, applicantCount: number, totalQuota: number) => {
    if (isFull) {
      showAlert(
        'Kuota Madrasah Penuh',
        `Mohon maaf, madrasah ${schoolName} tidak dapat dipilih karena jumlah pendaftar sudah memenuhi kuota total (${applicantCount}/${totalQuota} murid). Silakan pilih madrasah lain yang masih membuka slot pendaftaran.`,
        'warning'
      );
      return;
    }
    setSelectedSchoolId(schoolId);
  };

  const handleConfirmTransfer = () => {
    if (!selectedOption) {
      showAlert('Pilih Madrasah', 'Silakan tentukan dan klik salah satu madrasah tujuan baru yang tersedia terlebih dahulu.', 'warning');
      return;
    }

    const targetSchool = selectedOption.school;

    showConfirm(
      'Konfirmasi Pemindahan Madrasah Tujuan',
      `Apakah Anda yakin ingin memindahkan seluruh berkas & data pendaftaran Anda dari ${currentSchool.school_name} ke ${targetSchool.school_name}? \n\nSetelah Anda konfirmasi, berkas Anda akan langsung masuk ke database dan antrean verifikasi panitia PPDB ${targetSchool.school_name}.`,
      () => {
        showLoading(`Memindahkan seluruh berkas ke ${targetSchool.school_name}...`);
        setTimeout(() => {
          try {
            const res = storageService.transferRejectedStudentToNewSchool(
              application.registration_number,
              targetSchool.school_id,
              transferNotes.trim() || undefined
            );

            hideLoading();
            showToast(
              `Selamat! Pendaftaran Anda berhasil dipindahkan ke ${targetSchool.school_name}. Nomor Registrasi Baru: ${res.newRegNum}`,
              'success'
            );

            onTransferred(res.newRegNum, res.targetSchool);
          } catch (err: any) {
            hideLoading();
            showAlert(
              'Gagal Memindahkan Pendaftaran',
              err?.message || 'Terjadi kesalahan saat memproses pemindahan data ke madrasah baru.',
              'error'
            );
          }
        }, 500);
      },
      {
        confirmLabel: `Ya, Pindahkan ke ${targetSchool.school_name}`,
        cancelLabel: 'Batal',
      }
    );
  };

  return (
    <div className="bg-gradient-to-br from-rose-50/90 via-white to-amber-50/50 rounded-2xl border-2 border-rose-200 shadow-sm overflow-hidden p-5 sm:p-7 space-y-6">
      {/* Alert Header */}
      <div className="flex flex-col sm:flex-row items-start gap-4 pb-5 border-b border-rose-200/80">
        <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
          <AlertTriangle className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
              STATUS: DITOLAK / TIDAK LULUS SELEKSI
            </span>
            <span className="text-xs font-bold text-slate-500">
              Madrasah Asal: {currentSchool.school_name}
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
            Pendaftaran Belum Diterima — Silakan Pilih Madrasah Tujuan Baru yang Masih Membuka Slot
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Mohon maaf, pendaftaran Anda di <strong>{currentSchool.school_name}</strong> belum memenuhi kriteria atau batas kuota penerimaan.
          </p>
          {application.verification_notes && (
            <div className="mt-2 p-3 bg-white/90 rounded-xl border border-rose-200 text-xs text-slate-700">
              <span className="font-bold text-rose-800 block mb-0.5">Catatan Panitia Verifikator:</span>
              <p className="italic">{application.verification_notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Mandatory Manual Selection Notice */}
      <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-950">
        <Sparkles className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-emerald-900 text-xs sm:text-sm">
            Pemberitahuan Hak Memilih Madrasah Alternatif
          </p>
          <p className="leading-relaxed">
            Sesuai regulasi PPDB Madrasah, berkas Anda <strong>tidak dialihkan secara otomatis tanpa persetujuan Anda</strong>. Silakan pilih salah satu madrasah di bawah ini yang masih memiliki slot kuota kosong. Begitu Anda mengonfirmasi, seluruh biodata, dokumen, dan riwayat pendaftaran Anda akan langsung terkirim ke database operator madrasah tujuan baru untuk diproses verifikasinya.
          </p>
        </div>
      </div>

      {/* School Candidates List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-emerald-700" />
            <span>Pilihan Madrasah Alternatif yang Tersedia:</span>
          </h4>
          <span className="text-[11px] text-slate-500 font-medium">
            {schoolOptions.filter((o) => !o.quotaInfo.is_full).length} madrasah membuka slot
          </span>
        </div>

        {schoolOptions.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
            Tidak ada madrasah alternatif lain yang terdaftar dalam sistem.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {schoolOptions.map(({ school, quotaInfo, distance, isZonasi }) => {
              const isSelected = selectedSchoolId === school.school_id;
              const isFull = quotaInfo.is_full;
              const code = school.school_code || (school.school_id ? school.school_id.replace(/^SCH-/, '') : 'MAN01');

              return (
                <div
                  key={school.school_id}
                  onClick={() => handleSelect(school.school_id, isFull, school.school_name, quotaInfo.applicant_count, quotaInfo.total_quota)}
                  className={`p-4 rounded-xl border-2 transition-all relative flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-white border-emerald-600 shadow-md ring-2 ring-emerald-500/20 cursor-pointer'
                      : isFull
                      ? 'bg-slate-100/70 border-rose-200/80 opacity-60 cursor-not-allowed'
                      : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-emerald-300 hover:shadow-xs cursor-pointer'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            school.level === 'MA'
                              ? 'bg-purple-100 text-purple-800'
                              : school.level === 'MTs'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {school.level}
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                          Kode: {code}
                        </span>
                        {isFull ? (
                          <span className="text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Kuota Penuh ({quotaInfo.applicant_count}/{quotaInfo.total_quota})
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Tersedia: {quotaInfo.remaining_slots} Slot
                          </span>
                        )}
                      </div>

                      <h5 className="font-bold text-sm text-slate-900 leading-snug">
                        {school.school_name}
                      </h5>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {school.address}, {school.city}
                      </p>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isFull
                          ? 'bg-rose-100 border border-rose-300 text-rose-600'
                          : 'border-2 border-slate-300 text-transparent'
                      }`}
                    >
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isFull ? (
                        <Lock className="w-3 h-3 text-rose-600" />
                      ) : null}
                    </div>
                  </div>

                  {/* Distance & Quota Details */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        Jarak: <strong>{formatDistanceIndonesian(distance)}</strong>
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isZonasi
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isZonasi ? 'Dalam Zonasi' : 'Luar Zonasi'}
                    </span>
                  </div>

                  {isFull && (
                    <div className="pt-1.5 border-t border-rose-100 text-[10px] font-semibold text-rose-700 flex items-center justify-between">
                      <span>Pendaftaran Ditutup</span>
                      <span>Kuota Terpenuhi</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation & Transfer Action Panel */}
      {selectedOption && (
        <div className="p-5 bg-white rounded-xl border-2 border-emerald-500 shadow-md space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                Madrasah Tujuan yang Anda Pilih:
              </span>
              <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-700" />
                <span>{selectedOption.school.school_name}</span>
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs bg-emerald-100 text-emerald-900 font-bold px-3 py-1 rounded-lg border border-emerald-300">
                Sisa Kuota: {selectedOption.quotaInfo.remaining_slots} Slot
              </span>
              <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-lg border border-slate-200">
                Jarak: {formatDistanceIndonesian(selectedOption.distance)}
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
            <strong>Catatan Perpindahan:</strong> Setelah Anda menekan tombol di bawah, nomor registrasi Anda akan diperbarui dengan kode madrasah baru, berkas akan masuk ke dashboard panitia PPDB <strong>{selectedOption.school.school_name}</strong>, dan Anda akan menunggu verifikasi berkas oleh panitia baru.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pesan / Catatan Tambahan Pemohon (Opsional):
            </label>
            <input
              type="text"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              placeholder="Contoh: Mengajukan pemindahan karena kuota madrasah awal telah penuh."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSelectedSchoolId(null)}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Ganti Pilihan Madrasah
            </button>

            <button
              type="button"
              onClick={handleConfirmTransfer}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              <span>Konfirmasi & Pindahkan Berkas ke {selectedOption.school.school_name}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
