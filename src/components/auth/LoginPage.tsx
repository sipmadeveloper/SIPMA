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

  const appName = settings?.app_name || 'SIPMA';
  const appTagline = settings?.app_tagline || 'Sistem Penerimaan Murid Madrasah';
  const appLogo = settings?.app_logo;

  const handleTabChange = (tab: 'calon_murid' | 'admin') => {
    setSelectedTab(tab);
    setErrorMessage(null);
  };

  const resolveAdminRole = (adminEmail: string): UserRole => {
    const existingUsers = storageService.getUsers();
    const found = existingUsers.find((u) => u.email.toLowerCase() === adminEmail.trim().toLowerCase());
    if (found && (found.role === 'admin_sekolah' || found.role === 'operator_sekolah' || found.role === 'admin_pusat')) {
      return found.role;
    }
    const lower = adminEmail.toLowerCase();
    if (lower.includes('pusat') || lower.includes('kemenag') || lower.includes('kanwil')) {
      return 'admin_pusat';
    }
    if (lower.includes('operator') || lower.includes('opr')) {
      return 'operator_sekolah';
    }
    return 'admin_sekolah';
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

    showLoading('Memverifikasi akun dan data pendaftaran...');

    setTimeout(() => {
      hideLoading();
      const existingUsers = storageService.getUsers();
      const foundUser = existingUsers.find((u) => u.email.toLowerCase() === cleanEmail);

      if (selectedTab === 'calon_murid') {
        if (!foundUser) {
          showAlert(
            'Akun Calon Murid Tidak Ditemukan',
            `Email "${cleanEmail}" belum terdaftar dalam sistem PPDB Madrasah. Silakan lakukan pendaftaran akun baru terlebih dahulu.`,
            'warning'
          );
          return;
        }

        if (foundUser.role !== 'calon_murid') {
          showAlert(
            'Peran Akun Tidak Sesuai',
            `Email "${cleanEmail}" terdaftar sebagai ${
              foundUser.role === 'admin_pusat'
                ? 'Admin Pusat'
                : foundUser.role === 'operator_sekolah'
                ? 'Operator Madrasah'
                : 'Admin Madrasah'
            }. Silakan pilih tab "Admin & Operator" untuk masuk.`,
            'warning'
          );
          return;
        }

        onLogin(cleanEmail, 'calon_murid');
      } else {
        // Admin / Operator tab
        if (!foundUser || (foundUser.role !== 'admin_sekolah' && foundUser.role !== 'operator_sekolah' && foundUser.role !== 'admin_pusat')) {
          // Check if it matches an admin/operator email pattern
          const resolvedRole = resolveAdminRole(cleanEmail);
          if (
            cleanEmail.includes('admin') ||
            cleanEmail.includes('madrasah') ||
            cleanEmail.includes('kemenag') ||
            cleanEmail.includes('operator') ||
            cleanEmail.includes('opr')
          ) {
            onLogin(cleanEmail, resolvedRole);
            return;
          }

          showAlert(
            'Akun Tidak Ditemukan',
            `Email "${cleanEmail}" tidak terdaftar sebagai Administrator Madrasah, Operator Madrasah, ataupun Admin Pusat. Hubungi panitia madrasah Anda untuk verifikasi hak akses.`,
            'error'
          );
          return;
        }

        onLogin(cleanEmail, foundUser.role);
      }
    }, 450);
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
              <label className="block font-semibold text-slate-700 mb-1">Kata Sandi</label>
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
    </div>
  );
};
