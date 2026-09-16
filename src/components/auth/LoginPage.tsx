import React, { useState } from 'react';
import {
  LogIn,
  Mail,
  ShieldCheck,
  GraduationCap,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  KeyRound,
  X,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { UserRole, SystemSettings } from '../../types/sipma';
import { normalizeImageUrl, handleImageError } from '../../utils/imageUrl';
import { storageService } from '../../services/storageService';
import { useFeedback } from '../../context/FeedbackContext';

interface Props {
  settings?: SystemSettings | null;
  onLogin: (email: string, role: UserRole) => void;
  onNavigateToRegister: () => void;
  onNavigateToHome: () => void;
}

export const LoginPage: React.FC<Props> = ({
  settings,
  onLogin,
  onNavigateToRegister,
  onNavigateToHome,
}) => {
  const { showAlert, showLoading, hideLoading } = useFeedback();
  const [selectedTab, setSelectedTab] = useState<'calon_murid' | 'admin'>('calon_murid');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotNik, setForgotNik] = useState<string>('');
  const [forgotNewPassword, setForgotNewPassword] = useState<string>('');
  const [forgotStep, setForgotStep] = useState<'verify' | 'new_password' | 'success'>('verify');
  const [verifiedUser, setVerifiedUser] = useState<any>(null);

  const appName = settings?.app_name || 'SIPMA';
  const appTagline = settings?.app_tagline || 'Sistem Penerimaan Murid Madrasah';
  const appLogo = settings?.app_logo;

  const handleTabChange = (tab: 'calon_murid' | 'admin') => {
    setSelectedTab(tab);
    setErrorMessage(null);
  };

  const handleOpenForgot = () => {
    setForgotEmail(email.trim());
    setForgotNik('');
    setForgotNewPassword('');
    setForgotStep('verify');
    setVerifiedUser(null);
    setShowForgotModal(true);
  };

  const handleVerifyStudentReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !forgotNik.trim()) {
      showAlert('Data Belum Lengkap', 'Silakan masukkan Email/No. Registrasi dan NIK siswa.', 'warning');
      return;
    }

    showLoading('Memverifikasi identitas pendaftar...');
    setTimeout(() => {
      hideLoading();
      const res = storageService.verifyStudentForPasswordReset(forgotEmail, forgotNik);
      if (!res.success) {
        showAlert('Verifikasi Gagal', res.message, 'error');
        return;
      }
      setVerifiedUser(res.user);
      setForgotStep('new_password');
    }, 400);
  };

  const handleSaveNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotNewPassword || forgotNewPassword.trim().length < 6) {
      showAlert('Peringatan', 'Kata sandi baru minimal harus 6 karakter.', 'warning');
      return;
    }

    if (!verifiedUser) return;

    showLoading('Memperbarui kata sandi akun...');
    setTimeout(() => {
      hideLoading();
      const res = storageService.resetAnyUserPassword(
        verifiedUser.user_id,
        forgotNewPassword.trim(),
        'Calon Siswa (Reset Mandiri via NIK)'
      );

      if (res.success) {
        setPassword(forgotNewPassword.trim());
        setEmail(verifiedUser.email);
        setForgotStep('success');
      } else {
        showAlert('Gagal Memperbarui', res.message, 'error');
      }
    }, 400);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Silakan masukkan alamat email yang terdaftar.');
      return;
    }
    if (!password) {
      setErrorMessage('Silakan masukkan kata sandi Anda.');
      return;
    }

    showLoading('Memverifikasi akun dan kata sandi...');

    setTimeout(() => {
      hideLoading();
      const authRes = storageService.authenticateUser(cleanEmail, password, selectedTab);

      if (!authRes.success) {
        setErrorMessage(authRes.message);
        showAlert(
          authRes.code === 'INVALID_PASSWORD' ? 'Kata Sandi Salah' : 'Gagal Masuk',
          authRes.message,
          'error'
        );
        return;
      }

      const authenticatedUser = authRes.user!;
      onLogin(authenticatedUser.email, authenticatedUser.role);
    }, 350);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-emerald-50/40 to-teal-50/40 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8" id="sipma-login-page">
      <div className="w-full max-w-md mx-auto text-center space-y-3">
        <button
          type="button"
          onClick={onNavigateToHome}
          className="inline-flex flex-col items-center justify-center gap-3 group transition-transform hover:scale-[1.02] cursor-pointer"
          title={`Kembali ke Beranda ${appName}`}
        >
          {appLogo ? (
            <img
              src={normalizeImageUrl(appLogo)}
              alt={appName}
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-2xl border-2 border-emerald-300/80 shadow-lg bg-white p-1.5"
              referrerPolicy="no-referrer"
              onError={(e) => handleImageError(e)}
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-emerald-800 to-teal-600 text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-lg border-2 border-emerald-400/40">
              {appName.charAt(0) || 'S'}
            </div>
          )}
          <span className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-950 group-hover:text-emerald-800 transition-colors">
            {appName}
          </span>
        </button>

        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-black text-slate-900">Masuk ke Portal PPDB Madrasah</h2>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed font-medium">
            {appTagline}
          </p>
        </div>
      </div>

      <div className="mt-6 w-full max-w-md mx-auto">
        <div className="bg-white/95 backdrop-blur-xs py-7 px-5 sm:px-8 shadow-xl rounded-2xl border border-emerald-100/90 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Role Select - Calon Murid vs Admin */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Masuk Sebagai:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTabChange('calon_murid')}
                  className={`py-2.5 px-3 rounded-xl font-bold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    selectedTab === 'calon_murid'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 shrink-0" />
                  <span className="truncate">Calon Murid</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange('admin')}
                  className={`py-2.5 px-3 rounded-xl font-bold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    selectedTab === 'admin'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="truncate">Admin & Operator</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {selectedTab === 'calon_murid' ? 'Email Calon Murid Terdaftar' : 'Email Admin / Operator Madrasah'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    selectedTab === 'calon_murid'
                      ? 'Masukkan email akun pendaftar...'
                      : 'Masukkan email admin atau operator madrasah...'
                  }
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">Kata Sandi</label>
                <button
                  type="button"
                  onClick={handleOpenForgot}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                >
                  Lupa Kata Sandi?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium text-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
                  title={showPassword ? 'Sembunyikan Kata Sandi' : 'Tampilkan Kata Sandi'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Masuk ke Portal</span>
            </button>
          </form>

          <div className="pt-3 border-t border-slate-200 text-center space-y-2">
            <div className="text-xs text-slate-500">
              Belum memiliki akun calon murid?
            </div>
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="inline-flex items-center justify-center gap-1 text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              <span>Daftar Akun Calon Peserta Didik Baru</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Lupa / Reset Kata Sandi */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-emerald-200" />
                <div>
                  <h3 className="font-bold text-sm leading-tight">Reset Kata Sandi Akun</h3>
                  <p className="text-[11px] text-emerald-100">Pemulihan akses portal PPDB Madrasah</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {forgotStep === 'verify' && (
                <form onSubmit={handleVerifyStudentReset} className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 leading-relaxed">
                    Untuk keamanan akun Calon Murid, silakan masukkan <strong>Email atau No. Registrasi</strong> serta <strong>16 digit NIK Siswa</strong> yang terdaftar saat pendaftaran.
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email / No. Registrasi</label>
                    <input
                      type="text"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="contoh: user@gmail.com atau REG-2026-..."
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">NIK Siswa (16 Digit)</label>
                    <input
                      type="text"
                      value={forgotNik}
                      onChange={(e) => setForgotNik(e.target.value)}
                      placeholder="Masukkan 16 digit NIK sesuai KK/KTP..."
                      maxLength={16}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium"
                      required
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Verifikasi Identitas</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-200 text-slate-500 text-[11px] leading-normal flex items-start gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      Untuk akun <strong>Admin Madrasah</strong> atau <strong>Operator</strong>, silakan hubungi Administrator Pusat PPDB Kementerian Agama untuk mengatur ulang kata sandi.
                    </span>
                  </div>
                </form>
              )}

              {forgotStep === 'new_password' && (
                <form onSubmit={handleSaveNewPassword} className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                    <p className="font-bold text-emerald-900 mb-0.5">Identitas Berhasil Diverifikasi!</p>
                    <p className="text-[11px]">Akun: <strong>{verifiedUser?.name}</strong> ({verifiedUser?.email})</p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Masukkan Kata Sandi Baru</label>
                    <input
                      type="password"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter..."
                      minLength={6}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium"
                      required
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Simpan & Terapkan Kata Sandi Baru</span>
                    </button>
                  </div>
                </form>
              )}

              {forgotStep === 'success' && (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-base text-slate-800">Kata Sandi Berhasil Diperbarui</h4>
                  <p className="text-slate-600 text-xs px-4">
                    Kata sandi baru Anda telah aktif. Form login telah terisi otomatis dengan kata sandi baru Anda.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
                    >
                      Kembali & Masuk ke Portal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
