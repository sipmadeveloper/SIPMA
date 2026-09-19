import React, { useState, useRef } from 'react';
import {
  User as UserIcon,
  Camera,
  Upload,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Shield,
  School as SchoolIcon,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  BadgeCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  StudentProfile,
  Application,
  School,
  User,
  DocumentItem,
} from '../../types/sipma';
import { normalizeImageUrl, handleImageError, compressAndResizeImage, extractDriveFileId, clearImageUrlCache } from '../../utils/imageUrl';
import { storageService } from '../../services/storageService';
import { useFeedback } from '../../context/FeedbackContext';
import { formatStandardDocumentFileName } from '../../utils/fileDownload';

interface Props {
  student: StudentProfile;
  application: Application;
  school: School;
  currentUser?: User | null;
  initialTab?: 'profile' | 'password';
  onRefresh: () => void;
  onBack: () => void;
}

export const StudentProfileView: React.FC<Props> = ({
  student: initialStudent,
  application,
  school,
  currentUser,
  initialTab = 'profile',
  onRefresh,
  onBack,
}) => {
  const { showAlert } = useFeedback();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>(initialTab);
  const [student, setStudent] = useState<StudentProfile>({ ...initialStudent });
  const [photoUrl, setPhotoUrl] = useState<string>(student.photo_url || currentUser?.photo_url || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password state
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showOldPassword, setShowOldPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);

  // Self-Service Auto Reset Password State
  const [resetResultPassword, setResetResultPassword] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(false);
  const [copiedResetPassword, setCopiedResetPassword] = useState<boolean>(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Format file harus berupa gambar (JPG, PNG, atau WEBP).');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    try {
      const compressed = await compressAndResizeImage(file, 600, 600, 0.88);
      setPhotoUrl(compressed.base64);
      setStudent((prev) => ({ ...prev, photo_url: compressed.base64 }));
      setSuccessMsg('Foto profil dipilih & dioptimalkan. Klik "Simpan Perubahan" untuk menyimpan ke cloud.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setPhotoUrl(base64);
        setStudent((prev) => ({ ...prev, photo_url: base64 }));
        setSuccessMsg('Foto profil berhasil dipilih. Klik "Simpan Perubahan" untuk menyimpan ke cloud.');
        setTimeout(() => setSuccessMsg(null), 3500);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl('');
    setStudent((prev) => ({ ...prev, photo_url: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const updatedProfile: StudentProfile = {
        ...student,
        photo_url: photoUrl,
      };

      storageService.saveStudentProfile(updatedProfile);
      setStudent(updatedProfile);

      // If photoUrl is empty, delete previous photo doc and clean Drive
      if (!photoUrl) {
        const existingDocs = storageService.getDocumentsByRegistration(student.registration_number);
        const fotoDoc = existingDocs.find((d) => d.document_type === 'foto' || d.document_type === 'pas_foto');
        if (fotoDoc) {
          await storageService.deleteDocumentPermanently(fotoDoc.document_id);
        } else if (currentUser?.user_id) {
          await storageService.deleteUserAvatar(currentUser.user_id);
        }
      } else if (photoUrl.startsWith('data:image')) {
        // Only trigger upload if a newly selected photo base64 exists
        const standardFileName = formatStandardDocumentFileName({
          accountName: student.name,
          registrationNumber: student.registration_number,
          documentType: 'foto',
          documentTitle: 'Pas Foto 3x4 Calon Murid',
          extension: 'jpg',
        });

        const existingDocs = storageService.getDocumentsByRegistration(student.registration_number);
        const fotoDoc = existingDocs.find((d) => d.document_type === 'foto' || d.document_type === 'pas_foto');
        const oldDriveId = extractDriveFileId(fotoDoc?.drive_file_id || fotoDoc?.drive_url || student.photo_url) || '';
        if (oldDriveId) {
          clearImageUrlCache(oldDriveId);
        }
        let effectiveDoc: DocumentItem;
        if (fotoDoc) {
          effectiveDoc = {
            ...fotoDoc,
            file_name: standardFileName,
            file_data_base64: photoUrl,
            old_drive_file_id: oldDriveId,
            upload_time: new Date().toISOString(),
          };
        } else {
          effectiveDoc = {
            document_id: `DOC-FOTO-${Date.now()}`,
            registration_number: student.registration_number,
            student_id: student.student_id || `STD-${Date.now()}`,
            document_type: 'foto',
            document_title: 'Pas Foto 3x4 Calon Murid',
            file_name: standardFileName,
            file_size_kb: Math.round((photoUrl.length * 0.75) / 1024),
            file_data_base64: photoUrl,
            upload_time: new Date().toISOString(),
            verification_status: 'menunggu',
          };
        }
        storageService.saveDocument(effectiveDoc, student.name, school?.school_name);
        const uploadRes = await storageService.uploadDocumentToDrive(
          effectiveDoc,
          student.name,
          school?.school_name,
          {
            schoolId: school?.school_id,
            accountName: student.name,
            accountId: currentUser?.user_id || student.registration_number,
          }
        );

        if (uploadRes?.file?.drive_url || uploadRes?.file?.thumbnail_url) {
          const drivePhotoUrl = uploadRes.file.thumbnail_url || uploadRes.file.drive_url;
          updatedProfile.photo_url = drivePhotoUrl;
          storageService.saveStudentProfile(updatedProfile);
          setPhotoUrl(drivePhotoUrl);
          setStudent(updatedProfile);
        }
      }

      showAlert('Perubahan Profil Tersimpan', 'Data profil dan foto calon murid berhasil disimpan ke database dan Google Drive!', 'success');
      onRefresh();
    } catch (err: any) {
      showAlert('Gagal Menyimpan Profil', err.message || 'Terjadi kesalahan saat menyimpan perubahan profil.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showAlert('Password Terlalu Pendek', 'Password baru minimal harus 6 karakter.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('Konfirmasi Tidak Sesuai', 'Kata sandi baru dan konfirmasi kata sandi tidak cocok.', 'warning');
      return;
    }

    const userId = student.user_id || currentUser?.user_id || `USR-${student.registration_number}`;
    setIsChangingPassword(true);
    const res = storageService.changeUserPassword(userId, oldPassword, newPassword);
    setIsChangingPassword(false);

    if (res.success) {
      showAlert('Kata Sandi Berhasil Diubah', 'Kata sandi akun Anda telah diperbarui. Harap gunakan sandi baru ini saat masuk berikutnya.', 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActiveTab('profile');
    } else {
      showAlert('Gagal Mengubah Kata Sandi', res.message, 'error');
    }
  };

  const handleResetOwnPassword = () => {
    const confirmMsg = `Reset kata sandi akun calon siswa atas nama ${student.name} secara otomatis?\n\nSistem akan membuat kata sandi baru acak yang aman dan langsung mengganti sandi lama Anda di database.`;
    if (!window.confirm(confirmMsg)) return;

    const targetIdentifier = student.user_id || currentUser?.user_id || student.registration_number;
    setIsResettingPassword(true);
    const res = storageService.resetOwnPassword(targetIdentifier);
    setIsResettingPassword(false);

    if (res.success && res.newPassword) {
      setResetResultPassword(res.newPassword);
      showAlert(
        'Kata Sandi Baru Berhasil Disetel!',
        `Kata sandi akun Anda telah diperbarui di database menjadi "${res.newPassword}". Harap salin dan simpan kata sandi ini.`,
        'success'
      );
      onRefresh();
    } else {
      showAlert('Gagal Mereset Kata Sandi', res.message, 'error');
    }
  };

  const handleCopyResetPassword = (pass: string) => {
    navigator.clipboard.writeText(pass);
    setCopiedResetPassword(true);
    setTimeout(() => setCopiedResetPassword(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" id="sipma-student-profile-view">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-slate-700 hover:text-emerald-700 flex items-center gap-1.5 cursor-pointer w-fit"
        >
          ← Kembali ke Dashboard
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-mono bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            No. Pendaftaran: <strong className="text-emerald-800 font-bold">{student.registration_number}</strong>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-5 pt-3 rounded-2xl border shadow-xs gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`pb-3 px-3 border-b-2 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'profile'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          <span>Biodata & Pas Foto</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('password')}
          className={`pb-3 px-3 border-b-2 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'password'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Keamanan & Ganti Kata Sandi</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs font-bold text-rose-900 flex items-center gap-2 shadow-xs animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: Profile Form */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photo Upload Section */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-700" />
                Foto Profil Calon Murid
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Unggah pas foto resmi calon peserta didik (disarankan rasio 3x4 atau persegi, latar belakang merah/biru/polos).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Avatar Preview */}
              <div className="relative group">
                <div className="w-32 h-40 sm:w-36 sm:h-48 rounded-2xl border-2 border-dashed border-slate-300 overflow-hidden bg-slate-50 flex items-center justify-center shadow-sm">
                  {photoUrl ? (
                    <img
                      src={normalizeImageUrl(photoUrl)}
                      alt={student.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageError(e)}
                    />
                  ) : (
                    <div className="text-center p-4 text-slate-400">
                      <UserIcon className="w-12 h-12 mx-auto mb-1 opacity-50" />
                      <span className="text-[11px] font-semibold">Belum Ada Foto</span>
                      <span className="block text-[9px] text-slate-400 mt-0.5">Pas Foto 3 x 4</span>
                    </div>
                  )}
                </div>

                {photoUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute -top-2 -right-2 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md transition-colors cursor-pointer"
                    title="Hapus Foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-3 text-center sm:text-left">
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    id="student-photo-upload-input"
                  />
                  <label
                    htmlFor="student-photo-upload-input"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Pilih & Unggah Foto Baru</span>
                  </label>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1">
                  <p>• Format yang didukung: <strong>JPG, PNG, WEBP</strong> (Maks. 3 MB)</p>
                  <p>• Foto ini akan otomatis ditampilkan pada <strong>Kartu Bukti Pendaftaran Resmi</strong> dan identitas akun murid.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Identity Information Section */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-emerald-700" />
                Data Pribadi Calon Peserta Didik
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Informasi dasar akun pendaftaran calon murid.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Lengkap Calon Murid *
                </label>
                <input
                  type="text"
                  value={student.name}
                  onChange={(e) => setStudent({ ...student, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nomor WhatsApp / HP Calon Murid *
                </label>
                <input
                  type="tel"
                  value={student.phone || ''}
                  onChange={(e) => setStudent({ ...student, phone: e.target.value })}
                  placeholder="081234567890"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alamat Email Terdaftar
                </label>
                <input
                  type="email"
                  value={student.email || currentUser?.email || ''}
                  readOnly
                  className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 outline-none cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nomor Induk Kependudukan (NIK) *
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={student.nik}
                  onChange={(e) => setStudent({ ...student, nik: e.target.value.replace(/\D/g, '') })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nomor Induk Siswa Nasional (NISN)
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={student.nisn || ''}
                  onChange={(e) => setStudent({ ...student, nisn: e.target.value.replace(/\D/g, '') })}
                  placeholder="10 Digit NISN"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Jenis Kelamin</label>
                <select
                  value={student.gender}
                  onChange={(e) => setStudent({ ...student, gender: e.target.value as 'L' | 'P' })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none cursor-pointer"
                >
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Agama</label>
                <select
                  value={student.religion}
                  onChange={(e) => setStudent({ ...student, religion: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none cursor-pointer"
                >
                  <option value="Islam">Islam</option>
                  <option value="Kristen">Kristen</option>
                  <option value="Katolik">Katolik</option>
                  <option value="Hindu">Hindu</option>
                  <option value="Buddha">Buddha</option>
                  <option value="Khonghucu">Khonghucu</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tempat Lahir</label>
                <input
                  type="text"
                  value={student.birth_place || ''}
                  onChange={(e) => setStudent({ ...student, birth_place: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tanggal Lahir</label>
                <input
                  type="date"
                  value={student.birth_date || ''}
                  onChange={(e) => setStudent({ ...student, birth_date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* Account & Registration Summary Card */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-xs space-y-4">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <SchoolIcon className="w-4 h-4 text-emerald-700" />
              Informasi Registrasi PPDB
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Nomor Registrasi</div>
                <div className="font-mono font-bold text-emerald-800 text-sm mt-0.5">
                  {student.registration_number}
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Madrasah Tujuan</div>
                <div className="font-bold text-slate-900 text-sm mt-0.5">
                  {application?.school_id ? (
                    school.school_name
                  ) : (
                    <span className="text-amber-700 font-semibold italic text-xs">
                      - (Belum Memilih Madrasah)
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Jalur & Status</div>
                <div className="font-bold text-slate-900 text-sm mt-0.5 capitalize">
                  Jalur {application.pathway} ({application.final_status})
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan Biodata'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Change / Reset Password */}
      {activeTab === 'password' && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-700" />
              Kelola Kata Sandi Akun Siswa
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Reset otomatis atau ubah kata sandi akun pendaftaran Anda secara mandiri untuk menjaga keamanan akun.
            </p>
          </div>

          {/* FITUR RESET KATA SANDI OTOMATIS */}
          <div className="p-4 sm:p-5 bg-emerald-50/80 border-2 border-emerald-300 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-amber-700 inline-block" />
                    <span>Reset Kata Sandi Akun Siswa (Otomatis)</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">1-Klik</span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Sistem akan membuat kata sandi baru secara otomatis, mengganti kata sandi lama Anda di database secara langsung, dan menampilkannya di layar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetOwnPassword}
                disabled={isResettingPassword}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                title="Reset Kata Sandi Akun Siswa Otomatis"
              >
                {isResettingPassword ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4" />
                )}
                <span>{isResettingPassword ? 'Memproses...' : 'Reset Sandi Otomatis'}</span>
              </button>
            </div>

            {/* HASIL RESET KATA SANDI BARU */}
            {resetResultPassword && (
              <div className="p-4 bg-white border-2 border-emerald-400 rounded-xl space-y-2.5 mt-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-xs">Kata Sandi Baru Akun Anda Berhasil Disimpan di Database:</span>
                </div>
                <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2.5 rounded-lg border border-slate-200">
                  <span className="font-mono font-black text-emerald-800 text-base tracking-wider select-all">
                    {resetResultPassword}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyResetPassword(resetResultPassword)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    {copiedResetPassword ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedResetPassword ? 'Disalin!' : 'Salin Sandi'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 italic">
                  * Harap catat kata sandi baru ini. Sandi lama di database telah diganti dan Anda dapat login menggunakan no. pendaftaran dan sandi baru ini.
                </p>
              </div>
            )}
          </div>

          {/* DIVIDER */}
          <div className="relative flex py-1 items-center">
            <div className="grow border-t border-slate-200"></div>
            <span className="shrink mx-3 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              Atau Ubah Kata Sandi Secara Manual
            </span>
            <div className="grow border-t border-slate-200"></div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-6">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 text-xs flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Tips Keamanan Kata Sandi</span>
              <p className="text-[11px] text-emerald-800">
                Gunakan minimal 6 karakter. Pastikan Anda mengingat atau mencatat kata sandi baru ini. Anda dapat masuk ke SIPMA menggunakan email terdaftar atau nomor pendaftaran Anda.
              </p>
            </div>
          </div>

          <div className="space-y-4 max-w-lg text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Kata Sandi Lama
                <span className="text-[11px] text-slate-400 font-normal ml-1">(Opsional jika baru pertama kali login)</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Masukkan kata sandi lama Anda..."
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
                  title={showOldPassword ? 'Sembunyikan Kata Sandi' : 'Tampilkan Kata Sandi'}
                >
                  {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Kata Sandi Baru (Minimal 6 Karakter) *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Masukkan kata sandi baru..."
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
                  title={showNewPassword ? 'Sembunyikan Kata Sandi' : 'Tampilkan Kata Sandi'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Konfirmasi Kata Sandi Baru *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang kata sandi baru..."
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
                  title={showConfirmPassword ? 'Sembunyikan Kata Sandi' : 'Tampilkan Kata Sandi'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isChangingPassword}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isChangingPassword ? 'Menyimpan...' : 'Perbarui Kata Sandi Saya'}</span>
            </button>
          </div>
        </form>
        </div>
      )}
    </div>
  );
};
