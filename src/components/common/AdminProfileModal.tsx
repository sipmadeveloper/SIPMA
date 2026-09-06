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
} from 'lucide-react';
import { User as UserType, School } from '../../types/sipma';
import { storageService } from '../../services/storageService';
import { useFeedback } from '../../context/FeedbackContext';
import { normalizeImageUrl, handleImageError, compressAndResizeImage } from '../../utils/imageUrl';

interface Props {
  currentUser: UserType;
  currentSchool?: School | null;
  onClose: () => void;
  onProfileUpdated?: (updatedUser: UserType) => void;
}

export const AdminProfileModal: React.FC<Props> = ({
  currentUser,
  currentSchool,
  onClose,
  onProfileUpdated,
}) => {
  const { showAlert } = useFeedback();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  // Profile Form State
  const [name, setName] = useState<string>(currentUser.name || '');
  const [phone, setPhone] = useState<string>(currentUser.phone || '');
  const [nip, setNip] = useState<string>(currentUser.nip || '');
  const [position, setPosition] = useState<string>(
    currentUser.position ||
      (currentUser.role === 'admin_pusat'
        ? 'Koordinator PPDB Kanwil Kemenag'
        : currentUser.role === 'admin_sekolah'
        ? 'Ketua Panitia PPDB Madrasah'
        : 'Calon Peserta Didik Baru')
  );
  const [photoUrl, setPhotoUrl] = useState<string>(currentUser.photo_url || '');

  // Password Form State
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showOldPassword, setShowOldPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isAdminPusat = currentUser.role === 'admin_pusat';
  const isCalonMurid = currentUser.role === 'calon_murid';

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showAlert('Format Berkas Salah', 'Harap pilih berkas foto (JPG, PNG, atau WEBP).', 'warning');
      return;
    }

    try {
      // Auto compress and optimize avatar client-side
      const compressed = await compressAndResizeImage(file, 600, 600, 0.88);
      setPhotoUrl(compressed.base64);
    } catch {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const b64 = evt.target?.result as string;
        if (b64) {
          setPhotoUrl(b64);
        }
      };
      reader.readAsDataURL(file);
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
      name: name.trim(),
      phone: phone.trim(),
      nip: nip.trim(),
      position: position.trim(),
      photo_url: finalPhotoUrl.trim() || undefined,
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
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Ganti Kata Sandi</span>
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
                  <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md cursor-pointer border border-emerald-200">
                    <Upload className="w-3 h-3" />
                    <span>Pilih Foto Profil</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAvatarFileSelect}
                    />
                  </label>
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

        {/* ================= TAB 2: CHANGE PASSWORD ================= */}
        {activeTab === 'password' && (
          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] flex items-start gap-2">
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
        )}
      </div>
    </div>
  );
};
