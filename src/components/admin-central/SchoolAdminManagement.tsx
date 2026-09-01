import React, { useState, useMemo } from 'react';
import {
  User as UserType,
  School,
} from '../../types/sipma';
import { storageService } from '../../services/storageService';
import { useFeedback } from '../../context/FeedbackContext';
import {
  Users,
  Building2,
  ShieldCheck,
  KeyRound,
  UserPlus,
  Search,
  CheckCircle2,
  XCircle,
  Edit3,
  Trash2,
  Copy,
  Check,
  Lock,
  Unlock,
  AlertTriangle,
  Mail,
  Phone,
  Send,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface Props {
  schools: School[];
  onRefreshData?: () => void;
}

export const SchoolAdminManagement: React.FC<Props> = ({ schools, onRefreshData }) => {
  const { showAlert, showToast } = useFeedback();

  const [searchQuery, setSearchQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal states
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<UserType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    school_id: schools[0]?.school_id || '',
    nip: '',
    position: 'Panitia PPDB Madrasah',
    password: '',
    status: 'active' as 'active' | 'inactive',
  });

  // Reset password modal
  const [resetModalAdmin, setResetModalAdmin] = useState<UserType | null>(null);
  const [customNewPass, setCustomNewPass] = useState('');
  const [resetResult, setResetResult] = useState<{ password: string; admin: UserType } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Delete modal
  const [adminToDelete, setAdminToDelete] = useState<UserType | null>(null);

  // Load all users
  const allUsers = useMemo(() => {
    return storageService.getUsers();
  }, [schools, isAddEditModalOpen, resetModalAdmin, adminToDelete]);

  const schoolAdmins = useMemo(() => {
    return allUsers.filter((u) => u.role === 'admin_sekolah');
  }, [allUsers]);

  // Statistics
  const totalAdmins = schoolAdmins.length;
  const activeAdmins = schoolAdmins.filter((a) => a.status === 'active').length;
  const inactiveAdmins = schoolAdmins.filter((a) => a.status === 'inactive').length;

  const schoolsWithoutAdmin = useMemo(() => {
    return schools.filter((sch) => !schoolAdmins.some((adm) => adm.school_id === sch.school_id));
  }, [schools, schoolAdmins]);

  // Filtered admins
  const filteredAdmins = useMemo(() => {
    return schoolAdmins.filter((adm) => {
      const sch = schools.find((s) => s.school_id === adm.school_id);
      const matchesSearch =
        searchQuery.trim() === '' ||
        adm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        adm.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (adm.phone && adm.phone.includes(searchQuery)) ||
        (adm.nip && adm.nip.includes(searchQuery)) ||
        (sch?.school_name && sch.school_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sch?.school_code && sch.school_code.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSchool = schoolFilter === 'all' || adm.school_id === schoolFilter;
      const matchesStatus = statusFilter === 'all' || adm.status === statusFilter;

      return matchesSearch && matchesSchool && matchesStatus;
    });
  }, [schoolAdmins, schools, searchQuery, schoolFilter, statusFilter]);

  // Open create modal
  const handleOpenCreateModal = (preselectedSchoolId?: string) => {
    setEditingAdmin(null);
    const targetSchool = preselectedSchoolId || schools[0]?.school_id || '';
    const schoolObj = schools.find((s) => s.school_id === targetSchool);
    const schoolCode = (schoolObj?.school_code || 'madrasah').toLowerCase().replace(/[^a-z0-9]/g, '');

    setFormData({
      name: schoolObj ? `Panitia PPDB ${schoolObj.school_name}` : '',
      email: schoolObj ? `admin@${schoolCode}.sch.id` : '',
      phone: '081234567890',
      school_id: targetSchool,
      nip: '',
      position: 'Ketua Panitia PPDB Madrasah',
      password: `admin${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'active',
    });
    setIsAddEditModalOpen(true);
  };

  // Open edit modal
  const handleOpenEditModal = (admin: UserType) => {
    setEditingAdmin(admin);
    setFormData({
      name: admin.name,
      email: admin.email,
      phone: admin.phone || '',
      school_id: admin.school_id || schools[0]?.school_id || '',
      nip: admin.nip || '',
      position: admin.position || 'Panitia PPDB Madrasah',
      password: '', // Leave blank unless changing
      status: admin.status || 'active',
    });
    setIsAddEditModalOpen(true);
  };

  // Save admin
  const handleSaveAdmin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showAlert('Validasi Gagal', 'Nama lengkap admin wajib diisi.', 'error');
      return;
    }
    if (!formData.email.trim()) {
      showAlert('Validasi Gagal', 'Alamat email login wajib diisi.', 'error');
      return;
    }
    if (!formData.school_id) {
      showAlert('Validasi Gagal', 'Silakan pilih madrasah yang dinaungi admin ini.', 'error');
      return;
    }

    const res = storageService.saveSchoolAdminUser({
      user_id: editingAdmin ? editingAdmin.user_id : undefined,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      school_id: formData.school_id,
      nip: formData.nip,
      position: formData.position,
      password: formData.password || undefined,
      status: formData.status,
    });

    if (res.success) {
      setIsAddEditModalOpen(false);
      if (onRefreshData) onRefreshData();

      if (!editingAdmin && res.user && res.generatedPassword) {
        // Show credentials ready dialog
        setResetResult({
          password: res.generatedPassword,
          admin: res.user,
        });
      } else {
        showToast(res.message, 'success', 'Berhasil Disimpan');
      }
    } else {
      showAlert('Gagal Menyimpan Akun', res.message, 'error');
    }
  };

  // Toggle status
  const handleToggleStatus = (admin: UserType) => {
    const res = storageService.toggleUserStatus(admin.user_id);
    if (res.success) {
      showToast(res.message, 'info', 'Status Akses Diperbarui');
      if (onRefreshData) onRefreshData();
    } else {
      showAlert('Gagal Mengubah Status', res.message, 'error');
    }
  };

  // Submit reset password
  const handlePerformReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalAdmin) return;

    const res = storageService.resetSchoolAdminPassword(
      resetModalAdmin.user_id,
      customNewPass.trim() || undefined,
      'Admin Pusat'
    );

    if (res.success && res.newPassword && res.user) {
      setResetResult({
        password: res.newPassword,
        admin: res.user,
      });
      setResetModalAdmin(null);
      setCustomNewPass('');
      if (onRefreshData) onRefreshData();
    } else {
      showAlert('Gagal Mereset Password', res.message, 'error');
    }
  };

  // Delete admin
  const handleDeleteAdmin = () => {
    if (!adminToDelete) return;
    const res = storageService.deleteUserAccount(adminToDelete.user_id);
    if (res.success) {
      showToast(res.message, 'success', 'Akun Terhapus');
      setAdminToDelete(null);
      if (onRefreshData) onRefreshData();
    } else {
      showAlert('Gagal Menghapus', res.message, 'error');
    }
  };

  // Copy credentials format
  const getCredentialShareText = (admin: UserType, password: string) => {
    const school = schools.find((s) => s.school_id === admin.school_id);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sipma.kemenag.go.id';
    return `*KREDENSIAL AKSES ADMIN MADRASAH - SIPMA*\n\n` +
      `Kepada Yth. *${admin.name}*\n` +
      `Madrasah: *${school?.school_name || admin.school_id}*\n` +
      `Jabatan: *${admin.position || 'Panitia PPDB'}*\n\n` +
      `Berikut rincian akun akses masuk ke Portal PPDB Madrasah:\n` +
      `🔗 *Tautan Login:* ${origin}\n` +
      `👤 *Email/Username:* ${admin.email}\n` +
      `🔑 *Kata Sandi:* ${password}\n\n` +
      `_Harap segera masuk dan perbarui kata sandi Anda di menu profil demi keamanan data._\n` +
      `Pusat Layanan PPDB Kemenag`;
  };

  const handleCopyCredentials = (admin: UserType, pass: string) => {
    const text = getCredentialShareText(admin, pass);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(true);
      showToast('Kredensial login berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setCopiedKey(false), 2500);
    });
  };

  const handleSendWhatsApp = (admin: UserType, pass: string) => {
    const text = getCredentialShareText(admin, pass);
    const cleanPhone = (admin.phone || '').replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('0') ? '62' + cleanPhone.substring(1) : cleanPhone;
    const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Manajemen Akses Masuk Admin Madrasah
              </h2>
              <p className="text-xs text-slate-500">
                Atur akun login, hak akses, dan lakukan reset kata sandi seluruh panitia/operator madrasah se-wilayah.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleOpenCreateModal()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Akun Admin Madrasah</span>
        </button>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Akun Admin</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalAdmins}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">Terdaftar di {schools.length} Madrasah</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Akun Aktif</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{activeAdmins}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">Dapat login ke sistem</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Akses Terkunci</div>
          <div className="text-2xl font-black text-rose-600 mt-1">{inactiveAdmins}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">Dinonaktifkan sementara</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Madrasah Tanpa Admin</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{schoolsWithoutAdmin.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">Perlu dibuatkan akun</div>
        </div>
      </div>

      {/* Notice for schools without admin */}
      {schoolsWithoutAdmin.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-amber-900">
                Ada {schoolsWithoutAdmin.length} madrasah yang belum memiliki akun admin login:
              </div>
              <div className="text-xs text-amber-800 mt-0.5 flex flex-wrap gap-1.5">
                {schoolsWithoutAdmin.map((s) => (
                  <span key={s.school_id} className="bg-amber-100/80 px-2 py-0.5 rounded-md font-semibold text-amber-900">
                    {s.school_name}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleOpenCreateModal(schoolsWithoutAdmin[0]?.school_id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Buat Akun untuk {schoolsWithoutAdmin[0]?.school_name}</span>
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan nama admin, email, NIP, nomor HP, atau nama madrasah..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              aria-label="Filter Berdasarkan Madrasah"
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="all">Semua Madrasah ({schools.length})</option>
              {schools.map((s) => (
                <option key={s.school_id} value={s.school_id}>
                  {s.school_name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              aria-label="Filter Berdasarkan Status Akses"
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif Saja</option>
              <option value="inactive">Terkunci / Nonaktif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Admin Accounts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Admin Madrasah</th>
                <th className="py-3 px-4">Madrasah Naungan</th>
                <th className="py-3 px-4">Kredensial & Kontak</th>
                <th className="py-3 px-4">Status Akses</th>
                <th className="py-3 px-4 text-right">Aksi & Kontrol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">Tidak ada akun admin madrasah ditemukan</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {searchQuery || schoolFilter !== 'all' || statusFilter !== 'all'
                        ? 'Coba sesuaikan kata kunci pencarian atau filter Anda.'
                        : 'Klik tombol "Tambah Akun Admin Madrasah" untuk mendaftarkan panitia.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((admin) => {
                  const school = schools.find((s) => s.school_id === admin.school_id);
                  const isActive = admin.status === 'active';

                  return (
                    <tr key={admin.user_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center border border-emerald-200 shrink-0">
                            {admin.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 leading-snug">{admin.name}</div>
                            <div className="text-[11px] text-slate-500">
                              {admin.position || 'Panitia PPDB'}
                              {admin.nip ? ` • NIP: ${admin.nip}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                          <div>
                            <div className="font-bold text-slate-800">
                              {school?.school_name || admin.school_id || 'Belum Terhubung'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Kode: {school?.school_code || '-'} • NPSN: {school?.npsn || '-'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[11px]">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{admin.email}</span>
                          </div>
                          {admin.phone && (
                            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{admin.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(admin)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                            }`}
                            title={isActive ? 'Klik untuk memblokir/menonaktifkan akses' : 'Klik untuk mengaktifkan kembali akses'}
                          >
                            {isActive ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Aktif</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 text-rose-600" />
                                <span>Terkunci</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Reset Password Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setResetModalAdmin(admin);
                              setCustomNewPass('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            title="Reset Kata Sandi Akun Admin Ini"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                            <span>Reset Sandi</span>
                          </button>

                          {/* Edit Admin */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(admin)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Edit Data Admin"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Delete Admin */}
                          <button
                            type="button"
                            onClick={() => setAdminToDelete(admin)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Akun Admin Ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Tambah / Edit Akun Admin */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingAdmin ? 'Edit Akun Admin Madrasah' : 'Tambah Akun Admin Madrasah'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingAdmin
                      ? 'Perbarui hak akses dan data kontak admin madrasah.'
                      : 'Buat akun login baru untuk panitia/operator madrasah.'}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveAdmin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Madrasah Naungan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.school_id}
                  onChange={(e) => setFormData({ ...formData, school_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                >
                  <option value="" disabled>-- Pilih Madrasah --</option>
                  {schools.map((s) => (
                    <option key={s.school_id} value={s.school_id}>
                      {s.school_name} ({s.school_code || s.school_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Admin / Operator <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Drs. H. Ahmad Dahlan / Panitia PPDB MAN 1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email (Username Login) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="admin@man1jakarta.sch.id"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="081234567890"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jabatan / Posisi
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="Ketua Panitia PPDB / Operator"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NIP / NIK (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formData.nip}
                    onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                    placeholder="198001012005011001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {editingAdmin ? 'Ganti Password (Kosongkan jika tidak diubah)' : 'Kata Sandi Awal'}
                </label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingAdmin ? 'Masukkan kata sandi baru...' : 'Otomatis di-generate jika dikosongkan'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Status Akses Akun
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold"
                >
                  <option value="active">Aktif (Dapat Login)</option>
                  <option value="inactive">Non-Aktif / Terkunci (Diblokir)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  {editingAdmin ? 'Simpan Perubahan' : 'Buat Akun Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Form Reset Kata Sandi */}
      {resetModalAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reset Kata Sandi Admin</h3>
                <p className="text-xs text-slate-500">{resetModalAdmin.name} ({resetModalAdmin.email})</p>
              </div>
            </div>

            <form onSubmit={handlePerformReset} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kata Sandi Baru (Opsional)
                </label>
                <input
                  type="text"
                  value={customNewPass}
                  onChange={(e) => setCustomNewPass(e.target.value)}
                  placeholder="Kosongkan untuk kata sandi acak otomatis..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Jika dikosongkan, sistem akan membuatkan kata sandi acak yang aman (misal: adm829104).
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetModalAdmin(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Proses Reset Sandi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Hasil Reset & Bagikan Kredensial */}
      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Kata Sandi Berhasil Disetel!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Kredensial login untuk <strong>{resetResult.admin.name}</strong> siap digunakan.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-left font-mono text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Email/Username:</span>
                <span className="font-bold text-slate-800">{resetResult.admin.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Kata Sandi Baru:</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {resetResult.password}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleCopyCredentials(resetResult.admin, resetResult.password)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Disalin!' : 'Salin Kredensial'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendWhatsApp(resetResult.admin, resetResult.password)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim WhatsApp</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setResetResult(null)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus Admin */}
      {adminToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Hapus Akun Admin Madrasah?</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Anda akan menghapus akun <strong>{adminToDelete.name}</strong> ({adminToDelete.email}).
                Pengguna ini tidak akan dapat login lagi ke sistem PPDB madrasah.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdminToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteAdmin}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
