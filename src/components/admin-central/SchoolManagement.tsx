import React, { useState } from 'react';
import { Plus, Edit, Check, X, MapPin, Search, School as SchoolIcon, Trash2, AlertTriangle, Users, FileText, ShieldAlert, Upload, Image as ImageIcon } from 'lucide-react';
import { School } from '../../types/sipma';
import { normalizeImageUrl, handleImageError, compressAndResizeImage } from '../../utils/imageUrl';
import { storageService } from '../../services/storageService';

interface Props {
  schools: School[];
  onSaveSchool: (school: School) => void;
  onDeleteSchool?: (schoolId: string) => void;
}

export const SchoolManagement: React.FC<Props> = ({ schools, onSaveSchool, onDeleteSchool }) => {
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [isNew, setIsNew] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [schoolToDelete, setSchoolToDelete] = useState<School | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');

  const filteredSchools = schools.filter((s) => {
    const q = search ? search.toLowerCase().trim() : '';
    if (!q) return true;
    return (
      (s.school_name?.toLowerCase() || '').includes(q) ||
      (s.nsm || '').includes(q) ||
      (s.npsn || '').includes(q) ||
      (s.address?.toLowerCase() || '').includes(q)
    );
  });

  const handleAddNew = () => {
    const newSchool: School = {
      school_id: `SCH-NEW-${Date.now()}`,
      school_name: '',
      school_code: '',
      nsm: '',
      npsn: '',
      level: 'MA',
      address: '',
      latitude: -6.2,
      longitude: 106.8,
      zoning_radius_km: 5.0,
      quota_zonasi: 100,
      quota_afirmasi: 50,
      quota_prestasi: 40,
      quota_mutasi: 20,
      status: 'active',
      principal_name: '',
      contact_phone: '',
      contact_email: '',
    };
    setEditingSchool(newSchool);
    setIsNew(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchool) return;
    onSaveSchool(editingSchool);
    setEditingSchool(null);
    setIsNew(false);
  };

  const handleOpenDelete = (s: School) => {
    setSchoolToDelete(s);
    setDeleteConfirmText('');
  };

  const handleConfirmDelete = () => {
    if (!schoolToDelete || !onDeleteSchool) return;
    onDeleteSchool(schoolToDelete.school_id);
    setSchoolToDelete(null);
    setDeleteConfirmText('');
  };

  const cascadeStats = schoolToDelete ? storageService.getSchoolCascadeStats(schoolToDelete.school_id) : null;

  return (
    <div className="space-y-6" id="sipma-school-management">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Manajemen Multi-Madrasah Terintegrasi
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5">Daftar Seluruh Madrasah (MI, MTs, MA)</h2>
        </div>

        <button
          type="button"
          onClick={handleAddNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Madrasah Baru</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama madrasah, NSM, NPSN..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
      </div>

      {/* Schools Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Nama Madrasah</th>
                <th className="py-3.5 px-4">Kode Unik</th>
                <th className="py-3.5 px-4">Jenjang</th>
                <th className="py-3.5 px-4">NSM / NPSN</th>
                <th className="py-3.5 px-4">Radius Zonasi</th>
                <th className="py-3.5 px-4">Kuota (Zon/Afir/Pres/Mut)</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchools.map((s) => (
                <tr key={s.school_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      {s.logo_url ? (
                        <img
                          src={normalizeImageUrl(s.logo_url)}
                          alt={s.school_name}
                          className="w-9 h-9 object-contain rounded-lg border border-slate-200 bg-white p-0.5 shrink-0"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                          {s.level || 'M'}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-900">{s.school_name}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">{s.address}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {s.school_code || s.school_id.replace(/^SCH-/, '')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-800">
                      {s.level}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-700">
                    {s.nsm} / {s.npsn}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-emerald-800">
                    {s.zoning_radius_km} km
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    {s.quota_zonasi} / {s.quota_afirmasi} / {s.quota_prestasi || 40} / {s.quota_mutasi || 20}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                        s.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {s.status === 'active' ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSchool(s);
                          setIsNew(false);
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="Edit Madrasah"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {onDeleteSchool && (
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(s)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Madrasah & Seluruh Data Terkait"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CASCADE DELETE CONFIRMATION MODAL */}
      {schoolToDelete && cascadeStats && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-rose-200 space-y-5 animate-in fade-in">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">
                  Hapus Madrasah &amp; Seluruh Data Terikat (Cascade Delete)
                </div>
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  Yakin ingin menghapus {schoolToDelete.school_name}?
                </h3>
              </div>
            </div>

            {/* Impact Breakdown Cards */}
            <div className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-xl space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Rincian Data yang Akan Dihapus Secara Permanen:</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-rose-200 shadow-2xs">
                  <div className="text-base font-black text-rose-700">{cascadeStats.applicationCount}</div>
                  <div className="text-[10px] text-slate-600 font-semibold mt-0.5">Pendaftar Masuk</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-rose-200 shadow-2xs">
                  <div className="text-base font-black text-rose-700">{cascadeStats.documentCount}</div>
                  <div className="text-[10px] text-slate-600 font-semibold mt-0.5">Berkas Dokumen</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-rose-200 shadow-2xs">
                  <div className="text-base font-black text-rose-700">{cascadeStats.userCount}</div>
                  <div className="text-[10px] text-slate-600 font-semibold mt-0.5">Akun Panitia &amp; Murid</div>
                </div>
              </div>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                Tindakan ini tidak dapat dibatalkan. Seluruh formulir pendaftaran, data orang tua, riwayat nilai/zonasi, berkas dokumen, serta akun login yang terhubung dengan satuan madrasah ini akan dibersihkan dari database.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSchoolToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Madrasah &amp; Semua Data Terikat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Add Modal */}
      {editingSchool && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {isNew ? 'Tambah Madrasah Baru' : `Edit Madrasah: ${editingSchool.school_name}`}
              </h3>
              <button
                type="button"
                onClick={() => setEditingSchool(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Nama Madrasah *</label>
                  <input
                    type="text"
                    value={editingSchool.school_name}
                    onChange={(e) => setEditingSchool({ ...editingSchool, school_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kode Unik Madrasah *
                    <span className="text-[10px] text-slate-400 font-normal ml-1">(Format No. Reg, cth: MAN01)</span>
                  </label>
                  <input
                    type="text"
                    value={editingSchool.school_code || ''}
                    onChange={(e) => setEditingSchool({ ...editingSchool, school_code: e.target.value.toUpperCase() })}
                    placeholder="Contoh: MAN01, MTS01, MI01"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono uppercase font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jenjang *</label>
                  <select
                    value={editingSchool.level}
                    onChange={(e) => setEditingSchool({ ...editingSchool, level: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="MI">MI (Madrasah Ibtidaiyah)</option>
                    <option value="MTs">MTs (Madrasah Tsanawiyah)</option>
                    <option value="MA">MA (Madrasah Aliyah)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Radius Zonasi (km) *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingSchool.zoning_radius_km}
                    onChange={(e) => setEditingSchool({ ...editingSchool, zoning_radius_km: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NSM</label>
                  <input
                    type="text"
                    value={editingSchool.nsm}
                    onChange={(e) => setEditingSchool({ ...editingSchool, nsm: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NPSN</label>
                  <input
                    type="text"
                    value={editingSchool.npsn}
                    onChange={(e) => setEditingSchool({ ...editingSchool, npsn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
                  <input
                    type="text"
                    value={editingSchool.address}
                    onChange={(e) => setEditingSchool({ ...editingSchool, address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Logo Madrasah (Upload / URL)</label>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    {editingSchool.logo_url ? (
                      <div className="relative group shrink-0">
                        <img
                          src={normalizeImageUrl(editingSchool.logo_url)}
                          alt="Logo"
                          className="w-12 h-12 object-contain rounded-lg border bg-white p-0.5"
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, '/logo.png')}
                        />
                        <button
                          type="button"
                          onClick={() => setEditingSchool({ ...editingSchool, logo_url: '' })}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-xs cursor-pointer"
                          title="Hapus Logo"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg border-2 border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 text-[10px] shrink-0">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex-1 space-y-1.5">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Pilih Gambar Logo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const compressed = await compressAndResizeImage(file, 800, 800, 0.88);
                                setEditingSchool({ ...editingSchool, logo_url: compressed.base64 });
                              } catch {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  if (typeof reader.result === 'string') {
                                    setEditingSchool({ ...editingSchool, logo_url: reader.result });
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }
                          }}
                        />
                      </label>
                      <input
                        type="url"
                        placeholder="Atau tempel URL gambar logo..."
                        value={editingSchool.logo_url || ''}
                        onChange={(e) => setEditingSchool({ ...editingSchool, logo_url: e.target.value })}
                        className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kuota Zonasi</label>
                  <input
                    type="number"
                    value={editingSchool.quota_zonasi}
                    onChange={(e) => setEditingSchool({ ...editingSchool, quota_zonasi: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kuota Afirmasi</label>
                  <input
                    type="number"
                    value={editingSchool.quota_afirmasi}
                    onChange={(e) => setEditingSchool({ ...editingSchool, quota_afirmasi: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kuota Prestasi</label>
                  <input
                    type="number"
                    value={editingSchool.quota_prestasi || 0}
                    onChange={(e) => setEditingSchool({ ...editingSchool, quota_prestasi: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kuota Mutasi</label>
                  <input
                    type="number"
                    value={editingSchool.quota_mutasi || 0}
                    onChange={(e) => setEditingSchool({ ...editingSchool, quota_mutasi: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                {/* Re-registration Schedule */}
                <div className="sm:col-span-2 pt-3 border-t border-slate-200">
                  <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2">
                    Jadwal & Ketentuan Daftar Ulang (Surat Keterangan Diterima)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Tanggal Mulai Daftar Ulang</label>
                      <input
                        type="date"
                        value={editingSchool.reregistration_start_date || ''}
                        onChange={(e) => setEditingSchool({ ...editingSchool, reregistration_start_date: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Batas Akhir Daftar Ulang</label>
                      <input
                        type="date"
                        value={editingSchool.reregistration_end_date || ''}
                        onChange={(e) => setEditingSchool({ ...editingSchool, reregistration_end_date: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Waktu / Jam Pelayanan</label>
                      <input
                        type="text"
                        placeholder="Contoh: 08.00 - 14.00 WIB"
                        value={editingSchool.reregistration_time || ''}
                        onChange={(e) => setEditingSchool({ ...editingSchool, reregistration_time: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Lokasi / Ruangan</label>
                      <input
                        type="text"
                        placeholder="Contoh: Sekretariat PPDB / PTSP"
                        value={editingSchool.reregistration_location || ''}
                        onChange={(e) => setEditingSchool({ ...editingSchool, reregistration_location: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Catatan Khusus Daftar Ulang</label>
                      <input
                        type="text"
                        placeholder="Contoh: Membawa berkas fisik asli dan fotokopi legalisir 2 rangkap."
                        value={editingSchool.reregistration_notes || ''}
                        onChange={(e) => setEditingSchool({ ...editingSchool, reregistration_notes: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSchool(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Simpan Data Madrasah
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
