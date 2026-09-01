import React, { useState } from 'react';
import {
  X,
  CheckCircle,
  AlertCircle,
  XCircle,
  FileText,
  MapPin,
  User,
  Users,
  ExternalLink,
  ShieldCheck,
  Download,
  Image as ImageIcon,
  FolderDown,
  KeyRound,
} from 'lucide-react';
import {
  Application,
  StudentProfile,
  ParentData,
  SchoolOrigin,
  AddressData,
  DocumentItem,
  School,
} from '../../types/sipma';
import { formatDistanceIndonesian, formatCoordinates } from '../../utils/geo';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { InteractiveLocationPicker } from '../map/InteractiveLocationPicker';
import { useFeedback } from '../../context/FeedbackContext';
import { downloadDocumentFile, downloadAllStudentDocuments } from '../../utils/fileDownload';
import { ResetPasswordModal } from '../common/ResetPasswordModal';

interface Props {
  application: Application;
  student?: StudentProfile | null;
  parent?: ParentData | null;
  schoolOrigin?: SchoolOrigin | null;
  address?: AddressData | null;
  documents: DocumentItem[];
  school: School;
  initialTab?: 'profile' | 'location' | 'docs';
  onClose: () => void;
  onVerify: (status: 'terverifikasi' | 'perlu_perbaikan' | 'ditolak', notes: string) => void;
}

