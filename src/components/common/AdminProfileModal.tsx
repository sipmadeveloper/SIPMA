import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  ShieldCheck,
  Building2,
  Lock,
  KeyRound,
  CheckCircle2,
  Calendar,
  Award,
  FileCheck,
  Save,
  BadgeCheck,
  AlertCircle,
  GraduationCap,
  Eye,
  EyeOff,
  Camera,
  Upload,
  Loader2,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { User as UserType, School } from '../../types/sipma';
import { storageService } from '../../services/storageService';
import { useFeedback } from '../../context/FeedbackContext';
import { normalizeImageUrl, handleImageError, compressAndResizeImage } from '../../utils/imageUrl';

interface Props {
  currentUser: UserType;
  currentSchool?: School | null;
  initialTab?: 'profile' | 'password';
  onClose: () => void;
  onProfileUpdated?: (updatedUser: UserType) => void;
}

export const AdminProfileModal: React.FC<Props> = ({
  currentUser,
  currentSchool,
  initialTab = 'profile',
  onClose,
  onProfileUpdated,
}) => {
  const { showAlert, showToast } = useFeedback();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>(initialTab);

  // Profile Form State
  const [name, setName] = useState<string>(String(currentUser.name || ''));
  const [phone, setPhone] = useState<string>(String(currentUser.phone || ''));
  const [nip, setNip] = useState<string>(String(currentUser.nip || ''));
  const [position, setPosition] = useState<string>(
    String(
      currentUser.position ||
        (currentUser.role === 'admin_pusat'
          ? 'Koordinator PPDB Kanwil Kemenag'
          : currentUser.role === 'admin_sekolah'
          ? 'Ketua Panitia PPDB Madrasah'
          : 'Calon Peserta Didik Baru')
    )
  );
  const [photoUrl, setPhotoUrl] = useState<string>(String(currentUser.photo_url || ''));

  // Password Form State
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showOldPassword, setShowOldPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);

  // Self-Service Auto Reset Password State
  const [resetResultPassword, setResetResultPassword] = useState<string | null>(null);
  const [isResettingOwnPassword, setIsResettingOwnPassword] = useState<boolean>(false);
  const [copiedResetPassword, setCopiedResetPassword] = useState<boolean>(false);

  const isAdminPusat = currentUser.role === 'admin_pusat';
  const isCalonMurid = currentUser.role === 'calon_murid';

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showAlert('Format Berkas Salah', 'Harap pilih berkas foto (JPG, PNG, atau WEBP).', 'warning');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      // Auto compress and optimize avatar client-side
      const compressed = await compressAndResizeImage(file, 600, 600, 0.88);
      setPhotoUrl(compressed.base64);

      // Direct upload to Google Drive & Cloud Database
      const uploadRes = await storageService.uploadUserAvatar(
        currentUser.user_id,
        name || currentUser.name || 'Pengguna',
        compressed.base64
      );

      setIsUploadingAvatar(false);
      if (uploadRes && uploadRes.photo_url) {
        setPhotoUrl(uploadRes.photo_url);
        showAlert('Foto Profil Tersimpan', 'Foto profil berhasil diunggah ke Google Drive & Cloud Database!', 'success');
      }
    } catch (err: any) {
      setIsUploadingAvatar(false);
      console.warn('Avatar compression/upload error:', err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showAlert('Nama Wajib Diisi', 'Harap masukkan nama lengkap Anda.', 'warning');
      return;
    }

    setIsSubmitting(true);
    let finalPhotoUrl = photoUrl;

    // If new photo was picked as base64, push to Drive/Server proxy as 'user' avatar
    if (photoUrl && photoUrl.startsWith('data:image/')) {
      try {
        const uploadedUrl = await storageService.uploadLogoToDrive(
          'user',
          currentUser.user_id,
          name.trim() || 'Admin',
          photoUrl,
          `profile_${currentUser.user_id}.png`
        );
        if (uploadedUrl) {
          finalPhotoUrl = uploadedUrl;
        }
      } catch (err) {
        console.warn('Gagal upload avatar ke cloud:', err);
      }
    }

    const res = storageService.updateUserProfile(currentUser.user_id, {
      name: String(name || '').trim(),
      phone: String(phone || '').trim(),
      nip: String(nip || '').trim(),
      position: String(position || '').trim(),
      photo_url: String(finalPhotoUrl || '').trim() || undefined,
    });
    setIsSubmitting(false);

    if (res.success && res.user) {
      showAlert('Profil Disimpan', 'Data profil Anda telah berhasil diperbarui.', 'success');
      if (onProfileUpdated) {
        onProfileUpdated(res.user);
      }
    } else {
      showAlert('Gagal Menyimpan', res.message, 'error');
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showAlert('Password Terlalu Pendek', 'Password baru minimal harus 6 karakter.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('Konfirmasi Password Tidak Cocok', 'Password baru dan konfirmasi tidak sesuai.', 'warning');
      return;
    }

    setIsSubmitting(true);
    const res = storageService.changeUserPassword(currentUser.user_id, oldPassword, newPassword);
    setIsSubmitting(false);

    if (res.success) {
      showAlert('Password Berhasil Diubah', res.message, 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActiveTab('profile');
    } else {
      showAlert('Gagal Mengubah Password', res.message, 'error');
    }
  };

  const handleResetOwnPassword = () => {
    const confirmMsg = `Reset kata sandi akun ${currentUser.name} (${currentUser.email}) secara otomatis?\n\nSistem akan membuat kata sandi baru acak yang aman dan langsung mengganti sandi lama Anda di database.`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsResettingOwnPassword(true);
    const res = storageService.resetOwnPassword(currentUser.user_id);
    setIsResettingOwnPassword(false);

    if (res.success && res.newPassword) {
      setResetResultPassword(res.newPassword);
      showAlert(
        'Kata Sandi Baru Berhasil Disetel!',
        `Kata sandi akun Anda telah diperbarui di database. Kata sandi baru Anda: "${res.newPassword}". Harap salin dan simpan kata sandi ini.`,
        'success'
      );
      if (res.user && onProfileUpdated) {
        onProfileUpdated(res.user);
      }
    } else {
      showAlert('Gagal Mereset Password', res.message, 'error');
    }
  };

  const handleCopyResetPassword = (pass: string) => {
    navigator.clipboard.writeText(pass);
    setCopiedResetPassword(true);
    setTimeout(() => setCopiedResetPassword(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-2xl ${
                isAdminPusat
                  ? 'bg-rose-100 text-rose-700'
                  : isCalonMurid
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {isCalonMurid ? (
                <GraduationCap className="w-6 h-6" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                {isAdminPusat
                  ? 'Profil Administrator Pusat'
                  : isCalonMurid
                  ? 'Profil Calon Murid'
                  : 'Profil Administrator Madrasah'}
              </h3>
              <p className="text-xs text-slate-500">
                Kelola informasi akun, kontak, dan keamanan kata sandi akun Anda.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-100 text-xs font-bold gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Biodata & Informasi Akun</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'password'
                ? 'border-amber-600 text-amber-800 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-600" />
            <span>Reset & Ganti Kata Sandi</span>
          </button>
        </div>

        {/* ================= TAB 1: PROFILE INFO ================= */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            {/* Avatar & Basic Info Header */}
            <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="relative group shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-200 border-2 border-white shadow-md flex items-center justify-center">
                  {photoUrl ? (
                    <img
                      src={normalizeImageUrl(photoUrl)}
                      alt={name || 'Avatar'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageError(e)}
                    />
                  ) : (
                    <div
                      className={`w-full h-full flex items-center justify-center font-bold text-lg text-white ${
                        isAdminPusat ? 'bg-rose-600' : isCalonMurid ? 'bg-emerald-600' : 'bg-blue-600'
                      }`}
                    >
                      {(name || currentUser.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <label className="absolute inset-0 bg-black/40 text-white rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-4 h-4 mb-0.5" />
                  <span className="text-[9px] font-bold">Ganti</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarFileSelect}
                  />
                </label>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isAdminPusat
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : isCalonMurid
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}
                  >
                    {isAdminPusat
                      ? 'Admin Pusat PPDB'
                      : isCalonMurid
                      ? 'Calon Murid'
                      : 'Admin Madrasah'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">ID: {currentUser.user_id}</span>
                </div>
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {isAdminPusat
                    ? 'Administrator Wilayah / Kanwil Kemenag'
                    : isCalonMurid
                    ? `Pendaftar: ${currentUser.registration_number || '-'}`
                    : `Panitia ${currentSchool?.school_name || 'Madrasah'}`}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <label className={`inline-flex items-center gap-1 text-[10px] font-semibold ${isUploadingAvatar ? 'bg-emerald-100 text-emerald-600 cursor-not-allowed' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer'} px-2 py-1 rounded-md border border-emerald-200 transition-colors`}>
                    {isUploadingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    <span>{isUploadingAvatar ? 'Mengunggah ke Drive...' : 'Pilih Foto Profil'}</span>
                    <input
                      type="file"
                      disabled={isUploadingAvatar}
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAvatarFileSelect}
                    />
                  </label>
                  {photoUrl && (
                    <button
                      type="button"
                      disabled={isUploadingAvatar}
                      onClick={async () => {
                        setIsUploadingAvatar(true);
                        try {
                          await storageService.deleteUserAvatar(currentUser.user_id);
                          setPhotoUrl('');
                          showToast('Foto profil berhasil dihapus dari Google Drive & akun.', 'info');
                        } catch {
                          setPhotoUrl('');
                        } finally {
                          setIsUploadingAvatar(false);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-md border border-rose-200 transition-colors cursor-pointer"
                      title="Hapus foto profil dari Google Drive & akun"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus Foto</span>
                    </button>
                  )}
                  {photoUrl && photoUrl !== currentUser.photo_url && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl(currentUser.photo_url || '')}
                      className="text-[10px] text-slate-400 hover:text-rose-600 font-medium cursor-pointer"
                    >
                      Batal Ganti
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email / Akun Login</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    value={currentUser.email}
                    disabled
                    className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-mono text-xs cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nomor WhatsApp / HP</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium text-xs"
                  />
                </div>
              </div>

              {!isCalonMurid && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">NIP (Nomor Induk Pegawai)</label>
                    <input
                      type="text"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      placeholder="19xxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jabatan / Penugasan</label>
                    <input
                      type="text"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="Contoh: Ketua Tim Verifikasi"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                    />
                  </div>
                </>
              )}

              {!isAdminPusat && !isCalonMurid && currentSchool && (
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Madrasah Terikat</label>
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-700 shrink-0" />
                    <span className="font-bold">{currentSchool.school_name}</span>
                    <span className="text-[10px] text-blue-600 font-mono ml-auto">
                      NPSN: {currentSchool.npsn || '-'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Perubahan Profil</span>
              </button>
            </div>
          </form>
        )}

        {/* ================= TAB 2: CHANGE / RESET PASSWORD ================= */}
        {activeTab === 'password' && (
          <div className="space-y-5 text-xs">
            {/* FITUR RESET PASSWORD OTOMATIS AKUN SENDIRI */}
            <div className="p-4 bg-emerald-50/80 border-2 border-emerald-300/80 rounded-2xl space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-amber-700 inline-block" />
                      <span>Reset Kata Sandi Akun Sendiri (Otomatis)</span>
                      <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">1-Klik</span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Sistem akan membuat kata sandi baru yang aman secara otomatis, menggantikan kata sandi lama Anda di database secara langsung, dan menampilkannya di layar.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetOwnPassword}
                  disabled={isResettingOwnPassword}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                  title="Reset Kata Sandi Akun Sendiri Otomatis"
                >
                  {isResettingOwnPassword ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4" />
                  )}
                  <span>{isResettingOwnPassword ? 'Memproses...' : 'Reset Sandi Otomatis'}</span>
                </button>
              </div>

              {/* HASIL RESET KATA SANDI BARU */}
              {resetResultPassword && (
                <div className="p-4 bg-white border-2 border-emerald-400 rounded-xl space-y-2.5 mt-2 animate-in fade-in">
                  <div className="flex items-center gap-2 text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-xs">Kata Sandi Baru Akun Anda Siap Digunakan & Tersimpan:</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2.5 rounded-lg border border-slate-200">
                    <span className="font-mono font-black text-emerald-800 text-base tracking-wider select-all">
                      {resetResultPassword}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyResetPassword(resetResultPassword)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      {copiedResetPassword ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedResetPassword ? 'Disalin!' : 'Salin Sandi'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 italic">
                    * Harap catat kata sandi baru di atas. Kata sandi lama di database telah berhasil diperbarui.
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

            <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] flex items-start gap-2">
                <KeyRound className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  Gunakan kombinasi minimal 6 karakter untuk memastikan keamanan akun Anda dalam mengakses sistem PPDB.
                </span>
              </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Password Lama
                  <span className="text-[10px] text-slate-400 font-normal ml-1">(Opsional jika baru pertama login)</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Masukkan password saat ini..."
                    className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-2.5 top-2 p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
                    title={showOldPassword ? 'Sembunyikan Kata Sandi' : 'Tampilkan Kata Sandi'}
                  >
                    {showOldPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Password Baru (Min. 6 Karakter) *</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan password baru..."
                    className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none text-xs"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-2 p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
                    title={showNewPassword ? 'Sembunyikan Kata Sandi' : 'Tampilkan Kata Sandi'}
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ulangi Password Baru *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang password baru..."
                    className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none text-xs"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-2 p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
                    title={showConfirmPassword ? 'Sembunyikan Kata Sandi' : 'Tampilkan Kata Sandi'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Simpan Password Baru</span>
              </button>
            </div>
          </form>
          </div>
        )}
      </div>
    </div>
  );
};
