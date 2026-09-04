import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  UserPlus,
  Search,
  KeyRound,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Shield,
  Phone,
  Mail,
  FileCheck2,
  AlertTriangle,
  Award,
  Share2,
} from 'lucide-react';
import { User as UserType, School } from '../../types/sipma';
import { storageService } from '../../services/storageService';
import { useFeedback } from '../../context/FeedbackContext';

interface Props {
  school: School;
  currentUser?: UserType | null;
  onRefreshData?: () => void;
}

export const SchoolOperatorManagement: React.FC<Props> = ({
  school,
  currentUser,
  onRefreshData,
}) => {
  const { showToast, showAlert, showConfirm } = useFeedback();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal states
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<UserType | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    nip: '',
    position: 'Operator Seleksi & Verifikasi PPDB',
    password: '',
    status: 'active' as 'active' | 'inactive',
  });

  // Reset Password Modal
  const [resetModalOperator, setResetModalOperator] = useState<UserType | null>(null);
  const [customNewPass, setCustomNewPass] = useState('');

  // Result dialog for showing newly generated or reset credentials
  const [credentialsModal, setCredentialsModal] = useState<{
    operator: UserType;
    password?: string;
    isNew: boolean;
  } | null>(null);

  const [copiedKey, setCopiedKey] = useState(false);

  // Fetch operators belonging to this school
  const allUsers = storageService.getUsers();
  const schoolOperators = useMemo(() => {
    return allUsers.filter(
      (u) => u.role === 'operator_sekolah' && u.school_id === school.school_id
    );
  }, [allUsers, school.school_id]);

  // Filtered operators
  const filteredOperators = useMemo(() => {
    return schoolOperators.filter((op) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        op.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        op.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (op.nip && op.nip.includes(searchQuery)) ||
        (op.phone && op.phone.includes(searchQuery)) ||
        (op.position && op.position.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' || op.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [schoolOperators, searchQuery, statusFilter]);

  const activeCount = schoolOperators.filter((op) => op.status === 'active').length;
  const inactiveCount = schoolOperators.filter((op) => op.status === 'inactive').length;

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingOperator(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      nip: '',
      position: 'Operator Seleksi & Verifikasi PPDB',
      password: '',
      status: 'active',
    });
    setIsAddEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (operator: UserType) => {
    setEditingOperator(operator);
    setFormData({
      name: operator.name,
      email: operator.email,
      phone: operator.phone || '',
      nip: operator.nip || '',
      position: operator.position || 'Operator Seleksi & Verifikasi PPDB',
      password: '',
      status: operator.status || 'active',
    });
    setIsAddEditModalOpen(true);
  };

  // Save Operator
  const handleSaveOperator = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showAlert('Validasi Gagal', 'Nama lengkap operator wajib diisi.', 'error');
      return;
    }
    if (!formData.email.trim()) {
      showAlert('Validasi Gagal', 'Alamat email login wajib diisi.', 'error');
      return;
    }

    const res = storageService.saveSchoolOperatorUser(
      {
        user_id: editingOperator ? editingOperator.user_id : undefined,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        school_id: school.school_id,
        nip: formData.nip,
        position: formData.position,
        password: formData.password || undefined,
        status: formData.status,
      },
      currentUser?.name || 'Admin Madrasah'
    );

    if (res.success && res.user) {
      setIsAddEditModalOpen(false);
      if (onRefreshData) onRefreshData();

      if (!editingOperator) {
        // Show credentials ready dialog with copyable login info
        setCredentialsModal({
          operator: res.user,
          password: res.generatedPassword,
          isNew: true,
        });
      } else {
        showToast(res.message, 'success', 'Berhasil Disimpan');
      }
    } else {
      showAlert('Gagal Menyimpan Akun', res.message, 'error');
    }
  };

  // Toggle status
  const handleToggleStatus = (operator: UserType) => {
    const res = storageService.toggleUserStatus(operator.user_id);
    if (res.success) {
      showToast(res.message, 'info', 'Status Operator Diperbarui');
      if (onRefreshData) onRefreshData();
    } else {
      showAlert('Gagal Mengubah Status', res.message, 'error');
    }
  };

  // Perform Reset Password
  const handlePerformReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalOperator) return;

    const res = storageService.resetSchoolOperatorPassword(
      resetModalOperator.user_id,
      customNewPass.trim() || undefined,
      currentUser?.name || 'Admin Madrasah'
    );

    if (res.success && res.user && res.newPassword) {
      setCredentialsModal({
        operator: res.user,
        password: res.newPassword,
        isNew: false,
      });
      setResetModalOperator(null);
      setCustomNewPass('');
      if (onRefreshData) onRefreshData();
    } else {
      showAlert('Gagal Mereset Kata Sandi', res.message, 'error');
    }
  };

  // Delete operator
  const handleDeleteOperator = (operator: UserType) => {
    showConfirm(
      'Hapus Akun Operator',
      `Apakah Anda yakin ingin menghapus akun operator "${operator.name}" (${operator.email})? Operator tidak akan dapat lagi masuk untuk membantu verifikasi dan seleksi pendaftar.`,
      () => {
        const res = storageService.deleteUserAccount(operator.user_id);
        if (res.success) {
          showToast(res.message, 'success', 'Akun Operator Dihapus');
          if (onRefreshData) onRefreshData();
        } else {
          showAlert('Gagal Menghapus Akun', res.message, 'error');
        }
      },
      {
        type: 'warning',
        confirmLabel: 'Ya, Hapus Akun',
        cancelLabel: 'Batal',
      }
    );
  };

  // Copy text helper
  const handleCopyCredentials = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    showToast('Informasi login akun operator disalin ke papan klip.', 'success');
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const isCurrentAdmin = currentUser?.role === 'admin_sekolah' || currentUser?.role === 'admin_pusat';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-teal-50 text-teal-700 rounded-2xl border border-teal-100/80 shrink-0 mt-0.5">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Tim Operator Madrasah
              </h2>
              <span className="px-2.5 py-0.5 bg-teal-100/80 text-teal-800 text-[11px] font-bold rounded-full border border-teal-200">
                {school.school_name}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Tambahkan dan kelola akun operator staf/panitia madrasah Anda untuk membantu verifikasi dokumen berkas pendaftaran dan proses kelulusan seleksi calon peserta didik.
            </p>
          </div>
        </div>

        {isCurrentAdmin && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Akun Operator</span>
          </button>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Operator</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{schoolOperators.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">Tim Panitia Madrasah</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-teal-600 uppercase tracking-wider">Operator Aktif</div>
          <div className="text-2xl font-black text-teal-600 mt-1">{activeCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">Memiliki hak akses login</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Akses Ditangguhkan</div>
          <div className="text-2xl font-black text-rose-600 mt-1">{inactiveCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">Dinonaktifkan sementara</div>
        </div>

        <div className="bg-gradient-to-br from-teal-50/60 to-emerald-50/60 p-4 rounded-2xl border border-teal-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-teal-600" />
            <span>Kewenangan Operator</span>
          </div>
          <div className="text-xs font-bold text-slate-800 mt-1.5 leading-snug">
            Verifikasi Berkas & Seleksi
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
            Membantu verifikasi & kelulusan pendaftar
          </div>
        </div>
      </div>

      {/* Helpful Guidance Banner */}
      <div className="p-4 bg-teal-50/70 border border-teal-200/80 rounded-2xl flex items-start gap-3 text-xs text-teal-950">
        <FileCheck2 className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Fungsi dan Wewenang Akun Operator Madrasah:</span>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Akun operator yang Anda buat dapat langsung masuk ke portal dengan memilih tab <strong>"Admin & Operator"</strong> saat login. Operator memiliki wewenang memeriksa kelengkapan berkas murid, menyetujui/meminta perbaikan berkas pendaftar, memberi catatan verifikasi, menetapkan kelulusan seleksi, dan memantau persebaran zonasi madrasah.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama operator, email, NIP, nomor HP, atau tugas..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            aria-label="Filter status akses operator"
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          >
            <option value="all">Semua Status ({schoolOperators.length})</option>
            <option value="active">Hanya Aktif ({activeCount})</option>
            <option value="inactive">Ditangguhkan ({inactiveCount})</option>
          </select>
        </div>
      </div>

      {/* Operators List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredOperators.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <UserCheck className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-800">
              {searchQuery || statusFilter !== 'all'
                ? 'Tidak ada akun operator yang sesuai dengan kriteria pencarian'
                : 'Belum Ada Akun Operator Madrasah'}
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'Silakan coba sesuaikan kata kunci pencarian atau bersihkan filter status.'
                : 'Tambahkan akun operator pertama Anda untuk mendelegasikan tugas verifikasi berkas dan proses seleksi calon murid.'}
            </p>
            {isCurrentAdmin && !searchQuery && statusFilter === 'all' && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs mt-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Tambah Operator Sekarang</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Operator & Tugas</th>
                  <th className="py-3 px-4">Email Login</th>
                  <th className="py-3 px-4">Kontak / NIP</th>
                  <th className="py-3 px-4">Status Akses</th>
                  <th className="py-3 px-4">Wewenang Seleksi</th>
                  <th className="py-3 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOperators.map((operator) => {
                  const isActive = operator.status === 'active';
                  return (
                    <tr key={operator.user_id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Operator Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm shrink-0">
                            {operator.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{operator.name}</div>
                            <div className="text-[11px] text-teal-700 font-semibold flex items-center gap-1 mt-0.5">
                              <Award className="w-3 h-3" />
                              <span>{operator.position || 'Operator Seleksi & Verifikasi'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{operator.email}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          ID: {operator.user_id}
                        </div>
                      </td>

                      {/* Contact / NIP */}
                      <td className="py-3 px-4">
                        {operator.phone ? (
                          <div className="text-slate-700 flex items-center gap-1.5 font-medium">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{operator.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Tanpa nomor HP</span>
                        )}
                        {operator.nip && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            NIP: {operator.nip}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Aktif</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Ditangguhkan</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Permissions Badge */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-medium">
                          <FileCheck2 className="w-3 h-3 text-teal-600" />
                          <span>Verifikasi & Kelulusan</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {isCurrentAdmin ? (
                          <div className="inline-flex items-center justify-end gap-1">
                            {/* Reset Password */}
                            <button
                              type="button"
                              onClick={() => {
                                setResetModalOperator(operator);
                                setCustomNewPass('');
                              }}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Reset kata sandi akun operator"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(operator)}
                              className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit data operator"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Toggle Status */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(operator)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isActive
                                  ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                                  : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={isActive ? 'Tangguhkan akses operator' : 'Aktifkan kembali akses operator'}
                            >
                              {isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteOperator(operator)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus akun operator permanen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Rekan Kerja</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= MODAL: ADD / EDIT OPERATOR ================= */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-100 text-teal-800 rounded-xl">
                  {editingOperator ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {editingOperator ? 'Perbarui Data Operator' : 'Tambah Akun Operator Madrasah'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {school.school_name} &bull; Wewenang Seleksi & Verifikasi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOperator} className="space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Lengkap Operator <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Ahmad Fauzi, S.Pd"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none font-medium text-slate-900"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email Login Operator <span className="text-rose-600">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Contoh: operator1.man1@madrasah.id"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none font-medium text-slate-900"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Digunakan untuk masuk ke sistem pada tab login "Admin & Operator".
                </p>
              </div>

              {/* Phone & NIP in 2 cols */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor WhatsApp / HP</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Contoh: 081234567890"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIP / NUPTK / No. Pegawai</label>
                  <input
                    type="text"
                    value={formData.nip}
                    onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                    placeholder="Opsional (18 digit jika PNS)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none font-medium text-slate-900"
                  />
                </div>
              </div>

              {/* Position / Role Responsibility */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tugas / Spesialisasi Panitia</label>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none font-medium text-slate-900"
                >
                  <option value="Operator Seleksi & Verifikasi PPDB">Operator Seleksi & Verifikasi PPDB (Lengkap)</option>
                  <option value="Operator Verifikasi Berkas Persyaratan">Operator Verifikasi Berkas Persyaratan</option>
                  <option value="Operator Seleksi & Penetapan Kelulusan">Operator Seleksi & Penetapan Kelulusan</option>
                  <option value="Operator Informasi & Layanan Pendaftar">Operator Informasi & Layanan Pendaftar</option>
                  <option value="Staf Panitia PPDB Madrasah">Staf Panitia PPDB Madrasah</option>
                </select>
              </div>

              {/* Password */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {editingOperator ? 'Kata Sandi Baru (Kosongkan jika tidak ingin diubah)' : 'Kata Sandi Awal (Opsional)'}
                </label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={
                    editingOperator
                      ? 'Biarkan kosong untuk mempertahankan kata sandi lama...'
                      : 'Kosongkan untuk membuat kata sandi otomatis yang aman...'
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none font-medium text-slate-900 font-mono text-[11px]"
                />
                {!editingOperator && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Jika dikosongkan, sistem akan otomatis membuat kata sandi acak yang aman dan menampilkannya setelah disimpan.
                  </p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Status Akses Akun</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'active' })}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer font-bold ${
                      formData.status === 'active'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Aktif</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'inactive' })}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer font-bold ${
                      formData.status === 'inactive'
                        ? 'bg-rose-50 border-rose-500 text-rose-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Ditangguhkan</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-colors shadow-xs cursor-pointer"
                >
                  {editingOperator ? 'Simpan Perubahan' : 'Buat Akun Operator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: RESET PASSWORD ================= */}
      {resetModalOperator && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Reset Kata Sandi Operator
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atur ulang kata sandi akun <strong>{resetModalOperator.name}</strong> ({resetModalOperator.email})
                </p>
              </div>
            </div>

            <form onSubmit={handlePerformReset} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kata Sandi Baru (Opsional)
                </label>
                <input
                  type="text"
                  value={customNewPass}
                  onChange={(e) => setCustomNewPass(e.target.value)}
                  placeholder="Kosongkan untuk otomatis membuat kata sandi acak..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none font-mono text-slate-900"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Jika dikosongkan, sistem membuat kata sandi acak 6 karakter.
                </p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Kata sandi lama operator akan langsung digantikan dengan kata sandi baru ini.
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetModalOperator(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-xs"
                >
                  Reset Kata Sandi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREDENTIALS SUCCESS DIALOG ================= */}
      {credentialsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {credentialsModal.isNew
                    ? 'Akun Operator Berhasil Dibuat!'
                    : 'Kata Sandi Operator Berhasil Direset!'}
                </h3>
                <p className="text-xs text-slate-500">
                  Kirimkan informasi login ini kepada operator terkait.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Nama Operator
                  </span>
                  <span className="font-bold text-slate-900">{credentialsModal.operator.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Madrasah Penugasan
                  </span>
                  <span className="font-semibold text-slate-800">{school.school_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Email Login
                  </span>
                  <span className="font-mono text-teal-800 font-bold">{credentialsModal.operator.email}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Kata Sandi
                  </span>
                  <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 mt-0.5">
                    <span className="font-mono font-black text-emerald-700 text-sm tracking-wider">
                      {credentialsModal.password || '(Tidak Diubah)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCredentials(credentialsModal.password || '')}
                      className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                      title="Salin kata sandi saja"
                    >
                      {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* WhatsApp format share text */}
              {(() => {
                const messageText = `*AKUN OPERATOR PPDB MADRASAH*\nMadrasah: ${school.school_name}\nNama: ${credentialsModal.operator.name}\nEmail: ${credentialsModal.operator.email}\nKata Sandi: ${credentialsModal.password || '-'}\n\nSilakan masuk melalui portal PPDB pada tab *Admin & Operator* untuk memulai verifikasi dan seleksi calon siswa.`;

                return (
                  <button
                    type="button"
                    onClick={() => handleCopyCredentials(messageText)}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{copiedKey ? 'Tersalin ke Clipboard!' : 'Salin Format Pesan WhatsApp / SMS'}</span>
                  </button>
                );
              })()}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setCredentialsModal(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
