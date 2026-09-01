import React, { useState } from 'react';
import {
  X,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  Send,
  ShieldAlert,
  User,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Application, StudentProfile, User as UserType } from '../../types/sipma';
import { storageService } from '../../services/storageService';
import { useFeedback } from '../../context/FeedbackContext';

interface Props {
  registrationNumber: string;
  student?: StudentProfile | null;
  currentUser?: UserType | null;
  onClose: () => void;
  onSuccess?: (newPassword: string) => void;
}

export const ResetPasswordModal: React.FC<Props> = ({
  registrationNumber,
  student,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const { showAlert } = useFeedback();
  const [mode, setMode] = useState<'generate' | 'custom'>('generate');
  const [customPassword, setCustomPassword] = useState<string>('');
  const [generatedPassword, setGeneratedPassword] = useState<string>(() => {
    // Generate an easy-to-read default secure password e.g. sipma + 4 digits
    return `sipma${Math.floor(1000 + Math.random() * 9000)}`;
  });
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [result, setResult] = useState<{
    success: boolean;
    newPassword?: string;
    studentName?: string;
    email?: string;
    phone?: string;
  } | null>(null);

  const studentName = student?.name || registrationNumber;
  const studentEmail = student?.email || `${registrationNumber.toLowerCase()}@sipma.id`;
  const studentPhone = student?.phone || '';

  const handleGenerateNew = () => {
    setGeneratedPassword(`sipma${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    const finalPassword = mode === 'custom' ? customPassword.trim() : generatedPassword.trim();

    if (!finalPassword || finalPassword.length < 6) {
      showAlert('Password Terlalu Pendek', 'Kata sandi minimal harus 6 karakter.', 'warning');
      return;
    }

    const res = storageService.resetStudentPassword(
      registrationNumber,
      finalPassword,
      currentUser?.name || 'Administrator'
    );

    if (res.success && res.newPassword) {
      setResult({
        success: true,
        newPassword: res.newPassword,
        studentName,
        email: res.user?.email || studentEmail,
        phone: res.user?.phone || studentPhone,
      });
      if (onSuccess) {
        onSuccess(res.newPassword);
      }
    } else {
      showAlert('Gagal Reset Password', res.message, 'error');
    }
  };

  const createWhatsAppShareUrl = (pass: string) => {
    const text = `Assalamu'alaikum Wr. Wb.\n\nYth. Calon Murid / Orang Tua Wali dari *${studentName}*,\n\nBerikut adalah kredensial login akun PPDB Madrasah SIPMA Anda yang telah di-reset oleh Panitia:\n\n👤 *No. Pendaftaran:* ${registrationNumber}\n📧 *Email / Akun:* ${result?.email || studentEmail}\n🔑 *Kata Sandi Baru:* ${pass}\n\nSilakan segera login ke portal SIPMA dan simpan kata sandi ini dengan baik.\nTerima kasih.`;
    const cleanPhone = (studentPhone || '').replace(/[^0-9]/g, '');
    const targetPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.substring(1) : cleanPhone;
    return `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Reset Password Akun Murid</h3>
              <p className="text-xs text-slate-500 font-mono">
                {registrationNumber} &bull; {studentName}
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

        {!result ? (
          <form onSubmit={handleReset} className="space-y-4 text-xs">
            {/* Student Info Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
                {studentName.charAt(0)}
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="font-bold text-slate-900 truncate">{studentName}</div>
                <div className="text-slate-500 font-mono text-[11px] truncate">Email: {studentEmail}</div>
                {student?.nisn && <div className="text-slate-500 font-mono text-[11px]">NISN: {student.nisn}</div>}
              </div>
            </div>

            {/* Mode selection */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Pilihan Pembuatan Kata Sandi Baru:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('generate')}
                  className={`py-2 px-3 rounded-xl font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    mode === 'generate'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Generate Otomatis</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('custom')}
                  className={`py-2 px-3 rounded-xl font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    mode === 'custom'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Input Kustom</span>
                </button>
              </div>
            </div>

            {/* Password input/view */}
            {mode === 'generate' ? (
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-700">Password Baru yang Dibuat:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedPassword}
                    className="w-full px-3.5 py-2.5 bg-emerald-50 border border-emerald-300 rounded-xl font-mono font-bold text-emerald-900 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateNew}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
                    title="Buat Acak Lagi"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-700">Masukkan Password Baru Kustom (Min. 6 Karakter):</label>
                <input
                  type="text"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="Contoh: pass2026, madrasah123"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                Setelah di-reset, password akun calon murid ini akan langsung aktif. Anda dapat menyalin atau membagikan kredensial login ini kepada murid/orang tua.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Konfirmasi Reset Password</span>
              </button>
            </div>
          </form>
        ) : (
          /* Success Screen */
          <div className="space-y-4 text-xs animate-in fade-in">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-sm text-emerald-950">Password Berhasil Di-Reset!</h4>
              <p className="text-slate-600 text-[11px]">
                Kredensial login akun murid <strong>{result.studentName}</strong> telah diperbarui.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex justify-between items-center text-slate-600 text-[11px]">
                <span>No. Pendaftaran:</span>
                <span className="font-mono font-bold text-slate-900">{registrationNumber}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 text-[11px]">
                <span>Email Login:</span>
                <span className="font-mono font-bold text-slate-900">{result.email}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 text-[11px] pt-1 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Password Baru:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-emerald-800 text-sm bg-white px-2.5 py-1 rounded-lg border border-emerald-300">
                    {result.newPassword}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(result.newPassword || '')}
                    className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition-colors cursor-pointer"
                    title="Salin Password"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              {studentPhone && (
                <a
                  href={createWhatsAppShareUrl(result.newPassword || '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-center cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Kredensial via WA</span>
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer transition-colors"
              >
                Selesai & Tutup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
