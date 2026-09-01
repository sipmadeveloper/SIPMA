import React, { useState } from 'react';
import { User, Mail, Phone, Lock, CreditCard, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { storageService } from '../../services/storageService';
import { SystemSettings } from '../../types/sipma';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { useFeedback } from '../../context/FeedbackContext';

interface Props {
  settings?: SystemSettings | null;
  onRegisterSuccess: (email: string, regNumber: string) => void;
  onNavigateToLogin: () => void;
  onNavigateToHome: () => void;
}

export const RegisterPage: React.FC<Props> = ({
  settings,
  onRegisterSuccess,
  onNavigateToLogin,
  onNavigateToHome,
}) => {
  const { showAlert } = useFeedback();
  const [name, setName] = useState<string>('');
  const [nik, setNik] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [gender, setGender] = useState<'L' | 'P'>('L');

  const appName = settings?.app_name || 'SIPMA';
  const appTagline = settings?.app_tagline || 'Sistem Penerimaan Murid Madrasah';
  const appLogo = settings?.app_logo;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !nik || !email || !password) {
      showAlert('Peringatan Pendaftaran', 'Harap lengkapi seluruh formulir data akun yang berbintang merah (*)', 'warning');
      return;
    }

    try {
      const { registration_number } = storageService.registerStudentUser({
        name,
        nik,
        email,
        phone,
      });

      // Update gender if specified
      const student = storageService.getStudentProfile(registration_number);
      if (student) {
        student.gender = gender;
        storageService.saveStudentProfile(student);
      }

      onRegisterSuccess(email, registration_number);
    } catch (err: any) {
      showAlert('Gagal Mendaftar', err.message || 'Gagal mendaftarkan akun baru. Silakan periksa kembali data Anda.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-emerald-50/40 to-teal-50/40 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8" id="sipma-register-page">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
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
          <h2 className="text-lg sm:text-xl font-black text-slate-900">Pendaftaran Akun Baru Calon Murid</h2>
          <p className="text-xs text-slate-600 font-medium">
            {appTagline} &bull; Buat akun untuk memulai pengisian formulir pendaftaran.
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/95 backdrop-blur-xs py-8 px-6 shadow-xl rounded-2xl border border-emerald-100/90 sm:px-10 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Siswa *</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sesuai Akta Kelahiran / KK"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomor Induk Kependudukan (NIK 16 Digit) *</label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  maxLength={16}
                  value={nik}
                  onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
                  placeholder="Contoh: 3171012345670001"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Jenis Kelamin *</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'L' | 'P')}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium text-slate-800 cursor-pointer"
              >
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Aktif *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">No. WhatsApp / HP Aktif</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0812xxxxxxxx"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kata Sandi (Password) *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
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
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <span>Daftar & Lanjutkan Pengisian Formulir</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-slate-200 text-center space-y-2">
            <div className="text-xs text-slate-500">Sudah memiliki akun pendaftaran?</div>
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Masuk dengan Akun yang Ada</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