export const VerificationModal: React.FC<Props> = ({
  application,
  student,
  parent,
  schoolOrigin,
  address,
  documents,
  school,
  initialTab = 'profile',
  onClose,
  onVerify,
}) => {
  const { showAlert } = useFeedback();
  const [notes, setNotes] = useState<string>(application.verification_notes || '');
  const [activeTab, setActiveTab] = useState<'profile' | 'location' | 'docs'>(initialTab);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);

  const handleAction = (status: 'terverifikasi' | 'perlu_perbaikan' | 'ditolak') => {
    if (status === 'perlu_perbaikan' && !notes.trim()) {
      showAlert(
        'Catatan Perbaikan Diperlukan',
        'Harap tuliskan catatan instruksi perbaikan agar calon murid mengetahui bagian mana yang perlu diperbaiki.',
        'warning'
      );
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      onVerify(status, notes);
      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Verifikasi Berkas Calon Peserta Didik
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">
              {student?.name || application.registration_number}
            </h3>
            <div className="text-xs text-slate-500 font-mono">
              No: {application.registration_number} | Jalur:{' '}
              <strong className="uppercase text-slate-800">{application.pathway}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowResetPassword(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="Reset Password Akun Murid Ini"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-700" />
              <span>Reset Password Akun</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-4 border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-emerald-600 text-emerald-800 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Biodata & Keluarga
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('location')}
            className={`py-3 px-4 border-b-2 transition-colors ${
              activeTab === 'location'
                ? 'border-emerald-600 text-emerald-800 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Lokasi Rumah & Zonasi ({formatDistanceIndonesian(application.distance_km)})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('docs')}
            className={`py-3 px-4 border-b-2 transition-colors ${
              activeTab === 'docs'
                ? 'border-emerald-600 text-emerald-800 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Dokumen Persyaratan ({documents.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Pribadi */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>Data Pribadi</span>
                  </h4>
                  {student?.photo_url && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ✓ Foto Profil Tersedia
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start gap-4">
                  {student?.photo_url && (
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <div className="w-24 h-32 rounded-xl overflow-hidden border border-slate-300 bg-white shadow-xs">
                        <img
                          src={normalizeImageUrl(student.photo_url)}
                          alt={student.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = normalizeImageUrl(student.photo_url!);
                          link.download = `PasFoto_${student.registration_number}.jpg`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                        title="Unduh Pas Foto Calon Murid"
                      >
                        <Download className="w-3 h-3" />
                        <span>Unduh Foto</span>
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
                    <div>
                      <span className="text-slate-500">Nama Lengkap:</span>
                      <div className="font-semibold text-slate-900">{student?.name || '-'}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">NIK / NISN:</span>
                      <div className="font-semibold text-slate-900">
                        {student?.nik} / {student?.nisn || '-'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Jenis Kelamin / Agama:</span>
                      <div className="font-semibold text-slate-900">
                        {student?.gender === 'L' ? 'Laki-laki' : 'Perempuan'} / {student?.religion}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Tempat, Tgl Lahir:</span>
                      <div className="font-semibold text-slate-900">
                        {student?.birth_place || '-'}, {student?.birth_date || '-'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">No. Kartu Keluarga:</span>
                      <div className="font-semibold text-slate-900 font-mono">
                        {student?.family_card_number || '-'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">WhatsApp / Email:</span>
                      <div className="font-semibold text-slate-900">
                        {student?.phone} / {student?.email}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Orang Tua */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>Data Orang Tua / Wali</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500">Nama Ayah:</span>
                    <div className="font-semibold text-slate-900">{parent?.father_name || '-'}</div>
                    <div className="text-[11px] text-slate-500">{parent?.father_job} ({parent?.father_income})</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Nama Ibu:</span>
                    <div className="font-semibold text-slate-900">{parent?.mother_name || '-'}</div>
                    <div className="text-[11px] text-slate-500">{parent?.mother_job} ({parent?.mother_income})</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Sekolah Asal:</span>
                    <div className="font-semibold text-slate-900">{schoolOrigin?.school_name || '-'}</div>
                    <div className="text-[11px] text-slate-500">NPSN: {schoolOrigin?.npsn_nsm || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Alamat */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-500 font-semibold mb-1">Alamat Domisili Sesuai KK:</div>
                <div className="text-slate-900 font-medium">
                  {address
                    ? `${address.street_address}, RT ${address.rt}/RW ${address.rw}, Kel. ${address.village}, Kec. ${address.district}, ${address.city}, ${address.province}`
                    : 'Belum diisi'}
                </div>
              </div>

              {/* Data Khusus Jalur Prestasi / Mutasi */}
              {application.pathway === 'prestasi' && (
                <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2">
                  <h4 className="font-bold text-sm text-amber-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Data Jalur Prestasi (Akademik/Non-Akademik/Tahfidz)</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-amber-800/80">Kategori:</span>
                      <div className="font-semibold text-slate-900 capitalize">{application.achievement_type || '-'}</div>
                    </div>
                    <div>
                      <span className="text-amber-800/80">Tingkat:</span>
                      <div className="font-semibold text-slate-900 capitalize">{application.achievement_level || '-'}</div>
                    </div>
                    <div>
                      <span className="text-amber-800/80">Nama Prestasi:</span>
                      <div className="font-semibold text-slate-900">{application.achievement_name || '-'}</div>
                    </div>
                    <div>
                      <span className="text-amber-800/80">Peringkat / Capaian:</span>
                      <div className="font-semibold text-slate-900">{application.achievement_rank || '-'}</div>
                    </div>
                  </div>
                </div>
              )}

              {application.pathway === 'mutasi' && (
                <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 space-y-2">
                  <h4 className="font-bold text-sm text-blue-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-700" />
                    <span>Data Jalur Perpindahan Tugas Orang Tua (Mutasi)</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-blue-800/80">Instansi / Perusahaan:</span>
                      <div className="font-semibold text-slate-900">{application.mutation_parent_instansi || '-'}</div>
                    </div>
                    <div>
                      <span className="text-blue-800/80">Nomor SK / Surat Tugas:</span>
                      <div className="font-semibold text-slate-900 font-mono">{application.mutation_letter_number || '-'}</div>
                    </div>
                    <div>
                      <span className="text-blue-800/80">Tanggal SK / Penugasan:</span>
                      <div className="font-semibold text-slate-900">{application.mutation_letter_date || '-'}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'location' && (
            <div className="space-y-4">
              <InteractiveLocationPicker
                school={school}
                initialLat={application.latitude}
                initialLng={application.longitude}
                readOnly={true}
              />
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="space-y-3">
              {documents.length > 0 && (
                <div className="flex items-center justify-between bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                  <div className="text-xs text-emerald-900 font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Total {documents.length} Berkas Persyaratan Terdaftar</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      downloadAllStudentDocuments(documents, student?.name);
                      showAlert(
                        'Mengunduh Seluruh Berkas',
                        `Memulai pengunduhan ${documents.length} berkas calon murid ${student?.name || ''}...`,
                        'success'
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    title="Unduh seluruh berkas pendaftar ini langsung ke komputer"
                  >
                    <FolderDown className="w-3.5 h-3.5" />
                    <span>Unduh Semua Berkas</span>
                  </button>
                </div>
              )}

              {documents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  Belum ada dokumen yang diunggah oleh calon murid.
                </div>
              ) : (
                documents.map((doc) => {
                  const isImage =
                    doc.file_data_base64?.startsWith('data:image') ||
                    doc.document_type === 'foto' ||
                    /\.(jpg|jpeg|png|webp)$/i.test(doc.file_name);

                  return (
                    <div
                      key={doc.document_id}
                      className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        {isImage && (doc.file_data_base64 || doc.drive_url) ? (
                          <a
                            href={normalizeImageUrl(doc.file_data_base64 || doc.drive_url)}
                            target="_blank"
                            rel="noreferrer"
                            className="w-12 h-12 rounded-lg overflow-hidden border border-slate-300 bg-white shrink-0 hover:opacity-90 block"
                            title="Klik untuk perbesar gambar"
                          >
                            <img
                              src={normalizeImageUrl(doc.file_data_base64 || doc.drive_url)}
                              alt={doc.document_title}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </a>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                            <span>{doc.document_title}</span>
                            {isImage && (
                              <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.5 rounded">
                                Foto / Gambar
                              </span>
                            )}
                          </div>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            {doc.file_name} ({doc.file_size_kb} KB) • Diunggah:{' '}
                            {new Date(doc.upload_time).toLocaleDateString('id-ID')}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Direct Download Button */}
                        <button
                          type="button"
                          onClick={() => downloadDocumentFile(doc, student?.name)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                          title="Unduh langsung berkas ini ke komputer tanpa buka Google Drive"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Unduh Berkas</span>
                        </button>

                        {doc.file_data_base64 && (
                          <a
                            href={doc.file_data_base64}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold"
                          >
                            Preview
                          </a>
                        )}
                        <a
                          href={doc.drive_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                        >
                          <span>Buka Tab Baru</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Verification Notes Input */}
          <div className="pt-4 border-t border-slate-200">
            <label className="block font-bold text-slate-800 mb-1">
              Catatan Verifikasi / Alasan Perbaikan
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Titik rumah dan dokumen KK valid / Berkas foto KK buram mohon upload ulang..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Status saat ini: <strong className="uppercase">{application.verification_status}</strong>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleAction('perlu_perbaikan')}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-xs transition-colors"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Perlu Perbaikan</span>
            </button>

            <button
              type="button"
              onClick={() => handleAction('ditolak')}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors"
            >
              <XCircle className="w-4 h-4" />
              <span>Tolak Berkas</span>
            </button>

            <button
              type="button"
              onClick={() => handleAction('terverifikasi')}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Setujui (Valid / Terverifikasi)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reset Password Modal Overlay */}
      {showResetPassword && (
        <ResetPasswordModal
          registrationNumber={application.registration_number}
          student={student}
          onClose={() => setShowResetPassword(false)}
        />
      )}
    </div>
  );
};
